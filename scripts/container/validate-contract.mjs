const REQUIRED_RULES = new Set([
  "base-image",
  "frozen-install",
  "secret-mount",
  "secret-persistence",
  "non-root-user",
  "healthcheck",
]);

function finding(rule, actual, expected) {
  return { rule, actual, expected, remediation: `satisfy the ${rule} container contract` };
}

function policyValue(policy, key, fallback) {
  return policy && Object.hasOwn(policy, key) ? policy[key] : fallback;
}

export function validateDockerfile(dockerfile, policy) {
  if (typeof dockerfile !== "string") throw new TypeError("dockerfile must be a string");
  const baseImage = policyValue(policy, "baseImage", "node:24.20.0-alpine");
  const acceptedUsers = new Set(policyValue(policy, "acceptedUsers", ["node"]));
  const requiredSecret = policyValue(policy, "requiredSecret", "npm_token");
  const requiredInstall = policyValue(policy, "requiredInstall", "pnpm install --frozen-lockfile");
  const lines = dockerfile.split(/\r?\n/).map((line) => line.trim());
  const findings = [];

  const stages = new Set();
  for (const line of lines.filter((candidate) => /^FROM\s+/i.test(candidate))) {
    const match = line.match(/^FROM\s+([^\s]+)(?:\s+AS\s+([^\s]+))?/i);
    const image = match?.[1] ?? "";
    if (image !== baseImage && !stages.has(image)) findings.push(finding("base-image", image, baseImage));
    if (match?.[2]) stages.add(match[2]);
  }
  if (!lines.some((line) => line.includes(requiredInstall)))
    findings.push(finding("frozen-install", "missing", requiredInstall));
  const secretMount = `--mount=type=secret,id=${requiredSecret},required=true`;
  if (!lines.some((line) => line.includes(secretMount))) findings.push(finding("secret-mount", "missing", secretMount));
  if (lines.some((line) => /^(ARG|ENV)\s+.*NPM_TOKEN/i.test(line)))
    findings.push(finding("secret-persistence", "NPM_TOKEN in ARG/ENV", "secret mount only"));

  const userLines = lines.filter((line) => /^USER\s+/i.test(line));
  const finalUser = userLines.at(-1)?.match(/^USER\s+([^\s]+)/i)?.[1];
  if (!finalUser || !acceptedUsers.has(finalUser))
    findings.push(finding("non-root-user", finalUser ?? "missing", [...acceptedUsers].join(" or ")));
  if (!lines.some((line) => /^HEALTHCHECK\s+/i.test(line)))
    findings.push(finding("healthcheck", "missing", "HEALTHCHECK"));

  return findings.filter(({ rule }) => REQUIRED_RULES.has(rule));
}
