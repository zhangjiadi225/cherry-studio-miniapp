import { sweptCircleCircleHitFraction } from './collision';

export class SpatialGrid<T extends { x: number; y: number; radius: number; hp?: number }> {
  private buckets = new Map<number, Map<number, T[]>>();
  private readonly recycledRows: Map<number, T[]>[] = [];
  private readonly recycledBuckets: T[][] = [];
  private maximumItemRadius = 0;
  private activeBuckets = 0;
  private allocatedBuckets = 0;

  constructor(private readonly cellSize: number) {}

  rebuild(items: T[]) {
    this.recycleActiveStorage();
    this.maximumItemRadius = 0;
    for (const item of items) {
      if ((item.hp ?? 1) <= 0) continue;
      this.maximumItemRadius = Math.max(this.maximumItemRadius, item.radius);
      const gx = Math.floor(item.x / this.cellSize);
      const gy = Math.floor(item.y / this.cellSize);
      let row = this.buckets.get(gx);
      if (!row) {
        row = this.recycledRows.pop() ?? new Map<number, T[]>();
        this.buckets.set(gx, row);
      }
      let bucket = row.get(gy);
      if (!bucket) {
        bucket = this.recycledBuckets.pop();
        if (!bucket) {
          bucket = [];
          this.allocatedBuckets++;
        }
        row.set(gy, bucket);
        this.activeBuckets++;
      }
      bucket.push(item);
    }
  }

  forNearby(x: number, y: number, radius: number, visit: (item: T) => void) {
    const lookupRadius = radius + this.maximumItemRadius;
    const minX = Math.floor((x - lookupRadius) / this.cellSize);
    const maxX = Math.floor((x + lookupRadius) / this.cellSize);
    const minY = Math.floor((y - lookupRadius) / this.cellSize);
    const maxY = Math.floor((y + lookupRadius) / this.cellSize);

    for (let gx = minX; gx <= maxX; gx++) {
      const row = this.buckets.get(gx);
      if (!row) continue;
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = row.get(gy);
        if (!bucket) continue;
        for (const item of bucket) {
          if ((item.hp ?? 1) <= 0) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          const hitRadius = radius + item.radius;
          if (dx * dx + dy * dy <= hitRadius * hitRadius) visit(item);
        }
      }
    }
  }

  collectNearby(x: number, y: number, radius: number, out: T[]): number {
    out.length = 0;
    this.forNearby(x, y, radius, (item) => {
      out.push(item);
    });
    return out.length;
  }

  forSweptCircle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    radius: number,
    visit: (item: T, hitFraction: number) => void
  ): void {
    const padding = radius + this.maximumItemRadius;
    const minX = Math.floor((Math.min(startX, endX) - padding) / this.cellSize);
    const maxX = Math.floor((Math.max(startX, endX) + padding) / this.cellSize);
    const minY = Math.floor((Math.min(startY, endY) - padding) / this.cellSize);
    const maxY = Math.floor((Math.max(startY, endY) + padding) / this.cellSize);

    for (let gx = minX; gx <= maxX; gx++) {
      const row = this.buckets.get(gx);
      if (!row) continue;
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = row.get(gy);
        if (!bucket) continue;
        for (const item of bucket) {
          if ((item.hp ?? 1) <= 0) continue;
          const hitFraction = sweptCircleCircleHitFraction(
            startX,
            startY,
            endX,
            endY,
            radius,
            item.x,
            item.y,
            item.radius
          );
          if (hitFraction !== undefined) visit(item, hitFraction);
        }
      }
    }
  }

  get activeBucketCount(): number {
    return this.activeBuckets;
  }

  get bucketCapacity(): number {
    return this.allocatedBuckets;
  }

  private recycleActiveStorage(): void {
    for (const row of this.buckets.values()) {
      for (const bucket of row.values()) {
        bucket.length = 0;
        this.recycledBuckets.push(bucket);
      }
      row.clear();
      this.recycledRows.push(row);
    }
    this.buckets.clear();
    this.activeBuckets = 0;
  }
}
