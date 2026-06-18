import { describe, expect, it } from 'vitest';
import { WeaponType, type Weapon } from '../../types';
import { createWeapon, upgradeWeapon } from './Weapon';

function weaponAtLevel(type: WeaponType, level: number): Weapon {
  const weapon = createWeapon(type);
  while (weapon.level < level) upgradeWeapon(weapon);
  return weapon;
}

function projectedOutput(type: WeaponType, level: number): number {
  const weapon = weaponAtLevel(type, level);
  const effectiveCount = type === WeaponType.WHIP ? weapon.level : weapon.count;
  const usesPersistentUptime = type === WeaponType.BIBLE || type === WeaponType.HOLY_WATER;
  const uptime = usesPersistentUptime
    ? Math.min(1, weapon.duration / weapon.cooldown)
    : 1;

  return (weapon.damage * effectiveCount * uptime) / weapon.cooldown;
}

describe('weapon output model', () => {
  it('keeps late lightning from dominating every other damage choice', () => {
    expect(projectedOutput(WeaponType.LIGHTNING, 8)).toBeLessThan(450);
  });

  it('keeps level 8 bible above the decorative damage band', () => {
    expect(projectedOutput(WeaponType.BIBLE, 8)).toBeGreaterThan(70);
  });

  it('lets weapons keep scaling after the old level cap band', () => {
    const weapon = weaponAtLevel(WeaponType.MAGIC_WAND, 12);

    expect(weapon.level).toBe(12);
    expect(upgradeWeapon(weapon)).toBe(true);
    expect(weapon.level).toBe(13);
  });
});
