export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;
  private misses = 0;
  private created = 0;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 32, maxSize: number = 1024) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    this.prewarm(initialSize);
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    this.misses++;
    this.created++;
    return this.factory();
  }

  release(obj: T) {
    this.reset(obj);
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  releaseAll(arr: T[]) {
    for (let i = 0; i < arr.length; i++) {
      this.reset(arr[i]);
      if (this.pool.length < this.maxSize) {
        this.pool.push(arr[i]);
      }
    }
    arr.length = 0;
  }

  clear() {
    this.pool.length = 0;
  }

  prewarm(size: number) {
    const target = Math.min(this.maxSize, Math.max(0, Math.floor(size)));
    while (this.pool.length < target) {
      this.pool.push(this.factory());
      this.created++;
    }
  }

  resetMetrics() {
    this.misses = 0;
  }

  get available(): number {
    return this.pool.length;
  }

  get factoryMisses(): number {
    return this.misses;
  }

  get createdCount(): number {
    return this.created;
  }
}
