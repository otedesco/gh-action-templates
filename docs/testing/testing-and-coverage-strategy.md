# Apart Testing and Coverage Strategy

**Status:** Proposed quality contract  
**Applies to:** All first-party repositories in the Apart workspace  
**Final objective:** 100% statements, branches, functions, and lines for all first-party executable code, backed by behavior-focused integration, contract, end-to-end, accessibility, security, performance, and mutation testing.

## Principles

1. Coverage is a completeness signal, not proof of correctness. A line touched without a meaningful assertion does not satisfy the intent of this policy.
2. Test observable behavior at the narrowest reliable boundary. Pure logic belongs in unit tests; persistence and transport behavior belongs in integration/contract tests; user journeys belong in end-to-end tests.
3. Use real infrastructure where semantics matter: PostgreSQL for migrations and transactions, Redis for cache behavior, and a Kafka-compatible broker for delivery/ordering behavior.
4. Mock only external boundaries and nondeterministic sources such as time, randomness, SMTP, third-party HTTP APIs, and cloud provider SDKs. Do not mock the unit under test or its domain collaborators merely to raise coverage.
5. Every defect fix begins with a failing regression test. Every refactor preserves characterization tests and adds tests for newly exposed contracts.
6. No skipped, focused, retried, or quarantined test may pass a required gate without an approved, expiring exception.

## Coverage contract

### Included

- Every executable `.ts` and `.tsx` file under each repository's `src` directory.
- Entry points and startup wiring through import/smoke tests.
- Error branches, fallback paths, retries, timeouts, configuration variants, and feature-disabled paths.
- Database migration `up` and `down` behavior through migration integration tests.
- React client/server branches, loading/error/empty/success states, form validation, reducers/selectors, hooks, and API adapters.
- Email template render functions and event-dispatch branches.

### Excluded from runtime coverage

- Type-only declarations and interfaces that emit no JavaScript.
- Generated output (`dist`, `.next`, coverage reports), third-party/vendor code, and lockfiles.
- Static content-only JSON translation catalogs; these use schema, key-parity, and missing-key checks instead.
- Test fixtures and test support code; these are validated indirectly by consuming tests and static checks.

Every exclusion must be explicit in the repository's test configuration, include a reason, and be reviewed by CODEOWNERS. Broad directory exclusions such as `components`, `routes`, `migrations`, or `config` are prohibited.

### Thresholds

The final enforced thresholds are:

| Metric | Global | Per file | Changed executable code |
|---|---:|---:|---:|
| Statements | 100% | 100% | 100% |
| Branches | 100% | 100% | 100% |
| Functions | 100% | 100% | 100% |
| Lines | 100% | 100% | 100% |

Because the starting global coverage is near zero, enforcement rolls out without allowing regression:

1. **Observe:** Publish accurate reports; fail on no tests, test errors, skipped/focused tests, or invalid coverage configuration.
2. **Protect new work:** Enforce 100% changed-code coverage and reject any global decrease.
3. **Ratcheting:** Raise repository thresholds as characterization suites land. Threshold changes only move upward.
4. **Final enforcement:** Set 100% global and per-file thresholds before the large refactoring begins.

The ratchet is a migration mechanism, not a waiver of the final objective.

## Test layers

### Unit tests

Fast, deterministic tests for pure functions, services with injected boundaries, reducers/selectors, schemas, validators, middleware decisions, serialization, key generation, templates, and error mapping.

- Runtime target: under 60 seconds per repository in CI.
- No network, real clock, random data, shared filesystem, or fixed ports.
- Fake timers and deterministic IDs/OTP values are required where relevant.

### Component tests

React Testing Library with a real QueryClient/store/router façade for forms, dialogs, settings panels, navigation, cards, state transitions, accessibility names, keyboard behavior, and loading/error/empty/success states.

- Test behavior and accessibility, not internal component state or implementation-specific class names.
- Use MSW at the HTTP boundary; API contract tests separately prove request/response schemas.
- Run `axe` checks for interactive components and critical page compositions.

### Integration tests

- Cerberus repositories/services/routes against disposable PostgreSQL and Redis containers.
- Migration tests from empty database to head, rollback where supported, and upgrade from a representative previous schema.
- Cache behavior against real Redis: expiry, timeout, reconnect, malformed payload, and unavailable-cache fallback.
- Notify/Hermes delivery against a Kafka-compatible test broker and SMTP sink; Azure Service Bus adapters use an SDK-level contract harness when no faithful local service is available.
- HTTP tests bind to an ephemeral port (`0`) or use in-memory Supertest; fixed ports are prohibited.

### Contract tests

- Generate and validate an OpenAPI contract for Cerberus routes, auth/cookie behavior, errors, and schemas.
- Version event envelopes and validate producer/consumer compatibility for every account, profile, organization, and role event.
- Verify published package exports and TypeScript declaration compatibility for all shared libraries.
- Validate environment-variable schemas and fail startup with actionable errors.

### End-to-end tests

Playwright runs the built web app and real service stack with isolated seeded data. Required critical journeys:

1. Sign up, receive/obtain verification code, verify account, and sign in.
2. Refresh an expired access token and retain the intended authenticated state.
3. Select/create a role or profile and survive browser refresh according to the accepted auth-state ADR.
4. Update account, profile, profile details, and avatar; verify persisted results.
5. Create organization, invite collaborator, accept invitation, and enforce allowed/forbidden role actions.
6. Recover/change password, invalidate old credentials, and sign in with new credentials.
7. Sign out, invalidate the server session, clear client state, and deny private routes.
8. Confirm transactional email events are emitted once and contain safe expected content.

Each journey tests success, one validation failure, one authorization failure where applicable, and user-visible recovery from service errors.

### Mutation tests

Use mutation testing on security and domain logic to prevent assertion-free coverage:

- Critical modules: minimum mutation score 90%, no survived high-risk mutator.
- Other executable modules: minimum mutation score 80% initially, ratcheted upward.
- Pull requests mutate changed critical modules; the full suite runs nightly.
- Equivalent mutants require a documented suppression adjacent to the test configuration.

### Non-functional tests

- Accessibility: WCAG-oriented automated checks plus keyboard/focus checks for critical flows.
- Performance: web bundle budgets, API latency smoke thresholds, cache effectiveness, and event-consumer throughput baselines.
- Security: dependency review, secret scanning, CodeQL/SAST, container scanning, least-privilege workflow permissions, and auth abuse cases.
- Resilience: DB/Redis/broker/SMTP unavailable, timeout, retry, duplicate event, malformed event, and process termination scenarios.
- Compatibility: supported Node LTS runtime, browser matrix for critical Playwright journeys, and package consumer fixtures.

## Repository test matrix

| Repository | Unit/component focus | Integration/contract focus | Critical acceptance proof |
|---|---|---|---|
| `web-app` | Forms, hooks, reducers, selectors, API actions, components, i18n utilities | MSW API contract, storage/cookie policy, built-app smoke | Playwright auth/profile/organization/account journeys; accessibility and bundle budgets |
| `cerberus` | Validators, middleware, services, controllers, response/error mapping | PostgreSQL, Redis, routes, migrations, package/event contracts | Auth/session/RBAC/invitation/recovery transactional behavior and negative security cases |
| `hermes` | Dispatch, handlers, templates, config, termination | Broker/HTTP ingress and SMTP sink | Exactly-once observable email side effect under duplicate/retry scenarios |
| `notify` | Provider selection, envelope, serialization, producer/consumer decisions | Kafka and service adapter contracts | Ack/retry/dead-letter/idempotency behavior and malformed-message handling |
| `cache` | Key mapping, hit/miss, serialization, fallback, timeout | Real Redis expiry/reconnect | Cache outage never corrupts source-of-truth behavior |
| `commons` | Hashing, comparison, JWT, promises, errors | Package export/type consumer fixture | Security primitives reject malformed/expired/incorrect inputs |
| `server-utils` | Middleware order, startup, errors, logger | Ephemeral HTTP server and filesystem fallback | No leaked handle or unhandled error; deterministic shutdown/startup |
| `gh-action-templates` | YAML/action schema and shell logic | Fixture repositories invoking reusable workflows | A deliberately broken fixture fails each required gate; a valid fixture passes |

## Test data and isolation

- Factories create the minimum valid entity and allow explicit overrides.
- Each test owns its data; random data uses a seeded generator and prints the seed on failure.
- Integration suites use per-worker database schemas or disposable containers.
- Tests never depend on execution order or state from a previous test.
- Secrets are fake and scoped to tests. Production credentials are forbidden in CI test jobs.
- Golden files and snapshots are small, reviewed, and reserved for contracts/templates where semantic diff is valuable.

## Flake and performance policy

- Required suites must achieve 100 consecutive green runs before the final gate rollout.
- A flaky test blocks merge like any other failure. Quarantine requires an owner, linked issue, reason, and expiration no longer than seven days.
- CI records duration by test file and fails on configured suite budgets after a stabilization period.
- E2E traces, screenshots, videos, service logs, and coverage reports upload only on failure or as short-retention artifacts.

## Definition of tested

A component is considered tested only when:

1. Its executable paths meet all four coverage metrics.
2. Assertions verify externally meaningful behavior and error handling.
3. Its boundary contract is tested at the appropriate layer.
4. Critical negative/security cases exist.
5. Tests are deterministic and pass in clean CI.
6. Mutation results meet policy when the component is in mutation scope.
7. Documentation identifies ownership, commands, dependencies, and fixtures.

