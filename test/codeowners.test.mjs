import assert from "node:assert/strict";
import test from "node:test";
import { auditCodeownersText, formatFindings } from "../scripts/governance/audit-codeowners.mjs";

const repository = {
  name: "example",
  owners: ["otedesco"],
  requiredPaths: [".github/**", "package.json", "src/**"],
};

test("accepts approved ownership for critical paths", () => {
  const codeowners = `
* @otedesco
/.github/** @otedesco
`;
  assert.deepEqual(auditCodeownersText(codeowners, repository), []);
});

test("rejects empty and malformed ownership rules", () => {
  const findings = auditCodeownersText("# no ownership\n", repository);
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["missing-codeowners-rules"],
  );

  const malformed = auditCodeownersText("/.github/**\n", repository);
  assert.deepEqual(
    malformed.map(({ rule }) => rule),
    ["malformed-codeowners-rule", "unowned-critical-path", "unowned-critical-path", "unowned-critical-path"],
  );
});

test("rejects unapproved owners and unowned critical paths", () => {
  const findings = auditCodeownersText("/.github/** @someone-else\n", repository);
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["unapproved-codeowner", "unowned-critical-path", "unowned-critical-path"],
  );
});

test("formats actionable ownership diagnostics", () => {
  const output = formatFindings(auditCodeownersText("/package.json @someone-else\n", repository));
  assert.match(output, /unapproved-codeowner/);
  assert.match(output, /remediation:/);
});
