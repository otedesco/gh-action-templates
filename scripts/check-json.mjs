import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const ignoredDirectories = new Set([".git", "coverage", "dist", "node_modules", "tmp"]);
const jsonFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile() && entry.name.endsWith(".json")) jsonFiles.push(path);
  }
}

await collect(root);
const failures = [];
for (const path of jsonFiles) {
  try {
    JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    failures.push(`${relative(root, path)}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`JSON syntax: ${jsonFiles.length} files checked`);
}
