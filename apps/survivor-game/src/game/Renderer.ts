import type {
  Player,
  Enemy,
  Projectile,
  XPGem,
  Particle,
  DamageNumber,
  Camera,
  UpgradeOption,
  SellableCard,
  MapObstacle,
  TouchJoystickState,
  EnemyProjectile,
  PerformanceStats,
  WeaponEvolutionId,
  WeaponType,
} from './types';
import type { CodexTab, DesktopTab, MetaState, MetaUpgradeNode } from './systems/meta/MetaProgression';
import type { RunDifficultyId } from './data/runDifficulties';
import { COLORS } from './constants';
import { WorldRenderer, type RenderContext } from './renderers/WorldRenderer';
import {
  drawPlayer, drawEnemy, drawProjectile, drawEnemyProjectile, drawGarlicAura,
  drawPickupRange, drawXPGem,
} from './renderers/EntityRenderer';
import { spriteRegistry } from './renderers/SpriteRegistry';
import { playerSpriteRegistry } from './renderers/PlayerSpriteRegistry';
import { drawParticle, drawDamageNumber, drawDamageFlash, drawLevelUpFlash, drawBossWarning } from './renderers/EffectsRenderer';
import {
  drawUI, drawMinimap, drawBossBar, drawVirtualJoystick,
  drawAudioButton as drawAudioBtn, drawPauseButton as drawPauseBtn,
  getAudioButtonRect as getAudioRect,
  getDesktopStartButtonRect as getStartButtonRect,
  getBattleSetupBackButtonRect as getBattleSetupBackRect,
  getStartingWeaponCardRects as getStartingWeaponRects,
  type StartingWeaponView,
  getMetaStarNodeRects as getStarNodeRects,
  getSkinCardRects as getSkinRects,
  getCodexTabRects as getCodexRects,
  getRunDifficultyCardRects as getDifficultyRects,
  getGameOverButtonRects as getGameOverRects,
  getDesktopTabRects as getTabRects,
  getPauseButtonRect as getPauseRect,
  drawDesktop, drawPaused, drawUpgradeScreen, drawGameOver, drawPerformanceOverlay,
} from './renderers/UIRenderer';

/**
 * Renderer：总入口，持有 Canvas 上下文和子渲染器
 * 所有绘制逻辑委托给 renderers/ 下的子模块
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private worldRenderer = new WorldRenderer();
  private rc: RenderContext;
  private readonly handleResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.rc = { ctx: this.ctx, w: 0, h: 0 };
    this.resize();
    spriteRegistry.preloadEnemies();
    playerSpriteRegistry.preload();
    window.addEventListener('resize', this.handleResize);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rc.w = this.w;
    this.rc.h = this.h;
  }

  getWidth() { return this.w; }
  getHeight() { return this.h; }

  beginFrame(timeSeconds: number) {
    spriteRegistry.beginFrame(timeSeconds);
  }

  clear() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  beginWorld(cam: Camera) {
    this.ctx.save();
    this.ctx.translate(
      this.w / 2 - cam.x - cam.shakeX,
      this.h / 2 - cam.y - cam.shakeY
    );
  }

  endWorld() {
    this.ctx.restore();
  }

  /** 判断世界坐标是否在当前视口内（含 margin） */
  isOnScreen(wx: number, wy: number, cam: Camera, margin: number = 80): boolean {
    const dx = Math.abs(wx - cam.x);
    const dy = Math.abs(wy - cam.y);
    return dx < this.w / 2 + margin && dy < this.h / 2 + margin;
  }

  getPauseButtonRect() { return getPauseRect(this.w); }
  getAudioButtonRect() { return getAudioRect(this.w); }
  getDesktopStartButtonRect() { return getStartButtonRect(this.w, this.h); }
  getBattleSetupBackButtonRect() { return getBattleSetupBackRect(this.w, this.h); }
  getStartingWeaponCardRects(
    weapons: readonly StartingWeaponView[]
  ): Array<{ x: number; y: number; w: number; h: number; definitionId: string }> {
    return getStartingWeaponRects(this.w, this.h, weapons);
  }
  getDesktopTabRects() { return getTabRects(this.w, this.h); }
  getMetaStarNodeRects() { return getStarNodeRects(this.w, this.h); }
  getSkinCardRects() { return getSkinRects(this.w, this.h); }
  getCodexTabRects() { return getCodexRects(this.w, this.h); }
  getRunDifficultyCardRects(): Array<{ x: number; y: number; w: number; h: number; id: RunDifficultyId }> {
    return getDifficultyRects(this.w, this.h);
  }
  getGameOverButtonRects(showEndless = false) { return getGameOverRects(this.w, this.h, showEndless); }

  // ─── World ───
  drawGround(cam: Camera) { this.worldRenderer.drawGround(this.rc, cam); }
  drawObstacles(obstacles: MapObstacle[]) { this.worldRenderer.drawObstacles(this.rc, obstacles); }
  drawArenaBounds(cam: Camera) { this.worldRenderer.drawArenaBounds(this.rc, cam); }

  // ─── Entities ───
  drawPlayer(p: Player) { drawPlayer(this.rc, p); }
  drawEnemy(e: Enemy) { drawEnemy(this.rc, e); }
  drawProjectile(p: Projectile) { drawProjectile(this.rc, p); }
  drawEnemyProjectile(p: EnemyProjectile) { drawEnemyProjectile(this.rc, p); }
  drawXPGem(gem: XPGem) { drawXPGem(this.rc, gem); }
  drawGarlicAura(player: Player, radius: number, modifierMask: number = 0, evolutionIds?: readonly WeaponEvolutionId[]) {
    drawGarlicAura(this.rc, player, radius, modifierMask, evolutionIds);
  }
  drawPickupRange(player: Player) { drawPickupRange(this.rc, player); }

  // ─── Effects ───
  drawParticle(p: Particle) { drawParticle(this.rc, p); }
  drawDamageNumber(d: DamageNumber) { drawDamageNumber(this.rc, d); }
  drawDamageFlash(alpha: number) { drawDamageFlash(this.rc, alpha); }
  drawLevelUpFlash(alpha: number) { drawLevelUpFlash(this.rc, alpha); }
  drawBossWarning(name: string, timer: number) { drawBossWarning(this.rc, name, timer); }

  // ─── UI ───
  drawUI(player: Player, elapsed: number, killCount: number, objective?: string, runDuration?: number) {
    drawUI(this.rc, player, elapsed, killCount, objective, runDuration);
  }
  drawMinimap(player: Player, enemies: Enemy[], obstacles: MapObstacle[]) { drawMinimap(this.rc, player, enemies, obstacles); }
  drawVirtualJoystick(joystick: TouchJoystickState) { drawVirtualJoystick(this.rc, joystick); }
  drawBossBar(name: string, hp: number, maxHp: number) { drawBossBar(this.rc, name, hp, maxHp); }
  drawAudioButton(muted: boolean) { drawAudioBtn(this.rc, muted); }
  drawPauseButton() { drawPauseBtn(this.rc); }
  drawDesktop(
    meta: MetaState,
    tab: DesktopTab,
    codexTab: CodexTab,
    selectedStartingWeaponId: string,
    startingWeapons: readonly StartingWeaponView[],
    hoveredStarId?: MetaUpgradeNode['id']
  ) {
    drawDesktop(this.rc, meta, tab, codexTab, selectedStartingWeaponId, startingWeapons, hoveredStarId);
  }
  drawPaused(player: Player, elapsed: number, killCount: number, difficultyName: string) {
    drawPaused(this.rc, player, elapsed, killCount, difficultyName);
  }
  drawUpgradeScreen(
    options: UpgradeOption[],
    selectedIndex: number,
    shards: number,
    sellableCards: SellableCard[],
    canFreeReroll: boolean,
    rerollCost: number,
    canPaidReroll: boolean
  ) {
    drawUpgradeScreen(this.rc, options, selectedIndex, shards, sellableCards, canFreeReroll, rerollCost, canPaidReroll);
  }
  drawGameOver(stats: {
    time: number;
    kills: number;
    level: number;
    weaponNames: string[];
    soulFireEarned: number;
    totalSoulFire: number;
    runDuration?: number;
    deathCause?: string;
    advice?: string;
  }, player?: Player, canContinueEndless = false, endlessMode = false) {
    drawGameOver(this.rc, stats, player, canContinueEndless, endlessMode);
  }
  drawPerformanceOverlay(stats: PerformanceStats) { drawPerformanceOverlay(this.rc, stats); }
}
