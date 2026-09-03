import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderPayload, renderRuleset } from "../scripts/governance/render-rulesets.mjs";

const policy = {
  version: 1,
  targetBranch: "main",
  enforcement: "active",
  pullRequest: {
    required: true,
    dismissStaleReviews: true,
    requireCodeOwnerReview: true,
    requireLastPushApproval: false,
    requiredApprovingReviewCount: 1,
    requireConversationResolution: true,
  },
  statusChecks: { strict: true, required: true },
  history: { denyForcePush: true, denyDeletion: true, requireLinearHistory: true },
};

const repository = {
  fullName: "otedesco/example",
  protectedBranch: "main",
  requiredChecks: [{ context: "Security / aggregate" }, { context: "Quality / core" }],
  bypassActors: [],
};

test("renders a deterministic main ruleset payload", () => {
  const payload = renderRuleset(repository, policy);
  assert.deepEqual(payload.conditions, { ref_name: { include: ["refs/heads/main"], exclude: [] } });
  assert.deepEqual(payload.bypass_actors, []);
  assert.deepEqual(
    payload.rules.map(({ type }) => type),
    ["pull_request", "required_status_checks", "required_linear_history", "non_fast_forward", "deletion"],
  );
  assert.deepEqual(payload.rules[1].parameters.required_status_checks, [
    { context: "Quality / core" },
    { context: "Security / aggregate" },
  ]);
  assert.deepEqual(payload.rules[0].parameters.allowed_merge_methods, ["squash", "rebase"]);
});

test("renders all repositories in stable order", () => {
  const inventoryRepository = {
    ...repository,
    defaultBranch: "main",
    protectedBranch: "main",
    codeowners: ".github/CODEOWNERS",
    requiredPaths: [".github/**"],
    workflows: [".github/workflows/quality-checks.yml"],
    requiredChecks: repository.requiredChecks.map((check) => ({
      ...check,
      workflow: ".github/workflows/quality-checks.yml",
      job: check.context.startsWith("Quality") ? "quality" : "security",
      observed: true,
    })),
    bypassActors: [],
  };
  const inventory = {
    version: 1,
    repositories: [
      { ...inventoryRepository, name: "z" },
      { ...inventoryRepository, name: "a", fullName: "otedesco/aaa" },
    ],
  };
  const first = renderPayload(inventory, policy);
  const second = renderPayload(inventory, policy);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.repositories.map(({ repository: name }) => name),
    ["otedesco/aaa", "otedesco/example"],
  );
});

test("rejects bypass actors without server-side IDs", () => {
  assert.throws(
    () =>
      renderRuleset(
        { ...repository, bypassActors: [{ type: "User", identifier: "otedesco", mode: "pull_request" }] },
        policy,
      ),
    /numeric actorId/,
  );
});

test("keeps the checked-in payload synchronized with the renderer", async () => {
  const [inventory, policy, checkedIn] = await Promise.all([
    readFile(new URL("../governance/repositories.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../governance/repository-ruleset-policy.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../governance/rulesets/PRJ-001-main.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.deepEqual(checkedIn, renderPayload(inventory, policy));
});
