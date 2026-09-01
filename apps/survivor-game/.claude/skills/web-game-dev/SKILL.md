---
name: web-game-dev
description: Build and extend features in this Vampire-Survivors-style HTML5 Canvas game (TypeScript + Vite, no framework). Use when adding or modifying weapons, enemies, passives, modifiers, map zones, systems, effects, the game loop, state machine, events, object pooling, or collision — anything touching gameplay code under src/game/. Teaches the project's layered architecture and extension recipes so new code matches existing patterns.
---

# Web Game Dev — 暗夜幸存者 engine

A 2D survival roguelike (类吸血鬼幸存者) in **pure TypeScript + Canvas 2D — no game framework**. Build: Vite. Tests: Vitest. PM: pnpm. Deploy: Vercel. Read `ARCHITECTURE.md` first; it is the source of truth for layout and extension steps.

## Commands
- `pnpm dev` — Vite dev server (play-test in browser).
- `pnpm exec vitest run` — single test pass. ⚠️ `pnpm test` is **watch mode** (won't exit); never use it in automation.
- `pnpm exec vitest run path/to/File.test.ts` — one suite.
- `pnpm build` — `tsc && vite build` (typecheck gate + bundle). Run before declaring done.

## Layered architecture (top → bottom)
1. **`main.ts`** — entry. **`Game.ts`** — orchestrator: state machine, game loop, input routing, system coordination. The only "fat" file by design.
2. **`renderers/`** — pure drawing, no game state (except `WorldRenderer` which owns offscreen caches). `Renderer.ts` is a thin proxy forwarding to sub-renderers.
3. **`systems/`** — one self-contained system per subdirectory (`player/ enemy/ weapon/ camera/ input/ map/ combat/ upgrade/ meta/ audio/`). Each owns one concern; add a weapon → touch only `weapon/`.
4. **`effects/`** — system-agnostic composable assets: `Particle.ts` (7 factory functions), `DamageNumber.ts`.
5. **`events/`** — `EventBus.ts`, `GameEvents.ts`, `GameStateMachine.ts` decouple systems.
6. **`data/` + `constants.ts` + `types.ts`** — base layer. `constants.ts` re-exports all `data/*` tables.

## Core conventions (match these)
- **Functional entity modules, not classes.** Systems export functions like `createEnemy()`, `updateWeapon()`, `damagePlayer()` operating on plain data interfaces from `types.ts`. Reserve `class` for things that own state/caches (e.g. `WorldRenderer`, `ObjectPool`). Reason: testability + composition.
- **Data-driven.** Behavior reads from tables (`WEAPON_DATA`, `ENEMY_DATA`, `PASSIVE_DATA`, `GENERIC_MODIFIER_DATA`...). Balance changes touch `data/`, never logic. See the `game-design` skill.
- **Enums as `const` objects** + `typeof[keyof]` union (see `WeaponType`, `EnemyType` in `types.ts`), not TS `enum`.
- **Object pooling for hot entities.** Particles, projectiles, damage numbers, XP gems go through `utils/PoolManager.ts` (`pools.particles.acquire()`); never `new` them in the loop. Release dead ones (see `Game.ts` `releaseDead*` methods).
- **`compactArray` over `splice`** for removing dead entities in bulk (O(n) vs O(n²)) — `utils/math.ts`.
- **`SpatialGrid` (`utils/SpatialGrid.ts`) + `utils/collision.ts`** for neighbor queries; don't write O(n²) enemy scans.
- Naming: draw helpers `drawXxx`, fire logic `fireXxx`, particle spawners `spawnXxx`, stat recompute `recalcStats`.

## Game loop & state
- `Game.loop(time)` → `update(dt)` (fixed-ish dt) → `render()`. Update mutates state; render is read-only.
- States (`GameState` in `types.ts`): `menu | playing | paused | upgrading | gameover`, transitions in `GameStateMachine.ts` / `events/`. See the state diagram in `ARCHITECTURE.md §5`.
- Cross-system signals go through the **EventBus** (`emit`/`on` from `events/`), not direct calls, when they cross a system boundary.

## Extension recipes (from ARCHITECTURE.md §6 — follow exactly)
**New weapon:** `types.ts` `WeaponType` → `data/weapons.ts` `WEAPON_DATA` (with `family` + `perLevel`) → `systems/weapon/Weapon.ts` `fireXxx()` + add to `updateWeapon()` switch → `renderers/EntityRenderer.ts` `drawProjectile()` branch. Add `*.test.ts` for balance.
**New enemy:** `types.ts` `EnemyType` → `data/enemies.ts` `ENEMY_DATA` (set `spawnAfter` for auto-unlock) → `EntityRenderer.ts` `drawEnemy()`. `Spawner.ts` picks it up automatically.
**New passive:** `types.ts` `PassiveType` → `data/passives.ts` `PASSIVE_DATA` → `systems/player/Player.ts` `recalcStats()`.
**New weapon modifier:** `types.ts` `GenericModifierType` + add bit to `GENERIC_MODIFIER_MASK` → `data/modifiers.ts` (set `compatibleFamilies`, `trigger`, `effect`, `visual`) → apply effect in `systems/weapon/` + `systems/combat/ProjectileCombat.ts`.
**New effect asset:** new file in `effects/` → draw fn in `renderers/EffectsRenderer.ts` → call from `Game.ts`/system.
**New map zone:** `types.ts` `MapZone` → `data/colors.ts` `ZONE_COLORS` + `constants.ts` `ZONE_BUFFS` → `utils/math.ts` `getZone()` → `Player.ts` `recalcStats()` zone buff.

## Definition of done
1. `pnpm build` passes (it includes `tsc`). 2. `pnpm exec vitest run` green. 3. New gameplay numbers live in `data/`, not hardcoded in logic. 4. New entities respect pooling + `compactArray`. 5. Play-test via `pnpm dev` for anything visual or feel-related.
