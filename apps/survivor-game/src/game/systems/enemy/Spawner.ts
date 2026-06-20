import { Enemy, EnemyType, Player } from '../../types';
import {
  ENEMY_DATA, SPAWN_DISTANCE,
  MAX_ENEMIES,
  BOSS_HP_MULT, BOSS_DMG_MULT, BOSS_XP_MULT, BOSS_MINION_COUNT,
} from '../../constants';
import { createEnemy, getAvailableEnemyTypes, getEnemyEnhancementUnlockAt } from './Enemy';
import { weightedRandom } from '../../utils/math';
import { getDifficultyParams, type DifficultyParams } from '../../data/difficulty';
import { getRunDifficultyPreset, type RunDifficultyPreset } from '../../data/runDifficulties';

const WRAITH_SHADOW_SPAWN_MULT = 0.62;

function isRangedPressureType(type: EnemyType, elapsed: number, unlockTimeMult: number): boolean {
  if (type === EnemyType.CULTIST) return true;
  if (type !== EnemyType.WRAITH) return false;

  const shadowUnlockAt = getEnemyEnhancementUnlockAt(type, unlockTimeMult);
  return shadowUnlockAt !== undefined && elapsed >= shadowUnlockAt;
}

function capRangedPressureWeights(
  available: EnemyType[],
  weights: number[],
  elapsed: number,
  runDifficulty: RunDifficultyPreset
): number[] {
  const cap = runDifficulty.rangedEnemyWeightCap;
  if (cap <= 0 || cap >= 1) return weights;

  let rangedWeight = 0;
  let otherWeight = 0;
  const unlockTimeMult = runDifficulty.enemyUnlockTimeMult;
  for (let i = 0; i < available.length; i++) {
    if (isRangedPressureType(available[i], elapsed, unlockTimeMult)) {
      rangedWeight += weights[i];
    } else {
      otherWeight += weights[i];
    }
  }
  if (rangedWeight <= 0 || otherWeight <= 0) return weights;
  if (rangedWeight / (rangedWeight + otherWeight) <= cap) return weights;

  const rangedScale = (cap * otherWeight) / ((1 - cap) * rangedWeight);
  return weights.map((weight, index) =>
    isRangedPressureType(available[index], elapsed, unlockTimeMult) ? weight * rangedScale : weight
  );
}

export function getEnemySpawnWeights(
  available: EnemyType[],
  elapsed: number,
  difficultyParams: DifficultyParams,
  runDifficulty: RunDifficultyPreset = getRunDifficultyPreset()
): number[] {
  const unlockTimeMult = runDifficulty.enemyUnlockTimeMult;
  const weights = available.map(type => {
    const data = ENEMY_DATA[type];
    const unlockAt = data.spawnAfter * unlockTimeMult;
    const timeSinceUnlock = Math.max(0, elapsed - unlockAt);
    let w = Math.max(1, 10 - timeSinceUnlock / 30);

    if (type === EnemyType.ZOMBIE || type === EnemyType.BAT) {
      w *= Math.max(0.3, 1 - elapsed / 600);
    }
    if (type === EnemyType.DEMON || type === EnemyType.WRAITH) {
      w *= Math.min(2.2, 0.65 + timeSinceUnlock / 180);
    }
    if (type === EnemyType.WRAITH && isRangedPressureType(type, elapsed, unlockTimeMult)) {
      w *= WRAITH_SHADOW_SPAWN_MULT;
    }
    if (type === EnemyType.CULTIST || type === EnemyType.DEMON || type === EnemyType.WRAITH) {
      w *= difficultyParams.complexEnemyWeightMultiplier;
    }

    return w;
  });

  return capRangedPressureWeights(available, weights, elapsed, runDifficulty);
}

export function getRangedPressureWeightShare(
  available: EnemyType[],
  weights: number[],
  elapsed: number,
  runDifficulty: RunDifficultyPreset
): number {
  let rangedWeight = 0;
  let totalWeight = 0;
  const unlockTimeMult = runDifficulty.enemyUnlockTimeMult;
  for (let i = 0; i < available.length; i++) {
    totalWeight += weights[i];
    if (isRangedPressureType(available[i], elapsed, unlockTimeMult)) {
      rangedWeight += weights[i];
    }
  }
  return totalWeight > 0 ? rangedWeight / totalWeight : 0;
}

export class Spawner {
  private spawnTimer = 0;
  private bossSpawned = new Set<number>();
  private totalKills = 0;

  reset() {
    this.spawnTimer = 0;
    this.bossSpawned.clear();
    this.totalKills = 0;
  }

  addKill() {
    this.totalKills++;
  }

  spawnEliteAmbush(
    enemies: Enemy[],
    player: Player,
    elapsed: number,
    difficulty: number,
    curseMult: number = 1,
    count: number = 1,
    runDifficulty: RunDifficultyPreset = getRunDifficultyPreset()
  ) {
    const difficultyParams = getDifficultyParams(elapsed, runDifficulty);
    const available = getAvailableEnemyTypes(elapsed, difficulty, runDifficulty);
    if (available.length === 0) return;

    for (let i = 0; i < count; i++) {
      if (enemies.length >= MAX_ENEMIES) break;
      const type = this.pickEnemyType(available, elapsed, difficultyParams, runDifficulty);
      const pos = this.getSpawnPosition(player);
      enemies.push(createEnemy(
        type,
        pos.x,
        pos.y,
        difficulty,
        curseMult,
        true,
        false,
        difficultyParams,
        elapsed,
        runDifficulty.enemyUnlockTimeMult
      ));
    }
  }

  update(
    enemies: Enemy[],
    player: Player,
    elapsed: number,
    difficulty: number,
    dt: number,
    curseMult: number = 1,
    runDifficulty: RunDifficultyPreset = getRunDifficultyPreset()
  ) {
    const difficultyParams = getDifficultyParams(elapsed, runDifficulty);
    for (const bossTime of runDifficulty.bossTimes) {
      if (elapsed >= bossTime && !this.bossSpawned.has(bossTime)) {
        this.bossSpawned.add(bossTime);
        this.spawnBoss(enemies, player, difficulty, bossTime, curseMult, difficultyParams, runDifficulty);
      }
    }

    const interval = difficultyParams.spawnInterval;
    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawnWave(enemies, player, elapsed, difficulty, curseMult, difficultyParams, runDifficulty);
    }

    this.markOverflowEnemies(enemies, player);
  }

  private spawnWave(
    enemies: Enemy[],
    player: Player,
    elapsed: number,
    difficulty: number,
    curseMult: number,
    difficultyParams: DifficultyParams,
    runDifficulty: RunDifficultyPreset
  ) {
    const available = getAvailableEnemyTypes(elapsed, difficulty, runDifficulty);
    if (available.length === 0) return;

    const availableSlots = difficultyParams.activeEnemyCap - enemies.length;
    if (availableSlots <= 0) return;

    const count = Math.min(difficultyParams.waveBaseCount, availableSlots);

    for (let i = 0; i < count; i++) {
      if (enemies.length >= MAX_ENEMIES) break;

      const type = this.pickEnemyType(available, elapsed, difficultyParams, runDifficulty);
      const pos = this.getSpawnPosition(player);
      const isElite = Math.random() < difficultyParams.eliteChance;
      enemies.push(createEnemy(
        type,
        pos.x,
        pos.y,
        difficulty,
        curseMult,
        isElite,
        false,
        difficultyParams,
        elapsed,
        runDifficulty.enemyUnlockTimeMult
      ));
    }
  }

  private spawnBoss(
    enemies: Enemy[],
    player: Player,
    difficulty: number,
    bossTime: number,
    curseMult: number,
    difficultyParams: DifficultyParams,
    runDifficulty: RunDifficultyPreset
  ) {
    const isLateBoss = runDifficulty.bossTimes.indexOf(bossTime) > 0;
    const bossType = isLateBoss ? EnemyType.WRAITH : EnemyType.DEMON;
    const pos = this.getSpawnPosition(player);

    const boss = createEnemy(
      bossType,
      pos.x,
      pos.y,
      difficulty,
      curseMult,
      true,
      true,
      difficultyParams,
      bossTime,
      runDifficulty.enemyUnlockTimeMult
    );
    boss.radius *= 2;
    boss.maxHp *= BOSS_HP_MULT;
    boss.hp = boss.maxHp;
    boss.damage *= BOSS_DMG_MULT;
    boss.xpValue *= BOSS_XP_MULT;
    enemies.push(boss);

    const minionCount = Math.max(8, Math.round(BOSS_MINION_COUNT * runDifficulty.waveCountMult));
    for (let i = 0; i < minionCount; i++) {
      const angle = (i / minionCount) * Math.PI * 2;
      const d = 100 + Math.random() * 100;
      const minionType = isLateBoss ? EnemyType.GHOST : EnemyType.SKELETON;
      enemies.push(createEnemy(
        minionType,
        pos.x + Math.cos(angle) * d,
        pos.y + Math.sin(angle) * d,
        difficulty,
        1,
        false,
        false,
        difficultyParams,
        bossTime,
        runDifficulty.enemyUnlockTimeMult
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

  private pickEnemyType(
    available: EnemyType[],
    elapsed: number,
    difficultyParams: DifficultyParams,
    runDifficulty: RunDifficultyPreset
  ): EnemyType {
    const weights = getEnemySpawnWeights(available, elapsed, difficultyParams, runDifficulty);

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
