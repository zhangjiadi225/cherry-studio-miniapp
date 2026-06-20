export class SpatialGrid<T extends { x: number; y: number; radius: number; hp?: number }> {
  private buckets = new Map<number, Map<number, T[]>>();

  constructor(private readonly cellSize: number) {}

  rebuild(items: T[]) {
    this.buckets.clear();
    for (const item of items) {
      if ((item.hp ?? 1) <= 0) continue;
      const gx = Math.floor(item.x / this.cellSize);
      const gy = Math.floor(item.y / this.cellSize);
      let row = this.buckets.get(gx);
      if (!row) {
        row = new Map();
        this.buckets.set(gx, row);
      }
      let bucket = row.get(gy);
      if (!bucket) {
        bucket = [];
        row.set(gy, bucket);
      }
      bucket.push(item);
    }
  }

  forNearby(x: number, y: number, radius: number, visit: (item: T) => void) {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

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
}
