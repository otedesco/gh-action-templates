# OPS-182 Immutable Reference Rollout

Reviewed date: 2026-09-02

The central workflow release is commit `b0bd33051b7b5b8ebe0a8f5a1c588ea0d466ed2d` from `gh-action-templates`. It pins all central third-party actions and is the single immutable target used by product consumers.

| Repository | Rollout commit | Workflows | Validation |
| --- | --- | --- | --- |
| `commons` | `366cccb47aeb729d80a18b125a02be5a7d9d5e83` | quality, package release | Pin diff committed; no repository workflow-contract test exists |
| `cache` | `4ca86d03a1dc558106c3ae43b31803d1c8b0c459` | quality, package release | Pin diff committed; no repository workflow-contract test exists |
| `server-utils` | `333add7f92a05db01e10a377903bac06a4881368` | quality, package release | Pin diff committed; no repository workflow-contract test exists |
| `notify` | `42d1d51dad8de3269ca02ace915867521fe04716` | quality, package release | Pin diff committed; no repository workflow-contract test exists |
| `cerberus` | `66350e5da24e31a3e4a928d889f7413bb253ebcf` | quality, Docker release, package release | Pin diff committed; no repository workflow-contract test exists |
| `hermes` | `98659478a9bac73d0341938a10c1f0bc1cd5c963` | quality, Docker release, package release | Pin diff committed; no repository workflow-contract test exists |
| `web-app` | N/A | No adoption workflow present | No rollout required |

Central validation:

- `node scripts/audit-action-references.mjs` — 38 references audited, zero violations.
- `node --test test/action-references.test.mjs` — passed.
- No pull requests were created by this local rollout; the commit hashes above are the handoff points for the separately opened consumer PRs.
