import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { normalizeReport, serializeFindings } from "../scripts/security/normalize-results.mjs";

const root = new URL("../", import.meta.url).pathname;
const fixtureRoot = join(root, "test/fixtures/security");

async function fixture(name, tool) {
  return JSON.parse(await readFile(join(fixtureRoot, name, `${tool}.json`), "utf8"));
}

test("normalizes the valid scanner fixture set to no findings", async () => {
  for (const tool of ["codeql", "dependency-review", "secret-scan", "license", "workflow-security"]) {
    assert.deepEqual(normalizeReport(tool, await fixture("valid", tool)), []);
  }
});

test("normalizes each scanner defect to one stable finding", async () => {
  const cases = [
    ["codeql-high", "codeql", "js/example-high", "high"],
    ["vulnerable-dependency", "dependency-review", "CVE-2026-0001", "critical"],
    ["sentinel-secret", "secret-scan", "generic-secret", "high"],
    ["prohibited-license", "license", "GPL-3.0-only", "high"],
    ["unsafe-workflow", "workflow-security", "untrusted-expression", "high"],
  ];
  for (const [name, tool, rule, severity] of cases) {
    const findings = normalizeReport(tool, await fixture(name, tool));
    assert.equal(findings.length, 1, `${tool} must produce exactly one finding`);
    assert.equal(findings[0].rule, rule);
    assert.equal(findings[0].severity, severity);
    assert.equal(findings[0].tool, tool);
  }
});

test("rejects absent, malformed, unsupported, and truncated reports", () => {
  assert.throws(() => normalizeReport("codeql", null), /report must be an object/);
  assert.throws(() => normalizeReport("codeql", { version: "1.0.0", runs: [] }), /unsupported SARIF version/);
  assert.throws(() => normalizeReport("dependency-review", { version: 1 }), /dependencies/);
  assert.throws(() => normalizeReport("unknown", {}), /unsupported scanner/);
});

test("serializes sorted findings without secret snippets", async () => {
  const finding = normalizeReport("secret-scan", await fixture("sentinel-secret", "secret-scan"))[0];
  const output = serializeFindings([finding]);
  assert.match(output, /generic-secret/);
  assert.doesNotMatch(output, /SENTINEL-SECURITY-TOKEN/);
  assert.equal(output.endsWith("\n"), true);
});

test("maps SARIF levels and fingerprints findings deterministically", () => {
  const report = {
    version: "2.1.0",
    runs: [
      {
        results: [
          {
            ruleId: "rule",
            level: "warning",
            locations: [{ physicalLocation: { artifactLocation: { uri: "a.js" }, region: { startLine: 1 } } }],
            message: { text: "one" },
          },
          {
            ruleId: "rule",
            level: "note",
            locations: [{ physicalLocation: { artifactLocation: { uri: "a.js" }, region: { startLine: 2 } } }],
            message: { text: "two" },
          },
        ],
      },
    ],
  };
  const findings = normalizeReport("codeql", report);
  assert.deepEqual(
    findings.map(({ severity }) => severity),
    ["medium", "low"],
  );
  assert.notEqual(findings[0].fingerprint, findings[1].fingerprint);
});
