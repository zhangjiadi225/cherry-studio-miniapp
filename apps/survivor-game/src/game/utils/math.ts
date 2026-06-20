import type { Vec2, MapZone } from '../types';
import { MAP_ZONE_SIZE } from '../constants';

/** 根据世界坐标判断当前区域 */
export function getZone(x: number, y: number): MapZone {
  const bx = Math.floor((x + MAP_ZONE_SIZE / 2) / MAP_ZONE_SIZE);
  const by = Math.floor((y + MAP_ZONE_SIZE / 2) / MAP_ZONE_SIZE);
  const px = ((bx % 2) + 2) % 2;
  const py = ((by % 2) + 2) % 2;

  if (px === 0 && py === 0) return 'storm';
  if (px === 1 && py === 0) return 'blood';
  if (px === 0 && py === 1) return 'bone';
  return 'shadow';
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}

export function randSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

export function circlesOverlap(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const rSum = r1 + r2;
  return dx * dx + dy * dy < rSum * rSum;
}

export function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** 基于坐标的确定性哈希（32位无符号），同一坐标永远返回同一值 */
export function hashXY(x: number, y: number): number {
  let h = ((x | 0) * 374761393 + (y | 0) * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * 原地压缩数组：删除所有满足条件的元素，O(n) 单遍扫描，无 splice 开销。
 * 返回删除数量。
 */
export function compactArray<T>(arr: T[], shouldRemove: (item: T) => boolean): number {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (!shouldRemove(arr[read])) {
      if (write !== read) arr[write] = arr[read];
      write++;
    }
  }
  const removed = arr.length - write;
  arr.length = write;
  return removed;
}
