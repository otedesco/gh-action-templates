# MLS-003 Security, Release, and Branch Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the MLS-002 quality contract so security findings, production-container verification, and protected-branch policy block unsafe delivery across all eight repositories.

**Architecture:** Build one versioned security policy and exception evaluator, then compose immutable scanner jobs into a reusable security workflow whose output is one stable blocking check. Harden the container release path into build, verify, attest, and publish stages connected by one immutable digest. Finally, validate and roll out repository rulesets only after the complete check graph is stable; live policy changes require an administrator and read-back evidence.

**Tech Stack:** GitHub Actions, CodeQL, dependency-review-action, Gitleaks, license scanner, actionlint/zizmor, SARIF, JSON Schema, Docker BuildKit/buildx, Trivy, Syft or Docker SBOM, GitHub artifact attestations, Cosign, Node test runner, shellcheck/hadolint, Linear project documents.

---

## Preconditions and working rules

- Start from `gh-action-templates` `main` after the MLS-002 documentation closeout is merged.
- Verify through the GitHub Codex app that the central and consumer reusable-workflow references resolve to immutable reviewed SHAs and that the OPS-183 permission audit still reports eight repositories.
- Keep OPS-184 and OPS-185 independent until the security exception contract needed by container release verification is merged. Do not start OPS-186 rollout until required check names are frozen.
- Use fake dependencies and sentinel credentials only in fixtures. Never place a real credential in a fixture, log, SARIF file, artifact, Docker argument, image layer, or issue comment.
- Every implementation repository receives its own branch and pull request. After all scoped implementation PRs merge, follow the workspace completion rule: update the task document, milestone document, and a separate Linear project document with complete implementation and outcome summaries.

## Task 0: Establish the M3 baseline and check-name inventory

**Files:**

- Create: `docs/evidence/MLS-003-baseline.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md`

### Step 1: Capture the current state

Run:

```bash
git status --short --branch
node scripts/audit-action-references.mjs
node scripts/audit-workflow-permissions.mjs
```

Expected: a clean branch, immutable-reference audit success, and the MLS-002 permission audit reporting eight repositories. Record the exact output and current reusable workflow SHAs in the baseline.

### Step 2: Inventory workflow checks and container inputs

For each repository (`gh-action-templates`, `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, `web-app`), record:

- default-branch workflow file and emitted check names;
- languages and CodeQL-supported source roots;
- package/dependency manifests and lockfiles;
- Dockerfiles, build contexts, image names, runtime users, and health checks;
- current rulesets, branch protections, CODEOWNERS, and administrator-owned settings (read-only).

Use the GitHub Codex app for live repository/ruleset reads. Do not infer protection state from local files.

### Step 3: Freeze the required check naming contract

Add a table to `docs/evidence/MLS-003-baseline.md` defining the exact aggregate names that OPS-186 will require, including `security / aggregate`, `quality / ...`, and `release / container` where applicable. Reject aliases or transient matrix names.

### Step 4: Commit the baseline

```bash
git add docs/evidence/MLS-003-baseline.md docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md
git commit -m "docs: baseline MLS-003 enforcement surface"
```

## Task 1: Define and validate the security policy (OPS-184)

**Files:**

- Create: `security/security-policy.json`
- Create: `security/exception.schema.json`
- Create: `security/exceptions.json`
- Create: `scripts/security/validate-policy.mjs`
- Create: `test/security-policy.test.mjs`
- Modify: `package.json`

### Step 1: Write failing policy tests

Add table-driven tests for:

- critical/high findings blocking by default;
- allowed low/medium findings;
- invalid severity/tool/rule values;
- missing owner, rationale, scope, compensating control, approval, or expiry;
- expired and same-day-expiring exceptions;
- exception scope broader than the finding;
- duplicate exception IDs and duplicate matching scopes;
- a valid narrow exception with a future UTC expiry;
- deterministic sorted diagnostics with no source or secret snippets.

Run:

```bash
pnpm test:security-policy
```

Expected: FAIL because the policy validator and package script do not yet exist.

### Step 2: Define the policy and schema

Use explicit fields:

```json
{
  "severity": { "block": ["critical", "high"], "allow": ["medium", "low", "info"] },
  "tools": ["codeql", "dependency-review", "secret-scan", "license", "workflow-security"],
  "exceptionRequired": ["owner", "rationale", "scope", "compensatingControl", "approvedBy", "expiresAt"]
}
```

Require ISO-8601 UTC expiry, a bounded package/path/rule scope, and a non-empty approval identity. Keep `security/exceptions.json` empty unless a real, reviewed exception is needed.

### Step 3: Implement fail-closed evaluation

Implement `validate-policy.mjs` to normalize each finding to `{tool, rule, severity, subject, fingerprint}`, reject malformed input, match exceptions only when every scoped field matches, and treat an expired or incomplete exception as a blocking finding. Emit stable JSON plus concise human-readable diagnostics. Never include finding snippets or recovered secret values.

### Step 4: Add the package command and verify

Add:

```json
"test:security-policy": "node --test test/security-policy.test.mjs"
```

Run `pnpm test:security-policy` and expect all policy tests to pass with changed executable code fully covered. Commit:

```bash
git add security scripts/security test/security-policy.test.mjs package.json
git commit -m "test: define blocking security policy"
```

## Task 2: Normalize scanner results and prove security failures (OPS-184)

**Files:**

- Create: `scripts/security/normalize-results.mjs`
- Create: `test/security-fixtures.test.mjs`
- Create: `test/fixtures/security/valid/**`
- Create: `test/fixtures/security/codeql-high/**`
- Create: `test/fixtures/security/vulnerable-dependency/**`
- Create: `test/fixtures/security/sentinel-secret/**`
- Create: `test/fixtures/security/prohibited-license/**`
- Create: `test/fixtures/security/unsafe-workflow/**`

### Step 1: Write the fixture contract tests

Require one valid fixture to produce no blocking findings and each negative fixture to produce exactly one normalized finding from its intended scanner. Add tests for missing, malformed, truncated, unsupported-version, and unsorted reports.

Run `pnpm test:security-fixtures`; expected result is FAIL before fixtures and normalization exist.

### Step 2: Add safe one-defect fixtures

Use fake package metadata, a fake license, a non-sensitive sentinel token, and deliberately unsafe workflow expressions. Assert that normalized output contains only the fingerprint/metadata needed for remediation and never the complete sentinel.

### Step 3: Implement normalization

Normalize CodeQL SARIF, dependency-review output, secret scanner output, license scanner output, and workflow-security output to one sorted schema. Reject absent required fields and exit non-zero for an unsupported report version. Feed normalized findings to `validate-policy.mjs`.

### Step 4: Verify and commit

```bash
pnpm test:security-policy
pnpm test:security-fixtures
git add scripts/security/normalize-results.mjs test/security-fixtures.test.mjs test/fixtures/security
git commit -m "test: prove security gate failure modes"
```

## Task 3: Build the reusable security workflow (OPS-184)

**Files:**

- Create: `.github/workflows/security.yml`
- Modify: `supply-chain/action-references.json`
- Modify: `supply-chain/workflow-permissions.json`
- Modify: `test/workflow-contract.test.mjs`

### Step 1: Add red workflow assertions

Assert that `security.yml` has:

- `workflow_call` and pull-request entry points;
- full-SHA pins for every scanner/action;
- explicit read-only analysis permissions;
- `security-events: write` only on the SARIF upload job;
- dependency comparison history and artifact retention;
- exception validation before aggregation;
- one stable aggregate job that fails on a blocking result, missing job, cancellation, or unexpected skip;
- no `continue-on-error`, mutable reference, `secrets: inherit`, or release credential in a pull-request path.

Run `pnpm test:workflow-contract`; expected: FAIL because the workflow is absent.

### Step 2: Implement scanner jobs

Compose pinned CodeQL init/autobuild/analyze, dependency review, secret scan, license scan, and workflow-security jobs. Upload SARIF only from the dedicated job with the narrow security-events permission. Keep scanner output in short-retention artifacts and sanitize summaries.

### Step 3: Implement the aggregate check

Have the aggregate job consume normalized outputs and the exception validator. It must require every scanner result, fail closed on missing/canceled/skipped jobs, and emit exactly the check name frozen in the M3 baseline.

### Step 4: Validate and commit

```bash
pnpm test:security-policy
pnpm test:security-fixtures
pnpm test:workflow-contract
pnpm run test:action-references
node scripts/audit-workflow-permissions.mjs
actionlint .github/workflows/security.yml
git add .github/workflows/security.yml supply-chain test/workflow-contract.test.mjs
git commit -m "ci: add blocking security gates"
```

If local `actionlint` is unavailable, record that limitation and require the hosted workflow run to provide the final syntax evidence.

## Task 4: Adopt and evidence the security workflow (OPS-184)

**Files:**

- Modify: each repository's security/quality workflow caller
- Modify: `docs/architecture/quality-baseline.md`
- Create: `docs/evidence/OPS-184-security-gates.md`

### Step 1: Add immutable callers

Add the security workflow call to all eight repositories using the merged central SHA. Map no secrets in pull-request security jobs. Grant only the policy-defined SARIF permission to the upload path.

### Step 2: Run controlled negative pull requests

For each scanner, open or use a disposable fixture PR and verify the stable aggregate check blocks the intended defect. Capture run URLs, scanner/action versions, policy hash, normalized result hash, SARIF/artifact URLs, and exception decisions without capturing secret values.

### Step 3: Validate and commit evidence

Run the central full suite, security suites, action-reference audit, permission audit, and actionlint. Record any pre-existing product blocker separately from security-gate behavior. Commit:

```bash
git add docs/architecture/quality-baseline.md docs/evidence/OPS-184-security-gates.md
git commit -m "docs: record security gate evidence"
```

## Task 5: Define the container release contract (OPS-185)

**Files:**

- Create: `quality-gates/container-policy.json`
- Create: `scripts/container/validate-contract.mjs`
- Create: `test/container-contract.test.mjs`
- Create: `test/fixtures/containers/{valid,root-user,no-healthcheck,token-arg}/**`
- Modify: `package.json`

### Step 1: Write failing contract tests

Require an approved base image, frozen install, BuildKit secret mounts, no token-bearing `ARG`/`ENV`, non-root runtime identity, healthcheck, digest output, vulnerability threshold, SBOM, and provenance fields. Test each missing or unsafe property independently.

Run `pnpm test:container-contract`; expected: FAIL on the current Dockerfiles/workflow.

### Step 2: Implement static contract validation

Parse Dockerfile stages/instructions and release workflow inputs without executing interpolated content. Report the exact file, stage, rule, actual value, expected value, and remediation. Reject secret persistence in generated npm configuration, build arguments, image history, or final layers.

### Step 3: Add fixtures and verify

Use fake Dockerfiles and a sentinel token. Confirm valid fixtures pass and root-user, missing-healthcheck, and token-argument fixtures fail exactly once. Commit:

```bash
pnpm test:container-contract
git add quality-gates/container-policy.json scripts/container test/container-contract.test.mjs test/fixtures/containers package.json
git commit -m "test: define container release contract"
```

## Task 6: Harden product images (OPS-185)

**Files:**

- Modify: `../cerberus/Dockerfile`
- Modify: `../hermes/Dockerfile`
- Modify: `../hermes/Dockerfile.worker`
- Modify: product `.dockerignore` files
- Modify: `test/container-contract.test.mjs`

### Step 1: Add product assertions

Require all three images to use the OPS-176 runtime contract, BuildKit secret mounts from OPS-177, a non-root final stage, healthcheck, and no development-only files in the final layer.

### Step 2: Apply minimal multi-stage changes

Do not upgrade application dependencies or alter application behavior. Keep private registry setup transient and remove any npm configuration containing the token before the final layer.

### Step 3: Build and inspect locally

For each image:

```bash
DOCKER_BUILDKIT=1 docker build --secret id=npm_token,src=/path/to/fake-sentinel -t mls003-fixture:local .
docker history --no-trunc mls003-fixture:local
docker inspect --format '{{.Config.User}} {{json .Config.Healthcheck}}' mls003-fixture:local
```

Expected: the sentinel is absent from history and layers, the configured user is non-root, and a healthcheck exists.

### Step 4: Run smoke and identity checks

Start each image on a random host port, wait for the health endpoint, assert the accepted identity and readiness response, then stop and remove the disposable container. Record output in the evidence file, not in image labels.

### Step 5: Commit product repositories separately

```bash
git add Dockerfile Dockerfile.worker .dockerignore
git commit -m "build: harden production container"
```

## Task 7: Build once, verify, attest, and publish one digest (OPS-185)

**Files:**

- Modify: `.github/workflows/release-docker-image.yml`
- Create: `scripts/container/verify-release-evidence.mjs`
- Create: `test/container-workflow.test.mjs`

### Step 1: Write failing workflow tests

Assert a build job emits one digest, scan/smoke/SBOM/provenance jobs consume that exact digest, publish is gated on every verification job, and no post-verification rebuild or mutable-tag-only publish exists.

Run `pnpm test:container-workflow`; expected: FAIL before the digest flow exists.

### Step 2: Implement the digest graph

Use BuildKit/buildx to build once and export the digest. Transfer the image through an immutable registry digest or OCI artifact. Run identity/startup/health checks, vulnerability scanning, SBOM generation, and provenance attestation against that digest. Publish only after all evidence validates.

### Step 3: Implement evidence validation

`verify-release-evidence.mjs` must compare every reported digest, require every job/result/artifact, verify SBOM and provenance subjects, reject missing or mismatched attestations, and produce a stable summary suitable for the required check.

### Step 4: Verify and commit

```bash
pnpm test:container-contract
pnpm test:container-workflow
pnpm run test:action-references
pnpm run test:workflow-permissions
actionlint .github/workflows/release-docker-image.yml
git add .github/workflows/release-docker-image.yml scripts/container test/container-workflow.test.mjs
git commit -m "ci: verify containers before digest publication"
```

## Task 8: Add vulnerability, SBOM, and provenance evidence (OPS-185)

**Files:**

- Modify: `.github/workflows/release-docker-image.yml`
- Modify: `security/security-policy.json`
- Create: `test/fixtures/containers/vulnerable/**`
- Create: `test/fixtures/containers/missing-attestation/**`
- Create: `docs/evidence/OPS-185-container-release.md`

### Step 1: Add negative evidence tests

Require a critical vulnerability, missing attestation, and wrong attestation subject to block publication. Ensure scan logs and artifacts contain no token or secret material.

### Step 2: Configure pinned scanners and attestations

Pin Trivy/Syft/attestation/Cosign actions by reviewed full SHA. Grant only the exact package, id-token, and attestation permissions needed by each job; keep publication permission on the final publish job.

### Step 3: Run non-publishing verification

Dispatch against fixtures and expect the valid image to pass while vulnerable and missing-attestation images block before publication. Record digest, scan result, SBOM checksum, provenance subject, identity, smoke output, and run URL.

### Step 4: Commit evidence

```bash
git add security/security-policy.json test/fixtures/containers docs/evidence/OPS-185-container-release.md
git commit -m "docs: record verified container release evidence"
```

## Task 9: Define and validate repository ruleset policy (OPS-186)

**Files:**

- Create: `governance/repository-ruleset-policy.json`
- Create: `governance/repositories.json`
- Create: `scripts/governance/validate-rulesets.mjs`
- Create: `test/repository-rulesets.test.mjs`
- Modify: `package.json`

### Step 1: Write failing policy tests

Require pull-request-only changes, at least one approval, code-owner review for protected paths, stale approval dismissal, strict required checks, conversation resolution, protected history, force-push/deletion denial, and a named minimal bypass list. Reject unknown checks, duplicate rules, broad bypasses, and absent repository entries.

Run `pnpm test:repository-rulesets`; expected: FAIL before the policy exists.

### Step 2: Implement schema and validation

Record per repository: protected branch, required checks from the M3 baseline, approval count, code-owner requirement, bypass actors, and whether administrators may bypass. Validate exact names and reject permissions/rules unsupported by the GitHub ruleset API.

### Step 3: Commit policy

```bash
pnpm test:repository-rulesets
git add governance scripts/governance test/repository-rulesets.test.mjs package.json
git commit -m "test: define protected branch policy"
```

## Task 10: Validate ownership and required checks (OPS-186)

**Files:**

- Create or modify: each repository `.github/CODEOWNERS`
- Modify: `governance/repositories.json`
- Create: `scripts/governance/audit-codeowners.mjs`
- Create: `test/codeowners.test.mjs`

### Step 1: Add failing CODEOWNERS tests

Reject missing owners, unmatched critical paths, nonexistent teams/users, invalid syntax, and required checks not emitted by default-branch workflows.

Run `pnpm test:codeowners`; expected: FAIL on each current gap.

### Step 2: Add the narrowest ownership rules

Protect workflow, security policy, container, governance, and release files with real maintainers/teams. Keep product-specific ownership in the product repository and do not invent team handles; verify every owner through the GitHub Codex app.

### Step 3: Verify and commit separately

```bash
pnpm test:repository-rulesets
pnpm test:codeowners
git add .github/CODEOWNERS governance/repositories.json scripts/governance/audit-codeowners.mjs test/codeowners.test.mjs
git commit -m "governance: protect critical delivery paths"
```

## Task 11: Apply live rulesets with administrator verification (OPS-186)

**Files:**

- Create: `governance/rulesets/PRJ-001-main.json`
- Create: `docs/runbooks/repository-ruleset-rollout.md`
- Create: `docs/evidence/OPS-186-rulesets.json`

### Step 1: Export current settings read-only

Use the GitHub Codex app to read rulesets/protection settings for all eight repositories. Normalize only branch, rule, check, actor, and timestamp data; omit tokens, unrelated settings, and personal data.

### Step 2: Review desired payload with an administrator

Generate `PRJ-001-main.json` from the validated policy. Before any write, review exact repositories, branch patterns, required checks, bypass actors, and administrator behavior with an authorized administrator. Record approval in the runbook.

### Step 3: Apply in a staged order

Apply to `gh-action-templates` first, verify an ordinary green PR can merge, then apply one repository at a time. Stop immediately on a mismatch, unexpected block, missing check, or inability to read back live state.

### Step 4: Read back and validate

After each write, fetch the live ruleset and run `pnpm test:repository-rulesets` against the normalized export. Store repository, ruleset ID, policy hash, applied timestamp, and validation result in `OPS-186-rulesets.json`.

### Step 5: Commit the rollout material

```bash
git add governance/rulesets/PRJ-001-main.json docs/runbooks/repository-ruleset-rollout.md docs/evidence/OPS-186-rulesets.json
git commit -m "governance: record protected branch rollout"
```

## Task 12: Prove enforcement and close the milestone

**Files:**

- Create: `docs/evidence/OPS-186-live-verification.md`
- Modify: `docs/evidence/OPS-184-security-gates.md`
- Modify: `docs/evidence/OPS-185-container-release.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/tasks/OPS-184-security-gates.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/tasks/OPS-185-container-release-gates.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/tasks/OPS-186-repository-rulesets.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md`
- Create or update: Linear project document for MLS-003

### Step 1: Run controlled negative and positive changes

For each repository, prove that direct push, missing review, unresolved conversation, stale branch, failed required check, and unauthorized bypass cannot merge. Prove that an approved, current, fully green PR can merge normally. Exercise only approved bypass actors, capture audit events, and verify unapproved actors remain blocked.

### Step 2: Run the complete validation matrix

```bash
pnpm test
pnpm test:security-policy
pnpm test:security-fixtures
pnpm test:container-contract
pnpm test:container-workflow
pnpm test:repository-rulesets
pnpm test:codeowners
pnpm run test:action-references
pnpm run test:workflow-permissions
node scripts/audit-action-references.mjs
node scripts/audit-workflow-permissions.mjs
actionlint .github/workflows/*.yml
git diff --check
```

Expected: all tests/audits pass, `Immutable action references: ... references audited`, `workflow permissions: 8 repositories audited`, and live ruleset evidence exists for all eight repositories. Record unavailable local tools and hosted replacements explicitly.

### Step 3: Complete each task record after its PRs merge

After verifying every OPS-184, OPS-185, and OPS-186 implementation PR is merged into `main` with the GitHub Codex app:

- mark the task document complete with date;
- list every merged PR/repository and exact implementation details;
- record tests, hosted runs, policy hashes, live evidence, limitations, and follow-up ownership;
- update the MLS-003 document's task table and cumulative outcome.

### Step 4: Create the required Linear project document

Create or update a separate Linear project document titled `MLS-003 — Security, release, and branch enforcement — completion report`. Include capabilities delivered, scanner/container/ruleset implementation details, all affected repositories, validation and live-enforcement evidence, accomplishments, limitations, and deferred work. Link it from the Linear milestone description and OPS-184, OPS-185, and OPS-186 issues. Updating only the milestone description or issue descriptions is insufficient.

### Step 5: Close the milestone only after documentation merges

Create a documentation closeout PR for the task/milestone Markdown, verify it merges into `main`, then confirm the Linear project document exists and is linked. Only then mark MLS-003 complete and hand off MLS-004 adoption/stability work.

## Dependency and merge order

1. Merge the central OPS-184 security-policy/workflow PR before consumer security callers.
2. Merge the central OPS-185 digest workflow PR before Cerberus/Hermes Dockerfile and consumer release PRs.
3. Merge OPS-184 and OPS-185 consumer rollouts; resolve any check-name or permission intersection issue before ruleset work.
4. Merge OPS-186 policy/CODEOWNERS changes, then apply live rulesets with administrator approval one repository at a time.
5. Run the controlled enforcement matrix, update all task/milestone records, create the Linear project document, and merge the documentation closeout PR.

## Definition of done

- Critical/high security findings and invalid/expired exceptions block merge or release with sanitized SARIF/evidence.
- Production images build once, run as the accepted identity, pass startup/health/vulnerability checks, emit SBOM/provenance, and publish only the verified digest.
- All eight repositories have live required PR/review/check/history/bypass policy, verified by read-back and controlled negative tests.
- All third-party and reusable references remain immutable and all workflow credentials remain least-privilege.
- OPS-184, OPS-185, and OPS-186 task records, MLS-003 repository documentation, and the dedicated Linear project document contain complete delivery summaries and links to merged evidence.
