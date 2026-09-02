import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const fixtureRoot = new URL("../fixtures/workflows/", import.meta.url);
const timeoutMs = 60_000;

function stableEnvironment() {
  const allowed = ["PATH", "HOME", "TMPDIR", "USER", "LANG", "LC_ALL"];
  return Object.fromEntries(allowed.filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
}

export async function runFixture(name, script = "quality:check") {
  const source = new URL(`${name}/`, fixtureRoot);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "workflow-fixture-"));
  const fixturePath = join(temporaryRoot, name);
  await cp(source, fixturePath, { recursive: true });

  const startedAt = Date.now();
  const gates = script === "quality:check" ? ["format", "lint", "type", "test", "coverage", "build"] : [script];
  let exitCode = 0;
  let timedOut = false;
  let stdout = "";
  let stderr = "";

  for (const gate of gates) {
    const child = spawn(process.execPath, ["gate.mjs", gate], {
    cwd: fixturePath,
    env: { ...stableEnvironment(), CI: "true", npm_config_update_notifier: "false" },
    stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 1));
    });
    clearTimeout(timer);
    if (exitCode !== 0 || timedOut) break;
  }

  let evidence = null;
  try {
    evidence = JSON.parse(await readFile(join(fixturePath, ".fixture-result.json"), "utf8"));
  } catch {
    evidence = { gate: null, message: "fixture produced no structured evidence" };
  }

  const result = {
    name,
    script,
    exitCode,
    stdout: stdout.replaceAll(fixturePath, "<fixture>"),
    stderr: stderr.replaceAll(fixturePath, "<fixture>"),
    evidence,
    durationMs: Date.now() - startedAt,
    timedOut,
    fixturePath,
  };
  await rm(temporaryRoot, { recursive: true, force: true });
  return result;
}

export function diagnostic(result) {
  return `${result.evidence?.gate ?? "unknown"}: ${result.evidence?.message ?? "no diagnostic"} ${result.stdout} ${result.stderr}`.replace(/\s+/g, " ").trim();
}
