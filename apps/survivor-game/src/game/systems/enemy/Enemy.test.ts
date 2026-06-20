import { describe, expect, it } from 'vitest';
import { BOSS_DMG_MULT, ELITE_DAMAGE_MULT, ENEMY_DATA } from '../../constants';
import { getDifficultyParams } from '../../data/difficulty';
import { RUN_DIFFICULTY_PRESETS } from '../../data/runDifficulties';
import { EnemyType } from '../../types';
import { createEnemy, damageEnemy, getEnemyEnhancementUnlockAt, updateEnemy } from './Enemy';
import { createPlayer } from '../player/Player';

describe('createEnemy', () => {
  it('makes curse increase enemy reward as well as enemy pressure', () => {
    const enemy = createEnemy(EnemyType.MUMMY, 0, 0, 0, 1.5);

    expect(enemy.hp).toBe(ENEMY_DATA[EnemyType.MUMMY].baseHp * 1.5);
    expect(enemy.damage).toBe(ENEMY_DATA[EnemyType.MUMMY].baseDamage * 1.5);
    expect(enemy.xpValue).toBe(ENEMY_DATA[EnemyType.MUMMY].xpValue * 1.5);
  });

  it('locks enemy enhancements behind their configured stage time', () => {
    const before = createEnemy(EnemyType.BAT, 0, 0, 0, 1, false, false, undefined, 74);
    const after = createEnemy(EnemyType.BAT, 0, 0, 0, 1, false, false, undefined, 75);

    expect(before.isEmpowered).toBe(false);
    expect(before.trait).toBe('none');
    expect(after.isEmpowered).toBe(true);
    expect(after.trait).toBe('dash');
  });

  it('applies difficulty unlock timing to enhanced enemies', () => {
    const unlockAt = getEnemyEnhancementUnlockAt(EnemyType.GHOST, 1.35)!;
    const before = createEnemy(EnemyType.GHOST, 0, 0, 0, 1, false, false, undefined, unlockAt - 1, 1.35);
    const after = createEnemy(EnemyType.GHOST, 0, 0, 0, 1, false, false, undefined, unlockAt, 1.35);

    expect(before.isEmpowered).toBe(false);
    expect(after.isEmpowered).toBe(true);
    expect(after.trait).toBe('phase');
  });

  it('keeps elite contact damage separate from elite hp scaling', () => {
    const params = getDifficultyParams(540, RUN_DIFFICULTY_PRESETS.nightmare);
    const enemy = createEnemy(
      EnemyType.DEMON,
      0,
      0,
      params.difficulty,
      1,
      true,
      false,
      params,
      540,
      RUN_DIFFICULTY_PRESETS.nightmare.enemyUnlockTimeMult
    );

    expect(enemy.hp).toBeGreaterThan(ENEMY_DATA[EnemyType.DEMON].baseHp * params.enemyHpMultiplier * 3);
    expect(enemy.damage).toBeCloseTo(
      ENEMY_DATA[EnemyType.DEMON].baseDamage * params.enemyDamageMultiplier * ELITE_DAMAGE_MULT * 1.1
    );
    expect(enemy.damage).toBeLessThanOrEqual(45);
  });

  it('does not stack elite damage onto nightmare boss contact damage', () => {
    const params = getDifficultyParams(540, RUN_DIFFICULTY_PRESETS.nightmare);
    const boss = createEnemy(
      EnemyType.WRAITH,
      0,
      0,
      params.difficulty,
      1,
      true,
      true,
      params,
      540,
      RUN_DIFFICULTY_PRESETS.nightmare.enemyUnlockTimeMult
    );
    const bossContactDamage = boss.damage * BOSS_DMG_MULT;

    expect(boss.damage).toBeCloseTo(ENEMY_DATA[EnemyType.WRAITH].baseDamage * params.enemyDamageMultiplier);
    expect(bossContactDamage).toBeCloseTo(57.5);
    expect(bossContactDamage).toBeLessThanOrEqual(75);
  });

  it('reduces damage and knockback for empowered shield skeletons', () => {
    const enemy = createEnemy(EnemyType.SKELETON, 0, 0, 0, 1, false, false, undefined, 135);
    const hp = enemy.hp;

    damageEnemy(enemy, 10, 100, 0);

    expect(hp - enemy.hp).toBeCloseTo(7.2);
    expect(enemy.knockbackX).toBeCloseTo(45);
  });

  it('starts dash windup only after bat enhancement unlocks', () => {
    const player = createPlayer();
    player.x = 180;
    const enemy = createEnemy(EnemyType.BAT, 0, 0, 0, 1, false, false, undefined, 75);
    enemy.traitCooldown = 0;

    updateEnemy(enemy, player, 0.016);

    expect(enemy.traitWindup).toBeGreaterThan(0);
    expect(enemy.traitDirX).toBeGreaterThan(0.99);
  });
});
