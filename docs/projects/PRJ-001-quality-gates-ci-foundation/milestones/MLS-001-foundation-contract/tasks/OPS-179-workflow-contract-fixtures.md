# OPS-179 Workflow Contract Fixtures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deterministic fixture harness proving that shared quality workflows accept a valid repository and reject each intended defect.

**Architecture:** Keep tiny fixture repositories under `test/fixtures/workflows` and drive their local quality commands through a Node test harness. Add static workflow assertions now; expose a reusable fixture runner that later gate plans extend with coverage, security, and container cases.

**Tech Stack:** Node test runner, child processes, package.json fixtures, GitHub Actions, actionlint, pnpm.

---

## Scope

- Depends on the contracts from `OPS-176`, `OPS-177`, and `OPS-178`.
- Central repository: `gh-action-templates`.
- Do not add product behavior tests or duplicate the full seven-repository adoption work in `OPS-189`.

### Task 1: Create the fixture runner and valid fixture

**Files:**

- Create: `test/helpers/run-fixture.mjs`
- Create: `test/workflow-fixtures.test.mjs`
- Create: `test/fixtures/workflows/valid/package.json`
- Create: `test/fixtures/workflows/valid/src/index.ts`
- Create: `test/fixtures/workflows/valid/test/index.test.mjs`
- Modify: `package.json`

**Step 1: Write the failing runner test**

Assert `runFixture("valid", "quality:check")` returns exit code zero, normalized stdout/stderr, duration, and no workspace mutation. Add timeout and environment allow-list assertions.

**Step 2: Run the focused test**

Run `pnpm test:workflow-fixtures`.

Expected: FAIL because the helper and fixture do not exist.

**Step 3: Implement the minimal runner**

Use `spawn` with an argument array, fixed working directory, `CI=true`, a 60-second timeout, and only approved environment variables. Copy each fixture into a temporary directory before executing it; never run against the checked-in fixture.

**Step 4: Add the valid fixture**

Give the fixture the canonical `format:check`, `lint:check`, `type:check`, `test`, `test:coverage`, `build`, and `quality:check` scripts. Keep its source and test to one observable function.

**Step 5: Verify and commit**

Run `pnpm test:workflow-fixtures`; expect PASS with no changed tracked file.

```bash
git add package.json test/helpers test/fixtures test/workflow-fixtures.test.mjs
git commit -m "test: add the valid workflow contract fixture"
```

### Task 2: Add one negative fixture per core defect

**Files:**

- Create: `test/fixtures/workflows/type-error/**`
- Create: `test/fixtures/workflows/lint-error/**`
- Create: `test/fixtures/workflows/format-drift/**`
- Create: `test/fixtures/workflows/no-tests/**`
- Create: `test/fixtures/workflows/coverage-gap/**`
- Create: `test/fixtures/workflows/build-error/**`
- Modify: `test/workflow-fixtures.test.mjs`

**Step 1: Write table-driven failing assertions**

For each fixture, assert a non-zero exit, the expected failing canonical command, and an actionable diagnostic. Also assert the valid fixture still passes.

**Step 2: Run the test**

Expected: FAIL because the negative fixtures are missing.

**Step 3: Add minimal single-defect fixtures**

Each fixture differs from `valid` by exactly one defect. Do not copy unrelated failures into a fixture; otherwise the test cannot prove which gate rejected it.

**Step 4: Prove stable results**

Run `pnpm test:workflow-fixtures` three times. Expected: the valid case passes and all six negative cases fail at the intended gate with the same normalized classification.

**Step 5: Commit**

```bash
git add test/fixtures/workflows test/workflow-fixtures.test.mjs
git commit -m "test: prove core workflow failure modes"
```

### Task 3: Verify reusable workflow wiring

**Files:**

- Create: `test/workflow-contract.test.mjs`
- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `package.json`

**Step 1: Write red static assertions**

Parse the reusable workflow and require named steps for install, format, lint, type, unit, coverage, and build. Reject `continue-on-error`, `|| true`, mutable setup references, raw fix flags, and missing workflow-call declarations.

**Step 2: Run the contract test**

Expected: FAIL because the current workflow omits format, coverage, and build and calls `@main`.

**Step 3: Wire the canonical commands**

Use the script interface from `OPS-178`; keep each command in a separately named step for stable failure reporting. Reuse the setup/authentication behavior from `OPS-176` and `OPS-177`.

**Step 4: Validate**

Run:

```bash
pnpm test:workflow-contract
pnpm test:workflow-fixtures
actionlint .github/workflows/lint-and-test.yml
```

Expected: PASS.

**Step 5: Commit**

```bash
git add .github/workflows/lint-and-test.yml package.json test/workflow-contract.test.mjs
git commit -m "ci: enforce the workflow fixture contract"
```

### Task 4: Document extension rules and evidence

**Files:**

- Create: `docs/testing/workflow-fixtures.md`
- Modify: `docs/architecture/quality-baseline.md`

**Step 1: Document fixture anatomy**

Describe the single-defect rule, valid control, timeouts, environment isolation, expected-output normalization, and how `OPS-180` through `OPS-185` add cases.

**Step 2: Run the full central suite**

Run `pnpm test`, `pnpm test:workflow-fixtures`, and `actionlint .github/workflows/*.yml`.

Expected: PASS with the six negative fixtures rejected intentionally.

**Step 3: Record evidence and commit**

```bash
git add docs/testing/workflow-fixtures.md docs/architecture/quality-baseline.md
git commit -m "docs: record workflow fixture evidence"
```

## Completion checklist

- A valid fixture passes.
- Type, lint, format, no-test, coverage, and build defects fail their intended gates.
- Fixtures run in isolated temporary directories with deterministic timeouts.
- The shared workflow calls the canonical check-only commands.
- The harness is documented for extension by later milestone tasks.

## Execution update — 2026-09-02

Implemented the fixture harness and contract checks in `gh-action-templates`.

- Added isolated, timeout-bounded fixture execution with structured evidence and repository-mutation protection.
- Added the valid control and executable single-defect cases for type, lint, format, no-test, coverage, and build failures.
- Added static security and container defect fixtures that fail closed under contract assertions; scanner/image enforcement remains owned by OPS-184 and OPS-185.
- Added reusable workflow wiring assertions for `workflow_call`, package-manager input, canonical check-only commands, and forbidden failure escapes.
- Added reproduction and extension guidance in `docs/testing/workflow-fixtures.md`.

Evidence: `pnpm run test:workflow-contract` and `pnpm run test:workflow-fixtures` pass under the available runtime. The environment reports Node `v25.6.0` while the repository contract requests `24.20.0`; this produces a pnpm engine warning and should be rerun under the accepted runtime before milestone sign-off.
