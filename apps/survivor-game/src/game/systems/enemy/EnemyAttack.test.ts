import { describe, expect, it } from 'vitest';
import { RUN_DIFFICULTY_PRESETS } from '../../data/runDifficulties';
import { EnemyType, type EnemyProjectile } from '../../types';
import { MapSystem } from '../map/MapSystem';
import { createPlayer } from '../player/Player';
import { createEnemy } from './Enemy';
import { ENEMY_PROJECTILE_LIFETIME, updateEnemyAttacks, updateEnemyProjectile } from './EnemyAttack';

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

  it('hits the player when a fast projectile crosses them between updates', () => {
    const player = createPlayer();
    const projectile: EnemyProjectile = {
      x: -120,
      y: 0,
      vx: 14_400,
      vy: 0,
      damage: 5,
      radius: 5,
      life: 1,
      maxLife: 1,
      sourceType: EnemyType.CULTIST,
      sourceId: 1,
      kind: 'cultist_bolt',
      color: '#fff',
      glowColor: '#fff',
      animTimer: 0,
    };

    expect(updateEnemyProjectile(projectile, player, new MapSystem(), 1 / 60)).toBe('hitPlayer');
  });
});
