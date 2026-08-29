# OPS-188 Stable Gate Run Campaign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove 100 consecutive required-gate runs complete without active quarantine, hidden retry, nondeterministic failure, leaked resource, or false-positive green.

**Architecture:** A tested campaign ledger ingests signed or checksummed run evidence for the fully adopted repositories and evaluates strict qualification rules. Scheduled runs create enough observations without weakening gates; any disqualifying result ends the sequence, records a reset reason, and requires remediation before a new sequence starts.

**Tech Stack:** GitHub Actions, GitHub API/CLI, Node.js, JSON Schema, Node test runner, immutable workflow artifacts.

---

## Dependencies and scope

- Starts formally only after all `OPS-189` adoption PRs merge and `OPS-186` rulesets require the adopted checks.
- Uses dashboard/governance rules from `OPS-187`.
- A run is a complete campaign observation, not an individual matrix job; the ledger must define this granularity explicitly.

### Task 1: Define campaign qualification and ledger schema

**Files:**

- Create: `stability/campaign-policy.json`
- Create: `stability/run.schema.json`
- Create: `stability/campaign-ledger.json`
- Create: `scripts/stability/evaluate-campaign.mjs`
- Create: `test/stability-campaign.test.mjs`
- Modify: `package.json`

**Step 1: Write failing qualification tests**

Cover qualifying success and disqualification by failure, missing job, cancellation, skip, retry, quarantine, stale workflow SHA, malformed artifact, leaked-resource marker, nondeterministic classification, and incorrect green evidence.

**Step 2:** Run `pnpm test:stability`; expect failure.

**Step 3:** Implement pure evaluation with explicit injected time and required workflow version. Never infer success from an absent field.

**Step 4:** Require an ordered sequence, unique run IDs, repository revisions, workflow SHAs, artifact checksums, timestamps, and evidence URLs.

**Step 5: Verify and commit**

```bash
pnpm test:stability
git add stability scripts/stability test/stability-campaign.test.mjs package.json
git commit -m "test: define stable gate campaign rules"
```

### Task 2: Add deterministic scheduled qualification runs

**Files:**

- Create: `.github/workflows/stability-campaign.yml`
- Create: `scripts/stability/collect-run.mjs`
- Create: `test/stability-workflow.test.mjs`
- Modify: `supply-chain/action-references.json`

**Step 1:** Write workflow contract tests requiring pinned references, no retries, no `continue-on-error`, concurrency control, complete gate fan-out, immutable workflow SHA, and artifact retention.

**Step 2:** Run tests; expect failure.

**Step 3:** Implement scheduled/manual execution against protected revisions for all adopted repositories. Reuse the same required workflows and inputs as pull requests.

**Step 4:** Collect results only after every required check terminates. Mark missing/canceled/skipped jobs explicitly and reject mismatched workflow versions.

**Step 5:** Run actionlint and stability tests; commit with `ci: add stability campaign runs`.

### Task 3: Implement reset and remediation workflow

**Files:**

- Create: `stability/resets.json`
- Create: `scripts/stability/record-reset.mjs`
- Create: `test/stability-reset.test.mjs`
- Create: `docs/runbooks/stability-campaign.md`

**Step 1:** Write tests requiring reset reason, failed run, classification, owner, remediation issue, and verified fix run.

**Step 2:** Reject a resumed campaign when remediation is absent, the workflow changed without review, or an active quarantine remains.

**Step 3:** Implement reset recording as append-only normalized data. Never rewrite historical qualifying or failing runs.

**Step 4:** Document investigation for application defect, gate defect, infrastructure failure, flake, leaked resource, and false-positive green.

**Step 5:** Run tests and commit with `feat: govern stability campaign resets`.

### Task 4: Execute and close the campaign

**Files:**

- Modify: `stability/campaign-ledger.json`
- Modify: `stability/resets.json`
- Create: `docs/evidence/OPS-188-stability-campaign.md`
- Modify: `docs/quality-dashboard/README.md`

**Step 1:** Record the approved starting workflow SHA and adopted repository revisions.

**Step 2:** Execute scheduled observations until 100 consecutive runs qualify. Do not batch-insert or fabricate ledger entries.

**Step 3:** On any disqualifying result, record it, remediate, verify the fix, and start a new sequence at zero.

**Step 4:** Verify all artifact URLs/checksums, no active quarantine, no unresolved flake, and exactly 100 qualifying consecutive entries.

**Step 5:** Publish the final ledger checksum and summary; run `pnpm test:stability`; commit evidence.

## Completion checklist

- The campaign begins after full adoption and enforcement.
- Exactly 100 consecutive observations satisfy the policy.
- No retry, skip, cancellation, missing check, or quarantine counts.
- Reset history and remediation remain append-only and auditable.
- Workflow and repository revisions are identifiable.
- Evidence is linked to `OPS-188`.

