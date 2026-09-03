# OPS-185 Container Release Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build production images once, verify the exact digest for identity, startup, health, vulnerabilities, SBOM, and provenance, then publish only that verified digest.

**Architecture:** Add a central static contract and fixture harness first. Harden the Cerberus and Hermes image definitions without changing application behavior, then split the reusable Docker release workflow into build, verify, attest, and publish jobs connected by one immutable digest. Capture machine-readable evidence and reject missing or mismatched evidence before publication.

**Tech Stack:** Docker BuildKit/buildx, GitHub Actions, Trivy, Syft or Docker SBOM, GitHub artifact attestations, Cosign verification, Node test runner, actionlint/hadolint.

---

### Task 1: Define the container contract and fixtures

**Files:**
- Create: `quality-gates/container-policy.json`
- Create: `scripts/container/validate-contract.mjs`
- Create: `test/container-contract.test.mjs`
- Create: `test/fixtures/containers/{valid,root-user,no-healthcheck,token-arg}/**`
- Modify: `package.json`

**Steps:**

1. Write failing tests for approved base image, frozen install, BuildKit secret mounts, no token-bearing `ARG`/`ENV`, non-root final user, healthcheck, digest output, vulnerability threshold, SBOM, and provenance.
2. Run `pnpm test:container-contract`; confirm failure on missing contract files.
3. Implement a parser that reports exact file/stage/rule/actual/expected values and never executes Dockerfile interpolation.
4. Add one valid fixture and one isolated negative fixture per rule.
5. Run `pnpm test:container-contract`, `pnpm run format:check`, and `pnpm run lint:check`.
6. Commit as `test: define container release contract`.

### Task 2: Harden product images

**Files:**
- Modify: `cerberus/Dockerfile`
- Modify: `hermes/Dockerfile`
- Modify: `hermes/Dockerfile.worker`
- Modify: `cerberus/.dockerignore`, `hermes/.dockerignore`
- Modify: `test/container-contract.test.mjs`

**Steps:**

1. Add product-specific failing assertions for Node `24.20.0`, frozen installs, BuildKit secret use, non-root runtime identity, health behavior, and absent development files.
2. Apply only minimal multi-stage/runtime changes; do not upgrade application dependencies.
3. Build each image with a fake sentinel token using `DOCKER_BUILDKIT=1 docker build --secret ...`.
4. Inspect `docker history --no-trunc` and final layers; prove the sentinel is absent.
5. Start each image on a random port, wait for readiness, verify the configured user and health response, then clean up.
6. Open separate product PRs with `build: harden production container`.

### Task 3: Implement build-once digest verification

**Files:**
- Modify: `gh-action-templates/.github/workflows/release-docker-image.yml`
- Create: `gh-action-templates/scripts/container/verify-release-evidence.mjs`
- Create: `gh-action-templates/test/container-workflow.test.mjs`

**Steps:**

1. Write failing workflow assertions requiring one build digest, digest-based inputs for every verify job, no post-verification rebuild, and publication gated on all checks.
2. Add build, smoke, vulnerability, SBOM, provenance, and publish jobs with explicit minimum permissions.
3. Transfer the image through an immutable registry digest or OCI artifact; do not pass a mutable tag as the verification identity.
4. Implement evidence validation that rejects missing jobs/artifacts, digest mismatches, missing SBOM subjects, and missing/incorrect provenance subjects.
5. Run `pnpm test:container-workflow`, `pnpm test:container-contract`, and `actionlint .github/workflows/release-docker-image.yml`.
6. Open the central workflow PR; record unavailable local tooling rather than claiming validation.

### Task 4: Add negative release evidence

**Files:**
- Modify: `gh-action-templates/security/security-policy.json`
- Modify: `gh-action-templates/.github/workflows/release-docker-image.yml`
- Create: `gh-action-templates/test/fixtures/containers/vulnerable/**`
- Create: `gh-action-templates/test/fixtures/containers/missing-attestation/**`
- Create: `gh-action-templates/docs/evidence/OPS-185-container-release.md`

**Steps:**

1. Add tests proving critical vulnerabilities, absent attestations, and wrong attestation subjects block publication.
2. Pin Trivy/Syft/attestation/Cosign actions by verified full SHA and isolate package, id-token, and publish permissions.
3. Dispatch non-publishing runs for valid and negative fixtures; verify publication never occurs for failures.
4. Record image digest, scan result, SBOM checksum, provenance subject, identity, smoke output, and run URLs.
5. Run central tests, audits, formatting/linting, and actionlint; commit evidence with `docs: record verified container release evidence`.

### Completion gate

Do not mark OPS-185 complete until all implementation PRs are merged into their repositories’ `main` branches, the evidence document is merged, and the task/milestone closeout records the exact PR links, commit SHAs, validation results, limitations, and follow-up ownership.
