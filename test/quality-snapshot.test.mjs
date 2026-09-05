import assert from "node:assert/strict";
import test from "node:test";
import {
  canPublish,
  deriveStatus,
  normalizeSnapshot,
  selectCurrentObservation,
} from "../scripts/reporting/normalize-snapshot.mjs";

const SHA = "a".repeat(40);
const source = {
  runId: "123",
  runUrl: "https://github.com/otedesco/gh-action-templates/actions/runs/123",
  artifactUrl: "https://github.com/otedesco/gh-action-templates/actions/runs/123/artifacts/1",
  sha256: "b".repeat(64),
};
const checks = [
  { name: "Quality / core", family: "core", required: true },
  { name: "Coverage / ratchet", family: "coverage", required: true },
  { name: "Security / aggregate", family: "security", required: true },
];
const catalog = {
  schemaVersion: 1,
  repositories: [
    {
      name: "gh-action-templates",
      slug: "otedesco/gh-action-templates",
      enrolled: true,
      enrollmentReason: "Initial source.",
      expectedChecks: checks,
    },
    ...["commons", "cache", "server-utils", "notify", "cerberus", "hermes", "web-app"].map((name) => ({
      name,
      slug: `otedesco/${name}`,
      enrolled: false,
      enrollmentReason: "Awaiting OPS-189 adoption.",
      expectedChecks: checks,
    })),
  ],
};
const policy = {
  schemaVersion: 1,
  freshnessHours: 24,
  requiredCheckFamilies: ["core", "coverage", "security"],
  statusPrecedence: [
    "missing",
    "unavailable",
    "malformed",
    "stale",
    "cancelled",
    "failing",
    "excepted",
    "passing",
    "unknown",
  ],
};

function observation(check, outcome = "success", occurredAt = "2026-09-04T12:00:00Z", overrides = {}) {
  const family = checks.find((candidate) => candidate.name === check)?.family ?? "core";
  return {
    schemaVersion: 1,
    repository: "gh-action-templates",
    commit: SHA,
    workflowSha: "c".repeat(40),
    check,
    family,
    outcome,
    occurredAt,
    source,
    details: {},
    ...overrides,
  };
}

const now = new Date("2026-09-05T12:00:00Z");

test("selects the newest observation and never lets an older success overwrite a failure", () => {
  const olderSuccess = observation("Quality / core", "success", "2026-09-04T12:00:00Z");
  const newerFailure = observation("Quality / core", "failure", "2026-09-05T11:00:00Z", {
    source: { ...source, runId: "124" },
  });
  assert.equal(selectCurrentObservation([olderSuccess, newerFailure]).outcome, "failure");
  assert.equal(selectCurrentObservation([newerFailure, olderSuccess]).outcome, "failure");
});

test("derives every non-green status explicitly", () => {
  assert.equal(deriveStatus({ expected: false }), "unknown");
  assert.equal(deriveStatus({ expected: true }), "missing");
  assert.equal(deriveStatus({ expected: true, enrolled: false }), "unavailable");
  assert.equal(
    deriveStatus({ expected: true, observation: { ...observation("Quality / core"), commit: "main" }, now, policy }),
    "malformed",
  );
  assert.equal(
    deriveStatus({
      expected: true,
      observation: observation("Quality / core", "success", "2026-09-04T11:59:59Z"),
      now,
      policy,
    }),
    "stale",
  );
  assert.equal(
    deriveStatus({ expected: true, observation: observation("Quality / core", "cancelled"), now, policy }),
    "cancelled",
  );
  assert.equal(
    deriveStatus({ expected: true, observation: observation("Quality / core", "failure"), now, policy }),
    "failing",
  );
  assert.equal(
    deriveStatus({ expected: true, observation: observation("Quality / core"), now, policy, excepted: true }),
    "excepted",
  );
  assert.equal(deriveStatus({ expected: true, observation: observation("Quality / core"), now, policy }), "passing");
  assert.equal(
    deriveStatus({ expected: true, observation: observation("Quality / core", "unavailable"), now, policy }),
    "unknown",
  );
});

test("creates a deterministic snapshot with missing and unenrolled checks visibly non-green", () => {
  const snapshot = normalizeSnapshot({
    catalog,
    policy,
    observations: [observation("Security / aggregate"), observation("Quality / core", "failure")],
    now,
  });
  const central = snapshot.repositories.find(({ name }) => name === "gh-action-templates");
  assert.equal(central.status, "missing");
  assert.equal(central.checks.find(({ name }) => name === "Quality / core").status, "failing");
  assert.equal(central.checks.find(({ name }) => name === "Coverage / ratchet").status, "missing");
  assert.equal(snapshot.repositories.find(({ name }) => name === "commons").status, "unavailable");
  assert.equal(snapshot.publicationAllowed, false);
  assert.deepEqual(
    snapshot.history.map(({ check }) => check),
    ["Quality / core", "Security / aggregate"],
  );
});

test("retains malformed observations and blocks publication for exceptions", () => {
  const snapshot = normalizeSnapshot({
    catalog,
    policy,
    observations: [
      observation("Quality / core"),
      observation("Coverage / ratchet"),
      observation("Security / aggregate", "success", "2026-09-05T11:00:00Z", { workflowSha: "not-a-sha" }),
    ],
    now,
    exceptedChecks: new Set(["gh-action-templates:Quality / core"]),
  });
  const central = snapshot.repositories.find(({ name }) => name === "gh-action-templates");
  assert.equal(central.checks.find(({ name }) => name === "Quality / core").status, "excepted");
  assert.equal(central.checks.find(({ name }) => name === "Security / aggregate").status, "malformed");
  assert.equal(canPublish(snapshot), false);
  assert.equal(canPublish({ publicationAllowed: true }), true);
});
