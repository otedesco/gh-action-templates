# OPS-187 Quality Dashboard, Flake, and Exception Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish trustworthy quality trends while automatically tracking flakes and rejecting invalid or expired exceptions.

**Architecture:** Normalize workflow, coverage, security, and release evidence into a versioned snapshot schema, then render a static dashboard from immutable artifacts. A separate validator owns exception and flake state; aggregation treats absent, stale, malformed, or unavailable evidence as explicit non-green states.

**Tech Stack:** Node.js, JSON Schema, GitHub Actions artifacts/pages or repository-hosted static output, Node test runner, Markdown/HTML generation.

---

## Dependencies and scope

- Requires evidence schemas from `OPS-180`, `OPS-181`, `OPS-184`, and `OPS-185`.
- Requires live required-check policy from `OPS-186`.
- The dashboard reports evidence; it cannot override source gate results or turn missing data green.

### Task 1: Define the snapshot and status model

**Files:**

- Create: `reporting/quality-snapshot.schema.json`
- Create: `reporting/status-policy.json`
- Create: `scripts/reporting/normalize-snapshot.mjs`
- Create: `test/quality-snapshot.test.mjs`
- Modify: `package.json`

**Step 1: Write failing status tests**

Cover passing, failing, missing, unavailable, stale, malformed, canceled, excepted, and unknown evidence. Require repository, commit, workflow SHA, check, timestamp, source URL, and artifact checksum.

**Step 2:** Run `pnpm test:reporting`; expect failure.

**Step 3:** Implement normalization and status precedence. A newer failure must outrank an older success; missing or malformed data is non-green.

**Step 4: Verify and commit**

```bash
pnpm test:reporting
git add reporting scripts/reporting test/quality-snapshot.test.mjs package.json
git commit -m "test: define trustworthy quality reporting"
```

### Task 2: Automate exception and flake validation

**Files:**

- Create: `reporting/flake.schema.json`
- Create: `reporting/flakes.json`
- Create: `scripts/reporting/validate-governance.mjs`
- Create: `test/reporting-governance.test.mjs`
- Modify: `security/exceptions.json`

**Step 1:** Write tests for valid, missing-owner, missing-remediation, broad-scope, expired, duplicate, and closed-remediation records.

**Step 2:** Require flakes to record first/latest occurrence, owner, impact, evidence, reproduction status, and remediation issue. A quarantine must reference a valid exception.

**Step 3:** Implement validation using an injected clock so expiry tests are deterministic.

**Step 4:** Run `pnpm test:reporting`; expect PASS with 100% changed-code coverage.

**Step 5:** Commit with `feat: automate flake and exception governance`.

### Task 3: Generate the dashboard from fixtures

**Files:**

- Create: `scripts/reporting/render-dashboard.mjs`
- Create: `test/dashboard-render.test.mjs`
- Create: `test/fixtures/reporting/{passing,failing,missing,stale,malformed,excepted}/**`
- Create: `docs/quality-dashboard/README.md`

**Step 1:** Write snapshot tests asserting exact status, ordering, links, and accessible text for every fixture.

**Step 2:** Run tests; expect failure because rendering is absent.

**Step 3:** Render deterministic Markdown and optional static HTML without client-side secrets. Include per-repository status, four coverage metrics, security/release state, active exceptions, flakes, and last update.

**Step 4:** Generate twice and compare checksums; expect byte-identical output.

**Step 5:** Commit generated template and tests with `feat: render the quality dashboard`.

### Task 4: Publish and enforce freshness

**Files:**

- Create: `.github/workflows/quality-dashboard.yml`
- Modify: `supply-chain/action-references.json`
- Modify: `supply-chain/workflow-permissions.json`
- Create: `docs/evidence/OPS-187-dashboard.md`

**Step 1:** Add workflow tests for pinned actions, read-only evidence collection, explicit publication permissions, concurrency, and maximum evidence age.

**Step 2:** Implement scheduled and post-default-branch aggregation. Reject missing repositories and stale artifacts before publishing.

**Step 3:** Run negative fixtures in CI and prove none render green.

**Step 4:** Run actionlint and all reporting tests; expect PASS.

**Step 5:** Record run URLs, schema versions, freshness threshold, and output checksum; commit evidence.

## Completion checklist

- Missing, stale, malformed, failed, or unavailable evidence is non-green.
- Coverage trends include all four metrics.
- Exceptions and flakes are owned, validated, and expiring.
- Hidden retries cannot erase failure history.
- Dashboard generation is deterministic and least-privilege.
- Evidence is linked to `OPS-187`.

