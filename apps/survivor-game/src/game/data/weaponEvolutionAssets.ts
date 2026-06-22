import { WeaponEvolutionId } from '../types';

export type WeaponEvolutionAssetShape =
  | 'length'
  | 'haste'
  | 'ring'
  | 'edge'
  | 'twin'
  | 'pierce'
  | 'volley'
  | 'focus'
  | 'orbit'
  | 'aura'
  | 'thorn'
  | 'ward'
  | 'pool'
  | 'burst'
  | 'storm'
  | 'brand'
  | 'tide'
  | 'basin'
  | 'deluge'
  | 'scour'
  | 'rod'
  | 'field'
  | 'tempest'
  | 'judgment'
  | 'breaker'
  | 'bulwark'
  | 'executioner'
  | 'guard'
  | 'fan'
  | 'array'
  | 'reach';

export interface WeaponEvolutionAssetSpec {
  id: WeaponEvolutionId;
  shape: WeaponEvolutionAssetShape;
  primary: string;
  secondary: string;
  glow: string;
  glyph: string;
}

function spec(
  id: WeaponEvolutionId,
  shape: WeaponEvolutionAssetShape,
  primary: string,
  secondary: string,
  glow: string,
  glyph: string
): WeaponEvolutionAssetSpec {
  return { id, shape, primary, secondary, glow, glyph };
}

export const WEAPON_EVOLUTION_ASSETS: Record<WeaponEvolutionId, WeaponEvolutionAssetSpec> = {
  [WeaponEvolutionId.WHIP_LONG]: spec(WeaponEvolutionId.WHIP_LONG, 'length', '#8df4ff', '#fff2a8', 'rgba(80,220,255,0.62)', '⌁'),
  [WeaponEvolutionId.WHIP_QUICK]: spec(WeaponEvolutionId.WHIP_QUICK, 'haste', '#a8f7ff', '#7aa6ff', 'rgba(120,190,255,0.6)', '≋'),
  [WeaponEvolutionId.WHIP_RING]: spec(WeaponEvolutionId.WHIP_RING, 'ring', '#90f0ff', '#ffe37a', 'rgba(120,230,255,0.66)', '◎'),
  [WeaponEvolutionId.WHIP_RAZOR]: spec(WeaponEvolutionId.WHIP_RAZOR, 'edge', '#ffffff', '#7ef0ff', 'rgba(190,250,255,0.72)', '◇'),
  [WeaponEvolutionId.MAGIC_TWIN]: spec(WeaponEvolutionId.MAGIC_TWIN, 'twin', '#9ee9ff', '#f3ddff', 'rgba(120,220,255,0.64)', '∴'),
  [WeaponEvolutionId.MAGIC_PIERCER]: spec(WeaponEvolutionId.MAGIC_PIERCER, 'pierce', '#b8f6ff', '#8bb6ff', 'rgba(130,225,255,0.62)', '⇢'),
  [WeaponEvolutionId.MAGIC_VOLLEY]: spec(WeaponEvolutionId.MAGIC_VOLLEY, 'volley', '#c7f4ff', '#ffdff8', 'rgba(150,230,255,0.7)', '✦'),
  [WeaponEvolutionId.MAGIC_FOCUS]: spec(WeaponEvolutionId.MAGIC_FOCUS, 'focus', '#ffffff', '#72dfff', 'rgba(120,240,255,0.72)', '◆'),
  [WeaponEvolutionId.BIBLE_TOME]: spec(WeaponEvolutionId.BIBLE_TOME, 'twin', '#fff2ac', '#c9984e', 'rgba(255,230,142,0.62)', '▤'),
  [WeaponEvolutionId.BIBLE_ORBIT]: spec(WeaponEvolutionId.BIBLE_ORBIT, 'orbit', '#fff5b8', '#8ee6ff', 'rgba(255,230,142,0.62)', '◌'),
  [WeaponEvolutionId.BIBLE_SANCTUARY]: spec(WeaponEvolutionId.BIBLE_SANCTUARY, 'ring', '#fff8ca', '#ffd166', 'rgba(255,230,142,0.75)', '◎'),
  [WeaponEvolutionId.BIBLE_REQUIEM]: spec(WeaponEvolutionId.BIBLE_REQUIEM, 'focus', '#fff4c2', '#d8a04c', 'rgba(255,218,120,0.68)', '✙'),
  [WeaponEvolutionId.GARLIC_MIASMA]: spec(WeaponEvolutionId.GARLIC_MIASMA, 'aura', '#d8f59a', '#7bbf5f', 'rgba(185,230,110,0.58)', '◉'),
  [WeaponEvolutionId.GARLIC_THORNS]: spec(WeaponEvolutionId.GARLIC_THORNS, 'thorn', '#eaff9e', '#8fdc72', 'rgba(200,245,120,0.62)', '⌁'),
  [WeaponEvolutionId.GARLIC_CENSER]: spec(WeaponEvolutionId.GARLIC_CENSER, 'aura', '#fff2a8', '#a5df83', 'rgba(230,240,120,0.66)', '✹'),
  [WeaponEvolutionId.GARLIC_WARD]: spec(WeaponEvolutionId.GARLIC_WARD, 'ward', '#ecffb4', '#8bd2ff', 'rgba(190,245,150,0.68)', '⊙'),
  [WeaponEvolutionId.FIRE_POOL]: spec(WeaponEvolutionId.FIRE_POOL, 'pool', '#ffb34f', '#ff5c26', 'rgba(255,110,36,0.68)', '◌'),
  [WeaponEvolutionId.FIRE_BURST]: spec(WeaponEvolutionId.FIRE_BURST, 'burst', '#ffd166', '#ff6b2a', 'rgba(255,110,36,0.78)', '✺'),
  [WeaponEvolutionId.FIRE_STORM]: spec(WeaponEvolutionId.FIRE_STORM, 'storm', '#ffd166', '#ff4e26', 'rgba(255,90,36,0.82)', '✹'),
  [WeaponEvolutionId.FIRE_BRAND]: spec(WeaponEvolutionId.FIRE_BRAND, 'brand', '#fff0a8', '#ff7438', 'rgba(255,130,52,0.72)', '✦'),
  [WeaponEvolutionId.HOLY_TIDE]: spec(WeaponEvolutionId.HOLY_TIDE, 'tide', '#b8f4ff', '#5ab8ff', 'rgba(112,226,255,0.62)', '∿'),
  [WeaponEvolutionId.HOLY_BASIN]: spec(WeaponEvolutionId.HOLY_BASIN, 'basin', '#d8fbff', '#7cd8ff', 'rgba(132,235,255,0.62)', '◌'),
  [WeaponEvolutionId.HOLY_DELUGE]: spec(WeaponEvolutionId.HOLY_DELUGE, 'deluge', '#e6fdff', '#6fb7ff', 'rgba(132,235,255,0.72)', '☔'),
  [WeaponEvolutionId.HOLY_SCOUR]: spec(WeaponEvolutionId.HOLY_SCOUR, 'scour', '#ffffff', '#9ee8ff', 'rgba(150,240,255,0.7)', '✙'),
  [WeaponEvolutionId.LIGHTNING_ROD]: spec(WeaponEvolutionId.LIGHTNING_ROD, 'rod', '#fff26a', '#81eaff', 'rgba(255,232,82,0.76)', 'ϟ'),
  [WeaponEvolutionId.LIGHTNING_FIELD]: spec(WeaponEvolutionId.LIGHTNING_FIELD, 'field', '#fff6a8', '#6fdcff', 'rgba(255,232,82,0.66)', '◉'),
  [WeaponEvolutionId.LIGHTNING_TEMPEST]: spec(WeaponEvolutionId.LIGHTNING_TEMPEST, 'tempest', '#fff574', '#66e3ff', 'rgba(255,232,82,0.82)', '✹'),
  [WeaponEvolutionId.LIGHTNING_JUDGMENT]: spec(WeaponEvolutionId.LIGHTNING_JUDGMENT, 'judgment', '#fffbc2', '#ffd166', 'rgba(255,232,82,0.78)', '♢'),
  [WeaponEvolutionId.AXE_BREAKER]: spec(WeaponEvolutionId.AXE_BREAKER, 'breaker', '#ffe0a8', '#9fd6ff', 'rgba(255,210,150,0.62)', '⌒'),
  [WeaponEvolutionId.AXE_BULWARK]: spec(WeaponEvolutionId.AXE_BULWARK, 'bulwark', '#d8ecff', '#a6b8ff', 'rgba(190,222,255,0.64)', '◜'),
  [WeaponEvolutionId.AXE_EXECUTIONER]: spec(WeaponEvolutionId.AXE_EXECUTIONER, 'executioner', '#ffffff', '#ffbd6b', 'rgba(255,210,150,0.72)', '◆'),
  [WeaponEvolutionId.AXE_GUARD]: spec(WeaponEvolutionId.AXE_GUARD, 'guard', '#d8ecff', '#ffd166', 'rgba(190,222,255,0.7)', '◡'),
  [WeaponEvolutionId.RUNE_PIERCER]: spec(WeaponEvolutionId.RUNE_PIERCER, 'pierce', '#a8fbff', '#5be7ff', 'rgba(118,244,255,0.66)', '╍'),
  [WeaponEvolutionId.RUNE_FAN]: spec(WeaponEvolutionId.RUNE_FAN, 'fan', '#b8fbff', '#7b91ff', 'rgba(118,244,255,0.7)', '⋔'),
  [WeaponEvolutionId.RUNE_FOCUS]: spec(WeaponEvolutionId.RUNE_FOCUS, 'focus', '#ffffff', '#67ecff', 'rgba(118,244,255,0.72)', '━'),
  [WeaponEvolutionId.RUNE_ARRAY]: spec(WeaponEvolutionId.RUNE_ARRAY, 'array', '#d8ffff', '#80b8ff', 'rgba(118,244,255,0.76)', '≡'),
  [WeaponEvolutionId.MOON_TWIN]: spec(WeaponEvolutionId.MOON_TWIN, 'twin', '#eadcff', '#b88cff', 'rgba(196,160,255,0.66)', '☽'),
  [WeaponEvolutionId.MOON_REACH]: spec(WeaponEvolutionId.MOON_REACH, 'reach', '#e5d8ff', '#96c0ff', 'rgba(196,160,255,0.62)', '◌'),
  [WeaponEvolutionId.MOON_RING]: spec(WeaponEvolutionId.MOON_RING, 'ring', '#f4eaff', '#c28cff', 'rgba(196,160,255,0.75)', '◎'),
  [WeaponEvolutionId.MOON_REND]: spec(WeaponEvolutionId.MOON_REND, 'edge', '#ffffff', '#bd9aff', 'rgba(196,160,255,0.74)', '☾'),
};

export function getWeaponEvolutionAsset(id: WeaponEvolutionId): WeaponEvolutionAssetSpec {
  return WEAPON_EVOLUTION_ASSETS[id];
}
