import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { normalizeCoverage } from "../scripts/coverage/normalize.mjs";
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
        statementMap: { "0": { start: { line: 4 }, end: { line: 4 } } },
        fnMap: { "0": { loc: { start: { line: 4 } } } },
        branchMap: { "0": { locations: [{ start: { line: 4 } }] } },
        s: { "0": 1 },
        f: { "0": 1 },
        b: { "0": [1] },
        l: { "4": 1 },
      },
    },
    { root },
  );
  assert.deepEqual(Object.keys(report.files), ["src/a.ts"]);
  assert.equal(report.files["src/a.ts"].lines.covered, 1);
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
