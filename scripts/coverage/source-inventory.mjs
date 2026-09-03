import { readdir } from "node:fs/promises";
import path from "node:path";

const extensions = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);
const excluded = new Set(["node_modules", "dist", "build", "coverage", ".next", "test", "tests", "__tests__", "interfaces"]);

export async function inventoryExecutableSource(root, { directories = ["src"] } = {}) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !excluded.has(entry.name)) await visit(path.join(directory, entry.name));
      if (!entry.isFile() || !extensions.has(path.extname(entry.name))) continue;
      const absolute = path.join(directory, entry.name);
      result.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  for (const directory of directories) {
    try { await visit(path.resolve(root, directory)); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return result.sort();
}

export function validateSourceCoverage(report, sourceFiles) {
  const missing = sourceFiles.filter((file) => !report.files[file]);
  return missing.map((file) => ({ code: "source-missing-from-report", file, remediation: "Include this executable source file in the coverage report." }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = await inventoryExecutableSource(process.cwd());
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`);
}
