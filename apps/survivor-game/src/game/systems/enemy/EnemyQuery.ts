import type { Enemy } from '../../types';
import type { SpatialGrid } from '../../utils/SpatialGrid';

export interface EnemyQuery {
  forNearby(x: number, y: number, radius: number, visit: (enemy: Enemy) => void): void;
}

export class SpatialEnemyQuery implements EnemyQuery {
  constructor(private readonly grid: SpatialGrid<Enemy>) {}

  forNearby(x: number, y: number, radius: number, visit: (enemy: Enemy) => void): void {
    this.grid.forNearby(x, y, radius, visit);
  }
}
