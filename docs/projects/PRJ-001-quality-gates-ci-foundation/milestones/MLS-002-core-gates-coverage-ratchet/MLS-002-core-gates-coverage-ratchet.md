# MLS-002: Core Gates and Coverage Ratchet

- **Project:** `PRJ-001` — Quality Gates & CI Foundation
- **Linear milestone:** M2 — Core gates and coverage ratchet
- **Status:** Complete — 2026-09-02
- **Target date:** 2026-10-02
- **Linear progress at completion:** 100%
- **Owner:** Oswaldo Tedesco

## Purpose

`MLS-002` turns the interfaces accepted in `MLS-001` into mandatory, truthful core quality gates. It ensures formatting, linting, type checking, unit tests, coverage, and builds fail for the defects they claim to detect. It also introduces 100% changed-code coverage, a non-decreasing global coverage ratchet, immutable workflow references, and explicit least-privilege secret handling.

The milestone separates gate correctness from broader security and release enforcement. Its outcome is a deterministic merge contract that every repository can adopt without relying on mutable shared workflows or ambiguous credentials.

## Completion summary

MLS-002 delivered the complete core quality-gate contract across its four issues:

- OPS-180 made formatting, lint, type checking, unit testing, coverage, and build commands truthful and fail-closed, backed by stable positive and negative workflow fixtures.
- OPS-181 added 100% changed-code enforcement for statements, branches, functions, and lines; complete executable-source inventory; a non-decreasing global coverage ratchet; and actionable failures for missing, malformed, or incomparable evidence.
- OPS-182 replaced mutable workflow/action references with reviewed commit SHAs, introduced a machine-audited reference allowlist, enabled reviewed Dependabot updates, and completed consumer compatibility fixes for coverage normalization and side-effect-free setup.
- OPS-183 established explicit event-aware workflow permissions and named secret flows, removed broad secret inheritance and custom GitHub PAT mappings, and isolated package/container release authority from ordinary and fork pull-request checks.

The work affected `gh-action-templates`, `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, and the documented `web-app` adoption boundary. The resulting foundation provides deterministic core gates, coverage enforcement, immutable supply-chain references, and auditable least-privilege workflow credentials.

Completion evidence includes the central contract/unit/fixture suites, repository-wide action-reference and workflow-permission audits, coverage decision artifacts and baselines, merged rollout pull requests, and successful hosted quality runs across the active consumers. Known product test-harness blockers remain explicitly owned by OPS-217 and OPS-228; broader security/release enforcement moves to MLS-003, while full product adoption and stability evidence move to MLS-004.

## Entry criteria

Before enforcement work begins:

1. `MLS-001` has accepted runtime, package-manager, registry-authentication, and quality-command contracts.
2. Positive and negative workflow fixtures can execute the shared interface locally and in CI.
3. All seven product repositories expose the canonical check-only commands or an explicit, owned failing dependency.
4. Clean frozen-lockfile installation is reproducible for public and private dependencies.

## Deliverables

1. Required formatting, lint, type, unit, coverage, and build gates with zero-warning and zero-drift behavior.
2. Detection of skipped or focused tests, missing suites/providers, unhandled errors, leaked handles, uncovered source, and build-output drift.
3. A 100% statement, branch, function, and line requirement for changed executable code.
4. A measured global coverage baseline that cannot decrease and ratchets upward when coverage improves.
5. Fail-closed handling for malformed or incomplete reports and insufficient comparison history.
6. Immutable reviewed references for reusable workflows and third-party actions.
7. Explicit workflow permissions and named secret contracts with release credentials isolated from ordinary checks.

## Included issues

| Issue | Title | Estimate | Current state | Due date | Plan |
|---|---|---:|---|---|---|
| `OPS-180` | Make lint, formatting, type, unit, coverage, and build gates truthful | 5 | Complete | 2026-09-13 | [Plan and completion report](tasks/OPS-180-truthful-core-quality-gates.md) |
| `OPS-181` | Implement 100% changed-code coverage and non-decreasing global ratchet | 8 | Complete | 2026-09-13 | [Implementation record](tasks/OPS-181-changed-code-coverage-ratchet.md) |
| `OPS-182` | Replace mutable reusable workflow references and pin actions | 3 | Complete | 2026-09-20 | [Implementation record](tasks/OPS-182-pin-workflow-action-references.md) |
| `OPS-183` | Apply least-privilege workflow permissions and explicit secrets | 3 | Complete | 2026-09-20 | [Plan and completion report](tasks/OPS-183-least-privilege-workflow-secrets.md) |

Total estimated scope: 19 points.

## Execution order

```text
MLS-001 accepted contracts
  -> OPS-180 Truthful core gates
       -> OPS-181 Changed-code coverage and global ratchet
  -> OPS-182 Immutable workflow and action references
       -> OPS-183 Least-privilege permissions and explicit secrets
            -> MLS-002 enforcement evidence
```

`OPS-182` can proceed alongside core-gate work after fixture references are stable. `OPS-183` must review the final job graph from `OPS-180` and `OPS-181` so permissions and secret declarations reflect actual needs.

## Contract produced by the milestone

### Core gate contract

Every required workflow runs named, non-mutating checks for:

```text
format
lint
type
unit tests
coverage
build
```

A gate fails when its command is missing, unavailable, skipped, muted, or produces warnings or drift prohibited by policy. A required gate cannot use `continue-on-error`, hidden retries, ignored exit codes, placeholder commands, pass-with-no-tests behavior, forced process exit, or broad unowned exclusions.

### Coverage contract

- Changed executable code requires 100% statements, branches, functions, and lines.
- All executable source is included in the report, including files with zero executed lines.
- The repository baseline records all four global metrics.
- A change cannot reduce any global metric.
- An improvement raises the stored baseline unless an explicit policy rule documents why it cannot.
- Missing reports, malformed data, incompatible paths, shallow history, or an unavailable merge base fail closed.
- Coverage exceptions are narrow, justified, owned, reviewed, and expiring.

### Reference integrity contract

- Product workflows consume a versioned immutable `gh-action-templates` reference.
- Third-party actions use reviewed full commit SHAs.
- Automated update tooling may propose reference changes, but cannot merge them without the normal quality and review requirements.
- Reference metadata records the human-readable release or upstream tag without weakening immutability.

### Permission and secret contract

- Every workflow and job declares the minimum required GitHub token permissions.
- Reusable workflows declare each secret by name and document its purpose.
- Product workflows do not use broad `secrets: inherit` in required or release paths.
- Pull-request checks cannot access release credentials.
- Publishing, container registry, and private package credentials are isolated to the steps that need them.
- Fork and dependency-generated pull requests fail safely without exposing credentials.

## Evidence required for completion

- Positive fixtures that pass every required core gate.
- One stable negative fixture for each formatting, lint, type, no-test, skipped/focused-test, coverage, and build defect.
- Coverage reports demonstrating all four changed-code metrics and all four global metrics.
- Negative coverage cases for a missing source file, malformed report, shallow history, global regression, and uncovered changed branch.
- A repository-wide scan showing no mutable reusable workflow reference or moving third-party action tag in required or release paths.
- A permission matrix mapping every granted permission and secret to the exact job and step that consumes it.
- Pull-request evidence proving untrusted code cannot access release credentials.
- Links from `OPS-180` through `OPS-183` to merged changes and passing CI runs.

## Exit criteria

`MLS-002` is complete when:

1. Core quality gates reject every intended negative fixture deterministically.
2. Changed executable code is enforced at 100% for all four coverage metrics.
3. Global coverage cannot decrease, and improved baselines are ratcheted forward.
4. Missing or malformed evidence fails closed with an actionable message.
5. All reusable workflows and third-party actions use immutable reviewed references.
6. Required and release workflows declare minimum permissions and named secrets.
7. Release credentials are unavailable to ordinary and untrusted pull-request checks.
8. Local commands reproduce CI results from a clean checkout.

## Risks and controls

| Risk | Control |
|---|---|
| Existing warnings and missing tests make required gates red | Keep the baseline truthful, assign remediation, and use narrow expiring exceptions only where the policy permits them. |
| Coverage appears high because untested source is omitted | Enumerate executable source independently and require every file in the merged report. |
| Shallow checkout produces an incorrect changed-file set | Require adequate history and fail closed when the merge base cannot be established. |
| Ratchet updates become noisy or conflict-prone | Store deterministic sorted baseline data and update it only from protected, verified runs. |
| SHA pinning obscures dependency versions | Add review comments or metadata recording the corresponding upstream release. |
| Least-privilege changes break releases | Prove permissions with negative and positive fixtures before enforcing them on protected branches. |
| Nineteen points exceed a single weekly cycle | Preserve the milestone exit criteria, sequence the two workstreams, and reforecast in Linear instead of weakening gates. |

## Out of scope

- CodeQL, dependency review, secret scanning, license enforcement, container scanning, SBOM, and provenance; `MLS-003` owns these controls.
- Live repository ruleset enforcement; `MLS-003` owns protected-branch rollout.
- Full adoption across all consumer repositories and the stability campaign; `MLS-004` owns this evidence.
- Product-specific behavioral coverage; dependent Linear projects own characterization and final 100% global coverage.

## Related documents

- [Project ADR](../../ADR-001-quality-gates-ci-foundation.md)
- [`MLS-001` foundation contract](../MLS-001-foundation-contract/MLS-001-foundation-contract.md)
- [Quality gate specification](../../../../quality-gates/gate-specification.md)
- [Testing and coverage strategy](../../../../testing/testing-and-coverage-strategy.md)
