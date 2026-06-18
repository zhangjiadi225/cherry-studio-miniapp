import { Enemy, EnemyType, Player } from '../../types';
import {
  ENEMY_DATA, SPAWN_DISTANCE,
  BOSS_TIMES, MAX_ENEMIES,
  BOSS_HP_MULT, BOSS_DMG_MULT, BOSS_XP_MULT, BOSS_MINION_COUNT,
  SPAWN_WAVE_GROWTH_INTERVAL,
} from '../../constants';
import { createEnemy, getAvailableEnemyTypes } from './Enemy';
import { randFloat, randInt, weightedRandom } from '../../utils/math';
import { getDifficultyParams, type DifficultyParams } from '../../data/difficulty';

export class Spawner {
  private spawnTimer = 0;
  private bossSpawned = new Set<number>();
  private waveCount = 0;
  private totalKills = 0;

  reset() {
    this.spawnTimer = 0;
    this.bossSpawned.clear();
    this.waveCount = 0;
    this.totalKills = 0;
  }

  addKill() {
    this.totalKills++;
  }

  update(
    enemies: Enemy[],
    player: Player,
    elapsed: number,
    difficulty: number,
    dt: number,
    curseMult: number = 1
  ) {
    const difficultyParams = getDifficultyParams(elapsed);
    for (const bossTime of BOSS_TIMES) {
      if (elapsed >= bossTime && !this.bossSpawned.has(bossTime)) {
        this.bossSpawned.add(bossTime);
        this.spawnBoss(enemies, player, difficulty, bossTime, curseMult, difficultyParams);
      }
    }

    const interval = difficultyParams.spawnInterval;
    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.waveCount++;
      this.spawnWave(enemies, player, elapsed, difficulty, curseMult, difficultyParams);
    }

    this.markOverflowEnemies(enemies, player);
  }

  private spawnWave(
    enemies: Enemy[],
    player: Player,
    elapsed: number,
    difficulty: number,
    curseMult: number,
    difficultyParams: DifficultyParams
  ) {
    const available = getAvailableEnemyTypes(elapsed, difficulty);
    if (available.length === 0) return;

    const count = Math.min(
      difficultyParams.waveMaxCount,
      difficultyParams.waveBaseCount + Math.floor(this.waveCount / SPAWN_WAVE_GROWTH_INTERVAL)
    );

    for (let i = 0; i < count; i++) {
      if (enemies.length >= MAX_ENEMIES) break;

      const type = this.pickEnemyType(available, elapsed, difficulty);
      const pos = this.getSpawnPosition(player);
      const isElite = Math.random() < difficultyParams.eliteChance;
      enemies.push(createEnemy(type, pos.x, pos.y, difficulty, curseMult, isElite, false, difficultyParams));
    }
  }

  private spawnBoss(
    enemies: Enemy[],
    player: Player,
    difficulty: number,
    bossTime: number,
    curseMult: number,
    difficultyParams: DifficultyParams
  ) {
    const bossType = bossTime >= 600 ? EnemyType.WRAITH : EnemyType.DEMON;
    const pos = this.getSpawnPosition(player);

    const boss = createEnemy(bossType, pos.x, pos.y, difficulty, curseMult, true, true, difficultyParams);
    boss.radius *= 2;
    boss.maxHp *= BOSS_HP_MULT;
    boss.hp = boss.maxHp;
    boss.damage *= BOSS_DMG_MULT;
    boss.xpValue *= BOSS_XP_MULT;
    enemies.push(boss);

    for (let i = 0; i < BOSS_MINION_COUNT; i++) {
      const angle = (i / BOSS_MINION_COUNT) * Math.PI * 2;
      const d = 100 + Math.random() * 100;
      const minionType = bossTime >= 600 ? EnemyType.GHOST : EnemyType.SKELETON;
      enemies.push(createEnemy(
        minionType,
        pos.x + Math.cos(angle) * d,
        pos.y + Math.sin(angle) * d,
        difficulty,
        1,
        false,
        false,
        difficultyParams
      ));
    }
  }

  private markOverflowEnemies(enemies: Enemy[], player: Player) {
    const overflow = enemies.length - MAX_ENEMIES;
    if (overflow <= 0) return;

    const farthest: { enemy: Enemy; distSq: number }[] = [];
    for (const enemy of enemies) {
      if (enemy.hp <= 0 || enemy.isBoss) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distSq = dx * dx + dy * dy;
      let insertAt = farthest.length;
      while (insertAt > 0 && distSq > farthest[insertAt - 1].distSq) {
        insertAt--;
      }
      if (insertAt >= overflow) continue;

      farthest.splice(insertAt, 0, { enemy, distSq });
      if (farthest.length > overflow) farthest.pop();
    }

    for (const entry of farthest) {
      entry.enemy.hp = 0;
    }
  }

  private pickEnemyType(available: EnemyType[], elapsed: number, difficulty: number): EnemyType {
    const weights = available.map(type => {
      const data = ENEMY_DATA[type];
      const timeSinceUnlock = elapsed - data.spawnAfter;
      let w = Math.max(1, 10 - timeSinceUnlock / 30);

      if (type === EnemyType.ZOMBIE || type === EnemyType.BAT) {
        w *= Math.max(0.3, 1 - elapsed / 600);
      }
      if (type === EnemyType.DEMON || type === EnemyType.WRAITH) {
        w *= Math.min(3, elapsed / 300);
      }

      return w;
    });

    return weightedRandom(available, weights);
  }

  private getSpawnPosition(player: Player): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_DISTANCE + Math.random() * 200;
    return {
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
    };
  }

  getTotalKills() {
    return this.totalKills;
  }
}
