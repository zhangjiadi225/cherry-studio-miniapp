import { describe, expect, it } from 'vitest';
import { SpatialGrid } from './SpatialGrid';

type Item = { id: number; x: number; y: number; radius: number; hp: number };

describe('SpatialGrid', () => {
  it('includes a neighboring-cell item whose radius overlaps the query', () => {
    const grid = new SpatialGrid<Item>(10);
    const item = { id: 1, x: 11, y: 0, radius: 3, hp: 1 };
    const hits: Item[] = [];

    grid.rebuild([item]);
    grid.forNearby(8, 0, 1, (candidate) => hits.push(candidate));

    expect(hits).toEqual([item]);
  });

  it('reports contact fractions for every swept-circle candidate', () => {
    const grid = new SpatialGrid<Item>(10);
    const hits: Array<{ id: number; fraction: number }> = [];
    grid.rebuild([
      { id: 1, x: 15, y: 0, radius: 2, hp: 1 },
      { id: 2, x: 5, y: 0, radius: 2, hp: 1 },
    ]);

    grid.forSweptCircle(0, 0, 20, 0, 1, (item, fraction) => {
      hits.push({ id: item.id, fraction });
    });
    hits.sort((left, right) => left.fraction - right.fraction);

    expect(hits.map((hit) => hit.id)).toEqual([2, 1]);
  });

  it('reuses allocated buckets across rebuilds', () => {
    const grid = new SpatialGrid<Item>(10);
    grid.rebuild([
      { id: 1, x: 0, y: 0, radius: 1, hp: 1 },
      { id: 2, x: 20, y: 20, radius: 1, hp: 1 },
    ]);
    const warmedCapacity = grid.bucketCapacity;

    grid.rebuild([
      { id: 3, x: 40, y: 40, radius: 1, hp: 1 },
      { id: 4, x: 60, y: 60, radius: 1, hp: 1 },
    ]);

    expect(grid.activeBucketCount).toBe(2);
    expect(grid.bucketCapacity).toBe(warmedCapacity);
  });
});
