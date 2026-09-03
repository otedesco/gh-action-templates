import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function finding(
  repository,
  rule,
  actual,
  expected,
  remediation = "Update .github/CODEOWNERS and rerun the governance audit.",
) {
  return { repository, rule, actual, expected, remediation };
}

function parseRules(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { pattern, owners };
    });
}

function normalizePath(path) {
  return path.replace(/^\//, "").replace(/\/\*\*$/, "");
}

function patternCovers(pattern, path) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(path);
  if (pattern === "*") return true;
  if (pattern.endsWith("/**"))
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`);
  if (pattern.endsWith("/*")) return normalizedPath.startsWith(`${normalizedPattern.slice(0, -1)}`);
  return normalizedPattern === normalizedPath;
}

export function auditCodeownersText(text, repository) {
  const rules = parseRules(text);
  const findings = [];
  const approvedOwners = new Set((repository.owners ?? []).map((owner) => owner.replace(/^@/, "")));
  if (rules.length === 0) {
    return [finding(repository.name, "missing-codeowners-rules", "none", "at least one ownership rule")];
  }

  for (const rule of rules) {
    if (!rule.pattern || rule.owners.length === 0) {
      findings.push(finding(repository.name, "malformed-codeowners-rule", JSON.stringify(rule), "pattern and owner"));
      continue;
    }
    for (const owner of rule.owners) {
      const normalizedOwner = owner.replace(/^@/, "");
      if (!owner.startsWith("@") || !approvedOwners.has(normalizedOwner)) {
        findings.push(
          finding(repository.name, "unapproved-codeowner", owner, [...approvedOwners].join(", ") || "approved owner"),
        );
      }
    }
  }

  for (const requiredPath of repository.requiredPaths ?? []) {
    if (!rules.some((rule) => rule.owners.length > 0 && patternCovers(rule.pattern, requiredPath))) {
      findings.push(finding(repository.name, "unowned-critical-path", requiredPath, "a matching approved owner rule"));
    }
  }
  return findings;
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
  const workspaceMode = process.argv.includes("--workspace");
  const inventory = await readJson(new URL("../../governance/repositories.json", import.meta.url));
  const findings = [];
  for (const repository of inventory.repositories) {
    if (!workspaceMode && repository.name !== "gh-action-templates") continue;
    try {
      const codeowners = await readFile(resolve(root, repository.localPath, repository.codeowners), "utf8");
      findings.push(...auditCodeownersText(codeowners, repository));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      findings.push(
        finding(repository.name, "missing-codeowners-file", repository.codeowners, "tracked CODEOWNERS file"),
      );
    }
  }
  if (findings.length) {
    console.error(formatFindings(findings));
    process.exitCode = 1;
    return;
  }
  const audited = workspaceMode ? inventory.repositories.length : 1;
  console.log(`CODEOWNERS: ${audited} repositories audited`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
