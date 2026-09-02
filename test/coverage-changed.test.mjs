import assert from "node:assert/strict";
import test from "node:test";
import { parseChangedLines } from "../scripts/coverage/changed-lines.mjs";
import { evaluateChangedCoverage } from "../scripts/coverage/evaluate.mjs";
import { normalizeCoverage } from "../scripts/coverage/normalize.mjs";

const report = normalizeCoverage({
  files: {
    "src/a.ts": {
      statements: { covered: 1, total: 1 },
      branches: { covered: 1, total: 1 },
      functions: { covered: 1, total: 1 },
      lines: { covered: 1, total: 1 },
    },
    "src/b.ts": {
      statements: { covered: 0, total: 1 },
      branches: { covered: 0, total: 1 },
      functions: { covered: 0, total: 1 },
      lines: { covered: 0, total: 1 },
    },
  },
});

test("parses added lines from zero-context unified diffs", () => {
  assert.deepEqual(
    parseChangedLines(
      "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -2,0 +3,2 @@\n+one\n+two\n",
    ),
    { "src/a.ts": [3, 4] },
  );
});

test("requires all four metrics for changed executable code", () => {
  const result = evaluateChangedCoverage(
    report,
    { "src/a.ts": [3], "src/b.ts": [1] },
    { executableFiles: ["src/a.ts", "src/b.ts"] },
  );
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.errors.map(({ metric }) => metric),
    ["statements", "branches", "functions", "lines"],
  );
});
