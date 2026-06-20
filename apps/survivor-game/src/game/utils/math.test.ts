import { describe, expect, it } from 'vitest';
import { MAP_ZONE_SIZE } from '../constants';
import { circlesOverlap, compactArray, getZone } from './math';

describe('circlesOverlap', () => {
  it('returns true when circles overlap', () => {
    expect(circlesOverlap(0, 0, 5, 7, 0, 4)).toBe(true);
  });

  it('returns false when circles only touch at the edge', () => {
    expect(circlesOverlap(0, 0, 5, 10, 0, 5)).toBe(false);
  });
});

describe('compactArray', () => {
  it('keeps empty arrays empty', () => {
    const values: number[] = [];
    expect(compactArray(values, () => true)).toBe(0);
    expect(values).toEqual([]);
  });

  it('removes matching values in place', () => {
    const values = [1, 2, 3, 4, 5];
    expect(compactArray(values, (value) => value % 2 === 0)).toBe(2);
    expect(values).toEqual([1, 3, 5]);
  });

  it('handles removing all or none', () => {
    const all = [1, 2, 3];
    expect(compactArray(all, () => true)).toBe(3);
    expect(all).toEqual([]);

    const none = [1, 2, 3];
    expect(compactArray(none, () => false)).toBe(0);
    expect(none).toEqual([1, 2, 3]);
  });
});

describe('getZone', () => {
  it('uses stable macro blocks with a storm starting area', () => {
    expect(getZone(0, 0)).toBe('storm');
    expect(getZone(MAP_ZONE_SIZE * 0.5 - 1, 0)).toBe('storm');
    expect(getZone(MAP_ZONE_SIZE * 0.5 + 1, 0)).toBe('blood');
    expect(getZone(0, MAP_ZONE_SIZE * 0.5 + 1)).toBe('bone');
    expect(getZone(MAP_ZONE_SIZE * 0.5 + 1, MAP_ZONE_SIZE * 0.5 + 1)).toBe('shadow');
  });
});
