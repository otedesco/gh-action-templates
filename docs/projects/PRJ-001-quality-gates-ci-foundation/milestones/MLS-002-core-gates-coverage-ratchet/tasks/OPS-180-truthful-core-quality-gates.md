# OPS-180 Truthful Core Quality Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make formatting, lint, type, unit, coverage, and build checks fail on warnings, drift, missing tests/providers, skipped or focused tests, leaked handles, unhandled errors, uncovered source, and build failures.

**Architecture:** Extend the `OPS-179` fixture harness with one defect per failure mode and centralize pre/post-check validation in small Node scripts. The reusable workflow runs canonical repository commands and uploads evidence only after commands report truthful success.

**Tech Stack:** GitHub Actions, Node test runner, actionlint, ESLint, Prettier, TypeScript, Jest, Vitest, pnpm.

---

### Task 1: Define the gate result schema

**Files:**

- Create: `quality-gates/core-gates.json`
- Create: `scripts/validate-core-gates.mjs`
- Create: `test/core-gates.test.mjs`
- Modify: `package.json`

**Step 1: Write failing tests**

Require six uniquely named gates, command names from `OPS-178`, zero-warning policy, no-test prohibition, timeout, and evidence paths. Reject missing/duplicate gates and ignored failures.

**Step 2: Run `pnpm test:core-gates`**

Expected: FAIL because the schema and validator are absent.

**Step 3: Implement the validator**

Return structured errors containing gate, repository, violated rule, and remediation. Keep validation pure and give the CLI a non-zero exit on any error.

**Step 4: Run tests and commit**

Expected: PASS with 100% changed-code coverage.

```bash
git add quality-gates/core-gates.json scripts/validate-core-gates.mjs test/core-gates.test.mjs package.json
git commit -m "test: define truthful core gate results"
```

### Task 2: Add truthful negative fixtures

**Files:**

- Create: `test/fixtures/workflows/lint-warning/**`
- Create: `test/fixtures/workflows/focused-test/**`
- Create: `test/fixtures/workflows/skipped-test/**`
- Create: `test/fixtures/workflows/unhandled-error/**`
- Create: `test/fixtures/workflows/leaked-handle/**`
- Create: `test/fixtures/workflows/missing-coverage-provider/**`
- Create: `test/fixtures/workflows/uncovered-source/**`
- Create: `test/fixtures/workflows/build-drift/**`
- Modify: `test/workflow-fixtures.test.mjs`

**Step 1: Add red table entries**

Assert each fixture fails one stable gate and the valid fixture passes.

**Step 2: Add minimal fixtures**

Use sentinel defects; no fixture may contain a second known failure.

**Step 3: Run three repetitions**

Run `pnpm test:workflow-fixtures` three times. Expected: identical classifications and no timeout variance.

**Step 4: Commit**

```bash
git add test/fixtures/workflows test/workflow-fixtures.test.mjs
git commit -m "test: cover truthful core gate failures"
```

### Task 3: Enforce the workflow gate sequence

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `test/workflow-contract.test.mjs`

**Step 1: Assert exact named steps and policies**

Require format, lint with zero warnings, type, unit with no skipped/focused tests, coverage, build, and tracked-file drift validation. Reject `continue-on-error`, job-level secrets, and artifact upload before validation.

**Step 2: Run the test**

Expected: FAIL against the incomplete workflow.

**Step 3: Implement the minimal workflow**

Call canonical scripts in separate steps. Add a final `git diff --exit-code` check for generated drift and upload reports with `if: always()` without converting a failed gate to success.

**Step 4: Validate and commit**

```bash
pnpm test:core-gates
pnpm test:workflow-contract
pnpm test:workflow-fixtures
actionlint .github/workflows/lint-and-test.yml
git add .github/workflows/lint-and-test.yml test/workflow-contract.test.mjs
git commit -m "ci: make core quality gates truthful"
```

### Task 4: Prove consumer behavior

**Files:**

- Modify: `docs/architecture/quality-baseline.md`
- Modify: `docs/quality-gates/gate-specification.md`

**Step 1: Run each canonical command in all seven repositories**

Use the `OPS-176` package manager and `OPS-177` credential contract. Record pass/fail without repairing unrelated product defects.

**Step 2: Verify no tracked mutation**

Run `git status --short` before and after every command. Expected: no tracked change from check-only commands.

**Step 3: Record baseline and commit**

Document every exposed failure with its owning Linear issue.

```bash
git add docs/architecture/quality-baseline.md docs/quality-gates/gate-specification.md
git commit -m "docs: record truthful core gate evidence"
```

