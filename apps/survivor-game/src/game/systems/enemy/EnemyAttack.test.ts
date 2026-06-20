import { describe, expect, it } from 'vitest';
import { RUN_DIFFICULTY_PRESETS } from '../../data/runDifficulties';
import { EnemyType, type EnemyProjectile } from '../../types';
import { createPlayer } from '../player/Player';
import { createEnemy } from './Enemy';
import { ENEMY_PROJECTILE_LIFETIME, updateEnemyAttacks } from './EnemyAttack';

describe('updateEnemyAttacks', () => {
  it('uses the shorter projectile lifetime and slower ordinary ranged cadence', () => {
    const player = createPlayer();
    const cultist = createEnemy(EnemyType.CULTIST, 200, 0, 0, 1, false, false, undefined, 120);
    const projectiles: EnemyProjectile[] = [];
    cultist.attackCooldown = 0;

    updateEnemyAttacks([cultist], player, projectiles, 0, RUN_DIFFICULTY_PRESETS.hard);
    expect(projectiles).toHaveLength(0);
    expect(cultist.attackWindup).toBeCloseTo(0.34);

    updateEnemyAttacks([cultist], player, projectiles, 1, RUN_DIFFICULTY_PRESETS.hard);

    expect(projectiles).toHaveLength(1);
    expect(projectiles[0].life).toBe(ENEMY_PROJECTILE_LIFETIME);
    expect(cultist.attackCooldown).toBeCloseTo(2.05);
  });
});
