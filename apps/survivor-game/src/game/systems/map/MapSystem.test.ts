import { describe, expect, it } from 'vitest';
import { BLOOD_POOL_SLOW } from '../../constants';
import { getZone } from '../../utils/math';
import { MapSystem } from './MapSystem';

describe('MapSystem', () => {
  it('generates zone-aware obstacles with a safe starting area', () => {
    const map = new MapSystem();

    map.generate();

    const obstacles = map.getObstacles();
    const counts = obstacles.reduce<Record<string, number>>((acc, obs) => {
      acc[obs.type] = (acc[obs.type] ?? 0) + 1;
      return acc;
    }, {});

    expect(obstacles.length).toBeGreaterThan(110);
    expect(counts.tombstone).toBeGreaterThan(0);
    expect(counts.bone_wall).toBeGreaterThan(0);
    expect(counts.blood_pool).toBeGreaterThan(0);
    expect(counts.magic_circle).toBeGreaterThan(0);
    expect(obstacles.every(obs => obs.zone === getZone(obs.x, obs.y))).toBe(true);
    expect(obstacles.every(obs => obs.x * obs.x + obs.y * obs.y >= 500 * 500)).toBe(true);
    expect(obstacles.filter(obs => obs.landmark).length).toBeGreaterThanOrEqual(10);
    expect(obstacles.every(obs => Number.isFinite(obs.rotation))).toBe(true);
    expect(obstacles.every(obs => obs.variant >= 0)).toBe(true);
  });

  it('collects nearby obstacles into a reusable output array', () => {
    const map = new MapSystem();
    const out = [{ type: 'stale' }] as unknown[];

    map.generate();
    const result = map.collectNearby(-1600, -1600, 1600, 1600, out as never[]);

    expect(result).toBe(out);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(obs => 'x' in obs && 'type' in obs)).toBe(true);
  });

  it('applies map mechanics and removes destroyed bone walls', () => {
    const map = new MapSystem();
    map.generate();
    const bloodPool = map.getObstacles().find(obs => obs.type === 'blood_pool')!;
    const boneWall = map.getObstacles().find(obs => obs.type === 'bone_wall')!;

    expect(map.getBloodPoolSlowFactor(bloodPool.x, bloodPool.y, 14)).toBe(BLOOD_POOL_SLOW);

    for (let i = 0; i < 10; i++) {
      map.handleProjectileCollision(boneWall.x, boneWall.y, 4);
    }

    expect(boneWall.hp).toBe(0);
    expect(map.cleanupDestroyed()).toBeGreaterThan(0);
    expect(map.getObstacles()).not.toContain(boneWall);

    const nearby = map.getNearby(boneWall.x - 20, boneWall.y - 20, boneWall.x + 20, boneWall.y + 20);
    expect(nearby).not.toContain(boneWall);
  });
});
