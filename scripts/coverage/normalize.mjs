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

function detailedMetric(metric, file) {
  const locations = [];
  if (metric === "statements" && file.statementMap && file.s) {
    for (const [id, location] of Object.entries(file.statementMap)) locations.push({ line: location.start.line, covered: file.s[id] ?? 0 });
  } else if (metric === "functions" && file.fnMap && file.f) {
    for (const [id, location] of Object.entries(file.fnMap)) locations.push({ line: location.loc?.start?.line ?? location.decl?.start?.line, covered: file.f[id] ?? 0 });
  } else if (metric === "branches" && file.branchMap && file.b) {
    for (const [id, locationsForBranch] of Object.entries(file.branchMap)) {
      const counts = file.b[id] ?? [];
      locationsForBranch.locations?.forEach((location, index) => locations.push({ line: location.start.line, covered: counts[index] ?? 0 }));
    }
  } else if (metric === "lines" && file.l) {
    for (const [line, covered] of Object.entries(file.l)) locations.push({ line: Number(line), covered });
  }
  return locations.filter(({ line }) => Number.isInteger(line)).sort((a, b) => a.line - b.line);
}

function rawMetric(metric, file) {
  const values = metric === "statements" ? file?.s : metric === "functions" ? file?.f : metric === "branches" ? Object.values(file?.b ?? {}).flat() : undefined;
  if (!values) return undefined;
  const counts = Object.values(values);
  return { covered: counts.filter((value) => value > 0).length, total: counts.length };
}

function normalizeMetric(metric, file, name) {
  if (file?.[metric]?.total !== undefined) return { metric: countMetric(metric, file, name), locations: [] };
  const raw = rawMetric(metric, file);
  if (raw) return { metric: raw, locations: detailedMetric(metric, file) };
  const locations = detailedMetric(metric, file);
  if (!locations.length) fail(`Missing ${metric} coverage for ${name}`, { code: "missing-coverage-metric", metric });
  const covered = locations.filter(({ covered }) => covered > 0).length;
  return { metric: { covered, total: locations.length }, locations };
}

function coverageFiles(summary) {
  if (summary?.files && typeof summary.files === "object" && !Array.isArray(summary.files)) return summary.files;
  const entries = Object.entries(summary ?? {}).filter(
    ([name, file]) => name !== "total" && file && typeof file === "object" && (file.statementMap || file.fnMap || file.branchMap || METRICS.some((metric) => file[metric]?.total !== undefined)),
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function normalizeCoverage(summary, { root = process.cwd() } = {}) {
  const files = coverageFiles(summary);
  if (!files || typeof files !== "object" || Array.isArray(files)) fail("Coverage report must contain a files object", { code: "missing-files" });
  const normalized = {};
  for (const [rawName, file] of Object.entries(files)) {
    const name = path.relative(root, path.resolve(root, rawName)).split(path.sep).join("/");
    if (!name || name.startsWith("../") || path.isAbsolute(name)) fail(`Coverage path escapes repository: ${rawName}`, { code: "path-outside-repository" });
    if (normalized[name]) fail(`Duplicate normalized coverage path: ${name}`, { code: "duplicate-file" });
    const entries = METRICS.map((metric) => [metric, normalizeMetric(metric, file, name)]);
    normalized[name] = { ...Object.fromEntries(entries.map(([metric, { metric: value }]) => [metric, value])), locations: Object.fromEntries(entries.map(([metric, { locations }]) => [metric, locations])) };
  }
  if (!Object.keys(normalized).length) fail("Coverage report contains no files", { code: "empty-report" });
  return { schemaVersion: 1, files: Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))) };
}

export async function readAndNormalize(file, options) {
  return normalizeCoverage(JSON.parse(await readFile(file, "utf8")), options);
}

export async function readCoverageReport(file, options) {
  try {
    return await readAndNormalize(file, options);
  } catch (error) {
    if (error.code !== "missing-files" || path.basename(file) !== "coverage-final.json") throw error;
    return readAndNormalize(path.join(path.dirname(file), "coverage-summary.json"), options);
  }
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
