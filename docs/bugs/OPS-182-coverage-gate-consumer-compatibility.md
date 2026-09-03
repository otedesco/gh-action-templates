# OPS-182: Coverage-gate compatibility bug

Status: fixed in central PR #20; hosted consumer verification in progress

Related:

- [Linear OPS-182](https://linear.app/opspace/issue/OPS-182/replace-mutable-reusable-workflow-references-and-pin-actions)
- [OPS-182 implementation plan](../plans/2026-09-02-ops-182-immutable-workflow-action-references.md)
- [gh-action-templates PR #19](https://github.com/otedesco/gh-action-templates/pull/19)
- [gh-action-templates PR #20](https://github.com/otedesco/gh-action-templates/pull/20)

## Executive summary

OPS-182 required the repositories to stop using mutable workflow/action references. After the consumer repositories were repinned to immutable revisions, their CI exposed an existing compatibility problem between the central `coverage-gate` action and the coverage reports produced by the consuming repositories.

The central action assumed one coverage-report schema and one coverage workflow contract, while the consumers produced several Istanbul/Jest/Vitest variants. GitHub Actions job logs from the latest five consumer runs exposed three remaining causes: valid empty function/branch maps were rejected, an empty Jest `coverage-final.json` prevented use of its valid summary, and Volta setup modified consumer manifests before the generated-file drift check.

PR #20 fixes all three causes. The five coverage commands and central gate were replayed locally against the recorded PR base/head scope and passed.

## Scope

Affected consumer PRs:

- [commons #18](https://github.com/otedesco/commons/pull/18)
- [cache #22](https://github.com/otedesco/cache/pull/22)
- [server-utils #13](https://github.com/otedesco/server-utils/pull/13)
- [notify #18](https://github.com/otedesco/notify/pull/18)
- [cerberus #50](https://github.com/otedesco/cerberus/pull/50)

The central compatibility work is in [gh-action-templates PR #19](https://github.com/otedesco/gh-action-templates/pull/19), branch `ops-182-coverage-format-fix`.

Hermes had already received the corresponding change in PR #18 and is not part of the remaining consumer set.

## Intended behavior

The reusable workflow runs the central coverage gate to:

1. read per-file coverage;
2. identify the source inventory;
3. evaluate changed-code coverage;
4. enforce the repository's coverage ratchet against its baseline; and
5. detect generated-file drift.

For this to work, each consumer must provide a compatible coverage report, a baseline at `coverage-baselines/current.json`, and source files that can be mapped to the base/head revisions used by the workflow.

## Failure timeline

### 1. The pinned workflow referenced consumer scripts that did not exist

The first immutable central reference was commit `b0bd33051b7b5b8ebe0a8f5a1c588ea0d466ed2d`. Its reusable workflow called these scripts directly:

```text
coverage:source
coverage:normalize
coverage:changed
coverage:ratchet
```

The affected consumers did not define `coverage:source`, so the first CI failure was effectively:

```text
ERR_PNPM_NO_SCRIPT Missing script: coverage:source
```

This was a real workflow/consumer contract mismatch, not an expected failure from the immutable-reference change.

### 2. The coverage report did not have the expected `files` object

After the workflow was repinned through central PR #18, the coverage action reached report normalization and failed with:

```text
Error: Coverage report must contain a files object
    at normalizeCoverage (.../scripts/coverage/normalize.mjs:48:68)
    at readAndNormalize (.../scripts/coverage/normalize.mjs:62:10)
code: missing-files
```

The action expected a wrapper such as `{ "files": ... }`. The consumers instead generated standard Istanbul-compatible formats:

- Vitest's raw JSON was a top-level map keyed by source-file path.
- Jest's `coverage-final.json` could be empty, while `coverage-summary.json` contained a `total` record and per-file records.
- Vitest initially emitted `json-summary`, `lcov`, and `cobertura`, but not the raw per-file JSON required by the gate.

This is the error reported from the Cerberus pipeline, and the same incompatibility affected the other consumer pipelines.

### 3. Raw Istanbul reports did not always include line totals

The central normalizer was extended to accept raw Istanbul maps. That exposed a second schema detail: the Vitest raw report contained statement maps (`statementMap`/`s`) but did not always contain a line map (`l`). The normalizer therefore needed to derive line coverage from statement coverage when line data was absent.

### 4. The source inventory and baseline also affected the gate

The consumers needed to generate coverage for all `src/**/*.ts` files, not only files touched by tests. The attempted consumer changes added the relevant Vitest/Jest collection options and created `coverage-baselines/current.json`.

The source inventory also included type-only interface files that do not produce executable coverage. The central source filtering was extended to exclude the `interfaces` directory.

Cerberus initially used locally measured percentages as its baseline, then moved to a conservative zero floor because hosted and local coverage totals differed. This avoids masking a regression but does not explain or fix the remaining hosted failure.

## Changes already attempted

Central repository changes on `ops-182-coverage-format-fix`:

- `93379e36e551d3642c961a25b724a61c15b14421` — accept raw Istanbul and per-file summary coverage reports;
- `5ab71f71d175fba93b5459f77afba14e816c7a18` — derive line coverage from statements when necessary;
- `ea78f42b1c3e10da0b3049286bfd9d1462b65319` — exclude type-only `interfaces` sources;
- `5024403d1e4eaf9a26603fb71773a5260ea5f370` — pin the reusable workflow's `coverage-gate` action to the compatibility revision.

Consumer changes:

- Vitest consumers now request the raw JSON reporter and collect all `src/**/*.ts` files.
- Cerberus's Jest command now collects coverage from `src/**/*.ts`.
- Each consumer has a checked-in `coverage-baselines/current.json`.
- The consumer workflow references were repinned to central commit `5024403d1e4eaf9a26603fb71773a5260ea5f370`.

The central unit tests for coverage normalization passed locally. The local coverage gate also passed for all five consumers after these changes, but hosted CI remained red, so local success is not sufficient evidence that the fix is complete.

## Diagnosed hosted state

The latest runs checked after the compatibility changes were:

| Repository / PR | Run | Failing step | Interpretation |
| --- | ---: | --- | --- |
| commons #18 | `33700397772` | Evaluate changed-code coverage | Raw Istanbul file with no branch sites was rejected as missing branch coverage. |
| cache #22 | `33700386951` | Check for generated-file drift | `volta pin` added a `volta` block to `package.json`. |
| server-utils #13 | `33700389986` | Check for generated-file drift | `volta pin` added a `volta` block to `package.json`. |
| notify #18 | `33700391247` | Evaluate changed-code coverage | Raw Istanbul file with no function sites was rejected as missing function coverage. |
| cerberus #50 | `33700466585` | Evaluate changed-code coverage | Jest's empty `coverage-final.json` was selected instead of its populated `coverage-summary.json`. |

The failures were verified from the authenticated GitHub Actions job logs. Artifacts `9873298833`, `9873296146`, `9873297986`, `9873298382`, and `9873324644` remain the corresponding coverage evidence.

## Final fix

- Treat present empty Istanbul `f` and `b` maps as valid zero-total metrics.
- When `coverage-final.json` is present but contains no files, read the sibling `coverage-summary.json`.
- Configure `volta-cli/action` to install only Volta, then run `volta install` for Node/npm. Do not pass its `node-version` or `npm-version` inputs because those inputs run `volta pin` and edit the caller's package manifest.
- Pin the reusable workflow and all five open consumers to the reviewed compatibility commits.

## What is likely expected versus a bug

- Failing because an immutable reference points to a pre-merge central workflow is an expected integration risk while sequencing the PRs, but it is not an acceptable final state.
- Failing on a missing consumer script or unsupported report schema is a central workflow/consumer compatibility bug.
- Failing the changed-code coverage or ratchet checks can be expected if the measured coverage genuinely violates the repository policy. It is a bug if the decision is caused by incorrect path mapping, an incorrect base revision, generated files, missing source exclusions, or a mismatch between the report and baseline.
- A generated-file drift failure should be investigated separately; it may indicate that the workflow mutates a tracked artifact or that the checked-in baseline was generated with a different formatter/version.

## Verification checklist

1. Central tests, formatting, linting, and the immutable-reference audit pass locally.
2. The coverage command and gate pass locally for Commons, Cache, Server Utils, Notify, and Cerberus using each recorded PR base and branch head.
3. Central PR #20 publishes workflow commit `b31a412a635636c20e9e026bd85e345880a5c3a5`, which pins its composite actions to implementation commit `3105868fc19ef2bc4969b38d3803ea13a907d1aa`.
4. The five consumer PR branches are pinned to workflow commit `b31a412a635636c20e9e026bd85e345880a5c3a5`.
5. Hosted checks must pass before the consumer PRs are merged.

## Useful local reproductions

The original missing-script failure can be reproduced in an affected consumer with:

```text
pnpm run coverage:source
```

The central normalizer/action can be exercised locally from a consumer by providing:

```text
COVERAGE_REPORT=coverage/coverage-final.json
COVERAGE_BASELINE=coverage-baselines/current.json
```

The local action invocation passed after the attempted compatibility changes, while the hosted runs above continued to fail. That difference is the key unresolved part of the bug.
