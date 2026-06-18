export interface DifficultyParams {
  difficulty: number;
  enemyHpMultiplier: number;
  enemySpeedMultiplier: number;
  spawnInterval: number;
  waveBaseCount: number;
  waveMaxCount: number;
  eliteChance: number;
}

type DifficultyRow = {
  time: number;
  interval: number;
  hp: number;
  speed: number;
  wave: number;
  max: number;
  elite: number;
};

const DIFFICULTY_TABLE: DifficultyRow[] = [
  { time: 0,   interval: 1.5, hp: 1.00, speed: 1.00, wave: 2,  max: 15, elite: 0.02 },
  { time: 60,  interval: 1.2, hp: 1.06, speed: 1.02, wave: 3,  max: 15, elite: 0.03 },
  { time: 120, interval: 0.95, hp: 1.12, speed: 1.04, wave: 4,  max: 15, elite: 0.04 },
  { time: 180, interval: 0.75, hp: 1.18, speed: 1.06, wave: 5,  max: 15, elite: 0.05 },
  { time: 300, interval: 0.55, hp: 1.30, speed: 1.10, wave: 7,  max: 15, elite: 0.07 },
  { time: 600, interval: 0.35, hp: 1.60, speed: 1.18, wave: 10, max: 15, elite: 0.10 },
] as const;

export function getDifficultyParams(elapsed: number): DifficultyParams {
  const clampedElapsed = Math.max(0, elapsed);
  let current = DIFFICULTY_TABLE[0];
  for (let i = 1; i < DIFFICULTY_TABLE.length; i++) {
    if (clampedElapsed >= DIFFICULTY_TABLE[i].time) current = DIFFICULTY_TABLE[i];
    else break;
  }

  return {
    difficulty: Math.floor(clampedElapsed / 30),
    enemyHpMultiplier: current.hp,
    enemySpeedMultiplier: current.speed,
    spawnInterval: current.interval,
    waveBaseCount: current.wave,
    waveMaxCount: current.max,
    eliteChance: current.elite,
  };
}
