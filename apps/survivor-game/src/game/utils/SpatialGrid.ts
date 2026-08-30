import { sweptCircleCircleHitFraction } from './collision';

export interface SpatialGridMetrics {
  queries: number;
  candidateChecks: number;
  matches: number;
  sweptCollisionTests: number;
  earlyExits: number;
}

export class SpatialGrid<T extends { x: number; y: number; radius: number; hp?: number }> {
  private buckets = new Map<number, Map<number, T[]>>();
  private readonly recycledRows: Map<number, T[]>[] = [];
  private readonly recycledBuckets: T[][] = [];
  private maximumItemRadius = 0;
  private activeBuckets = 0;
  private allocatedBuckets = 0;
  private activeCollection?: T[];
  private readonly collectItem = (item: T): void => {
    this.activeCollection!.push(item);
  };
  private metricsEnabled = false;
  private readonly frameMetrics: SpatialGridMetrics = {
    queries: 0,
    candidateChecks: 0,
    matches: 0,
    sweptCollisionTests: 0,
    earlyExits: 0,
  };

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

  setMetricsEnabled(enabled: boolean): void {
    this.metricsEnabled = enabled;
  }

  resetMetrics(): void {
    this.frameMetrics.queries = 0;
    this.frameMetrics.candidateChecks = 0;
    this.frameMetrics.matches = 0;
    this.frameMetrics.sweptCollisionTests = 0;
    this.frameMetrics.earlyExits = 0;
  }

  get metrics(): Readonly<SpatialGridMetrics> {
    return this.frameMetrics;
  }

  forNearby(x: number, y: number, radius: number, visit: (item: T) => void): void {
    this.scanNearby(x, y, radius, visit, false);
  }

  forNearbyUntil(
    x: number,
    y: number,
    radius: number,
    visit: (item: T) => boolean
  ): boolean {
    return this.scanNearby(x, y, radius, visit, true);
  }

  private scanNearby(
    x: number,
    y: number,
    radius: number,
    visit: (item: T) => void | boolean,
    stopOnFalse: boolean
  ): boolean {
    if (this.metricsEnabled) this.frameMetrics.queries++;
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
          if (this.metricsEnabled) this.frameMetrics.candidateChecks++;
          const dx = item.x - x;
          const dy = item.y - y;
          const hitRadius = radius + item.radius;
          if (dx * dx + dy * dy > hitRadius * hitRadius) continue;
          if (this.metricsEnabled) this.frameMetrics.matches++;
          if (stopOnFalse && visit(item) === false) {
            if (this.metricsEnabled) this.frameMetrics.earlyExits++;
            return false;
          }
          if (!stopOnFalse) visit(item);
        }
      }
    }
    return true;
  }

  collectNearby(x: number, y: number, radius: number, out: T[]): number {
    out.length = 0;
    this.activeCollection = out;
    this.forNearby(x, y, radius, this.collectItem);
    this.activeCollection = undefined;
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
    if (this.metricsEnabled) this.frameMetrics.queries++;
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
          if (this.metricsEnabled) {
            this.frameMetrics.candidateChecks++;
            this.frameMetrics.sweptCollisionTests++;
          }
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
          if (hitFraction !== undefined) {
            if (this.metricsEnabled) this.frameMetrics.matches++;
            visit(item, hitFraction);
          }
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
