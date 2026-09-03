# OPS-182 Immutable Workflow and Action References Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace every mutable reusable-workflow and third-party action reference in required and release paths with a reviewed immutable commit SHA.

**Architecture:** `gh-action-templates` owns a machine-readable inventory of every external action and shared-workflow reference used by all eight repositories. A central audit scans every workflow, rejects moving refs and unreviewed SHAs, and requires release metadata alongside each pin. Consumers are migrated in separate commits/PRs after a reviewed shared-workflow release is selected; Dependabot may propose updates but cannot merge them automatically.

**Tech Stack:** GitHub Actions YAML, Node.js 24.20.0, pnpm 10.34.0, Node test runner, GitHub REST API/`gh`, actionlint, Dependabot.

---

## Context and current state

Work in the central `gh-action-templates` repository, with the seven product repositories as sibling directories:

```text
gh-action-templates/   # central policy, reusable workflows, actions, audit, fixtures
../commons/
../cache/
../server-utils/
../notify/
../cerberus/
../hermes/
../web-app/
```

OPS-181 is merged into central `main` and the reusable workflow currently contains mutable references including:

- `actions/checkout@v3`
- `actions/upload-artifact@v3`
- `otedesco/gh-action-templates/...@main`
- The new `coverage-gate` action is currently consumed as `@main`.

The product repositories currently consume central reusable workflows at `@main`. Their known workflows are:

- `commons/.github/workflows/{quality-checks,release-packages}.yml`
- `cache/.github/workflows/{quality-checks,release-packages}.yml`
- `server-utils/.github/workflows/{quality-checks,release-packages}.yml`
- `notify/.github/workflows/{quality-checks,release-packages}.yml`
- `cerberus/.github/workflows/{quality-checks,release-docker,release-packages}.yml`
- `hermes/.github/workflows/{quality-checks,release-docker,release-packages}.yml`
- `web-app/.github/workflows/**` when the adoption workflow exists.

The audit must cover both `.yml` and `.yaml`, required pull-request workflows, push/release workflows, reusable workflows, composite actions, and release paths. Local action references such as `./.github/actions/foo` are allowed only when they stay inside the repository; parent traversal and arbitrary remote downloads are not allowed.

Do not change workflow permissions or secret flow in this task; OPS-183 owns those changes. Do not add security scanners or release attestations; OPS-184/OPS-185 own those controls.

## Reference policy

Every remote `uses:` reference must be either:

```text
owner/repository@<40 lowercase hexadecimal commit SHA> # human-readable release tag
```

or an approved central reusable workflow/action reference pinned to its exact reviewed commit SHA. The comment is metadata only and cannot be parsed as the revision. A tag, branch, `main`, `master`, `latest`, semantic version, short SHA, or floating expression fails the audit.

Each manifest entry records:

```json
{
  "owner": "actions",
  "repository": "checkout",
  "reference": "<40-char-sha>",
  "release": "v4.2.2",
  "reviewedAt": "2026-09-02",
  "purpose": "Checkout repository history for quality gates",
  "repositories": ["gh-action-templates", "commons"]
}
```

The audit is deterministic, sorts repository/workflow/reference output, and reports the exact file, line, actual ref, policy rule, and remediation. It must not resolve arbitrary refs during ordinary tests; resolution is a separately reviewed update step.

### Task 1: Define the manifest and red audit

**Files:**

- Create: `supply-chain/action-references.json`
- Create: `scripts/audit-action-references.mjs`
- Create: `test/action-references.test.mjs`
- Modify: `package.json`

**Steps:**

1. Record the current eight-repository inventory and write failing tests for `@main`, `@master`, version tags, short SHAs, missing manifest entries, malformed SHAs, missing release metadata, duplicate entries, and unsafe local paths.
2. Run `pnpm run test:action-references`; expect failures against the current mutable references.
3. Implement workflow discovery from the explicit repository list, parsing `uses:` values with file/line diagnostics. Ignore `node_modules`, build output, and generated artifacts.
4. Implement manifest validation and deterministic audit output. Require a 40-character SHA and human-readable release metadata for every remote reference.
5. Add `test:action-references` to `package.json` and run the focused suite.
6. Commit the red audit contract with `test: audit immutable action references`.

**Acceptance:** The audit fails closed on every mutable or unreviewed reference and emits actionable, stable diagnostics.

### Task 2: Resolve and pin central third-party actions

**Files:**

- Modify: `.github/actions/**/*.yml`
- Modify: `.github/workflows/*.yml`
- Modify: `supply-chain/action-references.json`
- Modify: `test/action-references.test.mjs`

**Steps:**

1. Enumerate all current remote references in central workflows/actions, including `actions/checkout`, `actions/upload-artifact`, `actions/cache`, `volta-cli/action`, `pnpm/action-setup`, `docker/metadata-action`, `docker/login-action`, `docker/build-push-action`, and `changesets/action`.
2. Resolve each intended release to its final commit SHA. For annotated tags, verify the peeled commit rather than the tag object. Record the release tag, SHA, review date, purpose, and affected paths in the manifest.
3. Replace each mutable reference with the 40-character SHA and a release comment. Preserve local action references.
4. Add tests that verify the recorded SHA is exactly the workflow SHA and that comments do not affect parsing.
5. Run `pnpm run test:action-references`, `pnpm test`, `pnpm run format:check`, and `pnpm run lint:check`.
6. Run actionlint against central workflows/actions when available.
7. Commit with `ci: pin central actions by commit`.

**Acceptance:** Central workflows/actions contain no moving third-party reference, and every pin has reviewed release metadata.

### Task 3: Publish and pin the shared workflow release

**Files:**

- Modify: all product `.github/workflows/*.yml` files listed above
- Modify: `supply-chain/action-references.json`
- Create: `docs/evidence/OPS-182-reference-rollout.md`

**Steps:**

1. Start from the merged central `main` commit after Tasks 1–2 pass. Record the exact commit SHA that consumers may use; use a reviewed release tag only as human-readable metadata.
2. Replace every `otedesco/gh-action-templates/...@main` in product workflows with the exact central release SHA. Include a comment such as `# central quality workflow release YYYY-MM-DD`.
3. Keep each product repository change isolated in its own branch/PR. Do not combine workflow pinning with OPS-183 permission changes or OPS-189 adoption changes.
4. Extend the manifest with repository, workflow, line, remote reference, pinned SHA, release metadata, and rollout PR fields.
5. Run the central audit against all eight repositories and require zero violations.
6. For each product repository, run its available workflow contract tests and record the PR, commit, workflow SHA, and validation result in `docs/evidence/OPS-182-reference-rollout.md`.
7. Commit central evidence and create one consumer pinning PR per repository.

**Acceptance:** No product required/release workflow calls central templates at `@main` or another moving ref; the selected central release is identifiable and consistent everywhere.

### Task 4: Configure reviewed dependency updates

**Files:**

- Create: `.github/dependabot.yml`
- Modify: `docs/quality-gates/gate-specification.md`
- Modify: `test/action-references.test.mjs`

**Steps:**

1. Add a weekly GitHub Actions Dependabot update configuration for the central repository, with labels and no automatic merge.
2. Document that every update must verify upstream release notes, final commit SHA, changed permissions, secret exposure, workflow fixtures, the immutable-reference audit, and actionlint.
3. Add a test rejecting Dependabot configuration that enables automatic merge or omits the GitHub Actions ecosystem.
4. Run all action-reference tests and commit with `chore: automate reviewed action pin updates`.

**Acceptance:** Future action updates are proposed for review and cannot silently reintroduce mutable references.

## Verification checklist

- `pnpm run test:action-references`
- `pnpm test`
- `pnpm run format:check`
- `pnpm run lint:check`
- `actionlint .github/actions/**/*.yml .github/workflows/*.yml` when installed
- Audit all eight repositories and all required/release workflows
- Confirm no `@main`, `@master`, version tag, short SHA, or unsafe local traversal remains
- Confirm every manifest entry has a 40-character SHA, release metadata, review date, purpose, and affected repositories
- Record the central release SHA and each consumer rollout PR

## Definition of done

- Central and product required/release workflows use immutable reviewed references.
- The central audit rejects all moving, malformed, missing, or unreviewed references.
- Shared workflow consumers are pinned to one identifiable reviewed central release.
- Dependabot proposes—but does not merge—reference updates.
- OPS-183 permission changes remain separate and are not hidden in pinning commits.
- Evidence is linked to OPS-182 and is reproducible from a clean checkout.
