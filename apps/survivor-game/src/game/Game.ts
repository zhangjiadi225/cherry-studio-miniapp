import {
  GameState, Enemy, Projectile, XPGem, Particle, DamageNumber,
  Camera, WeaponType, PassiveType, Weapon
} from './types';
import {
  GAME_DURATION, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY, COLORS, ENEMY_DATA, WEAPON_DATA,
  HEALTH_DROP_CHANCE, HEALTH_DROP_AMOUNT, CONTACT_COOLDOWN,
  MAGIC_CIRCLE_HEAL_RATE, MAGIC_CIRCLE_RADIUS,
} from './constants';
import { Input } from './systems/input/Input';
import { Renderer } from './Renderer';
import { createPlayer, updatePlayer, damagePlayer, collectShards, hasPassive, tryBloodZoneHeal } from './systems/player/Player';
import { updateEnemy, isCollidingWithPlayer, resetEnemyIds } from './systems/enemy/Enemy';
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
  spawnExplosionParticles, spawnHealParticles, spawnLevelUpParticles
} from './effects/Particle';
import { createDamageNumber, updateDamageNumber } from './effects/DamageNumber';
import {
  type CodexTab, type DesktopTab, type MetaState,
  loadMetaState, applyRunReward, getInitialShards,
  buyMetaUpgrade, selectSkin, META_UPGRADES, CHARACTER_SKINS,
} from './systems/meta/MetaProgression';
import { MapSystem } from './systems/map/MapSystem';
import { pools, clearAllPools } from './utils/PoolManager';
import { eventBus, gameState, GameEvent } from './events';

type ObjectiveBeat = {
  time: number;
  message: string;
  eliteAmbush?: number;
};

const OBJECTIVE_BEATS: ObjectiveBeat[] = [
  { time: 12, message: '目标：收集魂晶，升级并购买构筑牌' },
  { time: 90, message: '目标：准备补给，夜潮精英将在3:00出现' },
  { time: 180, message: '夜潮精英出现，击败它获取大量魂晶', eliteAmbush: 2 },
  { time: 260, message: 'Boss即将到来，保留魂晶购买补给' },
];

export class Game {
  private canvas: HTMLCanvasElement;
  private input: Input;
  private renderer: Renderer;
  private spawner = new Spawner();
  private audio = new AudioSystem();
  private projectileCombat = new ProjectileCombat();
  private shop = new ShopSystem();
  private mapSystem = new MapSystem();
  private camera: Camera;
  private meta: MetaState = loadMetaState();
  private desktopTab: DesktopTab = 'start';
  private codexTab: CodexTab = 'weapons';
  private player = createPlayer();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
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
    deathCause?: string;
    advice?: string;
  };
  private readonly handleKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private readonly handleCanvasClick = (e: MouseEvent) => this.onClick(e);
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

    window.addEventListener('keydown', this.handleKeyDown);
    canvas.addEventListener('click', this.handleCanvasClick);
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
    if (e.code === 'Digit1') this.desktopTab = 'start';
    else if (e.code === 'Digit2') this.desktopTab = 'growth';
    else if (e.code === 'Digit3') this.desktopTab = 'skins';
    else if (e.code === 'Digit4') this.desktopTab = 'codex';
    else if (this.desktopTab === 'codex' && e.code === 'KeyQ') this.shiftCodexTab(-1);
    else if (this.desktopTab === 'codex' && e.code === 'KeyE') this.shiftCodexTab(1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.shiftDesktopTab(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.shiftDesktopTab(1);
    else if (e.code === 'Enter' || e.code === 'Space') this.startGame();
  }

  private shiftDesktopTab(dir: number) {
    const tabs: DesktopTab[] = ['start', 'growth', 'skins', 'codex'];
    const index = tabs.indexOf(this.desktopTab);
    this.desktopTab = tabs[(index + dir + tabs.length) % tabs.length];
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
    const w = this.renderer.getWidth();
    const h = this.renderer.getHeight();

    const tabs = this.renderer.getDesktopTabRects();
    for (const tab of tabs) {
      if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
        this.desktopTab = tab.id;
        return;
      }
    }

    if (this.desktopTab === 'start') {
      const button = this.renderer.getDesktopStartButtonRect();
      if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
        this.startGame();
      }
      return;
    }

    if (this.desktopTab === 'growth') {
      const layout = this.getDesktopCardLayout(META_UPGRADES.length, 3, 210, 112, 14, 222);
      for (let i = 0; i < META_UPGRADES.length; i++) {
        const card = layout(i);
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.meta = buyMetaUpgrade(this.meta, META_UPGRADES[i].id);
          return;
        }
      }
      return;
    }

    if (this.desktopTab === 'skins') {
      const layout = this.getDesktopCardLayout(CHARACTER_SKINS.length, 3, 236, 318, 18, 218);
      for (let i = 0; i < CHARACTER_SKINS.length; i++) {
        const card = layout(i);
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.meta = selectSkin(this.meta, CHARACTER_SKINS[i].id);
          return;
        }
      }
      return;
    }

    if (this.desktopTab === 'codex') {
      const tabs: CodexTab[] = ['weapons', 'passives', 'enemies', 'modules'];
      const tabW = 128;
      const tabH = 38;
      const gap = 12;
      const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
      const startX = w / 2 - totalW / 2;
      const tabY = 214;
      for (let i = 0; i < tabs.length; i++) {
        const tx = startX + i * (tabW + gap);
        if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + tabH) {
          this.codexTab = tabs[i];
          return;
        }
      }
    }
  }

  private getDesktopCardLayout(
    count: number,
    columns: number,
    cardW: number,
    cardH: number,
    gap: number,
    startY: number
  ) {
    const w = this.renderer.getWidth();
    const visibleColumns = Math.min(columns, count);
    const totalW = visibleColumns * cardW + (visibleColumns - 1) * gap;
    const startX = w / 2 - totalW / 2;
    return (index: number) => ({
      x: startX + (index % columns) * (cardW + gap),
      y: startY + Math.floor(index / columns) * (cardH + gap),
      w: cardW,
      h: cardH,
    });
  }

  // ──────────────────────────── Game Lifecycle ────────────────────────────

  private startGame() {
    gameState.transition('start');
    resetEnemyIds();
    clearAllPools();
    this.player = createPlayer(this.meta.selectedSkin);
    this.player.shards = getInitialShards(this.meta);
    this.player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    this.refreshWeaponRefs();
    this.activeBoss = undefined;
    this.enemies = [];
    this.projectiles = [];
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
    this.objectiveMessage = '目标：活到3:00，完成第一轮构筑';
    this.objectiveTimer = 4;
    this.damageFlashTimer = 0;
    this.levelUpFlashTimer = 0;
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
      const dt = Math.min(0.05, rawDt);
      this.update(dt);
      this.render();
    }
    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  private update(dt: number) {
    if (!gameState.is('playing')) return;

    this.elapsed += dt;
    this.difficulty = Math.floor(this.elapsed / 30);

    for (const bossTime of [300, 600]) {
      if (this.elapsed >= bossTime - 10 && this.elapsed < bossTime && !this.bossWarningShown.has(bossTime)) {
        this.bossWarningTimer = 2;
        this.bossWarningName = bossTime >= 600 ? '亡灵领主' : '恶魔领主';
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
    this.spawner.update(this.enemies, this.player, this.elapsed, this.difficulty, dt, this.player.curse);
    this.updateEnemies(dt);

    for (const w of this.player.weapons) {
      updateWeapon(w, this.player, this.enemies, this.projectiles, dt);
    }

    if (this.garlicWeapon) {
      const { hits } = updateGarlicAura(this.garlicWeapon, this.player, this.enemies, dt, this.garlicTickTimer);
      for (const hit of hits) {
        this.damageNumbers.push(createDamageNumber(hit.x, hit.y, hit.dmg, '#cccc66', 14));
        spawnHitParticles(this.particles, hit.x, hit.y, '#cccc66', 3, {
          speed: 60, life: 0.3, radius: 2, type: 'circle', glow: true,
        });
      }
    }

    updateBiblePositions(this.projectiles, this.player);
    this.projectileCombat.update({
      projectiles: this.projectiles,
      enemies: this.enemies,
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

    if (this.elapsed >= GAME_DURATION && gameState.is('playing')) {
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
    const nearbyObs = this.mapSystem.getNearby(
      this.player.x - MAGIC_CIRCLE_RADIUS, this.player.y - MAGIC_CIRCLE_RADIUS,
      this.player.x + MAGIC_CIRCLE_RADIUS, this.player.y + MAGIC_CIRCLE_RADIUS
    );
    for (const obs of nearbyObs) {
      if (obs.type !== 'magic_circle') continue;
      const dx = this.player.x - obs.x;
      const dy = this.player.y - obs.y;
      if (dx * dx + dy * dy < obs.radius * obs.radius && this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + MAGIC_CIRCLE_HEAL_RATE * dt);
      }
    }
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
          this.damageNumbers.push(createDamageNumber(this.player.x, this.player.y, dmg, COLORS.danger, 20));
          spawnHitParticles(this.particles, this.player.x, this.player.y, COLORS.danger, 10, {
            speed: 180, life: 0.5, radius: 4, type: 'spark', glow: true,
          });
        }
        e.contactCooldown = CONTACT_COOLDOWN;
      }
    }
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

    this.xpGems.push(createXPGem(e.x, e.y, e.xpValue));

    const heal = tryBloodZoneHeal(this.player);
    if (heal > 0) {
      this.damageNumbers.push(createDamageNumber(this.player.x, this.player.y, heal, '#ff6666', 14));
    }

    if (Math.random() < HEALTH_DROP_CHANCE * this.player.luck) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + HEALTH_DROP_AMOUNT);
      this.damageNumbers.push(createDamageNumber(this.player.x, this.player.y, HEALTH_DROP_AMOUNT, COLORS.heal, 18));
      spawnHealParticles(this.particles, this.player.x, this.player.y, 6);
    }
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
    });
    this.gameOverStats = {
      time: this.elapsed,
      kills: this.killCount,
      level: this.player.level,
      weaponNames: this.player.weapons.map(w => WEAPON_DATA[w.type].name),
      soulFireEarned: this.meta.soulFire - previousSoulFire,
      totalSoulFire: this.meta.soulFire,
      deathCause: this.getDeathCause(),
      advice: this.getRunAdvice(),
    };
  }

  private updateObjectiveBeats(dt: number) {
    if (this.objectiveTimer > 0) this.objectiveTimer -= dt;

    for (const beat of OBJECTIVE_BEATS) {
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
          beat.eliteAmbush
        );
        shakeCamera(this.camera, 0.18, 5);
      }
    }
  }

  private getDeathCause(): string | undefined {
    if (this.elapsed >= GAME_DURATION) return undefined;
    if (!this.lastDamageSource) return '被夜潮包围';
    const secondsAgo = Math.max(0, Math.floor(this.elapsed - this.lastDamageSource.time));
    return `${this.lastDamageSource.enemyName}造成${this.lastDamageSource.damage}伤害 (${secondsAgo}s前)`;
  }

  private getRunAdvice(): string {
    if (this.elapsed >= GAME_DURATION) return '胜利完成，下一局尝试更高诅咒或模块构筑。';
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
    this.finishShop();
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

  private render() {
    this.renderer.clear();

    if (gameState.is('menu')) {
      this.renderer.drawDesktop(this.meta, this.desktopTab, this.codexTab);
      return;
    }

    this.renderer.beginWorld(this.camera);
    this.renderer.drawGround(this.camera);

    const visibleObstacles = this.mapSystem.getVisible(
      this.camera.x, this.camera.y,
      this.renderer.getWidth(), this.renderer.getHeight()
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

    if (this.garlicWeapon) {
      this.renderer.drawGarlicAura(this.player, getGarlicRadius(this.garlicWeapon, this.player));
    }

    this.renderer.drawPickupRange(this.player);
    this.renderer.drawPlayer(this.player);

    for (const p of this.particles) this.renderer.drawParticle(p);
    for (const d of this.damageNumbers) this.renderer.drawDamageNumber(d);

    this.renderer.endWorld();

    this.renderer.drawUI(
      this.player,
      this.elapsed,
      this.killCount,
      this.objectiveTimer > 0 ? this.objectiveMessage : undefined
    );
    this.renderer.drawMinimap(this.player, this.enemies);
    this.renderer.drawAudioButton(this.audio.isMuted());
    this.renderer.drawPauseButton();

    if (this.activeBoss?.hp && this.activeBoss.hp > 0) {
      this.renderer.drawBossBar(ENEMY_DATA[this.activeBoss.type].name, this.activeBoss.hp, this.activeBoss.maxHp);
    }
    if (this.bossWarningTimer > 0) this.renderer.drawBossWarning(this.bossWarningName, this.bossWarningTimer);
    if (this.damageFlashTimer > 0) this.renderer.drawDamageFlash(this.damageFlashTimer);
    if (this.levelUpFlashTimer > 0) this.renderer.drawLevelUpFlash(this.levelUpFlashTimer);

    if (gameState.is('paused')) {
      this.renderer.drawPaused();
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
        deathCause: this.getDeathCause(),
        advice: this.getRunAdvice(),
      });
    }
  }
}
