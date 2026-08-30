# OPS-178 Check-Only Quality Scripts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give all seven product repositories one truthful, non-mutating quality-script interface for local development and CI.

**Architecture:** Define the script names and forbidden command patterns in a central JSON contract and Node test. Consumer manifests compose existing repository tools by script name; missing test harnesses fail explicitly with their owning issue rather than passing through placeholders. The reusable lint workflow invokes each canonical check separately for clear failure reporting.

**Tech Stack:** package.json scripts, pnpm/npm, ESLint, Prettier, TypeScript, Jest, Vitest, Next.js, Node test runner.

---

### Task 1: Add the executable script contract

**Files:**
- Create: `gh-action-templates/quality-script-contract.json`
- Create: `gh-action-templates/test/quality-script-contract.test.mjs`
- Create: `gh-action-templates/docs/quality-gates/script-contract.md`
- Modify: `gh-action-templates/package.json`

**Steps:**

1. Define required script names and repository-specific test-harness ownership.
2. Add table-driven tests for script presence, forbidden flags, references, self-recursion, and required quality orchestration.
3. Run the contract test to capture the current red baseline.

### Task 2: Normalize library and service manifests

**Files:**
- Modify: `commons/package.json`
- Modify: `cache/package.json`
- Modify: `server-utils/package.json`
- Modify: `notify/package.json`
- Modify: `cerberus/package.json`
- Modify: `hermes/package.json`

**Steps:**

1. Add check-only format, lint, type, test, coverage, build, and quality scripts using installed tools.
2. Remove `--passWithNoTests`, `--forceExit`, and placeholder test success behavior.
3. Run contract tests and repository commands, recording honest existing test/harness failures.

### Task 3: Add the web-app interface

**Files:**
- Modify: `web-app/package.json`
- Create or modify: `web-app/.prettierignore`

**Steps:**

1. Add Prettier, ESLint, TypeScript, build, and explicit OPS-228 test/coverage blockers.
2. Add `quality:check` composition without mutating commands.
3. Run contract tests and web checks.

### Task 4: Make reusable CI invoke canonical checks

**Files:**
- Modify: `gh-action-templates/.github/workflows/lint-and-test.yml`
- Modify: `gh-action-templates/test/quality-script-contract.test.mjs`
- Modify: `gh-action-templates/docs/quality-gates/script-contract.md`

**Steps:**

1. Add workflow assertions for each canonical check and no ignored failures.
2. Replace ad hoc CI commands with separate format, lint, type, test, coverage, and build steps.
3. Run central contract tests and available syntax checks.

### Task 5: Record evidence and prepare review commits

**Files:**
- Modify: `gh-action-templates/docs/architecture/quality-baseline.md`

**Steps:**

1. Record passing structural checks and explicit harness blockers.
2. Verify tracked-file immutability and diff cleanliness after check commands.
3. Commit central and each changed consumer repository separately.
