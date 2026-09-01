import { PassiveType } from '../types';

export const PASSIVE_DATA: Record<PassiveType, {
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  perLevel: Record<string, number>;
}> = {
  [PassiveType.MIGHT]: {
    name: '力量',
    icon: '💪',
    desc: '伤害 +10%',
    maxLevel: 5,
    perLevel: { might: 0.1 },
  },
  [PassiveType.SPEED]: {
    name: '速度',
    icon: '👟',
    desc: '移动速度 +10%',
    maxLevel: 5,
    perLevel: { speed: 0.1 },
  },
  [PassiveType.MAX_HP]: {
    name: '生命上限',
    icon: '❤️',
    desc: '最大生命 +20',
    maxLevel: 5,
    perLevel: { maxHp: 20 },
  },
  [PassiveType.ARMOR]: {
    name: '护甲',
    icon: '🛡️',
    desc: '减伤 +1',
    maxLevel: 5,
    perLevel: { armor: 1 },
  },
  [PassiveType.COOLDOWN]: {
    name: '冷却缩减',
    icon: '⏱️',
    desc: '冷却时间 -5%',
    maxLevel: 5,
    perLevel: { cooldown: 0.05 },
  },
  [PassiveType.AREA]: {
    name: '攻击范围',
    icon: '🔄',
    desc: '攻击范围 +10%',
    maxLevel: 5,
    perLevel: { area: 0.1 },
  },
  [PassiveType.PICKUP_RANGE]: {
    name: '拾取范围',
    icon: '🧲',
    desc: '拾取范围 +20%',
    maxLevel: 5,
    perLevel: { pickup: 0.2 },
  },
  [PassiveType.REGEN]: {
    name: '恢复',
    icon: '💚',
    desc: '每秒恢复 +0.5 HP',
    maxLevel: 5,
    perLevel: { regen: 0.5 },
  },
  [PassiveType.LUCK]: {
    name: '幸运',
    icon: '🍀',
    desc: '提高补给牌出现率',
    maxLevel: 5,
    perLevel: { luck: 0.1 },
  },
  [PassiveType.MAGNET]: {
    name: '磁铁',
    icon: '🧲',
    desc: '魂晶自动吸取',
    maxLevel: 1,
    perLevel: { magnet: 1 },
  },
  [PassiveType.CURSE]: {
    name: '诅咒',
    icon: '💀',
    desc: '敌人更强但魂晶更多',
    maxLevel: 5,
    perLevel: { curse: 0.1 },
  },
  [PassiveType.REVIVE]: {
    name: '复活',
    icon: '👼',
    desc: '死亡后复活一次',
    maxLevel: 1,
    perLevel: { revive: 1 },
  },
};
