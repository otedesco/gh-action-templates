# Truthful Core Quality Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make formatting, lint, type, unit, coverage, and build checks fail whenever they encounter the defects they claim to detect, across the shared workflow and all seven consumer repositories.

**Architecture:** Extend the OPS-179 fixture runner with one deterministic fixture per core failure mode, define a machine-readable gate policy, and validate every consumer command against that policy. Keep the reusable workflow’s six gates separately named and fail-closed; defer changed-code/global coverage ratcheting to OPS-181 and immutable references/permissions to OPS-182/183.

**Tech Stack:** Node.js 24.20.0, pnpm 10.34.0, npm 10.8.2, GitHub Actions, Node test runner, ESLint, Prettier, TypeScript, Jest, Vitest, actionlint.

---

## Scope and current context

- OPS-179 and its PR are complete and merged; reuse `test/helpers/run-fixture.mjs` and the existing valid/negative fixture contract.
- Work spans the central `gh-action-templates` repository and the seven consumer repositories: `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, and `web-app`.
- The six gates are `format`, `lint`, `type`, `unit`, `coverage`, and `build`.
- A required check must fail on warnings/drift, skipped or focused tests, unhandled errors, leaked handles, no tests, missing coverage providers, uncovered source, and build failures.
- Check-only commands may not use `--fix`, `--write`, `--passWithNoTests`, `--forceExit`, ignored exit codes, hidden retries, broad exclusions, or placeholder success.
- OPS-181 owns changed-code 100% coverage and the global ratchet. OPS-182 and OPS-183 own immutable references, permissions, and secret isolation.

### Task 1: Define the core-gate policy and validator

**Files:**

- Create: `quality-gates/core-gates.json`
- Create: `scripts/validate-core-gates.mjs`
- Create: `test/core-gates.test.mjs`
- Modify: `package.json`

**Step 1: Write the failing policy tests**

Require six unique gates with stable names, canonical command mappings, zero-warning/drift behavior, no-test prohibition, timeout, report expectations, and fail-closed handling. Add negative cases for duplicate gates, missing commands, ignored failures, and unsupported escape flags.

**Step 2: Run the focused test**

Run `pnpm run test:core-gates`.

Expected: FAIL because the policy and validator do not exist.

**Step 3: Add the machine-readable policy**

Represent each gate’s command, stable workflow check name, failure conditions, evidence paths, and allowed exception behavior. Keep the policy independent of any one consumer tool.

**Step 4: Implement the pure validator and CLI**

Return structured errors containing gate, repository, violated rule, and remediation. Exit non-zero for any invalid manifest, command graph, or policy input. Do not mutate manifests or baselines.

**Step 5: Run and commit**

Run `pnpm run test:core-gates` and expect PASS.

```bash
git add quality-gates/core-gates.json scripts/validate-core-gates.mjs test/core-gates.test.mjs package.json
git commit -m "test: define truthful core gate policy"
```

### Task 2: Expand the OPS-179 fixture suite for every truthful failure mode

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
- Modify: `docs/testing/workflow-fixtures.md`

**Step 1: Add red table entries**

For each fixture, assert the valid control remains green, the negative result is non-zero, exactly one gate is classified as failing, the diagnostic is actionable, and the run does not time out.

**Step 2: Build minimal one-defect fixtures**

Create one sentinel defect per fixture: warning output, focused test, skipped test, unhandled asynchronous error, open handle, absent coverage provider, source omitted from coverage, or changed build output. Do not manufacture failures with ignored errors or process-exit tricks.

**Step 3: Verify stability**

Run `pnpm run test:workflow-fixtures` three consecutive times. Expected: identical classifications, no timeout, and no central-repository mutation.

**Step 4: Commit**

```bash
git add test/fixtures/workflows test/workflow-fixtures.test.mjs docs/testing/workflow-fixtures.md
git commit -m "test: cover truthful core gate failures"
```

### Task 3: Make the reusable workflow enforce the truthful gate sequence

**Files:**

- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `test/workflow-contract.test.mjs`
- Modify: `quality-gates/core-gates.json`

**Step 1: Add red workflow assertions**

Require `workflow_call`, separate named steps for format, lint, type, unit, coverage, and build, zero-warning lint configuration, no test-suppression flags, and a final tracked-file drift check. Assert that evidence upload cannot convert a failed gate into success.

**Step 2: Run the contract test**

Run `pnpm run test:workflow-contract`.

Expected: FAIL against any missing policy or incomplete workflow behavior.

**Step 3: Implement the minimal workflow changes**

Invoke the canonical consumer scripts in policy order. Add explicit failure-sensitive reporting and a final `git diff --exit-code` check for generated tracked-file drift. Keep the existing registry-auth contract. Do not pin action references or redesign permissions in this issue; those belong to OPS-182/OPS-183.

**Step 4: Validate syntax and behavior**

Run:

```bash
pnpm run test:core-gates
pnpm run test:workflow-contract
pnpm run test:workflow-fixtures
actionlint .github/workflows/lint-and-test.yml
```

Expected: all tests and actionlint pass.

**Step 5: Commit**

```bash
git add .github/workflows/lint-and-test.yml test/workflow-contract.test.mjs quality-gates/core-gates.json
git commit -m "ci: enforce truthful core quality gates"
```

### Task 4: Make all seven consumer repositories prove truthful commands

**Files:**

- Modify: `../commons/package.json`, `../commons/pnpm-lock.yaml`
- Modify: `../cache/package.json`, `../cache/pnpm-lock.yaml`
- Modify: `../server-utils/package.json`, `../server-utils/pnpm-lock.yaml`
- Modify: `../notify/package.json`, `../notify/pnpm-lock.yaml`
- Modify: `../cerberus/package.json`, `../cerberus/pnpm-lock.yaml`, `../cerberus/jest.config.js`
- Modify: `../hermes/package.json`, `../hermes/pnpm-lock.yaml`
- Modify: `../web-app/package.json`, `../web-app/package-lock.json`, `../web-app/prettier.config.js`
- Modify: `test/core-gates.test.mjs`

**Step 1: Add manifest/config red tests**

Use the core-gate validator to reject missing coverage providers, warning-tolerant lint, formatter write mode, no-test success, skipped/focused test settings, broad source exclusions, and builds that do not produce the declared artifact.

**Step 2: Normalize each repository’s check-only commands**

Configure formatters to check only, lint to include the intended source/tests/configuration with zero warnings, TypeScript to include the relevant test/config files, test runners to fail on no/skipped/focused tests and unhandled errors, coverage to include all executable source and emit required reports, and build to run from clean source.

**Step 3: Keep explicit owned blockers truthful**

Retain actionable OPS-217 and OPS-228 failures where their harnesses are not yet implemented. They must fail rather than use placeholder success. Do not claim product behavior coverage in this issue.

**Step 4: Run commands with the contract runtime**

From each repository, run its package-manager-specific commands in order. Capture stdout/stderr, exit status, report paths, and before/after tracked-file status. Use sentinel credentials only where registry authentication is required.

**Step 5: Commit consumer changes separately**

Commit each repository’s manifest/config/lockfile changes independently so failures and rollbacks remain attributable.

### Task 5: Record evidence and update milestone documentation

**Files:**

- Modify: `docs/architecture/quality-baseline.md`
- Modify: `docs/quality-gates/gate-specification.md`
- Modify: `docs/testing/workflow-fixtures.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-002-core-gates-coverage-ratchet/tasks/OPS-180-truthful-core-quality-gates.md`

**Step 1: Document the final contract**

Record gate names, command order, failure conditions, report expectations, consumer-specific blockers, and the boundary with OPS-181 through OPS-183.

**Step 2: Run final evidence**

Run:

```bash
pnpm quality:check
pnpm run test:workflow-fixtures
pnpm run test:workflow-fixtures
pnpm run test:workflow-fixtures
actionlint .github/actions/setup-environment/action.yml .github/workflows/*.yml
git diff --check
```

Run the seven consumer suites using Node.js `24.20.0` and the package-manager versions in `runtime-contract.json`. Expected: valid checks pass, intended failures fail with owned diagnostics, no check-only command mutates tracked files, and no required evidence is missing.

**Step 3: Update Linear**

Link every implementation commit and CI run to OPS-180. Add a completion document/comment to the M2 milestone covering repository changes, consumer blockers, evidence, and remaining ownership.

**Step 4: Commit documentation**

```bash
git add docs/architecture/quality-baseline.md docs/quality-gates/gate-specification.md docs/testing/workflow-fixtures.md docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-002-core-gates-coverage-ratchet/tasks/OPS-180-truthful-core-quality-gates.md
git commit -m "docs: record truthful core gate evidence"
```

## Definition of done

- All six core gates have stable names, canonical commands, and fail-closed policy validation.
- Valid fixture repositories pass; every planned truthful negative fixture fails at its intended gate.
- Warnings, formatting drift, skipped/focused/no tests, unhandled errors, leaked handles, missing providers, uncovered source, and build drift cannot pass silently.
- All seven consumers expose truthful, non-mutating commands or explicit owned blockers.
- Required reports and generated-artifact drift are validated.
- Tests are deterministic across three repetitions and the repository remains unmutated by check-only commands.
- Documentation and Linear evidence identify all changes, limitations, and follow-up ownership.
