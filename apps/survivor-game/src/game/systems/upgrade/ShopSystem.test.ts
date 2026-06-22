import { describe, expect, it } from 'vitest';
import { WeaponEvolutionId, WeaponType, type UpgradeOption } from '../../types';
import { createPlayer } from '../player/Player';
import { createWeapon } from '../weapon/Weapon';
import { ShopSystem } from './ShopSystem';

describe('ShopSystem', () => {
  it('allows multiple purchases from one opened shop', () => {
    const player = createPlayer();
    player.hp = 50;
    player.shards = 10;

    const shop = new ShopSystem();
    shop.options = [
      createHealOption('小型治疗', 3),
      createHealOption('大型治疗', 4),
    ];
    shop.selectedIndex = 0;

    const first = shop.buySelected(player);
    expect(first?.title).toBe('小型治疗');
    expect(shop.options[0].purchased).toBe(true);
    expect(shop.selectedIndex).toBe(1);
    expect(player.shards).toBe(7);

    const second = shop.buySelected(player);
    expect(second?.title).toBe('大型治疗');
    expect(shop.options[1].purchased).toBe(true);
    expect(player.shards).toBe(3);
  });

  it('selects the next affordable unpurchased option after buying', () => {
    const player = createPlayer();
    player.shards = 7;

    const shop = new ShopSystem();
    shop.options = [
      createHealOption('便宜治疗', 3),
      createHealOption('昂贵治疗', 20),
      createHealOption('可买治疗', 4),
    ];

    shop.buySelected(player);

    expect(shop.selectedIndex).toBe(2);
    expect(player.shards).toBe(4);
  });

  it('resolves same-tier weapon evolution alternatives after buying one branch', () => {
    const player = createPlayer();
    const weapon = createWeapon(WeaponType.FIRE_WAND);
    weapon.level = 4;
    player.weapons.push(weapon);
    player.shards = 10;

    const shop = new ShopSystem();
    shop.options = [
      createEvolutionOption('余烬火池', WeaponEvolutionId.FIRE_POOL, 3),
      createEvolutionOption('双焰爆燃', WeaponEvolutionId.FIRE_BURST, 3),
      createHealOption('治疗', 3),
    ];

    shop.buySelected(player);

    expect(weapon.evolutions[4]).toBe(WeaponEvolutionId.FIRE_POOL);
    expect(shop.options[0].purchased).toBe(true);
    expect(shop.options[1].purchased).toBe(true);
    expect(shop.selectedIndex).toBe(2);
  });
});

function createHealOption(title: string, cost: number): UpgradeOption {
  return {
    title,
    description: '恢复生命',
    icon: '+',
    type: 'heal',
    rarity: 'common',
    cost,
    isMaxed: false,
  };
}

function createEvolutionOption(title: string, evolutionId: WeaponEvolutionId, cost: number): UpgradeOption {
  return {
    title,
    description: '武器进化',
    icon: '*',
    type: 'weapon_evolution',
    weaponType: WeaponType.FIRE_WAND,
    evolutionId,
    rarity: 'rare',
    cost,
    isMaxed: false,
  };
}
