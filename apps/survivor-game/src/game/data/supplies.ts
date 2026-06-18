import { SupplyType } from '../types';

export const SUPPLY_DATA: Record<SupplyType, {
  name: string;
  icon: string;
  desc: string;
  baseCost: number;
  levelCost: number;
}> = {
  [SupplyType.FIELD_RATION]: {
    name: '战地口粮',
    icon: '✚',
    desc: '立即恢复45%最大生命值',
    baseCost: 9,
    levelCost: 0.5,
  },
  [SupplyType.AEGIS_CHARM]: {
    name: '护身符',
    icon: '◇',
    desc: '获得3秒无敌时间',
    baseCost: 14,
    levelCost: 0.75,
  },
  [SupplyType.OVERCLOCK]: {
    name: '超载符文',
    icon: '✦',
    desc: '所有武器立刻准备下一次攻击',
    baseCost: 12,
    levelCost: 0.7,
  },
};

export function getSupplyCost(type: SupplyType, playerLevel: number): number {
  const data = SUPPLY_DATA[type];
  return data.baseCost + Math.floor(Math.max(1, playerLevel) * data.levelCost);
}
