import type { Player, Enemy, Projectile, XPGem, Particle, DamageNumber, Camera, UpgradeOption, MapObstacle } from './types';
import type { CodexTab, DesktopTab, MetaState, MetaUpgradeNode } from './systems/meta/MetaProgression';
import { COLORS } from './constants';
import { WorldRenderer, type RenderContext } from './renderers/WorldRenderer';
import {
  drawPlayer, drawEnemy, drawProjectile, drawGarlicAura,
  drawPickupRange, drawXPGem,
} from './renderers/EntityRenderer';
import { drawParticle, drawDamageNumber, drawDamageFlash, drawLevelUpFlash, drawBossWarning } from './renderers/EffectsRenderer';
import {
  drawUI, drawMinimap, drawBossBar,
  drawAudioButton as drawAudioBtn, drawPauseButton as drawPauseBtn,
	  getAudioButtonRect as getAudioRect,
	  getDesktopStartButtonRect as getStartButtonRect,
	  getMetaStarNodeRects as getStarNodeRects,
	  getSkinCardRects as getSkinRects,
	  getCodexTabRects as getCodexRects,
	  getDesktopTabRects as getTabRects,
	  getPauseButtonRect as getPauseRect,
	  drawDesktop, drawPaused, drawUpgradeScreen, drawGameOver,
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
    this.worldRenderer.rebuildCache(this.w, this.h);
  }

  getWidth() { return this.w; }
  getHeight() { return this.h; }

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
  getDesktopTabRects() { return getTabRects(this.w, this.h); }
  getMetaStarNodeRects() { return getStarNodeRects(this.w, this.h); }
  getSkinCardRects() { return getSkinRects(this.w, this.h); }
  getCodexTabRects() { return getCodexRects(this.w, this.h); }

  // ─── World ───
  drawGround(cam: Camera) { this.worldRenderer.drawGround(this.rc, cam); }
  drawObstacles(obstacles: MapObstacle[]) { this.worldRenderer.drawObstacles(this.rc, obstacles); }
  drawArenaBounds(cam: Camera) { this.worldRenderer.drawArenaBounds(this.rc, cam); }

  // ─── Entities ───
  drawPlayer(p: Player) { drawPlayer(this.rc, p); }
  drawEnemy(e: Enemy) { drawEnemy(this.rc, e); }
  drawProjectile(p: Projectile) { drawProjectile(this.rc, p); }
  drawXPGem(gem: XPGem) { drawXPGem(this.rc, gem); }
  drawGarlicAura(player: Player, radius: number) { drawGarlicAura(this.rc, player, radius); }
  drawPickupRange(player: Player) { drawPickupRange(this.rc, player); }

  // ─── Effects ───
  drawParticle(p: Particle) { drawParticle(this.rc, p); }
  drawDamageNumber(d: DamageNumber) { drawDamageNumber(this.rc, d); }
  drawDamageFlash(alpha: number) { drawDamageFlash(this.rc, alpha); }
  drawLevelUpFlash(alpha: number) { drawLevelUpFlash(this.rc, alpha); }
  drawBossWarning(name: string, timer: number) { drawBossWarning(this.rc, name, timer); }

  // ─── UI ───
  drawUI(player: Player, elapsed: number, killCount: number, objective?: string) {
    drawUI(this.rc, player, elapsed, killCount, objective);
  }
  drawMinimap(player: Player, enemies: Enemy[]) { drawMinimap(this.rc, player, enemies); }
  drawBossBar(name: string, hp: number, maxHp: number) { drawBossBar(this.rc, name, hp, maxHp); }
  drawAudioButton(muted: boolean) { drawAudioBtn(this.rc, muted); }
  drawPauseButton() { drawPauseBtn(this.rc); }
  drawDesktop(meta: MetaState, tab: DesktopTab, codexTab: CodexTab, hoveredStarId?: MetaUpgradeNode['id']) {
    drawDesktop(this.rc, meta, tab, codexTab, hoveredStarId);
  }
  drawPaused() { drawPaused(this.rc); }
  drawUpgradeScreen(options: UpgradeOption[], selectedIndex: number, shards: number, canFreeReroll: boolean, rerollCost: number, canPaidReroll: boolean) {
    drawUpgradeScreen(this.rc, options, selectedIndex, shards, canFreeReroll, rerollCost, canPaidReroll);
  }
  drawGameOver(stats: {
    time: number;
    kills: number;
    level: number;
    weaponNames: string[];
    soulFireEarned: number;
    totalSoulFire: number;
    deathCause?: string;
    advice?: string;
  }) { drawGameOver(this.rc, stats); }
}
