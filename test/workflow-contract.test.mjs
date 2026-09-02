import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const workflow = await readFile(join(root, ".github/workflows/lint-and-test.yml"), "utf8");
const qualityOrder = ["format:check", "lint:check", "type:check", "test", "test:coverage", "build"];

function fixturePath(name, file) {
  return join(root, "test/fixtures/workflows", name, file);
}

function assertSecurityFixture(workflowText) {
  const mutableReference = /uses:\s+[^\s]+@(main|master|v\d+(?:\.\d+)*)\b/;
  assert.match(workflowText, mutableReference);
  assert.fail("security gate rejected mutable action reference");
}

function assertContainerFixture(dockerfile) {
  assert.match(dockerfile, /^USER\s+root$/m);
  assert.fail("container gate rejected root execution");
}

assert.match(workflow, /workflow_call:/, "workflow must be reusable");
assert.match(workflow, /package-manager:/, "workflow must accept the runtime package-manager contract");
for (const command of qualityOrder) {
  assert.match(workflow, new RegExp(`run: \\$\\{\\{ inputs\\.package-manager \\}\\} run ${command.replace(":", "\\:")}`), `missing ${command} workflow step`);
}
assert.doesNotMatch(workflow, /continue-on-error|\|\|\s*true|--fix\b|--write\b|--passWithNoTests|--forceExit/);

const securityFixture = JSON.parse(await readFile(fixturePath("security-error", "fixture.json"), "utf8"));
const securityWorkflow = await readFile(fixturePath("security-error", "workflow.yml"), "utf8");
assert.equal(securityFixture.gate, "security");
assert.throws(() => assertSecurityFixture(securityWorkflow), /security gate/);

const containerFixture = JSON.parse(await readFile(fixturePath("container-error", "fixture.json"), "utf8"));
const dockerfile = await readFile(fixturePath("container-error", "Dockerfile"), "utf8");
assert.equal(containerFixture.gate, "container");
assert.throws(() => assertContainerFixture(dockerfile), /container gate/);

console.log("workflow contract: reusable wiring and fail-closed security/container fixtures verified");
