import assert from "node:assert/strict";
import test from "node:test";
import {
  formatFindings,
  inspectWorkflowText,
  validateRepositoryInventory,
  validateRulesetPolicy,
} from "../scripts/governance/validate-rulesets.mjs";

const validRepository = {
  name: "example",
  defaultBranch: "main",
  protectedBranch: "main",
  codeowners: ".github/CODEOWNERS",
  requiredPaths: [".github/**", "package.json"],
  workflows: [".github/workflows/quality-checks.yml"],
  requiredChecks: [
    {
      context: "quality / core",
      workflow: ".github/workflows/quality-checks.yml",
      job: "quality",
      observed: true,
    },
  ],
  bypassActors: [{ type: "User", identifier: "otedesco", mode: "pull_request" }],
};

const validInventory = {
  version: 1,
  repositories: [validRepository],
};

const validPolicy = {
  version: 1,
  targetBranch: "main",
  enforcement: "active",
  pullRequest: {
    required: true,
    requiredApprovingReviewCount: 1,
    dismissStaleReviews: true,
    requireCodeOwnerReview: true,
    requireConversationResolution: true,
  },
  statusChecks: {
    strict: true,
    required: true,
  },
  history: {
    denyForcePush: true,
    denyDeletion: true,
    requireLinearHistory: true,
  },
  bypassActors: [
    {
      type: "User",
      identifier: "otedesco",
      mode: "pull_request",
    },
  ],
};

test("accepts a complete repository inventory", () => {
  assert.deepEqual(validateRepositoryInventory(validInventory), []);
});

test("rejects duplicate repositories, non-main targets, and missing checks", () => {
  const invalid = {
    version: 1,
    repositories: [{ ...validRepository, protectedBranch: "develop", requiredChecks: [] }, validRepository],
  };

  const findings = validateRepositoryInventory(invalid);
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["duplicate-repository", "protected-branch", "missing-required-checks"],
  );
});

test("rejects wildcard and unsupported bypass actors", () => {
  const findings = validateRepositoryInventory({
    version: 1,
    repositories: [
      { ...validRepository, bypassActors: [{ type: "Organization", identifier: "*", mode: "pull_request" }] },
    ],
  });
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["wildcard-bypass-actor", "unsupported-bypass-actor"],
  );
});

test("accepts the protected-branch policy", () => {
  assert.deepEqual(validateRulesetPolicy(validPolicy), []);
});

test("rejects policy bypasses and non-strict required checks", () => {
  const findings = validateRulesetPolicy({
    ...validPolicy,
    statusChecks: { strict: false, required: false },
    history: { denyForcePush: false, denyDeletion: false },
    bypassActors: [{ type: "Organization", identifier: "*", mode: "always" }],
  });
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    [
      "required-status-checks",
      "strict-status-checks",
      "force-push-allowed",
      "branch-deletion-allowed",
      "linear-history-allowed",
      "wildcard-bypass-actor",
      "unsupported-bypass-actor",
      "unrestricted-bypass",
    ],
  );
});

test("extracts pull-request workflow jobs and their emitted check names", () => {
  const workflow = `
name: Quality checks
on:
  pull_request:
jobs:
  quality:
    name: quality / core
    uses: otedesco/gh-action-templates/.github/workflows/lint-and-test.yml@0123456789012345678901234567890123456789
`;

  assert.deepEqual(inspectWorkflowText(workflow), {
    events: ["pull_request"],
    jobs: [
      {
        id: "quality",
        name: "quality / core",
        uses: "otedesco/gh-action-templates/.github/workflows/lint-and-test.yml@0123456789012345678901234567890123456789",
      },
    ],
  });
});

test("formats deterministic findings with remediation", () => {
  const findings = validateRulesetPolicy({ ...validPolicy, targetBranch: "develop" });
  const output = formatFindings(findings);
  assert.match(output, /target-branch/);
  assert.match(output, /remediation:/);
});
