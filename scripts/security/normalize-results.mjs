const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

function severity(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (!SEVERITIES.has(normalized)) throw new Error(`unsupported severity: ${value}`);
  return normalized;
}

function finding(tool, rule, level, subject, fingerprint) {
  return {
    tool,
    rule: required(rule, "rule"),
    severity: severity(level),
    subject: required(subject, "subject"),
    fingerprint: required(fingerprint, "fingerprint"),
  };
}

function normalizeSarif(tool, report) {
  if (report.version !== "2.1.0") throw new Error(`unsupported SARIF version: ${report.version ?? "missing"}`);
  if (!Array.isArray(report.runs)) throw new Error("runs is required");
  return report.runs.flatMap((run) => {
    if (!Array.isArray(run.results)) throw new Error("results is required");
    return run.results.map((result) => {
      const rule = result.ruleId;
      const subject = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      const fingerprint = Object.values(result.partialFingerprints ?? {})[0] ?? `${rule}:${subject}`;
      const level = result.properties?.severity ?? (result.level === "error" ? "high" : result.level);
      return finding(tool, rule, level, subject, fingerprint);
    });
  });
}

export function normalizeReport(tool, report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) throw new Error("report must be an object");
  if (tool === "codeql") return normalizeSarif(tool, report);
  if (tool === "dependency-review") {
    if (!Array.isArray(report.dependencies)) throw new Error("dependencies is required");
    return report.dependencies.map((item) =>
      finding(tool, item.advisory, item.severity, item.package, item.fingerprint ?? `${item.advisory}:${item.package}`),
    );
  }
  if (tool === "secret-scan") {
    if (!Array.isArray(report.findings)) throw new Error("findings is required");
    return report.findings.map((item) => finding(tool, item.rule, item.severity, item.path, item.fingerprint));
  }
  if (tool === "license") {
    if (!Array.isArray(report.packages)) throw new Error("packages is required");
    return report.packages.map((item) =>
      finding(tool, item.license, item.severity, item.package, item.fingerprint ?? `${item.license}:${item.package}`),
    );
  }
  if (tool === "workflow-security") {
    if (!Array.isArray(report.findings)) throw new Error("findings is required");
    return report.findings.map((item) => finding(tool, item.rule, item.severity, item.path, item.fingerprint));
  }
  throw new Error(`unsupported scanner: ${tool}`);
}

export function serializeFindings(findings) {
  const sorted = [...findings].sort((left, right) =>
    [left.tool, left.rule, left.subject, left.fingerprint]
      .join("\0")
      .localeCompare([right.tool, right.rule, right.subject, right.fingerprint].join("\0")),
  );
  return `${JSON.stringify(sorted)}\n`;
}
