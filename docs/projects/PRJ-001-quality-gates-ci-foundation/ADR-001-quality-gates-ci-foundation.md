# ADR-001: Establish Quality Gates and CI as the Refactoring Foundation

- **Status:** Accepted
- **Decision date:** 2026-08-29
- **Project:** `PRJ-001` — Quality Gates & CI Foundation
- **Linear team:** Opspace
- **Owner:** Oswaldo Tedesco
- **Priority:** Urgent
- **Delivery window:** 2026-08-31 through 2026-11-06
- **Linear project:** [Quality Gates & CI Foundation](https://linear.app/opspace/project/quality-gates-and-ci-foundation-50da4aefa64c)

## Context

The Apart workspace spans seven product repositories—`cerberus`, `hermes`, `notify`, `server-utils`, `commons`, `cache`, and `web-app`—plus the shared `gh-action-templates` delivery repository. These repositories currently disagree on supported runtimes, package managers, script names, installation behavior, and CI enforcement.

The measured baseline is not sufficient for safe structural refactoring:

- several repositories report a successful test result when no tests run;
- one repository uses a placeholder test command;
- the web application has no test command;
- private package authentication prevents reproducible clean installs;
- reusable workflows omit formatting, coverage, build, contract, integration, security, and release checks;
- workflow and third-party action references are mutable;
- workflow permissions and secrets are broader than necessary;
- no repository enforces a coverage contract or demonstrated branch-protection policy.

Starting product refactoring before these controls exist would make regressions difficult to distinguish from pre-existing failures. Every later Linear quality project depends on a stable command, test, coverage, and CI interface.

## Decision

We will complete `PRJ-001` before authorizing broad application or service refactoring. The project will establish `gh-action-templates` as the canonical home for versioned quality policy, reusable workflow implementation, contract tests, and cross-repository evidence.

All product repositories will expose the same local and CI quality interface. Required gates will fail closed when a command, test suite, coverage report, credential, artifact, security result, or required history is missing or malformed. A green result must mean the intended check actually executed and passed.

The project will deliver through four ordered milestones:

1. `MLS-001` — Foundation contract, target 2026-09-18.
2. `MLS-002` — Core gates and coverage ratchet, target 2026-10-02.
3. `MLS-003` — Security, release, and branch enforcement, target 2026-10-23.
4. `MLS-004` — Adoption and stability evidence, target 2026-11-06.

### OPS-176 runtime decision amendment

`OPS-176` is an amendment to this project ADR; it does not create a separate architecture decision record.

**Decision:** Use Node.js `24.20.0` as the supported runtime. Use pnpm `10.34.0` for `cerberus`, `hermes`, `notify`, `server-utils`, `commons`, and `cache`. Keep `web-app` on npm `10.8.2` as a temporary, explicitly documented exception because it currently has an npm package contract and no pnpm lockfile.

**Enforcement:** Corepack installs and activates the exact package-manager version declared by each manifest. CI setup defaults, reusable workflow matrices, package manifests, lockfiles, and service Dockerfiles must agree with this contract. No floating major, range, `latest`, or `lts/*` value is allowed. The machine-readable `runtime-contract.json` and its contract test are implementation artifacts of this ADR and must match these values exactly.

**Compatibility and migration:** Before the milestone closes, clean frozen installs, type checks, builds, and service image builds must pass on Node `24.20.0` for all seven repositories. The test matrix must cover SWC, Next.js, Jest, Vitest, Corepack, and production Docker images. The npm exception is revisited after the web test/build harness is established; its removal requires a separate reviewed migration with a pnpm lockfile and no unrelated dependency upgrade.

**Rollback:** If a consumer cannot meet the contract, revert that consumer's adoption commit and record the incompatibility as an owned, expiring exception. Do not silently retain Node 18 or a ranged package-manager declaration.

**OPS-176 verification evidence (2026-08-29):** The central Node contract suite passes with 17 tests covering all seven manifests, lockfile formats, the shared setup action, reusable workflows, Docker runtime/package-manager declarations, and BuildKit secret usage. Frozen offline installs pass for `cerberus`, `notify`, `server-utils`, `commons`, and `cache`; `hermes` reaches dependency resolution but requires the uncached private `@otedesco/notify@0.0.2` tarball and therefore requires authenticated online installation under `OPS-177`. The local environment uses Node `20.11.1`, so package-manager checks emit the expected unsupported-engine warning; CI and Docker use the accepted Node `24.20.0`. Full image builds remain an environment-dependent follow-up because this Docker CLI does not provide `build --check` and private registry credentials are not available locally.

## Delivery roadmap

| Milestone | Linear issues | Primary outcome | Exit date |
|---|---|---|---|
| `MLS-001` — Foundation contract | `OPS-176`–`OPS-179` | Accepted runtime, installation, command, and workflow-fixture contracts. | 2026-09-18 |
| `MLS-002` — Core gates and coverage ratchet | `OPS-180`–`OPS-183` | Truthful core gates, 100% changed-code coverage, non-decreasing global coverage, immutable references, and explicit secrets. | 2026-10-02 |
| `MLS-003` — Security, release, and branch enforcement | `OPS-184`–`OPS-186` | Security and container release controls plus mandatory protected-branch enforcement. | 2026-10-23 |
| `MLS-004` — Adoption and stability evidence | `OPS-187`–`OPS-189` | Dashboard and exception governance, adoption in all consumers, and 100 consecutive stable runs. | 2026-11-06 |

## Architectural principles

### One versioned contract

Runtime versions, package-manager policy, quality-script names, workflow inputs, required outputs, and failure semantics are explicit and machine-verifiable. Consumer repositories adopt this contract; they do not fork it silently.

### Local and CI equivalence

Every required CI check has a deterministic local command. CI may orchestrate and publish evidence, but it must not rely on behavior that developers cannot reproduce from a clean checkout.

### Truthful failure

Missing tests, unavailable coverage providers, skipped or focused tests, leaked handles, unhandled errors, warnings, formatting drift, build drift, malformed reports, shallow history, and missing credentials fail the relevant gate. Required paths cannot use hidden retries, `continue-on-error`, pass-with-no-tests behavior, or placeholder commands.

### Test-first gate development

Each gate is introduced with positive and negative fixtures. The implementation must demonstrate the defect that makes the gate fail before demonstrating the passing case.

### Coverage ratchet

New and changed executable code requires 100% statement, branch, function, and line coverage. Global coverage cannot decrease and is ratcheted upward until every repository reaches the final 100% policy.

### Least privilege and immutable delivery

Reusable workflow references and third-party actions are immutable and reviewed. Each workflow declares only its required permissions and named secrets. Release credentials are isolated, private-registry credentials are never persisted or printed, and published artifacts are traceable to verified inputs.

### Build once, verify, then publish

Package and container release paths verify the artifact that will be published. Container delivery includes a smoke test, vulnerability policy, SBOM, and provenance; only the verified digest is released.

## Scope

`PRJ-001` includes:

- the supported Node.js and package-manager decision;
- reproducible private-package installation;
- canonical check-only quality commands;
- workflow contract fixtures and truthful core gates;
- changed-code coverage and global coverage ratcheting;
- immutable action references and least-privilege workflow permissions;
- CodeQL, dependency, secret, license, and workflow security gates;
- container build, scan, smoke, SBOM, and provenance gates;
- repository rulesets and required checks;
- quality reporting, flake tracking, exception expiry, workspace adoption, and stability evidence.

The project does not include full behavioral characterization of each product. That work remains in the dependent Linear projects after this foundation exposes reliable commands and enforcement.

## Repository responsibilities

| Repository | Responsibility in this decision |
|---|---|
| `gh-action-templates` | Own policy, contract schemas, reusable actions/workflows, fixtures, reporting, and durable evidence. |
| `commons`, `cache`, `server-utils` | Adopt package/library commands and publish truthful test, coverage, build, and release results. |
| `notify` | Adopt library commands plus authenticated private-dependency and release behavior. |
| `cerberus`, `hermes` | Adopt service commands, authenticated installs, container gates, and service release behavior. |
| `web-app` | Adopt the approved runtime/package-manager exception or standard, plus web-specific test, build, accessibility, and browser-ready interfaces. |

## Milestone dependency model

```text
MLS-001 Foundation contract
  -> MLS-002 Core gates and coverage ratchet
       -> MLS-003 Security, release, and branch enforcement
            -> MLS-004 Adoption and stability evidence
```

A later milestone may perform discovery early, but its enforcement work cannot close until the preceding milestone's interfaces are stable and accepted.

## Governance and evidence

- Linear is authoritative for issue state, ownership, priority, estimate, dependencies, dates, and project health.
- This repository is authoritative for durable policy, rationale, implementation plans, schemas, and evidence definitions.
- Work in progress is limited to one implementation issue plus one discovery or architecture issue.
- Every issue must link deterministic failing and passing evidence, relevant coverage, and any ADR or time-bounded exception.
- Milestone completion requires its exit criteria, not merely all issues being marked Done.
- Any accepted exception must identify an owner, rationale, compensating control, expiry date, and removal issue.
- Project dates are reforecast after Cycle 42 from observed throughput and integration risk.

## Project exit criteria

`PRJ-001` is complete only when:

1. All supported repositories use the documented commands locally and in CI.
2. Clean, frozen-lockfile installation succeeds with documented least-privilege credentials.
3. Required gates deterministically reject their intended negative fixtures.
4. Changed executable code is held to 100% across all four coverage metrics and global coverage cannot regress.
5. Security and release gates are operational and publish only verified artifacts.
6. Protected branches require the approved checks, reviews, and history policy with live administrator evidence.
7. All seven product repositories have reviewed adoption evidence.
8. One hundred consecutive required-gate runs complete without an active quarantine, hidden retry, leaked resource, nondeterministic failure, or false-positive green.

## Consequences

### Positive

- Later characterization and refactoring work receives one stable, reproducible quality interface.
- False-positive green builds become explicit failures with an owner and remediation path.
- Cross-repository changes can be evaluated against consistent runtime, coverage, security, and release evidence.
- Credentials and release permissions have a smaller blast radius.
- Refactoring authorization becomes evidence-based rather than confidence-based.

### Costs and trade-offs

- Existing repositories may be temporarily red when truthful checks expose missing tests, warnings, or build drift.
- Coordinated changes across independently versioned repositories increase short-term delivery overhead.
- Coverage and security ratchets require maintained baselines, fixtures, exceptions, and reporting.
- Immutable references require an explicit release and upgrade process for shared workflows.

These costs are accepted because concealing existing gaps would preserve delivery risk and undermine every dependent project.

## Alternatives considered

### Refactor first and add gates afterward

Rejected because current failures and regressions could not be separated reliably, especially across authentication, persistence, messaging, and shared packages.

### Let each repository define its own quality interface

Rejected because duplicated commands and workflows already drift. Repository-specific tools remain allowed, but they must implement the shared observable contract.

### Introduce all gates in one blocking release

Rejected because it creates an unreviewable change and no controlled way to distinguish infrastructure defects from newly exposed product defects. Ordered milestones provide incremental, measurable enforcement.

### Allow missing checks to remain non-blocking indefinitely

Rejected because unavailable or unimplemented checks would continue to present false confidence. Temporary exceptions must be explicit, owned, observable, and expiring.

## Related documents

- [System and quality baseline](../../architecture/quality-baseline.md)
- [Testing and coverage strategy](../../testing/testing-and-coverage-strategy.md)
- [Quality gate specification](../../quality-gates/gate-specification.md)
- [Linear portfolio execution plan](../../plans/linear-portfolio-execution.md)
- [`MLS-001` milestone description](milestones/MLS-001-foundation-contract/MLS-001-foundation-contract.md)
- [`MLS-002` milestone description](milestones/MLS-002-core-gates-coverage-ratchet/MLS-002-core-gates-coverage-ratchet.md)
- [`MLS-003` milestone description](milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md)
- [`MLS-004` milestone description](milestones/MLS-004-adoption-stability-evidence/MLS-004-adoption-stability-evidence.md)
