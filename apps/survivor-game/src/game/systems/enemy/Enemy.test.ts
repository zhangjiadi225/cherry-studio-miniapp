import { describe, expect, it } from 'vitest';
import { ENEMY_DATA } from '../../constants';
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
