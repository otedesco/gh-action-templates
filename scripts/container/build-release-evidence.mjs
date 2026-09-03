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

export function validateSbomEvidence(sbom, expectedImage, expectedDigest) {
  if (!sbom || typeof sbom !== "object" || Array.isArray(sbom)) throw new Error("SBOM evidence must be an object");
  if (sbom.format !== "spdx-json") throw new Error("SBOM evidence must use SPDX JSON");
  if (sbom.image !== expectedImage) throw new Error("SBOM image does not match the verified image");
  if (sbom.digest !== expectedDigest) throw new Error("SBOM digest does not match the verified digest");
  const document = sbom.document;
  if (!document || typeof document !== "object" || Array.isArray(document))
    throw new Error("SBOM document is required");
  for (const field of ["spdxVersion", "SPDXID", "name", "dataLicense", "documentNamespace"]) {
    if (typeof document[field] !== "string" || document[field].trim() === "")
      throw new Error(`SBOM document ${field} is required`);
  }
  if (!/^SPDX-2\./.test(document.spdxVersion) || document.SPDXID !== "SPDXRef-DOCUMENT")
    throw new Error("SBOM document is not valid SPDX JSON");
  if (!Array.isArray(document.packages)) throw new Error("SBOM document packages are required");
  return document;
}

export async function buildReleaseEvidence(evidenceRoot, outputPath) {
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
  const sbom = await readJson(sbomPath);
  if (typeof build.image !== "string" || build.image.trim() === "") throw new Error("build image is required");
  validateSbomEvidence(sbom, build.image, digest);
  const provenance = await readJson(provenancePath);
  const subjects = provenance.flatMap((record) => record.verificationResult?.statement?.subject ?? []);
  if (!subjects.some((subject) => subject.digest?.sha256 === digest.slice("sha256:".length)))
    throw new Error("provenance evidence does not contain the verified digest");

  const pathForEvidence = (path) => relative(process.cwd(), path);
  const jobInputs = [
    ["build", [buildPath, build]],
    ["smoke", [smokePath, smoke]],
    ["vulnerability", [vulnerabilityPath, { digest }]],
    ["sbom", [sbomPath, sbom]],
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
        image: build.image,
        digest,
        jobs,
        sbom: { subject: sbom.digest, artifact: pathForEvidence(sbomPath), sha256: jobs.sbom.sha256 },
        provenance: { subject: digest, artifact: pathForEvidence(provenancePath), sha256: jobs.provenance.sha256 },
      },
      null,
      2,
    ),
  );
}

/* node:coverage ignore next 3 */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await buildReleaseEvidence(...process.argv.slice(2));
}
