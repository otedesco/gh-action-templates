# OPS-183 Least-Privilege Workflow Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give every workflow and job only the GitHub permissions and explicitly named secrets it needs, isolating release credentials from ordinary and untrusted checks.

**Architecture:** Define a machine-readable, event-aware permission/secret policy in `gh-action-templates`, audit all eight repositories, then update reusable workflows and callers in separate repository PRs. Pull-request quality checks receive read-only authority and no release credentials; package/container release jobs receive only the narrowly required write scopes and named secrets. Fixtures prove fork and untrusted events cannot obtain publishing authority.

**Tech Stack:** GitHub Actions YAML, Node.js 24.20.0, pnpm 10.34.0, Node test runner, JSON policy, actionlint, GitHub reusable workflow permissions/secrets.

---

## Context and current state

Work in `gh-action-templates` plus the seven sibling product repositories. OPS-181 is merged and the central workflows currently do not declare a complete explicit permission policy. The central quality workflow uses checkout and a status-notification action; the release workflows use package publishing, GitHub release/changesets behavior, container registry login, and BuildKit secrets.

Current consumer caller patterns are inconsistent:

- `commons`, `cache`, and `server-utils` use `secrets: inherit` in quality and/or release callers.
- `notify`, `cerberus`, and `hermes` pass named `NPM_TOKEN`/`GH_TOKEN` in some callers but must be audited for exact mappings.
- All product workflows call central reusable workflows at `@main` until OPS-182 pins them.
- `web-app` has no current `.github` workflow inventory and must be handled explicitly during adoption rather than silently omitted.

Do not pin action references in this task; OPS-182 owns immutable refs. Do not add CodeQL, dependency, secret, license, container, SBOM, or provenance gates; OPS-184/OPS-185 own those. Do not hide missing consumer harnesses with placeholders; OPS-189 and dependent product issues own adoption gaps.

## Permission and secret policy

The audit must evaluate event context, workflow, job, permissions, and secret flow. Missing or ambiguous authority is a failure for required workflows; a workflow may not rely on GitHub defaults.

Baseline policy:

| Path | Allowed token authority | Allowed named secrets |
|---|---|---|
| Pull-request quality checks | `contents: read`; artifact/SARIF scopes only when an implemented gate needs them | `NPM_TOKEN` only for repositories requiring private install; no release credential |
| Default-branch quality checks | Same as pull-request checks unless evidence publication needs a documented extra read/write scope | Only the named registry secret when required |
| Package release | Minimum `contents`, `pull-requests`, package/publication, and identity scopes required by the actual release action | `NPM_TOKEN` and one explicitly named GitHub release credential |
| Container release | `contents: read`, `packages: write`, and attestation/identity scopes only if implemented | `NPM_TOKEN` and one explicitly named container/GitHub credential |
| Fork/dependency-generated pull request | Read-only authority; no private/release secret | None, unless the private-install contract has a safe fork policy and the secret is unavailable by design |

Use `github.token` where the automatic token is sufficient; do not pass `GITHUB_TOKEN` as a custom secret. Reusable workflows declare each accepted secret by name under `on.workflow_call.secrets`; callers map secrets explicitly. `secrets: inherit` is forbidden in required and release paths. A secret must be scoped to the job/step that consumes it, never printed, persisted, or passed to untrusted code.

The exact release permission set must be derived from action behavior and tested. If a release action needs `contents: write` to create a changeset PR, record that purpose; do not grant write permission merely because a workflow is a release workflow.

### Task 1: Define the policy and red audit

**Files:**

- Create: `supply-chain/workflow-permissions.json`
- Create: `scripts/audit-workflow-permissions.mjs`
- Create: `test/workflow-permissions.test.mjs`
- Modify: `package.json`

**Steps:**

1. Write failing policy tests for missing top-level permissions, `write-all`, unexpected write scopes, `secrets: inherit`, undeclared reusable secrets, job-level secret misuse, release secrets in pull-request jobs, and fork workflows receiving write authority.
2. Add event-specific fixtures for quality PR, default-branch quality, package release, container release, fork PR, and invalid inheritance.
3. Run `pnpm run test:workflow-permissions`; expect failures against current central/product workflows.
4. Define the policy schema with workflow path, event, job, allowed permissions, allowed secrets, forbidden secrets, and remediation fields. Require explicit policy entries for all eight repositories.
5. Implement deterministic YAML-text/static auditing with repository, workflow, job, event, actual value, expected value, rule, and remediation. Do not execute workflows or interpolate secrets.
6. Add `test:workflow-permissions` and commit with `test: define least-privilege workflow policy`.

**Acceptance:** The audit fails closed on every broad, inherited, undeclared, event-inappropriate, or release-exposing permission/secret path.

### Task 2: Minimize central reusable workflow authority

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `.github/workflows/release-package.yml`
- Modify: `.github/workflows/release-docker-image.yml`
- Modify: `test/workflow-contract.test.mjs`
- Modify: `test/workflow-permissions.test.mjs`

**Steps:**

1. Add red assertions requiring explicit top-level/job permissions and named workflow-call secrets, then run the permission suite to prove the current definitions are incomplete.
2. Set quality checks to the minimum read authority needed for checkout, coverage history, and evidence. Account explicitly for the status notification action or replace it with a least-privilege-compatible reporting path.
3. Declare `NPM_TOKEN` only as the optional private-install secret for quality checks. Keep release credentials out of the quality workflow.
4. Set package release permissions based on actual changesets/publish behavior, and container release permissions based on registry login/push behavior. Keep `NPM_TOKEN` and the GitHub/container credential named and isolated.
5. Add workflow-call validation that rejects undeclared secrets and broad inheritance.
6. Run `pnpm run test:workflow-permissions`, `pnpm run test:workflow-contract`, `pnpm run format:check`, `pnpm run lint:check`, and actionlint when available.
7. Commit with `ci: minimize reusable workflow authority`.

**Acceptance:** Central reusable workflows declare no unnecessary write scope, no broad inherited secret, and no release credential on ordinary quality paths.

### Task 3: Replace inherited secrets in product callers

**Files:**

- Modify: `../commons/.github/workflows/*.yml`
- Modify: `../cache/.github/workflows/*.yml`
- Modify: `../server-utils/.github/workflows/*.yml`
- Modify: `../notify/.github/workflows/*.yml`
- Modify: `../cerberus/.github/workflows/*.yml`
- Modify: `../hermes/.github/workflows/*.yml`
- Create or modify: `../web-app/.github/workflows/quality-checks.yml`
- Modify: `supply-chain/workflow-permissions.json`

**Steps:**

1. Run the audit in each repository and save a red report before changing it.
2. For each quality caller, add top-level/job minimum permissions and pass only `NPM_TOKEN` when the repository’s private-install contract requires it. Never pass `GH_TOKEN`, publishing, package, or container credentials to pull-request quality checks.
3. For each package/container release caller, remove `secrets: inherit` and map only the reusable workflow’s declared secrets by name.
4. Preserve each repository’s existing trigger semantics and keep workflow pinning changes owned by OPS-182.
5. Run each repository’s local workflow/quality contract tests and the central cross-repository permission audit.
6. Commit and open one adoption/permission PR per repository; do not combine unrelated application changes.

**Acceptance:** Every product workflow has explicit event-aware permissions and secret mappings, with no `secrets: inherit` in required/release paths.

### Task 4: Prove untrusted-event isolation

**Files:**

- Create: `test/fixtures/workflows/permissions/{pull-request,release,invalid-inherit}/**`
- Modify: `test/workflow-permissions.test.mjs`
- Modify: `docs/quality-gates/gate-specification.md`
- Create: `docs/evidence/OPS-183-permission-matrix.md`

**Steps:**

1. Add fixture assertions proving a fork pull request has no write permission and no release credential, even when the caller requests a release-like workflow.
2. Add release fixtures proving only the declared package/container scopes and named credentials are available.
3. Add negative fixtures for `write-all`, `contents: write` on PR quality, undeclared secrets, inherited secrets, and release credentials exposed through environment/job scope.
4. Run the negative fixtures and require stable rule classifications and actionable remediation.
5. Document the final permission matrix, each secret consumer, event restrictions, and compensating controls.
6. Run `pnpm run test:workflow-permissions`, `pnpm run test:action-references`, `pnpm test`, and actionlint when available.
7. Commit with `docs: prove workflow credential isolation`.

**Acceptance:** Static and fixture evidence proves untrusted code cannot obtain release authority, and every grant has an identified consumer and purpose.

## Verification checklist

- `pnpm run test:workflow-permissions`
- `pnpm run test:action-references`
- `pnpm test`
- `pnpm run format:check`
- `pnpm run lint:check`
- `actionlint .github/workflows/*.yml .github/actions/**/*.yml` when installed
- Audit all eight repositories and every required/release workflow
- No `secrets: inherit` in required or release paths
- No release credential in pull-request quality jobs
- No `write-all` or unexplained write permission
- Every reusable secret is declared and mapped explicitly
- Permission matrix and evidence are linked to OPS-183

## Definition of done

- Central reusable workflows and all consumer callers declare minimum permissions.
- Secrets are named, explicitly mapped, and isolated to the jobs/steps that need them.
- Fork/dependency-generated pull requests cannot access release credentials or write authority.
- Permission and secret audits fail closed with deterministic diagnostics.
- OPS-182 pinning remains a separate concern and is not hidden in permission commits.
- Evidence is reproducible from a clean checkout and linked to every repository PR.
