import { describe, expect, it } from 'vitest';
import { SeededRandom, normalizeSeed } from './Random';

describe('SeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = new SeededRandom(123456);
    const second = new SeededRandom(123456);

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(), second.next(), second.next(),
    ]);
  });

  it('can reset a run to its initial random state', () => {
    const random = new SeededRandom(42);
    const expected = random.next();

    random.next();
    random.reset(42);

    expect(random.next()).toBe(expected);
  });
});

describe('normalizeSeed', () => {
  it('normalizes values to unsigned 32-bit integers', () => {
    expect(normalizeSeed(-1)).toBe(0xffffffff);
    expect(normalizeSeed(Number.NaN)).toBe(0);
  });
});
