# OPS-184 Security Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make unapproved critical/high vulnerabilities, leaked secrets, prohibited licenses, and unsafe workflow constructs block pull requests with durable evidence.

**Architecture:** Define one versioned security policy and exception schema in `gh-action-templates`, validate them with a small Node CLI, then compose pinned CodeQL, dependency-review, secret, license, and workflow-security jobs in a reusable workflow. Each scanner gets a positive and a single-defect negative fixture; normalized results feed one stable required check.

**Tech Stack:** GitHub Actions, CodeQL, dependency-review-action, gitleaks, license-checker or equivalent approved scanner, zizmor/actionlint, SARIF, JSON Schema, Node test runner.

---

## Dependencies and scope

- Requires immutable action references from `OPS-182` and least-privilege permissions from `OPS-183`.
- Reuses the fixture runner from `OPS-179` and truthful-failure rules from `OPS-180`.
- Scanner selection must be recorded in policy; this task does not remediate unrelated product vulnerabilities.

### Task 1: Define policy and exception validation

**Files:**

- Create: `security/security-policy.json`
- Create: `security/exception.schema.json`
- Create: `security/exceptions.json`
- Create: `scripts/security/validate-policy.mjs`
- Create: `test/security-policy.test.mjs`
- Modify: `package.json`

**Step 1: Write failing tests**

Assert critical/high findings block by default. Cover invalid severity, missing owner/rationale/approval/expiry, expired exceptions, excessive scope, duplicates, and a valid narrow exception.

**Step 2: Run the red test**

Run `pnpm test:security-policy`.

Expected: FAIL because the policy validator is absent.

**Step 3: Implement the minimal validator**

Normalize findings by tool, rule, package or path, severity, and fingerprint. Apply an exception only when every scoped field matches and its expiry is in the future. Emit no source snippet that could contain a secret.

**Step 4: Run tests and commit**

```bash
pnpm test:security-policy
git add security scripts/security test/security-policy.test.mjs package.json
git commit -m "test: define blocking security policy"
```

Expected: PASS with 100% coverage for changed executable code.

### Task 2: Add scanner fixtures and result normalization

**Files:**

- Create: `test/fixtures/security/valid/**`
- Create: `test/fixtures/security/codeql-high/**`
- Create: `test/fixtures/security/vulnerable-dependency/**`
- Create: `test/fixtures/security/sentinel-secret/**`
- Create: `test/fixtures/security/prohibited-license/**`
- Create: `test/fixtures/security/unsafe-workflow/**`
- Create: `scripts/security/normalize-results.mjs`
- Create: `test/security-fixtures.test.mjs`

**Step 1: Write table-driven red tests**

Require the valid fixture to pass and each negative fixture to produce exactly one normalized blocking finding from its intended scanner.

**Step 2: Run `pnpm test:security-fixtures`**

Expected: FAIL because fixtures and normalization do not exist.

**Step 3: Add one-defect fixtures**

Use only fake packages and sentinel credentials. Ensure captured output and artifacts never contain the complete sentinel value.

**Step 4: Implement result normalization**

Reject missing, malformed, truncated, or unsupported reports. Produce stable sorted JSON and a concise Markdown summary.

**Step 5: Verify and commit**

```bash
pnpm test:security-fixtures
git add test/fixtures/security test/security-fixtures.test.mjs scripts/security/normalize-results.mjs
git commit -m "test: prove security gate failure modes"
```

### Task 3: Build the reusable security workflow

**Files:**

- Create: `.github/workflows/security.yml`
- Modify: `supply-chain/action-references.json`
- Modify: `supply-chain/workflow-permissions.json`
- Modify: `test/workflow-contract.test.mjs`

**Step 1: Add failing workflow assertions**

Require pinned scanner actions, explicit permissions, SARIF upload, dependency comparison history, exception validation, artifact retention, and one stable aggregate check. Reject `continue-on-error` and secrets in pull-request jobs.

**Step 2: Run workflow tests**

Expected: FAIL because `security.yml` is absent.

**Step 3: Implement the workflow**

Give analysis jobs `contents: read`; grant `security-events: write` only to SARIF upload. Use explicit outputs and make the aggregate job fail if any required job is absent, canceled, skipped unexpectedly, or blocking.

**Step 4: Validate**

```bash
pnpm test:security-policy
pnpm test:security-fixtures
pnpm test:workflow-contract
actionlint .github/workflows/security.yml
```

Expected: PASS with no mutable reference or excess permission.

**Step 5: Commit**

```bash
git add .github/workflows/security.yml supply-chain test/workflow-contract.test.mjs
git commit -m "ci: add blocking security gates"
```

### Task 4: Prove repository adoption and evidence

**Files:**

- Modify: consumer `.github/workflows/quality-checks.yml` files
- Modify: `docs/architecture/quality-baseline.md`
- Create: `docs/evidence/OPS-184-security-gates.md`

**Step 1:** Add explicit calls to the immutable security workflow in all eight repositories.

**Step 2:** Open controlled fixture pull requests and verify each intended defect blocks the stable security check.

**Step 3:** Record scanner versions, policy hash, run URLs, SARIF/artifact links, and any accepted exception.

**Step 4:** Run the full central test suite and actionlint; expect all checks to pass.

**Step 5: Commit**

```bash
git add docs/architecture/quality-baseline.md docs/evidence/OPS-184-security-gates.md
git commit -m "docs: record security gate evidence"
```

## Completion checklist

- Every required scanner has a positive and negative fixture.
- Critical/high findings and invalid/expired exceptions block.
- Missing or malformed reports fail closed.
- Secrets are redacted from logs and artifacts.
- Actions are immutable and permissions are minimal.
- Evidence is linked to `OPS-184`.

