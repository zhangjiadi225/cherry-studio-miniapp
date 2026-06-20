import {
  GameState, Enemy, Projectile, XPGem, Particle, DamageNumber, EnemyProjectile,
  Camera, WeaponType, PassiveType, Weapon, GenericModifierType, PerformanceStats, MapObstacle, EnemyType
} from './types';
import {
  SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY, COLORS, ENEMY_DATA, WEAPON_DATA,
  CONTACT_COOLDOWN,
  MAGIC_CIRCLE_HEAL_RATE, MAGIC_CIRCLE_RADIUS,
  GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK, MAX_ENEMIES,
} from './constants';
import { Input } from './systems/input/Input';
import { Renderer } from './Renderer';
import { createPlayer, updatePlayer, damagePlayer, collectShards, hasPassive, tryBloodZoneHeal } from './systems/player/Player';
import { createEnemy, updateEnemy, isCollidingWithPlayer, resetEnemyIds, shouldSplitOnDeath } from './systems/enemy/Enemy';
import { updateEnemyAttacks, updateEnemyProjectile } from './systems/enemy/EnemyAttack';
import { Spawner } from './systems/enemy/Spawner';
import {
  updateWeapon, updateBiblePositions, getGarlicRadius,
  createWeapon, updateGarlicAura,
} from './systems/weapon/Weapon';
import { AudioSystem } from './systems/audio/Audio';
import { ProjectileCombat } from './systems/combat/ProjectileCombat';
import { ShopSystem } from './systems/upgrade/ShopSystem';
import { createCamera, updateCamera, shakeCamera } from './systems/camera/Camera';
import { createXPGem, updateXPGem } from './systems/player/XPGem';
import {
  updateParticle, spawnHitParticles, spawnDeathParticles, spawnXPParticles,
  spawnExplosionParticles, spawnLevelUpParticles
} from './effects/Particle';
import { pushDamageNumber, updateDamageNumber } from './effects/DamageNumber';
import {
  type CodexTab, type DesktopTab, type MetaState, type MetaUpgradeNode,
  loadMetaState, applyRunReward, getInitialShards,
  buyMetaUpgrade, selectSkin, selectRunDifficulty, CHARACTER_SKINS,
} from './systems/meta/MetaProgression';
import { getRunDifficultyPreset, type RunDifficultyPreset } from './data/runDifficulties';
import { getDifficultyParams } from './data/difficulty';
import { MapSystem } from './systems/map/MapSystem';
import { SpatialEnemyQuery } from './systems/enemy/EnemyQuery';
import { pools, clearAllPools } from './utils/PoolManager';
import { SpatialGrid } from './utils/SpatialGrid';
import { eventBus, gameState, GameEvent } from './events';

type ObjectiveBeat = {
  time: number;
  message: string;
  eliteAmbush?: number;
};

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getObjectiveBeats(runDifficulty: RunDifficultyPreset): ObjectiveBeat[] {
  const firstBossTime = runDifficulty.bossTimes[0] ?? Math.min(180, runDifficulty.duration * 0.42);
  const firstEliteTime = Math.max(75, Math.min(120, firstBossTime - 60));
  return [
    { time: 12, message: '目标：收集魂晶，升级并购买构筑牌' },
    { time: Math.max(45, firstEliteTime - 50), message: `目标：准备补给，夜潮精英将在${formatClock(firstEliteTime)}出现` },
    { time: firstEliteTime, message: '夜潮精英出现，击败它获取大量魂晶', eliteAmbush: 2 },
    { time: Math.max(firstEliteTime + 20, firstBossTime - 30), message: 'Boss即将到来，保留魂晶购买补给' },
  ];
}

const MINIMAP_REFRESH_INTERVAL = 0.15;
const MINIMAP_WORLD_HALF_SIZE = 1500;
const MINIMAP_QUERY_RADIUS = MINIMAP_WORLD_HALF_SIZE * Math.SQRT2;

export class Game {
  private canvas: HTMLCanvasElement;
  private input: Input;
  private renderer: Renderer;
  private spawner = new Spawner();
  private audio = new AudioSystem();
  private projectileCombat = new ProjectileCombat();
  private shop = new ShopSystem();
  private mapSystem = new MapSystem();
  private enemyGrid = new SpatialGrid<Enemy>(240);
  private enemyQuery = new SpatialEnemyQuery(this.enemyGrid);
  private camera: Camera;
  private meta: MetaState = loadMetaState();
  private runDifficulty: RunDifficultyPreset = getRunDifficultyPreset(this.meta.selectedDifficulty);
  private objectiveBeats: ObjectiveBeat[] = getObjectiveBeats(this.runDifficulty);
  private desktopTab: DesktopTab = 'start';
  private codexTab: CodexTab = 'weapons';
  private hoveredStarId?: MetaUpgradeNode['id'];
  private player = createPlayer();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private minimapEnemies: Enemy[] = [];
  private visibleObstacles: MapObstacle[] = [];
  private xpGems: XPGem[] = [];
  private particles: Particle[] = [];
  private damageNumbers: DamageNumber[] = [];
  private elapsed = 0;
  private difficulty = 0;
  private killCount = 0;
  private garlicTickTimer = { value: 0 };
  private lastTime = 0;
  private animationFrameId = 0;
  private destroyed = false;
  private levelUpQueue = 0;
  private bossWarningTimer = 0;
  private bossWarningName = '';
  private bossWarningShown = new Set<number>();
  private objectiveShown = new Set<number>();
  private objectiveMessage = '';
  private objectiveTimer = 0;
  private damageFlashTimer = 0;
  private levelUpFlashTimer = 0;
  private minimapRefreshTimer = 0;
  private perfEnabled = false;
  private perfStats: PerformanceStats = {
    fps: 0,
    updateMs: 0,
    renderMs: 0,
    frameMs: 0,
    enemies: 0,
    projectiles: 0,
    enemyProjectiles: 0,
    particles: 0,
    damageNumbers: 0,
    xpGems: 0,
  };
  private garlicWeapon?: Weapon;
  private activeBoss?: Enemy;
  private lastDamageSource?: { enemyName: string; damage: number; time: number };
  private gameOverStats?: {
    time: number;
    kills: number;
    level: number;
    weaponNames: string[];
    soulFireEarned: number;
    totalSoulFire: number;
    runDuration: number;
    deathCause?: string;
    advice?: string;
  };
  private readonly handleKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private readonly handleCanvasClick = (e: MouseEvent) => this.onClick(e);
  private readonly handleCanvasMouseMove = (e: MouseEvent) => this.onMouseMove(e);
  private readonly handleCanvasTouchStart = (e: TouchEvent) => this.onTouchStart(e);
  private readonly handleVisibilityChange = () => {
    if (document.hidden && gameState.is('playing')) {
      gameState.transition('pause');
    }
  };
  private readonly handleAnimationFrame = (time: number) => this.loop(time);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.camera = createCamera();
    this.perfEnabled = this.shouldShowPerfOverlay();

    window.addEventListener('keydown', this.handleKeyDown);
    canvas.addEventListener('click', this.handleCanvasClick);
    canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
    canvas.addEventListener('touchstart', this.handleCanvasTouchStart, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    this.canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
    this.canvas.removeEventListener('touchstart', this.handleCanvasTouchStart);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    cancelAnimationFrame(this.animationFrameId);
    this.input.destroy();
    this.audio.destroy();
    this.renderer.destroy();
  }

  // ──────────────────────────── Input Routing ────────────────────────────

  private onKeyDown(e: KeyboardEvent) {
    switch (gameState.state) {
      case 'upgrading':
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.shop.selectPrevious();
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.shop.selectNext();
        } else if (e.code === 'Enter') {
          e.preventDefault();
          this.buySelectedUpgrade();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          this.rerollShop();
        } else if (e.code === 'Space' || e.code === 'Escape') {
          e.preventDefault();
          this.finishShop();
        }
        break;
      case 'paused':
        if (e.code === 'Escape' || e.code === 'KeyP') gameState.transition('resume');
        break;
      case 'playing':
        if (e.code === 'Escape' || e.code === 'KeyP') gameState.transition('pause');
        break;
      case 'gameover':
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') gameState.reset();
        break;
      case 'menu':
        this.handleDesktopKey(e);
        break;
    }
  }

  private onClick(e: MouseEvent) {
    if (gameState.is('menu')) {
      this.handleDesktopClick(e);
    } else if (gameState.is('gameover')) {
      gameState.reset();
    } else if (gameState.is('upgrading')) {
      this.handleClickUpgrade(e);
    } else if (gameState.is('playing')) {
      this.handlePlayingHudPointer(e.clientX, e.clientY);
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!gameState.is('menu')) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.hoveredStarId = this.desktopTab === 'growth' ? this.getMetaStarIdAtPoint(x, y) : undefined;
  }

  private onTouchStart(e: TouchEvent) {
    if (gameState.is('menu')) {
      this.handleDesktopClick(e);
    } else if (gameState.is('gameover')) {
      gameState.reset();
    } else if (gameState.is('upgrading')) {
      this.handleClickUpgrade(e);
    } else if (gameState.is('paused')) {
      gameState.transition('resume');
    } else if (gameState.is('playing')) {
      const rect = this.canvas.getBoundingClientRect();
      const tx = e.touches[0].clientX - rect.left;
      const ty = e.touches[0].clientY - rect.top;
      this.handlePlayingHudCanvasPoint(tx, ty);
    }
  }

  private handlePlayingHudPointer(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return this.handlePlayingHudCanvasPoint(clientX - rect.left, clientY - rect.top);
  }

  private handlePlayingHudCanvasPoint(x: number, y: number): boolean {
    const audioBtn = this.renderer.getAudioButtonRect();
    if (x >= audioBtn.x && x <= audioBtn.x + audioBtn.w && y >= audioBtn.y && y <= audioBtn.y + audioBtn.h) {
      this.audio.toggleMuted();
      return true;
    }

    const pauseBtn = this.renderer.getPauseButtonRect();
    if (x >= pauseBtn.x && x <= pauseBtn.x + pauseBtn.w && y >= pauseBtn.y && y <= pauseBtn.y + pauseBtn.h) {
      gameState.transition('pause');
      return true;
    }
    return false;
  }

  private handleDesktopKey(e: KeyboardEvent) {
    if (e.code === 'Digit1') this.setDesktopTab('start');
    else if (e.code === 'Digit2') this.setDesktopTab('skins');
    else if (e.code === 'Digit3') this.setDesktopTab('growth');
    else if (e.code === 'Digit4') this.setDesktopTab('codex');
    else if (this.desktopTab === 'codex' && e.code === 'KeyQ') this.shiftCodexTab(-1);
    else if (this.desktopTab === 'codex' && e.code === 'KeyE') this.shiftCodexTab(1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.shiftDesktopTab(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.shiftDesktopTab(1);
    else if (e.code === 'Enter' || e.code === 'Space') this.startGame();
  }

  private shiftDesktopTab(dir: number) {
    const tabs: DesktopTab[] = ['start', 'skins', 'growth', 'codex'];
    const index = tabs.indexOf(this.desktopTab);
    this.setDesktopTab(tabs[(index + dir + tabs.length) % tabs.length]);
  }

  private setDesktopTab(tab: DesktopTab) {
    this.desktopTab = tab;
    if (tab !== 'growth') this.hoveredStarId = undefined;
  }

  private shiftCodexTab(dir: number) {
    const tabs: CodexTab[] = ['weapons', 'passives', 'enemies', 'modules'];
    const index = tabs.indexOf(this.codexTab);
    this.codexTab = tabs[(index + dir + tabs.length) % tabs.length];
  }

  private handleDesktopClick(e: MouseEvent | TouchEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const tabs = this.renderer.getDesktopTabRects();
    for (const tab of tabs) {
      if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
        this.setDesktopTab(tab.id);
        return;
      }
    }

    if (this.desktopTab === 'start') {
      const difficultyCards = this.renderer.getRunDifficultyCardRects();
      for (const card of difficultyCards) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.meta = selectRunDifficulty(this.meta, card.id);
          this.runDifficulty = getRunDifficultyPreset(this.meta.selectedDifficulty);
          this.objectiveBeats = getObjectiveBeats(this.runDifficulty);
          return;
        }
      }
      const button = this.renderer.getDesktopStartButtonRect();
      if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
        this.startGame();
      }
      return;
    }

    if (this.desktopTab === 'growth') {
      const nodeId = this.getMetaStarIdAtPoint(x, y);
      if (nodeId) {
        this.hoveredStarId = nodeId;
        this.meta = buyMetaUpgrade(this.meta, nodeId);
      }
      return;
    }

    if (this.desktopTab === 'skins') {
      const cards = this.renderer.getSkinCardRects();
      for (const card of cards) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.meta = selectSkin(this.meta, CHARACTER_SKINS[card.index].id);
          return;
        }
      }
      return;
    }

    if (this.desktopTab === 'codex') {
      const tabs = this.renderer.getCodexTabRects();
      for (const tab of tabs) {
        if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
          this.codexTab = tab.id;
          return;
        }
      }
    }
  }

  private getMetaStarIdAtPoint(x: number, y: number): MetaUpgradeNode['id'] | undefined {
    const nodes = this.renderer.getMetaStarNodeRects();
    for (const nodeRect of nodes) {
      const cx = nodeRect.x + nodeRect.w / 2;
      const cy = nodeRect.y + nodeRect.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      const r = nodeRect.w / 2 + 10;
      if (dx * dx + dy * dy <= r * r) return nodeRect.id;
    }
    return undefined;
  }

  // ──────────────────────────── Game Lifecycle ────────────────────────────

  private startGame() {
    gameState.transition('start');
    this.runDifficulty = getRunDifficultyPreset(this.meta.selectedDifficulty);
    this.objectiveBeats = getObjectiveBeats(this.runDifficulty);
    resetEnemyIds();
    clearAllPools();
    this.player = createPlayer(this.meta.selectedSkin);
    this.player.shards = getInitialShards(this.meta);
    this.player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    this.refreshWeaponRefs();
    this.activeBoss = undefined;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.minimapEnemies.length = 0;
    this.xpGems = [];
    this.particles = [];
    this.damageNumbers = [];
    this.elapsed = 0;
    this.difficulty = 0;
    this.killCount = 0;
    this.levelUpQueue = 0;
    this.shop.reset();
    this.garlicTickTimer.value = 0;
    this.bossWarningTimer = 0;
    this.bossWarningName = '';
    this.bossWarningShown.clear();
    this.objectiveShown.clear();
    this.objectiveMessage = `目标：在${this.runDifficulty.name}难度活到${formatClock(this.runDifficulty.duration)}`;
    this.objectiveTimer = 4;
    this.damageFlashTimer = 0;
    this.levelUpFlashTimer = 0;
    this.minimapRefreshTimer = 0;
    this.lastDamageSource = undefined;
    this.gameOverStats = undefined;
    this.spawner.reset();
    this.mapSystem.generate();
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.targetX = this.player.x;
    this.camera.targetY = this.player.y;
    this.camera.shakeX = 0;
    this.camera.shakeY = 0;
    this.camera.shakeDuration = 0;
    this.camera.shakeIntensity = 0;
    eventBus.emit(GameEvent.GAME_START);
  }

  // ──────────────────────────── Game Loop ────────────────────────────

  private loop(time: number) {
    if (this.destroyed) return;
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (rawDt <= 1.0) {
      const frameStart = performance.now();
      const dt = Math.min(0.05, rawDt);
      const updateStart = performance.now();
      this.update(dt);
      const updateMs = performance.now() - updateStart;
      const renderStart = performance.now();
      this.render(time / 1000);
      const renderMs = performance.now() - renderStart;
      this.recordPerformanceStats(rawDt, updateMs, renderMs, performance.now() - frameStart);
    }
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  private shouldShowPerfOverlay(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('perf') || window.localStorage.getItem('survivor_perf') === '1';
  }

  private recordPerformanceStats(rawDt: number, updateMs: number, renderMs: number, frameMs: number) {
    const alpha = 0.12;
    const smooth = (previous: number, next: number) => previous === 0 ? next : previous * (1 - alpha) + next * alpha;
    this.perfStats.fps = smooth(this.perfStats.fps, rawDt > 0 ? 1 / rawDt : 0);
    this.perfStats.updateMs = smooth(this.perfStats.updateMs, updateMs);
    this.perfStats.renderMs = smooth(this.perfStats.renderMs, renderMs);
    this.perfStats.frameMs = smooth(this.perfStats.frameMs, frameMs);
    this.perfStats.enemies = this.enemies.length;
    this.perfStats.projectiles = this.projectiles.length;
    this.perfStats.enemyProjectiles = this.enemyProjectiles.length;
    this.perfStats.particles = this.particles.length;
    this.perfStats.damageNumbers = this.damageNumbers.length;
    this.perfStats.xpGems = this.xpGems.length;
  }

  private update(dt: number) {
    if (!gameState.is('playing')) return;

    this.elapsed += dt;
    this.difficulty = Math.floor(this.elapsed / 30);

    for (let i = 0; i < this.runDifficulty.bossTimes.length; i++) {
      const bossTime = this.runDifficulty.bossTimes[i];
      if (this.elapsed >= bossTime - 10 && this.elapsed < bossTime && !this.bossWarningShown.has(bossTime)) {
        this.bossWarningTimer = 2;
        this.bossWarningName = i > 0 ? '亡灵领主' : '恶魔领主';
        this.bossWarningShown.add(bossTime);
        eventBus.emit(GameEvent.BOSS_WARNING, this.bossWarningName, bossTime);
      }
    }
    if (this.bossWarningTimer > 0) this.bossWarningTimer -= dt;
    this.updateObjectiveBeats(dt);
    if (this.damageFlashTimer > 0) this.damageFlashTimer -= dt;
    if (this.levelUpFlashTimer > 0) this.levelUpFlashTimer -= dt;

    const move = this.input.getMoveDir();
    updatePlayer(this.player, move.x, move.y, dt, this.mapSystem);

    this.updateMagicCircleHealing(dt);
    updateCamera(this.camera, this.player, dt);
    this.spawner.update(this.enemies, this.player, this.elapsed, this.difficulty, dt, this.player.curse, this.runDifficulty);
    this.updateEnemies(dt);
    this.updateEnemyProjectiles(dt);
    updateEnemyAttacks(this.enemies, this.player, this.enemyProjectiles, dt, this.runDifficulty);
    this.enemyGrid.rebuild(this.enemies);
    this.updateMinimapEnemyCache(dt);

    for (const w of this.player.weapons) {
      updateWeapon(w, this.player, this.projectiles, dt, this.enemyQuery);
    }

    if (this.garlicWeapon) {
      const { hits } = updateGarlicAura(this.garlicWeapon, this.player, dt, this.garlicTickTimer, this.enemyQuery);
      const hasRepulsion = (this.garlicWeapon.modifierMask & GENERIC_MODIFIER_MASK[GenericModifierType.REPULSION_FIELD]) !== 0;
      const repulsionVisual = GENERIC_MODIFIER_DATA[GenericModifierType.REPULSION_FIELD].visual;
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        pushDamageNumber(this.damageNumbers, hit.x, hit.y, hit.dmg, '#cccc66', 14);
        spawnHitParticles(this.particles, hit.x, hit.y, '#cccc66', 3, {
          speed: 60, life: 0.3, radius: 2, type: 'circle', glow: true,
        });
        if (hasRepulsion && i < 4) {
          spawnHitParticles(this.particles, hit.x, hit.y, repulsionVisual.accent, 4, {
            speed: 95, life: 0.28, radius: 2.4, type: repulsionVisual.particle, glow: true,
          });
          if (i === 0) eventBus.emit(GameEvent.MODIFIER_TRIGGER, GenericModifierType.REPULSION_FIELD);
        }
      }
    }

    updateBiblePositions(this.projectiles, this.player);
    this.projectileCombat.update({
      projectiles: this.projectiles,
      enemyQuery: this.enemyQuery,
      mapSystem: this.mapSystem,
      particles: this.particles,
      damageNumbers: this.damageNumbers,
    }, dt);

    for (const e of this.enemies) {
      if (e.hp <= 0) this.onEnemyDeath(e);
    }
    this.releaseDeadEnemies();
    this.refreshActiveBoss();

    this.updateXPGems(dt);

    if (this.levelUpQueue > 0 && gameState.is('playing')) {
      this.levelUpQueue--;
      this.showUpgradeScreen();
    }

    for (const p of this.particles) updateParticle(p, dt);
    this.releaseDeadParticles();
    for (const d of this.damageNumbers) updateDamageNumber(d, dt);
    this.releaseDeadDamageNumbers();

    this.checkPlayerDeath();

    if (this.elapsed >= this.runDifficulty.duration && gameState.is('playing')) {
      gameState.transition('timeout');
      this.recordRunEnd();
      eventBus.emit(GameEvent.GAME_OVER, {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
      });
    }
  }

  // ──────────────────────────── Update Sub-systems ────────────────────────────

  private refreshWeaponRefs() {
    this.garlicWeapon = this.player.weapons.find(w => w.type === WeaponType.GARLIC);
  }

  private refreshActiveBoss() {
    if (this.activeBoss && this.activeBoss.hp > 0) return;
    this.activeBoss = this.enemies.find(e => e.isBoss && e.hp > 0);
  }

  private releaseDeadEnemies() {
    let write = 0;
    for (let read = 0; read < this.enemies.length; read++) {
      const enemy = this.enemies[read];
      if (enemy.hp > 0) {
        if (write !== read) this.enemies[write] = enemy;
        write++;
      } else {
        if (this.activeBoss === enemy) this.activeBoss = undefined;
        pools.enemies.release(enemy);
      }
    }
    this.enemies.length = write;
  }

  private releaseDeadParticles() {
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const p = this.particles[read];
      if (p.life > 0) {
        if (write !== read) this.particles[write] = p;
        write++;
      } else {
        pools.particles.release(p);
      }
    }
    this.particles.length = write;
  }

  private releaseDeadDamageNumbers() {
    let write = 0;
    for (let read = 0; read < this.damageNumbers.length; read++) {
      const d = this.damageNumbers[read];
      if (d.life > 0) {
        if (write !== read) this.damageNumbers[write] = d;
        write++;
      } else {
        pools.damageNumbers.release(d);
      }
    }
    this.damageNumbers.length = write;
  }

  private updateMinimapEnemyCache(dt: number) {
    this.minimapRefreshTimer -= dt;
    if (this.minimapRefreshTimer > 0) return;
    this.minimapRefreshTimer = MINIMAP_REFRESH_INTERVAL;
    this.enemyGrid.collectNearby(this.player.x, this.player.y, MINIMAP_QUERY_RADIUS, this.minimapEnemies);
  }

  private releaseDeadEnemyProjectiles() {
    let write = 0;
    for (let read = 0; read < this.enemyProjectiles.length; read++) {
      const p = this.enemyProjectiles[read];
      if (p.life > 0) {
        if (write !== read) this.enemyProjectiles[write] = p;
        write++;
      } else {
        pools.enemyProjectiles.release(p);
      }
    }
    this.enemyProjectiles.length = write;
  }

  private releaseDeadXPGems() {
    let write = 0;
    for (let read = 0; read < this.xpGems.length; read++) {
      const g = this.xpGems[read];
      if (g.life > 0) {
        if (write !== read) this.xpGems[write] = g;
        write++;
      } else {
        pools.xpGems.release(g);
      }
    }
    this.xpGems.length = write;
  }

  private updateMagicCircleHealing(dt: number) {
    this.mapSystem.forNearby(
      this.player.x - MAGIC_CIRCLE_RADIUS, this.player.y - MAGIC_CIRCLE_RADIUS,
      this.player.x + MAGIC_CIRCLE_RADIUS, this.player.y + MAGIC_CIRCLE_RADIUS,
      (obs) => {
        if (obs.type !== 'magic_circle') return;
        const dx = this.player.x - obs.x;
        const dy = this.player.y - obs.y;
        if (dx * dx + dy * dy < obs.radius * obs.radius && this.player.hp < this.player.maxHp) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + MAGIC_CIRCLE_HEAL_RATE * dt);
        }
      }
    );
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!updateEnemy(e, this.player, dt, this.mapSystem)) continue;
      if (isCollidingWithPlayer(e, this.player) && e.contactCooldown <= 0) {
        const dmg = damagePlayer(this.player, e.damage);
        if (dmg > 0) {
          this.lastDamageSource = {
            enemyName: ENEMY_DATA[e.type].name,
            damage: dmg,
            time: this.elapsed,
          };
          eventBus.emit(GameEvent.PLAYER_HIT, dmg, e);
          shakeCamera(this.camera, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY);
          this.damageFlashTimer = 0.35;
          pushDamageNumber(this.damageNumbers, this.player.x, this.player.y, dmg, COLORS.danger, 20);
          spawnHitParticles(this.particles, this.player.x, this.player.y, COLORS.danger, 10, {
            speed: 180, life: 0.5, radius: 4, type: 'spark', glow: true,
          });
        }
        e.contactCooldown = CONTACT_COOLDOWN;
      }
    }
  }

  private updateEnemyProjectiles(dt: number) {
    for (const p of this.enemyProjectiles) {
      const result = updateEnemyProjectile(p, this.player, this.mapSystem, dt);
      if (result === 'active') continue;
      if (result === 'hitPlayer') {
        const dmg = damagePlayer(this.player, p.damage);
        if (dmg > 0) {
          this.lastDamageSource = {
            enemyName: ENEMY_DATA[p.sourceType].name,
            damage: dmg,
            time: this.elapsed,
          };
          eventBus.emit(GameEvent.PLAYER_HIT, dmg, p);
          shakeCamera(this.camera, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY * 0.75);
          this.damageFlashTimer = 0.28;
          pushDamageNumber(this.damageNumbers, this.player.x, this.player.y, dmg, COLORS.danger, 18);
          spawnHitParticles(this.particles, this.player.x, this.player.y, p.color, 8, {
            speed: 140, life: 0.42, radius: 3, type: 'spark', glow: true,
          });
        }
      }
      p.life = 0;
    }
    this.releaseDeadEnemyProjectiles();
  }

  private updateXPGems(dt: number) {
    const hasMagnet = hasPassive(this.player, PassiveType.MAGNET);
    for (const gem of this.xpGems) {
      if (gem.life <= 0) continue;
      const result = updateXPGem(gem, this.player, dt, hasMagnet);
      if (result.collected) {
        spawnXPParticles(this.particles, gem.x, gem.y, 5, {
          speed: 80, life: 0.4, radius: 2.5, color: '#88ffaa', glow: true,
        });
        const leveled = collectShards(this.player, result.value);
        eventBus.emit(GameEvent.XP_COLLECTED, result.value);
        if (leveled) {
          eventBus.emit(GameEvent.PLAYER_LEVEL_UP, this.player.level);
          this.levelUpQueue++;
          this.levelUpFlashTimer = 0.6;
          spawnLevelUpParticles(this.particles, this.player.x, this.player.y, 35);
          shakeCamera(this.camera, 0.15, 4);
        }
        gem.life = 0;
      }
    }
    this.releaseDeadXPGems();
  }

  private onEnemyDeath(e: Enemy) {
    this.killCount++;
    this.spawner.addKill();
    eventBus.emit(GameEvent.ENEMY_DEATH, e);

    const isElite = e.isElite;
    const particleCount = isElite ? 25 : 12;
    spawnDeathParticles(this.particles, e.x, e.y, ENEMY_DATA[e.type].color, particleCount, {
      speed: isElite ? 250 : 180, life: isElite ? 0.9 : 0.6,
      radius: isElite ? 5 : 3, type: 'square', glow: true,
    });
    if (isElite) {
      spawnDeathParticles(this.particles, e.x, e.y, '#ffd700', 10, {
        speed: 150, life: 0.8, radius: 4, type: 'star', glow: true,
      });
    }
    if (shouldSplitOnDeath(e)) {
      this.spawnDeathSplitMinions(e);
    }

    this.xpGems.push(createXPGem(e.x, e.y, e.xpValue));

    const heal = tryBloodZoneHeal(this.player);
    if (heal > 0) {
      pushDamageNumber(this.damageNumbers, this.player.x, this.player.y, heal, '#ff6666', 14);
    }

  }

  private spawnDeathSplitMinions(e: Enemy) {
    const difficultyParams = getDifficultyParams(this.elapsed, this.runDifficulty);
    const count = Math.min(2, Math.max(0, MAX_ENEMIES - this.enemies.length));
    for (let i = 0; i < count; i++) {
      const angle = e.animTimer + i * Math.PI;
      const child = createEnemy(
        EnemyType.BAT,
        e.x + Math.cos(angle) * e.radius * 1.4,
        e.y + Math.sin(angle) * e.radius * 1.4,
        this.difficulty,
        1,
        false,
        false,
        difficultyParams,
        0,
        1
      );
      child.hp *= 0.55;
      child.maxHp = child.hp;
      child.damage *= 0.7;
      child.xpValue = Math.max(1, child.xpValue * 0.35);
      child.knockbackX = Math.cos(angle) * 80;
      child.knockbackY = Math.sin(angle) * 80;
      this.enemies.push(child);
    }
    spawnHitParticles(this.particles, e.x, e.y, '#d6b48a', 12, {
      speed: 170, life: 0.42, radius: 2.5, type: 'spark', glow: true,
    });
  }

  private checkPlayerDeath() {
    if (this.player.hp > 0) return;
    if (hasPassive(this.player, PassiveType.REVIVE)) {
      this.player.hp = this.player.maxHp * 0.5;
      this.player.invTime = 3;
      const idx = this.player.passives.findIndex(pa => pa.type === PassiveType.REVIVE);
      if (idx >= 0) this.player.passives.splice(idx, 1);
      shakeCamera(this.camera, 0.6, 12);
      spawnExplosionParticles(this.particles, this.player.x, this.player.y, '#ffd700', 40, {
        speed: 300, life: 1.2, radius: 6, type: 'star', glow: true,
        innerColor: '#ffffff', ringCount: 12,
      });
      this.levelUpFlashTimer = 0.8;
    } else {
      gameState.transition('die');
      this.recordRunEnd();
      eventBus.emit(GameEvent.PLAYER_DEATH);
      eventBus.emit(GameEvent.GAME_OVER, {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
      });
    }
  }

  private recordRunEnd() {
    const previousSoulFire = this.meta.soulFire;
    this.meta = applyRunReward(this.meta, {
      time: this.elapsed,
      kills: this.killCount,
      level: this.player.level,
    }, this.runDifficulty);
    this.gameOverStats = {
      time: this.elapsed,
      kills: this.killCount,
      level: this.player.level,
      weaponNames: this.player.weapons.map(w => WEAPON_DATA[w.type].name),
      soulFireEarned: this.meta.soulFire - previousSoulFire,
      totalSoulFire: this.meta.soulFire,
      runDuration: this.runDifficulty.duration,
      deathCause: this.getDeathCause(),
      advice: this.getRunAdvice(),
    };
  }

  private updateObjectiveBeats(dt: number) {
    if (this.objectiveTimer > 0) this.objectiveTimer -= dt;

    for (const beat of this.objectiveBeats) {
      if (this.elapsed < beat.time || this.objectiveShown.has(beat.time)) continue;

      this.objectiveShown.add(beat.time);
      this.objectiveMessage = beat.message;
      this.objectiveTimer = 4;

      if (beat.eliteAmbush) {
        this.spawner.spawnEliteAmbush(
          this.enemies,
          this.player,
          this.elapsed,
          this.difficulty,
          this.player.curse,
          beat.eliteAmbush,
          this.runDifficulty
        );
        shakeCamera(this.camera, 0.18, 5);
      }
    }
  }

  private getDeathCause(): string | undefined {
    if (this.elapsed >= this.runDifficulty.duration) return undefined;
    if (!this.lastDamageSource) return '被夜潮包围';
    const secondsAgo = Math.max(0, Math.floor(this.elapsed - this.lastDamageSource.time));
    return `${this.lastDamageSource.enemyName}造成${this.lastDamageSource.damage}伤害 (${secondsAgo}s前)`;
  }

  private getRunAdvice(): string {
    if (this.elapsed >= this.runDifficulty.duration) return '胜利完成，下一局尝试更高难度或模块构筑。';
    if (this.elapsed < 180) return '前3分钟优先买低成本武器升级，保留魂晶给战地口粮。';
    if (this.player.shards < 10) return '魂晶见底时少刷新商店，优先买能立即提升清怪的牌。';
    if (this.player.hp < this.player.maxHp * 0.35) return '低血量时购买战术补给，不要硬贪永久升级。';
    return '死亡多半来自清怪速度不足，下一局优先补范围或连锁伤害。';
  }

  // ──────────────────────────── Upgrade ────────────────────────────

  private showUpgradeScreen() {
    gameState.transition('upgrade');
    this.shop.open(this.player, this.meta);
  }

  private buySelectedUpgrade() {
    const option = this.shop.buySelected(this.player);
    if (!option) return;
    this.refreshWeaponRefs();
    eventBus.emit(GameEvent.UPGRADE_SELECT, option);
  }

  private rerollShop() {
    this.shop.reroll(this.player, this.meta);
  }

  private finishShop() {
    gameState.transition('finishUpgrade');
    if (this.levelUpQueue > 0) {
      setTimeout(() => this.showUpgradeScreen(), 100);
    }
  }

  private handleClickUpgrade(e: MouseEvent | TouchEvent) {
    const rect = this.canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = this.renderer.getWidth();
    const h = this.renderer.getHeight();
    const action = this.shop.handleClick(x, y, w, h);
    if (action === 'buy') {
      this.buySelectedUpgrade();
    } else if (action === 'reroll') {
      this.rerollShop();
    } else if (action === 'continue') {
      this.finishShop();
    }
  }

  // ──────────────────────────── Render ────────────────────────────

  private render(timeSeconds: number) {
    this.renderer.beginFrame(timeSeconds);
    this.renderer.clear();

    if (gameState.is('menu')) {
      this.renderer.drawDesktop(this.meta, this.desktopTab, this.codexTab, this.hoveredStarId);
      return;
    }

    this.renderer.beginWorld(this.camera);
    this.renderer.drawGround(this.camera);

    const visibleObstacles = this.mapSystem.collectVisible(
      this.camera.x, this.camera.y,
      this.renderer.getWidth(), this.renderer.getHeight(),
      this.visibleObstacles
    );
    this.renderer.drawObstacles(visibleObstacles);
    this.renderer.drawArenaBounds(this.camera);

    for (const gem of this.xpGems) {
      if (this.renderer.isOnScreen(gem.x, gem.y, this.camera)) {
        this.renderer.drawXPGem(gem);
      }
    }

    for (const e of this.enemies) {
      if (this.renderer.isOnScreen(e.x, e.y, this.camera, e.radius + 20)) {
        this.renderer.drawEnemy(e);
      }
    }

    for (const p of this.projectiles) {
      if (this.renderer.isOnScreen(p.x, p.y, this.camera, p.radius + 10)) {
        this.renderer.drawProjectile(p);
      }
    }

    for (const p of this.enemyProjectiles) {
      if (this.renderer.isOnScreen(p.x, p.y, this.camera, p.radius + 18)) {
        this.renderer.drawEnemyProjectile(p);
      }
    }

    if (this.garlicWeapon) {
      this.renderer.drawGarlicAura(this.player, getGarlicRadius(this.garlicWeapon, this.player), this.garlicWeapon.modifierMask);
    }

    this.renderer.drawPickupRange(this.player);
    this.renderer.drawPlayer(this.player);

    for (const p of this.particles) {
      if (this.renderer.isOnScreen(p.x, p.y, this.camera, Math.max(p.radius, p.glowRadius ?? 0) + 16)) {
        this.renderer.drawParticle(p);
      }
    }
    for (const d of this.damageNumbers) {
      if (this.renderer.isOnScreen(d.x, d.y, this.camera, d.size + 24)) {
        this.renderer.drawDamageNumber(d);
      }
    }

    this.renderer.endWorld();

    this.renderer.drawUI(
      this.player,
      this.elapsed,
      this.killCount,
      this.objectiveTimer > 0 ? this.objectiveMessage : undefined,
      this.runDifficulty.duration
    );
    this.renderer.drawMinimap(this.player, this.minimapEnemies);
    this.renderer.drawAudioButton(this.audio.isMuted());
    this.renderer.drawPauseButton();
    if (gameState.is('playing')) {
      this.renderer.drawVirtualJoystick(this.input.getJoystickState());
    }

    if (this.activeBoss?.hp && this.activeBoss.hp > 0) {
      this.renderer.drawBossBar(ENEMY_DATA[this.activeBoss.type].name, this.activeBoss.hp, this.activeBoss.maxHp);
    }
    if (this.bossWarningTimer > 0) this.renderer.drawBossWarning(this.bossWarningName, this.bossWarningTimer);
    if (this.damageFlashTimer > 0) this.renderer.drawDamageFlash(this.damageFlashTimer);
    if (this.levelUpFlashTimer > 0) this.renderer.drawLevelUpFlash(this.levelUpFlashTimer);
    if (this.perfEnabled) this.renderer.drawPerformanceOverlay(this.perfStats);

    if (gameState.is('paused')) {
      this.renderer.drawPaused(this.player, this.elapsed, this.killCount, this.runDifficulty.name);
    } else if (gameState.is('upgrading')) {
      this.renderer.drawUpgradeScreen(
        this.shop.options,
        this.shop.selectedIndex,
        this.player.shards,
        this.shop.canFreeReroll(),
        this.shop.getRerollCost(this.meta),
        this.shop.canPaidReroll(this.meta)
      );
    } else if (gameState.is('gameover')) {
      this.renderer.drawGameOver(this.gameOverStats ?? {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
        weaponNames: this.player.weapons.map(w => WEAPON_DATA[w.type].name),
        soulFireEarned: 0,
        totalSoulFire: this.meta.soulFire,
        runDuration: this.runDifficulty.duration,
        deathCause: this.getDeathCause(),
        advice: this.getRunAdvice(),
      }, this.player);
    }
  }
}
