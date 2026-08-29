# OPS-178 Check-Only Quality Scripts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give all seven product repositories the same truthful, non-mutating quality-script interface for local development and required CI checks.

**Architecture:** Define the canonical script names as a versioned contract in `gh-action-templates`, validate every consumer manifest with table-driven tests, and migrate repositories in small commits. Developer convenience commands may remain mutating, but required `*:check` and CI commands must never fix files, hide missing tests, force process exit, or use placeholders.

**Tech Stack:** package.json scripts, pnpm/npm, ESLint, Prettier, TypeScript, Jest, Vitest, Next.js, GitHub Actions, Node test runner.

---

## Scope and sequencing

- Linear issue: `OPS-178` (urgent, estimate L, due 2026-09-06).
- Central repository: `gh-action-templates`.
- Consumers: `cerberus`, `hermes`, `notify`, `server-utils`, `commons`, `cache`, and `web-app`.
- Consume the runtime/package-manager decision from `OPS-176`.
- This task standardizes command names and truthful exit behavior. It does not create missing test suites (`OPS-190`, `OPS-202`, `OPS-217`, and `OPS-228`) or implement the full reusable gate workflow (`OPS-189`).
- A repository with no tests must fail its required test command until its owned test-harness issue lands; never preserve green placeholders.

### Task 1: Codify the canonical script contract

**Files:**

- Create: `quality-script-contract.json`
- Create: `test/quality-script-contract.test.mjs`
- Modify: `package.json`
- Create: `docs/quality-gates/script-contract.md`

**Step 1: Define the required interface**

Document these required check-only commands:

```text
format:check
lint:check
type:check
test
test:coverage
build
quality:check
```

`quality:check` must invoke the first six in a documented fail-fast order. Mutating commands such as `format` and `lint:fix` are optional and must never be called from `quality:check` or required CI.

**Step 2: Write the failing table-driven contract test**

Load all seven manifests and assert every required key exists. Inspect the full command graph recursively and reject:

```text
--fix
--write
--passWithNoTests
--forceExit
|| true
exit 0
echo "Error: no test specified"
```

Also reject self-recursion, missing referenced scripts, and `quality:check` paths that omit a required command.

**Step 3: Add the focused runner**

Extend the central manifest:

```json
{
  "scripts": {
    "test:quality-script-contract": "node --test test/quality-script-contract.test.mjs"
  }
}
```

**Step 4: Run and record the red baseline**

Run:

```bash
cd gh-action-templates
pnpm test:quality-script-contract
```

Expected: FAIL for the six Vitest `--passWithNoTests` patterns, Cerberus `--forceExit`, Hermes' placeholder test, missing web application check scripts, and absent `quality:check` commands.

**Step 5: Commit the red contract**

```bash
git add package.json quality-script-contract.json test/quality-script-contract.test.mjs docs/quality-gates/script-contract.md
git commit -m "test: define the quality script contract"
```

### Task 2: Normalize the shared libraries

**Files:**

- Modify: `../commons/package.json`
- Modify: `../cache/package.json`
- Modify: `../server-utils/package.json`
- Modify: `../notify/package.json`
- Modify: corresponding lockfiles only if script execution requires metadata changes

**Step 1: Add repository-specific expected commands**

In the contract fixture, require Prettier check mode, ESLint without `--fix`, `tsc --noEmit`, Vitest without `--passWithNoTests`, coverage, and the existing build command. Require `quality:check` to compose scripts by name rather than duplicate tool flags.

**Step 2: Run the focused test**

Expected: FAIL on missing `quality:check` and pass-with-no-tests behavior.

**Step 3: Make check paths non-mutating and truthful**

Keep `format` as an optional writer. Rename mutating lint convenience to `lint:fix` if retained. Ensure:

```json
{
  "scripts": {
    "format:check": "prettier \"src/**/*.ts\" --check",
    "lint:check": "eslint src --ext .ts",
    "type:check": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "quality:check": "pnpm format:check && pnpm lint:check && pnpm type:check && pnpm test && pnpm test:coverage && pnpm build"
  }
}
```

Preserve repository-specific glob/config arguments when needed; the invariant is behavior, not byte-for-byte command equality.

**Step 4: Run each command in each repository**

Run `pnpm format:check`, `pnpm lint:check`, `pnpm type:check`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, and `pnpm quality:check` separately.

Expected: check commands never modify tracked files. Missing-test failures in owned follow-up work are recorded honestly and are not bypassed.

**Step 5: Commit one repository at a time**

```bash
git add package.json <lockfile-if-changed>
git commit -m "build: standardize check-only quality scripts"
```

### Task 3: Normalize Cerberus and Hermes without hiding harness gaps

**Files:**

- Modify: `../cerberus/package.json`
- Modify: `../hermes/package.json`
- Modify: corresponding lockfiles only when required

**Step 1: Add negative assertions for process and placeholder escapes**

Require Cerberus test scripts to omit `--forceExit` and `--passWithNoTests`. Require Hermes to run a real configured test runner and fail when no tests exist; reject echo-only scripts regardless of exit code.

**Step 2: Run the contract test**

Expected: FAIL on Cerberus' forced exit and Hermes' placeholder success.

**Step 3: Update Cerberus scripts**

Keep `--detectOpenHandles` temporarily only if it is useful diagnostic output and does not change success semantics. Remove `--forceExit` and `--passWithNoTests`, preserve `test:coverage`, and add the canonical orchestration command.

**Step 4: Update Hermes scripts**

Wire `test` and `test:coverage` to the runner selected by `OPS-217`. If that harness is not yet merged, use a deliberate failing preflight that names `OPS-217`; do not add a fake passing test or `exit 0`. Add all other check-only scripts now.

**Step 5: Verify file immutability**

Before and after each check, run `git status --short`. Expected: format, lint, type, test, and coverage checks create only ignored build/report artifacts and do not edit tracked source.

**Step 6: Commit separately in Cerberus and Hermes**

Use `build: standardize check-only quality scripts` in each repository.

### Task 4: Define the web application contract

**Files:**

- Modify: `../web-app/package.json`
- Create or modify: `../web-app/.prettierignore`
- Modify: `test/quality-script-contract.test.mjs`

**Step 1: Assert the web-specific script surface**

Require `format:check`, `lint:check`, `type:check`, `test`, `test:coverage`, `build`, and `quality:check`. Do not treat `next lint` as a formatter or type checker. The test commands must point to the harness owned by `OPS-228` and must fail truthfully when that harness is absent.

**Step 2: Run the focused test**

Expected: FAIL because the current manifest exposes only `build`, `dev`, `lint`, and `start`.

**Step 3: Add non-mutating commands**

Use Prettier check mode, `tsc --noEmit`, and the Next-compatible ESLint command selected by the installed framework version. Wire test commands to `OPS-228`; if unavailable, use an actionable failing preflight rather than a placeholder success.

**Step 4: Run all commands**

Use the package manager fixed by `OPS-176`. Expected: commands that have an implemented harness pass without modifying tracked files; absent test harnesses fail with an explicit `OPS-228` dependency.

**Step 5: Commit**

```bash
git add package.json .prettierignore <lockfile-if-changed>
git commit -m "build: add the web quality script contract"
```

### Task 5: Make reusable CI call only the canonical interface

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `test/quality-script-contract.test.mjs`
- Modify: `docs/quality-gates/script-contract.md`

**Step 1: Add workflow graph assertions**

Assert the reusable workflow invokes check-only script names, never raw mutating flags, and includes format, lint, type, test, coverage, and build. Assert no required step has `continue-on-error`, `|| true`, or an ignored exit code.

**Step 2: Run the test**

Expected: FAIL because the current workflow omits format, coverage, and build.

**Step 3: Replace ad hoc workflow commands**

Invoke the canonical script interface. Prefer separate named steps for readable failure reporting while retaining the same contract as `quality:check`:

```yaml
- run: pnpm format:check
- run: pnpm lint:check
- run: pnpm type:check
- run: pnpm test
- run: pnpm test:coverage
- run: pnpm build
```

Use the package-manager command established by `OPS-176`; do not hard-code pnpm for an approved npm-only exception.

**Step 4: Run central validation**

```bash
pnpm test:quality-script-contract
actionlint .github/workflows/lint-and-test.yml
```

Expected: PASS for contract structure and workflow syntax.

**Step 5: Run negative fixtures**

Temporarily inject each forbidden pattern into an in-memory fixture and prove the contract test fails with the repository, script, and offending token in its message. Never rewrite actual consumer manifests for negative testing.

**Step 6: Commit**

```bash
git add .github/workflows/lint-and-test.yml test/quality-script-contract.test.mjs docs/quality-gates/script-contract.md
git commit -m "ci: execute the canonical quality script contract"
```

## Completion checklist

- All seven manifests expose the required names.
- Required check paths contain no fix/write flag, placeholder, forced exit, or pass-with-no-tests behavior.
- Every script references an installed tool or an explicit owned blocking issue.
- Check commands do not mutate tracked files.
- Central contract tests include positive and negative cases.
- The reusable workflow runs the same interface used locally.
- Known harness gaps remain visible and linked to `OPS-190`, `OPS-217`, or `OPS-228`.
- Evidence is linked back to `OPS-178`.

