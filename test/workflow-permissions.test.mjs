import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { auditWorkflowText, formatFindings } from "../scripts/audit-workflow-permissions.mjs";

const root = new URL("../", import.meta.url).pathname;
const fixtureRoot = join(root, "test/fixtures/workflows/permissions");

const basePolicy = {
  repository: "fixture",
  workflow: ".github/workflows/quality.yml",
  events: ["pull_request"],
  workflowPermissions: { contents: "read" },
  jobs: {
    quality: {
      permissions: { contents: "read" },
      allowedSecrets: [],
      forbiddenSecrets: ["NPM_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"],
    },
  },
};

async function fixture(name, file) {
  return readFile(join(fixtureRoot, name, file), "utf8");
}

test("accepts a read-only pull-request quality workflow", async () => {
  const workflow = await fixture("pull-request", "quality.yml");
  assert.deepEqual(auditWorkflowText(workflow, basePolicy), []);
});

test("fails closed for missing explicit permissions and write-all", () => {
  const workflow = `
name: Invalid
on: pull_request
jobs:
  quality:
    permissions: write-all
    runs-on: ubuntu-latest
    steps:
      - run: echo test
`;
  const findings = auditWorkflowText(workflow, basePolicy);
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    [
      "missing-workflow-permissions",
      "missing-workflow-permission",
      "write-all",
      "unexpected-job-permission",
      "missing-job-permission",
    ],
  );
});

test("rejects unexpected write scopes and inherited secrets", async () => {
  const workflow = await fixture("invalid-inherit", "inherit.yml");
  const findings = auditWorkflowText(workflow, {
    ...basePolicy,
    events: ["workflow_call"],
    jobs: {
      quality: { permissions: { contents: "read" }, allowedSecrets: [], forbiddenSecrets: [] },
    },
  });
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["unexpected-workflow-permission", "secrets-inherit", "unexpected-job-permission"],
  );
});

test("rejects undeclared reusable secrets and job-level secret exposure", () => {
  const workflow = `
name: Invalid reusable workflow
on:
  workflow_call:
    secrets:
      RELEASE_TOKEN:
        required: true
permissions:
  contents: read
jobs:
  quality:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    env:
      NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
    steps:
      - run: echo \${{ secrets.RELEASE_TOKEN }}
`;
  const findings = auditWorkflowText(workflow, {
    ...basePolicy,
    events: ["workflow_call"],
    jobs: {
      quality: {
        permissions: { contents: "read" },
        allowedSecrets: [],
        forbiddenSecrets: ["RELEASE_TOKEN", "NPM_TOKEN"],
      },
    },
    declaredSecrets: [],
  });
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["undeclared-workflow-secret", "forbidden-secret", "forbidden-secret", "job-level-secret"],
  );
});

test("rejects release credentials and write authority on fork pull requests", async () => {
  const workflow = await fixture("pull-request", "release-like.yml");
  const findings = auditWorkflowText(workflow, {
    ...basePolicy,
    jobs: {
      release: {
        permissions: { contents: "write" },
        allowedSecrets: ["GH_TOKEN"],
        forbiddenSecrets: [],
        release: true,
      },
    },
    events: ["pull_request"],
    forkSafe: true,
  });
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["release-secret-on-pull-request", "fork-write-permission"],
  );
});

test("formats deterministic diagnostics with remediation", () => {
  const findings = auditWorkflowText("name: empty\n", basePolicy);
  assert.match(formatFindings(findings), /fixture \.github\/workflows\/quality\.yml/);
  assert.match(formatFindings(findings), /remediation:/);
});
