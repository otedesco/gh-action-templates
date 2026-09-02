# Workflow Contract Fixtures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deterministic fixture suite proving that the quality contract accepts a valid repository and rejects each declared defect at its intended stable gate.

**Architecture:** Keep small, single-defect fixture repositories under `test/fixtures/workflows` and execute their check-only commands through an isolated Node test harness. The central workflow contract test validates step names, command wiring, and fail-closed security/container declarations; later milestone work can add the scanners and image runtime checks without replacing this fixture framework.

**Tech Stack:** Node.js test runner, `child_process.spawn`, temporary directories, package.json scripts, GitHub Actions YAML, actionlint, pnpm.

---

## Scope and decisions

- Work in `gh-action-templates`, the central repository for the quality contract.
- Reuse the runtime, registry-auth, and script contracts established by OPS-176, OPS-177, and OPS-178.
- The executable local fixture run covers the six foundation defects: type, lint, format, no-tests, coverage, and build.
- Security and container fixtures are represented in the same table-driven contract and validated as fail-closed workflow declarations/configuration cases. Implementing CodeQL/dependency/secret/license scanning and container build/scan/smoke enforcement remains OPS-184/OPS-185.
- Every negative fixture has exactly one intentional defect. The valid fixture is the control case.
- Checked-in fixtures are copied to temporary directories before commands run; tests must not mutate the repository or depend on network services.

### Task 1: Capture the red baseline and define fixture result types

**Files:**

- Create: `test/helpers/run-fixture.mjs`
- Create: `test/workflow-fixtures.test.mjs`
- Modify: `package.json`

**Step 1: Add the focused test command**

Add `test:workflow-fixtures` to invoke `node --test test/workflow-fixtures.test.mjs`.

**Step 2: Write the failing harness test**

Define a table-driven result shape containing fixture name, expected gate, exit code, normalized diagnostic, duration, and tracked-file mutation status. Start with the valid fixture entry so the test fails for the missing helper/fixture.

**Step 3: Run the red test**

Run `pnpm test:workflow-fixtures`.

Expected: FAIL because the runner and valid fixture do not exist.

**Step 4: Commit the red test contract**

```bash
git add package.json test/workflow-fixtures.test.mjs
git commit -m "test: define workflow fixture result contract"
```

### Task 2: Implement the isolated fixture runner and valid control

**Files:**

- Create: `test/helpers/run-fixture.mjs`
- Create: `test/fixtures/workflows/valid/package.json`
- Create: `test/fixtures/workflows/valid/src/index.ts`
- Create: `test/fixtures/workflows/valid/test/index.test.mjs`
- Modify: `test/workflow-fixtures.test.mjs`

**Step 1: Implement temporary-copy execution**

Copy a named fixture into a fresh temporary directory, run the requested script with `spawn` and an argument array, set `CI=true`, enforce a 60-second timeout, and return exit code, stdout, stderr, duration, and the temporary path. Allow only stable runtime variables plus the fixture-specific variables required by the test.

**Step 2: Add the valid fixture scripts**

Expose `format:check`, `lint:check`, `type:check`, `test`, `test:coverage`, `build`, and `quality:check` in the same order as `quality-script-contract.json`. Keep the source and test minimal and deterministic; configure coverage so the fixture can pass without broad exclusions.

**Step 3: Assert the valid control**

Require exit code zero, all expected reports/artifacts, a stable normalized result, and no changed tracked files in `gh-action-templates`.

**Step 4: Run the focused test**

Run `pnpm test:workflow-fixtures`.

Expected: PASS for the valid control.

**Step 5: Commit the control fixture**

```bash
git add test/helpers/run-fixture.mjs test/fixtures/workflows/valid test/workflow-fixtures.test.mjs
git commit -m "test: add isolated valid workflow fixture"
```

### Task 3: Add the six foundation negative fixtures

**Files:**

- Create: `test/fixtures/workflows/type-error/**`
- Create: `test/fixtures/workflows/lint-error/**`
- Create: `test/fixtures/workflows/format-drift/**`
- Create: `test/fixtures/workflows/no-tests/**`
- Create: `test/fixtures/workflows/coverage-gap/**`
- Create: `test/fixtures/workflows/build-error/**`
- Modify: `test/workflow-fixtures.test.mjs`

**Step 1: Add red table-driven assertions**

For each fixture require a non-zero exit, the expected canonical gate, and an actionable diagnostic. Require the valid fixture to remain green.

**Step 2: Create one-defect fixture variants**

Derive each fixture from the valid control with only one change: a TypeScript diagnostic, lint violation, formatting drift, absent test discovery, uncovered executable branch, or build-only failure. Do not use ignored errors, `--passWithNoTests`, forced exits, retries, or network-dependent tools to manufacture failures.

**Step 3: Verify failure classification**

Run `pnpm test:workflow-fixtures` three times.

Expected: the valid case passes and all six negative cases fail consistently at their declared gate.

**Step 4: Commit the foundation fixtures**

```bash
git add test/fixtures/workflows test/workflow-fixtures.test.mjs
git commit -m "test: prove foundation workflow failure modes"
```

### Task 4: Add security and container contract fixtures

**Files:**

- Create: `test/fixtures/workflows/security-error/**`
- Create: `test/fixtures/workflows/container-error/**`
- Create: `test/workflow-contract.test.mjs`
- Modify: `test/workflow-fixtures.test.mjs`
- Modify: `.github/workflows/lint-and-test.yml`

**Step 1: Define the two deferred-gate fixtures**

Represent a security defect (for example, an unpinned action or broad workflow permission) and a container defect (for example, root image execution or missing health behavior) as minimal workflow/container inputs. Keep them data-driven so OPS-184 and OPS-185 can attach real scanner/image commands later.

**Step 2: Add fail-closed static assertions**

Require security/container fixture inputs to be rejected by the contract test when the corresponding required declaration is absent or invalid. Assert stable classifications `security` and `container`, actionable diagnostics, and no silent success.

**Step 3: Run the contract tests**

Run `pnpm test:workflow-contract` and `pnpm test:workflow-fixtures`.

Expected: PASS for the valid contract and all eight intended negative classifications.

**Step 4: Commit the deferred-gate contract**

```bash
git add test/fixtures/workflows/security-error test/fixtures/workflows/container-error test/workflow-contract.test.mjs test/workflow-fixtures.test.mjs .github/workflows/lint-and-test.yml
git commit -m "test: define security and container fixture contracts"
```

### Task 5: Verify reusable workflow wiring and fail-closed behavior

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `test/workflow-contract.test.mjs`
- Modify: `package.json`

**Step 1: Assert workflow structure**

Parse the reusable workflow and require named steps for install, format, lint, types, unit, coverage, and build. Require `workflow_call`, supported package-manager input handling, and explicit security/container extension points. Reject `continue-on-error`, `|| true`, mutable action/workflow references, fix/write flags, and missing required commands.

**Step 2: Wire canonical check-only commands**

Use the OPS-178 command names, one separately named step per gate, and the OPS-176/OPS-177 setup/authentication contract. Keep security and container steps absent only where the documented M1 extension-point contract explicitly marks them as later-gate owners; a missing required declaration must fail the contract test rather than pass.

**Step 3: Validate syntax and behavior**

Run:

```bash
pnpm test
pnpm test:workflow-contract
pnpm test:workflow-fixtures
actionlint .github/workflows/*.yml
```

Expected: all Node tests and actionlint pass; repeated fixture runs produce the same gate classifications.

**Step 4: Commit workflow wiring**

```bash
git add .github/workflows/lint-and-test.yml test/workflow-contract.test.mjs package.json
git commit -m "ci: enforce workflow fixture contract"
```

### Task 6: Document reproduction and evidence

**Files:**

- Create: `docs/testing/workflow-fixtures.md`
- Modify: `docs/architecture/quality-baseline.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/tasks/OPS-179-workflow-contract-fixtures.md`

**Step 1: Document fixture anatomy**

Record the valid control, single-defect rule, gate classification format, environment isolation, timeout, report expectations, and how OPS-180 through OPS-185 extend the suite.

**Step 2: Record the scope boundary**

State clearly that M1 proves security/container contract inputs fail closed while OPS-184/OPS-185 implement the actual scanners and image gates.

**Step 3: Run final evidence checks**

Run `pnpm test`, `pnpm test:workflow-fixtures` three times, `actionlint .github/workflows/*.yml`, and `git status --short` after the checks.

Expected: green tests, stable classifications, valid workflow syntax, and no tracked-file mutation.

**Step 4: Commit documentation**

```bash
git add docs/testing/workflow-fixtures.md docs/architecture/quality-baseline.md docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/tasks/OPS-179-workflow-contract-fixtures.md
git commit -m "docs: record workflow fixture evidence"
```

## Definition of done

- One valid fixture passes all foundation checks.
- Type, lint, format, no-test, coverage, and build defects fail their intended gates.
- Security and container defects are covered by explicit fail-closed contract fixtures, with implementation ownership preserved for OPS-184/OPS-185.
- Fixture execution is isolated, bounded, deterministic, and non-mutating.
- Workflow commands are canonical, separately reported, and cannot ignore failures.
- Reproduction commands and evidence requirements are documented.

