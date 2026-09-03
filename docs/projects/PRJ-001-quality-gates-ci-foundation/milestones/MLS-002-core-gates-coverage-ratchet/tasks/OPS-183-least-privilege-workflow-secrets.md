# OPS-183 Least-Privilege Workflow Permissions Implementation Plan

**Status:** Complete — 2026-09-02

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

## Completion report

OPS-183 was completed on 2026-09-02 after the central implementation and all six active consumer rollouts were merged into `main`. The rollout replaced implicit workflow authority with an auditable, event-aware permission and secret contract across the eight-repository policy boundary.

### Merged pull requests

| Repository | Pull request | Merge commit |
| --- | --- | --- |
| `gh-action-templates` | [#22 — enforce least-privilege workflow permissions](https://github.com/otedesco/gh-action-templates/pull/22) | `ee16ba58053c892b1d59eec5b5954f3cca016100` |
| `commons` | [#19 — restrict workflow permissions and secrets](https://github.com/otedesco/commons/pull/19) | `85f2cb0f0345f8ea62932aaaf2d4918df1212443` |
| `cache` | [#23 — restrict workflow permissions and secrets](https://github.com/otedesco/cache/pull/23) | `0f3b11042defa3288fbf636f99df2eed81fa259a` |
| `server-utils` | [#14 — restrict workflow permissions and secrets](https://github.com/otedesco/server-utils/pull/14) | `fab3a07ef5ec1625bf479665bb5eada086c3cd17` |
| `notify` | [#19 — restrict workflow permissions and secrets](https://github.com/otedesco/notify/pull/19) | `5507f5245face537bff067f502077e2b1225cb52` |
| `cerberus` | [#51 — restrict workflow permissions and secrets](https://github.com/otedesco/cerberus/pull/51) | `f1ea6e179c2c16a496d33ee9b34658e2162b2db5` |
| `hermes` | [#19 — restrict workflow permissions and secrets](https://github.com/otedesco/hermes/pull/19) | `6cab0e15b564c42a4e0d1cc89a0f8ed8f27b2324` |

### Implementation details

- Added `supply-chain/workflow-permissions.json` as the reviewed source of truth for workflow events, top-level and job-level token permissions, declared reusable secrets, allowed secret flows, fork safety, and release-job classification across all eight repositories.
- Added `scripts/audit-workflow-permissions.mjs` and permission fixtures/tests. The deterministic audit rejects missing or broad permissions, unexplained scopes, `secrets: inherit`, undeclared secrets, job-level secret exposure, unexpected workflows/events, and release authority in pull-request jobs without reading or printing secret values.
- Restricted the reusable quality workflow to `contents: read`. Removed its explicit checkout token and the custom commit-status notification, relying on native GitHub Actions check reporting instead.
- Restricted package releases to `contents: write` and `pull-requests: write`, and container releases to `contents: read` and `packages: write`. Both now use the scoped automatic `github.token`; callers no longer supply a custom `GH_TOKEN`.
- Updated public consumers (`commons`, `cache`, and `server-utils`) so quality jobs receive no named secrets and package release jobs receive only `NPM_TOKEN`.
- Updated private-install consumers (`notify`, `cerberus`, and `hermes`) to declare and map only `NPM_TOKEN` where dependency installation or publication requires it. Container callers isolate `packages: write` to the release job.
- Added fork-safe quality, package-release, container-release, and invalid-inheritance fixtures, plus the detailed permission matrix in `docs/evidence/OPS-183-permission-matrix.md`.
- Kept `web-app` explicitly workflow-free in this policy rollout because OPS-189 owns creation of its quality caller. Its empty policy entry still rejects an unexpected unreviewed workflow.

### Validation and evidence

- `pnpm test` passed the complete central contract and fixture suite.
- `pnpm run test:workflow-permissions` passed all six permission-policy tests.
- `node scripts/audit-workflow-permissions.mjs` reported `workflow permissions: 8 repositories audited`.
- `pnpm run test:action-references` audited 37 immutable references successfully.
- `pnpm run format:check`, `pnpm run lint:check`, and `git diff --check` passed.
- GitHub Actions quality runs passed in `commons`, `cache`, `server-utils`, `notify`, and `cerberus` while consuming the immutable central OPS-183 commit. Hermes also reached the reusable workflow successfully; its run stopped only at the existing OPS-217 placeholder unit-test command after checkout, setup, install, formatting, lint, and type checking passed.

### Accomplishment and follow-up boundary

Ordinary and untrusted quality checks can no longer inherit publishing credentials or request write authority. Release jobs receive only the GitHub token scopes and registry secret required for their specific publication path, and the repository-wide audit prevents future workflows from silently widening that boundary.

Local `actionlint` execution was unavailable; successful GitHub parsing and execution of all six consumer workflows provided the hosted workflow validation. Hermes test-harness remediation remains owned by OPS-217, and `web-app` adoption and cross-repository stability evidence remain owned by OPS-189 and MLS-004.
