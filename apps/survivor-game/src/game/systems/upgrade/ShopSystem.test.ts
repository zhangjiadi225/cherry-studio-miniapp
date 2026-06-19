import { describe, expect, it } from 'vitest';
import type { UpgradeOption } from '../../types';
import { createPlayer } from '../player/Player';
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
