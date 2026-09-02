import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRatchet } from "../scripts/coverage/ratchet.mjs";
import { normalizeCoverage } from "../scripts/coverage/normalize.mjs";

const report = normalizeCoverage({
  files: {
    "src/a.ts": {
      statements: { covered: 2, total: 2 },
      branches: { covered: 1, total: 1 },
      functions: { covered: 1, total: 1 },
      lines: { covered: 2, total: 2 },
    },
  },
});
const baseline = {
  schemaVersion: 1,
  repository: "fixture",
  commit: "abc",
  timestamp: "2026-09-02T00:00:00Z",
  metrics: {
    statements: { covered: 1, total: 2, percent: 50 },
    branches: { covered: 0, total: 1, percent: 0 },
    functions: { covered: 0, total: 1, percent: 0 },
    lines: { covered: 1, total: 2, percent: 50 },
  },
};

test("passes equal or improved coverage and proposes the higher baseline", () => {
  const result = evaluateRatchet(report, baseline);
  assert.equal(result.passed, true);
  assert.equal(result.proposedBaseline.metrics.statements.percent, 100);
});

test("rejects a global regression", () => {
  const result = evaluateRatchet(
    normalizeCoverage({
      files: {
        "src/a.ts": {
          statements: { covered: 0, total: 2 },
          branches: { covered: 0, total: 1 },
          functions: { covered: 0, total: 1 },
          lines: { covered: 0, total: 2 },
        },
      },
    }),
    {
      ...baseline,
      metrics: Object.fromEntries(
        Object.entries(baseline.metrics).map(([key, value]) => [key, { ...value, percent: 100 }]),
      ),
    },
  );
  assert.equal(result.passed, false);
  assert.ok(result.errors.every(({ code }) => code === "global-coverage-regression"));
});
