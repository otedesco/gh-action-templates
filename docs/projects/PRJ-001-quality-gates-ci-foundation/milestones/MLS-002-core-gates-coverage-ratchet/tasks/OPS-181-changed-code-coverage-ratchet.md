# OPS-181 Changed-Code Coverage and Global Ratchet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce 100% changed executable code coverage across all four metrics while preventing any global coverage regression.

**Architecture:** A tested Node CLI merges normalized coverage summaries, independently inventories executable source, computes changed lines from the merge base, and evaluates a versioned baseline. The workflow fetches sufficient history, fails closed on incomplete inputs, and publishes the decision plus reports.

**Tech Stack:** Node.js, LCOV/coverage-summary JSON, git, GitHub Actions, JSON Schema, Node test runner.

---

### Task 1: Normalize and validate coverage inputs

**Files:**

- Create: `scripts/coverage/normalize.mjs`
- Create: `scripts/coverage/schema.json`
- Create: `test/coverage-normalize.test.mjs`
- Create: `test/fixtures/coverage/{valid,missing-file,malformed}/**`
- Modify: `package.json`

**Step 1: Write red tests**

Cover valid Jest/Vitest summaries, path normalization, duplicate files, missing metrics, malformed numbers, and executable files absent from reports.

**Step 2: Run `pnpm test:coverage-gate`**

Expected: FAIL because normalization is absent.

**Step 3: Implement normalization**

Emit sorted repository-relative paths and integer covered/total pairs for statements, branches, functions, and lines. Reject incomplete input; never assume omitted source is fully covered.

**Step 4: Verify 100% changed-code coverage and commit**

```bash
git add scripts/coverage test/coverage-normalize.test.mjs test/fixtures/coverage package.json
git commit -m "test: normalize coverage reports fail closed"
```

### Task 2: Implement changed-code evaluation

**Files:**

- Create: `scripts/coverage/changed-lines.mjs`
- Create: `scripts/coverage/evaluate.mjs`
- Create: `test/coverage-changed.test.mjs`
- Create: `test/fixtures/git-history/**`

**Step 1: Write failing tests**

Cover added files, modified lines, deleted lines, renamed files, changed branches, no merge base, shallow history, generated/non-executable files, and one uncovered changed line.

**Step 2: Implement git diff parsing**

Accept explicit base/head SHAs; parse zero-context unified diff hunks without shell interpolation. Fail when base/head or merge base is unavailable.

**Step 3: Enforce all four metrics**

Require every changed executable line/function/statement/branch to be covered. Emit exact file and location failures.

**Step 4: Run tests and commit**

```bash
pnpm test:coverage-gate
git add scripts/coverage test/coverage-changed.test.mjs test/fixtures/git-history
git commit -m "feat: enforce complete changed-code coverage"
```

### Task 3: Add the global ratchet

**Files:**

- Create: `coverage-baselines/schema.json`
- Create: `coverage-baselines/repositories.json`
- Create: `scripts/coverage/ratchet.mjs`
- Create: `test/coverage-ratchet.test.mjs`

**Step 1: Write red baseline tests**

Cover equal, improved, regressed, missing, malformed, and stale repository baselines for all four metrics.

**Step 2: Implement comparison**

Fail any metric below baseline. When all current values are valid, emit a deterministic proposed baseline containing `max(old,current)` for each metric; do not silently write it in PR checks.

**Step 3: Run tests and commit**

```bash
pnpm test:coverage-gate
git add coverage-baselines scripts/coverage/ratchet.mjs test/coverage-ratchet.test.mjs
git commit -m "feat: add the global coverage ratchet"
```

### Task 4: Wire coverage into reusable CI

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `test/workflow-contract.test.mjs`
- Modify: `docs/testing/testing-and-coverage-strategy.md`

**Step 1: Add red workflow assertions**

Require full history, coverage execution before evaluation, source inventory, explicit base/head SHAs, fail-closed evaluation, and report artifact upload.

**Step 2: Implement the workflow steps**

Use `fetch-depth: 0`; run repository coverage, then the central evaluator. Upload raw reports and the JSON decision even on failure, without suppressing the evaluator exit code.

**Step 3: Run negative fixtures**

Expected: uncovered change, regression, malformed report, missing source, and shallow history all fail; valid and improved cases pass.

**Step 4: Validate and commit**

```bash
pnpm test:coverage-gate
pnpm test:workflow-contract
actionlint .github/workflows/lint-and-test.yml
git add .github/workflows/lint-and-test.yml test/workflow-contract.test.mjs docs/testing/testing-and-coverage-strategy.md
git commit -m "ci: enforce changed coverage and global ratchet"
```

