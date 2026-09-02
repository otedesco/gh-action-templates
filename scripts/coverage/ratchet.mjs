import { METRICS, globalMetrics } from "./normalize.mjs";
import { readFile, writeFile } from "node:fs/promises";

export function validateBaseline(baseline) {
  const errors = [];
  if (!baseline || baseline.schemaVersion !== 1 || !baseline.repository || !baseline.commit || !baseline.timestamp) errors.push({ code: "invalid-baseline-metadata", remediation: "Provide repository, commit, timestamp, and schemaVersion." });
  for (const metric of METRICS) {
    const value = baseline?.metrics?.[metric];
    if (!value || !Number.isFinite(value.percent) || !Number.isInteger(value.covered) || !Number.isInteger(value.total) || value.total < 0 || value.covered < 0 || value.covered > value.total) errors.push({ code: "invalid-baseline-metric", metric, remediation: "Provide covered, total, and percent values for every metric." });
  }
  return errors;
}

export function evaluateRatchet(report, baseline) {
  const errors = validateBaseline(baseline);
  if (errors.length) return { passed: false, errors, proposedBaseline: null };
  const current = globalMetrics(report);
  for (const metric of METRICS) if (current[metric].percent < baseline.metrics[metric].percent) errors.push({ code: "global-coverage-regression", metric, previous: baseline.metrics[metric].percent, current: current[metric].percent, remediation: "Add coverage or keep the global metric at its baseline." });
  const proposedBaseline = { schemaVersion: 1, repository: baseline.repository, commit: baseline.commit, timestamp: baseline.timestamp, metrics: Object.fromEntries(METRICS.map((metric) => [metric, current[metric].percent > baseline.metrics[metric].percent ? current[metric] : baseline.metrics[metric]])) };
  return { passed: errors.length === 0, errors, proposedBaseline };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((entries, argument, index, values) => {
    if (argument.startsWith("--")) entries.push([argument.slice(2), values[index + 1]]);
    return entries;
  }, []));
  const report = JSON.parse(await readFile(args.report ?? "coverage/normalized.json", "utf8"));
  const baseline = JSON.parse(await readFile(args.baseline ?? "coverage-baselines/current.json", "utf8"));
  const decision = evaluateRatchet(report, baseline);
  await writeFile(args.output ?? "coverage/ratchet-decision.json", `${JSON.stringify(decision, null, 2)}\n`);
  if (!decision.passed) { console.error(JSON.stringify(decision, null, 2)); process.exitCode = 1; }
}
