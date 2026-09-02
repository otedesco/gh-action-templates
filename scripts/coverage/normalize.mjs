import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const METRICS = ["statements", "branches", "functions", "lines"];

function fail(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  throw error;
}

function countMetric(metric, file, name) {
  const value = file?.[metric];
  if (!value || !Number.isInteger(value.total) || !Number.isInteger(value.covered) || value.total < 0 || value.covered < 0 || value.covered > value.total) {
    fail(`Invalid ${metric} coverage for ${name}`, { code: "invalid-coverage-metric", metric });
  }
  return { covered: value.covered, total: value.total };
}

export function normalizeCoverage(summary, { root = process.cwd() } = {}) {
  const files = summary?.files;
  if (!files || typeof files !== "object" || Array.isArray(files)) fail("Coverage report must contain a files object", { code: "missing-files" });
  const normalized = {};
  for (const [rawName, file] of Object.entries(files)) {
    const name = path.relative(root, path.resolve(root, rawName)).split(path.sep).join("/");
    if (!name || name.startsWith("../") || path.isAbsolute(name)) fail(`Coverage path escapes repository: ${rawName}`, { code: "path-outside-repository" });
    if (normalized[name]) fail(`Duplicate normalized coverage path: ${name}`, { code: "duplicate-file" });
    normalized[name] = Object.fromEntries(METRICS.map((metric) => [metric, countMetric(metric, file, name)]));
  }
  if (!Object.keys(normalized).length) fail("Coverage report contains no files", { code: "empty-report" });
  return { schemaVersion: 1, files: Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))) };
}

export async function readAndNormalize(file, options) {
  return normalizeCoverage(JSON.parse(await readFile(file, "utf8")), options);
}

export function globalMetrics(report) {
  return Object.fromEntries(METRICS.map((metric) => {
    const covered = Object.values(report.files).reduce((sum, file) => sum + file[metric].covered, 0);
    const total = Object.values(report.files).reduce((sum, file) => sum + file[metric].total, 0);
    return [metric, { covered, total, percent: total === 0 ? 100 : (covered / total) * 100 }];
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((entries, argument, index, values) => {
    if (argument.startsWith("--")) entries.push([argument.slice(2), values[index + 1]]);
    return entries;
  }, []));
  const report = await readAndNormalize(args.report ?? "coverage/summary.json", { root: process.cwd() });
  await writeFile(args.output ?? "coverage/normalized.json", `${JSON.stringify(report, null, 2)}\n`);
}
