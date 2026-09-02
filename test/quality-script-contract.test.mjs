import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const contract = JSON.parse(await readFile(join(root, "quality-script-contract.json"), "utf8"));
const forbidden =
  /--fix\b|--write\b|--passWithNoTests|--forceExit|\|\|\s*true\b|\bexit\s+0\b|Error:\s*no test specified/;
const scriptReference = /\b(?:pnpm|npm|yarn)(?:\s+run)?\s+([A-Za-z][\w:-]*)/g;

async function manifest(repository) {
  return JSON.parse(await readFile(join(root, "..", repository, "package.json"), "utf8"));
}

function references(command) {
  return [...command.matchAll(scriptReference)].map((match) => match[1]);
}

function assertCheckGraph(repository, scripts) {
  const visited = new Set();
  const active = new Set();
  function visit(name) {
    assert.ok(name in scripts, `${repository}: ${name} references a missing script`);
    if (active.has(name)) assert.fail(`${repository}: script graph recursively references ${name}`);
    if (visited.has(name)) return;
    active.add(name);
    assert.doesNotMatch(scripts[name], forbidden, `${repository}: ${name} contains a forbidden check escape`);
    for (const reference of references(scripts[name])) {
      if (reference in scripts) visit(reference);
    }
    active.delete(name);
    visited.add(name);
  }
  for (const name of contract.requiredScripts) visit(name);
}

for (const [repository, metadata] of Object.entries(contract.repositories)) {
  test(`${repository} exposes the truthful quality script interface`, async () => {
    const packageJson = await manifest(repository);
    const scripts = packageJson.scripts ?? {};
    for (const name of contract.requiredScripts)
      assert.equal(typeof scripts[name], "string", `${repository}: missing ${name}`);
    assertCheckGraph(repository, scripts);
    for (const name of contract.qualityOrder)
      assert.match(scripts["quality:check"], new RegExp(`(?:pnpm|npm|yarn)(?: run)? ${name.replace(":", "\\:")}`));
    if (metadata.testHarness.startsWith("OPS-")) {
      assert.match(scripts.test, new RegExp(metadata.testHarness));
      assert.match(scripts["test:coverage"], new RegExp(metadata.testHarness));
    } else {
      assert.match(scripts.test, new RegExp(metadata.testHarness));
    }
  });
}

test("the reusable workflow invokes every check-only command", async () => {
  const workflow = await readFile(join(root, ".github/workflows/lint-and-test.yml"), "utf8");
  assert.match(workflow, /package-manager:/);
  for (const name of contract.qualityOrder)
    assert.match(
      workflow,
      new RegExp(`run: \\\$\\{\\{ inputs\\.package-manager \\\}\\} run ${name.replace(":", "\\:")}`),
    );
  assert.doesNotMatch(workflow, /continue-on-error|\|\|\s*true|--fix|--write|--passWithNoTests|--forceExit/);
});
