import assert from "node:assert/strict";
import test from "node:test";
import {
  stableJson,
  validateObservation,
  validateRepositoryCatalog,
  validateStatusPolicy,
} from "../scripts/reporting/contract.mjs";

const SHA = "a".repeat(40);
const CHECKS = [
  { name: "Quality / core", family: "core", required: true },
  { name: "Coverage / ratchet", family: "coverage", required: true },
  { name: "Security / aggregate", family: "security", required: true },
  { name: "Release / verified", family: "release", required: false },
];
const PRODUCT_REPOSITORIES = ["commons", "cache", "server-utils", "notify", "cerberus", "hermes", "web-app"];

function repository(name, enrolled) {
  return {
    name,
    slug: `otedesco/${name}`,
    enrolled,
    enrollmentReason: enrolled ? "Initial OPS-187 reporting source." : "Awaiting OPS-189 adoption.",
    expectedChecks: CHECKS,
  };
}

function catalog(overrides = {}) {
  return {
    schemaVersion: 1,
    repositories: [
      repository("gh-action-templates", true),
      ...PRODUCT_REPOSITORIES.map((name) => repository(name, false)),
    ],
    ...overrides,
  };
}

function observation(overrides = {}) {
  return {
    schemaVersion: 1,
    repository: "gh-action-templates",
    commit: SHA,
    workflowSha: "b".repeat(40),
    check: "Quality / core",
    family: "core",
    outcome: "success",
    occurredAt: "2026-09-04T12:00:00Z",
    source: {
      runId: "123456789",
      runUrl: "https://github.com/otedesco/gh-action-templates/actions/runs/123456789",
      artifactUrl: "https://github.com/otedesco/gh-action-templates/actions/runs/123456789/artifacts/1",
      sha256: "c".repeat(64),
    },
    details: {},
    ...overrides,
  };
}

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

test("accepts the eight-repository catalog and only the expected reporting check families", () => {
  assert.deepEqual(validateRepositoryCatalog(catalog()), []);
  assert.deepEqual(validateStatusPolicy(policy), []);
});

test("rejects duplicate repositories, bad check families, and ambiguous enrollment", () => {
  const invalid = catalog({
    repositories: [
      repository("gh-action-templates", true),
      repository("gh-action-templates", true),
      {
        ...repository("commons", false),
        enrollmentReason: "",
        expectedChecks: [{ name: "Unknown", family: "unknown", required: true }],
      },
    ],
  });
  const errors = validateRepositoryCatalog(invalid).join("\n");
  assert.match(errors, /duplicate repository/);
  assert.match(errors, /unsupported check family/);
  assert.match(errors, /enrollment reason/);
});

test("rejects malformed catalog entries and malformed expected checks", () => {
  const nonArrayErrors = validateRepositoryCatalog({ schemaVersion: 1, repositories: {} }).join("\n");
  assert.match(nonArrayErrors, /repositories must be an array/);

  const errors = validateRepositoryCatalog({
    schemaVersion: 1,
    repositories: [
      null,
      {
        name: "commons",
        slug: "otedesco/commons",
        enrolled: false,
        enrollmentReason: "Awaiting OPS-189 adoption.",
        expectedChecks: [],
      },
    ],
  }).join("\n");
  assert.match(errors, /repository entry must be an object/);
  assert.match(errors, /expectedChecks must be a non-empty array/);

  const checkErrors = validateRepositoryCatalog(
    catalog({
      repositories: [
        {
          ...repository("gh-action-templates", true),
          expectedChecks: [null],
        },
        ...PRODUCT_REPOSITORIES.map((name) => repository(name, false)),
      ],
    }),
  ).join("\n");
  assert.match(checkErrors, /must be an object/);
});

test("requires immutable source identity for every non-unavailable observation", () => {
  assert.deepEqual(validateObservation(observation()), []);
  assert.deepEqual(validateObservation(observation({ outcome: "unavailable", source: undefined })), []);

  const errors = validateObservation(
    observation({
      commit: "main",
      workflowSha: "short",
      occurredAt: "2026-09-04",
      source: { ...observation().source, sha256: "not-a-checksum" },
    }),
  ).join("\n");
  assert.match(errors, /commit/);
  assert.match(errors, /workflowSha/);
  assert.match(errors, /occurredAt/);
  assert.match(errors, /sha256/);
});

test("rejects missing source data, unsupported outcomes, and unknown schema versions", () => {
  const errors = validateObservation(observation({ schemaVersion: 2, outcome: "retrying", source: undefined })).join(
    "\n",
  );
  assert.match(errors, /schemaVersion/);
  assert.match(errors, /outcome/);
  assert.match(errors, /source/);
  assert.match(validateObservation(observation({ source: "not-an-object" })).join("\n"), /source must be an object/);
});

test("rejects an incomplete or reordered status policy", () => {
  const errors = validateStatusPolicy({
    ...policy,
    freshnessHours: 0,
    requiredCheckFamilies: ["core", "unknown"],
    statusPrecedence: [...policy.statusPrecedence].reverse(),
  }).join("\n");
  assert.match(errors, /freshnessHours/);
  assert.match(errors, /required check family/);
  assert.match(errors, /status precedence/);
  assert.match(validateStatusPolicy({ ...policy, requiredCheckFamilies: [] }).join("\n"), /requiredCheckFamilies/);
});

test("serializes nested objects with stable key ordering", () => {
  assert.equal(
    stableJson({ zebra: { second: 2, first: 1 }, alpha: [3, { beta: true, alpha: false }] }),
    '{"alpha":[3,{"alpha":false,"beta":true}],"zebra":{"first":1,"second":2}}\n',
  );
});
