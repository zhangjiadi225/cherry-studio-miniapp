import { describe, expect, it } from 'vitest';
import { XP_BASE, XP_GROWTH } from '../../constants';
import { PassiveType } from '../../types';
import { addXP, applyPassive, collectShards, createPlayer, damagePlayer, hasPassive, removePassive } from './Player';

describe('addXP', () => {
  it('levels up at the current threshold and carries remaining XP', () => {
    const player = createPlayer();

    expect(addXP(player, XP_BASE - 1)).toBe(false);
    expect(player.level).toBe(1);
    expect(player.xp).toBe(XP_BASE - 1);

    expect(addXP(player, 2)).toBe(true);
    expect(player.level).toBe(2);
    expect(player.xp).toBe(1);
    expect(player.xpToNext).toBe(Math.floor(XP_BASE * Math.pow(XP_GROWTH, 1)));
  });
});

describe('collectShards', () => {
  it('uses one pickup resource for both shop balance and level progress', () => {
    const player = createPlayer();

    expect(collectShards(player, XP_BASE)).toBe(true);
    expect(player.shards).toBe(XP_BASE);
    expect(player.level).toBe(2);
  });
});

describe('damagePlayer', () => {
  it('applies armor reduction and starts invulnerability', () => {
    const player = createPlayer();
    player.armor = 3;

    expect(damagePlayer(player, 10)).toBe(7);
    expect(player.hp).toBe(93);
    expect(player.invTime).toBe(player.invDuration);
  });

  it('does not apply damage while invulnerable', () => {
    const player = createPlayer();
    player.invTime = 0.5;

    expect(damagePlayer(player, 10)).toBe(0);
    expect(player.hp).toBe(player.maxHp);
  });

  it('always deals at least one damage after armor', () => {
    const player = createPlayer();
    player.armor = 100;

    expect(damagePlayer(player, 10)).toBe(1);
    expect(player.hp).toBe(player.maxHp - 1);
  });
});

describe('revive passive', () => {
  it('is removed when consumed so it only protects one death', () => {
    const player = createPlayer();

    expect(applyPassive(player, PassiveType.REVIVE, 20)).toBe(true);
    expect(hasPassive(player, PassiveType.REVIVE)).toBe(true);
    expect(removePassive(player, PassiveType.REVIVE)?.purchaseValue).toBe(20);
    expect(hasPassive(player, PassiveType.REVIVE)).toBe(false);
    expect(removePassive(player, PassiveType.REVIVE)).toBeUndefined();
  });
});
