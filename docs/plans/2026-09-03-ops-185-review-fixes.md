# OPS-185 Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining PR #30 security, evidence-integrity, and test-coverage findings before merging the container release workflow.

**Architecture:** Keep the reusable workflow build-once and digest-driven, but reject any image target other than the caller repository’s GHCR package before publication. Make the SBOM artifact an explicit SPDX JSON evidence contract bound to the requested image digest, validate that contract while building release evidence, and exercise the evidence scripts through exported unit tests and failure fixtures.

**Tech Stack:** GitHub Actions YAML, Node.js ESM, Node test runner, c8 coverage, pnpm.

---

### Task 1: Add failing workflow-contract assertions

**Files:**
- Modify: `test/container-workflow.test.mjs`

**Step 1:** Assert the workflow validates `image` against `ghcr.io/${GITHUB_REPOSITORY}` in both build and publish paths, and that the SBOM is wrapped with the expected digest contract.

**Step 2:** Run `pnpm test:container-workflow` and confirm the new assertions fail against the current workflow.

### Task 2: Add evidence validation tests

**Files:**
- Create: `test/container-evidence.test.mjs`
- Modify: `scripts/container/build-release-evidence.mjs`
- Modify: `scripts/container/verify-release-evidence.mjs`

**Step 1:** Export the evidence builder’s pure validation helpers without changing CLI behavior.

**Step 2:** Add tests for valid evidence, missing artifacts, checksum mismatch, malformed JSON, wrong digest, invalid SPDX/SBOM contract, invalid provenance, and failed job status.

**Step 3:** Run the new test file and confirm it fails before the implementation is complete.

### Task 3: Implement image and SBOM contracts

**Files:**
- Modify: `.github/workflows/release-docker-image.yml`
- Modify: `scripts/container/build-release-evidence.mjs`
- Modify: `scripts/container/verify-release-evidence.mjs`

**Step 1:** Add shell validation before build/login and before publish/login, rejecting image values that differ from `ghcr.io/${GITHUB_REPOSITORY}`.

**Step 2:** Generate an explicit SBOM evidence envelope containing the requested image, digest, SPDX format marker, and raw SPDX document; fail if the document is malformed or not SPDX JSON.

**Step 3:** Parse and validate the envelope in the evidence builder, derive the SBOM subject from its validated digest, and make the final validator re-check the envelope and digest.

### Task 4: Wire coverage and validate

**Files:**
- Modify: `package.json`

**Step 1:** Add a package script that runs the evidence tests under c8 with the changed executable modules included in coverage.

**Step 2:** Run focused workflow, evidence, contract, lint, formatting, and coverage commands.

**Step 3:** Run the complete test suite and inspect the final diff for accidental changes.
