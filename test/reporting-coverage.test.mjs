import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCoverageObservation } from "../scripts/reporting/normalize-coverage.mjs";

const SHA = "a".repeat(40);
const checksum = "b".repeat(64);
const root = new URL("./fixtures/reporting/coverage/", import.meta.url);

async function fixture(name, file) {
  return JSON.parse(await readFile(new URL(`${name}/${file}`, root), "utf8"));
}

function envelope(overrides = {}) {
  return {
    schemaVersion: 1,
    repository: "gh-action-templates",
    commit: SHA,
    workflowSha: "c".repeat(40),
    check: "Coverage / ratchet",
    family: "coverage",
    outcome: "success",
    occurredAt: "2026-09-04T12:00:00Z",
    source: {
      runId: "123456789",
      runUrl: "https://github.com/otedesco/gh-action-templates/actions/runs/123456789",
      artifactUrl: "https://github.com/otedesco/gh-action-templates/actions/runs/123456789/artifacts/1",
      sha256: checksum,
    },
    details: {},
    ...overrides,
  };
}

test("normalizes all four coverage metrics and preserves immutable source identity", async () => {
  const result = normalizeCoverageObservation({
    envelope: envelope(),
    normalizedCoverage: await fixture("valid", "normalized.json"),
    coverageDecision: await fixture("valid", "decision.json"),
    actualSha256: checksum,
  });

  assert.equal(result.outcome, "success");
  assert.deepEqual(result.source, envelope().source);
  assert.deepEqual(result.details.coverage, {
    statements: { covered: 5, total: 6 },
    branches: { covered: 3, total: 4 },
    functions: { covered: 2, total: 3 },
    lines: { covered: 7, total: 8 },
  });
  assert.deepEqual(result.details.decision, { passed: true });
});

test("maps a failed coverage decision to a failing observation without erasing metrics", async () => {
  const result = normalizeCoverageObservation({
    envelope: envelope(),
    normalizedCoverage: await fixture("failed-decision", "normalized.json"),
    coverageDecision: await fixture("failed-decision", "decision.json"),
    actualSha256: checksum,
  });

  assert.equal(result.outcome, "failure");
  assert.equal(result.details.coverage.lines.total, 8);
  assert.deepEqual(result.details.decision, { passed: false });
});

test("rejects incomplete coverage and invalid decision inputs", async () => {
  const incompleteCoverage = await fixture("missing-metric", "normalized.json");
  const incompleteDecision = await fixture("missing-metric", "decision.json");
  const validCoverage = await fixture("valid", "normalized.json");
  assert.throws(
    () =>
      normalizeCoverageObservation({
        envelope: envelope(),
        normalizedCoverage: incompleteCoverage,
        coverageDecision: incompleteDecision,
        actualSha256: checksum,
      }),
    /branches/,
  );
  assert.throws(
    () =>
      normalizeCoverageObservation({
        envelope: envelope(),
        normalizedCoverage: validCoverage,
        coverageDecision: { passed: "yes" },
        actualSha256: checksum,
      }),
    /passed/,
  );
});

test("rejects checksum mismatches and non-coverage envelopes", async () => {
  const mismatchedCoverage = await fixture("checksum-mismatch", "normalized.json");
  const mismatchedDecision = await fixture("checksum-mismatch", "decision.json");
  const validCoverage = await fixture("valid", "normalized.json");
  const validDecision = await fixture("valid", "decision.json");
  assert.throws(
    () =>
      normalizeCoverageObservation({
        envelope: envelope(),
        normalizedCoverage: mismatchedCoverage,
        coverageDecision: mismatchedDecision,
        actualSha256: "d".repeat(64),
      }),
    /checksum/,
  );
  assert.throws(
    () =>
      normalizeCoverageObservation({
        envelope: envelope({ family: "core" }),
        normalizedCoverage: validCoverage,
        coverageDecision: validDecision,
        actualSha256: checksum,
      }),
    /coverage family/,
  );
});
