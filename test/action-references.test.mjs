import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditReferences, parseUses, validateManifest } from "../scripts/audit-action-references.mjs";

const good = (overrides = {}) => ({
  owner: "actions",
  repository: "checkout",
  reference: "a".repeat(40),
  release: "v4.2.2",
  reviewedAt: "2026-09-02",
  purpose: "Check out repository history",
  repositories: ["gh-action-templates"],
  ...overrides,
});

assert.deepEqual(parseUses("  uses: actions/checkout@main # mutable\n# uses: ignored/action@main", "workflow.yml"), [
  { file: "workflow.yml", line: 1, value: "actions/checkout@main" },
]);
assert.match(
  auditReferences(parseUses("uses: actions/checkout@main", "ci.yml"), { references: [good()] }).join("\n"),
  /mutable or malformed ref main/,
);
assert.match(
  auditReferences(parseUses("uses: actions/checkout@abc123", "ci.yml"), { references: [] }).join("\n"),
  /mutable or malformed ref/,
);
assert.match(
  auditReferences(parseUses("uses: actions/checkout@${{ github.sha }}", "ci.yml"), { references: [] }).join("\n"),
  /mutable or malformed ref/,
);
assert.match(
  auditReferences(parseUses("uses: actions/checkout@${{ github.sha }}", "ci.yml"), { references: [] }).join("\n"),
  /mutable or malformed ref/,
);
assert.match(
  auditReferences(parseUses("uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "ci.yml"), {
    references: [],
  }).join("\n"),
  /unreviewed SHA/,
);
assert.match(
  auditReferences(parseUses("uses: ../shared/action", "ci.yml"), { references: [] }).join("\n"),
  /unsafe local action path/,
);
assert.match(auditReferences(parseUses("uses: ./local/action", "ci.yml"), { references: [] }).join("\n"), /^$/);
assert.match(validateManifest({ references: [good(), good()] }).join("\n"), /duplicate manifest entry/);
assert.match(validateManifest({ references: [good({ release: "" })] }).join("\n"), /release metadata is required/);
assert.match(validateManifest({ references: [good({ reference: "ABC" })] }).join("\n"), /40-character lowercase/);

const dependabot = await readFile(new URL("../.github/dependabot.yml", import.meta.url), "utf8");
assert.match(dependabot, /package-ecosystem:\s+github-actions/);
assert.match(dependabot, /interval:\s+weekly/);
assert.doesNotMatch(dependabot, /auto-merge|merge-method|enable: true/);

const root = await mkdtemp(join(tmpdir(), "action-reference-test-"));
try {
  await mkdir(join(root, ".github/workflows"), { recursive: true });
  await mkdir(join(root, "node_modules/pkg/.github/workflows"), { recursive: true });
  await writeFile(
    join(root, ".github/workflows/ci.yaml"),
    "uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n",
  );
  await writeFile(join(root, "node_modules/pkg/.github/workflows/ci.yml"), "uses: actions/checkout@main\n");
  const { discoverReferences } = await import("../scripts/audit-action-references.mjs");
  const refs = await discoverReferences(root);
  assert.deepEqual(
    refs.map(({ file }) => file),
    [".github/workflows/ci.yaml"],
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("action-reference audit contract: mutable refs, manifest metadata, and safe local paths verified");
