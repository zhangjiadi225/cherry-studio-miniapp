export interface RandomSource {
  next(): number;
}

export const SYSTEM_RANDOM: RandomSource = Object.freeze({
  next: () => Math.random(),
});

export class SeededRandom implements RandomSource {
  private state = 0;

  constructor(seed: number) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.state = normalizeSeed(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  return Math.trunc(seed) >>> 0;
}

export function createRunSeed(): number {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }
  return normalizeSeed(Date.now() ^ Math.floor(performance.now() * 1000));
}
