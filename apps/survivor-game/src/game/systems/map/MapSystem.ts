import { MapObstacle, MapZone } from '../../types';
import { hashXY, getZone } from '../../utils/math';
import { circleRectOverlap, pushCircleFromRect } from '../../utils/collision';
import { ARENA_SIZE, OBSTACLE_CELL_SIZE, OBSTACLE_HP, BLOOD_POOL_RADIUS, BLOOD_POOL_SLOW } from '../../constants';

const START_SAFE_RADIUS = 500;
const GRID_BUCKET_SIZE = OBSTACLE_CELL_SIZE * 2;
const OBSTACLE_QUERY_PADDING = 220;
type ObstacleOptions = {
  landmark?: boolean;
  rotation?: number;
  variant?: number;
};

export class MapSystem {
  private obstacles: MapObstacle[] = [];
  private grid = new Map<number, Map<number, MapObstacle[]>>();
  private halfArena = ARENA_SIZE / 2;

  generate(): void {
    this.obstacles = [];
    this.grid.clear();

    const cellSize = OBSTACLE_CELL_SIZE;
    const minCoord = -this.halfArena + cellSize;
    const maxCoord = this.halfArena - cellSize;

    for (let gx = minCoord; gx < maxCoord; gx += cellSize) {
      for (let gy = minCoord; gy < maxCoord; gy += cellSize) {
        const h = hashXY(gx, gy);

        if (h % this.getZoneDensity(getZone(gx, gy)) !== 0) continue;

        const dx0 = Math.abs(gx) < 150 ? 0 : gx;
        const dy0 = Math.abs(gy) < 150 ? 0 : gy;
        if (dx0 === 0 && dy0 === 0) continue;

        const jitter = 96;
        const ox = gx + ((h >>> 4) % (jitter * 2)) - jitter;
        const oy = gy + ((h >>> 12) % (jitter * 2)) - jitter;
        if (ox * ox + oy * oy < START_SAFE_RADIUS * START_SAFE_RADIUS) continue;

        const type = this.pickZoneObstacleType(getZone(ox, oy), (h >>> 8) % 100);
        const w = this.getBaseSize(type);
        const h2 = (h >>> 16) % 28;
        const size = w + h2;

        this.addObstacle(type, ox, oy, size, {
          rotation: ((h >>> 20) % 628) / 100,
          variant: (h >>> 24) % 4,
        });
      }
    }

    this.addLandmarks();
  }

  getNearby(minX: number, minY: number, maxX: number, maxY: number): MapObstacle[] {
    const result: MapObstacle[] = [];
    return this.collectNearby(minX, minY, maxX, maxY, result);
  }

  collectNearby(minX: number, minY: number, maxX: number, maxY: number, out: MapObstacle[]): MapObstacle[] {
    out.length = 0;
    this.forNearby(minX, minY, maxX, maxY, (obs) => out.push(obs));
    return out;
  }

  forNearby(minX: number, minY: number, maxX: number, maxY: number, visit: (obs: MapObstacle) => void): void {
    const cx0 = Math.floor(minX / GRID_BUCKET_SIZE);
    const cy0 = Math.floor(minY / GRID_BUCKET_SIZE);
    const cx1 = Math.floor(maxX / GRID_BUCKET_SIZE);
    const cy1 = Math.floor(maxY / GRID_BUCKET_SIZE);
    for (let cx = cx0; cx <= cx1; cx++) {
      const row = this.grid.get(cx);
      if (!row) continue;
      for (let cy = cy0; cy <= cy1; cy++) {
        const bucket = row.get(cy);
        if (!bucket) continue;
        for (let i = bucket.length - 1; i >= 0; i--) {
          if (bucket[i].hp <= 0) {
            bucket[i] = bucket[bucket.length - 1];
            bucket.pop();
          } else {
            visit(bucket[i]);
          }
        }
      }
    }
  }

  getVisible(camX: number, camY: number, viewW: number, viewH: number): MapObstacle[] {
    return this.collectVisible(camX, camY, viewW, viewH, []);
  }

  collectVisible(camX: number, camY: number, viewW: number, viewH: number, out: MapObstacle[]): MapObstacle[] {
    out.length = 0;
    this.forNearby(
      camX - viewW / 2 - OBSTACLE_QUERY_PADDING,
      camY - viewH / 2 - OBSTACLE_QUERY_PADDING,
      camX + viewW / 2 + OBSTACLE_QUERY_PADDING,
      camY + viewH / 2 + OBSTACLE_QUERY_PADDING,
      (obs) => out.push(obs)
    );
    return out;
  }

  handleCircleCollision(x: number, y: number, radius: number): { x: number; y: number } {
    let pushX = 0;
    let pushY = 0;
    this.forNearby(x - OBSTACLE_QUERY_PADDING, y - OBSTACLE_QUERY_PADDING, x + OBSTACLE_QUERY_PADDING, y + OBSTACLE_QUERY_PADDING, (obs) => {
      if (obs.type === 'blood_pool' || obs.type === 'magic_circle') return;
      if (obs.hp <= 0) return;
      const push = pushCircleFromRect(x + pushX, y + pushY, radius, obs.x, obs.y, obs.width, obs.height);
      if (push) {
        pushX += push.x;
        pushY += push.y;
      }
    });
    return { x: pushX, y: pushY };
  }

  handleProjectileCollision(px: number, py: number, radius: number): boolean {
    return this.projectileHitsSolidObstacle(px, py, radius, true);
  }

  projectileHitsSolidObstacle(px: number, py: number, radius: number, damageBoneWall = false): boolean {
    let hit = false;
    this.forNearby(px - OBSTACLE_QUERY_PADDING, py - OBSTACLE_QUERY_PADDING, px + OBSTACLE_QUERY_PADDING, py + OBSTACLE_QUERY_PADDING, (obs) => {
      if (hit) return;
      if (obs.type === 'blood_pool' || obs.type === 'magic_circle') return;
      if (obs.hp <= 0) return;
      if (circleRectOverlap(px, py, radius, obs.x, obs.y, obs.width, obs.height)) {
        if (damageBoneWall && obs.type === 'bone_wall') {
          obs.hp = Math.max(0, obs.hp - 1);
        }
        hit = true;
      }
    });
    return hit;
  }

  getBloodPoolSlowFactor(x: number, y: number, radius: number): number {
    let slowest = 1;
    this.forNearby(x - OBSTACLE_QUERY_PADDING, y - OBSTACLE_QUERY_PADDING, x + OBSTACLE_QUERY_PADDING, y + OBSTACLE_QUERY_PADDING, (obs) => {
      if (obs.type !== 'blood_pool') return;
      const dx = x - obs.x;
      const dy = y - obs.y;
      if (dx * dx + dy * dy < (radius + obs.radius) * (radius + obs.radius) && BLOOD_POOL_SLOW < slowest) {
        slowest = BLOOD_POOL_SLOW;
      }
    });
    return slowest;
  }

  getObstacles(): MapObstacle[] {
    return this.obstacles;
  }

  cleanupDestroyed(): number {
    const before = this.obstacles.length;
    this.obstacles = this.obstacles.filter(obs => obs.hp > 0);
    if (this.obstacles.length !== before) this.rebuildGrid();
    return before - this.obstacles.length;
  }

  private addLandmarks(): void {
    const points: Array<{ x: number; y: number; type: MapObstacle['type']; size: number; rotation?: number; variant?: number }> = [
      { x: -2180, y: 140, type: 'magic_circle', size: 154, rotation: -0.08, variant: 0 },
      { x: 2180, y: -160, type: 'magic_circle', size: 148, rotation: 0.12, variant: 1 },
      { x: -160, y: -2180, type: 'magic_circle', size: 150, rotation: 0.04, variant: 2 },
      { x: 120, y: 2180, type: 'magic_circle', size: 146, rotation: -0.1, variant: 3 },
      { x: -1080, y: -120, type: 'blood_pool', size: 172, rotation: 0.18, variant: 0 },
      { x: 1080, y: 260, type: 'blood_pool', size: 164, rotation: -0.28, variant: 1 },
      { x: -300, y: -1080, type: 'bone_wall', size: 138, rotation: 0.08, variant: 0 },
      { x: 340, y: 1080, type: 'bone_wall', size: 146, rotation: -0.12, variant: 1 },
      { x: -1060, y: -1040, type: 'tombstone', size: 132, rotation: -0.04, variant: 0 },
      { x: 1060, y: 1060, type: 'tombstone', size: 128, rotation: 0.08, variant: 1 },
    ];

    for (const point of points) {
      this.addObstacle(point.type, point.x, point.y, point.size, {
        landmark: true,
        rotation: point.rotation,
        variant: point.variant,
      });
    }
  }

  private getZoneDensity(zone: MapZone): number {
    switch (zone) {
      case 'blood': return 4;
      case 'bone': return 5;
      case 'shadow': return 5;
      case 'storm': return 6;
    }
  }

  private pickZoneObstacleType(zone: MapZone, roll: number): MapObstacle['type'] {
    switch (zone) {
      case 'shadow':
        if (roll < 55) return 'tombstone';
        if (roll < 75) return 'bone_wall';
        if (roll < 90) return 'blood_pool';
        return 'magic_circle';
      case 'blood':
        if (roll < 58) return 'blood_pool';
        if (roll < 78) return 'tombstone';
        if (roll < 92) return 'bone_wall';
        return 'magic_circle';
      case 'bone':
        if (roll < 52) return 'bone_wall';
        if (roll < 82) return 'tombstone';
        if (roll < 92) return 'blood_pool';
        return 'magic_circle';
      case 'storm':
        if (roll < 38) return 'magic_circle';
        if (roll < 64) return 'tombstone';
        if (roll < 84) return 'bone_wall';
        return 'blood_pool';
    }
  }

  private getBaseSize(type: MapObstacle['type']): number {
    switch (type) {
      case 'tombstone': return 50;
      case 'bone_wall': return 72;
      case 'blood_pool': return BLOOD_POOL_RADIUS * 2;
      case 'magic_circle': return 84;
    }
  }

  private addObstacle(type: MapObstacle['type'], x: number, y: number, size: number, options: ObstacleOptions = {}): void {
    const hp = type === 'bone_wall' ? OBSTACLE_HP : Infinity;
    const landmark = options.landmark === true;
    const width = type === 'blood_pool'
      ? size * (landmark ? 1.55 : 1.42)
      : type === 'bone_wall'
        ? size * (landmark ? 1.55 : 1.18)
        : size;
    const height = type === 'blood_pool'
      ? size
      : type === 'bone_wall'
        ? size * (landmark ? 0.86 : 0.7)
        : size * (landmark ? 0.82 : 0.76);
    const obstacle: MapObstacle = {
      x,
      y,
      width,
      height,
      type,
      zone: getZone(x, y),
      variant: options.variant ?? (hashXY(x, y) % 4),
      rotation: options.rotation ?? ((hashXY(x + 11, y - 7) % 60) - 30) * 0.01,
      landmark,
      hp,
      maxHp: hp,
      radius: type === 'blood_pool'
        ? size * 0.72
        : type === 'magic_circle'
          ? size * 0.56
          : size * 0.5,
    };
    this.obstacles.push(obstacle);
    this.indexObstacle(obstacle);
  }

  private indexObstacle(obstacle: MapObstacle): void {
    const cx = Math.floor(obstacle.x / GRID_BUCKET_SIZE);
    const cy = Math.floor(obstacle.y / GRID_BUCKET_SIZE);
    let row = this.grid.get(cx);
    if (!row) {
      row = new Map();
      this.grid.set(cx, row);
    }
    let bucket = row.get(cy);
    if (!bucket) {
      bucket = [];
      row.set(cy, bucket);
    }
    bucket.push(obstacle);
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const obstacle of this.obstacles) {
      this.indexObstacle(obstacle);
    }
  }
}
