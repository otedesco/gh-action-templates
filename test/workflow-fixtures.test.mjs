import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { diagnostic, runFixture } from "./helpers/run-fixture.mjs";

const root = new URL(".", import.meta.url).pathname;
const fixtures = [
  { name: "valid", expectedGate: null },
  { name: "type-error", expectedGate: "type" },
  { name: "lint-error", expectedGate: "lint" },
  { name: "format-drift", expectedGate: "format" },
  { name: "no-tests", expectedGate: "test" },
  { name: "coverage-gap", expectedGate: "coverage" },
  { name: "build-error", expectedGate: "build" },
  { name: "lint-warning", expectedGate: "lint" },
  { name: "focused-test", expectedGate: "test" },
  { name: "skipped-test", expectedGate: "test" },
  { name: "unhandled-error", expectedGate: "test" },
  { name: "leaked-handle", expectedGate: "test" },
  { name: "missing-coverage-provider", expectedGate: "coverage" },
  { name: "uncovered-source", expectedGate: "coverage" },
  { name: "build-drift", expectedGate: "build" },
];

async function repositorySnapshot(directory) {
  const entries = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else entries.push([path.slice(directory.length), await readFile(path)]);
    }
  }
  await visit(directory);
  return entries;
}

for (const fixture of fixtures) {
  test(`workflow fixture: ${fixture.name}`, async () => {
    const before = await repositorySnapshot(join(root, ".."));
    const result = await runFixture(fixture.name);
    const after = await repositorySnapshot(join(root, ".."));
    assert.deepEqual(after, before, "fixture execution mutated the central repository");
    assert.equal(result.timedOut, false, "fixture exceeded the execution timeout");
    assert.equal(result.evidence.gate, fixture.expectedGate ?? "build");
    if (fixture.expectedGate === null) {
      assert.equal(result.exitCode, 0, diagnostic(result));
    } else {
      assert.notEqual(result.exitCode, 0, diagnostic(result));
      assert.equal(result.evidence.gate, fixture.expectedGate);
      assert.match(diagnostic(result), /intentional fixture defect detected/);
    }
  });
}

test("fixture metadata and valid package expose the expected contract", async () => {
  const packageJson = JSON.parse(await readFile(join(root, "fixtures/workflows/valid/package.json"), "utf8"));
  for (const name of ["format:check", "lint:check", "type:check", "test", "test:coverage", "build", "quality:check"]) {
    assert.equal(typeof packageJson.scripts[name], "string", `missing ${name}`);
  }
  assert.doesNotMatch(packageJson.scripts["quality:check"], /--fix|--write|--passWithNoTests|--forceExit|\|\|\s*true/);
});
