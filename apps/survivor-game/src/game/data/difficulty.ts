import {
  DEFAULT_RUN_DIFFICULTY_ID,
  getRunDifficultyPreset,
  type DifficultyCurveId,
  type EndlessCurveConfig,
  type RunDifficultyPreset,
} from './runDifficulties';

export interface DifficultyParams {
  difficulty: number;
  enemyHpMultiplier: number;
  enemySpeedMultiplier: number;
  enemyDamageMultiplier: number;
  spawnInterval: number;
  waveBaseCount: number;
  activeEnemyCap: number;
  eliteChance: number;
  complexEnemyWeightMultiplier: number;
  endlessCycle: number;
}

type DifficultyRow = {
  time: number;
  interval: number;
  hp: number;
  speed: number;
  damage: number;
  wave: number;
  activeCap: number;
  elite: number;
  complexWeight: number;
};

const STANDARD_DIFFICULTY_TABLE: DifficultyRow[] = [
  { time: 0,   interval: 1.80, hp: 1.00, speed: 0.98, damage: 1, wave: 2,  activeCap: 18,  elite: 0.005, complexWeight: 1 },
  { time: 30,  interval: 1.65, hp: 1.03, speed: 1.00, damage: 1, wave: 2,  activeCap: 24,  elite: 0.010, complexWeight: 1 },
  { time: 60,  interval: 1.50, hp: 1.06, speed: 1.02, damage: 1, wave: 3,  activeCap: 32,  elite: 0.015, complexWeight: 1 },
  { time: 120, interval: 1.30, hp: 1.12, speed: 1.04, damage: 1, wave: 3,  activeCap: 45,  elite: 0.025, complexWeight: 1 },
  { time: 180, interval: 1.15, hp: 1.20, speed: 1.06, damage: 1, wave: 4,  activeCap: 60,  elite: 0.035, complexWeight: 1 },
  { time: 240, interval: 1.00, hp: 1.32, speed: 1.09, damage: 1, wave: 5,  activeCap: 80,  elite: 0.045, complexWeight: 1 },
  { time: 300, interval: 0.88, hp: 1.48, speed: 1.12, damage: 1, wave: 6,  activeCap: 105, elite: 0.060, complexWeight: 1 },
  { time: 420, interval: 0.74, hp: 1.72, speed: 1.16, damage: 1, wave: 7,  activeCap: 140, elite: 0.080, complexWeight: 1 },
  { time: 600, interval: 0.62, hp: 2.05, speed: 1.22, damage: 1, wave: 9,  activeCap: 190, elite: 0.100, complexWeight: 1 },
  { time: 720, interval: 0.52, hp: 2.35, speed: 1.28, damage: 1, wave: 11, activeCap: 240, elite: 0.125, complexWeight: 1 },
  { time: 900, interval: 0.45, hp: 2.75, speed: 1.34, damage: 1, wave: 13, activeCap: 300, elite: 0.150, complexWeight: 1 },
] as const;

const NIGHTMARE_DIFFICULTY_TABLE: DifficultyRow[] = [
  { time: 0,   interval: 1.46, hp: 1.10, speed: 1.04, damage: 1.06, wave: 3,  activeCap: 28,  elite: 0.012, complexWeight: 0.90 },
  { time: 90,  interval: 1.26, hp: 1.22, speed: 1.06, damage: 1.08, wave: 4,  activeCap: 54,  elite: 0.030, complexWeight: 1.05 },
  { time: 180, interval: 1.00, hp: 1.38, speed: 1.10, damage: 1.10, wave: 5,  activeCap: 78,  elite: 0.055, complexWeight: 1.25 },
  { time: 360, interval: 0.76, hp: 1.75, speed: 1.14, damage: 1.13, wave: 8,  activeCap: 145, elite: 0.095, complexWeight: 1.60 },
  { time: 540, interval: 0.64, hp: 2.05, speed: 1.17, damage: 1.15, wave: 10, activeCap: 210, elite: 0.130, complexWeight: 1.90 },
  { time: 720, interval: 0.56, hp: 2.35, speed: 1.20, damage: 1.15, wave: 12, activeCap: 285, elite: 0.160, complexWeight: 2.10 },
] as const;

const DIFFICULTY_TABLES: Record<DifficultyCurveId, DifficultyRow[]> = {
  standard: STANDARD_DIFFICULTY_TABLE,
  nightmare: NIGHTMARE_DIFFICULTY_TABLE,
};

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function getInterpolatedRow(elapsed: number, curveId: DifficultyCurveId): DifficultyRow {
  const table = DIFFICULTY_TABLES[curveId];
  const first = table[0];
  if (elapsed <= first.time) return first;

  for (let i = 1; i < table.length; i++) {
    const previous = table[i - 1];
    const next = table[i];
    if (elapsed > next.time) continue;

    const t = (elapsed - previous.time) / (next.time - previous.time);
    return {
      time: elapsed,
      interval: lerp(previous.interval, next.interval, t),
      hp: lerp(previous.hp, next.hp, t),
      speed: lerp(previous.speed, next.speed, t),
      damage: lerp(previous.damage, next.damage, t),
      wave: Math.round(lerp(previous.wave, next.wave, t)),
      activeCap: Math.round(lerp(previous.activeCap, next.activeCap, t)),
      elite: lerp(previous.elite, next.elite, t),
      complexWeight: lerp(previous.complexWeight, next.complexWeight, t),
    };
  }

  return table[table.length - 1];
}

function getEndlessCycle(elapsed: number, endless?: EndlessCurveConfig): number {
  if (!endless || elapsed <= endless.startTime) return 0;
  return Math.floor((elapsed - endless.startTime) / endless.cycleLength) + 1;
}

function applyEndlessScaling(row: DifficultyRow, cycle: number, endless?: EndlessCurveConfig): DifficultyRow {
  if (!endless || cycle <= 0) return row;

  const intervalMult = Math.max(
    endless.spawnIntervalFloorMult,
    1 - endless.spawnIntervalReductionPerCycle * cycle
  );
  const waveMult = Math.min(endless.waveCountCapMult, 1 + endless.waveCountPerCycle * cycle);

  return {
    ...row,
    interval: row.interval * intervalMult,
    hp: row.hp + endless.hpPerCycle * cycle + endless.hpQuadraticPerCycle * cycle * cycle,
    damage: Math.min(endless.damageCap, row.damage + endless.damagePerCycle * cycle),
    wave: Math.round(row.wave * waveMult),
    activeCap: Math.round(row.activeCap * Math.min(1.55, 1 + 0.055 * cycle)),
    elite: Math.min(endless.eliteChanceCap, row.elite + endless.eliteChancePerCycle * cycle),
    complexWeight: Math.min(
      endless.complexEnemyWeightCap,
      row.complexWeight + endless.complexEnemyWeightPerCycle * cycle
    ),
  };
}

export function getDifficultyParams(
  elapsed: number,
  runDifficulty: RunDifficultyPreset = getRunDifficultyPreset(DEFAULT_RUN_DIFFICULTY_ID)
): DifficultyParams {
  const clampedElapsed = Math.max(0, elapsed);
  const endlessCycle = getEndlessCycle(clampedElapsed, runDifficulty.endless);
  const current = applyEndlessScaling(
    getInterpolatedRow(clampedElapsed, runDifficulty.curveId),
    endlessCycle,
    runDifficulty.endless
  );

  return {
    difficulty: Math.floor(clampedElapsed / 30),
    enemyHpMultiplier: current.hp * runDifficulty.hpMult,
    enemySpeedMultiplier: current.speed * runDifficulty.speedMult,
    enemyDamageMultiplier: current.damage * runDifficulty.damageMult,
    spawnInterval: current.interval * runDifficulty.spawnIntervalMult,
    waveBaseCount: Math.max(1, Math.round(current.wave * runDifficulty.waveCountMult)),
    activeEnemyCap: Math.max(12, Math.min(360, Math.round(current.activeCap * runDifficulty.activeCapMult))),
    eliteChance: Math.min(0.45, current.elite * runDifficulty.eliteChanceMult),
    complexEnemyWeightMultiplier: current.complexWeight * runDifficulty.complexEnemyWeightMult,
    endlessCycle,
  };
}
