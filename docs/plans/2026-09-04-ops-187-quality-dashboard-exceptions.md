# OPS-187 Quality Dashboard, Flake Tracking, and Exception Expiry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a deterministic, fail-closed quality dashboard that reports trustworthy gate evidence, tracks flakes, and rejects invalid or expired exceptions without allowing any missing or bad evidence to appear green.

**Architecture:** Treat workflow artifacts and GitHub API responses as untrusted inputs. Pure Node modules will validate versioned observations, normalize coverage/security/release evidence, retain ordered check history, and derive an explicit non-green status whenever evidence is absent, stale, malformed, unavailable, cancelled, failing, or excepted. A separate governance validator will own the flake register and enhanced exception contract. A GitHub Actions collector will create a candidate static site from immutable artifacts; it will retain a non-green candidate for diagnosis but deploy only a complete, fresh candidate for enrolled repositories.

**Tech Stack:** Node.js 24 ESM, Node test runner and built-in coverage, JSON Schema draft 2020-12, GitHub Actions, GitHub REST API via `gh`, GitHub Pages static deployment, Prettier, ESLint, actionlint.

---

## Purpose, boundaries, and decisions

This is the detailed execution plan for the existing [OPS-187 task record](../projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-004-adoption-stability-evidence/tasks/OPS-187-quality-dashboard-exceptions.md). It refines that record; it does not change the milestone scope.

### What OPS-187 delivers

- A versioned observation format that binds every displayed check to its repository, commit, workflow SHA, run URL, timestamp, source artifact URL, and SHA-256 checksum.
- A dashboard that distinguishes `passing`, `failing`, `missing`, `unavailable`, `stale`, `malformed`, `cancelled`, `excepted`, and `unknown`; only `passing` is green.
- Coverage display for statements, branches, functions, and lines; security and release evidence state; active exception and flake summaries; and a stable last-updated time.
- Fail-closed exception validation and a flake register that makes a quarantine visible and prevents it from representing a pass.
- Deterministic Markdown and accessible, dependency-free HTML output, plus a scheduled/manual/default-branch GitHub Actions publication path.

### Explicit scope boundary with OPS-189

`gh-action-templates` is the initial enrolled repository. The catalog lists the seven product repositories from day one, but they are **not enrolled** until their OPS-189 adoption PR has merged and supplies the required evidence artifact. Before enrollment, their required checks render as `unavailable` with the reason `awaiting OPS-189 adoption`; they are never omitted and never green.

The publishing gate applies to every *enrolled* repository and required check. It rejects a candidate when any enrolled source cannot be read or is missing, stale, malformed, cancelled, failed, unknown, or excepted. OPS-189 expands enrollment only after its raw artifacts and dashboard comparison tests prove the new source is truthful. This lets OPS-187 establish the reporting system before broad adoption without weakening the reporting contract.

### Trust and publication decisions

1. The collector must use a centrally installed GitHub App with only `actions: read`, `contents: read`, and `issues: read` for the eight listed repositories. Generate a short-lived installation token in the workflow; do not use a personal access token or place credentials in the rendered site.
2. Public output contains status, aggregate metrics, immutable evidence URLs, timestamps, and remediation identifiers only. It must not include scanner findings, raw SARIF, secret values, exception rationale, or private logs. If the selected Pages visibility would expose a private evidence URL, publish the dashboard artifact only until visibility is approved.
3. `quality-observation.schema.json` is the sole dashboard input contract. Existing `coverage/normalized.json`, `coverage/coverage-decision.json`, normalized security findings, and container release evidence are adapted into observations; the dashboard must not scrape console text.
4. Observations are append-only input. The aggregator keeps all valid observations in timestamp/run-ID order, selects the newest observation per check for current display, and retains earlier failures in history. A newer success may supersede a prior failure for *current status* only; an older success can never overwrite a newer failure.
5. The freshness policy begins at 24 hours and is read from versioned policy data. Tests use a fixed injected clock, never the wall clock.

### Status precedence

For an expected check, derive status in this order. The first applicable rule wins; this order is encoded once in `reporting/status-policy.json` and used by the renderer and publication gate.

| Condition | Derived status | Green? |
|---|---|---|
| Expected observation is absent | `missing` | No |
| Source cannot be fetched or repository is not enrolled | `unavailable` | No |
| JSON/schema/checksum validation fails | `malformed` | No |
| Newest valid observation exceeds freshness threshold | `stale` | No |
| Newest run is cancelled or skipped | `cancelled` | No |
| Newest run records failure | `failing` | No |
| Active approved exception or active flake quarantine applies | `excepted` | No |
| Newest run is a complete success and all required evidence is valid/fresh | `passing` | Yes |
| Any other explicit producer outcome | `unknown` | No |

`excepted` has its own visible state so it cannot be confused with success. A release check may be marked `notRequired` for a repository/run type, but that is a displayed applicability value rather than a successful required check.

## Delivery sequence and independent test boundaries

| Slice | Outcome | Primary automated proof |
|---|---|---|
| 1 | Stable reporting contract and command entry point | `test/reporting-contract.test.mjs` |
| 2 | Coverage adapter with all four metrics | `test/reporting-coverage.test.mjs` |
| 3 | Security/release adapters with checksummed evidence | `test/reporting-evidence.test.mjs` |
| 4 | Status calculation and historical aggregation | `test/quality-snapshot.test.mjs` |
| 5 | Expiring exceptions with active remediation | `test/reporting-governance.test.mjs` |
| 6 | Flake/quarantine rules | `test/reporting-governance.test.mjs` |
| 7 | Deterministic, accessible static dashboard | `test/dashboard-render.test.mjs` |
| 8 | Mocked GitHub collector and strict publish decision | `test/reporting-collector.test.mjs` |
| 9 | Least-privilege workflow and deployed candidate evidence | `test/quality-dashboard-workflow.test.mjs` and actionlint |
| 10 | Merged-main verification and required task closeout | GitHub merged-state audit and documentation checks |

## Task 1: Establish the reporting catalog, schema, and test command

**Files:**

- Create: `reporting/repositories.schema.json`
- Create: `reporting/repositories.json`
- Create: `reporting/quality-observation.schema.json`
- Create: `reporting/status-policy.json`
- Create: `scripts/reporting/contract.mjs`
- Create: `test/reporting-contract.test.mjs`
- Modify: `package.json`

**Design:** The catalog contains all eight repositories, their GitHub slug, enrolled state, enrollment reason, expected checks, and whether a release result is applicable. It must contain `gh-action-templates` as enrolled and the seven consumers as unenrolled with the explicit OPS-189 reason. `quality-observation.schema.json` has `schemaVersion: 1` and requires this minimum shape:

```json
{
  "schemaVersion": 1,
  "repository": "gh-action-templates",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "workflowSha": "89abcdef0123456789abcdef0123456789abcdef",
  "check": "Quality / core",
  "family": "core",
  "outcome": "success",
  "occurredAt": "2026-09-04T12:00:00Z",
  "source": {
    "runId": "123456789",
    "runUrl": "https://github.com/otedesco/gh-action-templates/actions/runs/123456789",
    "artifactUrl": "https://github.com/otedesco/gh-action-templates/actions/runs/123456789/artifacts/1",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "details": {}
}
```

Use strings for run IDs so large GitHub IDs cannot lose precision. Permit only the source-free `unavailable` producer outcome; all other outcomes require the complete `source` object. The policy includes `schemaVersion: 1`, `freshnessHours: 24`, status precedence, and a `requiredCheckFamilies` list. Keep validation handwritten and dependency-free, following the defensive style in `scripts/security/validate-policy.mjs`.

**Step 1: Write the failing catalog/contract tests.**

Add table-driven cases that reject duplicate repository slugs, an unknown expected check family, an enrolled consumer without an artifact contract, a missing OPS-189 enrollment reason, non-40-character commits/workflow SHAs, missing evidence URLs/checksums, unsupported outcome, invalid timestamp, and unknown schema version. Assert that the initial catalog contains exactly the central repository plus the seven named consumers.

**Step 2: Run the focused test to prove the red state.**

Run: `pnpm exec node --test test/reporting-contract.test.mjs`

Expected: FAIL because the contract module, schemas, and package command do not exist.

**Step 3: Implement the smallest pure contract module.**

Export `validateRepositoryCatalog(catalog)`, `validateObservation(observation)`, `validateStatusPolicy(policy)`, and `stableJson(value)`. Each returns a sorted array of human-readable errors; it must not read files, call GitHub, or examine time. `stableJson` serializes object keys recursively so downstream checksums are reproducible.

**Step 4: Add the reporting test command.**

Add this command to `package.json`, initially with the first test file and then extend it in later tasks:

```json
"test:reporting": "node --experimental-test-coverage --test-coverage-lines=100 --test-coverage-functions=100 --test test/reporting-contract.test.mjs"
```

**Step 5: Run the test and static checks.**

Run: `pnpm test:reporting && pnpm lint:check && pnpm format:check`

Expected: PASS, including 100% line/function coverage for the new contract module.

**Step 6: Commit the isolated contract.**

```bash
git add reporting/repositories.schema.json reporting/repositories.json reporting/quality-observation.schema.json reporting/status-policy.json scripts/reporting/contract.mjs test/reporting-contract.test.mjs package.json
git commit -m "test: define quality reporting contract"
```

## Task 2: Normalize coverage evidence into validated observations

**Files:**

- Create: `scripts/reporting/normalize-coverage.mjs`
- Create: `test/reporting-coverage.test.mjs`
- Create: `test/fixtures/reporting/coverage/{valid,missing-metric,failed-decision,checksum-mismatch}/**`
- Modify: `scripts/reporting/contract.mjs`
- Modify: `package.json`

**Design:** Consume the normalized schema already emitted by `scripts/coverage/normalize.mjs` and the `coverage/coverage-decision.json` emitted by `.github/actions/coverage-gate/run.mjs`; do not reimplement coverage parsing. The adapter calculates four aggregate metrics by summing `covered` and `total` over normalized files, preserves the per-metric totals, and emits one `family: "coverage"` observation. A coverage decision with `passed: false` maps to raw `failure`; a missing, unreadable, invalid, or checksum-mismatched companion artifact must throw a validation error that the aggregation layer will classify as `malformed`.

**Step 1: Write failing adapter tests.**

Assert exact totals for a two-file fixture and prove all four metric labels (`statements`, `branches`, `functions`, `lines`) are present. Add independent fixtures for a false gate decision, omitted branch metric, invalid JSON, and a SHA-256 mismatch. Assert the source fields are copied from the envelope rather than inferred from paths.

**Step 2: Prove the test fails before implementation.**

Run: `pnpm exec node --test test/reporting-coverage.test.mjs`

Expected: FAIL with module-not-found for `scripts/reporting/normalize-coverage.mjs`.

**Step 3: Implement a narrow adapter.**

Export:

```js
export function normalizeCoverageObservation({ envelope, normalizedCoverage, coverageDecision, actualSha256 }) {
  // Validate the envelope, compare actualSha256 to envelope.source.sha256,
  // sum covered/total for all four metrics, and return one observation.
}
```

Reject an empty `files` object, negative/non-integer counts, a missing metric, and a source checksum mismatch. Do not write output files or decide dashboard status here.

**Step 4: Extend the package command and run it.**

Update `test:reporting` to include `test/reporting-coverage.test.mjs` and run:

`pnpm test:reporting`

Expected: PASS; the malformed fixture must be rejected instead of being converted to zero coverage or success.

**Step 5: Commit the coverage slice.**

```bash
git add scripts/reporting/normalize-coverage.mjs scripts/reporting/contract.mjs test/reporting-coverage.test.mjs test/fixtures/reporting/coverage package.json
git commit -m "feat: normalize dashboard coverage evidence"
```

## Task 3: Normalize core, security, and release evidence without scraping logs

**Files:**

- Create: `scripts/reporting/normalize-evidence.mjs`
- Create: `test/reporting-evidence.test.mjs`
- Create: `test/fixtures/reporting/evidence/{core-pass,core-cancelled,security-pass,security-failure,release-pass,release-malformed}/**`
- Modify: `scripts/reporting/contract.mjs`
- Modify: `package.json`

**Design:** Map the existing artifacts and their explicit job results to observations:

- Core evidence represents the named `Quality / core` check and includes command/check result data only, never command output.
- Security evidence is derived from the existing normalized findings and aggregate job outcome. Include policy/scanner version identifiers and counts only; do not expose raw finding subjects or messages.
- Release evidence uses the output accepted by `scripts/container/verify-release-evidence.mjs`. Require its immutable image digest, all five required job outcomes, and checksums; release is displayed as `notRequired` only when the repository catalog says it does not produce releases for this run.

**Step 1: Write failing evidence-adapter tests.**

Use fixtures that verify success mapping, a cancelled core run, an aggregate security failure, a release with a failed `smoke` job, an unknown scanner version, a missing source checksum, and a release whose artifact SHA no longer matches its content. Assert adapters expose no sentinel finding/secret value when fixtures contain one.

**Step 2: Run the test before creating the module.**

Run: `pnpm exec node --test test/reporting-evidence.test.mjs`

Expected: FAIL because the adapters are absent.

**Step 3: Implement explicit adapters.**

Export `normalizeCoreObservation`, `normalizeSecurityObservation`, and `normalizeReleaseObservation`. Reuse `validateReleaseEvidence` rather than copy its release invariants. The only raw outcome mappings are `success`, `failure`, `cancelled`, `skipped`, and `unavailable`; malformed source material throws. Do not treat a scanner report with zero findings as proof that its workflow completed successfully.

**Step 4: Run all reporting tests and formatter/linter checks.**

Run: `pnpm test:reporting && pnpm lint:check && pnpm format:check`

Expected: PASS. The public data contract contains no raw scanner finding or sentinel secret text.

**Step 5: Commit the evidence adapters.**

```bash
git add scripts/reporting/normalize-evidence.mjs scripts/reporting/contract.mjs test/reporting-evidence.test.mjs test/fixtures/reporting/evidence package.json
git commit -m "feat: normalize core security and release evidence"
```

## Task 4: Implement status precedence and immutable snapshot aggregation

**Files:**

- Create: `reporting/quality-snapshot.schema.json`
- Create: `scripts/reporting/normalize-snapshot.mjs`
- Create: `test/quality-snapshot.test.mjs`
- Create: `test/fixtures/reporting/snapshots/{passing,failing,missing,unavailable,stale,malformed,cancelled,excepted,unknown}/**`
- Modify: `scripts/reporting/contract.mjs`
- Modify: `package.json`

**Design:** A snapshot contains the catalog version, policy version, deterministic `generatedAt`, all source observations, all per-check current states, historical observations ordered by `(occurredAt, runId)`, and a top-level `publicationAllowed` boolean. The normalizer takes `{ catalog, policy, observations, flakes, exceptions, now }`; it receives `now` as an argument. It must add synthetic `missing` records for expected checks with no observation and `unavailable` records for unenrolled repositories. It must never mutate or discard the input history.

For two valid observations at the same timestamp/check, use the stable tie-breaker `failure > cancelled > skipped > success`; then use numeric-string run ID comparison. For different timestamps, use the newest timestamp. A newer failure therefore always outranks any older success. The repository’s overall state is the highest-precedence non-passing state among its required checks, with check name as a stable tie-breaker.

**Step 1: Write the full red status table.**

Create one minimal fixture per output state. Include an older success followed by a newer failure; a newer success followed by an older failure; malformed JSON; a 24-hour-and-one-second old observation; a cancelled result; an active exception; an active flake quarantine; and a missing required check. Assert every case is non-green except a complete, fresh success.

**Step 2: Run the new focused test.**

Run: `pnpm exec node --test test/quality-snapshot.test.mjs`

Expected: FAIL because snapshot normalization is absent.

**Step 3: Implement pure snapshot normalization.**

Export `deriveStatus`, `selectCurrentObservation`, `normalizeSnapshot`, and `canPublish`. Keep source parse errors as structured `{ status: "malformed", reason }` records; do not throw away the rest of the repository’s data. `canPublish` returns false unless every enrolled required check is `passing` and the snapshot itself validates against `quality-snapshot.schema.json`.

**Step 4: Prove determinism and failure history retention.**

Run the normalizer twice with a fixed `now` and deep-compare the output. Assert that the historical array still contains both the old success and newer failure and that reversing input order does not change the generated snapshot.

**Step 5: Run the reporting suite.**

Run: `pnpm test:reporting`

Expected: PASS with every negative fixture visibly non-green.

**Step 6: Commit the aggregation boundary.**

```bash
git add reporting/quality-snapshot.schema.json scripts/reporting/normalize-snapshot.mjs scripts/reporting/contract.mjs test/quality-snapshot.test.mjs test/fixtures/reporting/snapshots package.json
git commit -m "feat: derive fail-closed quality snapshots"
```

## Task 5: Extend exception validation with remediation and expiry enforcement

**Files:**

- Modify: `security/exception.schema.json`
- Modify: `security/exceptions.json`
- Modify: `scripts/security/validate-policy.mjs`
- Create: `scripts/reporting/validate-governance.mjs`
- Create: `test/reporting-governance.test.mjs`
- Create: `test/fixtures/reporting/governance/{valid-exception,missing-owner,missing-remediation,broad-scope,expired,duplicate,closed-remediation}/**`
- Modify: `package.json`

**Design:** Preserve all existing security exception fields and add a required, non-empty remediation object:

```json
"remediation": {
  "issue": "https://linear.app/opspace/issue/OPS-999/example",
  "status": "open",
  "verifiedAt": null
}
```

An active exception requires `status: "open"`; a `closed` remediation means the exception must be removed and is invalid. `verifiedAt` is required and ISO-8601 only when the status is `closed`, which makes a closed record auditable but unusable as an exception. Continue to require exact `tool`, `rule`, and `subject` scope, unique IDs/scopes, a non-wildcard scope, named owner/approver, compensating control, and future UTC expiry. `validate-governance.mjs` invokes the existing policy validator with an injected clock and produces stable JSON diagnostics for CI and the dashboard.

**Step 1: Write red exception-governance tests.**

Assert an otherwise valid exception passes at a fixed future date. Independently assert failures for missing owner, missing remediation issue, `status: closed`, a past/invalid expiry, a wildcard scope, duplicated ID/scope, and an unapproved/malformed object. Keep a test that confirms exact-scope matching still works for security findings.

**Step 2: Prove the test fails.**

Run: `pnpm exec node --test test/reporting-governance.test.mjs`

Expected: FAIL because the schema and validator do not require remediation.

**Step 3: Make the minimal schema and validator changes.**

Extend `REQUIRED_EXCEPTION_FIELDS`, schema properties, unknown-property checks, and validation messages. Maintain backwards-incompatible schema data as version 2 only if an existing committed exception needs migration; because `security/exceptions.json` is empty, prefer keeping schema versioning within the object contract and avoid a compatibility branch.

**Step 4: Add the CI-friendly governance CLI.**

The CLI accepts `--now <UTC>` for deterministic local/fixture runs and uses current UTC only when omitted. It exits non-zero for any invalid exception and emits a stable sorted summary containing IDs and rules, not confidential rationale text.

**Step 5: Run focused and existing security tests.**

Run: `pnpm test:reporting && pnpm test:security-policy && pnpm test:security-fixtures`

Expected: PASS. Existing exact-scope behavior must remain intact; old exception fixtures must be updated deliberately rather than silently accepted.

**Step 6: Commit the exception slice.**

```bash
git add security/exception.schema.json security/exceptions.json scripts/security/validate-policy.mjs scripts/reporting/validate-governance.mjs test/reporting-governance.test.mjs test/fixtures/reporting/governance package.json
git commit -m "feat: enforce exception remediation and expiry"
```

## Task 6: Add owned flake records and quarantine-to-exception binding

**Files:**

- Create: `reporting/flake.schema.json`
- Create: `reporting/flakes.json`
- Modify: `scripts/reporting/validate-governance.mjs`
- Modify: `scripts/reporting/normalize-snapshot.mjs`
- Modify: `test/reporting-governance.test.mjs`
- Modify: `test/quality-snapshot.test.mjs`
- Create: `test/fixtures/reporting/governance/{valid-flake,missing-flake-owner,missing-reproduction,missing-remediation,invalid-quarantine}/**`
- Modify: `package.json`

**Design:** `flakes.json` starts as an empty array. Each active flake requires `id`, `repository`, `check`, `owner`, `impact`, `firstOccurredAt`, `latestOccurredAt`, `evidenceUrl`, `reproduction` (`reproduced`, `not-reproduced`, or `investigating`), `remediationIssue`, and `status`. An active `quarantined` flake additionally requires `exceptionId`, and that ID must name a valid, active exception with an exact matching repository/check scope. A flake may be closed only when it contains `resolvedAt` and a verified remediation reference; closed flakes cannot quarantine a check.

No automatic retry field is permitted. A retry is another observation in history. The snapshot maps an active quarantined flake or active exception for a current check to `excepted`, which is explicitly non-green and makes `publicationAllowed` false.

**Step 1: Add failing flake tests.**

Add test cases for valid active/closed records, missing owner, reversed occurrence times, missing reproduction evidence, missing remediation, an active quarantine with no exception, a quarantine bound to an expired exception, duplicate flake IDs, and an arbitrary `retryCount` property. Assert diagnostics are deterministic.

**Step 2: Run only the governance test.**

Run: `pnpm exec node --test test/reporting-governance.test.mjs`

Expected: FAIL because flake schema/validation is not implemented.

**Step 3: Implement flake validation and snapshot linkage.**

Export `validateFlakes(flakes, exceptions, now)` from the governance module. Add an `activeGovernanceForCheck` helper used by snapshot normalization. Validate the `exceptionId` before classification so a broken quarantine is `malformed`, not `excepted` or `passing`.

**Step 4: Add and run the cross-module quarantine test.**

In `quality-snapshot.test.mjs`, feed a successful fresh check plus an active valid quarantine. Assert the current check is `excepted`, the repository is non-green, and `canPublish` is false. Then substitute an invalid exception and assert `malformed`.

Run: `pnpm test:reporting`

Expected: PASS; no flake or quarantine can manufacture a green dashboard/campaign state.

**Step 5: Commit flake governance.**

```bash
git add reporting/flake.schema.json reporting/flakes.json scripts/reporting/validate-governance.mjs scripts/reporting/normalize-snapshot.mjs test/reporting-governance.test.mjs test/quality-snapshot.test.mjs test/fixtures/reporting/governance package.json
git commit -m "feat: track flakes and quarantine governance"
```

## Task 7: Render a deterministic, accessible static dashboard

**Files:**

- Create: `scripts/reporting/render-dashboard.mjs`
- Create: `test/dashboard-render.test.mjs`
- Create: `test/fixtures/reporting/render/{passing,failing,missing,stale,malformed,excepted}/snapshot.json`
- Create: `docs/quality-dashboard/README.md`
- Modify: `package.json`

**Design:** `renderDashboard(snapshot)` returns two strings, `index.html` and `README.md`; `writeDashboard(outputDirectory, snapshot)` writes them plus `snapshot.json` and `dashboard-summary.json` using stable JSON. HTML is server-rendered, no JavaScript, no third-party assets, no client-side token, and every interpolated value passes through an HTML text/attribute escaping helper. The page contains a `<main>` landmark, one H1, a last-updated `<time datetime>`, status text in addition to color, a per-repository table, all four coverage metrics, security/release state, and active-exception/flake counts. Links use descriptive labels and `rel="noreferrer"` when opened in a new tab.

Avoid committing a live generated dashboard to `main`; the workflow will upload/deploy generated output. Commit only fixtures and, if needed, a static empty-state template.

**Step 1: Write failing renderer tests from snapshots.**

For every fixture, assert the exact non-green status label, stable repository/check ordering, all four metric headings, source links, and no raw finding/rationale/sentinel secret text. Assert the output has `<main>`, a table caption, `scope="col"`, and a text status rather than relying on a CSS color class.

**Step 2: Run the renderer test in the red state.**

Run: `pnpm exec node --test test/dashboard-render.test.mjs`

Expected: FAIL because rendering is absent.

**Step 3: Implement pure rendering first.**

Implement `escapeHtml`, `renderDashboard`, and `writeDashboard`. Sort repositories, checks, active exceptions, and flakes by stable ID/name before rendering. Do not add a templating dependency or client-side fetch.

**Step 4: Prove byte-for-byte deterministic output.**

Render the same passing fixture into two separate temporary directories using a fixed snapshot. Calculate SHA-256 for each of `index.html`, `README.md`, `snapshot.json`, and `dashboard-summary.json`; assert the two maps are exactly equal.

**Step 5: Run the full reporting suite and commit.**

Run: `pnpm test:reporting && pnpm lint:check && pnpm format:check`

Expected: PASS.

```bash
git add scripts/reporting/render-dashboard.mjs test/dashboard-render.test.mjs test/fixtures/reporting/render docs/quality-dashboard/README.md package.json
git commit -m "feat: render deterministic quality dashboard"
```

## Task 8: Collect evidence through a mocked GitHub API boundary and gate publication

**Files:**

- Create: `scripts/reporting/collect-evidence.mjs`
- Create: `scripts/reporting/generate-dashboard.mjs`
- Create: `test/reporting-collector.test.mjs`
- Create: `test/fixtures/reporting/collector/{complete,artifact-missing,artifact-stale,forbidden,checksum-mismatch}/**`
- Modify: `package.json`

**Design:** Keep HTTP interaction in `collect-evidence.mjs`; all adapters and aggregation remain pure. Inject `{ request, now }` in tests. In production the request adapter uses `gh api` with a short-lived `GH_TOKEN` available only to the collection step. For each *enrolled* repository/check, the collector obtains a completed default-branch run, immutable workflow SHA, artifact metadata/download URL, and actual artifact bytes. It calculates the artifact SHA-256 itself, builds observations with adapters, and writes an input manifest. It never relies on artifact names alone or on an unauthenticated redirect.

`generate-dashboard.mjs` invokes the collector, governance validation, snapshot normalizer, and renderer. It always writes a candidate directory and machine-readable summary. In `--strict` mode it exits non-zero if `canPublish(snapshot)` is false, after preserving the candidate as a diagnostic artifact. In `--preview` mode it returns zero and makes every bad condition visible in the candidate; preview is test-only until deployment visibility is approved.

**Step 1: Write mock-request collector tests.**

Use a fixture request function rather than network access. Test a complete fresh result; an artifact missing from one enrolled expected check; a run older than the policy; HTTP 403 for an unenrolled versus enrolled repository; a duplicate artifact; a mismatched checksum; and a stale workflow SHA. Assert the enrolled failure makes strict mode exit non-zero but still writes candidate `snapshot.json` with the exact non-green reason.

**Step 2: Verify tests fail before implementation.**

Run: `pnpm exec node --test test/reporting-collector.test.mjs`

Expected: FAIL because the collector/generator modules are absent.

**Step 3: Implement the network boundary and generator.**

Expose `collectEvidence({ catalog, policy, request, now })` and `generateDashboard({ mode, outputDirectory, request, now })`. Validate response content type/size before parsing JSON and make artifact uniqueness explicit. Never log authorization headers, token values, raw findings, or artifact contents. Convert a recoverable source-access failure to an `unavailable` observation; rethrow only malformed local configuration or unsafe output paths.

**Step 4: Add commands and run deterministic collection tests.**

Add `reporting:preview` and `reporting:strict` package scripts that accept explicit fixture/input paths locally. Extend `test:reporting` with the collector test.

Run: `pnpm test:reporting`

Expected: PASS; `complete` is publication-eligible and every negative fixture is not.

**Step 5: Commit the collector slice.**

```bash
git add scripts/reporting/collect-evidence.mjs scripts/reporting/generate-dashboard.mjs test/reporting-collector.test.mjs test/fixtures/reporting/collector package.json
git commit -m "feat: collect and gate quality dashboard evidence"
```

## Task 9: Add least-privilege collection/publication workflow and operational documentation

**Files:**

- Create: `.github/workflows/quality-dashboard.yml`
- Create: `test/quality-dashboard-workflow.test.mjs`
- Modify: `supply-chain/action-references.json`
- Modify: `supply-chain/workflow-permissions.json`
- Modify: `docs/quality-dashboard/README.md`
- Create: `docs/evidence/OPS-187-dashboard.md`
- Modify: `package.json`

**Workflow design:**

```text
push to main / daily schedule / manual dispatch
  -> mint short-lived dashboard GitHub App token
  -> collect + validate + render candidate (read-only)
  -> upload diagnostic candidate artifact (always)
  -> deploy candidate only when strict publication passes
```

Use an explicit UTC schedule, `push` on `main`, and `workflow_dispatch`. Add a concurrency group such as `quality-dashboard-publication` with `cancel-in-progress: true`. Use job-level permissions:

- `mint-token`: `contents: read`; it receives only `QUALITY_DASHBOARD_APP_ID` and `QUALITY_DASHBOARD_PRIVATE_KEY` and produces a masked short-lived installation token.
- `collect-render`: `contents: read`; it receives the token only as a step-level environment variable. The token itself is limited by its GitHub App installation to the three read permissions declared above.
- `deploy`: `pages: write` and `id-token: write` only; it receives no secret and only runs after strict validation.

Pin every remote action to a reviewed 40-character SHA and add its exact manifest entry before referencing it. This will include the App-token, Pages-artifact, and Pages-deploy actions selected during implementation. Do not use `secrets: inherit`, a personal token, `continue-on-error`, `|| true`, automatic retries, or a `contents: write` deployment.

**Step 1: Write failing workflow contract tests.**

Assert the workflow has exactly the allowed events, concurrency, explicit top/job-level permissions, no broad write scope, strict command before deploy, and an `if: always()` diagnostic artifact upload. Assert the deploy job requires the strict collection/render job and uses no secrets. Assert every `uses:` reference is a SHA and every new reference has matching reviewed manifest metadata. Assert the workflow permission manifest lists the new file and every job exactly.

**Step 2: Run workflow tests before the workflow exists.**

Run: `pnpm exec node --test test/quality-dashboard-workflow.test.mjs`

Expected: FAIL because `.github/workflows/quality-dashboard.yml` is absent.

**Step 3: Resolve actions and update the immutable-reference manifest.**

Before editing the YAML, record each selected action's owner/repository/path/SHA/release/review date/purpose/repository in `supply-chain/action-references.json`. Verify the SHA from the upstream release and preserve the review evidence in the PR description; do not guess a tag or use a mutable ref.

**Step 4: Implement workflow and policy entry.**

Create the workflow, add its exact policy to `workflow-permissions.json`, and add `test:quality-dashboard-workflow` if a dedicated command improves local review. Ensure a strict failure uploads the candidate artifact but never deploys it. Ensure outputs are checksummed and record schema/policy versions in `dashboard-summary.json`.

**Step 5: Run all repository contract checks.**

Run:

```bash
pnpm test:reporting
pnpm exec node --test test/quality-dashboard-workflow.test.mjs
pnpm test:action-references
pnpm test:workflow-permissions
pnpm lint:workflows
pnpm lint:check
pnpm format:check
```

Expected: PASS. Add a negative workflow fixture if a test could otherwise pass while granting an extra permission or deploying a stale candidate.

**Step 6: Update the operator guide and evidence template.**

Document the input artifact contract, every status meaning, enrollment procedure for OPS-189, 24-hour freshness policy, temporary App-token setup, how to inspect a failed candidate, how to add/remove an exception or flake, and how a status returns to passing. `docs/evidence/OPS-187-dashboard.md` starts as a template with placeholders for run URL, workflow SHA, policy/schema versions, candidate checksum, strict result, and deployment URL; do not invent live results.

**Step 7: Commit workflow and operational docs.**

```bash
git add .github/workflows/quality-dashboard.yml test/quality-dashboard-workflow.test.mjs supply-chain/action-references.json supply-chain/workflow-permissions.json docs/quality-dashboard/README.md docs/evidence/OPS-187-dashboard.md package.json
git commit -m "ci: publish validated quality dashboard"
```

## Task 10: Run end-to-end validation, merge implementation, and perform the required closeout

**Files:**

- Modify: `docs/evidence/OPS-187-dashboard.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-004-adoption-stability-evidence/tasks/OPS-187-quality-dashboard-exceptions.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-004-adoption-stability-evidence/MLS-004-adoption-stability-evidence.md`

**Step 1: Validate an initial real candidate.**

On the implementation branch, manually dispatch `quality-dashboard.yml` against the central repository. Confirm the candidate has valid central evidence and that every still-unenrolled product repository is explicitly `unavailable` for the OPS-189 reason. Exercise a deliberately invalid fixture in CI/local generation and prove it produces `malformed`/non-green and blocks deployment. Do not modify a production exception or create a fake flake merely to make evidence.

Record the real run URL, commit, workflow SHA, status-policy/schema versions, dashboard/candidate checksums, strict result, and deployment URL (if visibility is approved) in `docs/evidence/OPS-187-dashboard.md`. If cross-repository App access is not yet provisioned, record that central-only enrollment was tested and leave consumer entries unenrolled; do not claim all repositories are live.

**Step 2: Run the complete pre-merge suite.**

Run:

```bash
pnpm quality:check
pnpm test:reporting
pnpm test:security-policy
pnpm test:security-fixtures
pnpm test:action-references
pnpm test:workflow-permissions
pnpm lint:workflows
```

Expected: PASS. Attach command output/check results and the workflow run link to the implementation pull request. Review the rendered HTML/Markdown artifact manually for accessibility labels, status clarity, deterministic ordering, and absence of sensitive content.

**Step 3: Open and merge implementation pull request(s).**

Keep pure reporting/governance work and CI/deployment work reviewable; one or two implementation PRs are acceptable, but each must be linked to OPS-187 and pass the required `Quality / core` and `Security / aggregate` checks. Do not call the task complete merely because a branch is pushed, a PR is open, or CI is green.

**Step 4: Verify the merged implementation on default `main`.**

Using the GitHub Codex app, verify every OPS-187 implementation PR is merged into `otedesco/gh-action-templates` default `main`. Record each merged PR URL and the resulting `main` commit in the evidence file. Re-run/inspect the main-branch dashboard workflow and verify its output corresponds to that exact workflow SHA and evidence checksums.

**Step 5: Create the required documentation-closeout branch and PR.**

Only after Step 4, update the OPS-187 task document with status `Completed`, the completion date, exact merged PR links/repository, architecture decisions, material files/workflows/contracts/policies, test/CI/manual validation, delivered behavior, known limitations, and OPS-189/OPS-188 follow-up boundary. In the same change, update MLS-004’s task list/progress and cumulative delivery summary. Preserve its planning content.

Synchronize the Linear OPS-187 issue to Done with a concise evidence-backed outcome. Update the connected Linear milestone’s progress/status only to the extent OPS-187 changes it; MLS-004 remains incomplete until OPS-188 and OPS-189 pass their own gates. A dedicated Linear project document is not required yet because the milestone is not complete.

**Step 6: Merge and verify the documentation closeout.**

Open the documentation closeout PR, merge it, and use the GitHub Codex app to verify it is present on `main`. Then verify the task document, milestone update, linked evidence, and Linear issue state. Only now describe OPS-187 as completed. If the implementation is merged but the closeout PR is still open, report exactly: `implementation merged; documentation closeout pending`.

## Final acceptance checklist

- Every dashboard input identifies repository, commit, workflow SHA, check, timestamp, evidence URL, and independently checked artifact SHA-256.
- Missing, unavailable, stale, malformed, cancelled, failed, unknown, and excepted states are visible and non-green.
- A newer failure outranks an older success; historical failures remain in the snapshot.
- The dashboard shows all four coverage metrics plus security/release state without exposing scanner findings or secrets.
- An active exception is exact-scope, owned, approved, remediating, and unexpired; invalid/expired/closed exceptions fail validation.
- Each active flake is owned and diagnosable; an active quarantine has a valid exception and cannot become green or publication-eligible.
- Rendering is byte-identical for identical input and has accessible text equivalents for every status.
- The workflow is pinned, least-privilege, concurrency-controlled, server-side-token-only, and never deploys a non-green required enrolled source.
- Real run evidence, merged implementation PRs, and the separate documentation closeout PR are verified on `main` before OPS-187 is marked complete.
