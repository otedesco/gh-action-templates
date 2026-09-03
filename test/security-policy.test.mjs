import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFindings, formatFindings, validatePolicy } from "../scripts/security/validate-policy.mjs";

const policy = {
  version: 1,
  blockingSeverities: ["critical", "high"],
  allowedSeverities: ["critical", "high", "medium", "low", "info"],
  tools: ["codeql", "dependency-review", "secret-scan", "license", "workflow-security"],
};

const validException = {
  id: "SEC-EX-001",
  owner: "security-team",
  rationale: "Upstream patch is scheduled and compensating isolation is active.",
  scope: { tool: "dependency-review", rule: "CVE-2026-0001", subject: "@example/fake" },
  compensatingControl: "Package is not included in production images.",
  approvedBy: "security-admin",
  expiresAt: "2099-01-02T00:00:00Z",
};

const highFinding = {
  tool: "dependency-review",
  rule: "CVE-2026-0001",
  severity: "high",
  subject: "@example/fake",
  fingerprint: "sha256:abc",
};

test("validates the blocking policy and rejects unsupported values", () => {
  assert.deepEqual(validatePolicy(policy, []), []);
  assert.match(validatePolicy({ ...policy, blockingSeverities: ["urgent"] }).join("\n"), /severity/);
  assert.match(validatePolicy({ ...policy, tools: ["unknown"] }).join("\n"), /tool/);
});

test("rejects incomplete, broad, duplicate, and expired exceptions", () => {
  const invalid = [
    { ...validException, owner: "" },
    { ...validException, expiresAt: "2020-01-01T00:00:00Z" },
    { ...validException, scope: { tool: "dependency-review" } },
    { ...validException, scope: { tool: "dependency-review", rule: "*", subject: "*" } },
    validException,
    { ...validException },
  ];
  const errors = validatePolicy(policy, invalid, new Date("2026-09-02T00:00:00Z"));
  assert.ok(errors.length >= 5);
  assert.match(errors.join("\n"), /owner|expiry|scope|duplicate/);
});

test("blocks critical and high findings while allowing configured lower severities", () => {
  const findings = [
    highFinding,
    { ...highFinding, severity: "critical", fingerprint: "sha256:def" },
    { ...highFinding, severity: "medium", fingerprint: "sha256:ghi" },
  ];
  const result = evaluateFindings(findings, policy, [], new Date("2026-09-02T00:00:00Z"));
  assert.deepEqual(result.blocking.map(({ severity }) => severity).sort(), ["critical", "high"]);
  assert.equal(result.allowed.length, 1);
});

test("applies only a valid, future, exact-scope exception", () => {
  const result = evaluateFindings(
    [highFinding, { ...highFinding, subject: "@example/other", fingerprint: "sha256:other" }],
    policy,
    [validException],
    new Date("2026-09-02T00:00:00Z"),
  );
  assert.deepEqual(
    result.blocking.map((finding) => finding.subject),
    ["@example/other"],
  );
  assert.equal(result.excepted.length, 1);

  const expired = evaluateFindings([highFinding], policy, [{ ...validException, expiresAt: "2026-01-01T00:00:00Z" }]);
  assert.equal(expired.blocking.length, 1);
  assert.match(expired.diagnostics.join("\n"), /expired/);
});

test("fails closed for malformed policies", () => {
  assert.doesNotThrow(() => evaluateFindings([highFinding], undefined));
  const result = evaluateFindings([highFinding], undefined);
  assert.equal(result.blocking.length, 1);
  assert.match(result.diagnostics.join("\n"), /policy/);
});

test("sorts diagnostics deterministically and never formats secret snippets", () => {
  const findings = [
    { ...highFinding, rule: "z-rule", fingerprint: "sha256:z", secret: "SENTINEL-SHOULD-NOT-PRINT" },
    { ...highFinding, rule: "a-rule", fingerprint: "sha256:a" },
  ];
  const result = evaluateFindings(findings, policy, []);
  const output = formatFindings(result.blocking);
  assert.equal(output.indexOf("a-rule") < output.indexOf("z-rule"), true);
  assert.doesNotMatch(output, /SENTINEL-SHOULD-NOT-PRINT/);
  assert.match(output, /remediation:/);
});
