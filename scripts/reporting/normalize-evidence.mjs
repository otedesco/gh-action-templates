import { validateReleaseEvidence } from "../container/verify-release-evidence.mjs";
import { validateObservation } from "./contract.mjs";

const OUTCOMES = new Set(["success", "failure", "cancelled", "skipped", "unavailable"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} is required`);
  return value.trim();
}

function reportingEnvelope(envelope, family) {
  const errors = validateObservation(envelope);
  if (errors.length) throw new Error(errors.join("\n"));
  if (envelope.family !== family) throw new Error(`evidence envelope must use the ${family} family`);
  return envelope;
}

function outcome(value, label) {
  if (!OUTCOMES.has(value)) throw new Error(`${label} outcome is unsupported`);
  return value;
}

export function normalizeCoreObservation({ envelope, result }) {
  const source = reportingEnvelope(envelope, "core");
  object(result, "core result");
  const completedChecks = result.completedChecks;
  if (
    !Array.isArray(completedChecks) ||
    completedChecks.some((check) => typeof check !== "string" || check.trim() === "")
  )
    throw new Error("core result completedChecks must contain check names");
  return {
    ...source,
    outcome: outcome(result.outcome, "core result"),
    details: { ...source.details, core: { completedChecks: [...completedChecks].sort() } },
  };
}

export function normalizeSecurityObservation({ envelope, result }) {
  const source = reportingEnvelope(envelope, "security");
  object(result, "security result");
  const scannerVersions = object(result.scannerVersions, "security result scannerVersions");
  const scanners = Object.entries(scannerVersions);
  if (scanners.length === 0) throw new Error("security result scannerVersions must not be empty");
  const normalizedVersions = Object.fromEntries(
    scanners.map(([scanner, version]) => [
      text(scanner, "security result scanner name"),
      text(version, `scanner ${scanner} version`),
    ]),
  );
  if (!Array.isArray(result.findings)) throw new Error("security result findings must be an array");
  return {
    ...source,
    outcome: outcome(result.outcome, "security result"),
    details: {
      ...source.details,
      security: {
        policyVersion: text(result.policyVersion, "security result policyVersion"),
        scannerVersions: Object.fromEntries(
          Object.entries(normalizedVersions).sort(([left], [right]) => left.localeCompare(right)),
        ),
        findingCount: result.findings.length,
      },
    },
  };
}

export function normalizeReleaseObservation({ envelope, evidence }) {
  const source = reportingEnvelope(envelope, "release");
  const release = validateReleaseEvidence(evidence);
  return {
    ...source,
    outcome: "success",
    details: {
      ...source.details,
      release: {
        image: evidence.image,
        digest: evidence.digest,
        jobs: [...release.jobs].sort(),
      },
    },
  };
}
