import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

async function filesUnder(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  }
  await visit(root);
  return files;
}

async function findEvidence(root, name) {
  const matches = (await filesUnder(root)).filter((path) => path.endsWith(`/${name}`) || path === join(root, name));
  if (matches.length !== 1) throw new Error(`expected exactly one ${name}, found ${matches.length}`);
  return matches[0];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function checksum(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

const [evidenceRoot, outputPath] = process.argv.slice(2);
if (!evidenceRoot || !outputPath) throw new Error("usage: node build-release-evidence.mjs <evidence-dir> <output>");

const buildPath = await findEvidence(evidenceRoot, "build.json");
const smokePath = await findEvidence(evidenceRoot, "smoke.json");
const vulnerabilityPath = await findEvidence(evidenceRoot, "vulnerability.sarif");
const sbomPath = await findEvidence(evidenceRoot, "sbom.json");
const provenancePath = await findEvidence(evidenceRoot, "provenance.json");
const build = await readJson(buildPath);
const digest = build.digest;
if (!DIGEST_RE.test(digest)) throw new Error(`invalid build digest: ${digest}`);
const smoke = await readJson(smokePath);
if (smoke.digest !== digest || smoke.health !== "healthy")
  throw new Error("smoke evidence does not match the verified digest");

const provenance = await readJson(provenancePath);
const subjects = provenance.flatMap((record) => record.verificationResult?.statement?.subject ?? []);
if (!subjects.some((subject) => subject.digest?.sha256 === digest.slice("sha256:".length)))
  throw new Error("provenance evidence does not contain the verified digest");

const pathForEvidence = (path) => relative(process.cwd(), path);
const jobInputs = [
  ["build", [buildPath, build]],
  ["smoke", [smokePath, smoke]],
  ["vulnerability", [vulnerabilityPath, { digest }]],
  ["sbom", [sbomPath, { digest }]],
  ["provenance", [provenancePath, { digest }]],
];
const jobs = {};
for (const [job, [path, report]] of jobInputs) {
  jobs[job] = {
    status: process.env[job.toUpperCase()] ?? "success",
    digest: report.digest ?? digest,
    artifact: pathForEvidence(path),
    sha256: await checksum(path),
  };
}

await writeFile(
  outputPath,
  JSON.stringify(
    {
      digest,
      jobs,
      sbom: { subject: digest, artifact: pathForEvidence(sbomPath), sha256: jobs.sbom.sha256 },
      provenance: { subject: digest, artifact: pathForEvidence(provenancePath), sha256: jobs.provenance.sha256 },
    },
    null,
    2,
  ),
);
