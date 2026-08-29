# OPS-177 Private Registry Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make clean, frozen-lockfile installs of Cerberus, Hermes, and Notify authenticate to GitHub Packages without persisting or printing the token, and fail before package resolution with an actionable message when the token is missing.

**Architecture:** Keep the checked-in `.npmrc` files credential-free by retaining the `@otedesco` registry mapping and `${NPM_TOKEN}` environment placeholder, then move credential validation into the shared setup action. CI passes `NPM_TOKEN` explicitly and only to steps that need it; Docker builds use BuildKit secret mounts instead of build arguments. A small, directly tested preflight executable owns the fail-fast message, while contract assertions prove workflow wiring, frozen installs, and the absence of token-bearing files/build arguments.

**Tech Stack:** GitHub Actions reusable workflows and composite actions, Node.js from the OPS-176 runtime decision, pnpm frozen lockfiles, Node test runner/coverage, Docker BuildKit secrets, GitHub Packages.

---

## Scope and sequencing

- Central implementation repository: `gh-action-templates` (run central commands from that repository root).
- Consumer repositories: this repository (`cerberus`), `../hermes`, and `../notify`.
- OPS-176 must first define the supported Node and exact pnpm versions. Reuse those values; do not choose or upgrade runtime/package-manager versions in OPS-177.
- Do not wait for OPS-179's general workflow-fixture framework. Add only the registry-auth contract tests needed by OPS-177, in a shape OPS-179 can absorb later.
- Do not change action pins, broad workflow permissions, or unrelated quality scripts; those belong to later foundation issues.
- Never use a real credential in tests. Use a sentinel such as `fixture-token-that-must-not-appear` and assert that it is absent from captured output and generated files.

### Task 1: Add the red registry-auth contract tests

**Files:**

- Create: `.github/actions/setup-environment/registry-auth.mjs`
- Create: `test/registry-auth.test.mjs`
- Create or modify: `package.json`
- Create or modify: `pnpm-lock.yaml`

**Step 1: Write a failing unit test for the missing-token path**

Export a pure `validateRegistryToken(token)` function from `registry-auth.mjs`. The first test must pass `undefined`, `""`, and whitespace-only values and assert the exact user-facing failure:

```text
Missing NPM_TOKEN: this repository installs private @otedesco packages from GitHub Packages. Configure the NPM_TOKEN repository secret with packages:read access.
```

The CLI wrapper must convert that validation error into a non-zero exit and a GitHub `::error` annotation without including any token value.

**Step 2: Write failing tests for successful and redaction-safe validation**

Pass the sentinel token and assert:

- exit status is zero;
- stdout/stderr do not contain the sentinel;
- the success message states only that credentials are configured;
- the helper does not create or modify `.npmrc` files;
- all function/branch/line/statement coverage for `registry-auth.mjs` is 100%.

Use the Node test and coverage commands established by OPS-176. Expose one focused script:

```json
{
  "scripts": {
    "test:registry-auth": "node --test test/registry-auth.test.mjs"
  }
}
```

If OPS-176 selected a coverage wrapper, include that wrapper in this script and set all four thresholds to 100 rather than adding a second coverage tool.

**Step 3: Run the tests and record the expected red result**

Run:

```bash
cd gh-action-templates
pnpm test:registry-auth
```

Expected: FAIL because `registry-auth.mjs` has not implemented the explicit missing/present token contract yet.

**Step 4: Implement the minimal helper**

Keep the helper side-effect free except at the CLI boundary. It must trim only for presence validation, never normalize, print, return, or persist the secret. Use the environment variable `INPUT_NPM_TOKEN` at the CLI boundary so the composite action never interpolates a token into a command string.

**Step 5: Run the tests with coverage**

Run `pnpm test:registry-auth`.

Expected: PASS, 100% for statements, branches, functions, and lines in `registry-auth.mjs`, with no sentinel token in the captured output.

**Step 6: Commit**

```bash
git add .github/actions/setup-environment/registry-auth.mjs test/registry-auth.test.mjs package.json pnpm-lock.yaml
git commit -m "test: define private registry auth contract"
```

### Task 2: Make the shared setup and install contract explicit

**Files:**

- Modify: `.github/actions/setup-environment/action.yml:3-61`
- Modify: `.github/workflows/lint-and-test.yml:3-39`
- Modify: `.github/workflows/release-package.yml:3-46`
- Modify: `test/registry-auth.test.mjs`

**Step 1: Add failing metadata/wiring assertions**

Extend the contract test to parse the action/workflow YAML and assert:

- the setup action declares `npm-token` and `registry-auth-required` inputs;
- token validation runs only when `registry-auth-required == 'true'`;
- reusable workflows declare their `NPM_TOKEN` secret contract;
- callers pass the token through `with.npm-token`;
- install steps use `pnpm install --frozen-lockfile`;
- no step rewrites the checked-in `.npmrc` or writes the token to `$HOME/.npmrc`;
- the token is scoped to validation, install, and publish steps rather than job-level `env`.

Run `pnpm test:registry-auth` and expect these assertions to fail against the current YAML.

**Step 2: Declare the composite-action inputs and call the helper**

Add these inputs to `setup-environment/action.yml`:

```yaml
  npm-token:
    description: GitHub Packages token used only when registry-auth-required is true
    required: false
  registry-auth-required:
    description: Fail before install when private registry credentials are absent
    required: false
    default: "false"
```

Replace the current `Creating .npmrc` step with:

```yaml
    - name: Validate private registry credentials
      if: ${{ inputs.registry-auth-required == 'true' }}
      shell: bash
      env:
        INPUT_NPM_TOKEN: ${{ inputs.npm-token }}
      run: node "$GITHUB_ACTION_PATH/registry-auth.mjs"
```

Do not write the credential to disk. Each consumer's `.npmrc` will retain the literal `${NPM_TOKEN}` placeholder and pnpm will expand it only in the credentialed install/publish process.

**Step 3: Declare reusable-workflow inputs/secrets**

In `lint-and-test.yml`, replace the scalar `on: workflow_call` with an input indicating whether the caller has private dependencies and an optional `NPM_TOKEN` secret. Pass both to the setup action. Keep public-only repositories able to use the workflow without a package token.

In `release-package.yml`, declare `NPM_TOKEN` and `GH_TOKEN` as workflow-call secrets. Publishing is always an authenticated operation, so pass `registry-auth-required: "true"` and `npm-token: ${{ secrets.NPM_TOKEN }}`.

**Step 4: Make installs deterministic and remove credential-file mutation**

Change both shared install commands to:

```yaml
      - name: Install dependencies
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: pnpm install --frozen-lockfile
```

Delete the release workflow's `$HOME/.npmrc` creation step. Keep `NPM_TOKEN` and `NODE_AUTH_TOKEN` only on the Changesets publish step.

**Step 5: Run focused and static validation**

Run:

```bash
pnpm test:registry-auth
actionlint .github/actions/setup-environment/action.yml .github/workflows/lint-and-test.yml .github/workflows/release-package.yml
```

Expected: PASS with 100% helper coverage and no undeclared input, malformed workflow-call secret, or token-writing assertion.

**Step 6: Commit**

```bash
git add .github/actions/setup-environment .github/workflows/lint-and-test.yml .github/workflows/release-package.yml test/registry-auth.test.mjs
git commit -m "fix: validate private registry credentials before install"
```

### Task 3: Replace Docker build arguments with BuildKit secrets

**Files:**

- Modify: `.github/workflows/release-docker-image.yml:3-55`
- Modify: `Dockerfile:1-9`
- Modify: `../hermes/Dockerfile:1-9`
- Modify: `../hermes/Dockerfile.worker:1-9`
- Modify: `test/registry-auth.test.mjs`

**Step 1: Add failing Docker security assertions**

Assert that the shared Docker workflow and all three Dockerfiles contain none of:

```text
ARG NPM_TOKEN
build-args: ... NPM_TOKEN
echo ... _authToken
```

Also assert that every private-package install uses a required BuildKit secret and `--frozen-lockfile`. Run the focused test and expect failure against the current files.

**Step 2: Pass the secret through BuildKit**

In `release-docker-image.yml`, delete `Replace npm token` and the token-bearing `build-args`. Declare the reusable workflow's `NPM_TOKEN` secret and configure `docker/build-push-action` with:

```yaml
          secrets: |
            npm_token=${{ secrets.NPM_TOKEN }}
```

Add a redaction-safe preflight step before Docker metadata so a missing secret fails with the same actionable message used by package installs.

**Step 3: Consume the secret without persisting it in image metadata**

Apply this installer pattern to the Cerberus Dockerfile and both Hermes Dockerfiles, retaining the runtime image selected by OPS-176:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM <OPS-176 installer image> AS installer
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npm_token,required=true \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" \
    pnpm install --frozen-lockfile && \
    rm .npmrc
```

The token must exist only in the process environment for that `RUN`; it must not be an `ARG`, `ENV`, copied file, layer command value, build log value, or final-stage artifact.

**Step 4: Prove the negative and positive image paths**

With a fake sentinel secret, first run a build without `--secret` and expect an immediate `required secret npm_token is missing` failure before pnpm. Then run the install stage with an authorized package token:

```bash
DOCKER_BUILDKIT=1 docker build --target installer --secret id=npm_token,env=NPM_TOKEN -f Dockerfile .
DOCKER_BUILDKIT=1 docker build --target installer --secret id=npm_token,env=NPM_TOKEN -f ../hermes/Dockerfile ../hermes
DOCKER_BUILDKIT=1 docker build --target installer --secret id=npm_token,env=NPM_TOKEN -f ../hermes/Dockerfile.worker ../hermes
```

Expected: all authorized installer stages succeed. Inspect image history and exported files and assert the real token is absent. Do not echo the token during inspection.

**Step 5: Run contract/static tests**

Run `pnpm test:registry-auth` from the `gh-action-templates` repository root, then run `actionlint` on `release-docker-image.yml` and a Dockerfile linter on all three Dockerfiles.

Expected: PASS; no secret-bearing build argument or workspace `.npmrc` rewrite remains.

**Step 6: Commit by repository**

```bash
# gh-action-templates
git add .github/workflows/release-docker-image.yml test/registry-auth.test.mjs
git commit -m "fix: mount registry token during image builds"

# cerberus
git add Dockerfile
git commit -m "fix: use BuildKit secret for package install"

# hermes
git add Dockerfile Dockerfile.worker
git commit -m "fix: use BuildKit secrets for package installs"
```

### Task 4: Adopt the explicit secret contract in Cerberus

**Files:**

- Modify: `.github/workflows/quality-checks.yml:12-15`
- Modify: `.github/workflows/release-packages.yml:13-20`
- Modify: `.github/workflows/release-docker.yml:11-18`
- Verify unchanged: `.npmrc`
- Verify unchanged: `pnpm-lock.yaml`

**Step 1: Add a failing consumer-wiring assertion**

From the central registry-auth test, assert that every Cerberus call to `lint-and-test.yml` passes:

```yaml
    with:
      registry-auth-required: true
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Assert the package-release call passes `NPM_TOKEN` and `GH_TOKEN`, and the Docker-release call passes the same two explicitly. Expect failure while `secrets: inherit` remains.

**Step 2: Update all Cerberus callers**

Replace each broad `secrets: inherit` with the exact secret map required by its reusable workflow. Keep workflow references unchanged in this issue; immutable references are OPS-182.

**Step 3: Verify a clean frozen install**

Create a disposable clean checkout/worktree with no `node_modules`, set `NPM_TOKEN` in the command environment without printing it, and run:

```bash
pnpm install --frozen-lockfile
git diff --exit-code -- package.json pnpm-lock.yaml .npmrc
```

Expected: install succeeds, all four private packages resolve, and the manifest, lockfile, and `.npmrc` remain byte-for-byte unchanged.

**Step 4: Verify the missing-secret failure**

Run the setup preflight fixture with `NPM_TOKEN` removed.

Expected: non-zero before `pnpm install`, with the actionable `Missing NPM_TOKEN` annotation and no 401/network attempt.

**Step 5: Validate workflow syntax and commit**

```bash
actionlint .github/workflows/*.yml
git add .github/workflows
git commit -m "ci: pass private registry credentials explicitly"
```

### Task 5: Adopt and verify Hermes and Notify

**Files:**

- Modify: `../hermes/.github/workflows/quality-checks.yml`
- Modify: `../hermes/.github/workflows/release-packages.yml`
- Modify: `../hermes/.github/workflows/release-docker.yml`
- Modify: `../notify/.github/workflows/quality-checks.yml`
- Modify: `../notify/.github/workflows/release-packages.yml`
- Verify unchanged: `../hermes/.npmrc`, `../hermes/pnpm-lock.yaml`
- Verify unchanged: `../notify/.npmrc`, `../notify/pnpm-lock.yaml`

**Step 1: Extend the failing caller assertions**

Apply the same explicit `registry-auth-required: true` and named-secret assertions to Hermes and Notify. Notify has no Docker release workflow, so do not create one.

**Step 2: Update the workflow callers**

Pass only `NPM_TOKEN` to quality checks. Pass `NPM_TOKEN` and `GH_TOKEN` to package releases. Pass `NPM_TOKEN` and `GH_TOKEN` to Hermes's Docker release. Remove `secrets: inherit` from these calls.

**Step 3: Run clean frozen installs**

In disposable clean checkouts with no `node_modules`, run `pnpm install --frozen-lockfile` for Hermes and Notify with `NPM_TOKEN` scoped to each command.

Expected: both installs succeed and `git diff --exit-code -- package.json pnpm-lock.yaml .npmrc` passes in each repository.

**Step 4: Validate workflows and run repository smoke checks**

Run:

```bash
actionlint ../hermes/.github/workflows/*.yml ../notify/.github/workflows/*.yml
pnpm --dir ../hermes type:check
pnpm --dir ../hermes build
pnpm --dir ../notify type:check
pnpm --dir ../notify build
```

Expected: PASS with no new warning or generated-file drift.

**Step 5: Commit once per repository**

```bash
# hermes
git add .github/workflows
git commit -m "ci: pass private registry credentials explicitly"

# notify
git add .github/workflows
git commit -m "ci: pass private registry credentials explicitly"
```

### Task 6: Capture final cross-repository acceptance evidence

**Files:**

- Modify: `docs/architecture/quality-baseline.md:87-109`
- Modify: `test/registry-auth.test.mjs`

**Step 1: Run the complete registry-auth suite**

Run the focused tests from `gh-action-templates` and confirm 100% coverage of the preflight helper. Run action/workflow/Dockerfile static validation across all four repositories.

**Step 2: Repeat all three clean installs from empty dependency state**

Use fresh disposable worktrees or clones—not the existing populated working directories—and run only frozen installs. Record repository, commit SHA, Node version, pnpm version, command, exit status, and whether tracked files changed. Never record the token or an authenticated URL.

**Step 3: Scan for credential leakage**

Using the sentinel credential in fixtures and the real credential only in masked CI contexts, verify:

- captured test/build output contains no token;
- repository diffs contain no token;
- generated `.npmrc` files do not contain a literal token;
- Docker history/exported final files contain no token;
- workflows contain no token interpolation in `run:` blocks and no `NPM_TOKEN` build arguments.

**Step 4: Update the baseline**

Replace the existing broken-auth observation and 401 install result with the verified behavior. Include the three frozen-install commands and the missing-token preflight result, but no credential values.

**Step 5: Run final drift checks**

Run `git status --short` in `gh-action-templates`, Cerberus, Hermes, and Notify. Only the files named in this plan should differ. Run each repository's relevant tests/type/build checks and confirm no lockfile changes.

**Step 6: Commit the evidence**

```bash
git add docs/architecture/quality-baseline.md test/registry-auth.test.mjs
git commit -m "docs: record private registry authentication proof"
```

## Definition-of-done checklist

- Missing `NPM_TOKEN` fails in preflight with an actionable message before registry access.
- Valid credentials support clean `pnpm install --frozen-lockfile` in Cerberus, Hermes, and Notify.
- No install changes any package manifest, lockfile, or checked-in `.npmrc`.
- No real token appears in logs, repository files/diffs, action outputs, Docker build arguments, image history, or final image contents.
- The shared helper has 100% statement, branch, function, and line coverage.
- Positive, missing-token, npmrc-mutation, workflow-wiring, frozen-install, and Docker-secret negative cases pass.
- Action/workflow/Dockerfile validation is green and no warnings, skips, retries, broad exclusions, or unowned exceptions were introduced.
- Evidence is recorded in the quality baseline and linked back to OPS-177 when the implementation is complete.
