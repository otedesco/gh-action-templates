# OPS-186 Repository Rulesets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce pull requests, ownership review, strict required checks, protected history, and audited bypass rules on `main` across `gh-action-templates` and the seven product repositories.

**Architecture:** Define one machine-readable branch-policy contract and repository inventory in `gh-action-templates`. Validate CODEOWNERS and required-check names locally, generate desired GitHub ruleset payloads, then apply and read back the live policy one repository at a time with administrator approval. Store sanitized live evidence and controlled positive/negative verification results; configuration files alone never establish completion.

**Tech Stack:** GitHub repository rulesets, GitHub CLI/API, GitHub Actions, YAML workflow inspection, CODEOWNERS, Node.js test runner, JSON, Markdown.

---

## Scope and constraints

- Linear issue: `OPS-186`; milestone: `MLS-003`; repositories: `otedesco/gh-action-templates`, `otedesco/commons`, `otedesco/cache`, `otedesco/server-utils`, `otedesco/notify`, `otedesco/cerberus`, `otedesco/hermes`, and `otedesco/web-app`.
- Do not apply live rulesets until an administrator has reviewed the generated repository list, required checks, branch target, bypass actors, and enforcement mode.
- Preserve the existing implementation branches and unrelated worktree changes. Use one central policy PR plus independent consumer `CODEOWNERS`/workflow-contract PRs where repository ownership changes are needed.
- Required checks must be observed from the default-branch workflow graph and GitHub check runs. Do not invent a check name from a workflow display name or bind a ruleset to transient matrix children.
- Never commit tokens, raw ruleset responses containing unrelated repository settings, private actor details beyond the approved identifiers, or evidence from an uncontrolled destructive test.
- This task is not complete when the ruleset JSON is written or a PR is opened. Every scoped implementation PR and the documentation closeout PR must be merged into each repository's `main`, and the resulting `main` commits must be verified through the GitHub Codex app.

## Why this change is needed and which tool we will use

The current quality, security, coverage, and release workflows can report green results, but a repository administrator can still accept a direct push, merge without the intended review, or configure a required check that is missing, stale, or unrelated to the reviewed workflow. `CODEOWNERS` expresses ownership but does not itself require pull requests, reviews, current-base checks, protected history, or controlled bypasses. Those controls must be enforced by GitHub at the repository boundary so every delivery path observes the same policy.

We will use **GitHub Repository Rulesets** as the enforcement tool, configured through the GitHub REST API or `gh` CLI and reviewed through the GitHub Codex app. The local Node.js policy validator and generated JSON payloads provide repeatable desired state; GitHub Rulesets provide the authoritative server-side enforcement; live read-back and controlled PRs provide evidence. This combination is required because local files and workflow tests cannot prove that the live repository accepts or rejects a change as intended.

The project-wide tool rationale and new-repository onboarding instructions are in [Project 1 Tooling and New-Repository Configuration](../tools/project-1-new-repository-configuration.md). That guide covers every tool introduced or named by Project 1 through MLS-003, including the exact runtime contract, quality and coverage tools, security scanners, container/release tooling, workflow actions, and repository governance controls. Tools described as optional or deferred alternatives must not be added to a new repository without an explicit policy update.

### Task 0: Document Project 1 tools and the new-repository path

**Files:**

- Create: `docs/tools/project-1-new-repository-configuration.md`
- Modify: `docs/README.md`
- Modify: `docs/quality-gates/gate-specification.md`

**Step 1: Inventory each introduced tool**

For every runtime, package manager, workflow action, quality tool, coverage format, security scanner, container tool, release service, and governance control named by Project 1, record its purpose, whether it is required/current or optional/deferred, its source-of-truth configuration, and the exact new-repository setup.

**Step 2: Document the new-repository sequence**

Describe how to create a repository from an empty `main`: declare Node `24.20.0` and the approved package manager, add the canonical scripts, add CODEOWNERS, call the immutable reusable workflows, configure private-package or container credentials only when needed, create evidence, and apply the ruleset only after required checks have emitted stable contexts.

**Step 3: Add configuration examples and anti-patterns**

Include minimal manifest/workflow/CODEOWNERS/ruleset examples, the required action-pin and permission rules, and explicit failures for mutable action refs, `secrets: inherit`, token-bearing Docker layers, `--fix` quality checks, missing tests/providers, absent attestations, and rulesets bound to nonexistent checks.

**Step 4: Link the guide from the documentation index and quality contract**

Add links from `docs/README.md` and `docs/quality-gates/gate-specification.md` so a new repository owner can find the guide without reading historical plans.

**Step 5: Validate documentation references**

Run the central JSON, formatting, lint, existing contract tests, and `git diff --check`. Verify every relative link in the new guide resolves and that every tool in the Project 1 inventory has a rationale and onboarding instruction.

**Step 6: Commit the documentation work separately**

```bash
git add docs/tools/project-1-new-repository-configuration.md docs/README.md docs/quality-gates/gate-specification.md
git commit -m "docs: explain project tooling and new repository setup"
```

## Repository and check inventory to confirm

The initial workflow inspection shows these candidate job/check contexts:

| Repository group | Workflows | Candidate required checks |
|---|---|---|
| `gh-action-templates` | `lint-and-test.yml`, `security.yml`, release workflows | central quality/security checks; release checks only where the repository's protected delivery path requires them |
| `commons`, `cache`, `server-utils` | `quality-checks.yml`, `release-packages.yml` | `lint-and-test`, `security`, and the package release check as applicable |
| `notify` | `quality-checks.yml`, `release-packages.yml` | `lint-and-test`, `security`, and package release check as applicable |
| `cerberus`, `hermes` | `quality-checks.yml`, `release-packages.yml`, `release-docker.yml` | `lint-and-test`, `security`, package release check, and Docker release verification check as applicable |
| `web-app` | `security.yml` | security check plus the product's existing quality checks once confirmed; do not require a check that its default branch does not emit |

The first implementation task must replace these candidates with exact check-run names and workflow/job provenance gathered from the default branch. If a repository has a missing quality workflow or an unstable check, fix that contract in the owning repository before applying its ruleset.

### Task 1: Inventory live state and freeze the policy inputs

**Files:**

- Create: `governance/repositories.json`
- Create: `governance/repository-ruleset-policy.json`
- Create: `scripts/governance/inspect-default-branch.mjs`
- Create: `test/repository-rulesets.test.mjs`
- Modify: `package.json`

**Step 1: Record the eight repository inventory entries**

Include repository name, default branch, protected branch (`main`), owner/team identifiers, CODEOWNERS path, workflow paths, release paths, required-check candidates, and the approved bypass actor set. Make the inventory deterministic and reject duplicate or out-of-scope repositories.

**Step 2: Define the policy contract**

Require pull requests, at least one approval, stale-approval dismissal, code-owner review for owned paths, conversation resolution, strict/current-base status checks, force-push denial, deletion denial, and explicit bypass actors. Represent enforcement mode, target branch, review count, required checks, bypass actors, and expected workflow provenance as data rather than duplicating rules in scripts.

**Step 3: Add red validation tests**

Test rejection of missing repositories, non-`main` targets, omitted PR rules, zero approvals, missing code-owner enforcement, non-strict checks, duplicate check names, force-push/deletion allowances, wildcard bypass actors, and required checks not emitted by the inventory's default-branch workflows.

**Step 4: Add the focused command**

Add `test:repository-rulesets` to the central `package.json`, run `pnpm test:repository-rulesets`, and confirm it fails against the incomplete policy before implementing the validator.

**Step 5: Implement deterministic policy validation**

Make the validator report repository, rule, actual value, expected value, and remediation. Parse workflow YAML conservatively for names, jobs, triggers, and reusable-workflow calls; treat unavailable or ambiguous check provenance as an error rather than a pass.

**Step 6: Run and commit the central policy contract**

Run `pnpm test:repository-rulesets`, `pnpm lint:check`, and `git diff --check`. Commit only the central policy, inventory, validator, tests, and package script with:

```bash
git add governance scripts/governance test/repository-rulesets.test.mjs package.json
git commit -m "test: define protected branch policy"
```

### Task 2: Audit and add ownership files in every repository

**Files:**

- Create or modify: `.github/CODEOWNERS` in each of `gh-action-templates`, `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, and `web-app`
- Create: `scripts/governance/audit-codeowners.mjs`
- Create: `test/codeowners.test.mjs`
- Modify: `governance/repositories.json`
- Modify: `package.json`

**Step 1: Write failing CODEOWNERS tests**

Reject a missing file, empty ownership rules, unowned workflow/policy/release paths, malformed owners, nonexistent configured teams/users, and rules that do not cover the repository's critical paths.

**Step 2: Add the narrowest ownership rules**

Assign the repository's approved maintainer/team to `.github/**`, release/container files, governance/configuration files, and the source paths identified by the repository inventory. Use explicit paths before any fallback rule; do not broaden ownership to arbitrary external users.

**Step 3: Validate all eight repositories**

Run `pnpm test:codeowners` and `pnpm test:repository-rulesets` from `gh-action-templates`, plus the repository-native checks for each consumer. Record any unavailable team lookup as an administrator verification item, not as a successful audit.

**Step 4: Commit each repository's ownership change**

Create one focused branch/PR per affected repository so ownership review is visible and independently mergeable. Link each PR from the central inventory or evidence record once URLs exist.

### Task 3: Confirm stable required checks from default-branch runs

**Files:**

- Modify: `governance/repositories.json`
- Create: `scripts/governance/audit-required-checks.mjs`
- Create: `test/required-checks.test.mjs`
- Create: `docs/runbooks/required-check-discovery.md`

**Step 1: Query default-branch workflow definitions read-only**

For each repository, inspect `.github/workflows` on `main`, workflow names, job IDs, reusable workflow calls, triggers, and branch filters. Confirm that required checks run on pull requests and are not release-only or manual-only jobs.

**Step 2: Query recent successful and failed check runs**

Use the GitHub API/CLI to map check-run names to workflow/job provenance. Capture only check name, workflow/job identifier, repository, commit, and URL. Verify at least one normal pull-request or equivalent validation run for every required check.

**Step 3: Reject unstable or misleading contexts**

Fail if a check is absent, renamed between runs, emitted only by an unrelated workflow, satisfied by a release tag, or dependent on a mutable shared-workflow reference. Keep the required-check list minimal and repository-specific.

**Step 4: Update the policy and document discovery**

Store exact contexts and workflow SHAs in `governance/repositories.json`, document how an administrator can reproduce discovery, and rerun `pnpm test:required-checks` and `pnpm test:repository-rulesets`.

### Task 4: Generate and review desired ruleset payloads

**Files:**

- Create: `governance/rulesets/PRJ-001-main.json`
- Create: `scripts/governance/render-rulesets.mjs`
- Create: `test/ruleset-payload.test.mjs`
- Create: `docs/runbooks/repository-ruleset-rollout.md`

**Step 1: Add payload tests**

Require a single `main` ruleset per repository or explicitly documented compatible layering, pull-request enforcement, review/code-owner rules, strict required checks, conversation resolution, force-push/deletion denial, and only named minimal bypass actors. Reject wildcard bypasses and mismatched repository targets.

**Step 2: Render normalized desired payloads**

Generate payloads from the policy and inventory. Normalize ordering so repeated renders are stable, include exact required-check contexts, and keep repository-specific exceptions explicit and reviewable.

**Step 3: Export current rulesets read-only**

Record current state and differences for all eight repositories. Sanitize the export to policy-relevant fields only, and mark repositories with no existing ruleset as pending rather than treating absence as compliance.

**Step 4: Write the administrator rollout runbook**

Document prerequisites, read-only diff review, dry-run/validation commands, staged order, rollback/disable procedure, expected API responses, and the stop condition for any mismatch or unexpected blocked workflow.

**Step 5: Run central validation and commit the desired state**

Run `pnpm test:ruleset-payload`, `pnpm test:repository-rulesets`, `pnpm lint:check`, and `git diff --check`. Commit the policy-derived payload and runbook separately from live evidence.

### Task 5: Apply rulesets in an administrator-reviewed staged rollout

**Files:**

- Create: `docs/evidence/OPS-186-rulesets.json`
- Modify: `docs/evidence/OPS-186-rulesets.json` after each repository

**Step 1: Obtain administrator review of the generated diff**

Review all eight repositories, target branches, required checks, owners, bypass actors, and enforcement mode. Resolve every ambiguous actor or missing check before any write operation.

**Step 2: Apply to `gh-action-templates` first**

Create or update the live ruleset through the GitHub API/CLI. Keep the initial rollout observable and verify that an ordinary pull request can execute the required workflows.

**Step 3: Read back and validate immediately**

Fetch the live ruleset, compare it to the normalized desired payload, and record the ruleset ID, enforcement mode, target, checks, actors, timestamp, response URL, and resulting `main` commit. Stop if any field differs.

**Step 4: Repeat one repository at a time**

Apply the same process to `commons`, `cache`, `server-utils`, `notify`, `cerberus`, `hermes`, and `web-app`. Do not batch writes; a mismatch in one repository must not be hidden by continuing the rollout.

**Step 5: Commit sanitized live evidence**

Run local policy validation and commit only the evidence fields needed to reproduce compliance:

```bash
git add docs/evidence/OPS-186-rulesets.json
git commit -m "docs: record protected branch rollout"
```

### Task 6: Prove enforcement with controlled positive and negative changes

**Files:**

- Create: `docs/evidence/OPS-186-live-verification.md`
- Modify: `docs/evidence/OPS-186-rulesets.json`

**Step 1: Prepare disposable verification branches/PRs**

Use harmless documentation-only changes and predeclare each test's repository, branch, expected outcome, cleanup plan, and evidence URL. Do not push intentionally malicious content or bypass protection on a production branch.

**Step 2: Verify negative cases**

For every repository, prove that a PR cannot merge with a failed required check, missing approval, missing code-owner review where applicable, unresolved conversation, stale/out-of-date branch where strict checks require refresh, direct push, or force-push/deletion attempt. Capture the exact blocked reason and URL.

**Step 3: Verify the positive path**

Prove that a current, approved, conversation-resolved, fully green PR can merge normally. Record the merge commit and check contexts; clean up disposable branches/PRs through the normal recoverable workflow.

**Step 4: Verify bypass behavior**

Exercise only approved bypass actors where safe and authorized, capture the audit event, and confirm an unapproved actor cannot bypass. If a test cannot be safely run, record the administrator attestation and limitation explicitly.

**Step 5: Validate evidence and commit**

Run all central policy, CODEOWNERS, required-check, JSON, formatting, lint, and fixture tests. Add live URLs, timestamps, repository `main` commits, and limitations to the evidence files, then commit:

```bash
git add docs/evidence/OPS-186-rulesets.json docs/evidence/OPS-186-live-verification.md
git commit -m "docs: record protected branch verification"
```

### Task 7: Complete repository PRs and mandatory documentation closeout

**Files:**

- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/tasks/OPS-186-repository-rulesets.md`
- Modify: `docs/projects/PRJ-001-quality-gates-ci-foundation/milestones/MLS-003-security-release-branch-enforcement/MLS-003-security-release-branch-enforcement.md`
- Modify: the dedicated Linear project document and linked milestone/issues, when Linear is available

**Step 1: Merge all implementation PRs**

Merge the central policy/evidence PR and every consumer ownership/workflow-contract PR. Record exact PR links and merge commits; do not call the task complete while any scoped PR remains open.

**Step 2: Verify every repository's `main` through the GitHub Codex app**

Confirm each PR is merged, the expected ruleset is live, the required checks are enforced, and the resulting `main` commit contains the intended changes. Keep API/CLI output as supporting evidence, not as a substitute for the required app verification.

**Step 3: Add the OPS-186 completion record**

Record completion date, all merged PRs/repositories, policy and ownership changes, live ruleset IDs, validation commands/results, controlled test evidence, delivered capability, limitations, and follow-up work. Preserve the original implementation plan.

**Step 4: Update the MLS-003 delivery summary**

Mark OPS-186 complete, update milestone progress/status, add the protected-branch outcome and evidence links, and only mark MLS-003 complete if all milestone exit criteria—including live enforcement evidence—are satisfied.

**Step 5: Synchronize Linear records**

Update the connected issue/milestone and create or update the required dedicated Linear project document with capabilities, implementation details, affected repositories, validation evidence, limitations, and follow-up ownership. Link that document from the milestone and issue. If Linear is unavailable, state that explicitly in the closeout.

**Step 6: Merge the documentation closeout and reverify**

Put documentation changes on a closeout branch and PR. After it merges, verify the closeout commit on every affected `main`; report only then that OPS-186 is fully complete. Until that point, report `implementation merged; documentation closeout pending`.

## Final validation checklist

- `pnpm test:repository-rulesets`
- `pnpm test:codeowners`
- `pnpm test:required-checks`
- `pnpm test:ruleset-payload`
- Existing central `pnpm test`, `pnpm lint:check`, workflow lint, JSON validation, and `git diff --check`
- Live ruleset read-back for all eight repositories
- Positive and negative enforcement evidence for all eight repositories
- Exact merged PR links and resulting `main` commits
- OPS-186 task closeout merged into `main`
- MLS-003 progress/status and cumulative summary updated on `main`
- Linear issue, milestone, and dedicated project document synchronized or Linear unavailability documented
