import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const secretReference = /\$\{\{\s*secrets\.([A-Z][A-Z0-9_]*)\s*\}\}/g;
const permissionValue = /^(none|read|write)$/;

function indentation(line) {
  return line.match(/^ */)[0].length;
}

function scalar(value) {
  return value
    .split(/\s+#/)[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function parseList(value) {
  const cleaned = scalar(value).replace(/^\[|\]$/g, "");
  return cleaned
    .split(",")
    .map((item) => scalar(item))
    .filter(Boolean);
}

function parseMapping(lines, index, indent) {
  const value = scalar(lines[index].slice(lines[index].indexOf(":") + 1));
  if (value === "write-all" || value === "read-all") return { __all__: value };
  if (value === "{}") return {};

  const mapping = {};
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;
    const lineIndent = indentation(line);
    if (lineIndent <= indent) break;
    if (lineIndent !== indent + 2) continue;
    const match = line.match(/^\s{2,}([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (!match) continue;
    mapping[match[1]] = scalar(match[2]);
  }
  return mapping;
}

function propertyIndex(lines, property, indent = 0, start = 0) {
  const expression = new RegExp(`^\\s{${indent}}${property}:`);
  return lines.findIndex((line, index) => index >= start && expression.test(line));
}

function parseEvents(lines) {
  const index = propertyIndex(lines, "on");
  if (index < 0) return [];
  const inline = scalar(lines[index].slice(lines[index].indexOf(":") + 1));
  if (inline) return parseList(inline);

  const events = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;
    const lineIndent = indentation(line);
    if (lineIndent === 0) break;
    if (lineIndent === 2) {
      const match = line.match(/^\s{2}([A-Za-z][A-Za-z0-9_-]*):/);
      if (match) events.push(match[1]);
    }
  }
  return events;
}

function parseDeclaredSecrets(lines) {
  const workflowCallIndex = lines.findIndex((line) => /^\s{2}workflow_call:\s*$/.test(line));
  if (workflowCallIndex < 0) return [];
  const secretsIndex = lines.findIndex((line, index) => index > workflowCallIndex && /^\s{4}secrets:/.test(line));
  if (secretsIndex < 0) return [];
  const secrets = [];
  for (let cursor = secretsIndex + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;
    const lineIndent = indentation(line);
    if (lineIndent <= 4) break;
    if (lineIndent === 6) {
      const match = line.match(/^\s{6}([A-Za-z][A-Za-z0-9_]*):/);
      if (match) secrets.push(match[1]);
    }
  }
  return secrets;
}

function jobBlocks(lines) {
  const jobsIndex = propertyIndex(lines, "jobs");
  if (jobsIndex < 0) return new Map();
  const starts = [];
  for (let cursor = jobsIndex + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;
    const lineIndent = indentation(line);
    if (lineIndent === 0) break;
    const match = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
    if (lineIndent === 2 && match) starts.push({ name: match[1], index: cursor });
  }

  return new Map(
    starts.map((start, position) => {
      const next = starts[position + 1]?.index ?? lines.length;
      return [start.name, { name: start.name, lines: lines.slice(start.index, next) }];
    }),
  );
}

function findJobProperty(lines, property) {
  return lines.findIndex((line) => new RegExp(`^\\s{4}${property}:`).test(line));
}

function jobDetails(block) {
  const lines = block.lines;
  const permissionIndex = findJobProperty(lines, "permissions");
  const secretsIndex = findJobProperty(lines, "secrets");
  const envIndex = findJobProperty(lines, "env");
  const usesLine = lines.find((line) => /^\s{4}uses:\s*/.test(line));
  const secretsValue = secretsIndex >= 0 ? scalar(lines[secretsIndex].slice(lines[secretsIndex].indexOf(":") + 1)) : "";
  const mappedSecrets = [];
  if (secretsIndex >= 0 && secretsValue !== "inherit") {
    for (let cursor = secretsIndex + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line.trim()) continue;
      const lineIndent = indentation(line);
      if (lineIndent <= 4) break;
      if (lineIndent === 6) {
        const match = line.match(/^\s{6}([A-Za-z][A-Za-z0-9_]*):/);
        if (match) mappedSecrets.push(match[1]);
      }
    }
  }

  const secretNames = [];
  for (const line of lines) {
    for (const match of line.matchAll(secretReference)) {
      if (!secretNames.includes(match[1])) secretNames.push(match[1]);
    }
  }

  const jobEnvSecrets = [];
  if (envIndex >= 0) {
    for (let cursor = envIndex + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line.trim()) continue;
      const lineIndent = indentation(line);
      if (lineIndent <= 4) break;
      for (const match of line.matchAll(secretReference)) {
        if (!jobEnvSecrets.includes(match[1])) jobEnvSecrets.push(match[1]);
      }
    }
  }

  return {
    permissions: permissionIndex >= 0 ? parseMapping(lines, permissionIndex, 4) : null,
    secrets: secretsValue,
    mappedSecrets,
    secretNames: [...new Set([...mappedSecrets, ...secretNames])],
    jobEnvSecrets,
    uses: usesLine ? scalar(usesLine.slice(usesLine.indexOf(":") + 1)) : null,
  };
}

function finding(policy, rule, details = {}) {
  return {
    repository: policy.repository,
    workflow: policy.workflow,
    event: details.event ?? policy.events?.join(",") ?? "unknown",
    job: details.job ?? "workflow",
    actual: details.actual ?? "missing",
    expected: details.expected ?? "policy-compliant value",
    rule,
    remediation: policy.remediation ?? "Update the workflow to match the OPS-183 policy.",
  };
}

function comparePermissions(actual, expected, policy, job) {
  const findings = [];
  const expectedEntries = Object.entries(expected ?? {});
  const actualEntries = Object.entries(actual ?? {});

  for (const [scope, value] of actualEntries) {
    if (!(scope in (expected ?? {})) || expected[scope] !== value) {
      findings.push(
        finding(policy, job ? "unexpected-job-permission" : "unexpected-workflow-permission", {
          job,
          actual: `${scope}: ${value}`,
          expected: expectedEntries.length ? JSON.stringify(expected) : "none",
        }),
      );
    }
  }
  for (const [scope, value] of expectedEntries) {
    if (!(scope in (actual ?? {}))) {
      findings.push(
        finding(policy, job ? "missing-job-permission" : "missing-workflow-permission", {
          job,
          actual: "missing",
          expected: `${scope}: ${value}`,
        }),
      );
    }
  }
  return findings;
}

export function auditWorkflowText(workflowText, policy) {
  const lines = workflowText.split(/\r?\n/);
  const findings = [];
  const events = parseEvents(lines);
  for (const expectedEvent of policy.events ?? []) {
    if (!events.includes(expectedEvent)) {
      findings.push(finding(policy, "missing-event", { actual: events.join(",") || "none", expected: expectedEvent }));
    }
  }
  for (const actualEvent of events) {
    if (!(policy.events ?? []).includes(actualEvent)) {
      findings.push(finding(policy, "unexpected-event", { actual: actualEvent, expected: policy.events.join(",") }));
    }
  }

  const workflowPermissionIndex = propertyIndex(lines, "permissions");
  if (workflowPermissionIndex < 0) {
    findings.push(finding(policy, "missing-workflow-permissions"));
  }
  const workflowPermissions = workflowPermissionIndex >= 0 ? parseMapping(lines, workflowPermissionIndex, 0) : null;
  if (workflowPermissions?.__all__) {
    findings.push(finding(policy, "write-all", { actual: workflowPermissions.__all__, expected: "explicit scopes" }));
  }
  findings.push(...comparePermissions(workflowPermissions, policy.workflowPermissions, policy));

  const declaredSecrets = parseDeclaredSecrets(lines);
  const expectedDeclaredSecrets = policy.declaredSecrets ?? [];
  for (const secret of declaredSecrets) {
    if (!expectedDeclaredSecrets.includes(secret)) {
      findings.push(
        finding(policy, "undeclared-workflow-secret", {
          actual: secret,
          expected: expectedDeclaredSecrets.join(",") || "none",
        }),
      );
    }
  }
  for (const secret of expectedDeclaredSecrets) {
    if (!declaredSecrets.includes(secret)) {
      findings.push(finding(policy, "missing-workflow-secret", { actual: "missing", expected: secret }));
    }
  }

  const actualJobs = jobBlocks(lines);
  const expectedJobs = policy.jobs ?? {};
  for (const job of actualJobs.keys()) {
    if (!(job in expectedJobs)) {
      findings.push(
        finding(policy, "unexpected-job", { job, actual: job, expected: Object.keys(expectedJobs).join(",") }),
      );
    }
  }
  for (const job of Object.keys(expectedJobs)) {
    if (!actualJobs.has(job)) {
      findings.push(finding(policy, "missing-job", { job, actual: "missing", expected: job }));
      continue;
    }

    const details = jobDetails(actualJobs.get(job));
    const expectedJob = expectedJobs[job];
    if (details.secrets === "inherit") {
      findings.push(
        finding(policy, "secrets-inherit", { job, actual: "inherit", expected: "explicit named mappings" }),
      );
    }
    if (details.permissions?.__all__) {
      findings.push(
        finding(policy, "write-all", { job, actual: details.permissions.__all__, expected: "explicit scopes" }),
      );
    }
    findings.push(...comparePermissions(details.permissions, expectedJob.permissions, policy, job));

    const allowedSecrets = expectedJob.allowedSecrets ?? [];
    const forbiddenSecrets = new Set(expectedJob.forbiddenSecrets ?? []);
    for (const secret of details.secretNames) {
      if (forbiddenSecrets.has(secret)) {
        findings.push(
          finding(policy, "forbidden-secret", { job, actual: secret, expected: allowedSecrets.join(",") || "none" }),
        );
      } else if (!allowedSecrets.includes(secret)) {
        findings.push(
          finding(policy, "unexpected-secret", { job, actual: secret, expected: allowedSecrets.join(",") || "none" }),
        );
      }
    }
    for (const secret of details.jobEnvSecrets) {
      findings.push(
        finding(policy, "job-level-secret", { job, actual: secret, expected: "step-level env or with only" }),
      );
    }

    if (policy.forkSafe && policy.events?.includes("pull_request") && expectedJob.release) {
      if (details.secretNames.length) {
        findings.push(
          finding(policy, "release-secret-on-pull-request", {
            job,
            actual: details.secretNames.join(","),
            expected: "none",
          }),
        );
      }
      for (const [scope, value] of Object.entries(details.permissions ?? {})) {
        if (permissionValue.test(value) && value === "write") {
          findings.push(
            finding(policy, "fork-write-permission", { job, actual: `${scope}: ${value}`, expected: "read-only" }),
          );
        }
      }
    }
  }

  return findings;
}

async function workflowFiles(directory) {
  const workflowsDirectory = join(directory, ".github", "workflows");
  try {
    return (await readdir(workflowsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
      .map((entry) => `.github/workflows/${entry.name}`);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function auditPolicy(policy, repositoryRoot = root) {
  const findings = [];
  for (const [repository, configuration] of Object.entries(policy.repositories ?? {})) {
    const directory = resolve(repositoryRoot, configuration.path);
    const configuredWorkflows = Object.entries(configuration.workflows ?? {});
    const configuredPaths = new Set(Object.keys(configuration.workflows ?? {}));
    for (const [workflow, workflowPolicy] of configuredWorkflows) {
      const path = join(directory, workflow);
      try {
        await access(path);
      } catch {
        findings.push({
          repository,
          workflow,
          event: workflowPolicy.events?.join(",") ?? "unknown",
          job: "workflow",
          actual: "missing",
          expected: "workflow file",
          rule: "missing-workflow",
          remediation: workflowPolicy.remediation ?? "Add or remove the policy entry deliberately.",
        });
        continue;
      }
      const text = await readFile(path, "utf8");
      findings.push(...auditWorkflowText(text, { ...workflowPolicy, repository, workflow }));
    }
    for (const workflow of await workflowFiles(directory)) {
      if (!configuredPaths.has(workflow)) {
        findings.push({
          repository,
          workflow,
          event: "unknown",
          job: "workflow",
          actual: "unlisted",
          expected: "explicit policy entry",
          rule: "unlisted-workflow",
          remediation: "Add the workflow to workflow-permissions.json or remove the workflow intentionally.",
        });
      }
    }
  }
  return findings;
}

export function formatFindings(findings) {
  if (!findings.length) return "workflow permissions: policy passed";
  return findings
    .map(
      (item) =>
        `${item.repository} ${item.workflow} [${item.event}] job=${item.job} ${item.rule}: actual=${item.actual}; expected=${item.expected}; remediation: ${item.remediation}`,
    )
    .join("\n");
}

export async function loadPolicy(policyPath = join(root, "supply-chain/workflow-permissions.json")) {
  return JSON.parse(await readFile(policyPath, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const policy = await loadPolicy(process.argv[2] ? resolve(process.argv[2]) : undefined);
  const findings = await auditPolicy(policy, root);
  if (findings.length) {
    console.error(formatFindings(findings));
    process.exitCode = 1;
  } else {
    const repositoryCount = Object.keys(policy.repositories ?? {}).length;
    console.log(`workflow permissions: ${repositoryCount} repositories audited`);
  }
}
