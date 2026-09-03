import assert from "node:assert/strict";
import test from "node:test";
import {
  auditRequiredChecks,
  findDuplicateJobKeys,
  inspectWorkflowText,
} from "../scripts/governance/inspect-default-branch.mjs";

const validRepository = {
  name: "example",
  workflows: [".github/workflows/quality-checks.yml"],
  requiredChecks: [
    {
      context: "Quality / core",
      workflow: ".github/workflows/quality-checks.yml",
      job: "quality-gate",
      observed: true,
    },
  ],
};

const validWorkflow = `
name: Quality checks
on:
  pull_request:
jobs:
  quality-gate:
    name: Quality / core
    uses: otedesco/gh-action-templates/.github/workflows/lint-and-test.yml@0123456789012345678901234567890123456789
`;

test("accepts a stable observed pull-request check", () => {
  assert.deepEqual(auditRequiredChecks(validRepository, { ".github/workflows/quality-checks.yml": validWorkflow }), []);
});

test("rejects checks that are not observed on pull requests", () => {
  const findings = auditRequiredChecks(
    { ...validRepository, requiredChecks: [{ ...validRepository.requiredChecks[0], observed: false }] },
    { ".github/workflows/quality-checks.yml": validWorkflow },
    { requireObserved: true },
  );
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["unobserved-required-check"],
  );

  assert.deepEqual(
    auditRequiredChecks(
      { ...validRepository, requiredChecks: [{ ...validRepository.requiredChecks[0], observed: false }] },
      { ".github/workflows/quality-checks.yml": validWorkflow },
    ),
    [],
  );

  const nonPullRequest = validWorkflow.replace("pull_request", "workflow_dispatch");
  assert.deepEqual(
    auditRequiredChecks(validRepository, { ".github/workflows/quality-checks.yml": nonPullRequest }).map(
      ({ rule }) => rule,
    ),
    ["check-not-pull-request"],
  );
});

test("rejects missing jobs and mismatched emitted names", () => {
  const missingJob = validWorkflow.replace("quality-gate:", "other:");
  assert.deepEqual(
    auditRequiredChecks(validRepository, { ".github/workflows/quality-checks.yml": missingJob }).map(
      ({ rule }) => rule,
    ),
    ["missing-check-job"],
  );

  const mismatchedName = validWorkflow.replace("Quality / core", "Quality / wrong");
  assert.deepEqual(
    auditRequiredChecks(validRepository, { ".github/workflows/quality-checks.yml": mismatchedName }).map(
      ({ rule }) => rule,
    ),
    ["check-context-mismatch"],
  );
});

test("rejects duplicate direct job keys", () => {
  const duplicate = `${validWorkflow}\n    with:\n      registry-auth-required: true\n    with:\n      registry-auth-required: true`;
  assert.deepEqual(
    findDuplicateJobKeys(duplicate).map(({ job, key }) => ({ job, key })),
    [{ job: "quality-gate", key: "with" }],
  );
  assert.equal(
    auditRequiredChecks(validRepository, { ".github/workflows/quality-checks.yml": duplicate })[0].rule,
    "duplicate-job-key",
  );
});

test("inspects a workflow in the same shape used by required-check discovery", () => {
  assert.deepEqual(inspectWorkflowText(validWorkflow).jobs[0], {
    id: "quality-gate",
    name: "Quality / core",
    uses: "otedesco/gh-action-templates/.github/workflows/lint-and-test.yml@0123456789012345678901234567890123456789",
  });
});
