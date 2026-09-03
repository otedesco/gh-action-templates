import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  renderEnforcementRuleset,
  renderPayload,
  renderReviewRuleset,
  renderRulesets,
} from "../scripts/governance/render-rulesets.mjs";

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
  statusChecks: { strict: true, required: true, requireObservedContextsBeforeApply: true },
  history: { denyForcePush: true, denyDeletion: true, requireLinearHistory: true },
};

const repository = {
  fullName: "otedesco/example",
  protectedBranch: "main",
  requiredChecks: [{ context: "Security / aggregate" }, { context: "Quality / core" }],
  bypassActors: [],
};

test("renders separate review-bypass and non-bypass enforcement rulesets", () => {
  const repositoryWithBypass = {
    ...repository,
    bypassActors: [{ type: "User", identifier: "otedesco", actorId: 137359101, mode: "pull_request" }],
  };
  const review = renderReviewRuleset(repositoryWithBypass, policy);
  const enforcement = renderEnforcementRuleset(repositoryWithBypass, policy);

  assert.deepEqual(review.conditions, { ref_name: { include: ["refs/heads/main"], exclude: [] } });
  assert.deepEqual(review.bypass_actors, [{ actor_id: 137359101, actor_type: "User", bypass_mode: "pull_request" }]);
  assert.deepEqual(
    review.rules.map(({ type }) => type),
    ["pull_request"],
  );
  assert.deepEqual(review.rules[0].parameters.allowed_merge_methods, ["squash", "rebase"]);

  assert.deepEqual(enforcement.bypass_actors, []);
  assert.deepEqual(
    enforcement.rules.map(({ type }) => type),
    ["required_status_checks", "required_linear_history", "non_fast_forward", "deletion"],
  );
  assert.deepEqual(enforcement.rules[0].parameters.required_status_checks, [
    { context: "Quality / core" },
    { context: "Security / aggregate" },
  ]);
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
  const expectedRepositories = [
    "otedesco/gh-action-templates",
    "otedesco/commons",
    "otedesco/cache",
    "otedesco/server-utils",
    "otedesco/notify",
    "otedesco/cerberus",
    "otedesco/hermes",
    "otedesco/web-app",
  ];
  const inventory = {
    version: 1,
    expectedRepositories,
    repositories: [...expectedRepositories].reverse().map((fullName) => ({
      ...inventoryRepository,
      name: fullName.split("/")[1],
      fullName,
    })),
  };
  const first = renderPayload(inventory, policy);
  const second = renderPayload(inventory, policy);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.repositories.map(({ repository: name }) => name),
    [...expectedRepositories].sort(),
  );
});

test("rejects bypass actors without server-side IDs", () => {
  assert.throws(
    () =>
      renderReviewRuleset(
        { ...repository, bypassActors: [{ type: "User", identifier: "otedesco", mode: "pull_request" }] },
        policy,
      ),
    /numeric actorId/,
  );
});

test("keeps bypass permission out of required checks and history", () => {
  const rulesets = renderRulesets(
    {
      ...repository,
      bypassActors: [{ type: "User", identifier: "otedesco", actorId: 137359101, mode: "pull_request" }],
    },
    policy,
  );
  const enforcement = rulesets.find(({ name }) => name === "PRJ-001 main protection");
  assert.deepEqual(enforcement.bypass_actors, []);
  assert.doesNotMatch(JSON.stringify(enforcement), /137359101|pull_request/);
});

test("keeps the checked-in payload synchronized with the renderer", async () => {
  const [inventory, policy, checkedIn] = await Promise.all([
    readFile(new URL("../governance/repositories.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../governance/repository-ruleset-policy.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../governance/rulesets/PRJ-001-main.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.deepEqual(checkedIn, renderPayload(inventory, policy));
});
