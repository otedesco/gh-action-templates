import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function scopeKey(scope = {}) {
  return ["tool", "rule", "subject"].map((key) => `${key}=${text(scope[key])}`).join("|");
}

function matchesScope(finding, scope = {}) {
  return Object.entries(scope).every(([key, value]) => text(value) === text(finding[key]));
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
    for (const field of REQUIRED_EXCEPTION_FIELDS) {
      if (field === "scope") continue;
      if (!text(exception?.[field])) errors.push(`exception ${exception?.id ?? "<unknown>"} missing ${field}`);
    }
    const scope = exception?.scope;
    if (!scope || typeof scope !== "object" || Object.keys(scope).length < 2) {
      errors.push(`exception ${exception?.id ?? "<unknown>"} scope must identify at least two fields`);
    } else if (Object.values(scope).some((value) => !text(value) || text(value) === "*")) {
      errors.push(`exception ${exception.id} scope is too broad`);
    }
    if (ids.has(exception?.id)) errors.push(`duplicate exception id: ${exception.id}`);
    if (exception?.id) ids.add(exception.id);
    const key = scopeKey(scope);
    if (scopes.has(key)) errors.push(`duplicate exception scope: ${key}`);
    scopes.add(key);
    if (exception?.expiresAt && (!Number.isFinite(Date.parse(exception.expiresAt)) || !isActive(exception, now))) {
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
  const blockingSeverities = new Set(policy.blockingSeverities);

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
