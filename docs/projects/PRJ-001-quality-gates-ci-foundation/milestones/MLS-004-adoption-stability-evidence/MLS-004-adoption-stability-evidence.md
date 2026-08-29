# MLS-004: Adoption and Stability Evidence

- **Project:** `PRJ-001` — Quality Gates & CI Foundation
- **Linear milestone:** M4 — Adoption and stability evidence
- **Status:** Planned
- **Target date:** 2026-11-06
- **Linear progress at documentation time:** 0%
- **Owner:** Oswaldo Tedesco

## Purpose

`MLS-004` proves the quality foundation works consistently outside its central repository. It adds honest quality reporting and exception governance, adopts the approved contract in all seven product repositories, and completes a 100-run stability campaign with no active quarantine, hidden retry, leaked resource, nondeterministic failure, or false-positive green.

This is the project sign-off milestone. Completing implementation in `gh-action-templates` is insufficient; the milestone requires reviewed consumer adoption and sustained operational evidence.

## Entry criteria

Before adoption and stability qualification begins:

1. `MLS-003` quality, security, release, and branch policies are implemented and enforced.
2. Required check names and immutable reusable workflow releases are stable.
3. Each repository has a measured baseline and an owner for every known gap or exception.
4. Required workflows publish machine-readable status, coverage, security, and artifact evidence.
5. Branch rulesets prevent bypassing the checks used in the stability campaign.

## Deliverables

1. A quality dashboard that distinguishes passing, failing, unavailable, missing, stale, and excepted checks.
2. Flake tracking with ownership, first and latest occurrence, reproduction evidence, and remediation status.
3. Automated exception validation and expiry enforcement.
4. One reviewed quality-contract adoption pull request for each of the seven product repositories.
5. Stable check names and truthful measured baselines in every consumer.
6. One hundred consecutive required-gate runs without an active quarantine, hidden retry, nondeterministic failure, leaked resource, or false-positive green.
7. Final `PRJ-001` evidence and a current Linear project health update.

## Included issues

| Issue | Title | Estimate | Current state | Due date | Plan |
|---|---|---:|---|---|---|
| `OPS-187` | Add quality dashboard, flake tracking, and exception expiry automation | 5 | Backlog | 2026-10-18 | [Implementation plan](tasks/OPS-187-quality-dashboard-exceptions.md) |
| `OPS-188` | Prove 100 consecutive stable gate runs | 8 | Backlog | 2026-11-06 | [Implementation plan](tasks/OPS-188-stable-gate-runs.md) |
| `OPS-189` | Adopt the quality gate contract in all seven product repositories | 8 | Backlog | 2026-10-25 | [Implementation plan](tasks/OPS-189-adopt-quality-contract.md) |

Total estimated scope: 21 points.

## Execution order

```text
MLS-003 enforced foundation
  -> OPS-187 Dashboard, flake, and exception automation
  -> OPS-189 Seven repository adoption pull requests
       -> OPS-188 100 consecutive stable gate runs
            -> PRJ-001 sign-off
```

The dashboard must exist before broad adoption so missing or failed checks cannot disappear during rollout. The formal `OPS-188` sequence begins only after all seven adoption changes are merged and required checks are enforced, although preliminary runs may be used to discover and fix instability.

## Contract produced by the milestone

### Quality reporting contract

- Missing, unavailable, stale, or malformed data is never displayed as passing.
- Every reported result identifies repository, commit, workflow version, check, timestamp, and evidence link.
- Coverage trends include all four metrics and identify baseline changes.
- Security and release results identify policy, scanner or producer version, artifact digest, and exception state.
- Dashboard aggregation cannot overwrite a recent failure with an older success.

### Flake and exception contract

- A nondeterministic result is recorded as a defect, not hidden by an automatic retry.
- Each flake has an owner, reproduction or diagnostic evidence, impact, first occurrence, latest occurrence, and remediation issue.
- Quarantine requires an approved exception and cannot satisfy a mandatory stability run.
- Exceptions are schema-validated, narrowly scoped, owned, approved, and expiring.
- Invalid, unowned, or expired exceptions fail the applicable required check.

### Adoption contract

Each consumer adoption pull request:

- uses the approved immutable shared workflow release;
- exposes the canonical local commands;
- uses the accepted runtime and package-manager contract;
- installs reproducibly with a frozen lockfile;
- publishes truthful test, coverage, build, security, and release evidence as applicable;
- enables the approved required checks and ruleset behavior;
- records known legacy gaps without muting them;
- contains repository-specific positive and negative verification.

### Stability contract

- The campaign counts consecutive completed required-gate runs after full adoption and enforcement.
- A skipped, canceled, unavailable, retried, quarantined, or false-positive run does not count.
- Any nondeterministic failure, leaked handle/resource, infrastructure race, or incorrect green result resets the consecutive count after remediation.
- Runs identify the exact workflow version and repository revisions under test.
- Evidence remains available for the full campaign and project review.

## Adoption matrix

| Repository | Adoption emphasis |
|---|---|
| `commons` | Crypto/JWT-sensitive package gates, exports, coverage, and package release evidence. |
| `cache` | Redis behavior, package gates, coverage, and release evidence. |
| `server-utils` | Listener lifecycle, leaked-handle detection, package gates, coverage, and release evidence. |
| `notify` | Provider package gates, authenticated dependencies, coverage, and release evidence. |
| `cerberus` | Service, migration, private dependency, container, and release gates. |
| `hermes` | HTTP/worker, private dependency, dual-container, and release gates. |
| `web-app` | Next.js checks, tests, coverage, build, browser-ready artifacts, and dependency policy. |

## Evidence required for completion

- Dashboard fixtures for passing, failing, missing, unavailable, stale, malformed, and excepted results.
- Exception fixtures covering valid, invalid, expired, and unowned entries.
- Flake records and proof that retries or quarantines cannot create a passing campaign result.
- Seven merged adoption pull requests, each with repository-specific positive and negative evidence.
- Ruleset verification confirming the adopted checks are mandatory.
- A machine-readable ledger of all 100 consecutive qualifying runs.
- Investigation and remediation links for every preliminary or reset-causing failure.
- Final coverage, security, artifact, and workflow-version summaries.
- A Linear milestone and project update recording outcome, residual risk, and next dependent work.

## Exit criteria

`MLS-004` is complete when:

1. The dashboard cannot show green for a missing, unavailable, stale, malformed, or failed check.
2. Invalid and expired exceptions fail automatically and all active exceptions are owned.
3. All seven product repositories have merged, reviewed adoption changes with truthful measured baselines.
4. Adopted checks are required on protected branches.
5. One hundred consecutive qualifying gate runs complete under the stability contract.
6. No active quarantine, hidden retry, leaked resource, nondeterministic failure, or false-positive green remains.
7. `PRJ-001` exit evidence is complete and linked from Linear.

## Risks and controls

| Risk | Control |
|---|---|
| Dashboard aggregation treats absent data as success | Model missing, unavailable, stale, and malformed as explicit non-green states and test them. |
| Adoption PRs conceal legacy gaps to become green | Require measured baselines and owned remediation; prohibit placeholders, broad exclusions, and silent skips. |
| Repositories drift during a long rollout | Pin one approved workflow release and run the contract suite against every consumer before merge. |
| Automatic retries hide flakes | Disable hidden retries in required paths and reset the campaign after nondeterministic failure. |
| Low change volume delays 100 qualifying runs | Use approved scheduled runs against protected revisions without weakening the same required gates. |
| Workflow upgrades invalidate the campaign | Record exact versions; restart or formally bound the campaign when a material gate implementation changes. |
| Twenty-one points exceed a single cycle | Start reporting automation before rollout, adopt repositories in reviewable slices, and reforecast rather than reducing evidence. |

## Out of scope

- Completing every product repository's behavioral test backlog or final 100% global coverage; dependent characterization projects own that work.
- Declaring the entire platform ready for refactoring; the cross-system verification project owns the final go/no-go decision.
- Product feature delivery unrelated to adopting or proving the quality foundation.
- Treating preliminary runs before complete adoption as part of the formal 100-run campaign.

## Related documents

- [Project ADR](../../ADR-001-quality-gates-ci-foundation.md)
- [`MLS-003` security, release, and branch enforcement](../MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md)
- [Quality gate specification](../../../../quality-gates/gate-specification.md)
- [Testing and coverage strategy](../../../../testing/testing-and-coverage-strategy.md)
- [Linear portfolio execution plan](../../../../plans/linear-portfolio-execution.md)
