import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildReleaseEvidence, validateSbomEvidence } from "../scripts/container/build-release-evidence.mjs";
import { validateReleaseEvidence, verifyReleaseEvidence } from "../scripts/container/verify-release-evidence.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const image = "ghcr.io/example/repository";
const document = {
  spdxVersion: "SPDX-2.3",
  SPDXID: "SPDXRef-DOCUMENT",
  name: "example-image",
  dataLicense: "CC0-1.0",
  documentNamespace: "https://example.invalid/spdx/example",
  packages: [],
};
const sbom = { format: "spdx-json", image, digest, document };
const artifact = (value) => ({
  artifact: "/tmp/evidence.json",
  sha256: createHash("sha256").update(value).digest("hex"),
});

async function writeEvidence(root) {
  const files = {
    "build.json": JSON.stringify({ image, digest }),
    "smoke.json": JSON.stringify({ digest, health: "healthy" }),
    "vulnerability.sarif": JSON.stringify({ version: "2.1.0", runs: [] }),
    "sbom.json": JSON.stringify(sbom),
    "provenance.json": JSON.stringify([
      { verificationResult: { statement: { subject: [{ digest: { sha256: digest.slice(7) } }] } } },
    ]),
  };
  for (const [name, content] of Object.entries(files)) {
    const directory = join(root, `container-${name}`);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), content);
  }
}

test("accepts an SPDX SBOM bound to the verified image digest", () => {
  assert.deepEqual(validateSbomEvidence(sbom, image, digest), document);
});

test("builds and verifies evidence from downloaded artifacts", async () => {
  const root = await mkdtemp(join(process.cwd(), "container-evidence-"));
  try {
    await writeEvidence(root);
    const output = join(root, "release-evidence.json");
    await buildReleaseEvidence(root, output);
    const evidence = JSON.parse(await readFile(output, "utf8"));
    assert.equal(evidence.image, image);
    assert.deepEqual(validateReleaseEvidence(evidence), {
      digest,
      jobs: ["build", "smoke", "vulnerability", "sbom", "provenance"],
    });
    await verifyReleaseEvidence(output);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const [name, mutate] of [
  ["malformed JSON", (files) => ({ ...files, "sbom.json": "{" })],
  [
    "wrong digest",
    (files) => ({ ...files, "sbom.json": JSON.stringify({ ...sbom, digest: `sha256:${"b".repeat(64)}` }) }),
  ],
  ["invalid provenance", (files) => ({ ...files, "provenance.json": JSON.stringify([]) })],
]) {
  test(`rejects ${name} downloaded evidence`, async () => {
    const root = await mkdtemp(join(process.cwd(), "container-evidence-invalid-"));
    try {
      await writeEvidence(root);
      const files = Object.fromEntries(
        await Promise.all(
          ["build.json", "smoke.json", "vulnerability.sarif", "sbom.json", "provenance.json"].map(async (name) => [
            name,
            await readFile(join(root, `container-${name}`, name), "utf8"),
          ]),
        ),
      );
      for (const [file, content] of Object.entries(mutate(files))) {
        await writeFile(join(root, `container-${file}`, file), content);
      }
      await assert.rejects(() => buildReleaseEvidence(root, join(root, "release-evidence.json")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("rejects duplicate downloaded artifacts", async () => {
  const root = await mkdtemp(join(process.cwd(), "container-evidence-duplicate-"));
  try {
    await writeEvidence(root);
    await mkdir(join(root, "duplicate-build"));
    await writeFile(join(root, "duplicate-build", "build.json"), JSON.stringify({ image, digest }));
    await assert.rejects(
      () => buildReleaseEvidence(root, join(root, "release-evidence.json")),
      /exactly one build.json/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an artifact checksum mismatch", async () => {
  const root = await mkdtemp(join(process.cwd(), "container-evidence-checksum-"));
  try {
    await writeEvidence(root);
    const output = join(root, "release-evidence.json");
    await buildReleaseEvidence(root, output);
    await writeFile(
      join(root, "container-smoke.json", "smoke.json"),
      JSON.stringify({ digest, health: "healthy", changed: true }),
    );
    await assert.rejects(() => verifyReleaseEvidence(output), /artifact checksum does not match evidence/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires an evidence directory and output path", async () => {
  await assert.rejects(() => buildReleaseEvidence(), /usage/);
});

for (const [name, value] of [
  ["missing envelope", {}],
  ["wrong format", { ...sbom, format: "cyclonedx-json" }],
  ["wrong image", { ...sbom, image: "ghcr.io/example/other" }],
  ["wrong digest", { ...sbom, digest: `sha256:${"b".repeat(64)}` }],
  ["malformed SPDX", { ...sbom, document: { ...document, spdxVersion: "not-spdx" } }],
  ["empty SPDX", { ...sbom, document: {} }],
]) {
  test(`rejects ${name} SBOM evidence`, () => {
    assert.throws(() => validateSbomEvidence(value, image, digest));
  });
}

test("rejects failed jobs and mismatched evidence", () => {
  const content = JSON.stringify({ ok: true });
  const entry = { ...artifact(content), digest, status: "success" };
  const jobs = Object.fromEntries(["build", "smoke", "vulnerability", "sbom", "provenance"].map((job) => [job, entry]));
  assert.throws(() =>
    validateReleaseEvidence({
      image,
      digest,
      jobs: { ...jobs, smoke: { ...entry, status: "failure" } },
      sbom: { subject: digest, ...entry },
      provenance: { subject: digest, ...entry },
    }),
  );
});

test("rejects evidence with a missing required job", () => {
  const content = JSON.stringify({ ok: true });
  const entry = { ...artifact(content), digest, status: "success" };
  const jobs = Object.fromEntries(["build", "smoke", "vulnerability", "sbom"].map((job) => [job, entry]));
  assert.throws(
    () =>
      validateReleaseEvidence({
        image,
        digest,
        jobs,
        sbom: { subject: digest, ...entry },
        provenance: { subject: digest, ...entry },
      }),
    /provenance: missing result/,
  );
});
