export type RunDifficultyId = 'easy' | 'hard' | 'nightmare';
export type DifficultyCurveId = 'standard' | 'nightmare';

export interface EndlessCurveConfig {
  startTime: number;
  cycleLength: number;
  hpPerCycle: number;
  hpQuadraticPerCycle: number;
  damagePerCycle: number;
  damageCap: number;
  spawnIntervalReductionPerCycle: number;
  spawnIntervalFloorMult: number;
  waveCountPerCycle: number;
  waveCountCapMult: number;
  eliteChancePerCycle: number;
  eliteChanceCap: number;
  complexEnemyWeightPerCycle: number;
  complexEnemyWeightCap: number;
}

export interface RunDifficultyPreset {
  id: RunDifficultyId;
  name: string;
  shortName: string;
  icon: string;
  desc: string;
  curveId: DifficultyCurveId;
  duration: number;
  bossTimes: number[];
  endless?: EndlessCurveConfig;
  spawnIntervalMult: number;
  waveCountMult: number;
  activeCapMult: number;
  hpMult: number;
  speedMult: number;
  damageMult: number;
  eliteChanceMult: number;
  enemyUnlockTimeMult: number;
  complexEnemyWeightMult: number;
  bossPatternLimit: number;
  enemyAttackCooldownMult: number;
  enemyProjectileCapMult: number;
  soulFireRewardMult: number;
}

export const DEFAULT_RUN_DIFFICULTY_ID: RunDifficultyId = 'hard';

export const RUN_DIFFICULTY_PRESETS: Record<RunDifficultyId, RunDifficultyPreset> = {
  easy: {
    id: 'easy',
    name: '简单',
    shortName: '7分钟',
    icon: '○',
    desc: '怪潮更松，远程压力更晚出现。',
    curveId: 'standard',
    duration: 7 * 60,
    bossTimes: [150, 300],
    spawnIntervalMult: 1.2,
    waveCountMult: 0.75,
    activeCapMult: 0.7,
    hpMult: 0.86,
    speedMult: 0.94,
    damageMult: 0.82,
    eliteChanceMult: 0.65,
    enemyUnlockTimeMult: 1.35,
    complexEnemyWeightMult: 0.55,
    bossPatternLimit: 1,
    enemyAttackCooldownMult: 1.25,
    enemyProjectileCapMult: 0.65,
    soulFireRewardMult: 0.75,
  },
  hard: {
    id: 'hard',
    name: '困难',
    shortName: '9分钟',
    icon: '◆',
    desc: '标准夜潮节奏，当前推荐体验。',
    curveId: 'standard',
    duration: 9 * 60,
    bossTimes: [180, 360],
    spawnIntervalMult: 1,
    waveCountMult: 1,
    activeCapMult: 1,
    hpMult: 1,
    speedMult: 1,
    damageMult: 1,
    eliteChanceMult: 1,
    enemyUnlockTimeMult: 1,
    complexEnemyWeightMult: 1,
    bossPatternLimit: 3,
    enemyAttackCooldownMult: 1,
    enemyProjectileCapMult: 1,
    soulFireRewardMult: 1,
  },
  nightmare: {
    id: 'nightmare',
    name: '噩梦',
    shortName: '12分钟',
    icon: '✹',
    desc: '12分钟清关曲线，后段靠密度和怪物复杂度压场。',
    curveId: 'nightmare',
    duration: 12 * 60,
    bossTimes: [180, 360, 540],
    endless: {
      startTime: 12 * 60,
      cycleLength: 120,
      hpPerCycle: 0.22,
      hpQuadraticPerCycle: 0.015,
      damagePerCycle: 0.05,
      damageCap: 1.65,
      spawnIntervalReductionPerCycle: 0.035,
      spawnIntervalFloorMult: 0.55,
      waveCountPerCycle: 0.07,
      waveCountCapMult: 1.85,
      eliteChancePerCycle: 0.018,
      eliteChanceCap: 0.32,
      complexEnemyWeightPerCycle: 0.12,
      complexEnemyWeightCap: 3,
    },
    spawnIntervalMult: 1,
    waveCountMult: 1,
    activeCapMult: 1,
    hpMult: 1,
    speedMult: 1,
    damageMult: 1,
    eliteChanceMult: 1,
    enemyUnlockTimeMult: 0.65,
    complexEnemyWeightMult: 1,
    bossPatternLimit: 3,
    enemyAttackCooldownMult: 0.85,
    enemyProjectileCapMult: 1.25,
    soulFireRewardMult: 1.4,
  },
} as const;

export const RUN_DIFFICULTY_ORDER: RunDifficultyId[] = ['easy', 'hard', 'nightmare'];

export function isRunDifficultyId(id?: string): id is RunDifficultyId {
  return !!id && Object.prototype.hasOwnProperty.call(RUN_DIFFICULTY_PRESETS, id);
}

export function getRunDifficultyPreset(id?: string): RunDifficultyPreset {
  return RUN_DIFFICULTY_PRESETS[isRunDifficultyId(id) ? id : DEFAULT_RUN_DIFFICULTY_ID];
}
