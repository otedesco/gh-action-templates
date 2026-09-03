#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
readonly PAYLOAD_FILE="${REPOSITORY_ROOT}/governance/rulesets/PRJ-001-main.json"
readonly RULESET_NAME="PRJ-001 main protection"
readonly OWNER="otedesco"

APPLY=false
REPORT_FILE="/tmp/ops-186-ruleset-verification-$(date -u +%Y%m%dT%H%M%SZ).json"

usage() {
  cat <<'EOF'
Apply and verify the OPS-186 main-branch rulesets.

Usage:
  scripts/governance/apply-and-verify-rulesets.sh [--apply] [--report FILE]

Options:
  --apply         Create missing rulesets. Without this flag, perform preflight only.
  --report FILE   Write sanitized verification evidence to FILE (default: /tmp/...).
  -h, --help      Show this help.

The script never deletes or overwrites a ruleset. If a ruleset with the expected
name already exists, it must match the desired payload exactly or the script stops.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '\n==> %s\n' "$*"
}

while (($# > 0)); do
  case "$1" in
    --apply)
      APPLY=true
      shift
      ;;
    --report)
      (($# >= 2)) || fail '--report requires a value'
      REPORT_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

for command_name in gh jq node pnpm git base64; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "required command not found: ${command_name}"
done

[[ -f "${PAYLOAD_FILE}" ]] || fail "payload not found: ${PAYLOAD_FILE}"
[[ -d "$(dirname -- "${REPORT_FILE}")" ]] || fail "report directory does not exist: $(dirname -- "${REPORT_FILE}")"
[[ -w "$(dirname -- "${REPORT_FILE}")" ]] || fail "report directory is not writable: $(dirname -- "${REPORT_FILE}")"

readonly TEMP_DIRECTORY="$(mktemp -d /tmp/ops-186-rulesets.XXXXXX)"
trap 'rm -rf -- "${TEMP_DIRECTORY}"' EXIT

readonly RENDERED_FILE="${TEMP_DIRECTORY}/rendered.json"
readonly CHECKED_IN_NORMALIZED_FILE="${TEMP_DIRECTORY}/checked-in-normalized.json"
readonly RENDERED_NORMALIZED_FILE="${TEMP_DIRECTORY}/rendered-normalized.json"
readonly NORMALIZE_FILTER="${TEMP_DIRECTORY}/normalize.jq"
readonly REPORT_ENTRIES="${TEMP_DIRECTORY}/report.jsonl"
readonly -a REPOSITORIES=(
  gh-action-templates
  commons
  cache
  server-utils
  notify
  cerberus
  hermes
  web-app
)

cat >"${NORMALIZE_FILTER}" <<'JQ'
{
  name,
  target,
  enforcement,
  bypass_actors: [(.bypass_actors // [])[] | {
    actor_id,
    actor_type,
    bypass_mode
  }] | sort_by(.actor_type, .actor_id, .bypass_mode),
  conditions: {
    ref_name: {
      include: ((.conditions.ref_name.include // []) | sort),
      exclude: ((.conditions.ref_name.exclude // []) | sort)
    }
  },
  rules: [(.rules // [])[] |
    if .type == "pull_request" then {
      type,
      parameters: {
        allowed_merge_methods: ((.parameters.allowed_merge_methods // []) | sort),
        dismiss_stale_reviews_on_push: .parameters.dismiss_stale_reviews_on_push,
        require_code_owner_review: .parameters.require_code_owner_review,
        require_last_push_approval: .parameters.require_last_push_approval,
        required_approving_review_count: .parameters.required_approving_review_count,
        required_review_thread_resolution: .parameters.required_review_thread_resolution
      }
    } elif .type == "required_status_checks" then {
      type,
      parameters: {
        do_not_enforce_on_create: .parameters.do_not_enforce_on_create,
        required_status_checks: [(.parameters.required_status_checks // [])[] | {
          context
        }] | sort_by(.context),
        strict_required_status_checks_policy: .parameters.strict_required_status_checks_policy
      }
    } else {
      type
    } end
  ] | sort_by(.type)
}
JQ

normalize_ruleset() {
  local input_file="$1"
  local output_file="$2"
  jq -S -f "${NORMALIZE_FILTER}" "${input_file}" >"${output_file}"
}

verify_live_ruleset() {
  local repository="$1"
  local desired_file="$2"
  local live_file="$3"
  local desired_normalized="${TEMP_DIRECTORY}/${repository}-desired-normalized.json"
  local live_normalized="${TEMP_DIRECTORY}/${repository}-live-normalized.json"

  normalize_ruleset "${desired_file}" "${desired_normalized}"
  normalize_ruleset "${live_file}" "${live_normalized}"

  if ! diff -u "${desired_normalized}" "${live_normalized}"; then
    fail "live ruleset does not match the desired policy for ${OWNER}/${repository}"
  fi
}

verify_required_contexts() {
  local repository="$1"
  local desired_file="$2"
  local pull_requests_file="${TEMP_DIRECTORY}/${repository}-merged-pulls.json"
  local commits_file="${TEMP_DIRECTORY}/${repository}-candidate-commits.txt"
  local contexts_file="${TEMP_DIRECTORY}/${repository}-successful-contexts.txt"

  gh api \
    "repos/${OWNER}/${repository}/pulls?state=closed&sort=updated&direction=desc&per_page=100" \
    >"${pull_requests_file}"

  jq -r '[.[] | select(.merged_at != null) | .head.sha][0:30][]' \
    "${pull_requests_file}" >"${commits_file}"

  [[ -s "${commits_file}" ]] || fail "no recent merged pull requests found for ${OWNER}/${repository}"

  : >"${contexts_file}"
  while IFS= read -r commit_sha; do
    gh api --paginate \
      -H 'Accept: application/vnd.github+json' \
      "repos/${OWNER}/${repository}/commits/${commit_sha}/check-runs?per_page=100" \
      --jq '.check_runs[] | select(.conclusion == "success") | .name' \
      >>"${contexts_file}"
  done <"${commits_file}"
  sort -u -o "${contexts_file}" "${contexts_file}"

  while IFS= read -r required_context; do
    grep -Fxq -- "${required_context}" "${contexts_file}" || {
      printf 'Successful contexts observed for %s/%s:\n' "${OWNER}" "${repository}" >&2
      sed 's/^/  - /' "${contexts_file}" >&2
      fail "required context has not been observed on a recent merged PR: ${required_context}"
    }
  done < <(
    jq -r '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context' \
      "${desired_file}"
  )
}

verify_remote_main_contracts() {
  local snapshot_root="${TEMP_DIRECTORY}/workspace"
  local tooling_root="${snapshot_root}/gh-action-templates"
  local repository
  local repository_root
  local repository_path

  mkdir -p -- "${tooling_root}/scripts/governance" "${tooling_root}/governance"
  cp -- \
    "${REPOSITORY_ROOT}/scripts/governance/audit-codeowners.mjs" \
    "${REPOSITORY_ROOT}/scripts/governance/inspect-default-branch.mjs" \
    "${REPOSITORY_ROOT}/scripts/governance/validate-rulesets.mjs" \
    "${tooling_root}/scripts/governance/"
  cp -- "${REPOSITORY_ROOT}/governance/repositories.json" "${tooling_root}/governance/"

  for repository in "${REPOSITORIES[@]}"; do
    repository_root="${snapshot_root}/${repository}"
    while IFS= read -r repository_path; do
      mkdir -p -- "${repository_root}/$(dirname -- "${repository_path}")"
      gh api \
        -H 'Accept: application/vnd.github+json' \
        "repos/${OWNER}/${repository}/contents/${repository_path}?ref=main" \
        --jq '.content' \
        | tr -d '\n' \
        | base64 --decode >"${repository_root}/${repository_path}"
    done < <(
      jq -r \
        --arg repository "${repository}" \
        '.repositories[] | select(.name == $repository) | [.codeowners, .workflows[]] | .[]' \
        "${REPOSITORY_ROOT}/governance/repositories.json"
    )
  done

  node "${tooling_root}/scripts/governance/audit-codeowners.mjs" --workspace
  node "${tooling_root}/scripts/governance/inspect-default-branch.mjs" --workspace
}

cd -- "${REPOSITORY_ROOT}"

info 'Checking GitHub authentication'
gh auth status
gh api user --jq '"Authenticated as " + .login'

info 'Running local policy and payload validation'
pnpm test:repository-rulesets
pnpm test:codeowners
pnpm test:required-checks
verify_remote_main_contracts
pnpm test:ruleset-payload
pnpm lint:check
pnpm lint:workflows
git diff --check

node scripts/governance/render-rulesets.mjs >"${RENDERED_FILE}"
jq -S . "${PAYLOAD_FILE}" >"${CHECKED_IN_NORMALIZED_FILE}"
jq -S . "${RENDERED_FILE}" >"${RENDERED_NORMALIZED_FILE}"
diff -u "${CHECKED_IN_NORMALIZED_FILE}" "${RENDERED_NORMALIZED_FILE}"

info 'Checking repository administration access and required check provenance'
for repository in "${REPOSITORIES[@]}"; do
  [[ "$(gh api "repos/${OWNER}/${repository}" --jq '.permissions.admin')" == 'true' ]] || \
    fail "the authenticated identity does not have administration access to ${OWNER}/${repository}"

  desired_file="${TEMP_DIRECTORY}/${repository}-desired.json"
  jq --arg repository "${OWNER}/${repository}" -e \
    '.repositories[] | select(.repository == $repository) | .payload' \
    "${PAYLOAD_FILE}" >"${desired_file}" || \
    fail "no desired payload found for ${OWNER}/${repository}"

  jq -e '
    .name == "PRJ-001 main protection" and
    .target == "branch" and
    .enforcement == "active" and
    (.bypass_actors | length == 0) and
    .conditions.ref_name.include == ["refs/heads/main"] and
    .conditions.ref_name.exclude == [] and
    ([.rules[].type] | sort) == (["deletion", "non_fast_forward", "pull_request", "required_linear_history", "required_status_checks"] | sort)
  ' "${desired_file}" >/dev/null || fail "unsafe or incomplete desired payload for ${OWNER}/${repository}"

  verify_required_contexts "${repository}" "${desired_file}"
  printf '  verified preconditions for %s/%s\n' "${OWNER}" "${repository}"
done

if [[ "${APPLY}" != true ]]; then
  info 'Preflight passed; no GitHub state was changed'
  printf 'Run again with --apply to create and verify the eight rulesets.\n'
  exit 0
fi

info 'Applying and reading back rulesets in the approved rollout order'
: >"${REPORT_ENTRIES}"

for repository in "${REPOSITORIES[@]}"; do
  desired_file="${TEMP_DIRECTORY}/${repository}-desired.json"
  rulesets_file="${TEMP_DIRECTORY}/${repository}-rulesets.json"
  live_file="${TEMP_DIRECTORY}/${repository}-live.json"

  gh api \
    "repos/${OWNER}/${repository}/rulesets?includes_parents=true&per_page=100" \
    >"${rulesets_file}"

  unexpected_count="$(jq --arg name "${RULESET_NAME}" '[.[] | select(.name != $name)] | length' "${rulesets_file}")"
  [[ "${unexpected_count}" == '0' ]] || \
    fail "unexpected repository ruleset layering exists on ${OWNER}/${repository}; review it manually"

  matching_count="$(jq --arg name "${RULESET_NAME}" '[.[] | select(.name == $name)] | length' "${rulesets_file}")"
  [[ "${matching_count}" == '0' || "${matching_count}" == '1' ]] || \
    fail "more than one ruleset named '${RULESET_NAME}' exists on ${OWNER}/${repository}"

  if [[ "${matching_count}" == '1' ]]; then
    ruleset_id="$(jq -r --arg name "${RULESET_NAME}" '.[] | select(.name == $name) | .id' "${rulesets_file}")"
    gh api "repos/${OWNER}/${repository}/rulesets/${ruleset_id}" >"${live_file}"
    verify_live_ruleset "${repository}" "${desired_file}" "${live_file}"
    printf '  existing ruleset %s already matches %s/%s\n' "${ruleset_id}" "${OWNER}" "${repository}"
  else
    gh api --method POST \
      -H 'Accept: application/vnd.github+json' \
      "repos/${OWNER}/${repository}/rulesets" \
      --input "${desired_file}" >"${live_file}"
    ruleset_id="$(jq -r '.id' "${live_file}")"
    [[ "${ruleset_id}" =~ ^[0-9]+$ ]] || fail "GitHub did not return a valid ruleset ID for ${OWNER}/${repository}"

    gh api "repos/${OWNER}/${repository}/rulesets/${ruleset_id}" >"${live_file}"
    verify_live_ruleset "${repository}" "${desired_file}" "${live_file}"
    printf '  created and verified ruleset %s on %s/%s\n' "${ruleset_id}" "${OWNER}" "${repository}"
  fi

  protected="$(gh api "repos/${OWNER}/${repository}/branches/main" --jq '.protected')"
  [[ "${protected}" == 'true' ]] || fail "GitHub does not report ${OWNER}/${repository}:main as protected after rollout"

  main_commit="$(gh api "repos/${OWNER}/${repository}/git/ref/heads/main" --jq '.object.sha')"
  jq -cn \
    --arg repository "${OWNER}/${repository}" \
    --argjson ruleset_id "${ruleset_id}" \
    --arg main_commit "${main_commit}" \
    --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg source_url "https://api.github.com/repos/${OWNER}/${repository}/rulesets/${ruleset_id}" \
    '{
      repository: $repository,
      branch: "main",
      protected: true,
      ruleset: {
        id: $ruleset_id,
        name: "PRJ-001 main protection",
        enforcement: "active",
        sourceUrl: $source_url
      },
      mainCommit: $main_commit,
      requiredContextsObservedOnRecentMergedPullRequests: true,
      capturedAt: $captured_at
    }' >>"${REPORT_ENTRIES}"
done

jq -s \
  --arg issue 'OPS-186' \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{issue: $issue, generatedAt: $generated_at, repositories: .}' \
  "${REPORT_ENTRIES}" >"${REPORT_FILE}"

info 'All eight live rulesets match the desired policy'
printf 'Sanitized verification report: %s\n' "${REPORT_FILE}"
printf '%s\n' 'Remaining completion evidence: controlled positive/negative PR tests and independent GitHub Codex app read-back.'
