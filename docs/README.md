# Apart Quality Program Documentation

Read these documents in order:

1. [System and quality baseline](architecture/quality-baseline.md) — current topology, measured baseline, risks, and refactoring entry criteria.
2. [Testing and coverage strategy](testing/testing-and-coverage-strategy.md) — final 100% policy, test layers, repository matrix, mutation and non-functional expectations.
3. [Quality gate specification](quality-gates/gate-specification.md) — required checks, security/release enforcement, branch policy, and staged rollout.
4. [Implementation plan](plans/2026-08-29-quality-gates-and-test-foundation.md) — TDD-oriented execution sequence with exact repository files and verification commands.
5. [Linear quality program](plans/linear-quality-program.md) — six-project, 81-issue source backlog and universal definition of done.
6. [Linear portfolio execution plan](plans/linear-portfolio-execution.md) — priorities, project charters, deliverables, milestones, cycle governance, workflow, and escalation rules.

Active implementation plans follow the canonical Linear hierarchy:

- [PRJ-001 — Quality Gates & CI Foundation ADR](projects/PRJ-001-quality-gates-ci-foundation/ADR-001-quality-gates-ci-foundation.md)
- [MLS-001 — Foundation contract](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/MLS-001-foundation-contract.md)
- [MLS-002 — Core gates and coverage ratchet](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-002-core-gates-coverage-ratchet/MLS-002-core-gates-coverage-ratchet.md)
- [MLS-003 — Security, release, and branch enforcement](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md)
- [MLS-004 — Adoption and stability evidence](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-004-adoption-stability-evidence/MLS-004-adoption-stability-evidence.md)
- [OPS-176 — Node LTS and package-manager contract](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/tasks/OPS-176-decide-node-lts-package-manager-contract.md)
- [OPS-177 — Private registry authentication](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/tasks/OPS-177-repair-private-package-registry-authentication.md)
- [OPS-178 — Check-only quality scripts](projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/tasks/OPS-178-standardize-check-only-quality-scripts.md)

The order is intentional: understand the evidence, accept the policy, implement the gates, characterize behavior, and only then authorize refactoring.
