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

