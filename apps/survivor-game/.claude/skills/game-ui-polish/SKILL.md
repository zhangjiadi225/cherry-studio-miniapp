---
name: game-ui-polish
description: Beautify and polish the visuals of this Canvas 2D survival game (界面美化) — HUD, minimap, menus, upgrade shop, boss bars, the player/enemies/projectiles, particles, damage numbers, screen flashes, glow, gradients, and "juice" (screen shake, hit flash, scale pop, easing). Use when improving how the game looks or feels, restyling UI, adding visual effects, or matching the established art direction. All drawing lives in renderers/ and effects/.
---

# Game UI Polish & 界面美化 — 暗夜幸存者

Dark neon palette on a near-black bg (`#0a0a1a`), heavy glow, sin/cos pulses, multi-layer radial glows. Everything is hand-drawn Canvas 2D — **no CSS UI, no sprites** (one `hero.png`). Drawing lives in `renderers/`; reusable effects in `effects/`. Match the conventions below or the game looks "off."

## The RenderContext pattern (non-negotiable)
Every draw function takes `rc: RenderContext` first and destructures: `const { ctx, w, h } = rc;` (`w`/`h` are CSS-pixel canvas size). Helpers: `drawXxx(rc, ...)` to paint, `getXxxRect(...)` to return hit/layout regions (so input and drawing agree). Files:
- `renderers/UIRenderer.ts` — HUD, minimap, boss bar, pause/audio buttons, menus, upgrade shop, meta star-chart, codex (~1900 lines, the big one).
- `renderers/EntityRenderer.ts` — player (skin variants `drawWandererPlayer`/`drawEmberPlayer`/`drawOraclePlayer`), 7 enemies, 8 projectiles, gems, garlic aura, pickup range.
- `renderers/EffectsRenderer.ts` — `drawParticle`, `drawDamageNumber`, `drawDamageFlash`, `drawLevelUpFlash`, `drawBossWarning`.
- `renderers/WorldRenderer.ts` — **class** (owns offscreen ground cache): ground grid, zone decorations, obstacles, arena border.

## Colors — always source, never invent
Import from `constants` (which re-exports `data/colors.ts`):
- **`COLORS`** — palette (`bg, playerBody, playerOutline, hpBar, xpBar, uiBg, uiText, uiDim, danger, warning, heal`, per-weapon colors, `elite #ffd700`, `boss`, `levelUp`...).
- **`ZONE_COLORS[zone]`** — `{ line, dot, accent, particle }` for shadow/blood/bone/storm.
- **`ENEMY_DATA[type].color`** for enemies (elite overrides to gold `#ffd700`).
- **`UPGRADE_RARITY_DATA[rarity]`** — `{ color, darkColor, costMultiplier }` for shop card framing (common→legendary). Use these exact hues for rarity.
- Helper `colorWithAlpha(hex, alpha)` to fade a hex to rgba. Only use raw inline hex for one-off accents (branch tints like ranged `#8fe8ff`, area `#9dffba`, damage `#ff9a76`).

## Canvas techniques (the house style)
- **Cache gradients.** Use `cachedLinearGradient()` / `cachedRadialGradient()` (LRU, limit 160) instead of recreating per frame — bars, panels, glows.
- **Glow = `shadowBlur` + `shadowColor`, then RESET** (`ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'`). Typical blur: 8 (damage nums) → 18 (titles) → 22–25 (boss/owned nodes). Forgetting to reset bleeds glow into everything after.
- **Multi-layer glow** for orbs (gems/projectiles/player): outer radial (`r*3`, ~0.25α) → mid (`r*1.5`, ~0.6α) → solid core.
- **`save()`/`restore()` around every transform** (translate→rotate→scale). Use `globalAlpha` for layered fades; `globalCompositeOperation = 'lighter'` for additive energy/modifier layers (reset after).
- **Rounded rects** everywhere: `ctx.roundRect()` radius 6–8 (bars), 10–14 (buttons), 16–18 (panels).
- **Offscreen caching:** `WorldRenderer` redraws the static grid+decor to an offscreen canvas only when the camera moves > ~180px, then `drawImage`s it; dynamic particles draw every frame. Keep new static world art in the cache, not the per-frame path.

## Text
Fonts: `"Segoe UI", sans-serif` default; `"Segoe UI", "PingFang SC", sans-serif` for Chinese menu copy (`DESKTOP_FONT`); monospace for the timer; `serif` for emoji/symbol icons (✦ ◆ ▣). Always set `textAlign`/`textBaseline` explicitly. **Size responsively**, e.g. title `Math.min(86, Math.max(58, w*0.052))`. Wrap long dialog with `ctx.measureText()` (`getWrappedLines()`).

## Layout & responsiveness
- Position/size from `w`/`h` multipliers + `Math.min/max` clamps — never hardcode pixels for menus. Margins like `Math.max(28, Math.min(72, w*0.045))`; panels centered `x = w/2 - panelW/2`.
- HUD anchors: XP bar top-left (pad 16), timer top-center, minimap + pause/audio top-right, weapon icons bottom-left / passive icons bottom-right (~44px slots).
- **DPR-aware:** canvas backing store is `w*dpr × h*dpr` with `ctx.setTransform(dpr,0,0,dpr,0,0)`. Work in CSS px; the transform handles crispness. Don't multiply coords by dpr yourself.

## "Juice" (the feel)
- **Pulse/idle motion:** `Math.sin(timer)` — player bob `sin(animTimer)*2`, gem `1 + sin*0.15`, aura `0.15 + sin(time*3)*0.05`.
- **Hit flash:** enemy renders white when `hitFlash > 0`; full-screen `drawDamageFlash(rc, alpha)` (red radial) on player hit, `drawLevelUpFlash` (gold + sparkles) on level.
- **Invuln blink:** draw only when `sin(invTime*20) > 0`.
- **Scale pop:** damage numbers `scale = 1 + (1-alpha)*0.3`; boss warning `ctx.scale(pulse,pulse)`.
- **Screen shake** lives in the loop/Camera, tuned by `SHAKE_HIT_*` / `SHAKE_BOSS_*` in `constants.ts` (don't shake from renderers).
- **Particle bursts** via `effects/Particle.ts` factories — `spawnHitParticles`, `spawnDeathParticles`, `spawnXPParticles`, `spawnExplosionParticles` (has ring), `spawnTrailParticles`, `spawnLevelUpParticles`. Prefer these over hand-rolling; they handle pooling, glow, and types (`circle|square|star|spark`). Particles drag at `v*=0.96`/frame and fade `alpha = life/maxLife`.

## Workflow
1. Edit the relevant `renderers/*` (or add an `effects/*` asset → draw fn in `EffectsRenderer` → call from `Game.ts`). 2. `pnpm --filter @miniapps/survivor-game dev` and **look at it** — visual work must be eyeballed, not just typechecked. 3. `pnpm --filter @miniapps/survivor-game build` to keep `tsc` green. Adding new entity art? See the `web-game-dev` skill's render-branch steps. New colors belong in `data/colors.ts`, not inline.
