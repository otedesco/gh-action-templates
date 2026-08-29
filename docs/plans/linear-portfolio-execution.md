# Linear Portfolio Execution Plan

**Baseline date:** 2026-08-29  
**Portfolio owner and project lead:** Oswaldo Tedesco  
**Team:** Opspace  
**Planning horizon:** 2026-08-31 through 2027-05-28  
**Portfolio size:** 6 projects, 24 milestones, 81 issues, 493 estimated points

## Executive intent

This portfolio establishes complete, enforceable test confidence before structural refactoring begins. Delivery follows the dependency chain from quality infrastructure, through package and product characterization, to integrated qualification and an explicit refactoring go/no-go decision.

The plan is capacity-based for the current one-person team. Projects are sequenced deliberately; dates do not assume that Quality, Cerberus, Messaging, and Web can all execute in parallel.

## Priority order

| Rank | Linear priority | Project | Delivery window | Why it is ordered here |
|---:|---|---|---|---|
| 1 | Urgent | Quality Gates & CI Foundation | 2026-08-31–2026-11-06 | Creates the commands and enforcement every other project consumes. |
| 2 | High | Shared Libraries — Complete Characterization | 2026-09-28–2026-12-04 | Stabilizes contracts used by every service and application. |
| 3 | High | Notify & Hermes — Messaging Reliability Coverage | 2026-12-07–2027-01-22 | Proves asynchronous delivery and failure semantics before integration. |
| 4 | High | Cerberus — Auth, Data, and API Coverage | 2027-01-18–2027-02-26 | Protects security, persistence, and API contracts consumed by Web. |
| 5 | High | Web App — Component, Accessibility, and E2E Coverage | 2027-02-22–2027-04-09 | Verifies user outcomes after backend contracts stabilize. |
| 6 | Medium | Cross-System Verification & Refactoring Readiness | 2027-04-05–2027-05-28 | Integrates all evidence and controls the final authorization. |

The short overlaps permit discovery and environment preparation only. The WIP limit still controls active implementation.

## Project charters and deliverables

### 1. Quality Gates & CI Foundation

[Open in Linear](https://linear.app/opspace/project/quality-gates-and-ci-foundation-50da4aefa64c)

**Objective:** establish deterministic local and CI checks for formatting, static analysis, tests, coverage, security, build, and release readiness.

**Deliverables:**

- Versioned quality-command and workflow contract
- Reusable CI gates and truthful positive/negative fixtures
- Coverage merge, publication, changed-code enforcement, and global ratchet
- Dependency, secret, CodeQL, license, image, SBOM, and provenance checks
- Protected-branch required checks and least-privilege credentials
- Dashboard, ownership, exception expiry, and stability evidence

**Milestones:** Foundation contract (2026-09-18); core gates and coverage ratchet (2026-10-02); security, release, and branch enforcement (2026-10-23); adoption and stability evidence (2026-11-06).

### 2. Shared Libraries — Complete Characterization

[Open in Linear](https://linear.app/opspace/project/shared-libraries-complete-characterization-e590edae72ea)

**Objective:** characterize Commons, Cache, and Server Utils completely before changing public or runtime behavior.

**Deliverables:**

- Deterministic and failure-sensitive library harnesses
- Complete Commons crypto, JWT, promise, error, and model coverage
- Cache behavior with real Redis-compatible infrastructure and outage tests
- Server lifecycle, app factory, logger, and failure-path coverage
- Package export, TypeScript consumer, and artifact contracts
- Enforced 100% per-file coverage and critical mutation evidence

**Milestones:** Harness truthfulness (2026-10-23); Commons complete (2026-11-06); Cache verified with real infrastructure (2026-11-20); shared packages signed off (2026-12-04).

### 3. Notify & Hermes — Messaging Reliability Coverage

[Open in Linear](https://linear.app/opspace/project/notify-and-hermes-messaging-reliability-coverage-038e743bf408)

**Objective:** prove schema compatibility, routing, provider, broker, SMTP, retry, and idempotency behavior under normal and degraded conditions.

**Deliverables:**

- Versioned event envelope and domain schemas
- Truthful Notify and Hermes harnesses
- Provider, consumer, producer, and synchronous-adapter contract suites
- Broker integration for ordering, duplicate, retry, and malformed events
- SMTP, delivery-failure, termination, and unavailable-dependency tests
- Enforced 100% coverage and critical mutation targets

**Milestones:** Schemas and deterministic harness (2026-12-13); provider behavior complete (2026-12-27); broker and SMTP resilience (2027-01-17); messaging quality sign-off (2027-01-22).

### 4. Cerberus — Auth, Data, and API Coverage

[Open in Linear](https://linear.app/opspace/project/cerberus-auth-data-and-api-coverage-b5c1fd0901de)

**Objective:** protect authentication, authorization, sessions, persistence, domain behavior, and API contracts before backend refactoring.

**Deliverables:**

- Disposable PostgreSQL and Redis environment with factories
- Migration up/down, constraint, clean-install, and upgrade verification
- Complete signup, signin, session, OTP, recovery, and RBAC characterization
- Repository, relation, cache-consistency, transaction, and service tests
- OpenAPI, route, schema, validation, and error-mapping enforcement
- Security abuse, redaction, 100% coverage, and mutation evidence

**Milestones:** Test environment and migrations (2027-01-24); authentication and security controls (2027-02-07); domain and API contracts (2027-02-21); Cerberus quality sign-off (2027-02-26).

### 5. Web App — Component, Accessibility, and E2E Coverage

[Open in Linear](https://linear.app/opspace/project/web-app-component-accessibility-and-e2e-coverage-b15d45e59df9)

**Objective:** verify components, application state, backend integration, accessibility, browser journeys, and performance-sensitive behavior.

**Deliverables:**

- Vitest, Testing Library, MSW, axe, and deterministic browser harnesses
- Cerberus client, interceptor, auth hook, Redux, and persistence contracts
- Auth, profile, onboarding, organization, listing, and shared UI coverage
- Accessibility automation and keyboard/focus review
- Playwright critical journeys with isolated data and failure artifacts
- Performance budgets, 100% executable-code coverage, and mutation target

**Milestones:** Web harness, API, and state (2027-03-07); critical account journeys (2027-03-14); product UI and accessibility (2027-03-21); browser, performance, and coverage sign-off (2027-04-09).

### 6. Cross-System Verification & Refactoring Readiness

[Open in Linear](https://linear.app/opspace/project/cross-system-verification-and-refactoring-readiness-406cc27b6e85)

**Objective:** qualify the integrated platform and make an evidence-based decision to authorize or block structural refactoring.

**Deliverables:**

- Disposable full-stack environment and deterministic seed API
- OpenAPI and event compatibility enforcement across repositories
- Critical auth, recovery, organization, RBAC, and delivery journeys
- PostgreSQL, Redis, broker, SMTP, and HTTP failure injection
- Security and performance baselines
- Global 100% coverage audit, mutation qualification, 100-run stability campaign, ADRs, and formal readiness review

**Milestones:** Full-stack environment and contracts (2027-04-11); critical integrated journeys (2027-04-25); failure, security, and performance evidence (2027-05-02); refactoring readiness decision (2027-05-28).

## Cycle operating model

Linear cycles are one week. Planning uses 13–18 points per cycle until actual throughput establishes a better forecast.

### Loaded cycles

| Cycle | Dates | Committed issues | Planned points | Outcome |
|---|---|---|---:|---|
| 39 | 2026-08-31–2026-09-07 | OPS-176, OPS-177, OPS-178 | 13 | Runtime/package contract, registry authentication, and standard scripts |
| 40 | 2026-09-07–2026-09-14 | OPS-179, OPS-180, OPS-181 | 18 | Workflow fixtures, truthful core gates, and coverage ratchet |

Only cycles already present in Linear were assigned. Future cycles are loaded during weekly planning from the ordered, estimated, dependency-aware backlog. Due dates express the current forecast until those cycles exist.

### Ceremonies

- **Cycle planning:** first working hour of each cycle; close the prior cycle, inspect blockers, confirm capacity, and commit only ready work.
- **Daily control:** update state, remaining risk, and blockers in Linear. No separate status document is required.
- **Mid-cycle risk review:** inspect point burn, external dependencies, flaky checks, and scope changes. De-scope before adding capacity assumptions.
- **Cycle review:** demonstrate executable evidence against acceptance criteria and milestone exits.
- **Retrospective and reforecast:** record throughput, spillover cause, defects, and one process improvement.
- **Portfolio review:** at every milestone and at least monthly; publish a Linear project update with health, accomplishments, next checkpoint, and risks.

The first formal reforecast occurs after Cycle 42. Project dates must then be updated from completed-point throughput and observed integration risk.

## Workflow and controls

### Issue states

1. **Backlog:** sequenced but not yet committed.
2. **Todo:** dependency-clear, acceptance criteria understood, and committed to a current or next cycle.
3. **In Progress:** actively being implemented; only one implementation issue at a time.
4. **In Review:** code and evidence are complete; required checks or review remain.
5. **Done:** acceptance criteria, tests, documentation, and quality gates all pass.

Canceled and Duplicate require a written reason and replacement link when applicable.

### Definition of ready

An issue may enter a cycle only when:

- Its outcome and acceptance criteria are testable.
- Blocking issues are Done or an explicit safe interface is available.
- Required environment, credentials, fixtures, and test data are available.
- The estimate is 8 points or less; larger work is split before commitment.
- The issue has an owner, milestone, and evidence location.

### Definition of done

- Acceptance criteria pass with linked evidence.
- Tests were added at the lowest effective layer and fail for the intended regression.
- Global and per-file coverage do not decrease; the changed executable code is fully covered.
- Static, security, build, and package checks pass where applicable.
- No unowned skip, suppression, warning, or coverage exclusion was introduced.
- Documentation, contracts, and ADRs are updated when behavior or architecture is affected.
- The issue is merged and verified on the protected branch.

### WIP and scope policy

- Maximum active WIP: one implementation issue and one discovery/architecture issue.
- Expedite work is allowed only for a production/security blocker and displaces equal planned capacity.
- New scope enters Backlog, receives acceptance criteria and an estimate, and is prioritized at the next planning event.
- Milestone scope changes require an updated Linear status report and schedule impact.
- A blocked issue is surfaced the same day. After one cycle, it is escalated as a project risk and replacement work may be pulled.

## Health and escalation

Project health is assessed from milestone confidence, not raw issue count:

- **On track:** milestone exit is forecast to pass on date with no unresolved critical dependency.
- **At risk:** forecast has less than one cycle of margin, a critical dependency is uncertain, or spillover exceeds 20%.
- **Off track:** milestone will miss, a mandatory quality gate cannot pass, or a critical security/data-integrity risk is unresolved.

At-risk and off-track updates must identify the cause, owner, containment, decision needed, and next review date.

## Portfolio success measures

- Cycle predictability: at least 80% of committed points completed after the calibration period
- Spillover: less than 20% of committed points
- Flake rate: below the threshold in the quality strategy, ending with the required stability campaign
- Critical defect escape: zero during qualification
- Coverage: 100% changed executable code throughout; 100% global and per-file at final sign-off
- Mutation: project-specific critical targets met
- Governance: every milestone has executable evidence and a current Linear health update
- Final outcome: OPS-255 records an explicit refactoring authorization or a blocked decision with owned remediation

## Source of truth

Linear is the operational source of truth for ownership, state, estimate, cycle, due date, dependencies, milestones, and health. The repository documents define durable policy and rationale. When they differ, correct both in the same change and mention the reconciliation in the next project update.
