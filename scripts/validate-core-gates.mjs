import { readFile } from "node:fs/promises";

export const CORE_GATE_NAMES = ["format", "lint", "type", "unit", "coverage", "build"];
export const CORE_GATE_COMMANDS = {
  format: "format:check",
  lint: "lint:check",
  type: "type:check",
  unit: "test",
  coverage: "test:coverage",
  build: "build",
};

const forbidden =
  /(?:--fix|--write|--passWithNoTests|--forceExit|continue-on-error|\|\|\s*true|(^|\s)(?:true|:)(?:\s|$))/i;

function error(gate, rule, remediation, repository = "central") {
  return { gate, repository, rule, remediation };
}

export function validateCoreGates(policy, { repository = "central" } = {}) {
  const errors = [];
  if (!policy || typeof policy !== "object" || !Array.isArray(policy.gates)) {
    return [error("manifest", "gates must be an array", "Provide exactly the six core gate definitions.", repository)];
  }

  const seen = new Set();
  for (const gate of policy.gates) {
    const name = gate?.name ?? "unknown";
    if (seen.has(name))
      errors.push(error(name, "duplicate gate name", "Give each core gate a unique stable name.", repository));
    seen.add(name);
    if (!CORE_GATE_NAMES.includes(name))
      errors.push(error(name, "unsupported gate name", `Use one of: ${CORE_GATE_NAMES.join(", ")}.`, repository));
    if (gate?.command !== CORE_GATE_COMMANDS[name]) {
      errors.push(
        error(
          name,
          "non-canonical command",
          `Use ${CORE_GATE_COMMANDS[name] ?? "the canonical core command"}.`,
          repository,
        ),
      );
    }
    if (typeof gate?.check !== "string" || !gate.check.trim())
      errors.push(error(name, "missing stable check name", "Declare a non-empty workflow check name.", repository));
    if (!Array.isArray(gate?.failureConditions) || gate.failureConditions.length === 0)
      errors.push(
        error(name, "missing failure conditions", "List every condition that must fail this gate.", repository),
      );
    if (!Array.isArray(gate?.evidence?.paths))
      errors.push(
        error(
          name,
          "missing evidence paths",
          "Declare report or artifact paths, or use an explicit empty paths array.",
          repository,
        ),
      );
    if (!Array.isArray(gate?.exceptions))
      errors.push(
        error(name, "invalid exception policy", "Use an array of explicit, reviewable exceptions.", repository),
      );
    if (typeof gate?.command === "string" && forbidden.test(gate.command))
      errors.push(
        error(
          name,
          "unsupported escape flag or ignored failure",
          "Use a check-only command that propagates failures.",
          repository,
        ),
      );
    if (
      gate?.exceptions?.some(
        (exception) => typeof exception !== "object" || !exception.issue || !exception.owner || !exception.expiresAt,
      )
    ) {
      errors.push(
        error(name, "incomplete exception", "Every exception needs an issue, owner, and expiry.", repository),
      );
    }
  }

  const missing = CORE_GATE_NAMES.filter((name) => !seen.has(name));
  if (missing.length)
    errors.push(
      error("manifest", `missing gates: ${missing.join(", ")}`, "Declare all six core gates exactly once.", repository),
    );
  if (policy.gates.length !== CORE_GATE_NAMES.length)
    errors.push(
      error(
        "manifest",
        "core gate count must be six",
        "Remove non-core entries and duplicate definitions.",
        repository,
      ),
    );
  return errors;
}

export async function validateCoreGatesFile(path, options) {
  return validateCoreGates(JSON.parse(await readFile(path, "utf8")), options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] ?? new URL("../quality-gates/core-gates.json", import.meta.url);
  try {
    const errors = await validateCoreGatesFile(path, { repository: process.argv[3] ?? "central" });
    if (errors.length) {
      console.error(JSON.stringify({ valid: false, errors }, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ valid: true }));
    }
  } catch (cause) {
    console.error(
      JSON.stringify(
        { valid: false, errors: [error("manifest", cause.message, "Provide valid JSON policy input.")] },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}
