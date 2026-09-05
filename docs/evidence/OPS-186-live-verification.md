# OPS-186 Live Ruleset Verification

**Captured:** 2026-09-04  
**Source:** GitHub Codex app read-back of repository rulesets, default-branch refs, merged verification pull requests, and check runs.

## Result

Both ruleset layers are active on `refs/heads/main` in all eight repositories:

- `PRJ-001 main protection`: strict required checks, linear history, force-push denial, and deletion denial; no bypass actors.
- `PRJ-001 review protection`: pull-request-only review and CODEOWNERS requirements; the exact `otedesco` user is the sole named `pull_request` bypass because the current maintainer is also the only CODEOWNER.

The required contexts below were observed successful on each controlled verification PR head commit.

| Repository | Main commit | Ruleset IDs | Verification PR | Observed required checks |
|---|---|---:|---|---|
| [gh-action-templates](https://github.com/otedesco/gh-action-templates) | `4fbf9f8` | 22221046 / 22223814 | [#35](https://github.com/otedesco/gh-action-templates/pull/35) | [Quality / core](https://github.com/otedesco/gh-action-templates/actions/runs/33802725845/job/100805958468), [Security / aggregate](https://github.com/otedesco/gh-action-templates/actions/runs/33802725844/job/100806307246) |
| [commons](https://github.com/otedesco/commons) | `f24c5e6` | 22221050 / 22223823 | [#22](https://github.com/otedesco/commons/pull/22) | [Quality / core](https://github.com/otedesco/commons/actions/runs/33800102969/job/100797459441), [Security / aggregate / Security / aggregate](https://github.com/otedesco/commons/actions/runs/33800102969/job/100797761372) |
| [cache](https://github.com/otedesco/cache) | `0dd9019` | 22221054 / 22223826 | [#26](https://github.com/otedesco/cache/pull/26) | [Quality / core](https://github.com/otedesco/cache/actions/runs/33800104593/job/100797436257), [Security / aggregate / Security / aggregate](https://github.com/otedesco/cache/actions/runs/33800104593/job/100797730863) |
| [server-utils](https://github.com/otedesco/server-utils) | `80e1bc5` | 22221059 / 22223830 | [#17](https://github.com/otedesco/server-utils/pull/17) | [Quality / core](https://github.com/otedesco/server-utils/actions/runs/33800106710/job/100797622433), [Security / aggregate / Security / aggregate](https://github.com/otedesco/server-utils/actions/runs/33800106710/job/100797806501) |
| [notify](https://github.com/otedesco/notify) | `257c09b` | 22221061 / 22223840 | [#22](https://github.com/otedesco/notify/pull/22) | [Quality / core](https://github.com/otedesco/notify/actions/runs/33800118851/job/100797842653), [Security / aggregate / Security / aggregate](https://github.com/otedesco/notify/actions/runs/33800118851/job/100797910834) |
| [cerberus](https://github.com/otedesco/cerberus) | `3c37788` | 22221068 / 22223851 | [#55](https://github.com/otedesco/cerberus/pull/55) | [Quality / core](https://github.com/otedesco/cerberus/actions/runs/33800113702/job/100797568993), [Security / aggregate / Security / aggregate](https://github.com/otedesco/cerberus/actions/runs/33800113702/job/100797852795) |
| [hermes](https://github.com/otedesco/hermes) | `c42dac7` | 22221071 / 22223864 | [#23](https://github.com/otedesco/hermes/pull/23) | [Quality / core](https://github.com/otedesco/hermes/actions/runs/33800116338/job/100797532710), [Security / aggregate / Security / aggregate](https://github.com/otedesco/hermes/actions/runs/33800116338/job/100797979687) |
| [web-app](https://github.com/otedesco/web-app) | `62017f8` | 22221077 / 22223874 | [#9](https://github.com/otedesco/web-app/pull/9) | [Security / aggregate / Security / aggregate](https://github.com/otedesco/web-app/actions/runs/33800110129/job/100797896960) |

## Verification interpretation

The eight verification PRs were harmless documentation-only changes and all merged into their repository `main`. Their successful required contexts and final merge commits establish the normal pull-request path.

The active ruleset read-back establishes the negative policy for missing review, unresolved conversations, stale reviews, missing or failed required checks, force pushes, and branch deletion. Direct push, force-push, deletion, and intentionally failing-check attempts were not performed because they would create destructive or noisy external state. No independent non-bypass reviewer was available; the sole-maintainer exception is restricted to the review layer and `pull_request` mode, leaving required checks and history protection without bypass actors.

The GitHub Codex app can read the rulesets and branch refs but cannot read the separate branch-protection endpoint in this connection because GitHub returns HTTP 403. Repository rulesets are the authoritative protection mechanism used for this rollout.

## Validation

- `pnpm test:repository-rulesets`
- `pnpm test:codeowners`
- `pnpm test:required-checks`
- `pnpm test:ruleset-payload`
- `git diff --check`
- GitHub Codex app read-back of all 16 rulesets, eight `main` refs, eight verification PRs, and required check runs

