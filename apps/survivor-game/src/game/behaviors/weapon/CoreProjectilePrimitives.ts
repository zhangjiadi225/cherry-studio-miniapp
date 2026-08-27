import type { Enemy } from '../../types';
import type { EnginePlugin } from '../EngineRegistry';
import {
  WeaponPrimitiveParameterError,
  type CastOriginPrimitive,
  type CollisionBehaviorPrimitive,
  type EmissionPatternPrimitive,
  type HitEffectPrimitive,
  type PrimitiveParameterSchemaV1,
  type ProjectileMotionPrimitive,
  type ProjectileRenderPrimitive,
  type ResolvedCastOrigin,
  type ResolvedCollisionBehavior,
  type ResolvedEmissionPattern,
  type ResolvedHitEffect,
  type ResolvedProjectileMotion,
  type ResolvedProjectileRenderPrimitive,
  type ResolvedTargeting,
  type ResolvedWeaponTrigger,
  type TargetingPrimitive,
  type WeaponPrimitiveDescriptorV1,
  type WeaponPrimitiveKind,
  type WeaponTriggerPrimitive,
} from '../../recipes/weapon/WeaponRuntimePlan';
import type { PrimitiveParamsV1 } from '../../recipes/weapon/WeaponRecipe';

export const CoreWeaponPrimitiveId = {
  TRIGGER_COOLDOWN: 'builtin.trigger.cooldown',
  TARGET_NEAREST: 'builtin.target.nearest',
  ORIGIN_PLAYER: 'builtin.origin.player',
  ORIGIN_FOCUS_RELIC: 'builtin.origin.focus-relic',
  PATTERN_SINGLE: 'builtin.pattern.single',
  PATTERN_FAN: 'builtin.pattern.fan',
  MOTION_STRAIGHT: 'builtin.motion.straight',
  COLLISION_STANDARD: 'builtin.collision.standard',
  EFFECT_DAMAGE: 'builtin.effect.damage',
  EFFECT_KNOCKBACK: 'builtin.effect.knockback',
  RENDER_CIRCLE: 'builtin.render.circle',
} as const;

function freezeSchema(schema: PrimitiveParameterSchemaV1): PrimitiveParameterSchemaV1 {
  const numericBounds = Object.fromEntries(
    Object.entries(schema.numericBounds).map(([key, bounds]) => [key, Object.freeze({ ...bounds })])
  );
  const enumValues = Object.fromEntries(
    Object.entries(schema.enumValues).map(([key, values]) => [key, Object.freeze([...values])])
  );
  return Object.freeze({
    ...schema,
    allowedKeys: Object.freeze([...schema.allowedKeys]),
    requiredKeys: Object.freeze([...schema.requiredKeys]),
    numericBounds: Object.freeze(numericBounds),
    enumValues: Object.freeze(enumValues),
    booleanKeys: Object.freeze([...schema.booleanKeys]),
  });
}

function descriptor(
  id: string,
  kind: WeaponPrimitiveKind,
  name: string,
  description: string,
  parameterSchema: PrimitiveParameterSchemaV1,
  budget: WeaponPrimitiveDescriptorV1['budget'],
  tags: readonly string[]
): WeaponPrimitiveDescriptorV1 {
  return Object.freeze({
    id,
    version: '1.0.0',
    kind,
    name,
    description,
    parameterSchema: freezeSchema(parameterSchema),
    compatibility: Object.freeze({
      requires: Object.freeze([]),
      conflictsWith: Object.freeze([]),
      tags: Object.freeze([...tags]),
    }),
    budget: Object.freeze({
      ...budget,
      variableCosts: Object.freeze([...budget.variableCosts]),
    }),
  });
}

function schema(
  schemaId: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = [],
  numericBounds: PrimitiveParameterSchemaV1['numericBounds'] = {},
  enumValues: PrimitiveParameterSchemaV1['enumValues'] = {},
  booleanKeys: readonly string[] = []
): PrimitiveParameterSchemaV1 {
  return {
    schemaId,
    allowedKeys,
    requiredKeys,
    numericBounds,
    enumValues,
    booleanKeys,
  };
}

function assertClosedParams(
  params: PrimitiveParamsV1,
  definition: PrimitiveParameterSchemaV1,
  path: string
): void {
  const allowed = new Set(definition.allowedKeys);
  for (const key of Object.keys(params)) {
    if (!allowed.has(key)) {
      throw new WeaponPrimitiveParameterError(
        'UNKNOWN_PRIMITIVE_PARAM',
        `${path}.${key}`,
        `unknown parameter "${key}"`
      );
    }
  }
  for (const key of definition.requiredKeys) {
    if (!(key in params)) {
      throw new WeaponPrimitiveParameterError(
        'MISSING_PRIMITIVE_PARAM',
        `${path}.${key}`,
        `missing required parameter "${key}"`
      );
    }
  }
}

function readNumber(
  params: PrimitiveParamsV1,
  key: string,
  path: string,
  min: number,
  max: number,
  fallback?: number
): number {
  const value = params[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM',
      `${path}.${key}`,
      `expected ${min}..${max}`
    );
  }
  return value;
}

function readBoolean(
  params: PrimitiveParamsV1,
  key: string,
  path: string,
  fallback: boolean
): boolean {
  const value = params[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM',
      `${path}.${key}`,
      'expected boolean'
    );
  }
  return value;
}

function readEnum<T extends string>(
  params: PrimitiveParamsV1,
  key: string,
  path: string,
  values: readonly T[],
  fallback: T
): T {
  const value = params[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM',
      `${path}.${key}`,
      `expected ${values.join('|')}`
    );
  }
  return value as T;
}

const cooldownSchema = schema(
  'builtin.schema.trigger.cooldown.v1',
  ['cooldown'],
  ['cooldown'],
  { cooldown: { min: 0.2, max: 60 } }
);

const nearestTargetSchema = schema(
  'builtin.schema.target.nearest.v1',
  ['range', 'fallback'],
  ['range'],
  { range: { min: 32, max: 2400 } },
  { fallback: ['forward', 'radial'] }
);

const playerOriginSchema = schema(
  'builtin.schema.origin.player.v1',
  ['xOffset', 'yOffset', 'spreadY'],
  [],
  {
    xOffset: { min: -6, max: 6 },
    yOffset: { min: -6, max: 6 },
    spreadY: { min: -4, max: 4 },
  }
);

const singlePatternSchema = schema('builtin.schema.pattern.single.v1', []);
const fanPatternSchema = schema(
  'builtin.schema.pattern.fan.v1',
  ['spreadRadians'],
  ['spreadRadians'],
  { spreadRadians: { min: 0, max: Math.PI * 2 } }
);
const straightMotionSchema = schema('builtin.schema.motion.straight.v1', []);
const standardCollisionSchema = schema(
  'builtin.schema.collision.standard.v1',
  ['stopOnMap'],
  [],
  {},
  {},
  ['stopOnMap']
);
const damageEffectSchema = schema(
  'builtin.schema.effect.damage.v1',
  ['damageScale'],
  [],
  { damageScale: { min: 0, max: 8 } }
);
const knockbackEffectSchema = schema(
  'builtin.schema.effect.knockback.v1',
  ['knockbackScale'],
  [],
  { knockbackScale: { min: 0, max: 8 } }
);
const circleRenderSchema = schema(
  'builtin.schema.render.circle.v1',
  ['colorSlot', 'radiusScale', 'opacityScale', 'velocityOffsetSeconds'],
  [],
  {
    radiusScale: { min: 0.1, max: 6 },
    opacityScale: { min: 0, max: 1 },
    velocityOffsetSeconds: { min: -0.2, max: 0.2 },
  },
  { colorSlot: ['primary', 'secondary', 'accent'] }
);

export const CORE_PROJECTILE_PRIMITIVE_PLUGIN: EnginePlugin = Object.freeze<EnginePlugin>({
  id: 'builtin.plugin.projectile-primitives',
  version: '1.0.0',
  register(api) {
    api.weaponTriggers.register(CoreWeaponPrimitiveId.TRIGGER_COOLDOWN, Object.freeze<WeaponTriggerPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.TRIGGER_COOLDOWN,
        'trigger',
        '冷却触发',
        '按确定性冷却间隔触发武器施放。',
        cooldownSchema,
        { category: 'constant', baseCost: 0.05, variableCosts: [] },
        ['projectile']
      ),
      compile(params, path) {
        assertClosedParams(params, cooldownSchema, path);
        return Object.freeze<ResolvedWeaponTrigger>({
          primitiveId: CoreWeaponPrimitiveId.TRIGGER_COOLDOWN,
          cooldown: readNumber(params, 'cooldown', path, 0.2, 60),
        });
      },
    }));

    api.targetingStrategies.register(CoreWeaponPrimitiveId.TARGET_NEAREST, Object.freeze<TargetingPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.TARGET_NEAREST,
        'targeting',
        '最近目标',
        '从空间查询结果中按距离稳定选择最近的存活敌人。',
        nearestTargetSchema,
        { category: 'area-query', baseCost: 1, variableCosts: ['range', 'count'] },
        ['projectile', 'enemy-query']
      ),
      compile(params, path) {
        assertClosedParams(params, nearestTargetSchema, path);
        const range = readNumber(params, 'range', path, 32, 2400);
        const fallback = readEnum(params, 'fallback', path, ['forward', 'radial'] as const, 'radial');
        const distances: number[] = [];
        return Object.freeze<ResolvedTargeting>({
          primitiveId: CoreWeaponPrimitiveId.TARGET_NEAREST,
          fallback,
          select(player, enemyQuery, count, output) {
            output.length = 0;
            distances.length = 0;
            const rangeSquared = range * range;
            enemyQuery.forNearby(player.x, player.y, range, (enemy: Enemy) => {
              if (enemy.hp <= 0) return;
              const dx = enemy.x - player.x;
              const dy = enemy.y - player.y;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared >= rangeSquared) return;

              let insertAt = distances.length;
              while (insertAt > 0 && distanceSquared < distances[insertAt - 1]) insertAt--;
              if (insertAt >= count) return;
              output.splice(insertAt, 0, enemy);
              distances.splice(insertAt, 0, distanceSquared);
              if (output.length > count) {
                output.length = count;
                distances.length = count;
              }
            });
            return output.length;
          },
        });
      },
    }));

    const registerOrigin = (id: string, focusRelic: boolean) => {
      api.castOrigins.register(id, Object.freeze<CastOriginPrimitive>({
        descriptor: descriptor(
          id,
          'cast-origin',
          focusRelic ? '法器施放点' : '玩家施放点',
          focusRelic
            ? '根据玩家朝向、半径与弹体索引计算角色侧方的法器施放点。'
            : '根据玩家半径与受限偏移计算施放点。',
          playerOriginSchema,
          { category: 'constant', baseCost: 0.05, variableCosts: [] },
          ['projectile']
        ),
        compile(params, path) {
          assertClosedParams(params, playerOriginSchema, path);
          const defaultXOffset = focusRelic ? 1.55 : 0;
          const defaultYOffset = focusRelic ? -0.58 : 0;
          const defaultSpreadY = focusRelic ? 0.22 : 0;
          const xOffset = readNumber(params, 'xOffset', path, -6, 6, defaultXOffset);
          const yOffset = readNumber(params, 'yOffset', path, -6, 6, defaultYOffset);
          const spreadY = readNumber(params, 'spreadY', path, -4, 4, defaultSpreadY);
          return Object.freeze<ResolvedCastOrigin>({
            primitiveId: id,
            resolve(player, index, total, output) {
              const facingSign = player.facingLeft ? 1 : -1;
              output.x = player.x + facingSign * player.radius * xOffset;
              output.y = player.y + player.radius * yOffset +
                (index - (total - 1) / 2) * player.radius * spreadY;
            },
          });
        },
      }));
    };
    registerOrigin(CoreWeaponPrimitiveId.ORIGIN_PLAYER, false);
    registerOrigin(CoreWeaponPrimitiveId.ORIGIN_FOCUS_RELIC, true);

    api.emissionPatterns.register(CoreWeaponPrimitiveId.PATTERN_SINGLE, Object.freeze<EmissionPatternPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.PATTERN_SINGLE,
        'emission-pattern',
        '单向阵型',
        '保持每个目标的基础瞄准角度。',
        singlePatternSchema,
        { category: 'per-projectile', baseCost: 0.05, variableCosts: [] },
        ['projectile']
      ),
      compile(params, path) {
        assertClosedParams(params, singlePatternSchema, path);
        return Object.freeze<ResolvedEmissionPattern>({
          primitiveId: CoreWeaponPrimitiveId.PATTERN_SINGLE,
          resolveAngle(baseAngle: number) {
            return baseAngle;
          },
        });
      },
    }));

    api.emissionPatterns.register(CoreWeaponPrimitiveId.PATTERN_FAN, Object.freeze<EmissionPatternPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.PATTERN_FAN,
        'emission-pattern',
        '扇形阵型',
        '在受限夹角内均匀分布弹体。',
        fanPatternSchema,
        { category: 'per-projectile', baseCost: 0.1, variableCosts: ['spreadRadians'] },
        ['projectile']
      ),
      compile(params, path) {
        assertClosedParams(params, fanPatternSchema, path);
        const spread = readNumber(params, 'spreadRadians', path, 0, Math.PI * 2);
        return Object.freeze<ResolvedEmissionPattern>({
          primitiveId: CoreWeaponPrimitiveId.PATTERN_FAN,
          resolveAngle(baseAngle, index, total) {
            if (total <= 1) return baseAngle;
            return baseAngle - spread / 2 + spread * (index / (total - 1));
          },
        });
      },
    }));

    api.projectileMotions.register(CoreWeaponPrimitiveId.MOTION_STRAIGHT, Object.freeze<ProjectileMotionPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.MOTION_STRAIGHT,
        'projectile-motion',
        '直线运动',
        '按已解析速度向量和 dt 更新弹体位置。',
        straightMotionSchema,
        { category: 'per-projectile', baseCost: 0.1, variableCosts: [] },
        ['projectile']
      ),
      compile(params, path) {
        assertClosedParams(params, straightMotionSchema, path);
        return Object.freeze<ResolvedProjectileMotion>({
          primitiveId: CoreWeaponPrimitiveId.MOTION_STRAIGHT,
          update(projectile, dt) {
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
          },
        });
      },
    }));

    api.collisionBehaviors.register(CoreWeaponPrimitiveId.COLLISION_STANDARD, Object.freeze<CollisionBehaviorPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.COLLISION_STANDARD,
        'collision',
        '标准圆形碰撞',
        '使用规则半径进行敌人碰撞，并可选择是否被地图阻挡。',
        standardCollisionSchema,
        { category: 'per-projectile', baseCost: 0.25, variableCosts: ['radius'] },
        ['projectile', 'circle']
      ),
      compile(params, path) {
        assertClosedParams(params, standardCollisionSchema, path);
        const stopOnMap = readBoolean(params, 'stopOnMap', path, true);
        return Object.freeze<ResolvedCollisionBehavior>({
          primitiveId: CoreWeaponPrimitiveId.COLLISION_STANDARD,
          stopOnMap,
          getLookupRadius(projectile) {
            return projectile.radius + 64;
          },
          overlaps(projectile, enemy) {
            const dx = projectile.x - enemy.x;
            const dy = projectile.y - enemy.y;
            const radius = projectile.radius + enemy.radius;
            return dx * dx + dy * dy <= radius * radius;
          },
        });
      },
    }));

    api.hitEffects.register(CoreWeaponPrimitiveId.EFFECT_DAMAGE, Object.freeze<HitEffectPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.EFFECT_DAMAGE,
        'hit-effect',
        '伤害',
        '通过战斗内核服务施加弹体伤害。',
        damageEffectSchema,
        { category: 'per-hit', baseCost: 0.2, variableCosts: ['damageScale'] },
        ['projectile', 'damage']
      ),
      compile(params, path) {
        assertClosedParams(params, damageEffectSchema, path);
        const scale = readNumber(params, 'damageScale', path, 0, 8, 1);
        return Object.freeze<ResolvedHitEffect>({
          primitiveId: CoreWeaponPrimitiveId.EFFECT_DAMAGE,
          apply(context) {
            context.dealDamage(scale);
          },
        });
      },
    }));

    api.hitEffects.register(CoreWeaponPrimitiveId.EFFECT_KNOCKBACK, Object.freeze<HitEffectPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.EFFECT_KNOCKBACK,
        'hit-effect',
        '击退',
        '沿弹体到目标方向施加受限击退。',
        knockbackEffectSchema,
        { category: 'per-hit', baseCost: 0.1, variableCosts: ['knockbackScale'] },
        ['projectile', 'control']
      ),
      compile(params, path) {
        assertClosedParams(params, knockbackEffectSchema, path);
        const scale = readNumber(params, 'knockbackScale', path, 0, 8, 1);
        return Object.freeze<ResolvedHitEffect>({
          primitiveId: CoreWeaponPrimitiveId.EFFECT_KNOCKBACK,
          apply(context) {
            context.applyKnockback(scale);
          },
        });
      },
    }));

    api.projectileRenderers.register(CoreWeaponPrimitiveId.RENDER_CIRCLE, Object.freeze<ProjectileRenderPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.RENDER_CIRCLE,
        'render',
        '圆形视觉层',
        '使用调色板颜色绘制可缩放、可偏移的圆形层。',
        circleRenderSchema,
        { category: 'per-projectile', baseCost: 0.1, variableCosts: ['radiusScale'] },
        ['projectile', 'shape']
      ),
      compile(params, path) {
        assertClosedParams(params, circleRenderSchema, path);
        const colorSlot = readEnum(
          params,
          'colorSlot',
          path,
          ['primary', 'secondary', 'accent'] as const,
          'primary'
        );
        const radiusScale = readNumber(params, 'radiusScale', path, 0.1, 6, 1);
        const opacityScale = readNumber(params, 'opacityScale', path, 0, 1, 1);
        const velocityOffsetSeconds = readNumber(
          params,
          'velocityOffsetSeconds',
          path,
          -0.2,
          0.2,
          0
        );
        return Object.freeze<ResolvedProjectileRenderPrimitive>({
          primitiveId: CoreWeaponPrimitiveId.RENDER_CIRCLE,
          draw(context) {
            const color = context.palette[colorSlot] ?? context.palette.primary;
            const x = context.projectile.x + context.projectile.vx * velocityOffsetSeconds;
            const y = context.projectile.y + context.projectile.vy * velocityOffsetSeconds;
            context.ctx.save();
            context.ctx.globalAlpha = context.lifeAlpha * context.recipeOpacity * opacityScale;
            context.ctx.fillStyle = color;
            context.ctx.beginPath();
            context.ctx.arc(
              x,
              y,
              context.projectile.radius * context.recipeScale * radiusScale,
              0,
              Math.PI * 2
            );
            context.ctx.fill();
            context.ctx.restore();
          },
        });
      },
    }));
  },
});
