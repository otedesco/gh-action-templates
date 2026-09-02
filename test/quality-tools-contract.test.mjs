import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;

test("central repository exposes check-only JavaScript and JSON quality tools", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const scripts = manifest.scripts ?? {};
  assert.match(scripts["format:check"], /prettier/);
  assert.match(scripts["format:check"], /\*\/\*\.\{js,mjs,cjs,json\}/);
  assert.match(scripts["lint:js"], /eslint/);
  assert.match(scripts["lint:json"], /check-json\.mjs/);
  assert.match(scripts["lint:check"], /lint:js/);
  assert.match(scripts["lint:check"], /lint:json/);
  assert.doesNotMatch(scripts["format:check"], /--write|--fix/);
  assert.doesNotMatch(scripts["lint:check"], /--fix|\|\|\s*true/);
  assert.equal(typeof manifest.devDependencies.eslint, "string");
  assert.equal(typeof manifest.devDependencies.prettier, "string");
});
