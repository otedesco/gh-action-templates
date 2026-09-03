# MLS-003: Security, Release, and Branch Enforcement

- **Project:** `PRJ-001` — Quality Gates & CI Foundation
- **Linear milestone:** M3 — Security, release, and branch enforcement
- **Status:** In progress — OPS-184 and OPS-185 complete; OPS-186 remains
- **Target date:** 2026-10-23
- **Progress:** 81.25% (13 of 16 points complete; OPS-184 and OPS-185 complete)
- **Owner:** Oswaldo Tedesco

## Purpose

`MLS-003` extends the truthful core gate contract into software-supply-chain security, container release verification, and protected-branch enforcement. It ensures critical or high unapproved risks block merge, production images are verified before publication, and repository policy makes the approved checks mandatory rather than advisory.

The milestone closes the gap between having reliable workflows and enforcing them on every protected delivery path.

## Delivery progress

OPS-184 and OPS-185 are complete. OPS-184 delivered the central blocking security policy and reusable workflow, then adopted the immutable caller across all eight repositories. OPS-185 now adds build-once container release verification, digest-bound SBOM/provenance evidence, least-privilege registry publication, and hardened Cerberus/Hermes production images. The remaining milestone scope is live protected-branch ruleset enforcement (OPS-186).

See the [OPS-184 completion record](tasks/OPS-184-security-gates.md) for merged pull requests, commit references, validation, limitations, and follow-up ownership.
See the [OPS-185 completion record](tasks/OPS-185-container-release-gates.md#completion-record--2026-09-03) for the container implementation, merged repositories, validation, and limitations.

## Entry criteria

Before security and repository enforcement begins:

1. `MLS-002` core gates and coverage ratchets pass deterministic positive and negative fixtures.
2. Reusable workflow and third-party action references are immutable.
3. Workflow permissions and secrets are explicit and least-privilege.
4. Package and container release paths can identify the exact artifact or digest being verified.
5. An administrator is available to validate repository and organization policy that the connected integration cannot inspect.

## Deliverables

1. CodeQL analysis for supported languages with blocking severity policy and SARIF publication.
2. Dependency review, secret scanning, license policy, and workflow security checks.
3. An owned, expiring exception schema whose invalid or expired entries fail automatically.
4. Container builds that run as the accepted identity and pass startup, health, and vulnerability policy.
5. SBOM and provenance attestations bound to the published image digest.
6. A build-once release flow that publishes only the verified digest.
7. Repository rulesets requiring pull requests, review or code ownership, strict checks, protected history, and audited bypass behavior.
8. Live administrator evidence that enforcement applies to all eight repositories.

## Included issues

| Issue | Title | Estimate | Current state | Due date | Plan |
|---|---|---:|---|---|---|
| `OPS-184` | Add CodeQL, dependency review, secret, license, and workflow security gates | 5 | Complete — 2026-09-03 | [Completion record](tasks/OPS-184-security-gates.md) |
| `OPS-185` | Add container build, scan, smoke, SBOM, and provenance gates | 8 | Complete — 2026-09-03 | 2026-10-04 | [Completion record](tasks/OPS-185-container-release-gates.md#completion-record--2026-09-03) |
| `OPS-186` | Add repository rulesets and required checks on main | 3 | Backlog | 2026-10-11 | [Implementation plan](tasks/OPS-186-repository-rulesets.md) |

Total estimated scope: 16 points.

## Execution order

```text
MLS-002 truthful, immutable, least-privilege gates
  ├── OPS-184 Source, dependency, secret, license, workflow security
  └── OPS-185 Container build, scan, smoke, SBOM, provenance
        └── OPS-186 Repository rulesets and required checks
             -> MLS-003 live enforcement evidence
```

`OPS-184` and `OPS-185` can proceed in parallel at the design level. `OPS-186` must wait until required check names and behavior are stable so repository rulesets do not bind to transient or misleading checks.

## Contract produced by the milestone

### Security gate contract

- Unapproved critical and high findings block merge and release.
- CodeQL output is uploaded in a stable machine-readable format.
- Dependency changes are reviewed for vulnerabilities, provenance, and policy impact.
- Secret detection examines commits and relevant generated artifacts without printing recovered values.
- Prohibited licenses fail with the package, version, detected license, and applicable policy.
- Workflow security rejects dangerous interpolation, excessive permissions, mutable references, untrusted checkout execution, and credential exposure.
- Exceptions identify an owner, rationale, scope, compensating control, approval, and expiry date.

### Container release contract

- The production image is built once from the reviewed commit.
- Private dependencies are consumed through BuildKit secrets, never build arguments or persisted npm configuration.
- The container runs under the accepted non-root identity unless an explicit reviewed exception exists.
- Startup and health checks exercise the same digest that will be published.
- The vulnerability gate evaluates OS and application dependencies against the approved severity policy.
- SBOM and provenance attestations reference the verified digest.
- Publication and deployment consume that digest, not a rebuilt or mutable tag-only artifact.

### Protected-branch contract

- Changes to `main` arrive through pull requests.
- Required review and code-owner rules match repository risk.
- Required checks run against the latest base branch state.
- Force pushes and destructive history changes are blocked.
- Administrator and automation bypasses are minimized, named, and auditable.
- Required check names are stable and cannot be satisfied by an unrelated workflow.
- Enforcement is verified live for all seven product repositories and `gh-action-templates`.

## Evidence required for completion

- Positive and negative fixtures for CodeQL, vulnerable dependency, leaked sentinel secret, prohibited license, and unsafe workflow behavior.
- Valid and expired exception fixtures proving automatic enforcement.
- A container test matrix covering successful build, missing secret, failed startup, failed health, prohibited identity, critical vulnerability, and absent attestation.
- Image history and layer inspection proving sentinel credentials are absent.
- Published SBOM and provenance tied to a verified test digest.
- Repository ruleset exports or screenshots plus an administrator checklist for all eight repositories.
- A controlled negative pull request proving required checks and review policy block merge.
- Audit evidence for permitted bypass behavior.
- Links from `OPS-184` through `OPS-186` to merged changes and enforced runs.

## Exit criteria

`MLS-003` is complete when:

1. Unapproved critical or high security findings block the appropriate merge or release path.
2. Invalid and expired exceptions fail automatically.
3. Production images pass build, identity, startup, health, vulnerability, SBOM, and provenance gates.
4. Only a previously verified digest can be published or deployed.
5. Required security, quality, and release checks are mandatory on protected branches.
6. Pull request, review, strict-check, history, force-push, and bypass policies are verified live across all eight repositories.
7. Credentials and attestations remain least-privilege, scoped, and auditable.

## Risks and controls

| Risk | Control |
|---|---|
| Scanner noise encourages permanent bypasses | Use severity policy plus narrow, owned, expiring exceptions with compensating controls. |
| Security tools expose a detected credential | Test with sentinels, redact output, restrict artifacts, and never retrieve or print real secrets. |
| Container is scanned but a different image is published | Promote the verified digest and prohibit rebuilds between verification and publication. |
| Smoke tests are green without exercising readiness | Require explicit startup and health assertions against the built production image. |
| Rulesets bind to unstable check names | Freeze names and prove the final workflow graph before administrator rollout. |
| Automation or administrators silently bypass policy | Minimize bypass actors and retain auditable live verification evidence. |
| Integration permissions cannot read protection settings | Require an authorized administrator to complete and sign the verification checklist. |

## Out of scope

- Full workspace adoption PRs, dashboard automation, and the 100-run campaign; `MLS-004` owns these outcomes.
- Product-specific penetration testing and behavioral security characterization; dependent product projects own those suites.
- Production deployment orchestration beyond proving that only verified artifacts are publishable.
- Final refactoring authorization, which belongs to the cross-system readiness project.

## Related documents

- [Project ADR](../../ADR-001-quality-gates-ci-foundation.md)
- [`MLS-002` core gates and coverage ratchet](../MLS-002-core-gates-coverage-ratchet/MLS-002-core-gates-coverage-ratchet.md)
- [Quality gate specification](../../../../quality-gates/gate-specification.md)
- [Testing and coverage strategy](../../../../testing/testing-and-coverage-strategy.md)
