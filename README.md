# Apart GitHub Action Templates

Shared GitHub Actions, reusable workflows, and executable quality contracts for the Apart repositories.

This repository is the foundation for consistent, reproducible CI across seven product repositories. It defines the supported runtime and package managers, validates private registry authentication, provides common composite actions, and tests the quality-gate contract with deterministic fixtures.

## What this repository provides

- A reusable environment setup action with the supported Node.js, npm, and pnpm versions.
- A redaction-safe private GitHub Packages authentication preflight.
- A reusable lint-and-test workflow that runs the canonical format, lint, type, unit, coverage, and build checks.
- A status notification composite action for GitHub commit statuses.
- Machine-readable runtime and quality-script contracts.
- Positive and negative workflow fixtures proving that intended defects fail at the correct gate.
- Documentation and implementation evidence for the Apart quality program.

The repository is a CI foundation. It is not an application, npm package, or product-service runtime.

## Repository layout

```text
.
├── .github/
│   ├── actions/
│   │   ├── notify-status/          # Composite commit-status notification
│   │   └── setup-environment/      # Runtime, package-manager, and registry setup
│   └── workflows/
│       ├── lint-and-test.yml       # Reusable pull-request quality workflow
│       ├── release-package.yml     # Package release workflow
│       └── release-docker-image.yml
├── docs/
│   ├── architecture/               # Baselines and architecture decisions
│   ├── plans/                      # Implementation and Linear execution plans
│   ├── projects/                   # Project, milestone, and issue documentation
│   ├── quality-gates/              # Quality and script contracts
│   └── testing/                    # Testing strategy and fixture guidance
├── quality-script-contract.json    # Required scripts for each product repository
├── runtime-contract.json           # Supported runtime/package-manager matrix
└── test/                           # Contract, authentication, and fixture tests
```

## Supported runtime contract

| Tool | Version |
|---|---:|
| Node.js | `24.20.0` |
| npm | `10.8.2` |
| pnpm | `10.34.0` |

The six pnpm repositories are `cerberus`, `hermes`, `notify`, `server-utils`, `commons`, and `cache`. `web-app` uses npm with `package-lock.json`. The authoritative values are in [`runtime-contract.json`](runtime-contract.json).

## Using the reusable workflow

A consumer repository calls the workflow from its own workflow file:

```yaml
name: Quality

on:
  pull_request:

jobs:
  quality:
    uses: otedesco/gh-action-templates/.github/workflows/lint-and-test.yml@<immutable-ref>
    with:
      package-manager: pnpm
      registry-auth-required: false
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Use an immutable release tag or commit SHA when consuming this repository. The `package-manager` input must match the consumer's runtime contract. Set `registry-auth-required: true` only for repositories that install private packages, and provide the token through the named secret.

The workflow runs these commands as separate, observable steps:

1. `format:check`
2. `lint:check`
3. `type:check`
4. `test`
5. `test:coverage`
6. `build`

The consumer must expose every command. These commands are check-only: they must not modify source files, silently pass when no tests exist, ignore failures, or use repair flags such as `--fix` or `--write`.

## Using the composite setup action

The setup action can be called from another workflow or composite action:

```yaml
- name: Setup Apart environment
  uses: otedesco/gh-action-templates/.github/actions/setup-environment@<immutable-ref>
  with:
    registry-auth-required: false
```

Available inputs include `node-version`, `npm-version`, `pnpm-version`, `registry-auth-required`, and `npm-token`. Keep credentials step-scoped and pass tokens only through GitHub Secrets. Never place a token in YAML, `.npmrc`, an image layer, an artifact, or a command-line argument.

## Local development

Install the required tool versions, then run the central contract suite:

```bash
pnpm test
```

Individual checks are available for focused work:

```bash
pnpm run test:runtime-contract
pnpm run test:registry-auth
pnpm run test:quality-script-contract
pnpm run test:workflow-contract
pnpm run test:workflow-fixtures
```

The workflow fixture suite copies each fixture into a temporary directory, runs it with `CI=true`, applies a timeout, records structured evidence, and verifies that the central repository is not mutated. It does not require product-repository dependencies or network services.

When available, validate all workflow and action YAML with:

```bash
actionlint .github/actions/setup-environment/action.yml .github/workflows/*.yml
```

## Quality contracts

### Product repository scripts

Every product repository must provide:

```text
format:check
lint:check
type:check
test
test:coverage
build
quality:check
```

The required scripts and repository-specific test-harness ownership are defined in [`quality-script-contract.json`](quality-script-contract.json). `quality:check` runs the first six commands in the prescribed order.

### Private registry authentication

Repositories that install private packages must fail early with one actionable, redaction-safe error when credentials are absent. The authentication implementation and tests are under `.github/actions/setup-environment/` and `test/registry-auth.test.mjs`.

### Workflow fixtures

The fixture contract includes:

- `valid` — the passing control.
- `type-error`, `lint-error`, `format-drift`, `no-tests`, `coverage-gap`, and `build-error` — executable foundation failures.
- `security-error` and `container-error` — fail-closed contract cases for later security and container enforcement.

See [`docs/testing/workflow-fixtures.md`](docs/testing/workflow-fixtures.md) for fixture anatomy, extension rules, and evidence requirements.

## Documentation guide

Start with [`docs/README.md`](docs/README.md) for the documentation reading order. The most relevant references are:

- [`runtime-contract.json`](runtime-contract.json) — supported versions and package managers.
- [`quality-script-contract.json`](quality-script-contract.json) — required consumer scripts.
- [`docs/quality-gates/gate-specification.md`](docs/quality-gates/gate-specification.md) — quality, security, container, branch, and release policy.
- [`docs/quality-gates/script-contract.md`](docs/quality-gates/script-contract.md) — check-only command rules.
- [`docs/testing/testing-and-coverage-strategy.md`](docs/testing/testing-and-coverage-strategy.md) — testing and coverage expectations.
- [`docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/MLS-001-foundation-contract.md`](docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-001-foundation-contract/MLS-001-foundation-contract.md) — current foundation milestone scope and exit criteria.

## Current scope and limitations

The foundation milestone establishes contracts and truthful core checks. Later work owns the remaining enforcement:

- Coverage ratcheting and changed-code/global coverage policy: OPS-181.
- Immutable action/workflow references and least-privilege permissions: OPS-182 and OPS-183.
- Security scanning and policy enforcement: OPS-184.
- Container build, scan, SBOM, provenance, and smoke gates: OPS-185.
- Product-repository adoption and stability evidence: OPS-187 through OPS-189.

The fixture suite intentionally makes security and container configuration defects fail closed now, without pretending that the later scanners and image checks have already been implemented.

## Contributing

Before changing a contract or shared action:

1. Read the relevant specification and milestone documentation.
2. Add or update a failing test or fixture that demonstrates the behavior.
3. Make the smallest implementation change that satisfies the contract.
4. Run `pnpm test`, the focused tests, and `actionlint` when installed.
5. Confirm check-only commands do not modify tracked files.
6. Document changed interfaces, evidence, exceptions, and follow-up ownership.

Keep reusable workflow changes backward-compatible unless the runtime or quality contract is intentionally versioned. Do not weaken a gate by adding ignored errors, retries that hide failures, broad exclusions, `continue-on-error`, `--passWithNoTests`, `--forceExit`, `--fix`, `--write`, `|| true`, or `exit 0`.

## License

No license is currently declared in this repository. Treat the contents as internal project infrastructure unless a license is added explicitly.
