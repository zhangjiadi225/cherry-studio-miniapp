import {
  GameState, Enemy, Projectile, XPGem, Particle, DamageNumber, EnemyProjectile,
  Camera, WeaponType, PassiveType, Weapon, PerformanceStats, MapObstacle, EnemyType, GenericModifierType
} from './types';
import {
  SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY, COLORS,
  CONTACT_COOLDOWN,
  MAX_ENEMIES, MAX_ACTIVE_PLAYER_PROJECTILES, MAX_ACTIVE_ENEMY_PROJECTILES,
  MAX_ACTIVE_PARTICLES, MAX_ACTIVE_DAMAGE_NUMBERS,
  SIMULATION_STEP_SECONDS, MAX_SIMULATION_STEPS_PER_FRAME, MAX_SIMULATION_FRAME_DELTA,
} from './constants';
import { Input } from './systems/input/Input';
import { Renderer } from './Renderer';
import {
  createPlayer, updatePlayer, damagePlayer, collectShards, hasPassive,
  removePassive,
} from './systems/player/Player';
import { createEnemy, updateEnemy, isCollidingWithPlayer, resetEnemyIds, shouldSplitOnDeath } from './systems/enemy/Enemy';
import { updateEnemyAttacks, updateEnemyProjectile } from './systems/enemy/EnemyAttack';
import { Spawner } from './systems/enemy/Spawner';
import {
  updateWeapon, updateBiblePositions, getGarlicRadius,
  createWeapon, updateGarlicAuraInto, type GarlicAuraHit,
} from './systems/weapon/Weapon';
import { getWeaponEvolutionIds } from './data/weaponEvolutions';
import { AudioSystem } from './systems/audio/Audio';
import { ProjectileCombat, type ProjectileCombatContext } from './systems/combat/ProjectileCombat';
import { ShopSystem } from './systems/upgrade/ShopSystem';
import { createCamera, updateCamera, shakeCamera } from './systems/camera/Camera';
import { createXPGem, updateXPGem } from './systems/player/XPGem';
import {
  updateParticle, spawnHitParticles, spawnDeathParticles, spawnXPParticles,
  spawnExplosionParticles, spawnLevelUpParticles,
  beginParticleEmissionFrame,
  endParticleEmissionFrame,
  getParticleEmissionsThisFrame,
  getParticleEmissionDropsThisFrame,
} from './effects/Particle';
import { pushDamageNumber, updateDamageNumber } from './effects/DamageNumber';
import {
  type CodexTab, type DesktopTab, type MetaState, type MetaUpgradeNode,
  applyRunReward, getInitialShards,
  hasOpeningCardDraft, buyMetaUpgrade, selectSkin, selectRunDifficulty, CHARACTER_SKINS,
} from './systems/meta/MetaProgression';
import {
  getRunDifficultyPreset,
  type RunDifficultyId,
  type RunDifficultyPreset,
} from './data/runDifficulties';
import { getDifficultyParams } from './data/difficulty';
import { MapSystem } from './systems/map/MapSystem';
import { SpatialEnemyQuery } from './systems/enemy/EnemyQuery';
import { pools, resetPoolMetrics } from './utils/PoolManager';
import { SpatialGrid } from './utils/SpatialGrid';
import { eventBus, gameState, GameEvent } from './events';
import { GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK } from './data/modifiers';
import type { GameContentSnapshot } from '../content/runtime/GameContentSnapshot';
import { FixedStepClock } from './kernel/FixedStepClock';
import { createRunSeed, normalizeSeed, SeededRandom } from './kernel/Random';

type ObjectiveBeat = {
  time: number;
  message: string;
  eliteAmbush?: number;
};

export interface GameOptions {
  content: GameContentSnapshot;
  meta: MetaState;
  muted: boolean;
  perfEnabled: boolean;
  runSeed?: number;
  persistMeta(meta: MetaState): Promise<void>;
  persistMuted(muted: boolean): Promise<void>;
}

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
const PERFORMANCE_SMOOTHING_ALPHA = 0.12;

function smoothPerformanceValue(previous: number, next: number): number {
  return previous === 0
    ? next
    : previous * (1 - PERFORMANCE_SMOOTHING_ALPHA) + next * PERFORMANCE_SMOOTHING_ALPHA;
}
const GARLIC_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 60,
  life: 0.3,
  radius: 2,
  type: 'circle' as const,
  glow: true,
});
const REPULSION_VISUAL = GENERIC_MODIFIER_DATA[GenericModifierType.REPULSION_FIELD].visual;
const REPULSION_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 95,
  life: 0.28,
  radius: 2.4,
  type: REPULSION_VISUAL.particle as 'circle' | 'square' | 'star' | 'spark',
  glow: true,
});
const PLAYER_CONTACT_PARTICLE_OPTIONS = Object.freeze({
  speed: 180,
  life: 0.5,
  radius: 4,
  type: 'spark' as const,
  glow: true,
});
const PLAYER_PROJECTILE_HIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 140,
  life: 0.42,
  radius: 3,
  type: 'spark' as const,
  glow: true,
});
const XP_PARTICLE_OPTIONS = Object.freeze({
  speed: 80,
  life: 0.4,
  radius: 2.5,
  color: '#88ffaa',
  glow: true,
});
const NORMAL_DEATH_PARTICLE_OPTIONS = Object.freeze({
  speed: 180,
  life: 0.6,
  radius: 3,
  type: 'square' as const,
  glow: true,
});
const ELITE_DEATH_PARTICLE_OPTIONS = Object.freeze({
  speed: 250,
  life: 0.9,
  radius: 5,
  type: 'square' as const,
  glow: true,
});
const ELITE_ACCENT_PARTICLE_OPTIONS = Object.freeze({
  speed: 150,
  life: 0.8,
  radius: 4,
  type: 'star' as const,
  glow: true,
});
const SPLIT_PARTICLE_OPTIONS = Object.freeze({
  speed: 170,
  life: 0.42,
  radius: 2.5,
  type: 'spark' as const,
  glow: true,
});
const REVIVE_PARTICLE_OPTIONS = Object.freeze({
  speed: 300,
  life: 1.2,
  radius: 6,
  type: 'star' as const,
  glow: true,
  innerColor: '#ffffff',
  ringCount: 12,
});

type UpdatePhaseTimes = Pick<
  PerformanceStats,
  'movementMs' | 'enemiesMs' | 'weaponsMs' | 'combatMs' | 'effectsMs'
>;

export class Game {
  private canvas: HTMLCanvasElement;
  private input: Input;
  private renderer: Renderer;
  private readonly ruleRandom = new SeededRandom(0);
  private readonly simulationClock = new FixedStepClock(
    SIMULATION_STEP_SECONDS,
    MAX_SIMULATION_STEPS_PER_FRAME,
    MAX_SIMULATION_FRAME_DELTA
  );
  private readonly spawner = new Spawner(this.ruleRandom);
  private audio: AudioSystem;
  private projectileCombat = new ProjectileCombat();
  private readonly shop = new ShopSystem(this.ruleRandom);
  private mapSystem = new MapSystem();
  private enemyGrid = new SpatialGrid<Enemy>(240);
  private enemyQuery = new SpatialEnemyQuery(this.enemyGrid);
  private camera: Camera;
  private readonly content: GameContentSnapshot;
  private meta: MetaState;
  private runDifficulty: RunDifficultyPreset;
  private objectiveBeats: ObjectiveBeat[];
  private readonly persistMeta: GameOptions['persistMeta'];
  private readonly persistMuted: GameOptions['persistMuted'];
  private readonly configuredRunSeed?: number;
  private desktopTab: DesktopTab = 'home';
  private codexTab: CodexTab = 'weapons';
  private selectedStartingWeaponId = 'builtin.weapon.magic-wand';
  private hoveredStarId?: MetaUpgradeNode['id'];
  private player = createPlayer();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private minimapEnemies: Enemy[] = [];
  private minimapObstacles: MapObstacle[] = [];
  private visibleObstacles: MapObstacle[] = [];
  private xpGems: XPGem[] = [];
  private particles: Particle[] = [];
  private visibleParticles: Particle[] = [];
  private damageNumbers: DamageNumber[] = [];
  private garlicHits: GarlicAuraHit[] = [];
  private readonly projectileCombatContext: ProjectileCombatContext = {
    player: this.player,
    projectiles: this.projectiles,
    enemyQuery: this.enemyQuery,
    mapSystem: this.mapSystem,
    particles: this.particles,
    damageNumbers: this.damageNumbers,
    enemyProjectiles: this.enemyProjectiles,
  };
  private elapsed = 0;
  private difficulty = 0;
  private killCount = 0;
  private garlicTickTimer = { value: 0 };
  private lastTime = 0;
  private animationFrameId = 0;
  private destroyed = false;
  private hostVisible = true;
  private externalUiOpen = false;
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
  private mapCleanupTimer = 0;
  private runSeed = 0;
  private perfEnabled = false;
  private framePhaseTimes: UpdatePhaseTimes = {
    movementMs: 0,
    enemiesMs: 0,
    weaponsMs: 0,
    combatMs: 0,
    effectsMs: 0,
  };
  private frameParticleRenderMs = 0;
  private frameVisibleParticles = 0;
  private frameParticleRenderCost = 0;
  private frameParticleRenderQuality: PerformanceStats['particleRenderQuality'] = 'full';
  private perfStats: PerformanceStats = {
    fps: 0,
    updateMs: 0,
    renderMs: 0,
    frameMs: 0,
    simulationSteps: 0,
    droppedSimulationMs: 0,
    movementMs: 0,
    enemiesMs: 0,
    weaponsMs: 0,
    combatMs: 0,
    effectsMs: 0,
    particleRenderMs: 0,
    particleRenderQuality: 'full',
    visibleParticles: 0,
    particleRenderCost: 0,
    particleEmissions: 0,
    particleEmissionDrops: 0,
    runSeed: 0,
    enemies: 0,
    projectiles: 0,
    enemyProjectiles: 0,
    particles: 0,
    damageNumbers: 0,
    xpGems: 0,
    enemyCapFrames: 0,
    projectileCapFrames: 0,
    enemyProjectileCapFrames: 0,
    particleCapFrames: 0,
    damageNumberCapFrames: 0,
    spatialBuckets: 0,
    spatialBucketCapacity: 0,
    spatialQueries: 0,
    spatialCandidateChecks: 0,
    spatialMatches: 0,
    sweptCollisionTests: 0,
    spatialEarlyExits: 0,
    projectileCollisionCandidates: 0,
    projectileHits: 0,
    poolMisses: 0,
    particlePoolMisses: 0,
    projectilePoolMisses: 0,
    canvasDpr: 1,
    glowSpriteCacheEntries: 0,
  };
  private garlicWeapon?: Weapon;
  private activeBoss?: Enemy;
  private lastDamageSource?: { enemyName: string; damage: number; time: number };
  private endlessModeActive = false;
  private paidSoulFireReward = 0;
  private openingDraftActive = false;
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
  private readonly handleAnimationFrame = (time: number) => this.loop(time);
  private readonly handleSimulationStep = (dt: number) => {
    this.update(dt);
    return gameState.is('playing');
  };
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly unsubscribeWeaponFeedback: () => void;

  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.canvas = canvas;
    this.content = options.content;
    this.meta = options.meta;
    this.runDifficulty = getRunDifficultyPreset(this.meta.selectedDifficulty);
    this.objectiveBeats = getObjectiveBeats(this.runDifficulty);
    this.persistMeta = options.persistMeta;
    this.persistMuted = options.persistMuted;
    this.configuredRunSeed = options.runSeed === undefined ? undefined : normalizeSeed(options.runSeed);
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.audio = new AudioSystem(options.muted);
    this.camera = createCamera();
    this.unsubscribeWeaponFeedback = eventBus.on(GameEvent.WEAPON_FEEDBACK, (signal) => {
      if (
        signal.kind === 'camera' &&
        !this.reducedMotion
      ) {
        shakeCamera(this.camera, signal.duration, signal.intensity);
      }
    });
    this.perfEnabled = options.perfEnabled;
    this.enemyGrid.setMetricsEnabled(this.perfEnabled);
    this.projectileCombat.setMetricsEnabled(this.perfEnabled);

    window.addEventListener('keydown', this.handleKeyDown);
    canvas.addEventListener('click', this.handleCanvasClick);
    canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
    canvas.addEventListener('touchstart', this.handleCanvasTouchStart, { passive: true });

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
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
    this.releaseRunEntities();
    this.input.destroy();
    this.audio.destroy();
    this.unsubscribeWeaponFeedback();
    this.renderer.destroy();
  }

  setHostVisible(visible: boolean) {
    if (this.destroyed || this.hostVisible === visible) return;
    this.hostVisible = visible;

    if (!visible) {
      if (gameState.is('playing')) gameState.transition('pause');
      this.input.reset();
      this.audio.suspend();
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
      this.simulationClock.discardPendingTime();
      this.commitMetaState();
      return;
    }

    this.lastTime = performance.now();
    this.simulationClock.discardPendingTime();
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  setExternalUiOpen(open: boolean) {
    this.externalUiOpen = open;
    if (open) {
      this.input.reset();
      this.hoveredStarId = undefined;
    }
  }

  canOpenWeaponForge(): boolean {
    return gameState.is('menu') || gameState.is('gameover');
  }

  isEngineHomeActive(): boolean {
    return gameState.is('menu') && this.desktopTab === 'home';
  }

  openDesktopTab(tab: DesktopTab): void {
    if (!gameState.is('menu')) return;
    this.setDesktopTab(tab);
  }

  openContentLibrary(): void {
    if (!gameState.is('menu')) return;
    this.codexTab = 'modules';
    this.setDesktopTab('codex');
  }

  getBattleSetupSummary(): {
    difficultyId: RunDifficultyId;
    difficultyName: string;
    difficultyDetail: string;
    weaponId: string;
    weaponName: string;
    weaponIcon: string;
  } {
    const weapon = this.content.weapons.get(this.selectedStartingWeaponId) ?? this.content.startingWeapons[0];
    return {
      difficultyId: this.runDifficulty.id,
      difficultyName: this.runDifficulty.name,
      difficultyDetail: this.runDifficulty.shortName,
      weaponId: weapon?.id ?? 'builtin.weapon.magic-wand',
      weaponName: weapon?.name ?? '魔法法器',
      weaponIcon: weapon?.icon ?? '✦',
    };
  }

  setRunDifficulty(id: RunDifficultyId): void {
    if (!gameState.is('menu')) return;
    this.meta = selectRunDifficulty(this.meta, id);
    this.runDifficulty = getRunDifficultyPreset(this.meta.selectedDifficulty);
    this.objectiveBeats = getObjectiveBeats(this.runDifficulty);
    this.commitMetaState();
  }

  setStartingWeapon(id: string): void {
    if (!gameState.is('menu')) return;
    if (!this.content.startingWeapons.some((weapon) => weapon.id === id)) return;
    this.selectedStartingWeaponId = id;
  }

  startConfiguredRun(): void {
    if (!gameState.is('menu') || this.externalUiOpen) return;
    this.startGame();
  }

  // ──────────────────────────── Input Routing ────────────────────────────

  private onKeyDown(e: KeyboardEvent) {
    if (this.externalUiOpen) return;
    if (e.code === 'F3') {
      e.preventDefault();
      this.perfEnabled = !this.perfEnabled;
      this.enemyGrid.setMetricsEnabled(this.perfEnabled);
      this.projectileCombat.setMetricsEnabled(this.perfEnabled);
      return;
    }
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
        if ((e.code === 'Enter' || e.code === 'Space') && this.canContinueEndless()) {
          e.preventDefault();
          this.continueEndlessRun();
        } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
          this.returnToHome();
        }
        break;
      case 'menu':
        this.handleDesktopKey(e);
        break;
    }
  }

  private onClick(e: MouseEvent) {
    if (this.externalUiOpen) return;
    if (gameState.is('menu')) {
      this.handleDesktopClick(e);
    } else if (gameState.is('gameover')) {
      this.handleGameOverPointer(e.clientX, e.clientY);
    } else if (gameState.is('upgrading')) {
      this.handleClickUpgrade(e);
    } else if (gameState.is('playing')) {
      this.handlePlayingHudPointer(e.clientX, e.clientY);
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.externalUiOpen) return;
    if (!gameState.is('menu')) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.hoveredStarId = this.desktopTab === 'growth' ? this.getMetaStarIdAtPoint(x, y) : undefined;
  }

  private onTouchStart(e: TouchEvent) {
    if (this.externalUiOpen) return;
    if (gameState.is('menu')) {
      this.handleDesktopClick(e);
    } else if (gameState.is('gameover')) {
      const rect = this.canvas.getBoundingClientRect();
      this.handleGameOverCanvasPoint(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
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
      const muted = this.audio.toggleMuted();
      void this.persistMuted(muted).catch((error) => console.error('Failed to persist audio setting', error));
      return true;
    }

    const pauseBtn = this.renderer.getPauseButtonRect();
    if (x >= pauseBtn.x && x <= pauseBtn.x + pauseBtn.w && y >= pauseBtn.y && y <= pauseBtn.y + pauseBtn.h) {
      gameState.transition('pause');
      return true;
    }
    return false;
  }

  private handleGameOverPointer(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.handleGameOverCanvasPoint(clientX - rect.left, clientY - rect.top);
  }

  private handleGameOverCanvasPoint(x: number, y: number) {
    const canContinueEndless = this.canContinueEndless();
    const buttons = this.renderer.getGameOverButtonRects(canContinueEndless);
    const endlessButton = buttons.endless;
    if (endlessButton && this.isPointInRect(x, y, endlessButton)) {
      this.continueEndlessRun();
      return;
    }
    if (this.isPointInRect(x, y, buttons.desktop) || !canContinueEndless) {
      this.returnToHome();
    }
  }

  private isPointInRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private handleDesktopKey(e: KeyboardEvent) {
    if (e.code === 'Digit1') this.setDesktopTab('home');
    else if (e.code === 'Digit2') this.setDesktopTab('skins');
    else if (e.code === 'Digit3') this.setDesktopTab('growth');
    else if (e.code === 'Digit4') this.setDesktopTab('codex');
    else if (this.desktopTab === 'codex' && e.code === 'KeyQ') this.shiftCodexTab(-1);
    else if (this.desktopTab === 'codex' && e.code === 'KeyE') this.shiftCodexTab(1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.shiftDesktopTab(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.shiftDesktopTab(1);
  }

  private shiftDesktopTab(dir: number) {
    const tabs: DesktopTab[] = ['home', 'skins', 'growth', 'codex'];
    const index = tabs.indexOf(this.desktopTab);
    this.setDesktopTab(tabs[(index + dir + tabs.length) % tabs.length]);
  }

  private setDesktopTab(tab: DesktopTab) {
    if (this.desktopTab === tab) return;
    this.desktopTab = tab;
    if (tab !== 'growth') this.hoveredStarId = undefined;
    eventBus.emit(GameEvent.DESKTOP_TAB_CHANGE, tab);
  }

  private returnToHome() {
    this.setDesktopTab('home');
    gameState.reset();
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

    if (this.desktopTab === 'growth') {
      const nodeId = this.getMetaStarIdAtPoint(x, y);
      if (nodeId) {
        this.hoveredStarId = nodeId;
        const nextMeta = buyMetaUpgrade(this.meta, nodeId);
        if (nextMeta !== this.meta) {
          this.meta = nextMeta;
          this.commitMetaState();
        }
      }
      return;
    }

    if (this.desktopTab === 'skins') {
      const cards = this.renderer.getSkinCardRects();
      for (const card of cards) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.meta = selectSkin(this.meta, CHARACTER_SKINS[card.index].id);
          this.commitMetaState();
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
    this.runSeed = this.configuredRunSeed ?? createRunSeed();
    this.ruleRandom.reset(this.runSeed);
    this.simulationClock.reset();
    this.resetRunPerformanceStats();
    this.runDifficulty = getRunDifficultyPreset(this.meta.selectedDifficulty);
    this.objectiveBeats = getObjectiveBeats(this.runDifficulty);
    resetEnemyIds();
    this.releaseRunEntities();
    this.player = createPlayer(this.meta.selectedSkin);
    this.projectileCombatContext.player = this.player;
    this.player.shards = getInitialShards(this.meta);
    const startingDefinition = this.content.weapons.get(this.selectedStartingWeaponId) ??
      this.content.getWeaponByType(WeaponType.MAGIC_WAND);
    this.player.weapons.push(createWeapon(startingDefinition.legacyType, startingDefinition));
    this.refreshWeaponRefs();
    this.activeBoss = undefined;
    this.minimapEnemies.length = 0;
    this.minimapObstacles.length = 0;
    this.visibleObstacles.length = 0;
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
    this.mapCleanupTimer = 0;
    this.lastDamageSource = undefined;
    this.gameOverStats = undefined;
    this.endlessModeActive = false;
    this.paidSoulFireReward = 0;
    this.openingDraftActive = false;
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
    this.openingDraftActive = hasOpeningCardDraft(this.meta);
    if (this.openingDraftActive) this.showUpgradeScreen();
  }

  // ──────────────────────────── Game Loop ────────────────────────────

  private resetRunPerformanceStats() {
    this.perfStats.fps = 0;
    this.perfStats.updateMs = 0;
    this.perfStats.renderMs = 0;
    this.perfStats.frameMs = 0;
    this.perfStats.simulationSteps = 0;
    this.perfStats.droppedSimulationMs = 0;
    this.perfStats.movementMs = 0;
    this.perfStats.enemiesMs = 0;
    this.perfStats.weaponsMs = 0;
    this.perfStats.combatMs = 0;
    this.perfStats.effectsMs = 0;
    this.perfStats.particleRenderMs = 0;
    this.perfStats.particleRenderQuality = 'full';
    this.perfStats.visibleParticles = 0;
    this.perfStats.particleRenderCost = 0;
    this.perfStats.particleEmissions = 0;
    this.perfStats.particleEmissionDrops = 0;
    this.perfStats.runSeed = this.runSeed;
    this.perfStats.enemies = 0;
    this.perfStats.projectiles = 0;
    this.perfStats.enemyProjectiles = 0;
    this.perfStats.particles = 0;
    this.perfStats.damageNumbers = 0;
    this.perfStats.xpGems = 0;
    this.perfStats.enemyCapFrames = 0;
    this.perfStats.projectileCapFrames = 0;
    this.perfStats.enemyProjectileCapFrames = 0;
    this.perfStats.particleCapFrames = 0;
    this.perfStats.damageNumberCapFrames = 0;
    this.perfStats.spatialBuckets = 0;
    this.perfStats.spatialBucketCapacity = this.enemyGrid.bucketCapacity;
    this.perfStats.spatialQueries = 0;
    this.perfStats.spatialCandidateChecks = 0;
    this.perfStats.spatialMatches = 0;
    this.perfStats.sweptCollisionTests = 0;
    this.perfStats.spatialEarlyExits = 0;
    this.perfStats.projectileCollisionCandidates = 0;
    this.perfStats.projectileHits = 0;
    this.perfStats.poolMisses = 0;
    this.perfStats.particlePoolMisses = 0;
    this.perfStats.projectilePoolMisses = 0;
    this.perfStats.canvasDpr = this.renderer.getDpr();
    this.perfStats.glowSpriteCacheEntries = this.renderer.getGlowSpriteCacheSize();
    resetPoolMetrics();
  }

  private loop(time: number) {
    this.animationFrameId = 0;
    if (this.destroyed || !this.hostVisible) return;
    const rawDt = Math.max(0, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const frameStart = performance.now();
    this.framePhaseTimes.movementMs = 0;
    this.framePhaseTimes.enemiesMs = 0;
    this.framePhaseTimes.weaponsMs = 0;
    this.framePhaseTimes.combatMs = 0;
    this.framePhaseTimes.effectsMs = 0;
    this.frameParticleRenderMs = 0;
    this.frameVisibleParticles = 0;
    this.frameParticleRenderCost = 0;
    this.frameParticleRenderQuality = 'full';
    beginParticleEmissionFrame();
    if (this.perfEnabled) {
      this.enemyGrid.resetMetrics();
      this.projectileCombat.resetMetrics();
    }

    let simulationSteps = 0;
    const updateStart = performance.now();
    if (gameState.is('playing')) {
      const result = this.simulationClock.advance(rawDt, this.handleSimulationStep);
      simulationSteps = result.steps;
    } else {
      this.simulationClock.discardPendingTime();
    }
    endParticleEmissionFrame();
    const updateMs = performance.now() - updateStart;

    const renderStart = performance.now();
    this.render(time / 1000);
    const renderMs = performance.now() - renderStart;
    this.recordCapacitySaturation();
    this.recordPerformanceStats(
      rawDt,
      updateMs,
      renderMs,
      performance.now() - frameStart,
      simulationSteps
    );
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  private commitMetaState() {
    void this.persistMeta(this.meta).catch((error) => console.error('Failed to persist meta progression', error));
  }

  private recordPerformanceStats(
    rawDt: number,
    updateMs: number,
    renderMs: number,
    frameMs: number,
    simulationSteps: number
  ) {
    this.perfStats.fps = smoothPerformanceValue(this.perfStats.fps, rawDt > 0 ? 1 / rawDt : 0);
    this.perfStats.updateMs = smoothPerformanceValue(this.perfStats.updateMs, updateMs);
    this.perfStats.renderMs = smoothPerformanceValue(this.perfStats.renderMs, renderMs);
    this.perfStats.frameMs = smoothPerformanceValue(this.perfStats.frameMs, frameMs);
    this.perfStats.simulationSteps = simulationSteps;
    this.perfStats.droppedSimulationMs = this.simulationClock.totalDroppedSeconds * 1000;
    this.perfStats.movementMs = smoothPerformanceValue(this.perfStats.movementMs, this.framePhaseTimes.movementMs);
    this.perfStats.enemiesMs = smoothPerformanceValue(this.perfStats.enemiesMs, this.framePhaseTimes.enemiesMs);
    this.perfStats.weaponsMs = smoothPerformanceValue(this.perfStats.weaponsMs, this.framePhaseTimes.weaponsMs);
    this.perfStats.combatMs = smoothPerformanceValue(this.perfStats.combatMs, this.framePhaseTimes.combatMs);
    this.perfStats.effectsMs = smoothPerformanceValue(this.perfStats.effectsMs, this.framePhaseTimes.effectsMs);
    this.perfStats.particleRenderMs = smoothPerformanceValue(
      this.perfStats.particleRenderMs,
      this.frameParticleRenderMs
    );
    this.perfStats.particleRenderQuality = this.frameParticleRenderQuality;
    this.perfStats.visibleParticles = this.frameVisibleParticles;
    this.perfStats.particleRenderCost = this.frameParticleRenderCost;
    this.perfStats.particleEmissions = getParticleEmissionsThisFrame();
    this.perfStats.particleEmissionDrops = getParticleEmissionDropsThisFrame();
    this.perfStats.runSeed = this.runSeed;
    this.perfStats.enemies = this.enemies.length;
    this.perfStats.projectiles = this.projectiles.length;
    this.perfStats.enemyProjectiles = this.enemyProjectiles.length;
    this.perfStats.particles = this.particles.length;
    this.perfStats.damageNumbers = this.damageNumbers.length;
    this.perfStats.xpGems = this.xpGems.length;
    this.perfStats.spatialBuckets = this.enemyGrid.activeBucketCount;
    this.perfStats.spatialBucketCapacity = this.enemyGrid.bucketCapacity;
    const spatialMetrics = this.enemyGrid.metrics;
    this.perfStats.spatialQueries = spatialMetrics.queries;
    this.perfStats.spatialCandidateChecks = spatialMetrics.candidateChecks;
    this.perfStats.spatialMatches = spatialMetrics.matches;
    this.perfStats.sweptCollisionTests = spatialMetrics.sweptCollisionTests;
    this.perfStats.spatialEarlyExits = spatialMetrics.earlyExits;
    const combatMetrics = this.projectileCombat.metrics;
    this.perfStats.projectileCollisionCandidates = combatMetrics.collisionCandidates;
    this.perfStats.projectileHits = combatMetrics.hits;
    this.perfStats.poolMisses =
      pools.particles.factoryMisses +
      pools.damageNumbers.factoryMisses +
      pools.projectiles.factoryMisses +
      pools.enemyProjectiles.factoryMisses +
      pools.xpGems.factoryMisses +
      pools.enemies.factoryMisses;
    this.perfStats.particlePoolMisses = pools.particles.factoryMisses;
    this.perfStats.projectilePoolMisses = pools.projectiles.factoryMisses;
    this.perfStats.canvasDpr = this.renderer.getDpr();
    this.perfStats.glowSpriteCacheEntries = this.renderer.getGlowSpriteCacheSize();
  }

  private recordCapacitySaturation() {
    if (!this.perfEnabled || !gameState.is('playing')) return;
    if (this.enemies.length >= MAX_ENEMIES) this.perfStats.enemyCapFrames++;
    if (this.projectiles.length >= MAX_ACTIVE_PLAYER_PROJECTILES) this.perfStats.projectileCapFrames++;
    if (this.enemyProjectiles.length >= MAX_ACTIVE_ENEMY_PROJECTILES) this.perfStats.enemyProjectileCapFrames++;
    if (this.particles.length >= MAX_ACTIVE_PARTICLES) this.perfStats.particleCapFrames++;
    if (this.damageNumbers.length >= MAX_ACTIVE_DAMAGE_NUMBERS) this.perfStats.damageNumberCapFrames++;
  }

  private beginUpdatePhase(): number {
    return this.perfEnabled ? performance.now() : 0;
  }

  private finishUpdatePhase(phase: keyof UpdatePhaseTimes, startedAt: number): number {
    if (!this.perfEnabled) return 0;
    const now = performance.now();
    this.framePhaseTimes[phase] += now - startedAt;
    return now;
  }

  private update(dt: number) {
    if (!gameState.is('playing')) return;
    let phaseStart = this.beginUpdatePhase();

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

    updateCamera(this.camera, this.player, dt);
    phaseStart = this.finishUpdatePhase('movementMs', phaseStart);
    this.spawner.update(this.enemies, this.player, this.elapsed, this.difficulty, dt, this.player.curse, this.runDifficulty);
    this.updateEnemies(dt);
    this.updateEnemyProjectiles(dt);
    updateEnemyAttacks(this.enemies, this.player, this.enemyProjectiles, dt, this.runDifficulty);
    this.enemyGrid.rebuild(this.enemies);
    this.updateMinimapEnemyCache(dt);
    phaseStart = this.finishUpdatePhase('enemiesMs', phaseStart);

    for (const w of this.player.weapons) {
      updateWeapon(
        w,
        this.player,
        this.projectiles,
        dt,
        this.enemyQuery,
        this.content.weaponBehaviors,
        this.ruleRandom
      );
    }

    if (this.garlicWeapon) {
      const hitCount = updateGarlicAuraInto(
        this.garlicWeapon,
        this.player,
        dt,
        this.garlicTickTimer,
        this.enemyQuery,
        this.garlicHits
      );
      const hasRepulsion = (this.garlicWeapon.modifierMask & GENERIC_MODIFIER_MASK[GenericModifierType.REPULSION_FIELD]) !== 0;
      for (let i = 0; i < hitCount; i++) {
        const hit = this.garlicHits[i];
        pushDamageNumber(this.damageNumbers, hit.x, hit.y, hit.dmg, '#cccc66', 14);
        spawnHitParticles(this.particles, hit.x, hit.y, '#cccc66', 3, GARLIC_HIT_PARTICLE_OPTIONS);
        if (hasRepulsion && i < 4) {
          spawnHitParticles(
            this.particles,
            hit.x,
            hit.y,
            REPULSION_VISUAL.accent,
            4,
            REPULSION_HIT_PARTICLE_OPTIONS
          );
          if (i === 0) eventBus.emit(GameEvent.MODIFIER_TRIGGER, GenericModifierType.REPULSION_FIELD);
        }
      }
    }
    phaseStart = this.finishUpdatePhase('weaponsMs', phaseStart);

    updateBiblePositions(this.projectiles, this.player);
    this.projectileCombat.update(this.projectileCombatContext, dt);
    this.cleanupMapObstacles(dt);

    for (const e of this.enemies) {
      if (e.hp <= 0) this.onEnemyDeath(e);
    }
    this.releaseDeadEnemies();
    this.refreshActiveBoss();
    phaseStart = this.finishUpdatePhase('combatMs', phaseStart);

    this.updateXPGems(dt);

    if (this.levelUpQueue > 0 && gameState.is('playing')) {
      this.levelUpQueue--;
      this.showUpgradeScreen();
    }

    this.updateAndReleaseParticles(dt);
    this.updateAndReleaseDamageNumbers(dt);

    this.checkPlayerDeath();

    if (!this.endlessModeActive && this.elapsed >= this.runDifficulty.duration && gameState.is('playing')) {
      gameState.transition('timeout');
      this.recordRunEnd();
      eventBus.emit(GameEvent.GAME_OVER, {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
      });
    }
    this.finishUpdatePhase('effectsMs', phaseStart);
  }

  // ──────────────────────────── Update Sub-systems ────────────────────────────

  private releaseRunEntities() {
    this.minimapEnemies.length = 0;
    this.visibleParticles.length = 0;
    pools.enemies.releaseAll(this.enemies);
    pools.projectiles.releaseAll(this.projectiles);
    pools.enemyProjectiles.releaseAll(this.enemyProjectiles);
    pools.xpGems.releaseAll(this.xpGems);
    pools.particles.releaseAll(this.particles);
    pools.damageNumbers.releaseAll(this.damageNumbers);
    this.enemyGrid.rebuild(this.enemies);
    this.activeBoss = undefined;
  }

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

  private updateAndReleaseParticles(dt: number) {
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const p = this.particles[read];
      if (updateParticle(p, dt)) {
        if (write !== read) this.particles[write] = p;
        write++;
      } else {
        pools.particles.release(p);
      }
    }
    this.particles.length = write;
  }

  private updateAndReleaseDamageNumbers(dt: number) {
    let write = 0;
    for (let read = 0; read < this.damageNumbers.length; read++) {
      const d = this.damageNumbers[read];
      if (updateDamageNumber(d, dt)) {
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
    this.mapSystem.collectNearby(
      this.player.x - MINIMAP_WORLD_HALF_SIZE,
      this.player.y - MINIMAP_WORLD_HALF_SIZE,
      this.player.x + MINIMAP_WORLD_HALF_SIZE,
      this.player.y + MINIMAP_WORLD_HALF_SIZE,
      this.minimapObstacles
    );
  }

  private cleanupMapObstacles(dt: number) {
    this.mapCleanupTimer += dt;
    if (this.mapCleanupTimer < 2) return;
    this.mapCleanupTimer = 0;
    this.mapSystem.cleanupDestroyed();
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

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!updateEnemy(e, this.player, dt, this.mapSystem)) continue;
      if (isCollidingWithPlayer(e, this.player) && e.contactCooldown <= 0) {
        const dmg = damagePlayer(this.player, e.damage);
        if (dmg > 0) {
          this.lastDamageSource = {
            enemyName: this.content.getEnemyByType(e.type).name,
            damage: dmg,
            time: this.elapsed,
          };
          eventBus.emit(GameEvent.PLAYER_HIT, dmg, e);
          shakeCamera(this.camera, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY);
          this.damageFlashTimer = 0.35;
          pushDamageNumber(this.damageNumbers, this.player.x, this.player.y, dmg, COLORS.danger, 20);
          spawnHitParticles(
            this.particles,
            this.player.x,
            this.player.y,
            COLORS.danger,
            10,
            PLAYER_CONTACT_PARTICLE_OPTIONS
          );
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
            enemyName: this.content.getEnemyByType(p.sourceType).name,
            damage: dmg,
            time: this.elapsed,
          };
          eventBus.emit(GameEvent.PLAYER_HIT, dmg, p);
          shakeCamera(this.camera, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY * 0.75);
          this.damageFlashTimer = 0.28;
          pushDamageNumber(this.damageNumbers, this.player.x, this.player.y, dmg, COLORS.danger, 18);
          spawnHitParticles(
            this.particles,
            this.player.x,
            this.player.y,
            p.color,
            8,
            PLAYER_PROJECTILE_HIT_PARTICLE_OPTIONS
          );
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
        spawnXPParticles(this.particles, gem.x, gem.y, 5, XP_PARTICLE_OPTIONS);
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
    spawnDeathParticles(
      this.particles,
      e.x,
      e.y,
      this.content.getEnemyByType(e.type).color,
      particleCount,
      isElite ? ELITE_DEATH_PARTICLE_OPTIONS : NORMAL_DEATH_PARTICLE_OPTIONS
    );
    if (isElite) {
      spawnDeathParticles(
        this.particles,
        e.x,
        e.y,
        '#ffd700',
        10,
        ELITE_ACCENT_PARTICLE_OPTIONS
      );
    }
    if (shouldSplitOnDeath(e)) {
      this.spawnDeathSplitMinions(e);
    }

    this.xpGems.push(createXPGem(e.x, e.y, e.xpValue));

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
        1,
        this.ruleRandom
      );
      child.hp *= 0.55;
      child.maxHp = child.hp;
      child.damage *= 0.7;
      child.xpValue = Math.max(1, child.xpValue * 0.35);
      child.knockbackX = Math.cos(angle) * 80;
      child.knockbackY = Math.sin(angle) * 80;
      this.enemies.push(child);
    }
    spawnHitParticles(this.particles, e.x, e.y, '#d6b48a', 12, SPLIT_PARTICLE_OPTIONS);
  }

  private checkPlayerDeath() {
    if (this.player.hp > 0) return;
    if (hasPassive(this.player, PassiveType.REVIVE)) {
      this.player.hp = this.player.maxHp * 0.5;
      this.player.invTime = 3;
      removePassive(this.player, PassiveType.REVIVE);
      shakeCamera(this.camera, 0.6, 12);
      spawnExplosionParticles(
        this.particles,
        this.player.x,
        this.player.y,
        '#ffd700',
        40,
        REVIVE_PARTICLE_OPTIONS
      );
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
    }, this.runDifficulty, {
      previousSoulFireReward: this.paidSoulFireReward,
      countRun: !this.endlessModeActive,
    });
    this.commitMetaState();
    this.paidSoulFireReward += this.meta.soulFire - previousSoulFire;
    this.gameOverStats = {
      time: this.elapsed,
      kills: this.killCount,
      level: this.player.level,
      weaponNames: this.player.weapons.map((weapon) => weapon.name),
      soulFireEarned: this.meta.soulFire - previousSoulFire,
      totalSoulFire: this.meta.soulFire,
      runDuration: this.runDifficulty.duration,
      deathCause: this.getDeathCause(),
      advice: this.getRunAdvice(),
    };
  }

  private canContinueEndless(): boolean {
    return !!this.gameOverStats
      && this.runDifficulty.id === 'nightmare'
      && !this.endlessModeActive
      && this.gameOverStats.time >= this.runDifficulty.duration;
  }

  private continueEndlessRun() {
    if (!this.canContinueEndless()) return;
    if (!gameState.transition('continueEndless')) return;
    this.endlessModeActive = true;
    this.gameOverStats = undefined;
    this.objectiveMessage = '无尽模式：继续推进夜潮，尽可能活得更久。';
    this.objectiveTimer = 4;
    this.lastDamageSource = undefined;
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
    if (!this.endlessModeActive && this.elapsed >= this.runDifficulty.duration) return undefined;
    if (!this.lastDamageSource) return '被夜潮包围';
    const secondsAgo = Math.max(0, Math.floor(this.elapsed - this.lastDamageSource.time));
    return `${this.lastDamageSource.enemyName}造成${this.lastDamageSource.damage}伤害 (${secondsAgo}s前)`;
  }

  private getRunAdvice(): string {
    if (this.endlessModeActive) return '无尽模式已记录，后续会继续抬高血量、密度和复杂怪权重。';
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
    if (this.openingDraftActive) this.finishShop();
  }

  private rerollShop() {
    this.shop.reroll(this.player, this.meta);
  }

  private finishShop() {
    this.openingDraftActive = false;
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
    const action = this.shop.handleClick(x, y, w, h, this.player);
    if (action?.type === 'buy') {
      this.buySelectedUpgrade();
    } else if (action?.type === 'reroll') {
      this.rerollShop();
    } else if (action?.type === 'continue') {
      this.finishShop();
    } else if (action?.type === 'sell') {
      const sold = this.shop.sellCard(this.player, action.cardId);
      if (sold) this.refreshWeaponRefs();
    }
  }

  // ──────────────────────────── Render ────────────────────────────

  private render(timeSeconds: number) {
    this.renderer.beginFrame(timeSeconds);
    this.renderer.clear();

    if (gameState.is('menu')) {
      this.renderer.drawDesktop(
        this.meta,
        this.desktopTab,
        this.codexTab,
        this.hoveredStarId
      );
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
      this.renderer.drawGarlicAura(
        this.player,
        getGarlicRadius(this.garlicWeapon, this.player),
        this.garlicWeapon.modifierMask,
        getWeaponEvolutionIds(this.garlicWeapon)
      );
    }

    this.renderer.drawPickupRange(this.player);
    this.renderer.drawPlayer(this.player);

    const particleRenderStart = this.perfEnabled ? performance.now() : 0;
    this.visibleParticles.length = 0;
    let particleRenderCost = 0;
    for (const p of this.particles) {
      if (this.renderer.isOnScreen(p.x, p.y, this.camera, Math.max(p.radius, p.glowRadius ?? 0) + 16)) {
        this.visibleParticles.push(p);
        particleRenderCost += this.renderer.estimateParticleRenderCost(p);
      }
    }
    const particleRenderQuality = this.renderer.selectParticleRenderQuality(particleRenderCost);
    for (const particle of this.visibleParticles) {
      this.renderer.drawParticle(particle, particleRenderQuality);
    }
    this.frameVisibleParticles = this.visibleParticles.length;
    this.frameParticleRenderCost = particleRenderCost;
    this.frameParticleRenderQuality = particleRenderQuality;
    if (this.perfEnabled) this.frameParticleRenderMs = performance.now() - particleRenderStart;
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
    this.renderer.drawMinimap(this.player, this.minimapEnemies, this.minimapObstacles);
    this.renderer.drawAudioButton(this.audio.isMuted());
    this.renderer.drawPauseButton();
    if (gameState.is('playing')) {
      this.renderer.drawVirtualJoystick(this.input.getJoystickState());
    }

    if (this.activeBoss?.hp && this.activeBoss.hp > 0) {
      this.renderer.drawBossBar(
        this.content.getEnemyByType(this.activeBoss.type).name,
        this.activeBoss.hp,
        this.activeBoss.maxHp
      );
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
        this.shop.getSellableCards(this.player),
        this.shop.canFreeReroll(),
        this.shop.getRerollCost(this.meta),
        this.shop.canPaidReroll(this.meta)
      );
    } else if (gameState.is('gameover')) {
      this.renderer.drawGameOver(this.gameOverStats ?? {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
        weaponNames: this.player.weapons.map((weapon) => weapon.name),
        soulFireEarned: 0,
        totalSoulFire: this.meta.soulFire,
        runDuration: this.runDifficulty.duration,
        deathCause: this.getDeathCause(),
        advice: this.getRunAdvice(),
      }, this.player, this.canContinueEndless(), this.endlessModeActive);
    }
  }
}
