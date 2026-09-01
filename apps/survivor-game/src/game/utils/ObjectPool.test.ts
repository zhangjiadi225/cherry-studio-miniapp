import { describe, expect, it } from 'vitest';
import { ObjectPool } from './ObjectPool';

describe('ObjectPool', () => {
  it('acquires, resets, and reuses released objects', () => {
    let created = 0;
    const pool = new ObjectPool(
      () => ({ id: ++created, value: 0 }),
      (item) => { item.value = 0; },
      1,
      2
    );

    const item = pool.acquire();
    item.value = 42;
    pool.release(item);

    expect(pool.available).toBe(1);
    const reused = pool.acquire();
    expect(reused).toBe(item);
    expect(reused.value).toBe(0);
  });

  it('caps retained objects at max size', () => {
    const pool = new ObjectPool(
      () => ({ value: 0 }),
      (item) => { item.value = 0; },
      0,
      2
    );

    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    pool.release(a);
    pool.release(b);
    pool.release(c);

    expect(pool.available).toBe(2);
  });

  it('releaseAll resets objects and clears the source array', () => {
    const pool = new ObjectPool(
      () => ({ value: 0 }),
      (item) => { item.value = 0; },
      0,
      4
    );
    const items = [{ value: 1 }, { value: 2 }];

    pool.releaseAll(items);

    expect(items).toEqual([]);
    expect(pool.available).toBe(2);
  });
});
