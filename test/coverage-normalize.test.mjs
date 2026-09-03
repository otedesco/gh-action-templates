import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeCoverage, readCoverageReport } from "../scripts/coverage/normalize.mjs";
import { validateSourceCoverage } from "../scripts/coverage/source-inventory.mjs";

const root = new URL(".", import.meta.url).pathname;
const fixture = async (name) =>
  JSON.parse(await readFile(path.join(root, "fixtures/coverage", name, "summary.json"), "utf8"));

test("normalizes Jest/Vitest summaries into sorted repository-relative files", async () => {
  const report = normalizeCoverage(await fixture("valid"), { root });
  assert.deepEqual(Object.keys(report.files), ["src/a.ts", "src/b.ts"]);
  assert.equal(report.files["src/a.ts"].branches.covered, 1);
});

test("normalizes raw Istanbul coverage-final reports", () => {
  const report = normalizeCoverage(
    {
      [`${root}/src/a.ts`]: {
        statementMap: { 0: { start: { line: 4 }, end: { line: 4 } } },
        fnMap: { 0: { loc: { start: { line: 4 } } } },
        branchMap: { 0: { locations: [{ start: { line: 4 } }] } },
        s: { 0: 1 },
        f: { 0: 1 },
        b: { 0: [1] },
      },
    },
    { root },
  );
  assert.deepEqual(Object.keys(report.files), ["src/a.ts"]);
  assert.equal(report.files["src/a.ts"].lines.covered, 1);
});

test("normalizes raw Istanbul files with zero function and branch sites", () => {
  const report = normalizeCoverage(
    {
      [`${root}/src/constants.ts`]: {
        statementMap: { 0: { start: { line: 1 }, end: { line: 1 } } },
        fnMap: {},
        branchMap: {},
        s: { 0: 1 },
        f: {},
        b: {},
      },
    },
    { root },
  );
  assert.deepEqual(report.files["src/constants.ts"].functions, { covered: 0, total: 0 });
  assert.deepEqual(report.files["src/constants.ts"].branches, { covered: 0, total: 0 });
});

test("normalizes per-file summary reports with a total entry", () => {
  const report = normalizeCoverage(
    {
      total: { lines: { covered: 1, total: 1 } },
      [`${root}/src/a.ts`]: {
        statements: { covered: 1, total: 1 },
        branches: { covered: 0, total: 0 },
        functions: { covered: 0, total: 0 },
        lines: { covered: 1, total: 1 },
      },
    },
    { root },
  );
  assert.equal(report.files["src/a.ts"].lines.covered, 1);
});

test("falls back from an empty coverage-final report to its sibling summary", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "coverage-report-"));
  await writeFile(path.join(directory, "coverage-final.json"), "{}\n");
  await writeFile(
    path.join(directory, "coverage-summary.json"),
    JSON.stringify({
      total: { lines: { covered: 1, total: 1 } },
      "src/a.ts": {
        statements: { covered: 1, total: 1 },
        branches: { covered: 0, total: 0 },
        functions: { covered: 0, total: 0 },
        lines: { covered: 1, total: 1 },
      },
    }),
  );
  const report = await readCoverageReport(path.join(directory, "coverage-final.json"), { root: directory });
  assert.deepEqual(Object.keys(report.files), ["src/a.ts"]);
});

test("rejects empty and malformed reports", async () => {
  await assert.rejects(async () => normalizeCoverage(await fixture("missing-file")), /no files/);
  await assert.rejects(async () => normalizeCoverage(await fixture("malformed")), /Invalid statements/);
});

test("treats executable source omitted from coverage as uncovered", async () => {
  const report = normalizeCoverage(await fixture("valid"), { root });
  assert.deepEqual(validateSourceCoverage(report, ["src/a.ts", "src/missing.ts"]), [
    {
      code: "source-missing-from-report",
      file: "src/missing.ts",
      remediation: "Include this executable source file in the coverage report.",
    },
  ]);
});
