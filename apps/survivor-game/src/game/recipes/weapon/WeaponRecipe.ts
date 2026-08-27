export type JsonPrimitiveV1 = string | number | boolean | null;

export type JsonValueV1 =
  | JsonPrimitiveV1
  | readonly JsonValueV1[]
  | { readonly [key: string]: JsonValueV1 };

export type PrimitiveParamsV1 = Readonly<Record<string, JsonValueV1>>;

export interface PrimitiveRefV1 {
  readonly primitiveId: string;
  readonly params: PrimitiveParamsV1;
}

export interface ProjectileVisualRecipeV1 {
  readonly body: PrimitiveRefV1;
  readonly palette: {
    readonly primary: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
  readonly scale: number;
  readonly opacity: number;
  readonly glow?: {
    readonly color: string;
    readonly radiusScale: number;
    readonly intensity: number;
  };
  readonly layers: readonly PrimitiveRefV1[];
  readonly trail?: PrimitiveRefV1;
  readonly particles?: PrimitiveRefV1;
}

export interface ProjectileWeaponRecipeV1 {
  readonly recipeVersion: 1;
  readonly delivery: 'projectile';
  readonly trigger: PrimitiveRefV1;
  readonly targeting: PrimitiveRefV1;
  readonly emission: {
    readonly emitterId: 'builtin.emitter.projectile';
    readonly origin: PrimitiveRefV1;
    readonly count: number;
    readonly burstCount: number;
    readonly burstInterval: number;
    readonly pattern: PrimitiveRefV1;
  };
  readonly projectile: {
    readonly damage: number;
    readonly radius: number;
    readonly speed: number;
    readonly lifetime: number;
    readonly pierce: number;
    readonly knockback: number;
    readonly motion: PrimitiveRefV1;
    readonly collision: PrimitiveRefV1;
    readonly hitEffects: readonly PrimitiveRefV1[];
    readonly lifecycle: readonly PrimitiveRefV1[];
    readonly visual: ProjectileVisualRecipeV1;
  };
  readonly modifierPolicy: {
    readonly allowedIds: readonly string[];
    readonly deniedIds: readonly string[];
  };
}

export type WeaponRecipeNumericStat =
  | 'damage'
  | 'cooldown'
  | 'speed'
  | 'radius'
  | 'count'
  | 'pierce'
  | 'lifetime'
  | 'knockback';

/**
 * 迁移期仅供内置内容使用的封闭计划调整，不属于 ContentPack 协议。
 * AI 内容只能使用公开的 progression 与 Modifier 引用。
 */
export type TrustedWeaponPlanAdjustment =
  | {
      readonly operation: 'add';
      readonly stat: WeaponRecipeNumericStat;
      readonly value: number;
    }
  | {
      readonly operation: 'multiply';
      readonly stat: WeaponRecipeNumericStat;
      readonly value: number;
    };

function deepFreezeRecipeValue(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreezeRecipeValue(child);
  Object.freeze(value);
}

export function freezeProjectileWeaponRecipe<T extends ProjectileWeaponRecipeV1>(recipe: T): T {
  deepFreezeRecipeValue(recipe);
  return recipe;
}
