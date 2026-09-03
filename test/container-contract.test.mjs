import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateDockerfile } from "../scripts/container/validate-contract.mjs";

const root = new URL("../", import.meta.url).pathname;
const policy = JSON.parse(await readFile(join(root, "quality-gates/container-policy.json"), "utf8"));

const fixture = (name) => readFile(join(root, "test/fixtures/containers", name, "Dockerfile"), "utf8");

test("accepts a production Dockerfile with secret install and runtime evidence", async () => {
  const findings = validateDockerfile(await fixture("valid"), policy);
  assert.deepEqual(findings, []);
});

for (const [name, rule] of [
  ["root-user", "non-root-user"],
  ["no-healthcheck", "healthcheck"],
  ["token-arg", "secret-persistence"],
]) {
  test(`rejects ${name} fixture`, async () => {
    const findings = validateDockerfile(await fixture(name), policy);
    assert.deepEqual(
      findings.map(({ rule: actual }) => actual),
      [rule],
    );
  });
}

test("rejects an unsupported base image and mutable install", () => {
  const findings = validateDockerfile(
    "FROM node:latest\nRUN pnpm install\nFROM node:latest\nUSER node\nHEALTHCHECK CMD true\n",
    policy,
  );
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["base-image", "base-image", "frozen-install", "secret-mount"],
  );
});

for (const [name, port, command] of [
  ["cerberus", 3000, "dist/index.js"],
  ["hermes", 4000, "dist/index-server.js"],
]) {
  test(`${name} production image satisfies the container contract`, async () => {
    const dockerfile = await readFile(join(root, "..", name, "Dockerfile"), "utf8");
    assert.deepEqual(validateDockerfile(dockerfile, policy), []);
    assert.match(dockerfile, new RegExp(`127\\.0\\.0\\.1:${port}`));
    assert.match(dockerfile, new RegExp(command.replace(".", "\\.")));
  });
}

test("Hermes worker image satisfies the container contract", async () => {
  const dockerfile = await readFile(join(root, "..", "hermes", "Dockerfile.worker"), "utf8");
  assert.deepEqual(validateDockerfile(dockerfile, policy), []);
  assert.match(dockerfile, /127\.0\.0\.1:4000/);
  assert.match(dockerfile, /dist\/index-worker\.js/);
});

console.log("container contract: runtime, secret, install, and health requirements verified");
