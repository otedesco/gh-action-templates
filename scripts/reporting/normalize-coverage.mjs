import { validateObservation } from "./contract.mjs";

const METRICS = ["statements", "branches", "functions", "lines"];

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function metric(value, label) {
  object(value, label);
  for (const field of ["covered", "total"]) {
    if (!Number.isInteger(value[field]) || value[field] < 0)
      throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  if (value.covered > value.total) throw new Error(`${label}.covered cannot exceed total`);
  return value;
}

function coverageTotals(report) {
  object(report, "normalized coverage");
  if (report.schemaVersion !== 1) throw new Error("normalized coverage schemaVersion must be 1");
  const files = object(report.files, "normalized coverage files");
  const entries = Object.entries(files);
  if (entries.length === 0) throw new Error("normalized coverage files must not be empty");
  const totals = Object.fromEntries(METRICS.map((name) => [name, { covered: 0, total: 0 }]));
  for (const [file, coverage] of entries) {
    object(coverage, `normalized coverage ${file}`);
    for (const name of METRICS) {
      const value = metric(coverage[name], `normalized coverage ${file}.${name}`);
      totals[name].covered += value.covered;
      totals[name].total += value.total;
    }
  }
  return totals;
}

function coverageDecision(decision) {
  object(decision, "coverage decision");
  if (typeof decision.passed !== "boolean") throw new Error("coverage decision passed must be boolean");
  return { passed: decision.passed };
}

export function normalizeCoverageObservation({
  envelope,
  normalizedCoverage,
  coverageDecision: decision,
  actualSha256,
}) {
  const envelopeErrors = validateObservation(envelope);
  if (envelopeErrors.length) throw new Error(envelopeErrors.join("\n"));
  if (envelope.family !== "coverage") throw new Error("coverage observation envelope must use the coverage family");
  if (!envelope.source) throw new Error("coverage observation envelope source is required");
  if (actualSha256 !== envelope.source.sha256)
    throw new Error("coverage artifact checksum does not match observation source");

  const details = {
    ...envelope.details,
    coverage: coverageTotals(normalizedCoverage),
    decision: coverageDecision(decision),
  };
  return {
    ...envelope,
    outcome: details.decision.passed ? "success" : "failure",
    details,
  };
}
