import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { changedLines } from "../../../scripts/coverage/changed-lines.mjs";
import { evaluateChangedCoverage } from "../../../scripts/coverage/evaluate.mjs";
import { readAndNormalize } from "../../../scripts/coverage/normalize.mjs";
import { evaluateRatchet } from "../../../scripts/coverage/ratchet.mjs";
import { inventoryExecutableSource, validateSourceCoverage } from "../../../scripts/coverage/source-inventory.mjs";

const root = process.cwd();
let reportPath = path.resolve(root, process.env.COVERAGE_REPORT);
const baselinePath = path.resolve(root, process.env.COVERAGE_BASELINE);
try {
  await access(reportPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  reportPath = path.resolve(root, "coverage/coverage-summary.json");
}
const report = await readAndNormalize(reportPath, { root });
const sourceFiles = await inventoryExecutableSource(root);
const sourceErrors = validateSourceCoverage(report, sourceFiles);
const changed = await changedLines({ cwd: root, base: process.env.COVERAGE_BASE, head: process.env.COVERAGE_HEAD });
const changedDecision = evaluateChangedCoverage(report, changed, { executableFiles: sourceFiles });
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const ratchetDecision = evaluateRatchet(report, baseline);
const decision = {
  passed: sourceErrors.length === 0 && changedDecision.passed && ratchetDecision.passed,
  sourceErrors,
  changed: changedDecision,
  ratchet: ratchetDecision,
};
await mkdir(path.resolve(root, "coverage"), { recursive: true });
const output = path.resolve(root, "coverage/coverage-decision.json");
await writeFile(output, `${JSON.stringify(decision, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `decision=${output}\n`, { flag: "a" });
if (!decision.passed) {
  console.error(JSON.stringify(decision, null, 2));
  process.exitCode = 1;
}
