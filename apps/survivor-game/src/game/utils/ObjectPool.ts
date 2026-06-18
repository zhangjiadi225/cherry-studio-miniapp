export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 32, maxSize: number = 1024) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
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

  get available(): number {
    return this.pool.length;
  }
}
