import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  CORE_GATE_COMMANDS,
  CORE_GATE_NAMES,
  validateConsumerManifest,
  validateCoreGates,
} from "../scripts/validate-core-gates.mjs";

const root = new URL("..", import.meta.url).pathname;
const policy = JSON.parse(await readFile(join(root, "quality-gates/core-gates.json"), "utf8"));

test("core policy defines six stable canonical gates", () => {
  assert.deepEqual(
    policy.gates.map(({ name }) => name),
    CORE_GATE_NAMES,
  );
  assert.deepEqual(Object.fromEntries(policy.gates.map(({ name, command }) => [name, command])), CORE_GATE_COMMANDS);
  assert.deepEqual(validateCoreGates(policy), []);
  for (const gate of policy.gates) {
    assert.ok(gate.check);
    assert.ok(gate.failureConditions.length);
    assert.ok(Array.isArray(gate.evidence.paths));
    assert.ok(Array.isArray(gate.exceptions));
  }
});

test("validator reports duplicate, missing, ignored, and unsupported definitions", () => {
  const invalid = structuredClone(policy);
  invalid.gates = [
    { ...invalid.gates[0], command: "prettier --write ." },
    { ...invalid.gates[0], command: "true" },
  ];
  const errors = validateCoreGates(invalid, { repository: "fixture" });
  assert.ok(errors.some((entry) => entry.repository === "fixture" && entry.rule === "duplicate gate name"));
  assert.ok(errors.some((entry) => entry.rule === "non-canonical command"));
  assert.ok(errors.some((entry) => entry.rule.includes("missing gates")));
  assert.ok(errors.every((entry) => entry.remediation));
});

test("validator rejects incomplete exceptions and missing required metadata", () => {
  const invalid = structuredClone(policy);
  invalid.gates[0].check = "";
  invalid.gates[0].failureConditions = [];
  invalid.gates[0].evidence = {};
  invalid.gates[0].exceptions = [{}];
  const rules = validateCoreGates(invalid).map(({ rule }) => rule);
  assert.ok(rules.includes("missing stable check name"));
  assert.ok(rules.includes("missing failure conditions"));
  assert.ok(rules.includes("missing evidence paths"));
  assert.ok(rules.includes("incomplete exception"));
});

test("all consumer manifests expose truthful core scripts or owned blockers", async () => {
  const repositories = ["commons", "cache", "server-utils", "notify", "cerberus", "hermes", "web-app"];
  for (const repository of repositories) {
    const directory = join(root, "..", repository);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    const configText = repository === "cerberus" ? await readFile(join(directory, "jest.config.js"), "utf8") : "";
    assert.deepEqual(validateConsumerManifest(manifest, { repository, configText }), [], repository);
  }
});
