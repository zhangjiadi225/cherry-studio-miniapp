# Epoch Weaver example workspace rules

- This directory owns the Epoch Weaver capability example: game rules, narrative prompts, UI, assets, and manifest. It is not a released product and must not be registered under `apps/` or included in batch app builds and packaging.
- Consume Cherry host behavior through `@cherry-miniapp/kit`; do not call `window.cherry` outside a deliberate host-integration boundary.
- Keep scores, resources, turns, and win/loss state deterministic and local. AI may narrate consequences but must not be the source of game truth.
- Persist a recoverable state document after every meaningful choice and pause active animation or AI work on Cherry visibility changes.
- Shared runtime or packaging gaps belong in `foundation/`; update the public contract and affected dependency range in the same monorepo change.
