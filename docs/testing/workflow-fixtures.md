# Workflow fixture testing

The central quality repository proves workflow behavior with small fixtures under `test/fixtures/workflows`.

## Fixture contract

`valid` is the control fixture. Its `quality:check` path runs the foundation commands in this order:

1. `format:check`
2. `lint:check`
3. `type:check`
4. `test`
5. `test:coverage`
6. `build`

The executable negative fixtures each contain one intentional defect and must stop at the matching gate: `type-error`, `lint-error`, `format-drift`, `no-tests`, `coverage-gap`, and `build-error`.

Security and container defects are represented by `security-error` and `container-error`. M1 validates that those inputs fail closed through the contract suite; the actual scanner, image, and runtime enforcement is owned by OPS-184 and OPS-185.

## Isolation and evidence

The runner copies a fixture into a temporary directory, executes the gate sequence with `CI=true`, bounds each child process to 60 seconds, and records structured evidence in the temporary fixture. It does not install dependencies, use network services, or expose the checked-in fixture to generated reports and artifacts.

Run the suite with:

```bash
pnpm run test:workflow-contract
pnpm run test:workflow-fixtures
```

The final evidence run should repeat `pnpm run test:workflow-fixtures` three times, run `pnpm test`, validate workflow syntax with `actionlint .github/workflows/*.yml` when available, and confirm that the working tree has no changes caused by the checks.

Later gate work should add scanner- and image-backed cases without changing the result shape or isolation rules. OPS-180 extends the core quality gate behavior; OPS-181 extends coverage ratcheting; OPS-182/183 harden workflow references and permissions; OPS-184/185 implement security and container enforcement.

# Workflow fixture contract

The fixture runner copies each fixture to an isolated temporary directory and
executes the six core gates in policy order. Every negative fixture contains
one deterministic defect and must exit non-zero at exactly its declared gate;
the valid fixture must complete all gates successfully. Structured evidence in
`.fixture-result.json` identifies the gate and includes an actionable
diagnostic. The runner snapshots the central repository before and after each
run to ensure check-only behavior does not mutate tracked or untracked files.

| Fixture                     | Gate       | Defect represented           |
| --------------------------- | ---------- | ---------------------------- |
| `valid`                     | —          | All gates pass               |
| `lint-warning`              | `lint`     | Warning output               |
| `focused-test`              | `test`     | Focused test                 |
| `skipped-test`              | `test`     | Skipped test                 |
| `unhandled-error`           | `test`     | Unhandled asynchronous error |
| `leaked-handle`             | `test`     | Leaked handle                |
| `missing-coverage-provider` | `coverage` | Missing coverage provider    |
| `uncovered-source`          | `coverage` | Source omitted from coverage |
| `build-drift`               | `build`    | Generated build drift        |

Run `pnpm run test:workflow-fixtures` three times when changing fixture
classification or runner behavior. Results must be stable and must not time
out.
