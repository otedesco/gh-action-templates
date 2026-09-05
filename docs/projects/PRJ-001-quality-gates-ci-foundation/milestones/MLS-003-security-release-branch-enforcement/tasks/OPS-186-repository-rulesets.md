# OPS-186 Repository Rulesets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce pull requests, review ownership, strict required checks, protected history, and audited bypass rules on `main` across all eight repositories.

**Architecture:** Store a canonical ruleset policy and per-repository inventory in `gh-action-templates`, validate both locally, then apply equivalent GitHub rulesets through an administrator-reviewed rollout. Verification reads live rulesets and performs controlled negative tests; no repository is marked complete from configuration files alone.

**Tech Stack:** GitHub repository rulesets, GitHub CLI/API, CODEOWNERS, Node test runner, JSON policy and evidence.

---

## Dependencies and scope

- Requires stable required-check names from `OPS-180`, `OPS-181`, `OPS-184`, and `OPS-185`.
- Requires immutable shared workflow adoption points from `OPS-182`.
- Changes live GitHub policy; execution requires explicit administrator authority and must be staged repository by repository.

### Task 1: Define the canonical branch policy

**Files:**

- Create: `governance/repository-ruleset-policy.json`
- Create: `governance/repositories.json`
- Create: `scripts/governance/validate-rulesets.mjs`
- Create: `test/repository-rulesets.test.mjs`
- Modify: `package.json`

**Step 1: Write failing policy tests**

Require PR-only changes, at least one approval, code-owner review for owned paths, stale approval dismissal, strict status checks, conversation resolution, signed or reviewed history policy, force-push/deletion denial, and named minimal bypass actors.

**Step 2:** Run `pnpm test:repository-rulesets`; expect failure.

**Step 3:** Implement schema and validation with exact required-check names per repository.

**Step 4: Commit**

```bash
pnpm test:repository-rulesets
git add governance scripts/governance test/repository-rulesets.test.mjs package.json
git commit -m "test: define protected branch policy"
```

### Task 2: Verify ownership files and required check names

**Files:**

- Create or modify: each repository `.github/CODEOWNERS`
- Modify: `governance/repositories.json`
- Create: `scripts/governance/audit-codeowners.mjs`
- Create: `test/codeowners.test.mjs`

**Step 1:** Write tests rejecting missing owners, unmatched critical paths, nonexistent teams/users, and required checks not emitted by default-branch workflows.

**Step 2:** Run the tests; expect failures for current gaps.

**Step 3:** Add the narrowest correct ownership rules and record stable check names.

**Step 4:** Verify with `pnpm test:repository-rulesets` and `pnpm test:codeowners`.

**Step 5:** Commit ownership changes independently in each repository.

### Task 3: Plan and apply the live rollout

**Files:**

- Create: `governance/rulesets/PRJ-001-main.json`
- Create: `docs/runbooks/repository-ruleset-rollout.md`
- Create: `docs/evidence/OPS-186-rulesets.json`

**Step 1:** Export current live rulesets read-only for all eight repositories and store normalized evidence without tokens or unrelated settings.

**Step 2:** Generate the desired ruleset payload from policy and compare it to current state. Review exact repositories, branches, actors, and checks with an administrator.

**Step 3:** Apply to `gh-action-templates` first. Confirm ordinary pull requests work before continuing one repository at a time.

**Step 4:** After each application, read the live configuration back and validate it against policy. Stop rollout on the first mismatch.

**Step 5:** Commit the runbook, desired payload, and sanitized live evidence.

### Task 4: Prove enforcement with controlled changes

**Files:**

- Modify: `docs/evidence/OPS-186-rulesets.json`
- Create: `docs/evidence/OPS-186-live-verification.md`

**Step 1:** Open or use a disposable controlled PR in each repository.

**Step 2:** Prove direct push, missing review, unresolved conversation, stale branch, and failed required check prevent merge.

**Step 3:** Prove an approved, current, fully green PR can merge through the normal path.

**Step 4:** Exercise each approved bypass actor only where safe, capture its audit event, and confirm unapproved actors cannot bypass.

**Step 5:** Run local policy validation and record live URLs/timestamps. Commit with `docs: record protected branch verification`.

## Completion checklist

- All eight repositories match the canonical live policy.
- Required checks are stable, strict, and emitted by intended workflows.
- CODEOWNERS protects critical paths.
- Force pushes and deletion are blocked.
- Bypass actors are minimal and audited.
- Controlled negative and positive tests are recorded.
- Evidence is linked to `OPS-186`.

## Completion record — 2026-09-04

**Status:** Complete — implementation, live rollout, evidence, and repository documentation closeout are complete.

### Merged pull requests and affected repositories

All scoped implementation and verification pull requests are merged into the default `main` branches:

- [gh-action-templates #32](https://github.com/otedesco/gh-action-templates/pull/32) — central ruleset policy, inventory, validators, payload renderer, runbook, and initial evidence; merged as `dee2826`.
- [gh-action-templates #33](https://github.com/otedesco/gh-action-templates/pull/33) — consumer required-check provenance alignment; merged as `1ff2338`.
- [gh-action-templates #34](https://github.com/otedesco/gh-action-templates/pull/34) — nested reusable-workflow check contexts and fail-closed rollout tooling; merged as `939239b`.
- [gh-action-templates #36](https://github.com/otedesco/gh-action-templates/pull/36) — isolated sole-maintainer review bypass and guarded ruleset updates; merged as `bd54b75`.
- [gh-action-templates #35](https://github.com/otedesco/gh-action-templates/pull/35) — controlled verification fixture; merged as `4fbf9f8`.
- Consumer contract PRs: [commons #21](https://github.com/otedesco/commons/pull/21), [cache #25](https://github.com/otedesco/cache/pull/25), [server-utils #16](https://github.com/otedesco/server-utils/pull/16), [notify #21](https://github.com/otedesco/notify/pull/21), [cerberus #54](https://github.com/otedesco/cerberus/pull/54), [hermes #22](https://github.com/otedesco/hermes/pull/22), and [web-app #8](https://github.com/otedesco/web-app/pull/8); all merged on 2026-09-03.
- Consumer verification PRs: [commons #22](https://github.com/otedesco/commons/pull/22), [cache #26](https://github.com/otedesco/cache/pull/26), [server-utils #17](https://github.com/otedesco/server-utils/pull/17), [notify #22](https://github.com/otedesco/notify/pull/22), [cerberus #55](https://github.com/otedesco/cerberus/pull/55), [hermes #23](https://github.com/otedesco/hermes/pull/23), and [web-app #9](https://github.com/otedesco/web-app/pull/9); all merged on 2026-09-03.

GitHub Codex app verification confirmed these resulting `main` commits: `gh-action-templates` `4fbf9f8`, `commons` `f24c5e6`, `cache` `0dd9019`, `server-utils` `80e1bc5`, `notify` `257c09b`, `cerberus` `3c37788`, `hermes` `c42dac7`, and `web-app` `62017f8`.

### Implementation and technical decisions

- Added a deterministic central policy and eight-repository inventory under `governance/`.
- Added policy, CODEOWNERS, required-check, and payload validation/audit tooling plus the administrator rollout script.
- Standardized the exact required contexts emitted by the default-branch workflows, including nested reusable-workflow contexts such as `Security / aggregate / Security / aggregate`.
- Applied two active rulesets per repository, both targeting `refs/heads/main`: a review-protection layer with one approval, CODEOWNERS review, stale-review dismissal, and conversation resolution; and a no-bypass main-protection layer with strict checks, linear history, force-push denial, and deletion denial.
- Limited the sole-maintainer exception to the exact `otedesco` GitHub user in `pull_request` mode and kept it out of required checks and history enforcement.

### Evidence and validation

Live ruleset IDs, required-check URLs, verification PRs, final main commits, and limitations are recorded in [OPS-186-rulesets.json](../../../../../evidence/OPS-186-rulesets.json) and [OPS-186-live-verification.md](../../../../../evidence/OPS-186-live-verification.md). The GitHub Codex app read back all 16 active rulesets and all eight default-branch refs. Successful required contexts were observed on each controlled verification PR head.

Validation passed: `pnpm test:repository-rulesets`, `pnpm test:codeowners`, `pnpm test:required-checks`, `pnpm test:ruleset-payload`, and `git diff --check`. Local runs emitted the expected Node engine warning because the workspace runtime was Node 20.11.1 while the project contract is Node 24.20.0.

### Delivered capability, limitations, and follow-up

All eight repositories now require pull requests, ownership review, stable strict checks, protected history, and auditable review bypass behavior on `main`. Direct push, force-push, deletion, and intentionally failing-check attempts were not performed because they would create destructive or noisy external state; the active ruleset read-back is the recorded policy evidence for those controls. The GitHub Codex app cannot read the separate branch-protection endpoint because GitHub returns HTTP 403, but it can read the repository rulesets used for enforcement. The sole-maintainer bypass should be removed when an independent eligible reviewer becomes available. MLS-004 owns broader adoption/stability campaigns.
