# Quality Gates and Test Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build truthful, secure, reproducible quality gates across all Apart repositories and establish the test harnesses required to reach 100% executable-code coverage before refactoring.

**Architecture:** `gh-action-templates` provides immutable, least-privilege reusable workflows with stable required-check names. Each repository owns a uniform script contract and its test configuration, while the central workflows orchestrate installation, static analysis, coverage ratcheting, integration services, security checks, and artifacts. Enforcement starts with 100% changed-code coverage and a non-decreasing global ratchet, then reaches 100% global/per-file coverage before refactoring authorization.

**Tech Stack:** GitHub Actions, Node.js supported LTS, pnpm/npm frozen lockfiles, TypeScript, ESLint, Prettier, Vitest/Jest, React Testing Library, MSW, Playwright, Testcontainers, PostgreSQL, Redis, Kafka-compatible broker, Mailpit, CodeQL, dependency review, actionlint, ShellCheck, workflow security analysis, container scanning, SBOM and artifact attestations.

---

## Preconditions

- Execute each repository change in its own feature branch/worktree.
- Do not combine dependency modernization with test characterization unless required to make the harness run.
- Preserve the existing lockfile package manager per repository until the package-manager ADR is accepted.
- Commit after each green task. The command examples below assume the workspace root is `/home/otedesco/Code/Personal/apart`.

### Task 1: Record runtime and package-manager decision

**Files:**
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/ADR-001-quality-gates-ci-foundation.md`
- Modify: `.github/actions/setup-environment/action.yml`
- Modify: every product repository's `package.json`

**Step 1: Write the decision test**

Create a workflow-fixture assertion that reads all package manifests and fails when their `engines.node` and `packageManager` declarations do not match the ADR.

**Step 2: Run it to verify it fails**

Run: `pnpm test:fixtures -- runtime-contract`

Expected: FAIL listing all manifests without the required declarations.

**Step 3: Write the ADR and minimal declarations**

Amend the existing project ADR at `docs/projects/PRJ-001-quality-gates-ci-foundation/ADR-001-quality-gates-ci-foundation.md` with the currently supported Node LTS, exact package-manager versions, upgrade cadence, and rollback plan. Do not create a second ADR. Add `engines` and `packageManager` to each manifest and update setup defaults.

**Step 4: Run the fixture and each repository type/build check**

Run: `pnpm test:fixtures -- runtime-contract` and each repository's frozen install, `type:check`, and `build` command.

Expected: PASS on the selected runtime with no lockfile changes.

**Step 5: Commit**

```bash
git add docs/projects/PRJ-001-quality-gates-ci-foundation/ADR-001-quality-gates-ci-foundation.md .github/actions/setup-environment/action.yml
git commit -m "docs: define supported Node and package managers"
```

### Task 2: Add a reusable-workflow fixture repository

**Files:**
- Create: `fixtures/node-library/package.json`
- Create: `fixtures/node-library/src/index.ts`
- Create: `fixtures/node-library/src/index.spec.ts`
- Create: `fixtures/node-library/tsconfig.json`
- Create: `fixtures/node-library/.eslintrc.json`
- Create: `fixtures/node-library/vitest.config.ts`
- Create: `scripts/test-workflow-contracts.mjs`
- Modify: `package.json` in `gh-action-templates` (create if absent)

**Step 1: Write failing fixture assertions**

Assert that a valid fixture passes and variants with a type error, lint warning, missing test, uncovered branch, and build error each fail the intended named gate.

**Step 2: Run the fixture harness**

Run: `pnpm test:fixtures`

Expected: FAIL because no reusable gate implementation exposes the expected checks.

**Step 3: Implement the smallest local workflow-contract harness**

The harness must execute repository scripts without rewriting fixture source and return the failing gate name.

**Step 4: Run all fixture cases**

Run: `pnpm test:fixtures`

Expected: PASS, proving both positive and negative fixtures behave as declared.

**Step 5: Commit**

```bash
git add fixtures scripts package.json pnpm-lock.yaml
git commit -m "test: add reusable workflow contract fixtures"
```

### Task 3: Fix private registry authentication contract

**Files:**
- Modify: `.github/actions/setup-environment/action.yml`
- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `.github/workflows/release-package.yml`
- Modify: `.github/workflows/release-docker-image.yml`
- Test: `fixtures/registry-auth/*`

**Step 1: Add a redaction-safe failing fixture**

Test missing token, present token, npm consumer, pnpm consumer, and log redaction. Never print the token value.

**Step 2: Verify the current action fails**

Run: `pnpm test:fixtures -- registry-auth`

Expected: FAIL because the action reads undeclared `inputs.npm_token` and product installs receive no authorization header.

**Step 3: Implement explicit token input and scoped registry configuration**

Declare the input, write registry configuration only for the job, verify authentication before installation, and remove temporary credentials in an always-running cleanup step.

**Step 4: Run fixture and clean-checkout installs**

Run: `pnpm test:fixtures -- registry-auth`, then frozen installs in Cerberus, Hermes, and Notify.

Expected: PASS without token text in logs or lockfile drift.

**Step 5: Commit**

```bash
git add .github fixtures/registry-auth
git commit -m "fix: make private registry authentication explicit"
```

### Task 4: Establish the repository script contract

**Files:**
- Modify: `../web-app/package.json`
- Modify: `../cerberus/package.json`
- Modify: `../hermes/package.json`
- Modify: `../cache/package.json`
- Modify: `../notify/package.json`
- Modify: `../commons/package.json`
- Modify: `../server-utils/package.json`
- Test: `scripts/validate-repository-scripts.mjs`

**Step 1: Write the manifest contract test**

Require `format:check`, `type:check`, `lint:check`, `test:unit`, `test:coverage`, `test:integration`, `test:contract`, `build`, and `quality`. Reject `--fix`, write mode, `--passWithNoTests`, placeholder echo commands, and absent scripts.

**Step 2: Verify it fails against the current repositories**

Run: `node scripts/validate-repository-scripts.mjs ../web-app ../cerberus ../hermes ../cache ../notify ../commons ../server-utils`

Expected: FAIL with repository-specific missing/unsafe scripts.

**Step 3: Add check-only scripts**

Scripts may initially call a truthful pending-suite guard, but must never return success when no test suite exists.

**Step 4: Re-run the contract test**

Expected: PASS for all seven manifests.

**Step 5: Commit once per repository**

Use: `chore: standardize quality scripts`.

### Task 5: Configure truthful coverage in shared libraries

**Files:**
- Create: `../cache/vitest.config.ts`
- Create: `../commons/vitest.config.ts`
- Modify: `../server-utils/vitest.config.ts` (create if absent)
- Modify: the three package manifests and lockfiles

**Step 1: Add a deliberately unimported executable fixture source**

Verify coverage includes the file and fails all four thresholds.

**Step 2: Run coverage before configuration**

Run: `pnpm test:coverage` in each repository.

Expected: Cache/Commons fail for missing provider; Server Utils reports less than 100% and an unhandled error.

**Step 3: Configure explicit source inclusion and reports**

Include all executable `src/**/*.ts`, exclude only type-only/test/generated files with reasons, emit text/json-summary/lcov/Cobertura, and configure the current ratchet values plus 100% changed-code enforcement.

**Step 4: Verify uncovered files and branches fail**

Run the negative fixture, then remove it and run the real suite.

Expected: Negative fixture FAIL; real command reports accurate baseline without missing-provider errors.

**Step 5: Commit once per repository**

Use: `test: configure truthful coverage reporting`.

### Task 6: Add the web test harness

**Files:**
- Create: `../web-app/vitest.config.ts`
- Create: `../web-app/src/test/setup.ts`
- Create: `../web-app/src/test/render.tsx`
- Create: `../web-app/src/test/server.ts`
- Create: `../web-app/src/lib/utils.spec.ts`
- Modify: `../web-app/package.json`
- Modify: `../web-app/package-lock.json`

**Step 1: Write a failing utility behavior test**

Cover normal, empty, falsey, and class-conflict behavior in `src/lib/utils.ts`.

**Step 2: Run the test**

Run: `npm run test:unit -- src/lib/utils.spec.ts`

Expected: FAIL because no test runner/harness exists.

**Step 3: Install and configure Vitest, jsdom, Testing Library, user-event, jest-dom, MSW, and axe integration**

Provide deterministic mocks for Next navigation, internationalization, browser storage, ResizeObserver, and matchMedia only in shared test setup.

**Step 4: Run unit and coverage commands**

Expected: Utility test PASS; coverage accurately reports all other source as uncovered.

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test src/lib/utils.spec.ts
git commit -m "test: establish web unit and component harness"
```

### Task 7: Make Cerberus tests deterministic and truthful

**Files:**
- Modify: `../cerberus/jest.config.js` or replace through an accepted runner ADR
- Create: `../cerberus/src/test/setup.ts`
- Create: `../cerberus/src/test/factories/*`
- Create: `../cerberus/src/handlers/ResponseHandler.spec.ts`
- Modify: `../cerberus/package.json`

**Step 1: Write failing response/error tests**

Cover success, empty/not-found, custom not-found handler, default response, and create status behavior.

**Step 2: Run the isolated test**

Expected: FAIL until aliases, setup, and private packages resolve in a clean install.

**Step 3: Configure source-inclusive coverage and deterministic setup**

Remove `--forceExit`, `--detectOpenHandles` as a substitute for cleanup, and `--passWithNoTests`. Include test TypeScript in type checking.

**Step 4: Run test, type, and coverage checks**

Expected: Tests PASS with no open handles; uncovered source is visible in the report.

**Step 5: Commit**

Use: `test: establish Cerberus characterization harness`.

### Task 8: Add Notify and Hermes harnesses

**Files:**
- Create: `../notify/vitest.config.ts`
- Create: `../notify/src/test/setup.ts`
- Create: `../notify/src/Producer.spec.ts`
- Create: `../hermes/vitest.config.ts`
- Create: `../hermes/src/test/setup.ts`
- Create: `../hermes/src/components/HTTPServerRouter.spec.ts`
- Modify: both package manifests and lockfiles

**Step 1: Write failing provider-selection and event-route tests**

Test enabled/disabled publication, unsupported provider, malformed envelope, handler success, and handler failure.

**Step 2: Run each isolated suite**

Expected: FAIL because Notify has no installed harness and Hermes has a placeholder command.

**Step 3: Configure Vitest and inject provider/handler boundaries**

Do not connect to real brokers in unit tests. Preserve integration behavior for the later broker suite.

**Step 4: Run tests and coverage**

Expected: Initial tests PASS, all remaining executable source appears uncovered.

**Step 5: Commit once per repository**

Use: `test: establish messaging test harness`.

### Task 9: Fix Server Utils false-positive test behavior

**Files:**
- Modify: `../server-utils/src/__tests__/AppFactory.spec.ts`
- Modify: `../server-utils/src/__tests__/LoggerFactory.spec.ts`
- Create: `../server-utils/src/test/leaked-handles.spec.ts`

**Step 1: Add a test asserting no real fixed-port listener is created**

Spy at the correct boundary and assert listener cleanup/close behavior.

**Step 2: Run current suite**

Expected: FAIL with the current unhandled `listen` error or leaked handle.

**Step 3: Correct the tests and minimal lifecycle seam**

Use an ephemeral port or in-memory app and await lifecycle callbacks. Do not hide errors with process flags.

**Step 4: Run tests, coverage, formatting, and lint with zero warnings**

Expected: PASS with no stderr fallback, unhandled errors, skipped test, formatting drift, or lint warning.

**Step 5: Commit**

Use: `test: make app lifecycle tests deterministic`.

### Task 10: Implement changed-code coverage and global ratchet

**Files:**
- Create: `.github/actions/coverage-gate/action.yml`
- Create: `.github/actions/coverage-gate/index.mjs`
- Create: `.github/actions/coverage-gate/index.spec.mjs`
- Create: `config/coverage-baselines.json`

**Step 1: Write gate tests**

Cover 100% changed lines, uncovered changed branch, global decrease, global increase, deleted lines, renames, no executable change, shallow history, and malformed report.

**Step 2: Run tests**

Expected: FAIL because the gate does not exist.

**Step 3: Implement report parsing and merge-base comparison**

Fail closed when history or reports are insufficient. Baseline updates require an explicit reviewed file change and may only increase.

**Step 4: Run unit and fixture tests**

Expected: All cases PASS, including deliberate gate failures.

**Step 5: Commit**

Use: `feat: add changed coverage and global ratchet gate`.

### Task 11: Replace the reusable PR workflow

**Files:**
- Replace: `.github/workflows/lint-and-test.yml`
- Create: `.github/workflows/quality.yml`
- Modify: product `.github/workflows/quality-checks.yml` files

**Step 1: Extend workflow fixtures for stable check names**

Assert install, format, types, lint, unit, coverage, build, integration, contract, security, container, and E2E job names plus dependency ordering.

**Step 2: Run fixture tests**

Expected: FAIL against the current single `lint-and-test` job.

**Step 3: Implement least-privilege parallel jobs**

Set explicit permissions, concurrency cancellation, immutable references, explicit secrets, timeouts, artifact retention, and deterministic install caching keyed by lockfile/runtime.

**Step 4: Run actionlint, workflow security analysis, and fixture tests**

Expected: PASS with no unpinned actions or excessive permissions.

**Step 5: Commit**

Use: `ci: replace quality workflow with enforceable gates`.

### Task 12: Add supply-chain and source security gates

**Files:**
- Create: `.github/workflows/codeql.yml`
- Create: `.github/workflows/dependency-review.yml`
- Create: `.github/workflows/secret-scan.yml`
- Create: `.github/workflows/workflow-security.yml`
- Create: `docs/quality-gates/security-exceptions.md`

**Step 1: Add negative fixtures**

Include a fake secret marker, vulnerable fixture dependency, unsafe interpolation, excessive token permission, and unpinned action.

**Step 2: Run the scanners**

Expected: Each fixture fails its intended scanner.

**Step 3: Configure required scans and exception schema**

Block unapproved critical/high findings and expired exceptions; publish SARIF where supported.

**Step 4: Remove negative fixtures from the passing fixture and rerun**

Expected: Valid fixture PASS; each isolated negative fixture FAIL.

**Step 5: Commit**

Use: `ci: add source and supply chain security gates`.

### Task 13: Add container build, scan, smoke, SBOM, and provenance gates

**Files:**
- Modify: `.github/workflows/release-docker-image.yml`
- Create: `.github/workflows/container-quality.yml`
- Create: `fixtures/container/*`
- Modify: `../cerberus/Dockerfile`
- Modify: `../hermes/Dockerfile`
- Modify: `../hermes/Dockerfile.worker`

**Step 1: Add container fixture assertions**

Test supported runtime, non-root execution, deterministic startup, health behavior, no embedded registry credentials, critical/high scan policy, and expected entrypoint.

**Step 2: Build current product images**

Expected: The gate identifies EOL runtime and any policy failures without publishing images.

**Step 3: Implement build-once verification and release provenance**

Generate SBOM and attestation, scan before push, and publish only the verified digest.

**Step 4: Run fixture and product image smoke tests**

Expected: PASS on accepted images; deliberately unsafe fixture FAIL.

**Step 5: Commit in central and affected repositories**

Use: `ci: verify container artifacts before release`.

### Task 14: Add integration service harness

**Files:**
- Create: `../cerberus/src/test/integration/environment.ts`
- Create: `../notify/src/test/integration/environment.ts`
- Create: `../hermes/src/test/integration/environment.ts`
- Create: `../web-app/e2e/compose.yml` or an accepted Testcontainers orchestration equivalent
- Create: `docs/testing/local-test-environment.md`

**Step 1: Write environment smoke tests**

Assert disposable PostgreSQL, Redis, broker, and SMTP sink startup, health, isolation, and cleanup.

**Step 2: Run against no environment**

Expected: FAIL with actionable missing-container/runtime diagnostics.

**Step 3: Implement deterministic orchestration**

Use random host ports, health checks, per-run namespaces, seeded clocks/IDs, and always-running cleanup.

**Step 4: Run twice concurrently**

Expected: Both runs PASS without port/data collision or leaked resources.

**Step 5: Commit by repository**

Use: `test: add disposable integration environment`.

### Task 15: Configure repository rulesets and required checks

**Files:**
- Create: `docs/quality-gates/ruleset-configuration.md`
- Create: `config/required-checks.json`
- Create: `scripts/audit-repository-rulesets.mjs`

**Step 1: Write ruleset audit assertions**

Require pull requests, latest-base strictness, required check names, review/code-owner policy, no force push/deletion, admin enforcement, and audited bypass.

**Step 2: Audit current repositories**

Expected: FAIL because live rulesets are empty and branch-protection visibility requires administrator verification.

**Step 3: Apply rulesets through approved GitHub administration**

Use the documented configuration; do not weaken checks to make legacy branches green.

**Step 4: Re-run audit as an authorized administrator**

Expected: PASS for all eight repositories.

**Step 5: Commit documentation/config**

Use: `docs: define enforced repository rulesets`.

### Task 16: Publish baseline dashboards and exception automation

**Files:**
- Create: `.github/workflows/quality-report.yml`
- Create: `config/quality-exceptions.schema.json`
- Create: `scripts/validate-quality-exceptions.mjs`
- Create: `docs/quality-gates/operating-guide.md`

**Step 1: Add tests for valid, expired, ownerless, and overlong exceptions**

Expected: Invalid records FAIL with the exact remediation.

**Step 2: Generate current baseline report**

Expected: Report reflects zero-test repositories, coverage gaps, warning counts, security findings, and unavailable checks without presenting them as green.

**Step 3: Implement dashboard artifact and expiration enforcement**

Show trends without making an external dashboard a merge dependency.

**Step 4: Run report and schema tests**

Expected: PASS; expired fixture FAIL.

**Step 5: Commit**

Use: `ci: publish quality baseline and enforce exceptions`.

### Task 17: Prove the gate suite against every repository

**Files:**
- Modify: each repository's `.github/workflows/quality-checks.yml`
- Update: `config/coverage-baselines.json`
- Update: `docs/architecture/quality-baseline.md`

**Step 1: Open one adoption PR per repository**

No behavior refactor is allowed in these PRs beyond seams required for deterministic tests.

**Step 2: Verify deliberate failures**

On temporary commits, prove each required gate fails for its target condition, then remove the temporary defect.

**Step 3: Run the complete required suite**

Expected: Truthful results; uncovered legacy code remains visible and protected by the ratchet rather than hidden.

**Step 4: Record baselines and required-check URLs**

Only measured values are committed. Global thresholds may not be rounded upward.

**Step 5: Commit**

Use: `ci: adopt Apart quality gate contract` in each repository.

### Task 18: Begin characterization projects and close refactoring entry gate

**Files:**
- Follow: `docs/plans/linear-quality-program.md`
- Update: `docs/testing/testing-and-coverage-strategy.md`
- Create: `docs/decisions/0002-authentication-state.md`
- Create: `docs/decisions/0003-event-envelope-and-delivery.md`
- Create: `docs/decisions/0004-database-compatibility-target.md`

**Step 1: Execute characterization issues in dependency order**

Each production behavior change begins with a failing test and a separate reviewed decision where behavior is ambiguous.

**Step 2: Raise the ratchet after every merged test slice**

Expected: Threshold changes only increase and changed code remains at 100%.

**Step 3: Reach final coverage and mutation targets**

Run all unit, component, integration, contract, end-to-end, accessibility, security, resilience, performance, and mutation suites.

**Step 4: Run the stability campaign**

Expected: 100 consecutive green required-check executions with no hidden retry/quarantine.

**Step 5: Record architecture sign-off**

Refactoring is authorized only when every entry criterion in `docs/architecture/quality-baseline.md` is satisfied.

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-08-29-quality-gates-and-test-foundation.md`.

1. **Subagent-driven (this session):** execute one task/repository PR at a time with review between tasks.
2. **Parallel session:** open a dedicated worktree/session and execute this plan in batches with checkpoints.
