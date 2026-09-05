import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validatePolicy } from "../security/validate-policy.mjs";

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function date(value) {
  return typeof value === "string" && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

export function validateFlakes(flakes = [], exceptions = []) {
  const errors = [];
  const ids = new Set();
  const activeExceptions = new Set(
    exceptions.filter((entry) => entry?.remediation?.status === "open").map(({ id }) => id),
  );
  for (const flake of flakes) {
    const id = flake?.id ?? "<unknown>";
    for (const field of [
      "id",
      "repository",
      "check",
      "owner",
      "impact",
      "evidenceUrl",
      "reproduction",
      "remediationIssue",
      "status",
    ]) {
      if (!text(flake?.[field])) errors.push(`flake ${id} missing ${field}`);
    }
    if (!date(flake?.firstOccurredAt) || !date(flake?.latestOccurredAt))
      errors.push(`flake ${id} occurrence timestamps are invalid`);
    if (
      date(flake?.firstOccurredAt) &&
      date(flake?.latestOccurredAt) &&
      Date.parse(flake.firstOccurredAt) > Date.parse(flake.latestOccurredAt)
    )
      errors.push(`flake ${id} occurrence timestamps are reversed`);
    if (!["reproduced", "not-reproduced", "investigating"].includes(flake?.reproduction))
      errors.push(`flake ${id} reproduction is invalid`);
    if (!["active", "quarantined", "closed"].includes(flake?.status)) errors.push(`flake ${id} status is invalid`);
    if (flake?.status === "quarantined" && !activeExceptions.has(flake.exceptionId))
      errors.push(`flake ${id} quarantine requires an active exception`);
    if (flake?.status === "closed" && !date(flake?.resolvedAt))
      errors.push(`flake ${id} closed status requires resolvedAt`);
    if (ids.has(flake?.id)) errors.push(`duplicate flake id: ${flake.id}`);
    ids.add(flake?.id);
  }
  return errors.sort();
}

export function validateGovernance(policy, exceptions = [], flakes = [], now = new Date()) {
  return [...validatePolicy(policy, exceptions, now), ...validateFlakes(flakes, exceptions)].sort();
}

async function main() {
  const [, , policyPath, exceptionsPath, flakesPath] = process.argv;
  if (!policyPath || !exceptionsPath || !flakesPath)
    throw new Error(
      "usage: node scripts/reporting/validate-governance.mjs <policy.json> <exceptions.json> <flakes.json>",
    );
  const [policy, exceptions, flakes] = await Promise.all(
    [policyPath, exceptionsPath, flakesPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
  );
  const errors = validateGovernance(policy, exceptions, flakes);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
