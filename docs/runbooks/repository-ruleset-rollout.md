# OPS-186 Repository Ruleset Rollout

**Status:** Active on all eight repositories; the reviewed solo-maintainer bypass update is pending.

## Purpose

Apply the generated `PRJ-001 main protection` ruleset to the eight repositories in the inventory. The ruleset targets only `refs/heads/main` and requires pull requests, one approval, CODEOWNERS review, stale-review dismissal, conversation resolution, strict status checks, linear history, no force pushes, and no branch deletion. Because `otedesco` is currently the sole maintainer and cannot approve an owner-authored pull request, the policy names that exact GitHub user as a `pull_request`-only bypass actor. This removes the review deadlock while preserving the pull-request record and keeping direct pushes subject to the ruleset. The checked-in payload is the desired state, not proof that the server currently enforces it.

The enforcement tool is the GitHub Repository Rulesets REST API, invoked through `gh api` by an administrator. The GitHub Codex app is the read-back and review source of truth for repository state, pull requests, check runs, and the resulting `main` commits. GitHub documents that creating or updating a repository ruleset requires repository Administration write permission, and that active rulesets take effect immediately; therefore this runbook deliberately separates read-only preparation from the write step. See the [REST rules API](https://docs.github.com/en/rest/repos/rules) and [ruleset creation guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

## Preconditions

1. `governance/repositories.json` contains the exact eight repositories, target branch, CODEOWNERS path, workflow paths, check contexts, and only the approved exact-user, pull-request-only bypass actor.
2. `governance/rulesets/PRJ-001-main.json` was regenerated with `node scripts/governance/render-rulesets.mjs` and matches the checked-in payload test.
3. Every required check has emitted a stable context on a pull request. Until then, leave `observed: false` and do not apply an active ruleset.
4. An administrator has reviewed the payload, current ruleset inventory, branch-protection limitation, CODEOWNERS identities, required-check provenance, and rollout order.
5. The administrator has a rollback decision and a disposable verification pull request prepared for each repository.

## Read-only preparation

From `gh-action-templates`, run:

```bash
pnpm test:repository-rulesets
pnpm test:codeowners
pnpm test:required-checks
node scripts/governance/audit-codeowners.mjs --workspace
node scripts/governance/inspect-default-branch.mjs --workspace
node scripts/governance/inspect-default-branch.mjs --workspace --require-observed
pnpm test:ruleset-payload
pnpm lint:check
pnpm lint:workflows
git diff --check
```

The last required-check audit is expected to fail until successful and failing pull-request runs have been recorded and the corresponding inventory entries are set to `observed: true`. A failure is a stop condition, not a reason to lower the required-check set.

List current repository rulesets without changing state:

```bash
gh api --method GET repos/otedesco/REPOSITORY/rulesets -f includes_parents=true
```

Repeat for all eight repositories. Record only policy-relevant fields in `docs/evidence/OPS-186-rulesets.json`: repository, branch, ruleset name/id when present, enforcement, target include, rule types, required contexts, bypass actor types/modes, capture date, and the source URL. Do not commit tokens, full unrelated repository metadata, or unredacted administrative responses.

The GitHub Codex app must independently read back `/repos/otedesco/REPOSITORY/rulesets` and the relevant pull requests/checks. If the app cannot read branch protection, record that exact limitation; do not represent the unavailable response as an empty or compliant policy.

## Generate and review the desired payload

```bash
node scripts/governance/render-rulesets.mjs > /tmp/ops-186-rulesets.json
diff -u governance/rulesets/PRJ-001-main.json /tmp/ops-186-rulesets.json
```

The generated object contains one API payload per repository. The `observed` flag is intentionally inventory metadata and is not sent to GitHub. Before applying, confirm that every `required_status_checks[].context` is the exact check-run context emitted by the intended pull-request workflow. GitHub status-check requirements match context names; they do not independently encode workflow, matrix, or event provenance.

## Staged application

Use the fail-closed rollout script to execute the checks above against each repository's live `main`, confirm repository-administrator access, prove the exact required contexts on successful merged pull requests, and reject unexpected inherited or repository rulesets:

```bash
./scripts/governance/apply-and-verify-rulesets.sh
./scripts/governance/apply-and-verify-rulesets.sh \
  --apply \
  --report /tmp/ops-186-ruleset-verification.json

# Only when the reviewed desired policy intentionally changes an existing ruleset:
./scripts/governance/apply-and-verify-rulesets.sh \
  --apply \
  --update-existing \
  --report /tmp/ops-186-ruleset-verification.json
```

The first command is read-only. The second command creates only missing `PRJ-001 main protection` rulesets. The third command may update an existing ruleset only when that exact name occurs once and both write flags are explicit. Every write path reads the ruleset back, compares its normalized policy with the generated payload, confirms that GitHub reports `main` as protected, and writes a sanitized report. The script never deletes a ruleset and stops on unexpected policy layering or any mismatch. The live verification still requires independent GitHub Codex app read-back and controlled positive and negative pull-request tests.

Apply one repository at a time in this order:

1. `gh-action-templates`
2. `commons`, `cache`, and `server-utils`
3. `notify`
4. `cerberus` and `hermes`
5. `web-app`

For each repository, extract that repository's `payload` object from the reviewed generated file and send it with an administrator credential:

```bash
gh api --method POST repos/otedesco/REPOSITORY/rulesets \
  --input /path/to/repository-payload.json
```

Do not use an ad hoc `--method PUT` or `DELETE` unless the administrator has identified the exact existing ruleset ID and approved the change. Prefer the guarded `--apply --update-existing` path for a reviewed policy update. If a ruleset already exists, compare it first and update only the uniquely named ruleset after confirming that layering will not create a more restrictive unintended policy. Never apply a payload with wildcard bypasses, an `always` bypass, a missing check, `enforcement: evaluate`, or a target other than `refs/heads/main`.

After each write, read the returned ruleset and then read it again through the GitHub Codex app. Compare target, enforcement, pull-request parameters, required contexts, history rules, and bypass actors with the generated payload. Stop immediately on any mismatch, unexpected inherited rule, failed workflow, or inability to prove the required check provenance.

## Verification and rollback

For each repository, use a controlled pull request that changes a harmless tracked file and verify the normal path is possible only with the required review, resolved conversations, current base, and passing required checks. When the pull-request author is the sole named CODEOWNER, wait for every required check to pass and resolve every review conversation before explicitly choosing the ruleset bypass to merge. Never use the bypass to ignore a failed, pending, or missing check. GitHub records the bypass on the pull request, while `pull_request` mode does not permit a direct push to `main`. Use separate controlled evidence for failed status checks and stale approvals. Do not test direct pushes or branch deletion destructively on a production branch; the ruleset configuration and the GitHub app's read-only rule evaluation are the safe evidence for those controls.

If the ruleset blocks an expected valid pull request, pause the rollout, capture the PR/check URL and ruleset read-back, and disable or update only the exact ruleset with administrator approval. Re-run the read-back before resuming. A rollback is not complete until the server state, the evidence record, and the Linear issue reflect the same result.

## Completion evidence

For every repository, record the ruleset read-back URL, resulting `main` commit, required-check run URLs, positive/negative verification result, and any limitation in `docs/evidence/OPS-186-rulesets.json`. Mark a check observed only after both normal success and intentional failure behavior have been verified. The OPS-186 task remains open until all implementation PRs, live verification, and the separate documentation closeout PR are merged into the relevant `main` branches.
