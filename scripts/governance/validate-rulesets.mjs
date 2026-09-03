import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const supportedActorTypes = new Set(["User", "Team", "RepositoryRole", "OrganizationAdmin", "Integration"]);
const supportedBypassModes = new Set(["pull_request", "always"]);

function finding(rule, actual, expected, repository = "policy") {
  return {
    repository,
    rule,
    actual,
    expected,
    remediation: "Update the repository inventory or ruleset policy to satisfy OPS-186.",
  };
}

function actorFindings(actor, repository) {
  const findings = [];
  const identifier = actor?.identifier ?? "missing";
  if (identifier === "*" || identifier.includes("*")) {
    findings.push(finding("wildcard-bypass-actor", identifier, "named actor", repository));
  }
  if (!supportedActorTypes.has(actor?.type)) {
    findings.push(finding("unsupported-bypass-actor", actor?.type ?? "missing", [...supportedActorTypes], repository));
  }
  if (!supportedBypassModes.has(actor?.mode)) {
    findings.push(finding("unsupported-bypass-mode", actor?.mode ?? "missing", [...supportedBypassModes], repository));
  }
  if (actor?.mode === "always") {
    findings.push(finding("unrestricted-bypass", `${actor.type}:${identifier}`, "pull_request", repository));
  }
  return findings;
}

export function validateRepositoryInventory(inventory) {
  const findings = [];
  const repositories = Array.isArray(inventory?.repositories) ? inventory.repositories : [];
  const names = repositories.map((repository) => repository?.name).filter(Boolean);
  for (const name of new Set(names)) {
    if (names.filter((candidate) => candidate === name).length > 1) {
      findings.push(finding("duplicate-repository", name, "unique repository name", name));
    }
  }

  for (const repository of repositories) {
    const name = repository?.name ?? "missing";
    if (repository?.defaultBranch !== "main") {
      findings.push(finding("default-branch", repository?.defaultBranch ?? "missing", "main", name));
    }
    if (repository?.protectedBranch !== "main") {
      findings.push(finding("protected-branch", repository?.protectedBranch ?? "missing", "main", name));
    }
    if (repository?.codeowners !== ".github/CODEOWNERS") {
      findings.push(finding("codeowners-path", repository?.codeowners ?? "missing", ".github/CODEOWNERS", name));
    }
    if (!Array.isArray(repository?.requiredPaths) || repository.requiredPaths.length === 0) {
      findings.push(finding("missing-required-paths", "none", "at least one critical path", name));
    }
    if (!Array.isArray(repository?.workflows) || repository.workflows.length === 0) {
      findings.push(finding("missing-workflows", "none", "default-branch workflow paths", name));
    }
    if (!Array.isArray(repository?.requiredChecks) || repository.requiredChecks.length === 0) {
      findings.push(finding("missing-required-checks", "none", "at least one observed check", name));
    }
    const contexts = (repository?.requiredChecks ?? []).map((check) => check?.context).filter(Boolean);
    if (new Set(contexts).size !== contexts.length) {
      findings.push(finding("duplicate-required-check", contexts.join(", "), "unique check contexts", name));
    }
    for (const check of repository?.requiredChecks ?? []) {
      if (!check?.context || !check?.workflow || !check?.job) {
        findings.push(finding("incomplete-required-check", JSON.stringify(check), "context, workflow, and job", name));
      }
    }
    for (const actor of repository?.bypassActors ?? []) findings.push(...actorFindings(actor, name));
  }
  return findings;
}

export function validateRulesetPolicy(policy) {
  const findings = [];
  if (policy?.targetBranch !== "main") {
    findings.push(finding("target-branch", policy?.targetBranch ?? "missing", "main"));
  }
  if (policy?.enforcement !== "active") {
    findings.push(finding("inactive-enforcement", policy?.enforcement ?? "missing", "active"));
  }
  const pullRequest = policy?.pullRequest ?? {};
  if (pullRequest.required !== true || pullRequest.requiredApprovingReviewCount < 1) {
    findings.push(finding("pull-request-review", JSON.stringify(pullRequest), "required with at least one approval"));
  }
  if (pullRequest.dismissStaleReviews !== true) {
    findings.push(finding("stale-reviews-allowed", pullRequest.dismissStaleReviews ?? "missing", true));
  }
  if (pullRequest.requireCodeOwnerReview !== true) {
    findings.push(finding("code-owner-review-not-required", pullRequest.requireCodeOwnerReview ?? "missing", true));
  }
  if (pullRequest.requireConversationResolution !== true) {
    findings.push(
      finding("conversation-resolution-not-required", pullRequest.requireConversationResolution ?? "missing", true),
    );
  }
  if (policy?.statusChecks?.required !== true) {
    findings.push(finding("required-status-checks", policy?.statusChecks?.required ?? "missing", true));
  }
  if (policy?.statusChecks?.strict !== true) {
    findings.push(finding("strict-status-checks", policy?.statusChecks?.strict ?? "missing", true));
  }
  if (policy?.history?.denyForcePush !== true) {
    findings.push(finding("force-push-allowed", policy?.history?.denyForcePush ?? "missing", true));
  }
  if (policy?.history?.denyDeletion !== true) {
    findings.push(finding("branch-deletion-allowed", policy?.history?.denyDeletion ?? "missing", true));
  }
  if (policy?.history?.requireLinearHistory !== true) {
    findings.push(finding("linear-history-allowed", policy?.history?.requireLinearHistory ?? "missing", true));
  }
  for (const actor of policy?.bypassActors ?? []) findings.push(...actorFindings(actor, "policy"));
  return findings;
}

function indentation(line) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function scalar(value) {
  return value
    .split(/\s+#/)[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

export function inspectWorkflowText(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const events = [];
  const onIndex = lines.findIndex((line) => /^on:\s*/.test(line));
  if (onIndex >= 0) {
    const inline = scalar(lines[onIndex].slice(lines[onIndex].indexOf(":") + 1));
    if (inline) {
      const cleaned = inline.replace(/^\[|\]$/g, "");
      events.push(
        ...cleaned
          .split(",")
          .map((event) => scalar(event))
          .filter(Boolean),
      );
    } else {
      for (let index = onIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        if (indentation(line) === 0) break;
        if (indentation(line) === 2) {
          const match = line.match(/^\s{2}([A-Za-z][A-Za-z0-9_-]*):/);
          if (match) events.push(match[1]);
        }
      }
    }
  }

  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex < 0) return { events, jobs: [] };
  const starts = [];
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (indentation(line) === 0) break;
    const match = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
    if (indentation(line) === 2 && match) starts.push({ id: match[1], index });
  }
  const jobs = starts.map(({ id, index }, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    const block = lines.slice(index, end);
    const nameLine = block.find((line) => /^\s{4}name:\s*/.test(line));
    const usesLine = block.find((line) => /^\s{4}uses:\s*/.test(line));
    return {
      id,
      name: nameLine ? scalar(nameLine.slice(nameLine.indexOf(":") + 1)) : id,
      uses: usesLine ? scalar(usesLine.slice(usesLine.indexOf(":") + 1)) : null,
    };
  });
  return { events, jobs };
}

export function formatFindings(findings) {
  return findings
    .map(
      ({ repository, rule, actual, expected, remediation }) =>
        `${repository}: ${rule}; actual=${actual}; expected=${expected}; remediation: ${remediation}`,
    )
    .join("\n");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const [inventory, policy] = await Promise.all([
    readJson(new URL("../../governance/repositories.json", import.meta.url)),
    readJson(new URL("../../governance/repository-ruleset-policy.json", import.meta.url)),
  ]);
  const findings = [...validateRepositoryInventory(inventory), ...validateRulesetPolicy(policy)];
  if (findings.length) {
    console.error(formatFindings(findings));
    process.exitCode = 1;
    return;
  }
  console.log(`repository ruleset policy: ${inventory.repositories.length} repositories validated`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
