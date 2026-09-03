# Project 1 Tooling and New-Repository Configuration

This document explains why Project 1 uses each tool, where its configuration lives, and what a new repository must configure before it can join the quality-gate and protected-delivery contract. It is the onboarding companion to the historical implementation plans and the central source-of-truth files.

## Why this toolchain exists

Project 1 establishes reliable evidence before larger product refactors begin. The toolchain therefore has four non-negotiable properties:

- checks are truthful and check-only;
- runtime, installs, workflow references, permissions, and credentials are reproducible;
- security and release evidence is bound to the reviewed source or artifact;
- GitHub enforces the required outcome on `main`.

The central repository is `otedesco/gh-action-templates`. New repositories consume its immutable reusable workflows and composite actions after their exact compatibility contract is reviewed.

## Tool inventory and rationale

The table uses these states:

- **Required/current:** part of the accepted Project 1 path for the applicable repository type.
- **Repository-specific:** required only when the repository uses that framework or artifact type.
- **Optional/deferred:** named during planning but not the current canonical implementation; adding it requires a policy decision.

| Tool or service | State | Why it is needed | New-repository configuration |
|---|---|---|---|
| Node.js `24.20.0` | Required/current | Gives every script, workflow, and container the same supported runtime. | Set exact `engines.node`, use the central setup action, and use the exact Docker base image selected by the runtime contract. |
| pnpm `10.34.0` | Required/current | Provides reproducible workspace installs with frozen lockfiles for the seven pnpm repositories. | Set `packageManager: pnpm@10.34.0`, commit `pnpm-lock.yaml`, and use `pnpm install --frozen-lockfile`. |
| npm `10.8.2` | Repository-specific | Supports the explicitly retained npm contract for `web-app`. | Set exact npm metadata, commit `package-lock.json`, and use `npm ci`; do not introduce npm to a pnpm repository. |
| Corepack | Required/current | Activates the declared package manager without relying on a runner-global version. | Enable it in local/container setup and verify the package-manager version before installation. |
| Volta and `volta-cli/action` | Required/current | Installs the exact Node/npm versions in the shared CI setup without rewriting manifests. | Consume the pinned central setup action; do not add a second runtime manager or floating Volta version. |
| GitHub Actions | Required/current | Runs the same quality, security, and release checks locally represented by the repository contract. | Add PR and release callers from the central workflows, pin every remote action by reviewed full SHA, and declare top-level/job permissions. |
| Central reusable workflows | Required/current | Keeps gate ordering, names, permissions, and evidence behavior consistent across repositories. | Call the immutable `lint-and-test.yml` and `security.yml`; add `release-package.yml` or `release-docker-image.yml` only for that repository's release type. |
| Central composite actions | Required/current | Shares runtime setup, registry preflight, and changed-code coverage evaluation. | Consume the pinned `setup-environment` and `coverage-gate` actions with explicit inputs; do not copy their implementation into the consumer. |
| `actions/checkout` | Required/current | Retrieves the reviewed source and sufficient history for coverage/security comparisons. | Use the central pinned reference; disable persisted credentials where the job does not need them and fetch full history for analysis jobs. |
| `actions/cache` | Required/current | Speeds package-manager installs without changing the dependency contract. | Use only the central pnpm-store cache key/path and retain frozen installs as the authority. |
| `actions/upload-artifact` / `actions/download-artifact` | Required/current | Transfers bounded machine-readable evidence between jobs. | Use pinned versions, short retention, explicit artifact names, and fail closed on missing evidence. |
| `actions/setup-node` | Required/current | Provides the exact Node runtime for the license-scan path. | Use only where the reusable workflow requires it and pin the action by full SHA. |
| `pnpm/action-setup` | Required/current | Installs the exact pnpm version on the runner. | Let the central setup action own it; do not use a floating version in a consumer. |
| GitHub CLI (`gh`) and GitHub REST API | Required/current | Resolves action SHAs, discovers check contexts, applies/read-backs rulesets, and verifies live state. | Authenticate with the least-privilege administrator or automation identity; keep read-only discovery separate from live writes and never store tokens in evidence. |
| Git and full history | Required/current | Computes changed code, merge-base coverage, revisions, and evidence provenance. | Ensure CI fetches the required history and record base/head commits in evidence. |
| Dependabot | Required/current | Proposes reviewed updates for immutable action references. | Add `.github/dependabot.yml` with the GitHub Actions weekly schedule; require normal policy, security, and action-reference checks before merge and disable auto-merge. |
| Node built-in test runner | Required/current | Tests central contracts and fixture behavior without adding a second central test framework. | Add `node --test` contract tests and make failures non-zero; keep test fixtures deterministic and single-defect. |
| Prettier | Required/current | Detects formatting drift as a check-only gate. | Add `format:check` using the repository's config and ignore only documented generated files. Never use `--write` in required CI. |
| ESLint | Required/current | Detects JavaScript/TypeScript defects and warnings. | Add `lint:check` with warnings treated as failures where the repository contract requires it; do not use `--fix` in CI. |
| TypeScript | Repository-specific/current | Provides static type diagnostics for TypeScript repositories. | Add `type:check` with no emit and no hidden error suppression; configure the build and test source sets explicitly. |
| Jest | Repository-specific/current | Runs the Cerberus unit-test harness and produces coverage. | Add a real `test` and `test:coverage` command, configure providers/reporters, and reject focused/skipped tests and leaked handles. |
| Vitest | Repository-specific/current | Runs the shared-library and Notify test harnesses with V8 coverage. | Configure the V8 provider, source collection, reporters, and the canonical `test`/`test:coverage` commands. |
| Next.js | Repository-specific/current | Supplies the `web-app` application build/runtime contract. | Keep `build` truthful and add the web-app's explicit quality/test implementation before making those checks required; do not hide OPS-228 gaps. |
| jsdom | Repository-specific | Supplies a deterministic browser-like DOM for component tests. | Configure it explicitly as the Vitest/Jest environment and keep browser globals in shared test setup only. |
| React Testing Library | Repository-specific | Tests rendered React behavior at the user-facing boundary. | Add it only to React UI repositories; configure the DOM environment and include tests in the canonical unit command. |
| `@testing-library/user-event` | Repository-specific | Models realistic user interactions instead of testing implementation details. | Add it to UI test dependencies and use it in component tests; keep interaction failures visible to the unit gate. |
| `@testing-library/jest-dom` | Repository-specific | Adds semantic DOM assertions for component behavior. | Register its matchers in the test setup and include setup files in type checking and coverage. |
| MSW | Repository-specific | Provides deterministic network boundaries for application tests. | Register handlers in test setup, keep requests local/deterministic, and ensure unhandled requests fail. |
| axe/axe integration | Repository-specific | Detects accessibility regressions in rendered UI. | Add it to the UI test harness, fail on the approved rule set, and store violations as test evidence. |
| Playwright | Repository-specific | Exercises browser-level behavior where unit tests cannot establish confidence. | Add isolated browser tests and make the CI command explicit; do not make an optional/manual suite appear as the required unit gate. |
| Testcontainers | Repository-specific | Runs disposable integration dependencies against real service behavior. | Declare the required image versions and startup health checks; clean up containers and report unavailable infrastructure as a failure. |
| PostgreSQL, Redis, Kafka-compatible broker, Service Bus, and Mailpit/SMTP sink | Repository-specific | Provide the database, cache, messaging, and email boundaries named by the product testing strategy. | Add only the services the repository uses, pin image/client versions, configure health checks, and keep credentials/local endpoints in test-only configuration. |
| LCOV and coverage-summary JSON | Required/current | Gives different Jest/Vitest outputs one normalized coverage input. | Publish the configured report files, validate schema/paths, and never infer coverage from a missing report. |
| Coverage source inventory and changed-code gate | Required/current | Enforces 100% changed executable-code coverage and prevents coverage-report omissions. | Add source inventory exclusions with reasons, fetch base history, consume the central coverage action, and record the four metrics. |
| Global coverage ratchet/baseline | Required/current | Prevents global coverage from decreasing while allowing incremental improvement. | Add the repository baseline through the central schema and update it only when a verified change raises coverage. |
| c8 / Node coverage instrumentation | Required/current for central evidence tests | Measures coverage of the central Node evidence and validation scripts. | Use the repository's pinned coverage command and enforce its configured lines/functions thresholds; do not treat instrumentation absence as success. |
| JSON Schema | Required/current | Validates policy, coverage, security, container, and evidence documents structurally. | Add schemas before data, validate every generated/checked-in JSON file, and reject unknown or incomplete fields where the contract requires it. |
| CodeQL | Required/current | Finds source-level security defects and publishes SARIF for supported languages. | Call central `security.yml`, identify supported languages, ensure the CodeQL job has read-only source permission, and reserve SARIF write permission for the upload job. |
| `actions/dependency-review-action` | Required/current | Blocks newly introduced dependency risk on pull requests. | Use the central pinned action with the approved high-severity threshold and no release credentials. |
| Gitleaks | Required/current | Detects leaked credentials in relevant repository history and generated evidence. | Call the central redacted scan, use sentinel-only fixtures, and never print or upload raw secrets. |
| `license-checker` | Required/current | Evaluates resolved production dependency licenses against policy. | Ensure installation is frozen, pass `NPM_TOKEN` only for private dependencies, generate the central JSON report, and review exceptions explicitly. |
| Zizmor | Required/current | Audits GitHub Actions for unsafe workflow constructs and credential exposure. | Run the central auditor persona at the approved minimum severity against workflow files and fix findings rather than lowering the threshold. |
| actionlint | Required/current | Validates GitHub Actions YAML syntax and expressions. | Run it locally/hosted over every workflow; record unavailable local installation and require hosted evidence rather than skipping validation. |
| SARIF | Required/current | Carries CodeQL and scanner findings in a durable machine-readable format. | Preserve tool/rule/severity/subject data, sanitize secrets, upload only from the dedicated security-events job, and retain for the documented period. |
| GitHub Actions artifacts | Required/current | Retain bounded coverage, security, container, and release evidence. | Name artifacts by repository/commit, set short retention, include checksums where applicable, and fail closed on absent artifacts. |
| Docker, BuildKit, and buildx | Required/current for image repositories | Builds the production image once and preserves its digest across verification and publication. | Enable BuildKit, use frozen installs and required secret mounts, build/push by digest, and never pass tokens through `ARG`, `ENV`, or persisted config. |
| `docker/login-action` | Required/current for image repositories | Authenticates to GHCR for the exact build/verify/publish jobs that need it. | Use the scoped GitHub token, grant `packages: read/write` only to the relevant job, and pin the action. |
| `docker/metadata-action` | Required/current when image tags/labels are generated | Produces reproducible image tags and OCI labels from the reviewed source/ref. | Add it only to image workflows that need generated metadata, pin it by full SHA, and keep the immutable digest as the release identity. |
| `docker/build-push-action` | Required/current for image repositories | Performs the single reviewed build and emits the immutable digest. | Use the central workflow, validate the image is `ghcr.io/${GITHUB_REPOSITORY}`, and provide private-package credentials through BuildKit secrets only. |
| Docker Scout | Required/current for current container workflow | Scans the exact verified image digest for critical/high vulnerabilities and generates the SPDX SBOM. | Consume the central pinned action; use digest-qualified image references, fail on policy violations, and validate the SPDX JSON subject. |
| Trivy | Optional/deferred alternative | Was named in the original container plan as a vulnerability scanner. | Do not add it to a new repository while Docker Scout is canonical; a future replacement requires policy, fixture, pin, and evidence updates. |
| Syft | Optional/deferred alternative | Was named as an SBOM generator alternative. | Do not add it while Docker Scout/SPDX output is canonical; document and review any replacement before use. |
| GitHub artifact attestations and `gh attestation verify` | Required/current for image repositories | Binds provenance to the exact image digest and verifies it before publication. | Grant `id-token: write`, `attestations: write`, and related metadata permission only to the provenance job; verify the digest subject before promotion. |
| Cosign | Optional/deferred alternative | Was named as an attestation verification option in the original plan. | Do not introduce it alongside GitHub attestations without an explicit trust-model decision and matching verification fixtures. |
| ShellCheck | Required/current where release scripts are shell-based | Finds unsafe shell constructs in workflow and release scripts. | Run it against checked-in shell scripts and heredoc scripts where practical; record unavailable local tooling and require hosted evidence. |
| hadolint | Required/current for Dockerfile review where available | Finds Dockerfile correctness and maintainability defects before image builds. | Run it against each production Dockerfile, pin or centrally provision its version, and fail on policy-selected findings. |
| SPDX JSON | Required/current for image repositories | Provides the structured SBOM contract whose subject can be checked against the digest. | Validate `spdxVersion`, document identity, package array, image, and digest before publication. |
| Changesets and `changesets/action` | Required/current for package repositories | Creates release PRs and publishes packages while preserving version/changelog intent. | Add Changesets configuration, call the central release workflow, pass only the required `NPM_TOKEN`, and keep publication off pull-request paths. |
| GitHub Packages | Required/current for private package consumers | Hosts scoped private `@otedesco` packages used by Cerberus, Hermes, and Notify. | Add a credential-free `.npmrc` registry mapping with `${NPM_TOKEN}`, configure the repository secret with `packages:read`, and enable the central registry preflight. |
| GitHub Container Registry (GHCR) | Required/current for image repositories | Stores the image digest that is scanned, attested, and promoted. | Use `ghcr.io/${GITHUB_REPOSITORY}`, grant package permission only to release jobs, and never publish a rebuilt tag after verification. |
| CODEOWNERS | Required/current | Identifies owners for workflow, security, release, and source paths. | Create `.github/CODEOWNERS`, use valid approved owners, and cover all critical paths before enabling code-owner review. |
| GitHub Repository Rulesets | Required/current | Enforces the PR, review, check, history, and bypass policy on `main`. | Generate the desired payload from central governance data, apply only with administrator approval, read it back, and prove positive/negative behavior. |
| GitHub Codex app | Required/current for completion verification | Confirms that scoped pull requests and documentation closeouts actually merged into each repository's `main` and that live enforcement matches the records. | Use it after each rollout/closeout to verify merge state, resulting `main` commit, and live ruleset evidence; do not substitute local branch state. |
| Linear | Required/current project governance | Tracks issue/milestone status and stores the required project delivery document. | Link the repository/task evidence to the connected issue and milestone; create/update the dedicated project document at milestone closeout. |

## New-repository configuration sequence

Complete these steps in order. A repository is not eligible for a protected `main` ruleset until the required check contexts exist and have been observed on the default branch.

### 1. Create the runtime and package contract

Start from the central values in [`runtime-contract.json`](../../runtime-contract.json):

- Node.js: `24.20.0`
- pnpm: `10.34.0` for the standard repository type
- npm: `10.8.2` only for the explicit npm exception

Add exact manifest metadata, the correct lockfile, and the package-manager scripts. Use Corepack/Volta through the central setup action. Do not use `latest`, `lts/*`, ranges, or a second package manager.

### 2. Add the canonical quality interface

Implement the scripts from [`quality-script-contract.json`](../../quality-script-contract.json):

```json
{
  "format:check": "check-only formatting",
  "lint:check": "check-only linting",
  "type:check": "check-only type diagnostics",
  "test": "truthful unit tests",
  "test:coverage": "truthful coverage with a report",
  "build": "truthful production build",
  "quality:check": "the canonical sequence"
}
```

The exact implementation depends on the repository's framework, but required commands must fail on their claimed defects. Do not use formatter fixes, placeholder success, `passWithNoTests`, focused/skipped tests, forced process exits, or hidden retries in required paths.

### 3. Configure private dependencies only where needed

For a private-package repository, keep `.npmrc` credential-free:

```ini
@otedesco:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Declare `NPM_TOKEN` explicitly in the reusable workflow caller only when installation or publication requires it. Use frozen installs. Never use `secrets: inherit`, a custom PAT when `github.token` is sufficient, or a Docker `ARG`/`ENV` for the token.

### 4. Add workflows through immutable central calls

Use the central reusable workflow release and the exact reference recorded in [`supply-chain/action-references.json`](../../supply-chain/action-references.json). A standard package repository has a caller shaped like:

```yaml
jobs:
  lint-and-test:
    uses: otedesco/gh-action-templates/.github/workflows/lint-and-test.yml@<reviewed-40-character-sha>
  security:
    uses: otedesco/gh-action-templates/.github/workflows/security.yml@<reviewed-40-character-sha>
```

Add package or Docker release callers only when applicable. Keep caller permissions explicit and minimal. The central workflow's job names and resulting check contexts must be confirmed from a real run before they are made required.

### 5. Add ownership and evidence configuration

Create `.github/CODEOWNERS` with approved owners for at least:

```text
/.github/ @approved-team-or-maintainer
/Dockerfile @approved-team-or-maintainer
/package.json @approved-team-or-maintainer
/pnpm-lock.yaml @approved-team-or-maintainer
```

Extend the paths for the repository's security, release, infrastructure, and application-critical files. Configure coverage baselines, security exceptions, and container evidence only through the central schemas. Every exception needs an owner, reason, scope, compensating control, approval, and expiry.

### 6. Configure release artifacts when applicable

For a package repository, use Changesets and the central package release workflow. For an image repository, use the central Docker workflow, GHCR naming, BuildKit secrets, health checks, digest-qualified scan/SBOM/provenance verification, and digest-only publication. Notify currently has no production image and must not receive a Docker release workflow by default.

### 7. Discover checks before applying protection

From the repository's `main`, record workflow names, job IDs, reusable workflow SHAs, triggers, and actual check-run contexts from successful and failing PR runs. Required contexts must be stable, emitted by the intended workflow, and present on normal PR validation—not only on tags, manual dispatch, or release jobs.

### 8. Apply and verify the ruleset

Render the repository's desired ruleset from the central policy. An administrator reviews and applies it through the GitHub API or `gh` CLI. Read back the live ruleset, then prove:

- a failed required check, missing review, unresolved conversation, stale branch, or unowned critical change cannot merge;
- direct push, force push, and branch deletion are denied;
- a current, approved, fully green PR can merge normally;
- only named bypass actors can bypass, and their audit events are recorded.

The final result must be recorded in sanitized evidence and verified through the GitHub Codex app.

## Source-of-truth map

| Concern | Source of truth |
|---|---|
| Runtime and package managers | [`runtime-contract.json`](../../runtime-contract.json) |
| Canonical scripts | [`quality-script-contract.json`](../../quality-script-contract.json) and [`docs/quality-gates/script-contract.md`](../quality-gates/script-contract.md) |
| Core gates | [`quality-gates/core-gates.json`](../../quality-gates/core-gates.json) |
| Coverage schema/baselines | [`coverage-baselines/`](../../coverage-baselines/) |
| Immutable action/workflow references | [`supply-chain/action-references.json`](../../supply-chain/action-references.json) |
| Workflow permissions and secrets | [`supply-chain/workflow-permissions.json`](../../supply-chain/workflow-permissions.json) |
| Security policy and exceptions | [`security/security-policy.json`](../../security/security-policy.json) and [`security/exception.schema.json`](../../security/exception.schema.json) |
| Container policy | [`quality-gates/container-policy.json`](../../quality-gates/container-policy.json) |
| Ruleset policy and repository inventory | `governance/repository-ruleset-policy.json` and `governance/repositories.json` (created by OPS-186) |
| Live rollout and verification | `docs/evidence/OPS-186-rulesets.json` and `docs/evidence/OPS-186-live-verification.md` (created by OPS-186) |
| Project status and completion evidence | `docs/projects/PRJ-001-quality-gates-ci-foundation/` and the linked Linear records |

## Prohibited new-repository shortcuts

- Floating action tags, branches, short SHAs, or unreviewed reusable-workflow commits
- `secrets: inherit`, broad write permissions, or release credentials on pull-request jobs
- Mutable runtime/package-manager versions or unlocked installs
- Formatter/linter mutation in required checks
- Empty or placeholder test commands, hidden test skips, missing coverage providers, or ignored build errors
- Private tokens in Docker build arguments, environment variables, image layers, logs, artifacts, or comments
- Scanning one image and publishing a different tag or rebuilt digest
- Making a ruleset required check before confirming its actual check-run context
- Adding Trivy, Syft, Cosign, or another alternative alongside the current canonical tool without a reviewed policy change
