import { Player, Weapon, PassiveType, PassiveUpgrade } from '../../types';
import {
  PASSIVE_DATA,
  PLAYER_RADIUS, PLAYER_BASE_HP, PLAYER_BASE_SPEED, PLAYER_BASE_PICKUP_RANGE,
  PLAYER_INV_DURATION, PLAYER_REGEN_INTERVAL, PLAYER_ANIM_SPEED,
  XP_BASE, XP_GROWTH, ARENA_HALF,
} from '../../constants';
import type { MapSystem } from '../map/MapSystem';

export function createPlayer(skinId: string = 'wanderer'): Player {
  return {
    x: 0,
    y: 0,
    radius: PLAYER_RADIUS,
    hp: PLAYER_BASE_HP,
    maxHp: PLAYER_BASE_HP,
    speed: PLAYER_BASE_SPEED,
    baseSpeed: PLAYER_BASE_SPEED,
    invTime: 0,
    invDuration: PLAYER_INV_DURATION,
    level: 1,
    xp: 0,
    xpToNext: XP_BASE,
    pickupRange: PLAYER_BASE_PICKUP_RANGE,
    basePickupRange: PLAYER_BASE_PICKUP_RANGE,
    might: 1,
    area: 1,
    cooldownReduction: 0,
    armor: 0,
    regen: 0,
    regenTimer: 0,
    luck: 1,
    curse: 1,
    shards: 0,
    skinId,
    weapons: [],
    passives: [],
    animTimer: 0,
    facingLeft: false,
  };
}

export function updatePlayer(p: Player, dx: number, dy: number, dt: number, mapSystem?: MapSystem) {
  p.x += dx * p.speed * dt;
  p.y += dy * p.speed * dt;
  if (dx !== 0) p.facingLeft = dx < 0;

  if (mapSystem) {
    const push = mapSystem.handleCircleCollision(p.x, p.y, p.radius);
    p.x += push.x;
    p.y += push.y;
  }

  p.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, p.x));
  p.y = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, p.y));

  if (p.invTime > 0) p.invTime -= dt;

  if (p.regen > 0) {
    p.regenTimer += dt;
    if (p.regenTimer >= PLAYER_REGEN_INTERVAL) {
      p.regenTimer -= PLAYER_REGEN_INTERVAL;
      p.hp = Math.min(p.maxHp, p.hp + p.regen);
    }
  }

  if (dx !== 0 || dy !== 0) {
    p.animTimer += dt * PLAYER_ANIM_SPEED;
  }
}

export function damagePlayer(p: Player, damage: number): number {
  if (p.invTime > 0) return 0;
  const actualDamage = Math.max(1, damage - p.armor);
  p.hp -= actualDamage;
  p.invTime = p.invDuration;
  return actualDamage;
}

export function addXP(p: Player, amount: number): boolean {
  p.xp += amount;
  if (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = Math.floor(XP_BASE * Math.pow(XP_GROWTH, p.level - 1));
    return true;
  }
  return false;
}

export function collectShards(p: Player, amount: number): boolean {
  p.shards += amount;
  return addXP(p, amount);
}

export function applyPassive(p: Player, type: PassiveType, purchaseValue = 0): boolean {
  const maxLevel = PASSIVE_DATA[type].maxLevel;
  const existing = p.passives.find(pa => pa.type === type);
  if (existing) {
    if (existing.level >= maxLevel) return false;
    existing.level++;
    existing.purchaseValue = (existing.purchaseValue ?? 0) + purchaseValue;
  } else {
    p.passives.push({ type, level: 1, purchaseValue });
  }
  recalcStats(p);
  return true;
}

export function removePassive(p: Player, type: PassiveType): PassiveUpgrade | undefined {
  const idx = p.passives.findIndex(pa => pa.type === type);
  if (idx < 0) return undefined;
  const [removed] = p.passives.splice(idx, 1);
  recalcStats(p);
  return removed;
}

export function recalcStats(p: Player) {
  p.might = 1;
  p.area = 1;
  p.cooldownReduction = 0;
  p.armor = 0;
  p.regen = 0;
  p.luck = 1;
  p.curse = 1;
  let speedMult = 1;
  let hpBonus = 0;
  let pickupMult = 1;

  for (const pa of p.passives) {
    const perLevel = PASSIVE_DATA[pa.type].perLevel;
    p.might += (perLevel.might ?? 0) * pa.level;
    speedMult += (perLevel.speed ?? 0) * pa.level;
    hpBonus += (perLevel.maxHp ?? 0) * pa.level;
    p.armor += (perLevel.armor ?? 0) * pa.level;
    p.cooldownReduction += (perLevel.cooldown ?? 0) * pa.level;
    p.area += (perLevel.area ?? 0) * pa.level;
    pickupMult += (perLevel.pickup ?? 0) * pa.level;
    p.regen += (perLevel.regen ?? 0) * pa.level;
    p.luck += (perLevel.luck ?? 0) * pa.level;
    p.curse += (perLevel.curse ?? 0) * pa.level;
  }

  p.speed = p.baseSpeed * speedMult;
  p.pickupRange = p.basePickupRange * pickupMult;
  p.maxHp = PLAYER_BASE_HP + hpBonus;
  p.hp = Math.min(p.hp, p.maxHp);
}

export function hasPassive(p: Player, type: PassiveType): boolean {
  return p.passives.some(pa => pa.type === type);
}

export function getPassiveLevel(p: Player, type: PassiveType): number {
  return p.passives.find(pa => pa.type === type)?.level ?? 0;
}
