import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { inspectWorkflowText } from "./validate-rulesets.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

export { inspectWorkflowText };

export function findPullRequestBranches(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const pullRequestIndex = lines.findIndex((line) => /^\s{2}pull_request:\s*/.test(line));
  if (pullRequestIndex < 0) return null;

  for (let index = pullRequestIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const level = line.match(/^ */)?.[0].length ?? 0;
    if (level <= 2) break;
    const branches = line.match(/^\s{4}branches:\s*(.*)$/);
    if (!branches) continue;
    const inline = branches[1].trim();
    if (inline) {
      return inline
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((branch) => branch.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }
    const values = [];
    for (let valueIndex = index + 1; valueIndex < lines.length; valueIndex += 1) {
      const valueLine = lines[valueIndex];
      if (!valueLine.trim()) continue;
      const valueLevel = valueLine.match(/^ */)?.[0].length ?? 0;
      if (valueLevel <= 4) break;
      const value = valueLine.match(/^\s{6}-\s*(.*)$/);
      if (value) values.push(value[1].trim().replace(/^['"]|['"]$/g, ""));
    }
    return values;
  }
  return null;
}

function finding(repository, rule, actual, expected, workflow) {
  return {
    repository: repository.name,
    workflow,
    rule,
    actual,
    expected,
    remediation: "Run the check on pull_request, keep its context stable, and record an observed successful run.",
  };
}

export function findDuplicateJobKeys(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex < 0) return [];

  const duplicates = [];
  let currentJob = null;
  const keyCounts = new Map();
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const level = line.match(/^ */)?.[0].length ?? 0;
    if (level === 0) break;
    const jobMatch = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
    if (level === 2 && jobMatch) {
      currentJob = jobMatch[1];
      keyCounts.clear();
      continue;
    }
    const keyMatch = line.match(/^\s{4}([A-Za-z0-9_-]+):(?:\s|$)/);
    if (currentJob && level === 4 && keyMatch) {
      const key = keyMatch[1];
      const count = (keyCounts.get(key) ?? 0) + 1;
      keyCounts.set(key, count);
      if (count === 2) duplicates.push({ job: currentJob, key, line: index + 1 });
    }
  }
  return duplicates;
}

export function auditRequiredChecks(repository, workflowTexts, { requireObserved = false } = {}) {
  const findings = [];
  for (const [workflowPath, workflowText] of Object.entries(workflowTexts)) {
    for (const duplicate of findDuplicateJobKeys(workflowText)) {
      findings.push(
        finding(
          repository,
          "duplicate-job-key",
          `${duplicate.job}.${duplicate.key} at line ${duplicate.line}`,
          "each job key defined once",
          workflowPath,
        ),
      );
    }
  }
  for (const check of repository.requiredChecks ?? []) {
    const workflowText = workflowTexts[check.workflow];
    if (!workflowText) {
      findings.push(finding(repository, "missing-check-workflow", "missing", check.workflow, check.workflow));
      continue;
    }
    const workflow = inspectWorkflowText(workflowText);
    if (!workflow.events.includes("pull_request")) {
      findings.push(
        finding(
          repository,
          "check-not-pull-request",
          workflow.events.join(",") || "none",
          "pull_request",
          check.workflow,
        ),
      );
    }
    const branches = findPullRequestBranches(workflowText);
    if (branches && !branches.includes(repository.protectedBranch)) {
      findings.push(
        finding(
          repository,
          "check-not-protected-branch",
          branches.join(",") || "none",
          repository.protectedBranch,
          check.workflow,
        ),
      );
    }
    const job = workflow.jobs.find((candidate) => candidate.id === check.job);
    if (!job) {
      findings.push(finding(repository, "missing-check-job", check.job, "job emitted by workflow", check.workflow));
      continue;
    }
    if (job.name !== check.context) {
      findings.push(finding(repository, "check-context-mismatch", job.name, check.context, check.workflow));
    }
    if (requireObserved && check.observed !== true) {
      findings.push(
        finding(
          repository,
          "unobserved-required-check",
          "not observed",
          "successful and failing pull-request runs",
          check.workflow,
        ),
      );
    }
  }
  return findings;
}

function formatFindings(findings) {
  return findings
    .map(
      ({ repository, workflow, rule, actual, expected, remediation }) =>
        `${repository} ${workflow}: ${rule}; actual=${actual}; expected=${expected}; remediation: ${remediation}`,
    )
    .join("\n");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const requireObserved = process.argv.includes("--require-observed");
  const workspaceMode = process.argv.includes("--workspace");
  const inventory = await readJson(new URL("../../governance/repositories.json", import.meta.url));
  const findings = [];
  for (const repository of inventory.repositories) {
    if (!workspaceMode && repository.name !== "gh-action-templates") continue;
    const workflowTexts = {};
    for (const workflow of repository.workflows) {
      try {
        workflowTexts[workflow] = await readFile(resolve(root, repository.localPath, workflow), "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    findings.push(...auditRequiredChecks(repository, workflowTexts, { requireObserved }));
  }
  if (findings.length) {
    console.error(formatFindings(findings));
    process.exitCode = 1;
    return;
  }
  const audited = workspaceMode ? inventory.repositories.length : 1;
  console.log(`required checks: ${audited} repositories audited`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
