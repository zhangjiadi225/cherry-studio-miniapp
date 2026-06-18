import { DamageNumber } from '../types';
import { pools } from '../utils/PoolManager';

export function createDamageNumber(
  x: number, y: number,
  value: number,
  color: string = '#ffffff',
  size: number = 16
): DamageNumber {
  const d = pools.damageNumbers.acquire();
  d.x = x + (Math.random() - 0.5) * 20;
  d.y = y - 10;
  d.value = value;
  d.life = 0.8;
  d.maxLife = 0.8;
  d.vy = -80;
  d.color = color;
  d.size = size;
  return d;
}

export function updateDamageNumber(d: DamageNumber, dt: number): boolean {
  d.y += d.vy * dt;
  d.vy *= 0.95;
  d.life -= dt;
  return d.life > 0;
}
