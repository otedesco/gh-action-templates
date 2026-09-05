import { validateObservation, validateRepositoryCatalog, validateStatusPolicy } from "./contract.mjs";

const OUTCOME_ORDER = { failure: 4, cancelled: 3, skipped: 2, unavailable: 1, success: 0 };
const STATUS_ORDER = [
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

function key(repository, check) {
  return `${repository}:${check}`;
}

function compareObservations(left, right) {
  const timestamp = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  if (timestamp !== 0) return timestamp;
  const outcome = (OUTCOME_ORDER[right.outcome] ?? -1) - (OUTCOME_ORDER[left.outcome] ?? -1);
  if (outcome !== 0) return outcome;
  return String(right.source?.runId ?? "").localeCompare(String(left.source?.runId ?? ""));
}

function isStale(observation, policy, now) {
  return now.getTime() - Date.parse(observation.occurredAt) > policy.freshnessHours * 60 * 60 * 1000;
}

export function selectCurrentObservation(observations) {
  return [...observations].sort(compareObservations)[0];
}

export function deriveStatus({ expected, enrolled = true, observation, policy, now, excepted = false }) {
  if (!expected) return "unknown";
  if (!enrolled) return "unavailable";
  if (!observation) return "missing";
  if (validateObservation(observation).length) return "malformed";
  if (isStale(observation, policy, now)) return "stale";
  if (observation.outcome === "cancelled" || observation.outcome === "skipped") return "cancelled";
  if (observation.outcome === "failure") return "failing";
  if (excepted) return "excepted";
  if (observation.outcome === "success") return "passing";
  return "unknown";
}

function repositoryStatus(checks) {
  return [...checks].sort(
    (left, right) =>
      STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status) || left.name.localeCompare(right.name),
  )[0]?.status;
}

export function canPublish(snapshot) {
  return snapshot?.publicationAllowed === true;
}

export function normalizeSnapshot({
  catalog,
  policy,
  observations = [],
  now = new Date(),
  exceptedChecks = new Set(),
}) {
  const errors = [...validateRepositoryCatalog(catalog), ...validateStatusPolicy(policy)];
  if (errors.length) throw new Error(errors.join("\n"));
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("now must be a valid Date");
  if (!Array.isArray(observations)) throw new Error("observations must be an array");

  const grouped = new Map();
  for (const observation of observations) {
    const observationKey = key(observation?.repository, observation?.check);
    const values = grouped.get(observationKey) ?? [];
    values.push(observation);
    grouped.set(observationKey, values);
  }

  const repositories = catalog.repositories
    .map((repository) => {
      const checks = repository.expectedChecks
        .map((expected) => {
          const candidates = grouped.get(key(repository.name, expected.name)) ?? [];
          const current = candidates.length ? selectCurrentObservation(candidates) : undefined;
          const status = deriveStatus({
            expected: true,
            enrolled: repository.enrolled,
            observation: current,
            policy,
            now,
            excepted: exceptedChecks.has(key(repository.name, expected.name)),
          });
          return {
            name: expected.name,
            family: expected.family,
            required: expected.required,
            status,
            observation: current,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name));
      return {
        name: repository.name,
        slug: repository.slug,
        enrolled: repository.enrolled,
        status: repositoryStatus(checks),
        checks,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const history = [...observations].sort(
    (left, right) =>
      String(left?.occurredAt ?? "").localeCompare(String(right?.occurredAt ?? "")) ||
      String(left?.check ?? "").localeCompare(String(right?.check ?? "")) ||
      String(left?.source?.runId ?? "").localeCompare(String(right?.source?.runId ?? "")),
  );
  const publicationAllowed = repositories.every((repository) =>
    repository.enrolled
      ? repository.checks.filter((check) => check.required).every((check) => check.status === "passing")
      : true,
  );
  return {
    schemaVersion: 1,
    catalogSchemaVersion: catalog.schemaVersion,
    policySchemaVersion: policy.schemaVersion,
    generatedAt: now.toISOString(),
    repositories,
    history,
    publicationAllowed,
  };
}
