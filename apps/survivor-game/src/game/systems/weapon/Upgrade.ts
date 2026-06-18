import { Player, UpgradeOption, WeaponType, PassiveType, Weapon } from '../../types';
import { WEAPON_DATA, PASSIVE_DATA } from '../../constants';
import { createWeapon, upgradeWeapon } from './Weapon';
import { applyPassive, getPassiveLevel } from '../player/Player';
import { shuffleArray } from '../../utils/math';

export function generateUpgradeOptions(player: Player, count: number = 3): UpgradeOption[] {
  const allOptions: UpgradeOption[] = [];

  for (const w of player.weapons) {
    const data = WEAPON_DATA[w.type];
    if (w.level < data.maxLevel) {
      allOptions.push({
        title: `${data.name} Lv${w.level + 1}`,
        description: getWeaponUpgradeDesc(w),
        icon: data.icon,
        type: 'weapon',
        weaponType: w.type,
        isMaxed: false,
      });
    }
  }

  if (player.weapons.length < 6) {
    const ownedTypes = new Set(player.weapons.map(w => w.type));
    for (const [type, data] of Object.entries(WEAPON_DATA)) {
      if (!ownedTypes.has(type as WeaponType)) {
        allOptions.push({
          title: `${data.name} (新!)`,
          description: data.desc,
          icon: data.icon,
          type: 'weapon',
          weaponType: type as WeaponType,
          isMaxed: false,
        });
      }
    }
  }

  for (const [type, data] of Object.entries(PASSIVE_DATA)) {
    const currentLevel = getPassiveLevel(player, type as PassiveType);
    if (currentLevel < data.maxLevel) {
      allOptions.push({
        title: `${data.name} Lv${currentLevel + 1}`,
        description: data.desc,
        icon: data.icon,
        type: 'passive',
        passiveType: type as PassiveType,
        isMaxed: false,
      });
    }
  }

  shuffleArray(allOptions);

  const weaponUpgrades = allOptions.filter(o => o.type === 'weapon' && player.weapons.some(w => w.type === o.weaponType));
  const newWeapons = allOptions.filter(o => o.type === 'weapon' && !player.weapons.some(w => w.type === o.weaponType));
  const passives = allOptions.filter(o => o.type === 'passive');

  const result: UpgradeOption[] = [];

  if (weaponUpgrades.length > 0) result.push(weaponUpgrades.shift()!);
  if (weaponUpgrades.length > 0 && Math.random() < 0.5) result.push(weaponUpgrades.shift()!);
  if (newWeapons.length > 0 && player.weapons.length < 3) result.push(newWeapons.shift()!);

  const remaining = [...weaponUpgrades, ...newWeapons, ...passives];
  shuffleArray(remaining);
  while (result.length < count && remaining.length > 0) {
    result.push(remaining.shift()!);
  }

  if (result.length === 0) {
    result.push({
      title: '恢复生命',
      description: '恢复30%最大生命值',
      icon: '❤️‍🩹',
      type: 'heal' as any,
      isMaxed: true,
    });
  }

  return result.slice(0, count);
}

export function applyUpgrade(player: Player, option: UpgradeOption) {
  if (option.type === 'weapon' && option.weaponType) {
    const existing = player.weapons.find(w => w.type === option.weaponType);
    if (existing) {
      upgradeWeapon(existing);
    } else {
      player.weapons.push(createWeapon(option.weaponType));
    }
  } else if (option.type === 'passive' && option.passiveType) {
    applyPassive(player, option.passiveType);
  } else {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.3);
  }
}

function getWeaponUpgradeDesc(w: Weapon): string {
  const d = WEAPON_DATA[w.type];
  const p = d.perLevel;
  const parts: string[] = [];
  if (p.damage) parts.push(`伤害+${p.damage}`);
  if (p.count) parts.push(`数量+${p.count}`);
  if (p.area) parts.push(`范围+${Math.round(p.area * 100)}%`);
  if (p.pierce) parts.push(`穿透+${p.pierce}`);
  if (p.duration) parts.push(`持续+${p.duration}s`);
  if (p.speed) parts.push(`速度+${p.speed}`);
  if (p.cooldown && p.cooldown < 0) parts.push(`冷却${p.cooldown}s`);
  if (p.growthLabel) parts.push(p.growthLabel);
  return parts.join(' ');
}
