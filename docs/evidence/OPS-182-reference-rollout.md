# OPS-182 Immutable Reference Rollout

Reviewed date: 2026-09-02

Hermes uses the original immutable workflow release `b0bd33051b7b5b8ebe0a8f5a1c588ea0d466ed2d`. The five still-open consumer PRs use follow-up workflow commit `9282fc2387d782afa7d461afbd51c89a1918abdb`, which includes the compatibility fixes and pins its composite actions to implementation commit `fde909e293173d95848d993528821a315e3b2059`.

| Repository | Rollout commit | Workflows | Validation |
| --- | --- | --- | --- |
| `commons` | `5d094e0e52ad750ee2eecae17e8449fa05f9074f` | quality, package release | Local gate and hosted run `33709173437` passed |
| `cache` | `df68bb965cb1f21a8a7b1fbba6a3bb20f1d6e3fa` | quality, package release | Local gate and hosted run `33709173519` passed |
| `server-utils` | `ed4f014e4361c3e9ad9b2402490b4c929b10f801` | quality, package release | Local gate and hosted run `33709173779` passed |
| `notify` | `84ece537b3d430fa2c03cd5ae82d7b908fa6264d` | quality, package release | Local gate and hosted run `33709173449` passed |
| `cerberus` | `b6d6c5bfc8e9000f6763483b4b6e95559dcfb9e5` | quality, Docker release, package release | Local gate and hosted run `33709173406` passed |
| `hermes` | `98659478a9bac73d0341938a10c1f0bc1cd5c963` | quality, Docker release, package release | Pin diff committed; no repository workflow-contract test exists |
| `web-app` | N/A | No adoption workflow present | No rollout required |

Central validation:

- `node scripts/audit-action-references.mjs` — 38 references audited, zero violations.
- `node --test test/action-references.test.mjs` — passed.
- No pull requests were created by this local rollout; the commit hashes above are the handoff points for the separately opened consumer PRs.
