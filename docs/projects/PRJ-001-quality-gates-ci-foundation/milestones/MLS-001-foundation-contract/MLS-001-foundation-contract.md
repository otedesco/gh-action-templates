# MLS-001: Foundation Contract

- **Project:** `PRJ-001` — Quality Gates & CI Foundation
- **Linear milestone:** M1 — Foundation contract
- **Status:** In progress
- **Target date:** 2026-09-18
- **Linear progress at documentation time:** 18.06%
- **Owner:** Oswaldo Tedesco

## Purpose

`MLS-001` establishes the interfaces every later quality gate and product repository will consume. It resolves runtime and package-manager drift, makes private dependency installation reproducible, defines non-mutating and truthful quality commands, and proves shared workflow behavior with executable fixtures.

This milestone is a contract milestone. It does not attempt to complete product coverage, security enforcement, or branch protection. Its outcome is an accepted, locally reproducible foundation that allows those later controls to be implemented without redefining basic behavior.

## Deliverables

1. An accepted Node.js and package-manager ADR with exact, machine-verifiable versions.
2. Matching runtime metadata across manifests, the shared setup action, reusable workflows, lockfiles, and Docker compatibility targets.
3. Credential-safe private GitHub Packages authentication for Cerberus, Hermes, and Notify.
4. Frozen-lockfile installs that fail before dependency resolution when required credentials are missing.
5. A canonical check-only script interface across all seven product repositories.
6. Positive and negative workflow fixtures that prove each declared quality gate accepts and rejects the intended repository state.
7. Documentation that lets an engineer reproduce every milestone check locally from a clean checkout.

## Included issues

| Issue | Title | Estimate | Current state | Due date | Plan |
|---|---|---:|---|---|---|
| `OPS-176` | Decide supported Node LTS and package-manager contract | 3 | In Progress | 2026-09-06 | [Implementation plan](tasks/OPS-176-decide-node-lts-package-manager-contract.md) |
| `OPS-177` | Repair private package registry authentication | 5 | In Progress | 2026-09-06 | [Implementation plan](tasks/OPS-177-repair-private-package-registry-authentication.md) |
| `OPS-178` | Standardize check-only quality scripts across all repositories | 5 | In Progress | 2026-09-06 | [Implementation plan](tasks/OPS-178-standardize-check-only-quality-scripts.md) |
| `OPS-179` | Add workflow contract fixtures with positive and negative cases | 5 | Todo | 2026-09-13 | [Implementation plan](tasks/OPS-179-workflow-contract-fixtures.md) |

Total estimated scope: 18 points.

## Execution order

```text
OPS-176 Runtime and package-manager decision
  ├── OPS-177 Private registry authentication
  └── OPS-178 Check-only script contract
        └── OPS-179 Positive and negative workflow fixtures
```

`OPS-177` and `OPS-178` may prepare tests while `OPS-176` is being decided, but they must consume its accepted versions. `OPS-179` should reuse the contract-test structures created by the first three tasks instead of establishing a second fixture framework.

## Contract produced by the milestone

### Runtime contract

- One supported Node.js version policy and one exact package-manager policy.
- Explicit handling of the `web-app` package-manager choice.
- Matching local, CI, manifest, lockfile, and Docker behavior.
- A documented coordinated upgrade procedure.

### Installation contract

- Checked-in registry configuration contains no credential.
- Secrets are passed only to the validation, installation, publishing, or BuildKit steps that require them.
- Private installs use frozen lockfiles.
- Missing credentials produce one actionable, redaction-safe preflight error.
- Tokens never appear in logs, tracked files, generated npm configuration, build arguments, image layers, or artifacts.

### Quality-command contract

Every product repository exposes the approved equivalents of:

```text
format:check
lint:check
type:check
test
test:coverage
build
quality:check
```

Required paths are non-mutating and contain no fix/write mode, placeholder command, pass-with-no-tests behavior, forced process exit, ignored error, or hidden retry.

### Workflow-fixture contract

- A valid fixture passes all intended foundation checks.
- Dedicated negative fixtures demonstrate failures for type, lint, format, no-test, coverage, build, security, and container defects as those gates become available.
- Each failure identifies the stable gate and actionable cause.
- A missing fixture, report, tool, or required history fails closed.

## Evidence required for completion

- Accepted runtime/package-manager ADR and contract-test output.
- Clean frozen-install evidence from every affected repository.
- Redaction checks using sentinel credentials, never a real token.
- Manifest contract output covering all seven product repositories.
- Before-and-after repository status proving check-only commands do not edit tracked files.
- Positive and negative fixture runs with stable expected outcomes.
- Action and workflow syntax validation.
- Links from each Linear issue to its merged changes and CI evidence.

## Exit criteria

`MLS-001` is complete when:

1. The runtime and package-manager decision is accepted and encoded consistently.
2. All affected repositories install reproducibly from frozen lockfiles.
3. Private registry authentication is least-privilege, redaction-safe, and fails early when missing.
4. All seven product repositories expose the documented check-only command interface.
5. Required commands cannot pass through a placeholder, missing test suite, mutating mode, ignored error, or unavailable coverage provider.
6. Workflow fixtures prove both accepted and rejected states deterministically.
7. Commands and evidence are documented and locally reproducible.
8. No critical milestone exception is unowned or lacks an expiry date.

## Risks and controls

| Risk | Control |
|---|---|
| Runtime choice breaks an older tool or production image | Test the selected version against SWC, Next.js, Jest, Vitest, Corepack, and all production Docker builds before accepting the ADR. |
| Private package validation leaks credentials | Use sentinel secrets in tests, step-scoped environments, output redaction assertions, and BuildKit secret mounts. |
| Truthful commands make repositories red because suites are missing | Keep failures visible and link them to their owned harness issues; never restore false-positive success. |
| Cross-repository contract changes drift during rollout | Keep the machine-readable contract and its cross-repository tests in `gh-action-templates`. |
| Fixture work duplicates task-specific contract tests | Design `OPS-176` through `OPS-178` fixtures so `OPS-179` can compose them. |
| Eighteen points exceed one calibrated cycle | Preserve dependency order, surface spillover in Linear, and protect the 2026-09-18 exit rather than weakening criteria. |

## Out of scope

- Full behavioral test coverage for shared libraries, services, messaging, or the web application.
- Global 100% coverage enforcement; `MLS-002` owns the ratchet implementation.
- CodeQL, dependency review, secret scanning, license policy, and container provenance; `MLS-003` owns enforcement.
- Repository rulesets, organization-wide adoption evidence, dashboards, exception automation, and the stability campaign; `MLS-003` and `MLS-004` own those outcomes.

## Related documents

- [Project ADR](../../ADR-001-quality-gates-ci-foundation.md)
- [System and quality baseline](../../../../architecture/quality-baseline.md)
- [Quality gate specification](../../../../quality-gates/gate-specification.md)
- [Testing and coverage strategy](../../../../testing/testing-and-coverage-strategy.md)
