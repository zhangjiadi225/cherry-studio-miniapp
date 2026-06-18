import type { MapObstacle } from '../types';
import { BLOOD_POOL_SLOW } from '../constants';

/** 圆形与 AABB 矩形碰撞检测 */
export function circleRectOverlap(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const halfW = rw / 2;
  const halfH = rh / 2;
  const nearestX = Math.max(rx - halfW, Math.min(cx, rx + halfW));
  const nearestY = Math.max(ry - halfH, Math.min(cy, ry + halfH));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < cr * cr;
}

/** 从圆形与 AABB 碰撞中推出圆形（返回推出向量） */
export function pushCircleFromRect(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): { x: number; y: number } | null {
  const halfW = rw / 2;
  const halfH = rh / 2;
  const nearestX = Math.max(rx - halfW, Math.min(cx, rx + halfW));
  const nearestY = Math.max(ry - halfH, Math.min(cy, ry + halfH));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= cr * cr) return null;
  // 圆心在矩形内部：沿最小穿透轴推出
  if (distSq === 0) {
    const distLeft   = cx - (rx - halfW);
    const distRight  = (rx + halfW) - cx;
    const distTop    = cy - (ry - halfH);
    const distBottom = (ry + halfH) - cy;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft)   return { x: -(cr + distLeft),   y: 0 };
    if (minDist === distRight)  return { x: cr + distRight,     y: 0 };
    if (minDist === distTop)    return { x: 0, y: -(cr + distTop) };
    return { x: 0, y: cr + distBottom };
  }
  const distVal = Math.sqrt(distSq);
  const overlap = cr - distVal;
  return { x: (dx / distVal) * overlap, y: (dy / distVal) * overlap };
}

/** 获取圆形覆盖的血池减速倍率（若在多个血池中取最慢的） */
export function getBloodPoolSlowFactor(
  obstacles: MapObstacle[],
  cx: number, cy: number, cr: number
): number {
  let slowest = 1;
  for (const obs of obstacles) {
    if (obs.type !== 'blood_pool') continue;
    const dx = cx - obs.x;
    const dy = cy - obs.y;
    if (dx * dx + dy * dy < (cr + obs.radius) * (cr + obs.radius)) {
      if (BLOOD_POOL_SLOW < slowest) slowest = BLOOD_POOL_SLOW;
    }
  }
  return slowest;
}
