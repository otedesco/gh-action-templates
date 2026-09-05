import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeCoreObservation,
  normalizeReleaseObservation,
  normalizeSecurityObservation,
} from "../scripts/reporting/normalize-evidence.mjs";

const SHA = "a".repeat(40);
const checksum = "b".repeat(64);
const root = new URL("./fixtures/reporting/evidence/", import.meta.url);

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`${name}/input.json`, root), "utf8"));
}

function envelope(family, check, overrides = {}) {
  return {
    schemaVersion: 1,
    repository: "gh-action-templates",
    commit: SHA,
    workflowSha: "c".repeat(40),
    check,
    family,
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

test("normalizes a completed core gate without exposing command output", async () => {
  const result = normalizeCoreObservation({
    envelope: envelope("core", "Quality / core"),
    result: await fixture("core-pass"),
  });
  assert.equal(result.outcome, "success");
  assert.deepEqual(result.details.core, { completedChecks: ["build", "coverage", "format", "lint", "type", "unit"] });
  assert.doesNotMatch(JSON.stringify(result), /SENTINEL-CORE-OUTPUT/);
});

test("preserves a cancelled core outcome as non-success", async () => {
  const result = normalizeCoreObservation({
    envelope: envelope("core", "Quality / core"),
    result: await fixture("core-cancelled"),
  });
  assert.equal(result.outcome, "cancelled");
});

test("normalizes security counts and hides raw finding fields", async () => {
  const result = normalizeSecurityObservation({
    envelope: envelope("security", "Security / aggregate"),
    result: await fixture("security-failure"),
  });
  assert.equal(result.outcome, "failure");
  assert.deepEqual(result.details.security, {
    policyVersion: "1",
    scannerVersions: { codeql: "2.20.0", gitleaks: "8.0.0" },
    findingCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(result), /SENTINEL-SECRET|private\/path/);
});

test("rejects incomplete security evidence and non-security envelopes", async () => {
  const incompleteSecurity = await fixture("security-pass");
  assert.throws(
    () =>
      normalizeSecurityObservation({
        envelope: envelope("security", "Security / aggregate"),
        result: incompleteSecurity,
      }),
    /scannerVersions/,
  );
  assert.throws(
    () =>
      normalizeSecurityObservation({
        envelope: envelope("core", "Quality / core"),
        result: { outcome: "success", policyVersion: "1", scannerVersions: { codeql: "2" }, findings: [] },
      }),
    /security family/,
  );
});

test("normalizes release evidence only when every release invariant is valid", async () => {
  const validRelease = await fixture("release-pass");
  const malformedRelease = await fixture("release-malformed");
  const result = normalizeReleaseObservation({
    envelope: envelope("release", "Release / verified"),
    evidence: validRelease,
  });
  assert.equal(result.outcome, "success");
  assert.equal(result.details.release.digest, `sha256:${"d".repeat(64)}`);
  assert.deepEqual(result.details.release.jobs, ["build", "provenance", "sbom", "smoke", "vulnerability"]);

  assert.throws(
    () =>
      normalizeReleaseObservation({ envelope: envelope("release", "Release / verified"), evidence: malformedRelease }),
    /status must be success/,
  );
});
