import {
  GameState, Enemy, Projectile, XPGem, Particle, DamageNumber,
  Camera, UpgradeOption, WeaponType, PassiveType
} from './types';
import {
  GAME_DURATION, SHAKE_HIT_DURATION, SHAKE_HIT_INTENSITY, COLORS, ENEMY_DATA, WEAPON_DATA,
  HEALTH_DROP_CHANCE, HEALTH_DROP_AMOUNT, CONTACT_COOLDOWN,
  MAGIC_CIRCLE_HEAL_RATE, MAGIC_CIRCLE_RADIUS,
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
  private garlicTickTimer = { value: 0 };
  private lastTime = 0;
  private levelUpQueue = 0;
  private bossWarningTimer = 0;
  private bossWarningName = '';
  private bossWarningShown = new Set<number>();
  private damageFlashTimer = 0;
  private levelUpFlashTimer = 0;

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
        } else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.selectUpgrade();
        }
        break;
      case 'paused':
        if (e.code === 'Escape' || e.code === 'KeyP') gameState.transition('resume');
        break;
      case 'playing':
        if (e.code === 'Escape' || e.code === 'KeyP') gameState.transition('pause');
        break;
      case 'gameover':
      case 'menu':
        if (e.code === 'Enter' || e.code === 'Space') this.startGame();
        break;
    }
  }

  private onClick(e: MouseEvent) {
    if (gameState.is('menu') || gameState.is('gameover')) {
      this.startGame();
    } else if (gameState.is('upgrading')) {
      this.handleClickUpgrade(e);
    }
  }

  private onTouchStart(e: TouchEvent) {
    if (gameState.is('menu') || gameState.is('gameover')) {
      this.startGame();
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

  // ──────────────────────────── Game Lifecycle ────────────────────────────

  private startGame() {
    gameState.transition('start');
    resetEnemyIds();
    clearAllPools();
    this.player = createPlayer();
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
    this.garlicTickTimer.value = 0;
    this.bossWarningTimer = 0;
    this.bossWarningName = '';
    this.bossWarningShown.clear();
    this.damageFlashTimer = 0;
    this.levelUpFlashTimer = 0;
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
    for (const p of this.projectiles) {
      if (p.life <= 0) continue;
      if (!updateProjectile(p, dt)) { p.life = 0; continue; }
      if (p.orbitAngle === undefined && this.mapSystem.handleProjectileCollision(p.x, p.y, p.radius)) {
        p.life = 0; continue;
      }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (p.hitEnemies.has(e.id)) continue;
        if (circlesOverlap(p.x, p.y, p.radius, e.x, e.y, e.radius)) {
          p.hitEnemies.add(e.id);
          const dir = { x: e.x - p.x, y: e.y - p.y };
          const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
          const isDead = damageEnemy(e, p.damage, (dir.x / len) * p.knockback, (dir.y / len) * p.knockback);
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
          const dmgColor = p.type === WeaponType.FIRE_WAND ? '#ff8844' :
                          p.type === WeaponType.LIGHTNING ? '#ffff88' :
                          p.type === WeaponType.HOLY_WATER ? '#88ccff' : '#ffffff';
          const dmgSize = p.damage >= 30 ? 18 : p.damage >= 20 ? 16 : 14;
          this.damageNumbers.push(createDamageNumber(e.x, e.y, p.damage, dmgColor, dmgSize));
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

  private updateXPGems(dt: number) {
    const hasMagnet = hasPassive(this.player, PassiveType.MAGNET);
    for (const gem of this.xpGems) {
      if (gem.life <= 0) continue;
        const result = updateXPGem(gem, this.player, dt, hasMagnet);
      if (result.collected) {
        spawnXPParticles(this.particles, gem.x, gem.y, 5, {
          speed: 80, life: 0.4, radius: 2.5, color: '#88ffaa', glow: true,
        });
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
      eventBus.emit(GameEvent.PLAYER_DEATH);
      eventBus.emit(GameEvent.GAME_OVER, {
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
      });
    }
  }

  // ──────────────────────────── Upgrade ────────────────────────────

  private showUpgradeScreen() {
    gameState.transition('upgrade');
    this.upgradeOptions = generateUpgradeOptions(this.player);
    this.selectedUpgrade = 0;
  }

  private selectUpgrade() {
    if (this.selectedUpgrade >= this.upgradeOptions.length) return;
    applyUpgrade(this.player, this.upgradeOptions[this.selectedUpgrade]);
    eventBus.emit(GameEvent.UPGRADE_SELECT, this.upgradeOptions[this.selectedUpgrade]);
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
    const cardW = Math.min(200, (w - 60) / this.upgradeOptions.length - 10);
    const cardH = 200;
    const totalW = this.upgradeOptions.length * (cardW + 10) - 10;
    const startX = (w - totalW) / 2;
    for (let i = 0; i < this.upgradeOptions.length; i++) {
      const cx = startX + i * (cardW + 10);
      const cy = h / 2 - cardH / 2;
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        this.selectedUpgrade = i;
        this.selectUpgrade();
        return;
      }
    }
  }

  // ──────────────────────────── Render ────────────────────────────

  private render() {
    this.renderer.clear();

    if (gameState.is('menu')) {
      this.renderer.drawMenu();
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
      this.renderer.drawUpgradeScreen(this.upgradeOptions, this.selectedUpgrade);
    } else if (gameState.is('gameover')) {
      this.renderer.drawGameOver({
        time: this.elapsed,
        kills: this.killCount,
        level: this.player.level,
        weaponNames: this.player.weapons.map(w => WEAPON_DATA[w.type].name),
      });
    }
  }
}
