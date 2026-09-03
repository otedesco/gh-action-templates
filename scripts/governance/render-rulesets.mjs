import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formatFindings, validateRepositoryInventory, validateRulesetPolicy } from "./validate-rulesets.mjs";

function statusCheck(check) {
  const rendered = { context: check.context };
  if (Number.isInteger(check.integrationId)) rendered.integration_id = check.integrationId;
  return rendered;
}

function bypassActor(actor) {
  if (!Number.isInteger(actor.actorId)) {
    throw new Error(`bypass actor ${actor.type}:${actor.identifier} must include a numeric actorId before rendering`);
  }
  return {
    actor_id: actor.actorId,
    actor_type: actor.type,
    bypass_mode: actor.mode,
  };
}

export function renderRuleset(repository, policy) {
  const requiredChecks = [...repository.requiredChecks].sort((left, right) =>
    left.context.localeCompare(right.context),
  );
  const rules = [
    {
      type: "pull_request",
      parameters: {
        allowed_merge_methods: policy.history.requireLinearHistory
          ? ["squash", "rebase"]
          : ["merge", "squash", "rebase"],
        dismiss_stale_reviews_on_push: policy.pullRequest.dismissStaleReviews,
        require_code_owner_review: policy.pullRequest.requireCodeOwnerReview,
        require_last_push_approval: policy.pullRequest.requireLastPushApproval,
        required_approving_review_count: policy.pullRequest.requiredApprovingReviewCount,
        required_review_thread_resolution: policy.pullRequest.requireConversationResolution,
      },
    },
    {
      type: "required_status_checks",
      parameters: {
        do_not_enforce_on_create: false,
        required_status_checks: requiredChecks.map(statusCheck),
        strict_required_status_checks_policy: policy.statusChecks.strict,
      },
    },
  ];
  if (policy.history.requireLinearHistory) rules.push({ type: "required_linear_history" });
  if (policy.history.denyForcePush) rules.push({ type: "non_fast_forward" });
  if (policy.history.denyDeletion) rules.push({ type: "deletion" });

  return {
    name: "PRJ-001 main protection",
    target: "branch",
    enforcement: policy.enforcement,
    bypass_actors: (repository.bypassActors ?? []).map(bypassActor),
    conditions: { ref_name: { include: [`refs/heads/${repository.protectedBranch}`], exclude: [] } },
    rules,
  };
}

export function renderPayload(inventory, policy) {
  const findings = [
    ...validateRepositoryInventory(inventory, { enforceScope: true }),
    ...validateRulesetPolicy(policy),
  ];
  if (findings.length) throw new Error(formatFindings(findings));
  return {
    version: 1,
    source: {
      inventoryVersion: inventory.version,
      policyVersion: policy.version,
    },
    repositories: [...inventory.repositories]
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .map((repository) => ({ repository: repository.fullName, payload: renderRuleset(repository, policy) })),
  };
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

async function main() {
  const [inventory, policy] = await Promise.all([
    readJson(new URL("../../governance/repositories.json", import.meta.url)),
    readJson(new URL("../../governance/repository-ruleset-policy.json", import.meta.url)),
  ]);
  console.log(JSON.stringify(renderPayload(inventory, policy), null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
