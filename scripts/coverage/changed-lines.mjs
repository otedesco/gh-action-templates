import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

function parseHunks(diff) {
  const result = new Map();
  let current;
  let currentFile;
  for (const line of diff.split("\n")) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match) { current = { line: Number(match[1]), remaining: Number(match[2] ?? 1), file: currentFile }; continue; }
    if (line.startsWith("+++ b/")) { currentFile = line.slice(6); if (current) current.file = currentFile; continue; }
    if (!current || !current.file || line.startsWith("---") || line.startsWith("\\")) continue;
    if (line.startsWith("+")) {
      if (!result.has(current.file)) result.set(current.file, new Set());
      result.get(current.file).add(current.line);
      current.line += 1;
      current.remaining -= 1;
    } else if (!line.startsWith("-")) {
      current.line += 1;
      current.remaining -= 1;
    }
    if (current.remaining <= 0) current = undefined;
  }
  return Object.fromEntries([...result.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, lines]) => [file, [...lines].sort((a, b) => a - b)]));
}

export function parseChangedLines(diff) { return parseHunks(diff); }

export async function changedLines({ cwd = process.cwd(), base, head = "HEAD" } = {}) {
  if (!base || !head) throw new Error("Coverage evaluation requires explicit base and head revisions");
  try {
    await exec("git", ["merge-base", base, head], { cwd });
    const { stdout } = await exec("git", ["diff", "--unified=0", "--find-renames", `${base}...${head}`, "--"], { cwd });
    return parseChangedLines(stdout);
  } catch (error) {
    const wrapped = new Error(`Unable to resolve changed coverage scope: ${error.message}`);
    wrapped.code = "incomplete-git-history";
    throw wrapped;
  }
}
