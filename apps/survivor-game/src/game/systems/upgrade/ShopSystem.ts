import type { MetaState } from '../meta/MetaProgression';
import {
  areModifierCardsUnlocked,
  canPaidReroll,
  getMetaRerollCost,
  getMetaShopOptionCount,
  getUnlockedModifierTypes,
} from '../meta/MetaProgression';
import type { Player, SellableCard, UpgradeOption } from '../../types';
import { WEAPON_EVOLUTION_DATA } from '../../data/weaponEvolutions';
import { applyUpgrade, generateUpgradeOptions, getSellableCards, sellOwnedCard } from '../weapon/Upgrade';
import { getShopLayout } from './ShopLayout';

export type ShopClickAction =
  | { type: 'buy' }
  | { type: 'reroll' }
  | { type: 'continue' }
  | { type: 'sell'; cardId: string };

export class ShopSystem {
  options: UpgradeOption[] = [];
  selectedIndex = 0;
  private freeRerollAvailable = true;
  private paidRerollsThisRound = 0;

  reset() {
    this.options = [];
    this.selectedIndex = 0;
    this.freeRerollAvailable = true;
    this.paidRerollsThisRound = 0;
  }

  open(player: Player, meta: MetaState) {
    this.options = this.generateOptions(player, meta);
    this.selectedIndex = 0;
    this.freeRerollAvailable = true;
    this.paidRerollsThisRound = 0;
  }

  selectPrevious() {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
  }

  selectNext() {
    this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
  }

  buySelected(player: Player): UpgradeOption | undefined {
    if (this.selectedIndex >= this.options.length) return undefined;
    const option = this.options[this.selectedIndex];
    if (option.purchased || player.shards < option.cost) return undefined;

    if (!applyUpgrade(player, option)) return undefined;
    player.shards -= option.cost;
    option.purchased = true;
    this.markResolvedEvolutionAlternatives(option);

    const nextAffordable = this.options.findIndex((o) => !o.purchased && player.shards >= o.cost);
    const nextAvailable = nextAffordable >= 0
      ? nextAffordable
      : this.options.findIndex((o) => !o.purchased);
    if (nextAvailable >= 0) this.selectedIndex = nextAvailable;
    return option;
  }

  reroll(player: Player, meta: MetaState): boolean {
    if (this.freeRerollAvailable) {
      this.freeRerollAvailable = false;
    } else {
      if (!canPaidReroll(meta)) return false;
      const cost = this.getRerollCost(meta);
      if (player.shards < cost) return false;
      player.shards -= cost;
      this.paidRerollsThisRound++;
    }

    this.options = this.generateOptions(player, meta);
    this.selectedIndex = 0;
    return true;
  }

  handleClick(x: number, y: number, w: number, h: number, player: Player): ShopClickAction | undefined {
    if (this.options.length === 0) return undefined;

    const sellableCards = this.getSellableCards(player);
    const layout = getShopLayout(w, h, this.options.length, sellableCards.length);
    for (const card of layout.cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.selectedIndex = card.index;
        return { type: 'buy' };
      }
    }

    for (const card of layout.sellCards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        const sellable = sellableCards[card.index];
        if (!sellable) return undefined;
        return { type: 'sell', cardId: sellable.id };
      }
    }

    const reroll = layout.rerollButton;
    const cont = layout.continueButton;
    if (x >= reroll.x && x <= reroll.x + reroll.w && y >= reroll.y && y <= reroll.y + reroll.h) return { type: 'reroll' };
    if (x >= cont.x && x <= cont.x + cont.w && y >= cont.y && y <= cont.y + cont.h) return { type: 'continue' };
    return undefined;
  }

  getSellableCards(player: Player): SellableCard[] {
    return getSellableCards(player);
  }

  sellCard(player: Player, cardId: string): SellableCard | undefined {
    return sellOwnedCard(player, cardId);
  }

  canFreeReroll() {
    return this.freeRerollAvailable;
  }

  canPaidReroll(meta: MetaState) {
    return canPaidReroll(meta);
  }

  getRerollCost(meta: MetaState) {
    return getMetaRerollCost(meta, this.paidRerollsThisRound);
  }

  private generateOptions(player: Player, meta: MetaState) {
    const unlockedModifiers = getUnlockedModifierTypes(meta);
    return generateUpgradeOptions(
      player,
      getMetaShopOptionCount(meta, player.level),
      areModifierCardsUnlocked(meta),
      unlockedModifiers
    );
  }

  private markResolvedEvolutionAlternatives(option: UpgradeOption) {
    if (option.type !== 'weapon_evolution' || !option.weaponType || !option.evolutionId) return;
    const selected = WEAPON_EVOLUTION_DATA[option.evolutionId];
    if (!selected) return;

    for (const other of this.options) {
      if (other.type !== 'weapon_evolution' || !other.evolutionId) continue;
      const data = WEAPON_EVOLUTION_DATA[other.evolutionId];
      if (other.weaponType === option.weaponType && data.tier === selected.tier) {
        other.purchased = true;
      }
    }
  }
}
