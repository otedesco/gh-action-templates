import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const workflow = await readFile(join(root, ".github/workflows/release-docker-image.yml"), "utf8");

test("release workflow separates build, verification, attestation, and publication", () => {
  for (const job of ["build", "smoke", "vulnerability", "sbom", "provenance", "publish"]) {
    assert.match(workflow, new RegExp(`jobs:[\\s\\S]*[ ]{2}${job}:`), `missing ${job} job`);
  }
  assert.match(workflow, /outputs:[\s\S]*digest:/, "build must expose one digest");
  assert.match(workflow, /push-by-digest=true/, "build must publish only an immutable digest");
  assert.match(workflow, /needs\.build\.outputs\.digest/g, "verification must consume the build digest");
  assert.match(
    workflow,
    /needs:\s*\[build, smoke, vulnerability, sbom, provenance\]/,
    "publish must require every verification job",
  );
  assert.match(workflow, /github\.token/, "attestation and registry access must use the scoped GitHub token");
  assert.match(workflow, /actions\/attest@/, "provenance must be generated with GitHub artifact attestations");
  assert.match(workflow, /subject-digest:/, "provenance must bind to the built digest");
  assert.match(workflow, /gh attestation verify/, "provenance must be cryptographically verified");
  assert.match(workflow, /id-token:\s*write/, "attestation requires OIDC signing permission");
  assert.match(workflow, /attestations:\s*write/, "attestation requires persistence permission");
  assert.match(workflow, /docker\/scout-action@/, "scanner tooling must be explicitly provisioned");
  assert.match(workflow, /actions\/download-artifact@/, "publish must consume uploaded evidence artifacts");
  assert.match(workflow, /build-release-evidence\.mjs/, "publish must build evidence from artifact contents");
  assert.match(workflow, /Publish verified digest[\s\S]*docker\/login-action@/, "publish must authenticate to GHCR");
  assert.match(
    workflow,
    /Validate image target[\s\S]*ghcr\.io\/\$\{GITHUB_REPOSITORY\}/,
    "release must constrain the image target",
  );
  assert.match(
    workflow,
    /run: test "\$\{IMAGE\}" = "ghcr\.io\/\$\{GITHUB_REPOSITORY\}"/,
    "invalid image targets must fail",
  );
  assert.match(workflow, /Bind SBOM to verified digest/, "SBOM must carry an explicit digest contract");
  assert.doesNotMatch(workflow, /publish[\s\S]*docker\/build-push-action/, "publish must not rebuild the image");
});

test("release workflow checks image evidence before publication", () => {
  assert.match(workflow, /trivy|vulnerability/i);
  assert.match(workflow, /sbom/i);
  assert.match(workflow, /provenance|attest/i);
  assert.match(workflow, /health|smoke/i);
  assert.match(workflow, /verify-release-evidence\.mjs/);
});

console.log("container workflow contract: one digest must flow through every verification job");
