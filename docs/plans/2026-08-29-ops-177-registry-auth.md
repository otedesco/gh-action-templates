# OPS-177 Private Registry Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make private GitHub Packages installs fail fast without credentials, authenticate through explicit workflow secrets, and prevent token persistence or leakage in Docker and CI.

**Architecture:** Add a side-effect-free Node preflight helper to the shared setup action, invoke it only for workflows that require private registry access, and keep checked-in `.npmrc` files limited to registry mappings plus environment placeholders. Reusable workflows declare named secrets, consumer callers pass only the required secrets, and Docker uses required BuildKit secret mounts.

**Tech Stack:** Node.js 24.20.0, pnpm 10.34.0, GitHub Actions composite/reusable workflows, Node test runner, Docker BuildKit.

---

### Task 1: Add the registry-auth preflight contract

**Files:**
- Create: `.github/actions/setup-environment/registry-auth.mjs`
- Create: `test/registry-auth.test.mjs`
- Modify: `package.json`

**Steps:**

1. Write tests for missing, blank, valid, and redaction-safe tokens before implementation.
2. Implement `validateRegistryToken(token)` and a CLI that reads only `INPUT_NPM_TOKEN`, emits the exact actionable missing-token error through `::error`, and never prints or persists the token.
3. Add `test:registry-auth` using Node’s built-in test runner.
4. Run the focused suite and verify 100% helper coverage without a real credential.

### Task 2: Wire the shared action and reusable workflows

**Files:**
- Modify: `.github/actions/setup-environment/action.yml`
- Modify: `.github/workflows/lint-and-test.yml`
- Modify: `.github/workflows/release-package.yml`
- Modify: `test/registry-auth.test.mjs`

**Steps:**

1. Add contract assertions for named inputs, explicit workflow-call secrets, frozen installs, and absence of token-file mutation.
2. Add `npm-token` and `registry-auth-required` action inputs and run the preflight only when required.
3. Declare `NPM_TOKEN` and `GH_TOKEN` workflow-call secrets and pass them only to the steps that need them.
4. Remove `$HOME/.npmrc` generation and make all installs frozen.
5. Run focused tests and available workflow syntax checks.

### Task 3: Harden Docker secret consumption

**Files:**
- Modify: `.github/workflows/release-docker-image.yml`
- Modify: `../cerberus/Dockerfile`
- Modify: `../hermes/Dockerfile`
- Modify: `../hermes/Dockerfile.worker`
- Modify: `test/registry-auth.test.mjs`

**Steps:**

1. Add negative assertions against token build arguments, token echoes, and non-frozen installs.
2. Add a required BuildKit secret to the shared Docker workflow and a missing-secret preflight.
3. Require the secret mount in all three service Dockerfiles and keep the token process-local.
4. Run static contract checks and Docker installer-stage checks where credentials and the local Docker CLI permit.

### Task 4: Replace broad secret inheritance in consumers

**Files:**
- Modify: `cerberus/.github/workflows/*.yml`
- Modify: `hermes/.github/workflows/*.yml`
- Modify: `notify/.github/workflows/*.yml`
- Verify unchanged: consumer `.npmrc` and lockfiles

**Steps:**

1. Extend tests for explicit `NPM_TOKEN`/`GH_TOKEN` caller mappings and required auth flags.
2. Replace `secrets: inherit` with named secret maps in all relevant caller workflows.
3. Run repository workflow/static checks and frozen installs where authenticated access is available.

### Task 5: Record acceptance evidence

**Files:**
- Modify: `docs/architecture/quality-baseline.md`
- Modify: `test/registry-auth.test.mjs`

**Steps:**

1. Record passing preflight, install, and secret-leakage checks without credentials.
2. Document environmental/private-registry blockers explicitly.
3. Run final contract tests and diff checks, then commit each repository separately.
