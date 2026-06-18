import { MapObstacle } from '../../types';
import { hashXY } from '../../utils/math';
import { circleRectOverlap, pushCircleFromRect } from '../../utils/collision';
import { ARENA_SIZE, OBSTACLE_CELL_SIZE, OBSTACLE_HP, BLOOD_POOL_RADIUS, MAGIC_CIRCLE_HEAL_RATE, MAGIC_CIRCLE_RADIUS } from '../../constants';

export class MapSystem {
  private obstacles: MapObstacle[] = [];
  private grid = new Map<string, MapObstacle[]>();
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

        if (h % 7 !== 0) continue;

        const dx0 = Math.abs(gx) < 150 ? 0 : gx;
        const dy0 = Math.abs(gy) < 150 ? 0 : gy;
        if (dx0 === 0 && dy0 === 0) continue;

        const typeRoll = (h >> 8) % 100;
        let type: MapObstacle['type'];
        let w: number, hp: number;

        if (typeRoll < 30) {
          type = 'tombstone'; w = 35; hp = Infinity;
        } else if (typeRoll < 60) {
          type = 'bone_wall'; w = 50; hp = OBSTACLE_HP;
        } else if (typeRoll < 85) {
          type = 'blood_pool'; w = BLOOD_POOL_RADIUS * 2; hp = Infinity;
        } else {
          type = 'magic_circle'; w = 60; hp = Infinity;
        }

        const ox = gx + ((h >> 4) % 80) - 40;
        const oy = gy + ((h >> 12) % 80) - 40;
        const h2 = (h >> 16) % 20;
        const size = w + h2;

        const obstacle: MapObstacle = {
          x: ox,
          y: oy,
          width: type === 'blood_pool' ? size * 1.3 : size,
          height: type === 'blood_pool' ? size : size * 0.7,
          type,
          hp,
          maxHp: hp,
          radius: type === 'blood_pool' ? size * 0.65 : size * 0.5,
        };

        this.obstacles.push(obstacle);

        const cellKey = `${Math.floor(ox / (cellSize * 2))},${Math.floor(oy / (cellSize * 2))}`;
        let bucket = this.grid.get(cellKey);
        if (!bucket) {
          bucket = [];
          this.grid.set(cellKey, bucket);
        }
        bucket.push(obstacle);
      }
    }
  }

  getNearby(minX: number, minY: number, maxX: number, maxY: number): MapObstacle[] {
    const result: MapObstacle[] = [];
    const cellSize = OBSTACLE_CELL_SIZE * 2;
    const cx0 = Math.floor(minX / cellSize);
    const cy0 = Math.floor(minY / cellSize);
    const cx1 = Math.floor(maxX / cellSize);
    const cy1 = Math.floor(maxY / cellSize);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const bucket = this.grid.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (let i = bucket.length - 1; i >= 0; i--) {
          if (bucket[i].hp <= 0) {
            bucket[i] = bucket[bucket.length - 1];
            bucket.pop();
          } else {
            result.push(bucket[i]);
          }
        }
      }
    }
    return result;
  }

  getVisible(camX: number, camY: number, viewW: number, viewH: number): MapObstacle[] {
    return this.getNearby(
      camX - viewW / 2 - 100,
      camY - viewH / 2 - 100,
      camX + viewW / 2 + 100,
      camY + viewH / 2 + 100
    );
  }

  handleCircleCollision(x: number, y: number, radius: number): { x: number; y: number } {
    const nearby = this.getNearby(x - 100, y - 100, x + 100, y + 100);
    let pushX = 0;
    let pushY = 0;
    for (const obs of nearby) {
      if (obs.type === 'blood_pool' || obs.type === 'magic_circle') continue;
      if (obs.hp <= 0) continue;
      const push = pushCircleFromRect(x + pushX, y + pushY, radius, obs.x, obs.y, obs.width, obs.height);
      if (push) {
        pushX += push.x;
        pushY += push.y;
      }
    }
    return { x: pushX, y: pushY };
  }

  handleProjectileCollision(px: number, py: number, radius: number): boolean {
    const nearby = this.getNearby(px - 50, py - 50, px + 50, py + 50);
    for (const obs of nearby) {
      if (obs.type === 'blood_pool' || obs.type === 'magic_circle') continue;
      if (obs.hp <= 0) continue;
      if (circleRectOverlap(px, py, radius, obs.x, obs.y, obs.width, obs.height)) {
        if (obs.type === 'bone_wall') {
          obs.hp -= 1;
        }
        return true;
      }
    }
    return false;
  }

  getObstacles(): MapObstacle[] {
    return this.obstacles;
  }
}
