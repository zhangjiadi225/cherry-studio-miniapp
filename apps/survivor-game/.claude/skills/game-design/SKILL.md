---
name: game-design
description: Design and balance gameplay content for this Vampire-Survivors-style roguelike — weapons, enemies, passives, modifiers, supplies, the difficulty curve, the soul-shard economy, the upgrade shop, XP/level pacing, rarity, boss/elite timing, and meta progression. Use when tuning numbers, adding balanced content, or reasoning about progression and game feel. All balance lives in data tables, not logic.
---

# Game Design & Balance — 暗夜幸存者

Design philosophy: **the game is data-driven — tune `data/*.ts` and `constants.ts`, never gameplay logic.** A 15-minute run (`GAME_DURATION = 15*60`) with a continuous difficulty ramp. After editing tables, run the balance tests (below).

## Where the knobs live
| Domain | File | Key table / constants |
|---|---|---|
| Weapons | `data/weapons.ts` | `WEAPON_DATA` (base stats + `perLevel` growth, `maxLevel` 8) |
| Enemies | `data/enemies.ts` | `ENEMY_DATA` (hp/speed/dmg/radius/`xpValue`/`spawnAfter`) |
| Passives | `data/passives.ts` | `PASSIVE_DATA` (`perLevel`, `maxLevel` 5; some 1) |
| Modifiers | `data/modifiers.ts` | `GENERIC_MODIFIER_DATA` (`priceTier`, `unlockLevel`, `compatibleFamilies`) |
| Supplies | `data/supplies.ts` | `SUPPLY_DATA` |
| Difficulty curve | `data/difficulty.ts` | `DIFFICULTY_TABLE` (time-keyed, interpolated) |
| Economy | `data/economy.ts` | shard reward formula |
| Shop / rarity | `constants.ts` | `SHOP_*`, `UPGRADE_RARITY_DATA` |
| Progression | `constants.ts` | `XP_*`, `GAME_DURATION`, `BOSS_TIMES`, elite/boss mults |
| Zones | `constants.ts` / `data/colors.ts` | `ZONE_BUFFS`, `ZONE_COLORS` |
| Meta | `systems/meta/MetaProgression.ts` | persistent star-chart upgrades |

## Difficulty curve (`data/difficulty.ts`)
`DIFFICULTY_TABLE` is keyed by elapsed seconds (0 → 900) with columns: `interval` (spawn period, falls 1.80s → 0.45s), `hp`/`speed` multipliers, `wave` (enemies/wave), `activeCap` (concurrent enemies, 18 → 300, hard ceiling `MAX_ENEMIES = 800`), `elite` (elite chance, 0.5% → 15%). Values are **linearly interpolated between rows** (`getDifficultyParams(elapsed)`). To retune pacing, edit rows — keep monotonic ramps; don't spike `activeCap` (perf) or `interval` below ~0.4s without testing.

## Economy — soul shards (魂晶)
In-run currency unified into shards. Base reward = enemy `xpValue`; `getExpectedShardReward()` applies `ELITE_XP_MULT ×5`, `BOSS_XP_MULT ×10`, and the player's `curse` multiplier (Curse passive: enemies stronger but drop more). XP gems come in `small/medium/large` (`XP_SMALL/MEDIUM/LARGE`). Level XP curve: `XP_BASE=10 × XP_GROWTH^level` (1.25). When raising an enemy's `xpValue` or `baseHp`, keep the hp-per-shard ratio roughly in line with peers so no enemy becomes a farm.

## Upgrade shop (`constants.ts` SHOP_*)
- `SHOP_OPTION_COUNT` 4, grows to `SHOP_MAX_OPTION_COUNT` 6 (one extra per `SHOP_LEVELS_PER_EXTRA_OPTION`=5 levels).
- Reroll: `SHOP_REROLL_BASE_COST` 10 `+ SHOP_REROLL_COST_STEP` per reroll.
- Type surcharges (`SHOP_*_XP_SURCHARGE`) and option chances (`SHOP_PASSIVE_OPTION_CHANCE` 0.35, `SHOP_FIELD_RATION_OPTION_CHANCE` 0.3) bias what appears.
- **Rarity** (`UPGRADE_RARITY_DATA`): common→legendary with `costMultiplier` 1.0 → 2.05 and the canonical colors. Reuse these colors in UI; don't invent new rarity hues.

## Weapon families (6) — `WeaponFamily` in `types.ts`
`projectile` (magic wand, fire, axe), `swing` (whip), `orbit` (bible), `aura` (garlic), `zone` (holy water), `strike` (lightning). `family` decides which `GENERIC_MODIFIER_DATA.compatibleFamilies` modifiers can attach and how `Weapon.ts` updates it. New weapons must pick an existing family or the engine won't fire/modify them.

## Balancing rules of thumb
- Weapons cap at `maxLevel 8`, passives at `5` (`MAGNET`/`REVIVE` at 1). Spread power across `perLevel` so early levels feel meaningful but late levels aren't mandatory.
- Modifiers: set `unlockLevel` (gates availability) and `priceTier` (1 cheap → 3 expensive) to match impact; on-kill chain/burst effects are tier 3.
- Bosses spawn at `BOSS_TIMES` ([300, 600]); elites scale with `eliteChance`. Tune `ELITE_STAT_MULT` (×3) and `BOSS_HP_MULT` (×5) for difficulty spikes, not raw spawn counts.

## Validate every change
Run the existing balance suites — do not ship tuning without them:
`pnpm --filter @miniapps/survivor-game exec vitest run` (or target `src/game/systems/weapon/WeaponBalance.test.ts`, `src/game/data/economy.test.ts`, `src/game/data/difficulty.test.ts`). Then `pnpm --filter @miniapps/survivor-game dev` to feel the change. See `web-game-dev` skill for adding the code behind new content.
