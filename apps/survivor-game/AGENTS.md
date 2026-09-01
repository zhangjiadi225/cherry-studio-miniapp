# Repository instructions

## Read first

- Read `ARCHITECTURE.md` and `docs/README.md` before changing gameplay, platform integration, AI workflows, persistence, or packaging.
- `ARCHITECTURE.md` describes the current implementation. `docs/architecture/TARGET_ARCHITECTURE.md` describes the intended direction. Do not present target modules as already implemented.

## Product boundaries

- This workspace area owns the Night Survivor product: gameplay, product UI, product prompts, packaged assets, manifest, and release configuration.
- Shared Cherry host adapters, packaging behavior, and cross-product contracts belong in the monorepo's `foundation/` workspace. Consume them through public package entry points; do not copy their source into this app.
- Production is a Cherry Studio local MiniApp. A normal browser is only a development environment and must use an explicit development mock.

## Game and AI rules

- Scores, combat, inventory, drops, progression, difficulty, resource costs, and win/loss state must remain deterministic local code.
- AI may propose content, narrative, visual recipes, and bounded behavior graphs. AI output is untrusted until it passes structural, reference, balance, and performance validation and the player accepts it.
- Never execute generated JavaScript, use `eval`/`Function`, or dynamically import AI- or user-provided code.
- Runtime-generated content must be declarative `ContentPack` data that composes registered engine primitives.
- Weapon and projectile generation must use declarative `WeaponRecipe` data. Treat colors, sizes, speeds, and counts as bounded parameters; register targeting, emission, motion, collision, hit, lifecycle, modifier, and render rules as trusted primitives.
- Do not call AI from the frame update loop. Generate only at an explicit forge, checkpoint, pause, or between-run boundary.

## Architecture rules

- Preserve functional entity modules and data-driven balance.
- New reusable behaviors register against stable behavior IDs. Avoid adding new dispatch branches keyed directly to individual content IDs when a behavior registry can own the variation.
- Resolve recipes and modifier stacks into immutable runtime plans outside the frame loop; hot paths must not parse ContentPack JSON or perform string registry lookups.
- Cross-system notifications use the typed event bus. State mutation remains owned by the relevant system or deterministic game kernel.
- Keep hot-path entities pooled, use spatial queries for neighborhood searches, and enforce projectile/enemy/spawn caps for generated content.
- Migrate incrementally. Registry adoption must preserve existing gameplay before AI-generated content is enabled.

## Cherry rules

- Access Cherry capabilities through `@cherry-miniapp/kit`; direct `window.cherry` access is limited to the shared runtime package or a deliberate compatibility probe.
- Treat the page as an opaque-origin sandbox and use packaged assets only.
- Persist one versioned, recoverable state document after meaningful changes. Pause animation/audio/timers and cancel active AI work on `app.visibilityChange`.
- Request only required permissions. Network and file capabilities require a product use case and a spec update before adoption.
- Build `dist/` first and use the shared `cherry-miniapp` CLI for validation and packaging. Do not maintain a second archive format.

## Specifications

- Content schema and trust model: `docs/specs/CONTENT_PACK.md`
- Weapon/projectile composition and modifier compilation: `docs/specs/WEAPON_RECIPE.md`
- AI generation lifecycle: `docs/specs/AI_GENERATION.md`
- Cherry runtime, permissions, persistence, and packaging: `docs/specs/CHERRY_RUNTIME.md`

Update the relevant specification before or together with a contract-changing implementation.
