# OPS-184 Security Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Block unapproved critical/high vulnerabilities, leaked secrets, prohibited licenses, and unsafe workflow constructs while producing sanitized, durable evidence for every supported repository.

**Architecture:** Define one versioned policy and expiring-exception schema, normalize outputs from CodeQL, dependency review, secret scanning, license scanning, and workflow-security analysis into a common finding format, then evaluate that format with a fail-closed Node CLI. A pinned reusable workflow runs the scanners and one aggregate job; consumer workflows call that aggregate with no pull-request release credentials.

**Tech Stack:** GitHub Actions, CodeQL, dependency-review-action, Gitleaks (or an approved equivalent), license-checker (or an approved equivalent), actionlint/zizmor, SARIF, JSON Schema, Node test runner, immutable SHA references, GitHub artifacts, Linear project documents.

---

## Preconditions and constraints

- Start from `gh-action-templates` `main` after MLS-002 and its documentation closeout are merged.
- Confirm `scripts/audit-action-references.mjs` and `scripts/audit-workflow-permissions.mjs` pass before changing scanner workflows.
- Reuse the fixture runner and truthful-failure conventions from OPS-179/OPS-180; do not create a second test harness.
- Use only fake dependencies, fake licenses, and non-sensitive sentinel credentials. Never print a recovered secret or upload raw scanner output containing one.
- Scanner versions and action SHAs must be recorded in `supply-chain/action-references.json` before the workflow is adopted.
- Do not remediate unrelated product vulnerabilities in this task. A fixture or real finding must either be fixed in scope, blocked by policy, or represented by a narrow approved exception.

## Task 1: Define the policy and exception schema

**Files:**

- Create: `security/security-policy.json`
- Create: `security/exception.schema.json`
- Create: `security/exceptions.json`
- Create: `scripts/security/validate-policy.mjs`
- Create: `test/security-policy.test.mjs`
- Modify: `package.json`

### Step 1: Write failing policy tests

Add table-driven tests that assert:

- `critical` and `high` findings block by default;
- `medium`, `low`, and `info` follow the explicit allow policy;
- unsupported tools, severities, or report versions fail closed;
- an exception requires owner, rationale, exact scope, compensating control, approver, and future UTC expiry;
- missing fields, duplicate IDs, duplicate scopes, broad wildcards, past expiries, and same-day expiries are rejected;
- a valid narrow exception suppresses only its matching finding;
- expired or mismatched exceptions remain blocking;
- diagnostics are deterministic and contain no source snippets or secret values.

Run:

```bash
pnpm test:security-policy
```

Expected: FAIL because the policy, validator, and package script do not exist.

### Step 2: Define the policy shape

Use explicit policy fields for blocking severities, approved tools, report versions, artifact retention, and exception requirements. Each finding must normalize to:

```json
{
  "tool": "codeql",
  "rule": "js/example-rule",
  "severity": "high",
  "subject": "src/example.js",
  "fingerprint": "sha256:..."
}
```

Keep `security/exceptions.json` empty until a real reviewed exception is needed. Do not encode a blanket “ignore all” rule.

### Step 3: Implement fail-closed validation

Implement `validate-policy.mjs` to parse policy, schema, exceptions, and normalized findings; validate every required field; match exceptions only when all scoped fields match; compare expiries in UTC; sort findings by tool/rule/subject/fingerprint; and return a non-zero exit code for any blocking result. The formatter must report rule, subject, severity, expected action, and remediation only.

### Step 4: Add the package command and verify

Add:

```json
"test:security-policy": "node --test test/security-policy.test.mjs"
```

Run the test suite until it passes, then commit:

```bash
git add security scripts/security test/security-policy.test.mjs package.json
git commit -m "test: define blocking security policy"
```

## Task 2: Normalize scanner reports and create fixtures

**Files:**

- Create: `scripts/security/normalize-results.mjs`
- Create: `test/security-fixtures.test.mjs`
- Create: `test/fixtures/security/valid/**`
- Create: `test/fixtures/security/codeql-high/**`
- Create: `test/fixtures/security/vulnerable-dependency/**`
- Create: `test/fixtures/security/sentinel-secret/**`
- Create: `test/fixtures/security/prohibited-license/**`
- Create: `test/fixtures/security/unsafe-workflow/**`

### Step 1: Write red fixture tests

Require the valid fixture to normalize to no blocking findings and each negative fixture to produce exactly one intended finding. Add malformed, truncated, absent-report, unsupported-version, and unsorted-report cases. Assert stable JSON ordering and that the complete sentinel never occurs in normalized output or formatted diagnostics.

Run `pnpm test:security-fixtures`; expected: FAIL before fixtures and normalization exist.

### Step 2: Add one-defect fixtures

Create fake source and manifests that isolate one CodeQL high finding, one vulnerable dependency, one sentinel secret, one prohibited license, and one unsafe workflow interpolation/permission. Do not use a real leaked credential or a package that requires network access.

### Step 3: Implement normalization adapters

Normalize CodeQL SARIF, dependency-review results, secret-scanner output, license-scanner output, and workflow-security output to the common finding schema. Reject missing required SARIF/result fields, unsupported versions, and ambiguous severities. Provide a concise Markdown summary and a machine-readable sorted JSON file.

### Step 4: Verify and commit

```bash
pnpm test:security-policy
pnpm test:security-fixtures
git add scripts/security/normalize-results.mjs test/security-fixtures.test.mjs test/fixtures/security
git commit -m "test: prove security gate failure modes"
```

## Task 3: Implement the reusable security workflow

**Files:**

- Create: `.github/workflows/security.yml`
- Modify: `supply-chain/action-references.json`
- Modify: `supply-chain/workflow-permissions.json`
- Modify: `test/workflow-contract.test.mjs`

### Step 1: Add failing workflow-contract assertions

Require `workflow_call` and pull-request entry points, pinned full-SHA scanner actions, explicit permissions, dependency comparison history, sanitized artifacts, exception validation, and one stable aggregate job. Reject mutable references, `continue-on-error`, `secrets: inherit`, pull-request release credentials, and unbounded artifact retention.

Run `pnpm test:workflow-contract`; expected: FAIL because `security.yml` is absent.

### Step 2: Add least-privilege scanner jobs

Give analysis jobs `contents: read`. Give only the SARIF upload job `security-events: write`. Keep dependency-review, secret, license, and workflow-security jobs read-only. Do not pass `NPM_TOKEN`, `GH_TOKEN`, or any release credential to pull-request security jobs.

### Step 3: Add scanner and exception steps

Run CodeQL for each supported language, dependency review against the base commit, secret scanning over the intended commit range and generated artifacts, license scanning over resolved packages, and actionlint/zizmor over workflow files. Normalize each result, validate exceptions, and upload only sanitized reports with a short retention period.

### Step 4: Implement the aggregate check

The aggregate job must require every scanner output, fail on a missing/canceled/unexpectedly skipped job, apply only valid unexpired exceptions, and emit the exact `security / aggregate` check name frozen in the MLS-003 baseline. It must fail for any unapproved critical/high finding.

### Step 5: Validate and commit

```bash
pnpm test:security-policy
pnpm test:security-fixtures
pnpm test:workflow-contract
pnpm run test:action-references
pnpm run test:workflow-permissions
actionlint .github/workflows/security.yml
git add .github/workflows/security.yml supply-chain test/workflow-contract.test.mjs
git commit -m "ci: add blocking security gates"
```

If `actionlint` is unavailable locally, record that limitation and require the hosted workflow run as the final syntax evidence.

## Task 4: Adopt the security workflow in every repository

**Files:**

- Modify: security/quality workflow callers in `../commons`, `../cache`, `../server-utils`, `../notify`, `../cerberus`, `../hermes`, and `../web-app`
- Modify: `docs/architecture/quality-baseline.md`
- Create: `docs/evidence/OPS-184-security-gates.md`

### Step 1: Add immutable callers

After the central workflow PR merges, pin all eight repository callers to its exact reviewed SHA. Public and private pull-request security jobs map no release credentials. Private dependency installation must use only the existing named `NPM_TOKEN` contract, never `secrets: inherit`.

### Step 2: Validate the permission intersection

Run the workflow-permission audit and inspect each caller job. Ensure `security-events: write` is granted only where the reusable SARIF upload job requires it, and ensure the caller does not widen package, contents, pull-request, or bypass permissions.

### Step 3: Run controlled negative pull requests

Open disposable fixture PRs (or use a dedicated fixture branch) for each scanner defect. Verify the stable aggregate check blocks the intended defect and that no raw sentinel appears in logs, SARIF, artifacts, comments, or annotations. Verify a valid PR passes with no exception.

### Step 4: Record evidence

Capture workflow run URLs, central workflow SHA, scanner/action versions, policy hash, normalized-result hash, artifact/SARIF links, exception IDs and expiries, and the final conclusion. Record the existing Hermes/OPS-217 and web-app/OPS-228 test-harness blockers separately from security-gate conclusions.

### Step 5: Commit adoption evidence

```bash
git add docs/architecture/quality-baseline.md docs/evidence/OPS-184-security-gates.md
git commit -m "docs: record security gate evidence"
```

## Task 5: Finish OPS-184 and update Linear records

**Files:**

- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/tasks/OPS-184-security-gates.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md`
- Create or update: the Linear project document for MLS-003

### Step 1: Verify all implementation merges

Use the GitHub Codex app to verify every OPS-184 PR in every scoped repository is merged into `main`, capture merge commit SHAs, and confirm hosted security runs. Do not mark the task complete from open PRs, local branches, or green local tests alone.

### Step 2: Write the task completion report

Mark OPS-184 complete with the date and record all affected repositories, policy/schema/normalizer/workflow files, scanner decisions, exact permissions, fixture results, hosted run URLs, exception behavior, limitations, and follow-up ownership.

### Step 3: Update the milestone record

Mark OPS-184 complete in the MLS-003 task table and add its delivered security capability to the milestone's cumulative summary. Preserve the original plan and add a clearly labeled completion report.

### Step 4: Create the required Linear project document

Create or update a separate project document titled `MLS-003 — Security, release, and branch enforcement — completion report` only when the entire milestone is complete. For OPS-184 alone, append the detailed security-gate outcome to the project document draft or issue evidence without claiming MLS-003 completion. Link the final project document from the Linear milestone and OPS-184/185/186 issues.

### Step 5: Close out through merged documentation

Put repository documentation changes on a closeout branch and PR. Report `implementation merged; documentation closeout pending` until that PR merges into `main`. Only then report OPS-184 fully complete.

## Validation matrix

Run from `gh-action-templates` after all implementation changes:

```bash
pnpm test
pnpm test:security-policy
pnpm test:security-fixtures
pnpm test:workflow-contract
pnpm run test:action-references
pnpm run test:workflow-permissions
node scripts/audit-action-references.mjs
node scripts/audit-workflow-permissions.mjs
actionlint .github/workflows/security.yml
git diff --check
```

Expected: all tests pass; every required security fixture has the intended classification; immutable references and eight-repository permission policy audits pass; the aggregate check is stable; and hosted runs provide final workflow syntax/SARIF evidence. Any unavailable local tool or pre-existing product blocker must be recorded explicitly.

## Definition of done

- Critical/high security findings, malformed reports, and invalid/expired exceptions block merge.
- Secrets are redacted from logs, SARIF, artifacts, comments, and annotations.
- CodeQL, dependency, secret, license, and workflow-security jobs use immutable actions and minimum permissions.
- All eight repositories call the reviewed security workflow with no pull-request release credentials.
- OPS-184 task documentation contains complete merged-PR, implementation, validation, outcome, limitation, and follow-up details.
