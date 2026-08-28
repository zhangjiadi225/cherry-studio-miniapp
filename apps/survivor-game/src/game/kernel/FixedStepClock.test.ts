import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './FixedStepClock';

describe('FixedStepClock', () => {
  it('runs rules with a stable step and carries the fractional remainder', () => {
    const clock = new FixedStepClock(0.02, 4, 0.2);
    const updates: number[] = [];

    const first = clock.advance(0.05, (dt) => {
      updates.push(dt);
    });
    const second = clock.advance(0.01, (dt) => {
      updates.push(dt);
    });

    expect(first.steps).toBe(2);
    expect(second.steps).toBe(1);
    expect(updates).toEqual([0.02, 0.02, 0.02]);
    expect(second.interpolationAlpha).toBeCloseTo(0, 8);
  });

  it('drops bounded overflow instead of entering an update spiral', () => {
    const clock = new FixedStepClock(0.02, 3, 0.2);

    const result = clock.advance(0.5, () => undefined);

    expect(result.steps).toBe(3);
    expect(result.droppedSeconds).toBeCloseTo(0.44, 8);
    expect(clock.totalDroppedSeconds).toBeCloseTo(0.44, 8);
  });

  it('discards pending time when a state transition stops simulation', () => {
    const clock = new FixedStepClock(0.02, 4, 0.2);

    const result = clock.advance(0.08, () => false);
    const resumed = clock.advance(0.01, () => undefined);

    expect(result.steps).toBe(1);
    expect(resumed.steps).toBe(0);
  });
});
