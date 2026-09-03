import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const contract = JSON.parse(await readFile(join(root, "runtime-contract.json"), "utf8"));

const repositories = Object.entries(contract.repositories);
const forbiddenVersion = /^(?:latest|lts(?:\/.*)?|\^|~|[<>])/;

function exact(value, label) {
  assert.equal(typeof value, "string", `${label} must be declared`);
  assert.ok(value.length > 0, `${label} must not be empty`);
  assert.equal(forbiddenVersion.test(value), false, `${label} must be exact: ${value}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("the contract declares exact versions", () => {
  exact(contract.nodeVersion, "nodeVersion");
  for (const [manager, version] of Object.entries(contract.packageManagers)) exact(version, `${manager} version`);
});

test("the central manifest matches the contract", async () => {
  const manifest = await readJson(join(root, "package.json"));
  assert.equal(manifest.engines.node, contract.nodeVersion);
  assert.equal(manifest.engines.pnpm, contract.packageManagers.pnpm);
  assert.equal(manifest.packageManager, `pnpm@${contract.packageManagers.pnpm}`);
});

for (const [repository, expected] of repositories) {
  test(`${repository} manifest and lockfile match the contract`, async () => {
    const manifest = await readJson(join(root, "..", repository, "package.json"));
    assert.equal(manifest.engines?.node, contract.nodeVersion, `${repository} Node engine`);
    assert.equal(
      manifest.packageManager,
      `${expected.packageManager}@${contract.packageManagers[expected.packageManager]}`,
    );
    if (expected.packageManager === "pnpm") {
      assert.equal(manifest.engines?.pnpm, contract.packageManagers.pnpm, `${repository} package-manager engine`);
    }
    const repositoryRoot = join(root, "..", repository);
    await readFile(join(repositoryRoot, expected.lockfile));
    const names = await readdir(repositoryRoot);
    assert.equal(
      names.filter((name) => /^(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(name)).length,
      1,
      `${repository} must have exactly one lockfile`,
    );
    if (expected.packageManager === "pnpm") {
      const lockfile = await readFile(join(repositoryRoot, expected.lockfile), "utf8");
      assert.match(lockfile, /^lockfileVersion: '9\.0'/, `${repository} must use the pnpm 10 lockfile format`);
    } else {
      const lockfile = JSON.parse(await readFile(join(repositoryRoot, expected.lockfile), "utf8"));
      assert.equal(lockfile.lockfileVersion, 3, `${repository} must use npm lockfile v3`);
    }
  });
}

test("the shared setup action has authoritative exact defaults", async () => {
  const action = await readFile(join(root, ".github/actions/setup-environment/action.yml"), "utf8");
  assert.match(action, new RegExp(`default: "${contract.nodeVersion.replaceAll(".", "\\.")}"`));
  assert.match(action, new RegExp(`default: "${contract.packageManagers.pnpm.replaceAll(".", "\\.")}"`));
  assert.match(action, /volta-version: "2\.0\.2"/);
  assert.match(
    action,
    new RegExp(
      `run: volta install node@${contract.nodeVersion.replaceAll(".", "\\.")} npm@${contract.packageManagers.npm.replaceAll(".", "\\.")}`,
    ),
  );
  assert.doesNotMatch(action, /^ {8}node-version:/m, "setup must not run volta pin against the consumer manifest");
  assert.doesNotMatch(action, /^ {8}npm-version:/m, "setup must not run volta pin against the consumer manifest");
  assert.match(action, new RegExp(`version: "${contract.packageManagers.pnpm.replaceAll(".", "\\.")}"`));
  assert.doesNotMatch(action, /inputs\.(?:node-version|npm-version|pnpm-version)/);
  assert.doesNotMatch(action, /setup-bun|oven-sh\/setup-bun/);
});

for (const workflow of ["lint-and-test.yml", "release-package.yml", "release-docker-image.yml"]) {
  test(`${workflow} has no legacy Node or pnpm version`, async () => {
    const content = await readFile(join(root, `.github/workflows/${workflow}`), "utf8");
    assert.doesNotMatch(content, /18\.17\.[01]|8\.6\.10|8\.15\.6/);
    assert.doesNotMatch(content, /matrix\.(?:node-version|npm-version|pnpm-version)/);
    if (workflow !== "release-docker-image.yml") assert.match(content, /pnpm install --frozen-lockfile/);
  });
}

for (const dockerfile of ["../cerberus/Dockerfile", "../hermes/Dockerfile", "../hermes/Dockerfile.worker"]) {
  test(`${dockerfile} uses the supported Node runtime`, async () => {
    const content = await readFile(join(root, dockerfile), "utf8");
    const nodeImages = [...content.matchAll(/^FROM node:([^ ]+)/gim)].map((match) => match[1]);
    assert.ok(nodeImages.length >= 2, `${dockerfile} must pin installer and production Node images`);
    assert.deepEqual(
      nodeImages,
      nodeImages.map(() => `${contract.nodeVersion}-alpine`),
    );
    assert.doesNotMatch(content, /^ARG NPM_TOKEN/m, `${dockerfile} must not expose a token build argument`);
    assert.match(content, /RUN corepack enable && corepack install --global pnpm@10\.34\.0/);
    assert.match(
      content,
      /--mount=type=secret,id=npm_token,required=true[\s\\]*NPM_TOKEN=[\s\S]*?pnpm install --frozen-lockfile/,
    );
  });
}

test("Docker release workflow uses BuildKit secrets", async () => {
  const content = await readFile(join(root, ".github/workflows/release-docker-image.yml"), "utf8");
  assert.match(content, /secrets:\s*\|\s*npm_token=\$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.doesNotMatch(content, /build-args:[\s\S]*NPM_TOKEN/);
  assert.doesNotMatch(content, /Replace npm token/);
});
