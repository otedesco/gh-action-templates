# OPS-184 Security Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable, fail-closed security workflow that runs the five OPS-184 security checks and exposes one stable aggregate result.

**Architecture:** Keep policy evaluation and result normalization in the existing central Node scripts. Add a reusable workflow with explicit pull-request and `workflow_call` entry points, least-privilege permissions, immutable action references, short-lived evidence artifacts, and a final aggregate job that requires every scanner and policy result.

**Tech Stack:** GitHub Actions, CodeQL/SARIF, dependency review, Gitleaks, license policy, actionlint/zizmor, Node.js, JSON fixtures, existing action-reference and permission contracts.

---

### Task 1: Extend the workflow contract tests

**Files:**
- Modify: `test/workflow-contract.test.mjs`

**Step 1:** Add assertions for `security.yml` entry points, five scanner jobs, explicit job permissions, SARIF upload, dependency history, artifact retention, exception validation, and one aggregate job.

**Step 2:** Add negative assertions rejecting mutable action references, `continue-on-error`, inherited secrets, pull-request release credentials, and aggregate logic that does not fail on missing or skipped scanner results.

**Step 3:** Run `pnpm test:workflow-contract` and confirm failure because the workflow is absent.

### Task 2: Implement the reusable security workflow

**Files:**
- Create: `.github/workflows/security.yml`
- Modify: `supply-chain/action-references.json`
- Modify: `supply-chain/workflow-permissions.json`

**Step 1:** Add `pull_request` and `workflow_call` triggers with no default write authority and an optional `NPM_TOKEN` only for explicitly requested private dependency installation.

**Step 2:** Add isolated CodeQL, dependency-review, secret, license, and workflow-security jobs. Keep analysis read-only; give SARIF upload only `security-events: write`; use short-retention artifacts and sanitized summaries.

**Step 3:** Add an aggregate job that validates policy/exceptions, requires all scanner jobs, and fails for failure, cancellation, unexpected skip, or missing output.

**Step 4:** Run the focused workflow, policy, fixture, reference, permission, format, and lint checks. Commit the central workflow slice.

### Task 3: Verify hosted behavior and prepare adoption

**Files:**
- Create: `docs/evidence/OPS-184-security-gates.md`

**Step 1:** Record the merged workflow commit, scanner references, policy hash, and local validation results.

**Step 2:** After the central PR merges, update the eight repository callers to the immutable central workflow SHA and run controlled negative pull requests.

**Step 3:** Add run URLs, SARIF/artifact links, exception decisions, and redaction findings to the evidence document.

**Step 4:** Only after all implementation PRs merge, perform the required task and milestone documentation closeout PR.
