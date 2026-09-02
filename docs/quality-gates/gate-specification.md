# Apart Quality Gate Specification

**Status:** Proposed required-check contract  
**Owner:** Platform/Architecture  
**Rollout order:** Gate foundation, repository adoption, coverage ratchet, full enforcement, refactoring authorization

## Required pull-request checks

Every repository must expose stable, uniquely named checks. Jobs should run in parallel after a single deterministic install job where artifact/cache sharing is safe.

| Check | Required behavior | Failure conditions |
|---|---|---|
| `quality / install` | Frozen lockfile, supported package manager/runtime, private registry preflight | Lock drift, missing auth, lifecycle-script policy violation, non-reproducible install |
| `quality / format` | Check-only formatter | Any source/config/documentation drift |
| `quality / types` | Strict TypeScript check including tests | Any diagnostic or excluded test source |
| `quality / lint` | Lint all source, tests, scripts, and configuration with zero warnings | Any error, warning, unused suppression, or invalid config |
| `quality / unit` | Run tests without `passWithNoTests` | Zero tests, skipped/focused tests, unhandled errors, leaked handles, nondeterminism |
| `quality / coverage` | Publish machine-readable and HTML reports; enforce changed-code/global ratchet | Threshold miss, missing source file, broad exclusion, global decrease |
| `quality / build` | Build production/library artifacts from clean source | Build warning promoted by policy, failure, undeclared artifact, type drift |
| `quality / integration` | Real boundary tests with disposable services | Migration, persistence, cache, broker, SMTP, or HTTP contract failure |
| `quality / contract` | OpenAPI, event schema, package export, env schema compatibility | Breaking/unversioned change or generated-contract drift |
| `quality / security` | Dependency review, SAST/CodeQL, secret and license checks | Unapproved critical/high issue, secret, prohibited license, unsafe workflow |
| `quality / container` | Build, scan, inspect, and smoke production images | Critical/high unapproved CVE, root user, missing health behavior, startup failure |
| `quality / e2e` | Playwright critical journeys on built stack | Journey, accessibility, console/page error, or artifact collection failure |
| `quality / mutation` | Changed critical logic mutation check | Score below policy or survived high-risk mutant |

Fast pull-request checks should finish first and cancel superseded runs. Integration, end-to-end, and mutation checks may use path filters only when an automatically validated dependency map proves the changed code cannot affect them.

## Repository scripts contract

OPS-180 makes the six core commands below the executable minimum. Every command is check-only and propagates failures; `quality:check` runs them in this order:

```text
format:check -> lint:check -> type:check -> test -> test:coverage -> build
```

Lint uses a zero-warning policy, coverage declares its provider and emits text, JSON summary, LCOV, and Cobertura evidence, and build is followed by a tracked-file drift check. OPS-217 and OPS-228 remain explicit owned blockers; OPS-181 owns coverage ratcheting and OPS-182/183 own references and permissions/secrets.

Each product repository must provide these check-only scripts, even when a script delegates to another tool:

```json
{
  "scripts": {
    "clean": "...",
    "format:check": "...",
    "type:check": "...",
    "lint:check": "... --max-warnings 0",
    "test:unit": "...",
    "test:coverage": "...",
    "test:integration": "...",
    "test:contract": "...",
    "test:e2e": "...",
    "test:mutation": "...",
    "build": "...",
    "quality": "..."
  }
}
```

Required CI scripts must never mutate source files. `--fix`, formatter write mode, automatic snapshot update, and dependency update commands are developer-only scripts.

## Coverage implementation

- Standardize new TypeScript suites on Vitest where practical; migration from Cerberus Jest is a separate, behavior-preserving decision.
- Install and explicitly configure a coverage provider in every repository.
- Set `all: true` or the tool-equivalent include pattern so unimported source files count as uncovered.
- Emit `text`, `json-summary`, `lcov`, and Cobertura reports.
- Enforce statements, branches, functions, and lines independently.
- Add changed-line coverage using the merge base; shallow checkouts must fetch enough history to compute it accurately.
- Upload reports with short retention and no secrets/source maps containing sensitive values.
- Merge package reports only for program visibility; repository gates remain independently enforceable.

## Workflow security contract

1. Pin third-party actions to reviewed full commit SHAs and annotate the intended release tag in comments.
2. Reference reusable Apart workflows by an immutable release tag or commit SHA, never `@main`.
3. Declare top-level `permissions: contents: read` and grant narrow job-level permissions only when required.
4. Replace broad `secrets: inherit` with explicit named secrets.
5. Fix the setup action's registry-token input contract and add a redaction-safe preflight check.
6. Use OIDC for cloud publishing where supported; avoid long-lived deployment credentials.
7. Add concurrency cancellation for pull-request checks and protect release jobs from cancellation after publication begins.
8. Generate an SBOM and artifact attestation for published packages and images.
9. Run `actionlint`, `shellcheck`, and a workflow security analyzer against all workflow/action YAML and shell fragments.

## Security and dependency policy

- Critical/high production dependency findings block merge unless an approved exception includes owner, exploitability assessment, compensating control, and expiration.
- Moderate findings require triage within the sprint; low findings are tracked and ratcheted.
- Dependency updates must pass the complete affected repository suite.
- Docker base images use supported runtimes and immutable digests after compatibility verification.
- Secret scanning covers Git history in scheduled runs and changed content on pull requests.
- Security tests cover token expiry/tampering, cookie attributes, session invalidation, OTP abuse/rate limits, authorization boundaries, input validation, and sensitive log redaction.

## Branch and release enforcement

Create organization/repository rulesets for `main` with:

- Pull requests required; no direct pushes except a documented break-glass role.
- At least one approval and code-owner review for workflow, auth, security, migration, and contract changes.
- Dismiss stale approvals and require resolution of review conversations.
- Required checks from this specification, strict with the latest base branch.
- Required signed commits if compatible with the contributor workflow.
- Force pushes and branch deletion disabled.
- Merge queue enabled when repository activity warrants it.
- Rules apply to administrators; bypass is audited and time-bounded.

Release workflows must depend on the same immutable build/test result used for review, rebuild only when provenance demands it, and never publish from an unverified mutable workspace.

## Scheduled and release-only gates

| Frequency | Checks |
|---|---|
| Nightly | Full mutation suite, all-browser E2E, dependency/container scan, flaky-test repetition, migration upgrade matrix |
| Weekly | Full secret-history scan, license report, dependency freshness report, performance trend, restore test |
| Release | Full quality suite, clean artifact rebuild, SBOM, provenance/attestation, image smoke, rollback rehearsal where applicable |

## Rollout stages

### Stage 0: Make checks truthful

- Fix private registry installation and runtime/package-manager versions.
- Remove placeholder/no-test success behavior.
- Fail on warnings, unhandled errors, leaked handles, skipped/focused tests, and missing coverage providers.
- Add build and formatting checks.

### Stage 1: Protect all new work

- Enforce 100% changed-code coverage.
- Publish baseline global coverage and prohibit decreases.
- Add required rulesets/checks and security scanning.

### Stage 2: Characterize critical behavior

- Complete auth, session, RBAC, persistence, migration, cache, event, email, and critical browser journey suites.
- Add API/event/package contracts and mutation testing for critical logic.

### Stage 3: Complete non-critical coverage

- Cover remaining UI states, utilities, templates, config branches, and presentational behavior.
- Reach 100% global and per-file thresholds in every repository.

### Stage 4: Authorize refactoring

- Demonstrate 100 consecutive green required-check runs.
- Close or accept all critical characterization findings through ADRs.
- Freeze the quality contract; refactoring work must preserve it from the first commit.

## Gate exception process

Exceptions are rare, explicit records—not inline `continue-on-error` flags. Each exception requires:

- Exact check, repository, and affected paths.
- Technical reason and evidence that a tool defect or equivalent mutant is involved.
- Risk assessment and compensating verification.
- Named owner, issue link, approval, and expiration date.
- Maximum duration of seven days for test quarantine and 30 days for non-test tooling exceptions.

Expired exceptions fail the gate automatically.
