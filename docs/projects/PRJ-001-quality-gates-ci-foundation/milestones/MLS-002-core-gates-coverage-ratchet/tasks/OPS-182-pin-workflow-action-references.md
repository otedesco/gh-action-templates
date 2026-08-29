# OPS-182 Immutable Workflow and Action References Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace every mutable reusable-workflow and third-party action reference in required and release paths with a reviewed immutable commit SHA.

**Architecture:** Maintain an allow-listed reference manifest in `gh-action-templates` and test all eight repositories against it. Publish versioned shared-workflow releases, pin consumers to the release commit, and let Dependabot propose reviewed upgrades.

**Tech Stack:** GitHub Actions, git/GitHub CLI, Node test runner, Dependabot.

---

### Task 1: Build the reference audit

**Files:**

- Create: `supply-chain/action-references.json`
- Create: `scripts/audit-action-references.mjs`
- Create: `test/action-references.test.mjs`
- Modify: `package.json`

**Step 1: Write failing tests**

Scan `.github/**/*.yml` in all eight repositories. Reject `@main`, semantic tags, branches, short SHAs, unapproved local traversal, and a manifest SHA without a human-readable upstream version.

**Step 2: Run `pnpm test:action-references`**

Expected: FAIL on current `@main` calls and moving action tags.

**Step 3: Implement the audit**

Parse every `uses:` value and require either a repository-local action or a 40-character SHA present in `action-references.json`.

**Step 4: Commit the red audit**

```bash
git add supply-chain/action-references.json scripts/audit-action-references.mjs test/action-references.test.mjs package.json
git commit -m "test: audit immutable action references"
```

### Task 2: Resolve and pin third-party actions

**Files:**

- Modify: `.github/actions/**/*.yml`
- Modify: `.github/workflows/*.yml`
- Modify: `supply-chain/action-references.json`

**Step 1: Resolve each existing tag**

For every action, run `gh api repos/OWNER/REPO/git/ref/tags/TAG` and resolve annotated tags to the final commit. Review upstream release notes and provenance before recording the SHA.

**Step 2: Replace references**

Use `owner/repo@<40-char-sha> # <tag>` and record owner, repository, tag, SHA, review date, and purpose in the manifest.

**Step 3: Validate and commit**

Run `pnpm test:action-references` and actionlint. Expected: only consumer `gh-action-templates@main` references remain failing.

```bash
git add .github supply-chain/action-references.json
git commit -m "ci: pin third-party actions by commit"
```

### Task 3: Release and pin shared workflows in consumers

**Files:**

- Modify: all `../{cerberus,hermes,notify,server-utils,commons,cache}/.github/workflows/*.yml`
- Create or modify: `../web-app/.github/workflows/quality-checks.yml`
- Modify: `supply-chain/action-references.json`

**Step 1: Tag an approved shared release**

After central checks pass, create an annotated release tag and record its exact commit SHA. Do not point consumers at a tag alone.

**Step 2: Pin each consumer**

Replace every `otedesco/gh-action-templates/...@main` with the recorded 40-character release SHA and a release comment.

**Step 3: Audit all repositories**

Run `pnpm test:action-references`; expect PASS across all eight repositories.

**Step 4: Commit per consumer**

```bash
git add .github/workflows
git commit -m "ci: pin shared workflows by commit"
```

### Task 4: Configure reviewed updates

**Files:**

- Create: `.github/dependabot.yml`
- Modify: `docs/quality-gates/gate-specification.md`

**Step 1: Add weekly GitHub Actions updates**

Configure Dependabot for `/` with `package-ecosystem: github-actions`, a weekly schedule, labels, and no automatic merge.

**Step 2: Document review requirements**

Require release-note review, changed-permission review, fixture suite, action audit, and actionlint before merging a pin update.

**Step 3: Validate and commit**

```bash
pnpm test:action-references
git add .github/dependabot.yml docs/quality-gates/gate-specification.md
git commit -m "chore: automate reviewed action pin updates"
```

