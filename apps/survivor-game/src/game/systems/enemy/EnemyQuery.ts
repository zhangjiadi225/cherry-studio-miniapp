import type { Enemy } from '../../types';
import type { SpatialGrid } from '../../utils/SpatialGrid';

export interface EnemyQuery {
  forNearby(x: number, y: number, radius: number, visit: (enemy: Enemy) => void): void;
  forNearbyUntil?(
    x: number,
    y: number,
    radius: number,
    visit: (enemy: Enemy) => boolean
  ): boolean;
  forSweptCircle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    radius: number,
    visit: (enemy: Enemy, hitFraction: number) => void
  ): void;
}

export class SpatialEnemyQuery implements EnemyQuery {
  constructor(private readonly grid: SpatialGrid<Enemy>) {}

  forNearby(x: number, y: number, radius: number, visit: (enemy: Enemy) => void): void {
    this.grid.forNearby(x, y, radius, visit);
  }

  forNearbyUntil(
    x: number,
    y: number,
    radius: number,
    visit: (enemy: Enemy) => boolean
  ): boolean {
    return this.grid.forNearbyUntil(x, y, radius, visit);
  }

  forSweptCircle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    radius: number,
    visit: (enemy: Enemy, hitFraction: number) => void
  ): void {
    this.grid.forSweptCircle(startX, startY, endX, endY, radius, visit);
  }
}
