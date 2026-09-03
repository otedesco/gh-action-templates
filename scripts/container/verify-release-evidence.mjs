import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateSbomEvidence } from "./build-release-evidence.mjs";

const REQUIRED_JOBS = ["build", "smoke", "vulnerability", "sbom", "provenance"];

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

async function verifyArtifact(result, job) {
  const artifact = required(result.artifact, `${job}.artifact`);
  await access(artifact);
  const checksum = required(result.sha256, `${job}.sha256`);
  if (!/^[0-9a-f]{64}$/.test(checksum)) throw new Error(`${job}.sha256 must be a SHA-256 hex digest`);
  const actual = createHash("sha256")
    .update(await readFile(artifact))
    .digest("hex");
  if (actual !== checksum) throw new Error(`${job}: artifact checksum does not match evidence`);
}

export function validateReleaseEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence))
    throw new Error("evidence must be an object");
  const image = required(evidence.image, "image");
  if (!/^ghcr\.io\/[^/]+\/[^/]+$/.test(image)) throw new Error(`invalid image: ${image}`);
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
    if (!result.artifact || !result.sha256) failures.push(`${job}: artifact path and checksum are required`);
  }
  if (!evidence.sbom?.subject || evidence.sbom.subject !== digest)
    failures.push("sbom: subject does not match build digest");
  if (!evidence.provenance?.subject || evidence.provenance.subject !== digest)
    failures.push("provenance: subject does not match build digest");
  if (!evidence.sbom?.artifact || !evidence.sbom?.sha256) failures.push("sbom: artifact and checksum are required");
  if (!evidence.provenance?.artifact || !evidence.provenance?.sha256)
    failures.push("provenance: artifact and checksum are required");
  if (failures.length) throw new Error(failures.sort().join("\n"));
  return { digest, jobs: REQUIRED_JOBS };
}

export async function verifyReleaseEvidence(path) {
  if (!path) throw new Error("usage: node scripts/container/verify-release-evidence.mjs <evidence.json>");
  const evidence = JSON.parse(await readFile(path, "utf8"));
  const result = validateReleaseEvidence(evidence);
  for (const job of [...REQUIRED_JOBS, "sbom", "provenance"]) {
    const target = job === "sbom" || job === "provenance" ? evidence[job] : evidence.jobs[job];
    await verifyArtifact(target, job);
  }
  const sbom = JSON.parse(await readFile(evidence.sbom.artifact, "utf8"));
  validateSbomEvidence(sbom, evidence.image, evidence.digest);
  console.log(JSON.stringify(result));
}

/* node:coverage ignore next */
if (process.argv[1] === fileURLToPath(import.meta.url)) await verifyReleaseEvidence(process.argv[2]);
