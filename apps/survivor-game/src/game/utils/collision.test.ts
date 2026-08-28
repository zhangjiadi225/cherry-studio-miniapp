import { describe, expect, it } from 'vitest';
import { sweptCircleCircleHitFraction, sweptCircleRectHitFraction } from './collision';

describe('continuous collision helpers', () => {
  it('finds the first circle contact along a movement segment', () => {
    expect(sweptCircleCircleHitFraction(0, 0, 20, 0, 2, 10, 0, 2)).toBeCloseTo(0.3);
  });

  it('does not report a path that misses the target circle', () => {
    expect(sweptCircleCircleHitFraction(0, 0, 20, 0, 2, 10, 5, 2)).toBeUndefined();
  });

  it('detects an AABB crossing without accepting an expanded-corner false positive', () => {
    expect(sweptCircleRectHitFraction(-20, 0, 20, 0, 2, 0, 0, 10, 10)).toBeCloseTo(0.325);
    expect(sweptCircleRectHitFraction(-20, 7.5, 20, 7.5, 2, 0, 0, 10, 10)).toBeUndefined();
  });
});
