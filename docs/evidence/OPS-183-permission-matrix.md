# OPS-183 workflow permission matrix

This document records the least-privilege grants enforced by `supply-chain/workflow-permissions.json`. The audit is static and deterministic: it reads workflow YAML text, checks event/workflow/job permissions and named secret references, and reports rule, actual value, expected value, and remediation. It never executes workflow code or prints secret values.

## Effective grants

| Workflow class               | Event context                                  | Job token permissions                     | Named secrets                                  | Purpose                                                                        |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Quality checks               | `pull_request`, `workflow_call`                | `contents: read`                          | None, or `NPM_TOKEN` only for private installs | Checkout, install, test, coverage evidence, and build                          |
| Package release              | `push` / manual dispatch / `workflow_call`     | `contents: write`, `pull-requests: write` | `NPM_TOKEN`                                    | Changesets PR/publish flow and registry authentication                         |
| Container release            | `push` tag / manual dispatch / `workflow_call` | `contents: read`, `packages: write`       | `NPM_TOKEN`                                    | Read source and push the GHCR image; authenticate private package installation |
| Fork/dependency pull request | `pull_request` from untrusted code             | Read-only quality grant only              | None                                           | Prevent untrusted code from receiving release credentials or write authority   |

## Consumer adoption

The policy covers all eight repositories: `gh-action-templates`, `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, and `web-app`. Every configured workflow has an explicit top-level permission declaration and every configured job has an explicit job-level declaration. `web-app` is intentionally represented by a quality-only caller because it has no release workflow.

Private-install consumers declare and map `NPM_TOKEN` only where their existing registry contract requires it: `notify`, `cerberus`, and `hermes`. Public package consumers keep their quality jobs secret-free and map `NPM_TOKEN` only to the package release job. Container release callers map only `NPM_TOKEN`; the automatic `github.token` supplies the narrowly scoped GitHub token permission for GHCR.

## Isolation controls

- `secrets: inherit` is rejected by the auditor.
- Custom `GH_TOKEN` and `GITHUB_TOKEN` secrets are rejected; workflows use the automatic `github.token` where required.
- Job-level secret environment variables are rejected; registry credentials remain step inputs or step-level environment values.
- `write-all`, missing permissions, unexplained scopes, undeclared reusable secrets, unlisted workflows, and unexpected events fail closed.
- Fork-safe fixtures prove a pull-request quality job has no write permission or release credential, while release fixtures prove package and container jobs receive only their declared scopes.

## Reproduction

From `gh-action-templates`:

```sh
pnpm run test:workflow-permissions
node scripts/audit-workflow-permissions.mjs
```

The expected result is six permission tests passing and `workflow permissions: 8 repositories audited`.
