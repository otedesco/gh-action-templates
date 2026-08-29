# OPS-183 Least-Privilege Workflow Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give every workflow only the permissions and explicitly named secrets it needs, isolating release credentials from ordinary and untrusted checks.

**Architecture:** Describe allowed permissions and secret flows in a machine-readable policy, statically validate all eight repositories, then update reusable and caller workflows. Negative fixtures prove pull requests and forks cannot receive publishing credentials.

**Tech Stack:** GitHub Actions permissions, reusable workflow secrets, Node test runner, actionlint.

---

### Task 1: Define and test the permission policy

**Files:**

- Create: `supply-chain/workflow-permissions.json`
- Create: `scripts/audit-workflow-permissions.mjs`
- Create: `test/workflow-permissions.test.mjs`
- Modify: `package.json`

**Step 1: Write red tests**

Reject omitted top-level permissions, `write-all`, unexpected write scopes, `secrets: inherit`, undeclared reusable secrets, job-level secrets, and release secrets in pull-request jobs.

**Step 2: Run `pnpm test:workflow-permissions`**

Expected: FAIL across current product workflows.

**Step 3: Implement the audit**

Report repository, workflow, job, permission or secret, allowed value, and remediation. Keep event-aware rules for pull requests, package releases, and container releases.

**Step 4: Commit**

```bash
git add supply-chain/workflow-permissions.json scripts/audit-workflow-permissions.mjs test/workflow-permissions.test.mjs package.json
git commit -m "test: define least-privilege workflow policy"
```

### Task 2: Minimize reusable workflows

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `.github/workflows/release-package.yml`
- Modify: `.github/workflows/release-docker-image.yml`
- Modify: `test/workflow-contract.test.mjs`

**Step 1: Add exact permission assertions**

Quality checks default to `contents: read`; artifact/SARIF scopes are added only to the consuming job. Package and container release jobs declare only required package, contents, attestation, and identity scopes.

**Step 2: Declare named secrets**

Use `workflow_call.secrets` for `NPM_TOKEN` and the minimum release credential. Prefer `github.token` when its scoped permissions are sufficient.

**Step 3: Validate**

Run permission tests and actionlint. Expected: central reusable workflows pass.

**Step 4: Commit**

```bash
git add .github/workflows test/workflow-contract.test.mjs
git commit -m "ci: minimize reusable workflow authority"
```

### Task 3: Replace inherited secrets in consumers

**Files:**

- Modify: all product `.github/workflows/quality-checks.yml`
- Modify: all product `.github/workflows/release-*.yml`

**Step 1: Add caller fixtures**

Assert quality callers pass no release credential and name `NPM_TOKEN` only when private installation needs it. Release callers map each declared secret explicitly.

**Step 2: Remove `secrets: inherit`**

Add top-level `permissions: {}` and job-level minimum grants. Map secrets by name under reusable jobs.

**Step 3: Validate all eight repositories**

Run `pnpm test:workflow-permissions`, `pnpm test:action-references`, and actionlint for every workflow.

**Step 4: Commit per repository**

```bash
git add .github/workflows
git commit -m "ci: pass only explicit workflow secrets"
```

### Task 4: Prove untrusted-event isolation

**Files:**

- Create: `test/fixtures/workflows/permissions/{pull-request,release,invalid-inherit}/**`
- Modify: `test/workflow-permissions.test.mjs`
- Modify: `docs/quality-gates/gate-specification.md`

**Step 1: Add event-context tests**

Prove fork pull requests receive read-only authority and no release secret, while protected release events receive only declared scopes.

**Step 2: Run negative fixtures**

Expected: inherited secrets, write permission in PR checks, and undeclared release secrets fail.

**Step 3: Document the permission matrix and commit**

```bash
git add test/fixtures/workflows/permissions test/workflow-permissions.test.mjs docs/quality-gates/gate-specification.md
git commit -m "docs: prove workflow credential isolation"
```

