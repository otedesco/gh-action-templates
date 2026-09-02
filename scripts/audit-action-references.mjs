import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import process from "node:process";

export const REPOSITORIES = [
  "gh-action-templates",
  "commons",
  "cache",
  "server-utils",
  "notify",
  "cerberus",
  "hermes",
  "web-app",
];

const SHA_RE = /^[0-9a-f]{40}$/;
const IGNORED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules", "tmp"]);
const REMOTE_RE = /^([^/\s]+)\/([^/\s]+)(?:\/(.+))?@([^\s#]+)$/;

export function parseUses(text, file) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/\buses:\s*([^\s#]+)/);
    if (!match || /^\s*#/.test(line)) return [];
    return [{ file, line: index + 1, value: match[1] }];
  });
}

async function collect(directory, root, results) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(path, root, results);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) &&
      (relative(root, path).startsWith(".github/workflows/") || relative(root, path).startsWith(".github/actions/"))
    ) {
      results.push(...parseUses(await readFile(path, "utf8"), relative(root, path)));
    }
  }
}

export async function discoverReferences(workspaceRoot) {
  const references = [];
  for (const repository of REPOSITORIES) {
    const repositoryRoot =
      repository === "gh-action-templates" ? workspaceRoot : resolve(workspaceRoot, "..", repository);
    try {
      await collect(repositoryRoot, repositoryRoot, references);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return references.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.value.localeCompare(b.value));
}

function manifestKey(owner, repository, path, reference) {
  return [owner, repository, path ?? "", reference].join("/");
}

export function validateManifest(manifest) {
  const failures = [];
  if (!manifest || !Array.isArray(manifest.references)) {
    return ["supply-chain/action-references.json: expected a references array"];
  }
  const seen = new Set();
  for (const [index, entry] of manifest.references.entries()) {
    const label = `manifest entry ${index + 1}`;
    for (const field of ["owner", "repository", "reference", "release", "reviewedAt", "purpose", "repositories"]) {
      if (!(field in entry)) failures.push(`${label}: missing ${field}`);
    }
    if (!SHA_RE.test(entry.reference ?? ""))
      failures.push(`${label}: reference must be a 40-character lowercase commit SHA`);
    if (typeof entry.release !== "string" || !entry.release.trim())
      failures.push(`${label}: release metadata is required`);
    if (!Array.isArray(entry.repositories) || entry.repositories.length === 0)
      failures.push(`${label}: repositories must be a non-empty array`);
    const key = manifestKey(entry.owner, entry.repository, entry.path, entry.reference);
    if (seen.has(key)) failures.push(`${label}: duplicate manifest entry`);
    seen.add(key);
  }
  return failures;
}

export function auditReferences(references, manifest) {
  const failures = [...validateManifest(manifest)];
  const entries = new Map(
    (manifest?.references ?? []).map((entry) => [
      manifestKey(entry.owner, entry.repository, entry.path, entry.reference),
      entry,
    ]),
  );
  for (const occurrence of references) {
    if (occurrence.value.startsWith("./")) {
      if (occurrence.value.startsWith("../") || occurrence.value.includes("/../") || occurrence.value.includes("\\")) {
        failures.push(
          `${occurrence.file}:${occurrence.line}: unsafe local action path ${occurrence.value}; use a repository-local ./ path without parent traversal`,
        );
      }
      continue;
    }
    if (occurrence.value.startsWith("../") || occurrence.value.startsWith("/") || occurrence.value.includes("://")) {
      failures.push(
        `${occurrence.file}:${occurrence.line}: unsafe local action path or remote reference ${occurrence.value}; use a repository-local ./ path without parent traversal or owner/repository@SHA`,
      );
      continue;
    }
    const parsed = occurrence.value.match(REMOTE_RE);
    if (!parsed) {
      failures.push(
        `${occurrence.file}:${occurrence.line}: malformed action reference ${occurrence.value}; expected owner/repository@SHA`,
      );
      continue;
    }
    const [, owner, repository, path, reference] = parsed;
    if (!SHA_RE.test(reference)) {
      failures.push(
        `${occurrence.file}:${occurrence.line}: mutable or malformed ref ${reference}; pin the action to a 40-character lowercase commit SHA`,
      );
      continue;
    }
    const entry = entries.get(manifestKey(owner, repository, path, reference));
    if (!entry) {
      failures.push(
        `${occurrence.file}:${occurrence.line}: unreviewed SHA ${occurrence.value}; add the exact reference to supply-chain/action-references.json`,
      );
    }
  }
  return failures.sort();
}

export async function runAudit(root = new URL("../", import.meta.url).pathname) {
  const references = await discoverReferences(root);
  const manifest = JSON.parse(await readFile(join(root, "supply-chain/action-references.json"), "utf8"));
  const failures = auditReferences(references, manifest);
  if (failures.length) {
    console.error(failures.join("\n"));
    return 1;
  }
  console.log(`Immutable action references: ${references.length} references audited`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  process.exitCode = await runAudit();
}
