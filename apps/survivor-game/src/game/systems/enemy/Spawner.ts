import { Enemy, EnemyType, Player } from '../../types';
import {
  ENEMY_DATA, SPAWN_DISTANCE, SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_MIN,
  BOSS_TIMES, MAX_ENEMIES, DIFFICULTY_STEP,
  ELITE_BASE_CHANCE, ELITE_DIFF_CHANCE,
  BOSS_HP_MULT, BOSS_DMG_MULT, BOSS_XP_MULT, BOSS_MINION_COUNT,
} from '../../constants';
import { createEnemy, getAvailableEnemyTypes } from './Enemy';
import { randFloat, randInt, weightedRandom } from '../../utils/math';

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
    for (const bossTime of BOSS_TIMES) {
      if (elapsed >= bossTime && !this.bossSpawned.has(bossTime)) {
        this.bossSpawned.add(bossTime);
        this.spawnBoss(enemies, player, difficulty, bossTime, curseMult);
      }
    }

    const interval = Math.max(
      SPAWN_INTERVAL_MIN,
      SPAWN_INTERVAL_BASE - difficulty * 0.02
    );
    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.waveCount++;
      this.spawnWave(enemies, player, elapsed, difficulty, curseMult);
    }

    while (enemies.length > MAX_ENEMIES) {
      let farthest = 0;
      let farthestIdx = 0;
      for (let i = 0; i < enemies.length; i++) {
        const d = Math.abs(enemies[i].x - player.x) + Math.abs(enemies[i].y - player.y);
        if (d > farthest) {
          farthest = d;
          farthestIdx = i;
        }
      }
      enemies.splice(farthestIdx, 1);
    }
  }

  private spawnWave(enemies: Enemy[], player: Player, elapsed: number, difficulty: number, curseMult: number = 1) {
    const available = getAvailableEnemyTypes(elapsed, difficulty);
    if (available.length === 0) return;

    const baseCount = 2 + Math.floor(difficulty * 0.5);
    const count = Math.min(15, baseCount + Math.floor(this.waveCount / 20));

    for (let i = 0; i < count; i++) {
      if (enemies.length >= MAX_ENEMIES) break;

      const type = this.pickEnemyType(available, elapsed, difficulty);
      const pos = this.getSpawnPosition(player);
      const isElite = Math.random() < ELITE_BASE_CHANCE + difficulty * ELITE_DIFF_CHANCE;
      enemies.push(createEnemy(type, pos.x, pos.y, difficulty, curseMult, isElite));
    }
  }

  private spawnBoss(enemies: Enemy[], player: Player, difficulty: number, bossTime: number, curseMult: number = 1) {
    const bossType = bossTime >= 600 ? EnemyType.WRAITH : EnemyType.DEMON;
    const pos = this.getSpawnPosition(player);

    const boss = createEnemy(bossType, pos.x, pos.y, difficulty, curseMult, true, true);
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
        false
      ));
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
