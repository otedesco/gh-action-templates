# OPS-176 Node LTS and Package-Manager Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the accepted Node.js and package-manager versions machine-verifiable and consistent across the shared action, workflows, seven consumer manifests, lockfiles, and service Dockerfiles.

**Architecture:** Keep the existing project ADR as the decision record and use `runtime-contract.json` plus the built-in Node test runner as the executable contract. Consumers declare exact metadata, CI uses the shared setup action defaults, and Dockerfiles activate the package manager through Corepack without embedding credentials in image layers.

**Tech Stack:** Node.js 24.20.0, pnpm 10.34.0, npm 10.8.2 for web-app, Corepack, GitHub Actions, Docker, Node test runner.

---

### Task 1: Establish the executable baseline

**Files:**
- Create: `gh-action-templates/docs/plans/2026-08-29-ops-176-runtime-contract.md`
- Review: `gh-action-templates/runtime-contract.json`
- Review: `gh-action-templates/test/runtime-contract.test.mjs`

**Step 1:** Run `pnpm test:runtime-contract` from `gh-action-templates` and capture failures.

**Step 2:** Inspect all consumer manifests, lockfiles, shared action, workflows, and service Dockerfiles against the accepted ADR values.

### Task 2: Complete the runtime contract implementation

**Files:**
- Modify: `gh-action-templates/test/runtime-contract.test.mjs`
- Modify: `gh-action-templates/.github/actions/setup-environment/action.yml`
- Modify: `gh-action-templates/.github/workflows/lint-and-test.yml`
- Modify: `gh-action-templates/.github/workflows/release-package.yml`
- Modify: `gh-action-templates/.github/workflows/release-docker-image.yml`
- Modify: `cerberus/Dockerfile`
- Modify: `hermes/Dockerfile`
- Modify: `hermes/Dockerfile.worker`

**Step 1:** Extend the contract test to verify exact lockfile package-manager metadata, deterministic Corepack activation, no legacy runtime values, no token build arguments, and exact Docker package-manager setup.

**Step 2:** Make the shared setup action authoritative through its defaults and fail closed on version reporting.

**Step 3:** Remove workflow-local runtime matrices and use the shared setup action without divergent version inputs.

**Step 4:** Update service Dockerfiles to use the accepted exact Node image and Corepack-managed pnpm with frozen installs.

### Task 3: Verify and record evidence

**Files:**
- Modify: `gh-action-templates/docs/projects/PRJ-001-quality-gates-ci-foundation/ADR-001-quality-gates-ci-foundation.md`

**Step 1:** Run the focused contract test, JSON/package validation, and available YAML/Docker syntax checks.

**Step 2:** Run frozen-lockfile install checks where dependencies and credentials permit; distinguish environmental blockers from contract failures.

**Step 3:** Add deterministic evidence and any explicit dependency blocker to the ADR.
