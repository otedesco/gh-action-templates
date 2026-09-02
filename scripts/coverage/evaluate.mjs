import { METRICS } from "./normalize.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { changedLines } from "./changed-lines.mjs";

export function evaluateChangedCoverage(report, changed, { executableFiles = Object.keys(report.files) } = {}) {
  const errors = [];
  for (const [file, lines] of Object.entries(changed)) {
    if (!executableFiles.includes(file)) continue;
    const data = report.files[file];
    if (!data) { errors.push({ code: "missing-report-file", file, remediation: "Generate coverage for the changed executable file." }); continue; }
    for (const metric of METRICS) {
      const value = data[metric];
      if (value.covered !== value.total) errors.push({ code: "changed-code-below-threshold", file, lines, metric, covered: value.covered, total: value.total, remediation: `Add tests covering changed ${metric}.` });
    }
  }
  return { passed: errors.length === 0, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((entries, argument, index, values) => {
    if (!argument.startsWith("--")) return entries;
    entries.push([argument.slice(2), values[index + 1]]);
    return entries;
  }, []));
  const report = JSON.parse(await readFile(args.report ?? "coverage/normalized.json", "utf8"));
  const changed = await changedLines({ base: args.base, head: args.head });
  const decision = evaluateChangedCoverage(report, changed, { executableFiles: Object.keys(report.files) });
  await writeFile(args.output ?? "coverage/changed-decision.json", `${JSON.stringify(decision, null, 2)}\n`);
  if (!decision.passed) { console.error(JSON.stringify(decision, null, 2)); process.exitCode = 1; }
}
