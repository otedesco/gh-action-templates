# OPS-189 Quality Contract Adoption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt the approved quality gate contract through one reviewed pull request in each of the seven product repositories without hiding legacy gaps.

**Architecture:** Maintain an adoption matrix and machine-readable conformance report in `gh-action-templates`, then migrate consumers in dependency order using the immutable shared workflow release. Each repository keeps tool-specific implementation details but exposes the same commands, evidence, permissions, and required checks; baselines record current truth rather than weakening policy.

**Tech Stack:** GitHub Actions reusable workflows, Node/pnpm or approved npm exception, Jest, Vitest, Next.js, coverage JSON/LCOV, GitHub CLI, Node test runner.

---

## Dependencies and scope

- Requires completed contracts and enforcement from `OPS-176` through `OPS-187`.
- Must complete before the formal `OPS-188` 100-run campaign begins.
- Covers `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, and `web-app`; central `gh-action-templates` conformance is validated separately.

### Task 1: Define adoption inventory and conformance test

**Files:**

- Create: `adoption/repositories.json`
- Create: `adoption/conformance.schema.json`
- Create: `scripts/adoption/audit-repository.mjs`
- Create: `test/adoption-conformance.test.mjs`
- Modify: `package.json`

**Step 1: Write failing cross-repository tests**

Require runtime/package manager, frozen install, canonical scripts, immutable workflow SHA, explicit secrets, required core/security/release calls, coverage baseline, ruleset evidence, ownership, and no prohibited bypass token.

**Step 2:** Run `pnpm test:adoption`; expect failures for every current consumer gap.

**Step 3:** Implement audit output with repository, rule, actual value, expected value, and remediation. Generate deterministic JSON and Markdown summaries.

**Step 4:** Commit the red audit with `test: define product quality conformance`.

### Task 2: Adopt shared libraries in dependency order

**Files:**

- Modify: `../commons/package.json`, lockfile, coverage config, and `.github/workflows/*.yml`
- Modify: `../cache/package.json`, lockfile, coverage config, and `.github/workflows/*.yml`
- Modify: `../server-utils/package.json`, lockfile, coverage config, and `.github/workflows/*.yml`
- Create or modify: each `.github/CODEOWNERS`

**Step 1:** Run the audit for `commons`; capture the red report.

**Step 2:** Apply the smallest contract changes, run every canonical command, and verify check-only commands leave tracked files unchanged.

**Step 3:** Run repository-specific positive/negative workflow fixtures and record truthful four-metric coverage baseline.

**Step 4:** Open and review the Commons adoption PR; merge only after required checks and live ruleset verification pass.

**Step 5:** Repeat Steps 1–4 for Cache, then Server Utils. Do not combine repositories into one PR.

**Step 6:** After each merge, update `adoption/repositories.json` with commit, workflow SHA, baseline checksum, PR, and evidence links.

### Task 3: Adopt messaging and service repositories

**Files:**

- Modify: `../notify/package.json`, lockfile, coverage config, and `.github/workflows/*.yml`
- Modify: `../cerberus/package.json`, lockfile, Jest config, Dockerfiles, and `.github/workflows/*.yml`
- Modify: `../hermes/package.json`, lockfile, test config, Dockerfiles, and `.github/workflows/*.yml`
- Create or modify: each `.github/CODEOWNERS`

**Step 1:** Adopt Notify after shared package contracts are available. Prove authenticated frozen install and package release paths.

**Step 2:** Adopt Cerberus after its private dependencies resolve. Prove service checks, migration-safe build, container gates, and release evidence.

**Step 3:** Adopt Hermes last in this group. Prove HTTP and worker builds, both container variants, and no placeholder test success.

**Step 4:** For each repository, demonstrate at least one negative fixture fails its intended gate and no sentinel credential appears in logs/artifacts.

**Step 5:** Merge one reviewed PR per repository and update the adoption inventory after each merge.

### Task 4: Adopt the web application

**Files:**

- Modify: `../web-app/package.json` and lockfile
- Create or modify: `../web-app` test/coverage configuration
- Create: `../web-app/.github/workflows/quality-checks.yml`
- Create or modify: `../web-app/.github/CODEOWNERS`

**Step 1:** Run the audit and capture missing test, coverage, workflow, ownership, and package-manager requirements.

**Step 2:** Apply the `OPS-176` package-manager decision and canonical commands. Consume the test harness owned by `OPS-228`; if it is not ready, keep the check visibly failing and record the blocking dependency rather than bypassing it.

**Step 3:** Run format, lint, type, test, coverage, and production build independently. Verify no tracked mutation and record all four coverage metrics.

**Step 4:** Add immutable shared workflows, explicit permissions/secrets, repository ownership, and required checks.

**Step 5:** Prove positive and negative cases, merge the reviewed adoption PR, and update the inventory.

### Task 5: Verify complete adoption and publish evidence

**Files:**

- Modify: `adoption/repositories.json`
- Create: `docs/evidence/OPS-189-adoption.md`
- Modify: `docs/architecture/quality-baseline.md`
- Modify: `docs/quality-dashboard/README.md`

**Step 1:** Run `pnpm test:adoption` across all seven protected default branches; expect zero violations.

**Step 2:** Confirm seven distinct merged PRs, immutable shared workflow SHAs, current baselines, and live ruleset enforcement.

**Step 3:** Compare dashboard status with raw run artifacts; any discrepancy blocks completion.

**Step 4:** Record repository commits, PRs, command results, coverage, negative fixtures, workflow SHAs, rulesets, and known owned gaps.

**Step 5:** Run the complete central contract suite and actionlint. Commit with `docs: record workspace quality adoption`.

## Completion checklist

- Seven distinct reviewed adoption PRs are merged.
- Every repository exposes the canonical local interface.
- Workflows are immutable, least-privilege, and required.
- Frozen installs and applicable releases are reproducible.
- Baselines are truthful and legacy gaps remain visible and owned.
- Positive and negative evidence exists per repository.
- The adoption inventory is ready to seed `OPS-188`.
- Evidence is linked to `OPS-189`.

