# OPS-185 Container Release Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build each production container once, verify identity, startup, health, vulnerability policy, SBOM, and provenance, then publish only that verified digest.

**Architecture:** Extend the reusable Docker release workflow into separate build, verify, attest, and publish jobs connected by an immutable image digest. A local fixture harness validates Dockerfiles and runs disposable images; negative fixtures prove missing secrets, root identity, failed health, vulnerabilities, and absent attestations block publication.

**Tech Stack:** Docker BuildKit/buildx, GitHub Actions, Trivy, Syft or Docker SBOM, GitHub artifact attestations, Cosign verification, Node test runner, shellcheck/hadolint.

---

## Dependencies and scope

- Requires `OPS-177`, `OPS-182`, `OPS-183`, and the security exception contract from `OPS-184`.
- Covers Cerberus and both Hermes Dockerfiles; Notify is a package and has no production image in current scope.
- Do not change application runtime behavior or deployment infrastructure.

### Task 1: Define the container release contract

**Files:**

- Create: `quality-gates/container-policy.json`
- Create: `scripts/container/validate-contract.mjs`
- Create: `test/container-contract.test.mjs`
- Create: `test/fixtures/containers/{valid,root-user,no-healthcheck,token-arg}/**`
- Modify: `package.json`

**Step 1: Write failing contract tests**

Require an exact base-image policy, non-root runtime user, BuildKit secret use, frozen install, healthcheck, digest output, vulnerability threshold, SBOM, provenance, and no token-bearing ARG/ENV/layer.

**Step 2: Run `pnpm test:container-contract`**

Expected: FAIL on current workflow and Dockerfiles.

**Step 3: Implement static validation**

Report file, stage, violated rule, and remediation. Parse workflow configuration and Dockerfile instructions without executing interpolated content.

**Step 4: Verify and commit**

```bash
pnpm test:container-contract
git add quality-gates/container-policy.json scripts/container test/container-contract.test.mjs test/fixtures/containers package.json
git commit -m "test: define container release contract"
```

### Task 2: Make product images satisfy runtime and secret policy

**Files:**

- Modify: `../cerberus/Dockerfile`
- Modify: `../hermes/Dockerfile`
- Modify: `../hermes/Dockerfile.worker`
- Modify: product `.dockerignore` files
- Modify: `test/container-contract.test.mjs`

**Step 1: Add red product assertions**

Assert all three Dockerfiles use the `OPS-176` runtime, BuildKit secret mounts from `OPS-177`, a non-root runtime stage, a healthcheck, and no development-only files in the final image.

**Step 2:** Run the contract test and record failures.

**Step 3:** Apply the minimal multi-stage changes without upgrading application dependencies.

**Step 4:** Build each image with a sentinel package token and inspect `docker history --no-trunc`; expect the sentinel to be absent.

**Step 5:** Run each image on a random host port, wait for health, assert expected identity, then stop it cleanly.

**Step 6:** Commit each product repository separately with `build: harden production container`.

### Task 3: Build once and verify by digest

**Files:**

- Modify: `.github/workflows/release-docker-image.yml`
- Create: `scripts/container/verify-release-evidence.mjs`
- Create: `test/container-workflow.test.mjs`

**Step 1: Write failing workflow tests**

Require build output by digest, scan/smoke inputs by the same digest, no rebuild after verification, and publish conditioned on all verify jobs.

**Step 2:** Run `pnpm test:container-workflow`; expect failure.

**Step 3:** Implement build, smoke, scan, attest, and publish jobs. Transfer images by registry digest or immutable OCI artifact, never a mutable local tag.

**Step 4:** Make the evidence validator compare every reported digest and fail on a missing job, artifact, SBOM, or attestation.

**Step 5: Validate and commit**

```bash
pnpm test:container-contract
pnpm test:container-workflow
actionlint .github/workflows/release-docker-image.yml
git add .github/workflows/release-docker-image.yml scripts/container test/container-workflow.test.mjs
git commit -m "ci: verify containers before digest publication"
```

### Task 4: Add vulnerability, SBOM, and provenance evidence

**Files:**

- Modify: `.github/workflows/release-docker-image.yml`
- Modify: `security/security-policy.json`
- Create: `test/fixtures/containers/vulnerable/**`
- Create: `test/fixtures/containers/missing-attestation/**`
- Create: `docs/evidence/OPS-185-container-release.md`

**Step 1:** Add negative tests for a critical vulnerability and missing/incorrect attestation subject.

**Step 2:** Configure pinned scanners and attestations with only required permissions.

**Step 3:** Run a non-publishing workflow dispatch against fixtures; expect valid to pass and both negatives to block.

**Step 4:** Record digest, scan result, SBOM checksum, provenance subject, smoke output, and run URLs.

**Step 5:** Commit evidence with `docs: record verified container release evidence`.

## Completion checklist

- All production Dockerfiles meet runtime, secret, identity, and health policy.
- The secret is absent from history, layers, logs, and artifacts.
- Scan, smoke, SBOM, provenance, and publication use one digest.
- Negative fixtures block publication.
- Only the verified digest is publishable.
- Evidence is linked to `OPS-185`.

