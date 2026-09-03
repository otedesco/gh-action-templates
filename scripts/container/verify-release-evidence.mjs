import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REQUIRED_JOBS = ["build", "smoke", "vulnerability", "sbom", "provenance"];

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

export function validateReleaseEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence))
    throw new Error("evidence must be an object");
  const digest = required(evidence.digest, "digest");
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error(`invalid digest: ${digest}`);
  if (!evidence.jobs || typeof evidence.jobs !== "object" || Array.isArray(evidence.jobs))
    throw new Error("jobs is required");
  const failures = [];
  for (const job of REQUIRED_JOBS) {
    const result = evidence.jobs[job];
    if (!result) {
      failures.push(`${job}: missing result`);
      continue;
    }
    if (result.status !== "success") failures.push(`${job}: status must be success`);
    if (result.digest !== digest) failures.push(`${job}: digest does not match build digest`);
    required(result.artifact, `${job}.artifact`);
  }
  if (!evidence.sbom?.subject || evidence.sbom.subject !== digest)
    failures.push("sbom: subject does not match build digest");
  if (!evidence.provenance?.subject || evidence.provenance.subject !== digest)
    failures.push("provenance: subject does not match build digest");
  if (failures.length) throw new Error(failures.sort().join("\n"));
  return { digest, jobs: REQUIRED_JOBS };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: node scripts/container/verify-release-evidence.mjs <evidence.json>");
  const result = validateReleaseEvidence(JSON.parse(await readFile(path, "utf8")));
  console.log(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
