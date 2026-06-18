import type { MetaState } from '../meta/MetaProgression';
import {
  areModifierCardsUnlocked,
  canPaidReroll,
  getMetaRerollCost,
  getMetaShopOptionCount,
} from '../meta/MetaProgression';
import type { Player, UpgradeOption } from '../../types';
import { applyUpgrade, generateUpgradeOptions } from '../weapon/Upgrade';

export type ShopClickAction = 'buy' | 'reroll' | 'continue';

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

    player.shards -= option.cost;
    applyUpgrade(player, option);
    option.purchased = true;

    const nextAvailable = this.options.findIndex((o) => !o.purchased);
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

  handleClick(x: number, y: number, w: number, h: number): ShopClickAction | undefined {
    if (this.options.length === 0) return undefined;

    const cardGap = 12;
    const cardW = Math.min(180, (w - 90) / this.options.length - cardGap);
    const cardH = 230;
    const totalW = this.options.length * (cardW + cardGap) - cardGap;
    const startX = (w - totalW) / 2;
    const cardY = h / 2 - cardH / 2 - 5;

    for (let i = 0; i < this.options.length; i++) {
      const cardX = startX + i * (cardW + cardGap);
      if (x >= cardX && x <= cardX + cardW && y >= cardY && y <= cardY + cardH) {
        this.selectedIndex = i;
        return 'buy';
      }
    }

    const btnY = h / 2 + 155;
    const btnW = 150;
    const btnH = 38;
    const rerollX = w / 2 - 165;
    const continueX = w / 2 + 15;
    if (x >= rerollX && x <= rerollX + btnW && y >= btnY && y <= btnY + btnH) return 'reroll';
    if (x >= continueX && x <= continueX + btnW && y >= btnY && y <= btnY + btnH) return 'continue';
    return undefined;
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
    return generateUpgradeOptions(
      player,
      getMetaShopOptionCount(meta, player.level),
      areModifierCardsUnlocked(meta)
    );
  }
}
