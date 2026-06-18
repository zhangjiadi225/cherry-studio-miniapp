import {
  GameState, Enemy, Projectile, XPGem, Particle, DamageNumber,
  Camera, UpgradeOption, WeaponType, PassiveType, GenericModifierType
} from './types';
import {
  GAME_DURATION, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY, COLORS, ENEMY_DATA, WEAPON_DATA,
  HEALTH_DROP_CHANCE, HEALTH_DROP_AMOUNT, CONTACT_COOLDOWN,
  MAGIC_CIRCLE_HEAL_RATE, MAGIC_CIRCLE_RADIUS,
  GENERIC_MODIFIER_DATA, GENERIC_MODIFIER_MASK,
} from './constants';
import { Input } from './systems/input/Input';
import { Renderer } from './Renderer';
import { createPlayer, updatePlayer, damagePlayer, addXP, hasPassive, tryBloodZoneHeal } from './systems/player/Player';
import { updateEnemy, damageEnemy, isCollidingWithPlayer, resetEnemyIds } from './systems/enemy/Enemy';
import { Spawner } from './systems/enemy/Spawner';
import {
  updateWeapon, updateProjectile, updateBiblePositions, getGarlicRadius,
  createWeapon, updateGarlicAura,
} from './systems/weapon/Weapon';
import { createCamera, updateCamera, shakeCamera } from './systems/camera/Camera';
import { createXPGem, updateXPGem } from './systems/player/XPGem';
import {
  updateParticle, spawnHitParticles, spawnDeathParticles, spawnXPParticles,
  spawnExplosionParticles, spawnHealParticles, spawnLevelUpParticles
} from './effects/Particle';
import { createDamageNumber, updateDamageNumber } from './effects/DamageNumber';
import { circlesOverlap, compactArray } from './utils/math';
import { generateUpgradeOptions, applyUpgrade } from './systems/weapon/Upgrade';
import {
  type CodexTab, type DesktopTab, type MetaState,
  loadMetaState, applyRunReward, getInitialGold, getMetaShopOptionCount,
  canPaidReroll, getMetaRerollCost, areModifierCardsUnlocked,
  buyMetaUpgrade, selectSkin, META_UPGRADES, CHARACTER_SKINS,
} from './systems/meta/MetaProgression';
import { MapSystem } from './systems/map/MapSystem';
import { pools, clearAllPools } from './utils/PoolManager';
import { eventBus, gameState, GameEvent } from './events';

export class Game {
  private canvas: HTMLCanvasElement;
  private input: Input;
  private renderer: Renderer;
  private spawner = new Spawner();
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
  private upgradeOptions: UpgradeOption[] = [];
  private selectedUpgrade = 0;
  private shopFreeRerollAvailable = true;
  private shopPaidRerollsThisRound = 0;
  private garlicTickTimer = { value: 0 };
  private lastTime = 0;
  private levelUpQueue = 0;
  private bossWarningTimer = 0;
  private bossWarningName = '';
  private bossWarningShown = new Set<number>();
  private damageFlashTimer = 0;
  private levelUpFlashTimer = 0;
  private enemyGrid = new Map<string, Enemy[]>();
  private readonly enemyGridCellSize = 240;
  private gameOverStats?: {
    time: number;
    kills: number;
    level: number;
    weaponNames: string[];
    soulFireEarned: number;
    totalSoulFire: number;
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.camera = createCamera();

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    canvas.addEventListener('click', (e) => this.onClick(e));
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && gameState.is('playing')) {
        gameState.transition('pause');
      }
    });

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ──────────────────────────── Input Routing ────────────────────────────

  private onKeyDown(e: KeyboardEvent) {
    switch (gameState.state) {
      case 'upgrading':
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.selectedUpgrade = Math.max(0, this.selectedUpgrade - 1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.selectedUpgrade = Math.min(this.upgradeOptions.length - 1, this.selectedUpgrade + 1);
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
      const btn = this.renderer.getPauseButtonRect();
      if (tx >= btn.x && tx <= btn.x + btn.w && ty >= btn.y && ty <= btn.y + btn.h) {
        gameState.transition('pause');
      }
    }
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

    const tabs: DesktopTab[] = ['start', 'growth', 'skins', 'codex'];
    const tabW = 132;
    const tabH = 42;
    const tabGap = 12;
    const tabsW = tabs.length * tabW + (tabs.length - 1) * tabGap;
    const tabsX = w / 2 - tabsW / 2;
    const tabsY = 82;
    for (let i = 0; i < tabs.length; i++) {
      const tx = tabsX + i * (tabW + tabGap);
      if (x >= tx && x <= tx + tabW && y >= tabsY && y <= tabsY + tabH) {
        this.desktopTab = tabs[i];
        return;
      }
    }

    if (this.desktopTab === 'start') {
      const panelW = Math.min(980, w - 72);
      const panelH = Math.min(420, h - 214);
      const panelX = w / 2 - panelW / 2;
      const panelY = 144;
      const btnW = 240;
      const btnH = 56;
      const btnX = panelX + 38;
      const btnY = panelY + panelH - 72;
      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
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
    this.player.gold = getInitialGold(this.meta);
    this.player.weapons.push(createWeapon(WeaponType.MAGIC_WAND));
    this.enemies = [];
    this.projectiles = [];
    this.xpGems = [];
    this.particles = [];
    this.damageNumbers = [];
    this.elapsed = 0;
    this.difficulty = 0;
    this.killCount = 0;
    this.levelUpQueue = 0;
    this.shopFreeRerollAvailable = true;
    this.shopPaidRerollsThisRound = 0;
    this.garlicTickTimer.value = 0;
    this.bossWarningTimer = 0;
    this.bossWarningName = '';
    this.bossWarningShown.clear();
    this.damageFlashTimer = 0;
    this.levelUpFlashTimer = 0;
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
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
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

    const garlicWeapon = this.player.weapons.find(w => w.type === WeaponType.GARLIC);
    if (garlicWeapon) {
      const { hits } = updateGarlicAura(garlicWeapon, this.player, this.enemies, dt, this.garlicTickTimer);
      for (const hit of hits) {
        this.damageNumbers.push(createDamageNumber(hit.x, hit.y, hit.dmg, '#cccc66', 14));
        spawnHitParticles(this.particles, hit.x, hit.y, '#cccc66', 3, {
          speed: 60, life: 0.3, radius: 2, type: 'circle', glow: true,
        });
      }
    }

    updateBiblePositions(this.projectiles, this.player);
    this.updateProjectiles(dt);

    for (const e of this.enemies) {
      if (e.hp <= 0) this.onEnemyDeath(e);
    }
    compactArray(this.enemies, (e) => e.hp <= 0);

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

  private releaseDeadProjectiles() {
    let write = 0;
    for (let read = 0; read < this.projectiles.length; read++) {
      const p = this.projectiles[read];
      if (p.life > 0) {
        if (write !== read) this.projectiles[write] = p;
        write++;
      } else {
        pools.projectiles.release(p);
      }
    }
    this.projectiles.length = write;
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

  private updateProjectiles(dt: number) {
    this.rebuildEnemyGrid();
    const projectileCount = this.projectiles.length;
    for (let i = 0; i < projectileCount; i++) {
      const p = this.projectiles[i];
      if (p.life <= 0) continue;
      if (!updateProjectile(p, dt)) { p.life = 0; continue; }
      if (p.orbitAngle === undefined && this.mapSystem.handleProjectileCollision(p.x, p.y, p.radius)) {
        p.life = 0; continue;
      }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (p.hitEnemies.has(e.id)) continue;
        if (circlesOverlap(p.x, p.y, p.radius, e.x, e.y, e.radius)) {
          const isDead = this.applyProjectileHit(p, e);
          p.pierceCount++;
          if (p.pierceCount > p.pierce) {
            if (p.type === WeaponType.FIRE_WAND && isDead) {
              spawnExplosionParticles(this.particles, e.x, e.y, '#ff6600', 15, {
                speed: 200, life: 0.7, radius: 5, type: 'spark', glow: true,
                innerColor: '#ffcc00', ringCount: 6,
              });
            }
            p.life = 0;
            break;
          }
        }
      }
    }
    this.releaseDeadProjectiles();
  }

  private rebuildEnemyGrid() {
    this.enemyGrid.clear();
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const key = this.getEnemyGridKey(enemy.x, enemy.y);
      let bucket = this.enemyGrid.get(key);
      if (!bucket) {
        bucket = [];
        this.enemyGrid.set(key, bucket);
      }
      bucket.push(enemy);
    }
  }

  private getEnemyGridKey(x: number, y: number): string {
    const gx = Math.floor(x / this.enemyGridCellSize);
    const gy = Math.floor(y / this.enemyGridCellSize);
    return `${gx}:${gy}`;
  }

  private forNearbyEnemies(x: number, y: number, radius: number, visit: (enemy: Enemy) => void) {
    const minX = Math.floor((x - radius) / this.enemyGridCellSize);
    const maxX = Math.floor((x + radius) / this.enemyGridCellSize);
    const minY = Math.floor((y - radius) / this.enemyGridCellSize);
    const maxY = Math.floor((y + radius) / this.enemyGridCellSize);

    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = this.enemyGrid.get(`${gx}:${gy}`);
        if (!bucket) continue;
        for (const enemy of bucket) {
          if (enemy.hp <= 0) continue;
          const dx = enemy.x - x;
          const dy = enemy.y - y;
          const hitRadius = radius + enemy.radius;
          if (dx * dx + dy * dy <= hitRadius * hitRadius) visit(enemy);
        }
      }
    }
  }

  private applyProjectileHit(p: Projectile, e: Enemy): boolean {
    p.hitEnemies.add(e.id);
    const dir = { x: e.x - p.x, y: e.y - p.y };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    const knockback = p.knockback + (this.projectileHasEffect(p, 'knockback') ? 120 : 0);
    const isDead = damageEnemy(e, p.damage, (dir.x / len) * knockback, (dir.y / len) * knockback);
    const hitColor = ENEMY_DATA[e.type].color;

    spawnHitParticles(this.particles, e.x, e.y, hitColor, 6, {
      speed: 150, life: 0.5, radius: 3, type: 'spark', glow: true,
    });
    if (p.type === WeaponType.FIRE_WAND) {
      spawnHitParticles(this.particles, e.x, e.y, '#ff8800', 4, {
        speed: 100, life: 0.4, radius: 4, type: 'circle', glow: true,
      });
    }
    if (p.type === WeaponType.LIGHTNING) {
      spawnHitParticles(this.particles, e.x, e.y, '#ffff88', 3, {
        speed: 120, life: 0.3, radius: 2, type: 'star', glow: true,
      });
    }

    const dmgColor = this.getProjectileDamageColor(p);
    const dmgSize = p.damage >= 30 ? 18 : p.damage >= 20 ? 16 : 14;
    this.damageNumbers.push(createDamageNumber(e.x, e.y, p.damage, dmgColor, dmgSize));
    this.triggerProjectileModifiers(p, e);
    return isDead;
  }

  private triggerProjectileModifiers(p: Projectile, e: Enemy) {
    for (const modifier of Object.values(GENERIC_MODIFIER_DATA)) {
      if (modifier.trigger !== 'onHit') continue;
      if (!this.projectileHasModifier(p, modifier.id)) continue;

      switch (modifier.effect) {
        case 'pulse':
          if (!p.pulseDone) {
            p.pulseDone = true;
            this.spawnImpactPulse(p);
          }
          break;
        case 'chain':
          if (!p.chainDone) {
            p.chainDone = true;
            this.spawnChainHit(p, e);
          }
          break;
        case 'split':
          if (!p.splitDone && this.canSplitProjectile(p)) {
            p.splitDone = true;
            this.spawnSplitProjectiles(p);
          }
          break;
      }
    }
  }

  private projectileHasModifier(p: Projectile, modifier: GenericModifierType): boolean {
    return (p.modifierMask & GENERIC_MODIFIER_MASK[modifier]) !== 0;
  }

  private projectileHasEffect(p: Projectile, effect: 'knockback'): boolean {
    return Object.values(GENERIC_MODIFIER_DATA).some((modifier) =>
      modifier.effect === effect &&
      this.projectileHasModifier(p, modifier.id)
    );
  }

  private getProjectileDamageColor(p: Projectile): string {
    return p.type === WeaponType.FIRE_WAND ? '#ff8844' :
           p.type === WeaponType.LIGHTNING ? '#ffff88' :
           p.type === WeaponType.HOLY_WATER ? '#88ccff' : '#ffffff';
  }

  private spawnImpactPulse(p: Projectile) {
    const radius = Math.max(36, p.radius * 1.8);
    const damage = p.damage * 0.35;
    spawnExplosionParticles(this.particles, p.x, p.y, '#b277ff', 10, {
      speed: 120, life: 0.45, radius: 3, type: 'spark', glow: true,
      innerColor: '#f0ddff', ringCount: 5,
    });

    this.forNearbyEnemies(p.x, p.y, radius, (target) => {
      const dir = { x: target.x - p.x, y: target.y - p.y };
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
      damageEnemy(target, damage, (dir.x / len) * p.knockback * 0.4, (dir.y / len) * p.knockback * 0.4);
      this.damageNumbers.push(createDamageNumber(target.x, target.y, damage, '#c49cff', 12));
    });
  }

  private spawnChainHit(p: Projectile, source: Enemy) {
    let best: Enemy | undefined;
    let bestDist = Infinity;
    this.forNearbyEnemies(source.x, source.y, 240, (target) => {
      if (target.hp <= 0 || target.id === source.id || p.hitEnemies.has(target.id)) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 240 && d < bestDist) {
        best = target;
        bestDist = d;
      }
    });
    if (!best) return;

    p.hitEnemies.add(best.id);
    const dir = { x: best.x - source.x, y: best.y - source.y };
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    const damage = p.damage * 0.55;
    damageEnemy(best, damage, (dir.x / len) * p.knockback * 0.7, (dir.y / len) * p.knockback * 0.7);
    spawnHitParticles(this.particles, best.x, best.y, '#bde7ff', 6, {
      speed: 130, life: 0.35, radius: 2.5, type: 'star', glow: true,
    });
    this.damageNumbers.push(createDamageNumber(best.x, best.y, damage, '#bde7ff', 13));
  }

  private canSplitProjectile(p: Projectile): boolean {
    return p.type === WeaponType.MAGIC_WAND || p.type === WeaponType.FIRE_WAND || p.type === WeaponType.AXE;
  }

  private spawnSplitProjectiles(p: Projectile) {
    const speed = Math.max(220, Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 320);
    const baseAngle = Math.atan2(p.vy, p.vx || 1);
    for (const offset of [-0.45, 0.45]) {
      const child = pools.projectiles.acquire();
      const angle = baseAngle + offset;
      child.x = p.x;
      child.y = p.y;
      child.vx = Math.cos(angle) * speed;
      child.vy = Math.sin(angle) * speed;
      child.damage = p.damage * 0.4;
      child.radius = Math.max(4, p.radius * 0.65);
      child.life = Math.min(1.1, Math.max(0.55, p.maxLife * 0.55));
      child.maxLife = child.life;
      child.pierce = 0;
      child.pierceCount = 0;
      child.type = p.type;
      child.hitEnemies.clear();
      child.knockback = p.knockback * 0.6;
      child.animTimer = 0;
      child.modifierMask = p.modifierMask;
      child.splitDone = true;
      child.chainDone = false;
      child.pulseDone = false;
      if (p.type === WeaponType.AXE) child.gravY = p.gravY;
      this.projectiles.push(child);
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
        this.player.gold += result.value;
        const leveled = addXP(this.player, result.value);
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
    };
  }

  // ──────────────────────────── Upgrade ────────────────────────────

  private showUpgradeScreen() {
    gameState.transition('upgrade');
    this.upgradeOptions = generateUpgradeOptions(
      this.player,
      getMetaShopOptionCount(this.meta, this.player.level),
      areModifierCardsUnlocked(this.meta)
    );
    this.selectedUpgrade = 0;
    this.shopFreeRerollAvailable = true;
    this.shopPaidRerollsThisRound = 0;
  }

  private buySelectedUpgrade() {
    if (this.selectedUpgrade >= this.upgradeOptions.length) return;
    const option = this.upgradeOptions[this.selectedUpgrade];
    if (option.purchased || this.player.gold < option.cost) return;

    this.player.gold -= option.cost;
    applyUpgrade(this.player, option);
    option.purchased = true;
    eventBus.emit(GameEvent.UPGRADE_SELECT, option);

    const nextAvailable = this.upgradeOptions.findIndex((o) => !o.purchased);
    if (nextAvailable >= 0) this.selectedUpgrade = nextAvailable;
  }

  private rerollShop() {
    if (this.shopFreeRerollAvailable) {
      this.shopFreeRerollAvailable = false;
    } else {
      if (!canPaidReroll(this.meta)) return;
      const cost = getMetaRerollCost(this.meta, this.shopPaidRerollsThisRound);
      if (this.player.gold < cost) return;
      this.player.gold -= cost;
      this.shopPaidRerollsThisRound++;
    }
    this.upgradeOptions = generateUpgradeOptions(
      this.player,
      getMetaShopOptionCount(this.meta, this.player.level),
      areModifierCardsUnlocked(this.meta)
    );
    this.selectedUpgrade = 0;
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
    if (this.upgradeOptions.length === 0) return;

    const cardGap = 12;
    const cardW = Math.min(180, (w - 90) / this.upgradeOptions.length - cardGap);
    const cardH = 230;
    const totalW = this.upgradeOptions.length * (cardW + cardGap) - cardGap;
    const startX = (w - totalW) / 2;
    const cardY = h / 2 - cardH / 2 - 5;
    for (let i = 0; i < this.upgradeOptions.length; i++) {
      const cx = startX + i * (cardW + cardGap);
      if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
        this.selectedUpgrade = i;
        this.buySelectedUpgrade();
        return;
      }
    }

    const btnY = h / 2 + 155;
    const btnW = 150;
    const btnH = 38;
    const rerollX = w / 2 - 165;
    const continueX = w / 2 + 15;
    if (x >= rerollX && x <= rerollX + btnW && y >= btnY && y <= btnY + btnH) {
      this.rerollShop();
      return;
    }
    if (x >= continueX && x <= continueX + btnW && y >= btnY && y <= btnY + btnH) {
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

    const garlicWeapon = this.player.weapons.find(w => w.type === WeaponType.GARLIC);
    if (garlicWeapon) {
      this.renderer.drawGarlicAura(this.player, getGarlicRadius(garlicWeapon, this.player));
    }

    this.renderer.drawPickupRange(this.player);
    this.renderer.drawPlayer(this.player);

    for (const p of this.particles) this.renderer.drawParticle(p);
    for (const d of this.damageNumbers) this.renderer.drawDamageNumber(d);

    this.renderer.endWorld();

    this.renderer.drawUI(this.player, this.elapsed, this.killCount);
    this.renderer.drawMinimap(this.player, this.enemies);
    this.renderer.drawPauseButton();

    const boss = this.enemies.find(e => e.isBoss && e.hp > 0);
    if (boss) this.renderer.drawBossBar(ENEMY_DATA[boss.type].name, boss.hp, boss.maxHp);
    if (this.bossWarningTimer > 0) this.renderer.drawBossWarning(this.bossWarningName, this.bossWarningTimer);
    if (this.damageFlashTimer > 0) this.renderer.drawDamageFlash(this.damageFlashTimer);
    if (this.levelUpFlashTimer > 0) this.renderer.drawLevelUpFlash(this.levelUpFlashTimer);

    if (gameState.is('paused')) {
      this.renderer.drawPaused();
    } else if (gameState.is('upgrading')) {
      this.renderer.drawUpgradeScreen(
        this.upgradeOptions,
        this.selectedUpgrade,
        this.player.gold,
        this.shopFreeRerollAvailable,
        getMetaRerollCost(this.meta, this.shopPaidRerollsThisRound),
        canPaidReroll(this.meta)
      );
    } else if (gameState.is('gameover')) {
      this.renderer.drawGameOver(this.gameOverStats ?? {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
        weaponNames: this.player.weapons.map(w => WEAPON_DATA[w.type].name),
        soulFireEarned: 0,
        totalSoulFire: this.meta.soulFire,
      });
    }
  }
}
