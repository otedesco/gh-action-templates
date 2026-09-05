const CHECK_FAMILIES = new Set(["core", "coverage", "security", "release"]);
const OUTCOMES = new Set(["success", "failure", "cancelled", "skipped", "unavailable"]);
const STATUS_PRECEDENCE = [
  "missing",
  "unavailable",
  "malformed",
  "stale",
  "cancelled",
  "failing",
  "excepted",
  "passing",
  "unknown",
];
const EXPECTED_REPOSITORIES = [
  "gh-action-templates",
  "commons",
  "cache",
  "server-utils",
  "notify",
  "cerberus",
  "hermes",
  "web-app",
];
const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const URL_RE = /^https:\/\/[^\s]+$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validUtcTimestamp(value) {
  return typeof value === "string" && UTC_TIMESTAMP_RE.test(value) && Number.isFinite(Date.parse(value));
}

function validateExpectedChecks(repository, errors) {
  if (!Array.isArray(repository.expectedChecks) || repository.expectedChecks.length === 0) {
    errors.push(`repository ${repository.name ?? "<unknown>"} expectedChecks must be a non-empty array`);
    return;
  }
  const names = new Set();
  for (const check of repository.expectedChecks) {
    const label = `repository ${repository.name ?? "<unknown>"} check ${check?.name ?? "<unknown>"}`;
    if (!isObject(check)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (!text(check.name)) errors.push(`${label} name is required`);
    if (names.has(check.name)) errors.push(`${label} is duplicated`);
    names.add(check.name);
    if (!CHECK_FAMILIES.has(check.family))
      errors.push(`${label} has unsupported check family ${check.family ?? "<missing>"}`);
    if (typeof check.required !== "boolean") errors.push(`${label} required must be boolean`);
  }
}

export function validateRepositoryCatalog(catalog) {
  const errors = [];
  if (!isObject(catalog)) return ["repository catalog must be an object"];
  if (catalog.schemaVersion !== 1) errors.push("repository catalog schemaVersion must be 1");
  if (!Array.isArray(catalog.repositories)) return [...errors, "repository catalog repositories must be an array"];

  const names = new Set();
  const slugs = new Set();
  for (const repository of catalog.repositories) {
    if (!isObject(repository)) {
      errors.push("repository entry must be an object");
      continue;
    }
    const name = text(repository.name);
    if (!name) errors.push("repository name is required");
    if (names.has(name)) errors.push(`duplicate repository: ${name}`);
    names.add(name);
    const slug = text(repository.slug);
    if (!/^[^/\s]+\/[^/\s]+$/.test(slug))
      errors.push(`repository ${name || "<unknown>"} slug must be owner/repository`);
    if (slugs.has(slug)) errors.push(`duplicate repository slug: ${slug}`);
    slugs.add(slug);
    if (typeof repository.enrolled !== "boolean")
      errors.push(`repository ${name || "<unknown>"} enrolled must be boolean`);
    if (!text(repository.enrollmentReason))
      errors.push(`repository ${name || "<unknown>"} enrollment reason is required`);
    validateExpectedChecks(repository, errors);
  }

  for (const name of EXPECTED_REPOSITORIES) {
    if (!names.has(name)) errors.push(`missing repository: ${name}`);
  }
  for (const name of names) {
    if (name && !EXPECTED_REPOSITORIES.includes(name)) errors.push(`unsupported repository: ${name}`);
  }
  const central = catalog.repositories.find((repository) => repository?.name === "gh-action-templates");
  if (central && central.enrolled !== true) errors.push("gh-action-templates must be enrolled");
  return errors.sort();
}

export function validateObservation(observation) {
  const errors = [];
  if (!isObject(observation)) return ["observation must be an object"];
  if (observation.schemaVersion !== 1) errors.push("observation schemaVersion must be 1");
  if (!text(observation.repository)) errors.push("observation repository is required");
  if (!SHA_RE.test(observation.commit ?? "")) errors.push("observation commit must be a 40-character lowercase SHA");
  if (!SHA_RE.test(observation.workflowSha ?? ""))
    errors.push("observation workflowSha must be a 40-character lowercase SHA");
  if (!text(observation.check)) errors.push("observation check is required");
  if (!CHECK_FAMILIES.has(observation.family)) errors.push("observation family is unsupported");
  if (!OUTCOMES.has(observation.outcome)) errors.push("observation outcome is unsupported");
  if (!validUtcTimestamp(observation.occurredAt))
    errors.push("observation occurredAt must be an ISO-8601 UTC timestamp");
  if (!isObject(observation.details)) errors.push("observation details must be an object");

  if (observation.outcome !== "unavailable" && !isObject(observation.source)) {
    errors.push("observation source is required unless outcome is unavailable");
  }
  if (observation.source !== undefined) {
    if (!isObject(observation.source)) {
      errors.push("observation source must be an object");
    } else {
      if (!text(observation.source.runId)) errors.push("observation source runId is required");
      if (!URL_RE.test(observation.source.runUrl ?? "")) errors.push("observation source runUrl must be an HTTPS URL");
      if (!URL_RE.test(observation.source.artifactUrl ?? ""))
        errors.push("observation source artifactUrl must be an HTTPS URL");
      if (!SHA256_RE.test(observation.source.sha256 ?? ""))
        errors.push("observation source sha256 must be a 64-character lowercase SHA-256");
    }
  }
  return errors.sort();
}

export function validateStatusPolicy(policy) {
  const errors = [];
  if (!isObject(policy)) return ["status policy must be an object"];
  if (policy.schemaVersion !== 1) errors.push("status policy schemaVersion must be 1");
  if (!Number.isInteger(policy.freshnessHours) || policy.freshnessHours <= 0)
    errors.push("status policy freshnessHours must be a positive integer");
  if (!Array.isArray(policy.requiredCheckFamilies) || policy.requiredCheckFamilies.length === 0) {
    errors.push("status policy requiredCheckFamilies must be a non-empty array");
  } else {
    for (const family of policy.requiredCheckFamilies) {
      if (!CHECK_FAMILIES.has(family)) errors.push(`status policy has unsupported required check family ${family}`);
    }
  }
  if (
    !Array.isArray(policy.statusPrecedence) ||
    policy.statusPrecedence.length !== STATUS_PRECEDENCE.length ||
    policy.statusPrecedence.some((status, index) => status !== STATUS_PRECEDENCE[index])
  ) {
    errors.push("status policy status precedence must match the reporting contract");
  }
  return errors.sort();
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])]),
  );
}

export function stableJson(value) {
  return `${JSON.stringify(sortValue(value))}\n`;
}

export const REPORTING_CHECK_FAMILIES = [...CHECK_FAMILIES];
export const REPORTING_OUTCOMES = [...OUTCOMES];
export const REPORTING_STATUS_PRECEDENCE = [...STATUS_PRECEDENCE];
