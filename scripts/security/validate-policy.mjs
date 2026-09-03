import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const exceptionSchema = require("../../security/exception.schema.json");

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);
const TOOLS = new Set(["codeql", "dependency-review", "secret-scan", "license", "workflow-security"]);
const REQUIRED_EXCEPTION_FIELDS = [
  "id",
  "owner",
  "rationale",
  "scope",
  "compensatingControl",
  "approvedBy",
  "expiresAt",
];
const SCOPE_FIELDS = exceptionSchema.items.properties.scope.required;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function scopeKey(scope = {}) {
  return SCOPE_FIELDS.map((key) => `${key}=${text(scope[key])}`).join("|");
}

function matchesScope(finding, scope = {}) {
  return SCOPE_FIELDS.every((key) => text(scope[key]) === text(finding[key]));
}

function isDateTime(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isActive(exception, now) {
  const expiry = Date.parse(exception.expiresAt);
  return Number.isFinite(expiry) && expiry > now.getTime();
}

export function validatePolicy(policy, exceptions = [], now = new Date()) {
  const errors = [];
  if (!policy || policy.version !== 1) errors.push("policy version must be 1");
  const allowed = new Set(policy?.allowedSeverities ?? []);
  for (const severity of policy?.allowedSeverities ?? []) {
    if (!SEVERITIES.has(severity)) errors.push(`unsupported severity: ${severity}`);
  }
  for (const severity of policy?.blockingSeverities ?? []) {
    if (!allowed.has(severity)) errors.push(`blocking severity is not allowed: ${severity}`);
  }
  for (const tool of policy?.tools ?? []) {
    if (!TOOLS.has(text(tool))) errors.push(`unsupported tool: ${tool}`);
  }

  const ids = new Set();
  const scopes = new Set();
  for (const exception of exceptions) {
    const id = exception?.id ?? "<unknown>";
    for (const field of REQUIRED_EXCEPTION_FIELDS) {
      if (field === "scope") continue;
      if (!text(exception?.[field])) errors.push(`exception ${id} missing ${field}`);
    }
    if (exception?.id && !/^[A-Z0-9][A-Z0-9._-]+$/.test(exception.id)) errors.push(`exception ${id} id has invalid format`);
    for (const field of ["owner", "rationale", "compensatingControl", "approvedBy"]) {
      if (exception?.[field] !== undefined && typeof exception[field] !== "string") errors.push(`exception ${id} ${field} must be a string`);
    }
    const scope = exception?.scope;
    const scopeKeys = scope && typeof scope === "object" && !Array.isArray(scope) ? Object.keys(scope) : [];
    if (
      scopeKeys.length !== exceptionSchema.items.properties.scope.maxProperties ||
      !SCOPE_FIELDS.every((key) => scopeKeys.includes(key))
    )
      errors.push(`exception ${id} scope must contain exactly tool, rule, and subject`);
    if (!scope || typeof scope !== "object" || Array.isArray(scope) || SCOPE_FIELDS.some((key) => !text(scope[key])))
      errors.push(`exception ${id} scope fields must be non-empty`);
    else if (Object.values(scope).some((value) => text(value) === "*"))
      errors.push(`exception ${id} scope is too broad`);
    if (scope && typeof scope === "object" && Object.keys(scope).some((key) => !SCOPE_FIELDS.includes(key)))
      errors.push(`exception ${id} scope contains unknown fields`);
    if (
      exception &&
      typeof exception === "object" &&
      Object.keys(exception).some(
        (key) => !exceptionSchema.items.required.includes(key) && !Object.hasOwn(exceptionSchema.items.properties, key),
      )
    )
      errors.push(`exception ${id} contains unknown fields`);
    if (ids.has(exception?.id)) errors.push(`duplicate exception id: ${exception.id}`);
    if (exception?.id) ids.add(exception.id);
    const key = scopeKey(scope);
    if (scopes.has(key)) errors.push(`duplicate exception scope: ${key}`);
    scopes.add(key);
    if (exception?.expiresAt && (!isDateTime(exception.expiresAt) || !isActive(exception, now))) {
      errors.push(`exception ${exception.id} expiry is expired or invalid`);
    }
  }
  return errors.sort();
}

export function evaluateFindings(findings, policy, exceptions = [], now = new Date()) {
  const policyErrors = validatePolicy(policy, exceptions, now);
  const blocking = [];
  const allowed = [];
  const excepted = [];
  const diagnostics = [...policyErrors.map((message) => `policy: ${message}`)];
  const blockingSeverities = new Set(Array.isArray(policy?.blockingSeverities) ? policy.blockingSeverities : []);

  if (policyErrors.length) {
    blocking.push(...findings);
    return { blocking, allowed, excepted, diagnostics: [...diagnostics, ...formatFindings(blocking)] };
  }

  for (const finding of findings) {
    const exception = exceptions.find((candidate) => matchesScope(finding, candidate.scope));
    if (blockingSeverities.has(finding.severity)) {
      if (exception && isActive(exception, now) && validatePolicy(policy, [exception], now).length === 0) {
        excepted.push(finding);
      } else {
        blocking.push(finding);
        if (exception && !isActive(exception, now))
          diagnostics.push(
            `finding ${finding.fingerprint} remains blocking because exception ${exception.id} is expired`,
          );
      }
    } else {
      allowed.push(finding);
    }
  }
  const sort = (left, right) =>
    [left.tool, left.rule, left.subject, left.fingerprint]
      .join("\0")
      .localeCompare([right.tool, right.rule, right.subject, right.fingerprint].join("\0"));
  blocking.sort(sort);
  allowed.sort(sort);
  excepted.sort(sort);
  return { blocking, allowed, excepted, diagnostics: [...diagnostics, ...formatFindings(blocking)] };
}

export function formatFindings(findings) {
  return [...findings]
    .sort((left, right) =>
      [left.tool, left.rule, left.subject, left.fingerprint]
        .join("\0")
        .localeCompare([right.tool, right.rule, right.subject, right.fingerprint].join("\0")),
    )
    .map(
      (finding) =>
        `- ${finding.severity} ${finding.tool}/${finding.rule} at ${finding.subject} (${finding.fingerprint}); remediation: review, fix, or add a narrow approved exception`,
    )
    .join("\n");
}

async function main() {
  const [, , findingsPath, policyPath = "security/security-policy.json", exceptionsPath = "security/exceptions.json"] =
    process.argv;
  if (!findingsPath)
    throw new Error("usage: node scripts/security/validate-policy.mjs <findings.json> [policy.json] [exceptions.json]");
  const [findings, policy, exceptions] = await Promise.all(
    [findingsPath, policyPath, exceptionsPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
  );
  const result = evaluateFindings(findings, policy, exceptions);
  if (result.diagnostics.length) console.error(result.diagnostics.join("\n"));
  if (result.blocking.length || result.diagnostics.some((line) => line.startsWith("policy:"))) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
