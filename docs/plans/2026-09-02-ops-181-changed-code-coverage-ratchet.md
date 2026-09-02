# OPS-181 Changed-Code Coverage and Global Ratchet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce 100% changed executable-code coverage across statements, branches, functions, and lines while preventing global coverage regressions.

**Architecture:** Normalize Jest/Vitest coverage into one deterministic representation, inventory executable source independently of the report, evaluate changed code from explicit git base/head revisions, and compare repository-wide metrics against a checked-in baseline. The CI workflow fails closed for incomplete reports, missing history, malformed data, and unavailable source.

**Tech Stack:** Node.js 24.20.0, pnpm 10.34.0, LCOV/coverage-summary JSON, git, JSON Schema, Node test runner, GitHub Actions.

---

## Scope and sequencing

- Work in `gh-action-templates`.
- Reuse the truthful gate and fixture contracts from OPS-180.
- Keep changed-code enforcement separate from the global baseline ratchet.
- Do not silently write or update baselines during pull-request checks.
- Every negative case must identify the failing metric, file, location, and remediation.

```text
181.1 Normalize reports and source inventory
  -> 181.2 Resolve changed files and lines
      -> 181.3 Evaluate changed-code coverage
          -> 181.4 Enforce the global ratchet
              -> 181.5 Wire the evaluator into CI
                  -> 181.6 Record evidence and handoff
```

### Subtask 181.1: Normalize coverage reports and inventory source

**Files:**

- Create: `scripts/coverage/normalize.mjs`
- Create: `scripts/coverage/schema.json`
- Create: `scripts/coverage/source-inventory.mjs`
- Create: `test/coverage-normalize.test.mjs`
- Create: `test/fixtures/coverage/{valid,missing-file,malformed}/**`
- Modify: `package.json`

**Steps:**

1. Add `test:coverage-gate` and write failing tests for valid Jest/Vitest summaries, repository-relative paths, duplicate files, missing metrics, malformed numbers, and source files absent from reports.
2. Run `pnpm run test:coverage-gate`; expect failure because the normalizer is absent.
3. Implement normalization into sorted files with integer covered/total pairs for statements, branches, functions, and lines.
4. Implement independent executable-source inventory. Treat an executable source file absent from coverage as uncovered, not as covered or ignorable.
5. Run the focused tests and `pnpm run lint:check`; expect PASS.
6. Commit with `test: normalize coverage reports fail closed`.

**Acceptance:** Valid reports normalize deterministically; malformed, incomplete, duplicated, and source-missing inputs fail with actionable diagnostics.

### Subtask 181.2: Resolve changed files and lines safely

**Files:**

- Create: `scripts/coverage/changed-lines.mjs`
- Create: `test/coverage-changed.test.mjs`
- Create: `test/fixtures/git-history/**`

**Steps:**

1. Add failing tests for added files, modified lines, deleted lines, renames, zero-context hunks, generated/non-executable files, missing base/head, missing merge base, and shallow history.
2. Run `pnpm run test:coverage-gate`; expect failure because changed-line resolution is absent.
3. Implement explicit base/head SHA inputs and parse unified diff hunks without shell interpolation.
4. Fail closed when either revision, the merge base, or sufficient history is unavailable.
5. Verify renamed files and deleted lines do not create false uncovered-line failures.
6. Run the focused tests and commit with `test: resolve changed coverage scope`.

**Acceptance:** The resolver returns deterministic repository-relative changed ranges and rejects ambiguous or incomplete git history.

### Subtask 181.3: Evaluate all four changed-code metrics

**Files:**

- Create: `scripts/coverage/evaluate.mjs`
- Modify: `test/coverage-changed.test.mjs`
- Create: `test/fixtures/coverage/changed-code/**`

**Steps:**

1. Add failing cases for one uncovered changed statement, branch, function, and line, plus a fully covered change.
2. Run the focused coverage test; expect failure because evaluation is absent.
3. Implement metric evaluation against normalized report data and the changed-file/line set.
4. Emit exact file and location failures, including metric name, observed value, required value, and remediation.
5. Ensure non-executable changes pass without weakening executable-source validation.
6. Run `pnpm run test:coverage-gate` three times and commit with `feat: enforce complete changed-code coverage`.

**Acceptance:** Every changed executable unit meets 100% statement, branch, function, and line coverage; one uncovered unit fails only the intended gate classification.

### Subtask 181.4: Add the global non-decreasing ratchet

**Files:**

- Create: `coverage-baselines/schema.json`
- Create: `coverage-baselines/repositories.json`
- Create: `scripts/coverage/ratchet.mjs`
- Create: `test/coverage-ratchet.test.mjs`

**Steps:**

1. Write failing tests for equal, improved, regressed, missing, malformed, stale, and incompatible baselines across all four metrics.
2. Run the focused ratchet tests; expect failure because baseline evaluation is absent.
3. Implement strict comparison where any current metric below baseline fails.
4. Emit a deterministic proposed baseline using `max(old,current)` only when all current metrics are valid; never write it during PR evaluation.
5. Require repository identity, commit, timestamp, schema version, and all four global metrics.
6. Run the complete coverage suite and commit with `feat: add the global coverage ratchet`.

**Acceptance:** Global coverage cannot decrease; valid improvements produce a reviewable proposal; missing or malformed evidence is non-green.

### Subtask 181.5: Wire changed coverage and ratchet into reusable CI

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `test/workflow-contract.test.mjs`
- Modify: `test/workflow-fixtures.test.mjs`
- Modify: `package.json`

**Steps:**

1. Add failing workflow assertions for `fetch-depth: 0`, explicit base/head SHAs, source inventory, coverage execution before evaluation, fail-closed evaluation, and report artifacts.
2. Run `pnpm run test:workflow-contract`; expect failure against the incomplete workflow.
3. Add named steps for coverage generation, changed-code evaluation, global ratchet evaluation, and evidence upload.
4. Upload raw reports and the JSON decision with `if: always()` while preserving the evaluator’s non-zero exit status.
5. Add negative fixture cases for uncovered changes, global regression, malformed report, missing source, and shallow history; retain passing and improved cases.
6. Run `pnpm run test:coverage-gate`, `pnpm run test:workflow-contract`, `pnpm run test:workflow-fixtures`, and `actionlint .github/workflows/lint-and-test.yml`.
7. Commit with `ci: enforce changed coverage and global ratchet`.

**Acceptance:** CI uses full history, evaluates explicit revisions, fails on every intended negative case, and preserves diagnostic artifacts without converting failures to success.

### Subtask 181.6: Record evidence and hand off to dependent work

**Files:**

- Modify: `docs/testing/testing-and-coverage-strategy.md`
- Modify: `docs/quality-gates/gate-specification.md`
- Modify: `docs/architecture/quality-baseline.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-002-core-gates-coverage-ratchet/tasks/OPS-181-changed-code-coverage-ratchet.md`

**Steps:**

1. Document the normalized report schema, source-inventory rule, changed-code policy, baseline format, and failure semantics.
2. Record repository baselines, schema versions, workflow revision, test commands, and known environment limitations.
3. Run the complete central suite, repeat coverage fixtures three times, run `git diff --check`, and verify no check-only command mutates tracked files.
4. Link evidence and implementation commits to OPS-181 and identify the handoff requirements for OPS-182, OPS-183, and OPS-189.
5. Commit with `docs: record changed coverage ratchet evidence`.

**Acceptance:** OPS-181 has reproducible local commands, deterministic positive/negative evidence, reviewable baseline data, and explicit downstream dependencies.

## Definition of done

- Changed executable code requires 100% statement, branch, function, and line coverage.
- Global coverage never decreases across any of the four metrics.
- Reports, source inventory, baselines, and git history are validated fail closed.
- CI publishes diagnostic evidence without suppressing evaluator failures.
- The central suite is deterministic across three repetitions and check-only commands leave tracked files unchanged.
- Documentation and Linear evidence identify implementation commits, baselines, workflow revision, limitations, and downstream handoffs.
