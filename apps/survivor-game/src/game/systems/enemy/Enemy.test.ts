import { describe, expect, it } from 'vitest';
import { ENEMY_DATA } from '../../constants';
import { EnemyType } from '../../types';
import { createEnemy } from './Enemy';

describe('createEnemy', () => {
  it('makes curse increase enemy reward as well as enemy pressure', () => {
    const enemy = createEnemy(EnemyType.MUMMY, 0, 0, 0, 1.5);

    expect(enemy.hp).toBe(ENEMY_DATA[EnemyType.MUMMY].baseHp * 1.5);
    expect(enemy.damage).toBe(ENEMY_DATA[EnemyType.MUMMY].baseDamage * 1.5);
    expect(enemy.xpValue).toBe(ENEMY_DATA[EnemyType.MUMMY].xpValue * 1.5);
  });
});
