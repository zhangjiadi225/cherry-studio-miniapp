export class SpatialGrid<T extends { x: number; y: number; radius: number; hp?: number }> {
  private buckets = new Map<string, T[]>();

  constructor(private readonly cellSize: number) {}

  rebuild(items: T[]) {
    this.buckets.clear();
    for (const item of items) {
      if ((item.hp ?? 1) <= 0) continue;
      const key = this.getKey(item.x, item.y);
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = [];
        this.buckets.set(key, bucket);
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
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = this.buckets.get(`${gx}:${gy}`);
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

  private getKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }
}
