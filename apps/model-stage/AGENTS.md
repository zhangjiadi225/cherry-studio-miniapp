# 模型布景 workspace rules

- This directory owns one product's UI, prompts, state, assets, manifest, and release configuration.
- Use `@cherry-miniapp/kit` for Cherry host behavior. Do not deep-import or copy foundation source.
- Keep product truth deterministic and local; AI output may enrich but must not define state integrity.
- Persist recoverable state after meaningful changes and pause active work on Cherry visibility changes.
- Shared runtime, packaging, Skill, or specification changes belong in `foundation/` within the monorepo.
