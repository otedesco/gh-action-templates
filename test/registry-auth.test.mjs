import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { missingTokenMessage, runRegistryAuth, validateRegistryToken } from "../.github/actions/setup-environment/registry-auth.mjs";

test("validateRegistryToken rejects missing and blank values", () => {
  for (const token of [undefined, "", "   "]) {
    assert.throws(() => validateRegistryToken(token), { message: missingTokenMessage });
  }
});

test("validateRegistryToken accepts a non-blank token without returning it", () => {
  assert.equal(validateRegistryToken("fixture-token-that-must-not-appear"), true);
});

test("the CLI contract fails before install when NPM_TOKEN is missing", () => {
  const output = [];
  const exitCode = runRegistryAuth("", { onError: (message) => output.push(["error", message]) });
  assert.equal(exitCode, 1);
  assert.deepEqual(output, [["error", `::error::${missingTokenMessage}`]]);
});

test("the CLI contract validates credentials without printing or persisting the token", async () => {
  const sentinel = "fixture-token-that-must-not-appear";
  const directory = await tmpdir();
  const npmrc = join(directory, `ops-177-${process.pid}.npmrc`);
  const contents = "@otedesco:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n";
  await writeFile(npmrc, contents);
  const before = await readFile(npmrc, "utf8");
  const output = [];
  const exitCode = runRegistryAuth(sentinel, { onSuccess: (message) => output.push(["success", message]) });
  const after = await readFile(npmrc, "utf8");

  assert.equal(exitCode, 0);
  assert.deepEqual(output, [["success", "Private registry credentials are configured."]]);
  assert.doesNotMatch(JSON.stringify(output), new RegExp(sentinel));
  assert.equal(after, before);
});

test("the shared action exposes the explicit registry-auth contract", async () => {
  const action = await readFile(new URL("../.github/actions/setup-environment/action.yml", import.meta.url), "utf8");
  assert.match(action, /npm-token:/);
  assert.match(action, /registry-auth-required:/);
  assert.match(action, /if: \$\{\{ inputs\.registry-auth-required == 'true' \}\}/);
  assert.match(action, /INPUT_NPM_TOKEN: \$\{\{ inputs\.npm-token \}\}/);
  assert.match(action, /registry-auth-cli\.mjs/);
});

test("reusable workflows declare named secrets and frozen installs", async () => {
  const lint = await readFile(new URL("../.github/workflows/lint-and-test.yml", import.meta.url), "utf8");
  const release = await readFile(new URL("../.github/workflows/release-package.yml", import.meta.url), "utf8");
  for (const content of [lint, release]) {
    assert.match(content, /NPM_TOKEN:\s*\n\s+required:/);
    assert.match(content, /npm-token: \$\{\{ secrets\.NPM_TOKEN \}\}/);
    assert.match(content, /pnpm install --frozen-lockfile/);
    assert.doesNotMatch(content, /secrets:\s*inherit|Creating \.npmrc|\$HOME\/\.npmrc/);
  }
  assert.match(release, /GH_TOKEN:\s*\n\s+required: true/);
  assert.match(release, /registry-auth-required: "true"/);
});

test("Docker release wiring uses a required named secret", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release-docker-image.yml", import.meta.url), "utf8");
  assert.match(workflow, /NPM_TOKEN:\s*\n\s+required: true/);
  assert.match(workflow, /GH_TOKEN:\s*\n\s+required: true/);
  assert.match(workflow, /registry-auth-required: "true"/);
  assert.match(workflow, /npm-token: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.match(workflow, /setup-environment@main/);
  assert.match(workflow, /secrets:\s*\|\s*npm_token=\$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /build-args:[\s\S]*NPM_TOKEN|echo.*_authToken/);
});

for (const [repository, workflowNames] of Object.entries({
  cerberus: ["quality-checks.yml", "release-packages.yml", "release-docker.yml"],
  hermes: ["quality-checks.yml", "release-packages.yml", "release-docker.yml"],
  notify: ["quality-checks.yml", "release-packages.yml"],
})) {
  for (const workflowName of workflowNames) {
    test(`${repository}/${workflowName} passes only named registry secrets`, async () => {
      const content = await readFile(new URL(`../../${repository}/.github/workflows/${workflowName}`, import.meta.url), "utf8");
      assert.doesNotMatch(content, /secrets:\s*inherit/);
      assert.match(content, /registry-auth-required: true/);
      assert.match(content, /NPM_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
      if (workflowName !== "quality-checks.yml") {
        assert.match(content, /GH_TOKEN: \$\{\{ secrets\.GH_TOKEN \}\}/);
      }
    });
  }
}

for (const repository of ["cerberus", "hermes", "notify"]) {
  test(`${repository} keeps a credential-free .npmrc`, async () => {
    const npmrc = await readFile(new URL(`../../${repository}/.npmrc`, import.meta.url), "utf8");
    assert.match(npmrc, /_authToken=\$\{NPM_TOKEN\}/);
    assert.doesNotMatch(npmrc, /fixture-token|gh[pousr]_[A-Za-z0-9]+/);
  });
}
