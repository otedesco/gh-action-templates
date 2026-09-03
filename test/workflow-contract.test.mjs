import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CORE_GATE_NAMES, CORE_GATE_COMMANDS } from "../scripts/validate-core-gates.mjs";

const root = new URL("../", import.meta.url).pathname;
const workflow = await readFile(join(root, ".github/workflows/lint-and-test.yml"), "utf8");
const securityWorkflow = await readFile(join(root, ".github/workflows/security.yml"), "utf8");
const coverageAction = await readFile(join(root, ".github/actions/coverage-gate/action.yml"), "utf8");
const qualityOrder = ["format:check", "lint:check", "type:check", "test", "test:coverage", "build"];
const stepNames = ["Format check", "Lint", "Type check", "Unit tests", "Coverage", "Build"];

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
assert.match(
  workflow,
  /^permissions:\n[ ]{2}contents: read/m,
  "quality workflow must declare read-only token authority",
);
assert.match(
  workflow,
  /jobs:\n[ ]{2}lint-and-test:[\s\S]*?permissions:\n[ ]{6}contents: read/,
  "quality job must declare its permissions",
);
assert.doesNotMatch(
  workflow,
  /secrets\.GITHUB_TOKEN|notify-status/,
  "quality checks must use built-in check reporting",
);
for (const command of qualityOrder) {
  assert.match(
    workflow,
    new RegExp(`run: \\$\\{\\{ inputs\\.package-manager \\}\\} run ${command.replace(":", "\\:")}`),
    `missing ${command} workflow step`,
  );
}
for (const stepName of stepNames)
  assert.match(workflow, new RegExp("- name: " + stepName), "missing named gate step: " + stepName);
assert.match(workflow, /git diff --exit-code/, "workflow must fail on generated-file drift");
assert.match(workflow, /fetch-depth: 0/, "coverage evaluation requires complete history");
assert.match(
  workflow,
  /uses: otedesco\/gh-action-templates\/\.github\/actions\/coverage-gate@[0-9a-f]{40}/,
  "workflow must use an immutable central coverage action",
);
assert.match(workflow, /base:/, "workflow must provide an explicit coverage base");
assert.match(workflow, /head:/, "workflow must provide an explicit coverage head");
assert.match(
  workflow,
  /Upload coverage decision[\s\S]*if: \$\{\{ always\(\) \}\}/,
  "coverage evidence must upload on failure",
);
assert.match(coverageAction, /using: composite/, "coverage gate must be a composite action");
assert.match(coverageAction, /base:/, "coverage action must require a base revision");
assert.match(coverageAction, /head:/, "coverage action must require a head revision");
assert.match(
  coverageAction,
  /coverage-baselines\/current\.json/,
  "coverage action must fail closed without a baseline",
);
assert.deepEqual(CORE_GATE_NAMES, ["format", "lint", "type", "unit", "coverage", "build"]);
assert.deepEqual(CORE_GATE_COMMANDS, {
  format: "format:check",
  lint: "lint:check",
  type: "type:check",
  unit: "test",
  coverage: "test:coverage",
  build: "build",
});
assert.doesNotMatch(workflow, /continue-on-error|\|\|\s*true|--fix\b|--write\b|--passWithNoTests|--forceExit/);

for (const [name, expectedPermissions] of [
  [
    "release-package.yml",
    /permissions: \{\}\n\njobs:\n[ ]{2}[^\n]+:[\s\S]*?permissions:\n[ ]{6}contents: write\n[ ]{6}pull-requests: write/,
  ],
  [
    "release-docker-image.yml",
    /permissions: \{\}\n\njobs:\n[ ]{2}[^\n]+:[\s\S]*?permissions:\n[ ]{6}contents: read\n[ ]{6}packages: write/,
  ],
]) {
  const releaseWorkflow = await readFile(join(root, `.github/workflows/${name}`), "utf8");
  assert.match(releaseWorkflow, expectedPermissions, `${name} must declare minimum release permissions`);
  assert.doesNotMatch(releaseWorkflow, /secrets\.GH_TOKEN|secrets\.GITHUB_TOKEN/);
  assert.match(releaseWorkflow, /github\.token/);
}

const securityFixture = JSON.parse(await readFile(fixturePath("security-error", "fixture.json"), "utf8"));
const securityFixtureWorkflow = await readFile(fixturePath("security-error", "workflow.yml"), "utf8");
assert.equal(securityFixture.gate, "security");
assert.throws(() => assertSecurityFixture(securityFixtureWorkflow), /security gate/);

assert.match(securityWorkflow, /pull_request:/, "security workflow must run on pull requests");
assert.match(securityWorkflow, /workflow_call:/, "security workflow must be reusable");
for (const job of ["codeql", "dependency-review", "secret-scan", "license", "workflow-security", "aggregate"]) {
  assert.match(securityWorkflow, new RegExp(`jobs:\\n[\\s\\S]*[ ]{2}${job}:`), `missing security job: ${job}`);
}
assert.match(securityWorkflow, /fetch-depth: 0/, "security scans require complete history");
assert.match(securityWorkflow, /security-events: write/, "SARIF upload must have explicit security-events access");
assert.match(securityWorkflow, /upload-sarif@[0-9a-f]{40}/, "SARIF upload must be immutable");
assert.match(securityWorkflow, /dependency-review-action@[0-9a-f]{40}/, "dependency review must be immutable");
assert.match(securityWorkflow, /gitleaks-action@[0-9a-f]{40}/, "secret scanning must be immutable");
assert.match(securityWorkflow, /zizmor-action@[0-9a-f]{40}/, "workflow security must be immutable");
assert.match(securityWorkflow, /retention-days:/, "security artifacts must have bounded retention");
assert.match(securityWorkflow, /validate-policy\.mjs/, "aggregate must validate policy and exceptions");
assert.match(
  securityWorkflow,
  /needs:\s*\[codeql, dependency-review, secret-scan, license, workflow-security\]/,
  "aggregate must require every scanner",
);
assert.match(securityWorkflow, /needs\.[a-z-]+\.result.*(failure|cancelled|skipped)/s, "aggregate must fail closed");
assert.doesNotMatch(securityWorkflow, /continue-on-error|secrets:\s*inherit|secrets\.NPM_TOKEN.*pull_request/s);

const containerFixture = JSON.parse(await readFile(fixturePath("container-error", "fixture.json"), "utf8"));
const dockerfile = await readFile(fixturePath("container-error", "Dockerfile"), "utf8");
assert.equal(containerFixture.gate, "container");
assert.throws(() => assertContainerFixture(dockerfile), /container gate/);

console.log("workflow contract: reusable wiring and fail-closed security/container fixtures verified");
