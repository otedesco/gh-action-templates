# Linear Program: Quality Gates, Complete Coverage, and Refactoring Readiness

This is the source backlog for the Opspace Linear team. Priorities use P0 (urgent), P1 (high), and P2 (normal). Every issue inherits the quality contract in `docs/testing/testing-and-coverage-strategy.md` and must include proof in CI.

## Project 1: Quality Gates & CI Foundation

**Outcome:** Every repository has truthful, secure, reproducible, enforced checks.  
**Exit:** Required checks are protected on `main`, new/changed executable code is at 100% coverage, global coverage cannot decrease, and releases consume verified artifacts.

1. **[P0] Decide supported Node LTS and package-manager contract** — ADR accepted; manifests, setup action, and Docker compatibility matrix agree.
2. **[P0] Repair private package registry authentication** — clean Cerberus/Hermes/Notify installs succeed without token leakage.
3. **[P0] Standardize check-only quality scripts across all repositories** — required scripts exist; no `--fix`, placeholders, or `passWithNoTests` in CI paths.
4. **[P0] Add workflow contract fixtures with positive and negative cases** — each gate is proved to fail on its intended defect.
5. **[P0] Make lint, formatting, type, unit, coverage, and build gates truthful** — warnings, skipped/focused tests, unhandled errors, missing tests/providers, and build drift fail.
6. **[P0] Implement 100% changed-code coverage and non-decreasing global ratchet** — all four metrics enforced; shallow/malformed reports fail closed.
7. **[P0] Replace mutable reusable workflow references and pin actions** — no `@main` or moving third-party action tags in required/release paths.
8. **[P0] Apply least-privilege workflow permissions and explicit secrets** — remove broad `secrets: inherit`; document each permission/secret.
9. **[P1] Add CodeQL, dependency review, secret, license, and workflow security gates** — critical/high exceptions are owned and expiring.
10. **[P1] Add container build, scan, smoke, SBOM, and provenance gates** — publish only a verified digest.
11. **[P1] Add repository rulesets and required checks on main** — PR/review/strict-check/force-push/admin-bypass policy is verified live.
12. **[P1] Add quality dashboard, flake tracking, and exception expiry automation** — no green dashboard for unavailable/missing checks.
13. **[P1] Adopt the gate contract in all seven product repositories** — one reviewed adoption PR per repository.
14. **[P1] Prove 100 consecutive stable gate runs** — no hidden retry, leaked resource, or active quarantine.

## Project 2: Shared Libraries — Complete Characterization

**Outcome:** `commons`, `cache`, and `server-utils` are safe foundations with 100% coverage and package contracts.  
**Blocked by:** Project 1 tasks 1–6.

1. **[P0] Establish truthful Vitest coverage in Commons, Cache, and Server Utils** — all executable source included; reports emit all required formats.
2. **[P0] Characterize Commons hashing and encryption behavior** — success, malformed inputs, wrong secrets, work factors, and failures covered.
3. **[P0] Characterize Commons JWT signing and verification** — expiry, tampering, wrong key, null token, options, and typed payloads covered.
4. **[P1] Cover Commons promise helpers, errors, and BaseModel** — every branch and serialized error contract asserted.
5. **[P0] Characterize Cache key generation and argument mapping** — stable namespacing, collisions, malformed args, and compatibility covered.
6. **[P0] Characterize Cache hit, miss, save, invalidation, timeout, and fallback behavior** — unit suite is deterministic.
7. **[P0] Add real Redis integration and outage/reconnect tests** — source-of-truth behavior remains correct during failures.
8. **[P0] Fix Server Utils lifecycle tests and leaked listener behavior** — no fixed port, skipped test, unhandled error, or leaked handle.
9. **[P1] Complete AppFactory middleware, connection, and error-path coverage** — ordering and initialization failures asserted.
10. **[P1] Complete LoggerFactory output, permissions, rotation, and fallback coverage** — no real workspace log dependency.
11. **[P1] Add package export and TypeScript consumer contracts for all shared libraries** — declarations and documented imports compile in fixtures.
12. **[P1] Reach 100% per-file coverage and mutation targets for shared libraries** — no unsupported exclusion or survived high-risk mutant.

## Project 3: Cerberus — Auth, Data, and API Coverage

**Outcome:** Cerberus critical behavior is characterized across unit, integration, contract, migration, security, and mutation layers.  
**Blocked by:** Project 1 foundation and Project 2 shared-library contracts.

1. **[P0] Build disposable PostgreSQL/Redis Cerberus test environment and factories** — concurrent isolated runs start and clean up deterministically.
2. **[P0] Test all database migrations up, down, constraints, and upgrade path** — empty-to-head and representative upgrade succeed; rollback behavior documented.
3. **[P0] Characterize sign-up transaction and rollback behavior** — account/profile/event outcomes and duplicate inputs asserted.
4. **[P0] Characterize sign-in, password verification, and session creation** — positive, negative, disabled/missing account, and audit behavior covered.
5. **[P0] Characterize refresh, cookie, token-source, and sign-out/session invalidation contracts** — naming ambiguity resolved through ADR and tests.
6. **[P0] Characterize OTP verification, resend, recovery, and password change** — expiry, tampering, bypass, reuse, rate-limit expectations, and invalidation covered.
7. **[P0] Characterize deserialization, private route, headers, request metadata, and RBAC middleware** — all allowed/denied/malformed branches covered.
8. **[P0] Characterize organization creation, invitations, acceptance, roles, and status transitions** — authorization, replay, expiry, and transactional behavior asserted.
9. **[P1] Characterize profile and account-details create/update/read behavior** — validation, persistence, event, and not-found paths covered.
10. **[P1] Characterize repositories, relations, cache consistency, and transaction failures** — DB/cache divergence cannot be hidden.
11. **[P1] Cover controllers, routes, schemas, validators, and response/error mapping** — HTTP status/body/cookie/header contracts asserted with Supertest.
12. **[P0] Publish and enforce Cerberus OpenAPI contract** — every route, schema, auth requirement, error, and cookie is represented; drift blocks merge.
13. **[P0] Add auth abuse, sensitive-log redaction, and authorization security tests** — token/OTP/session/RBAC attack cases block merge.
14. **[P1] Reach 100% Cerberus coverage and critical mutation target** — all four metrics per file; no survived high-risk mutant.

## Project 4: Notify & Hermes — Messaging Reliability Coverage

**Outcome:** Event publication, transport, consumption, dispatch, and email side effects are versioned, resilient, and fully tested.  
**Blocked by:** Project 1 foundation and shared package contracts.

1. **[P0] Define versioned event envelope and domain event schemas** — account/profile/organization/role events have compatibility rules and ownership.
2. **[P0] Establish truthful Notify and Hermes unit/coverage harnesses** — placeholder/no-test success removed; all source counted.
3. **[P0] Characterize Notify provider selection and configuration validation** — Kafka, Service Bus, sync service, disabled, and invalid configurations covered.
4. **[P0] Characterize Kafka and Service Bus producer acknowledgment/error behavior** — serialization, timeout, retry, and publication-disabled paths asserted.
5. **[P0] Characterize Kafka and Service Bus consumer behavior** — parse, dispatch, ack, retry, poison message, and shutdown paths asserted.
6. **[P1] Characterize synchronous Cerberus/Hermes service adapters** — request/response/error/redaction contracts covered.
7. **[P0] Add broker integration tests for ordering, duplicate, retry, and malformed events** — disposable broker runs are isolated and deterministic.
8. **[P0] Characterize Hermes HTTP event ingress and worker routing** — every event/handler and unknown/malformed event path covered.
9. **[P0] Characterize account/profile/organization/role handlers and email templates** — safe content and event-specific behavior asserted.
10. **[P0] Add SMTP integration, duplicate-event idempotency, and delivery-failure tests** — observable email side effect is exactly as designed.
11. **[P1] Cover termination, health, logging, configuration, and unavailable-dependency behavior** — no leaked listener/consumer or sensitive payload.
12. **[P1] Reach 100% Notify/Hermes coverage and critical mutation targets** — package/event contracts and all four metrics enforced.

## Project 5: Web App — Component, Accessibility, and E2E Coverage

**Outcome:** The Next.js application has complete behavior coverage, accessible interactions, stable API contracts, and critical browser journeys.  
**Blocked by:** Project 1 foundation; E2E issues also require Cerberus and messaging contracts.

1. **[P0] Add Vitest, Testing Library, MSW, axe, and deterministic Next/browser test harness** — unit/component/coverage scripts are truthful.
2. **[P0] Characterize Cerberus API client, interceptors, actions, and response mapping** — auth/account/profile/role/error contracts asserted.
3. **[P0] Characterize authentication hooks and client-state policy** — token/cookie/storage behavior follows accepted ADR; errors and refresh covered.
4. **[P0] Cover sign-in, sign-up, verification, resend, recovery, and multi-step auth components** — validation/loading/error/success/keyboard states covered.
5. **[P0] Cover Redux store, persistence, profile slice, selectors, and role transitions** — server/client/rehydration/reset branches covered.
6. **[P1] Cover profile, profile-details, avatar, and personal-information settings flows** — form, upload, cancel, save, and failure states covered.
7. **[P1] Cover onboarding role selection and organization/agent profile forms** — schemas, step transitions, back/forward, and invalid data covered.
8. **[P1] Cover listings, search, maps, property cards, wishlist, pagination, and responsive states** — loading/error/empty/results and map failures covered.
9. **[P1] Cover navigation, dialogs, shared UI, utilities, date, blob, Google adapters, and layout hooks** — all executable branches covered.
10. **[P1] Cover marketing/static routes and enforce i18n key parity** — rendering, links, locale fallback, and missing keys covered without meaningless snapshots.
11. **[P0] Add automated accessibility checks and manual keyboard/focus checklist for critical flows** — blocking violations are zero.
12. **[P0] Add Playwright built-app harness with isolated data and failure artifacts** — no fixed ports or shared accounts.
13. **[P0] Implement critical auth/profile/organization/account browser journeys** — success and key validation/authorization/service-error paths covered.
14. **[P1] Add bundle, route, console-error, and page-performance budgets** — personal-info bundle regression and critical-route budgets block merge.
15. **[P1] Reach 100% web executable-code coverage and mutation target** — all four metrics per file; no broad UI exclusion.

## Project 6: Cross-System Verification & Refactoring Readiness

**Outcome:** The full system is proven stable under realistic flows and failures, all final gates are enforced, and architecture decisions are ready for refactoring.  
**Blocked by:** Projects 1–5 critical tasks.

1. **[P0] Build disposable full-stack integration environment and deterministic seed API** — concurrent stacks run without collision and clean up.
2. **[P0] Enforce OpenAPI and event producer/consumer compatibility across repositories** — breaking changes require versioning and migration plan.
3. **[P0] Run end-to-end sign-up, verification, sign-in, refresh, role/profile, and sign-out journey** — browser, API, DB, event, and email evidence captured.
4. **[P0] Run end-to-end organization invitation and RBAC journey** — allowed/forbidden actions and invitation replay/expiry asserted.
5. **[P0] Run end-to-end recovery/password-change/session invalidation journey** — old credentials/tokens/sessions are rejected.
6. **[P0] Add failure-injection suite for PostgreSQL, Redis, broker, SMTP, and downstream HTTP outages** — behavior is safe, observable, and recoverable.
7. **[P1] Establish API, consumer-throughput, and web performance baselines/budgets** — repeatable thresholds and trend reports exist.
8. **[P0] Complete cross-system security abuse and sensitive-log review** — no critical/high unapproved finding remains.
9. **[P1] Audit every coverage exclusion, skipped test, suppression, warning, and exception** — unsupported entries removed; accepted entries owned/expiring.
10. **[P0] Reach 100% global/per-file coverage in every repository** — statements, branches, functions, and lines all enforced.
11. **[P0] Meet mutation targets for critical and remaining executable modules** — no survived high-risk mutant.
12. **[P0] Complete 100-run stability campaign and resolve flakes** — no retry-hidden failure or active quarantine.
13. **[P0] Accept authentication-state, event-delivery, and database-target ADRs** — ambiguous current behavior has an explicit future contract.
14. **[P0] Conduct refactoring readiness review and authorize first refactor slice** — all entry criteria have linked evidence and owners sign off.

## Dependency order

```text
Quality Gates & CI Foundation
  ├── Shared Libraries — Complete Characterization
  │     ├── Cerberus — Auth, Data, and API Coverage
  │     └── Notify & Hermes — Messaging Reliability Coverage
  └── Web App — Component, Accessibility, and E2E Coverage

Cerberus + Notify/Hermes + Web App
  └── Cross-System Verification & Refactoring Readiness
```

## Universal issue definition of done

- Failing test/check was demonstrated before implementation.
- Test is deterministic locally and in clean CI.
- New/changed executable code has 100% statements, branches, functions, and lines.
- Global coverage did not decrease; ratchet was raised when applicable.
- Lint and format have zero warnings/drift.
- Relevant unit/integration/contract/E2E/security/mutation layer is included.
- No skipped/focused test, leaked handle, hidden retry, broad exclusion, or unowned exception.
- Documentation and contract artifacts are updated.
- Evidence links to CI run, coverage report, and ADR/exception where applicable.

