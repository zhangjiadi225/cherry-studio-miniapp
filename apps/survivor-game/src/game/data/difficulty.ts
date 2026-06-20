import { DEFAULT_RUN_DIFFICULTY_ID, getRunDifficultyPreset, type RunDifficultyPreset } from './runDifficulties';

export interface DifficultyParams {
  difficulty: number;
  enemyHpMultiplier: number;
  enemySpeedMultiplier: number;
  enemyDamageMultiplier: number;
  spawnInterval: number;
  waveBaseCount: number;
  activeEnemyCap: number;
  eliteChance: number;
}

type DifficultyRow = {
  time: number;
  interval: number;
  hp: number;
  speed: number;
  wave: number;
  activeCap: number;
  elite: number;
};

const DIFFICULTY_TABLE: DifficultyRow[] = [
  { time: 0,   interval: 1.80, hp: 1.00, speed: 0.98, wave: 2,  activeCap: 18,  elite: 0.005 },
  { time: 30,  interval: 1.65, hp: 1.03, speed: 1.00, wave: 2,  activeCap: 24,  elite: 0.010 },
  { time: 60,  interval: 1.50, hp: 1.06, speed: 1.02, wave: 3,  activeCap: 32,  elite: 0.015 },
  { time: 120, interval: 1.30, hp: 1.12, speed: 1.04, wave: 3,  activeCap: 45,  elite: 0.025 },
  { time: 180, interval: 1.15, hp: 1.20, speed: 1.06, wave: 4,  activeCap: 60,  elite: 0.035 },
  { time: 240, interval: 1.00, hp: 1.32, speed: 1.09, wave: 5,  activeCap: 80,  elite: 0.045 },
  { time: 300, interval: 0.88, hp: 1.48, speed: 1.12, wave: 6,  activeCap: 105, elite: 0.060 },
  { time: 420, interval: 0.74, hp: 1.72, speed: 1.16, wave: 7,  activeCap: 140, elite: 0.080 },
  { time: 600, interval: 0.62, hp: 2.05, speed: 1.22, wave: 9,  activeCap: 190, elite: 0.100 },
  { time: 720, interval: 0.52, hp: 2.35, speed: 1.28, wave: 11, activeCap: 240, elite: 0.125 },
  { time: 900, interval: 0.45, hp: 2.75, speed: 1.34, wave: 13, activeCap: 300, elite: 0.150 },
] as const;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function getInterpolatedRow(elapsed: number): DifficultyRow {
  const first = DIFFICULTY_TABLE[0];
  if (elapsed <= first.time) return first;

  for (let i = 1; i < DIFFICULTY_TABLE.length; i++) {
    const previous = DIFFICULTY_TABLE[i - 1];
    const next = DIFFICULTY_TABLE[i];
    if (elapsed > next.time) continue;

    const t = (elapsed - previous.time) / (next.time - previous.time);
    return {
      time: elapsed,
      interval: lerp(previous.interval, next.interval, t),
      hp: lerp(previous.hp, next.hp, t),
      speed: lerp(previous.speed, next.speed, t),
      wave: Math.round(lerp(previous.wave, next.wave, t)),
      activeCap: Math.round(lerp(previous.activeCap, next.activeCap, t)),
      elite: lerp(previous.elite, next.elite, t),
    };
  }

  return DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1];
}

export function getDifficultyParams(
  elapsed: number,
  runDifficulty: RunDifficultyPreset = getRunDifficultyPreset(DEFAULT_RUN_DIFFICULTY_ID)
): DifficultyParams {
  const clampedElapsed = Math.max(0, elapsed);
  const current = getInterpolatedRow(clampedElapsed);

  return {
    difficulty: Math.floor(clampedElapsed / 30),
    enemyHpMultiplier: current.hp * runDifficulty.hpMult,
    enemySpeedMultiplier: current.speed * runDifficulty.speedMult,
    enemyDamageMultiplier: runDifficulty.damageMult,
    spawnInterval: current.interval * runDifficulty.spawnIntervalMult,
    waveBaseCount: Math.max(1, Math.round(current.wave * runDifficulty.waveCountMult)),
    activeEnemyCap: Math.max(12, Math.min(360, Math.round(current.activeCap * runDifficulty.activeCapMult))),
    eliteChance: Math.min(0.45, current.elite * runDifficulty.eliteChanceMult),
  };
}
