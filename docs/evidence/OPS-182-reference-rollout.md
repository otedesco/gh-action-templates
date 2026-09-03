# OPS-182 Immutable Reference Rollout

Reviewed date: 2026-09-02

Hermes uses the original immutable workflow release `b0bd33051b7b5b8ebe0a8f5a1c588ea0d466ed2d`. The five still-open consumer PRs use follow-up workflow commit `9282fc2387d782afa7d461afbd51c89a1918abdb`, which includes the compatibility fixes and pins its composite actions to implementation commit `fde909e293173d95848d993528821a315e3b2059`.

| Repository | Rollout commit | Workflows | Validation |
| --- | --- | --- | --- |
| `commons` | `d513051606b7d5813663767029f7acc766a6ae1a` | quality, package release | Local gate and hosted run `33708541437` passed |
| `cache` | `29a84cdcd8f9d0efdd672cd03bba5ff96eadc5b9` | quality, package release | Local gate and hosted run `33708541607` passed |
| `server-utils` | `36a0fe58459b747e195b64ef4f171b2e15a6a425` | quality, package release | Local gate and hosted run `33708541295` passed |
| `notify` | `adbf1fb935b36c6e7570bbf5f85ce135e0c356a6` | quality, package release | Local gate and hosted run `33708540767` passed |
| `cerberus` | `cc1ad861fba0d6bbb90d431c084929e6bc20c59c` | quality, Docker release, package release | Local gate and hosted run `33708541222` passed |
| `hermes` | `98659478a9bac73d0341938a10c1f0bc1cd5c963` | quality, Docker release, package release | Pin diff committed; no repository workflow-contract test exists |
| `web-app` | N/A | No adoption workflow present | No rollout required |

Central validation:

- `node scripts/audit-action-references.mjs` — 38 references audited, zero violations.
- `node --test test/action-references.test.mjs` — passed.
- No pull requests were created by this local rollout; the commit hashes above are the handoff points for the separately opened consumer PRs.
