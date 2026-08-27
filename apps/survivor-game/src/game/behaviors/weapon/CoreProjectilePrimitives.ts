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
  TARGET_FACING: 'builtin.target.facing',
  ORIGIN_PLAYER: 'builtin.origin.player',
  ORIGIN_FOCUS_RELIC: 'builtin.origin.focus-relic',
  ORIGIN_TARGET_GROUND: 'builtin.origin.target-ground',
  PATTERN_SINGLE: 'builtin.pattern.single',
  PATTERN_FAN: 'builtin.pattern.fan',
  PATTERN_RING: 'builtin.pattern.ring',
  MOTION_STRAIGHT: 'builtin.motion.straight',
  MOTION_STATIONARY: 'builtin.motion.stationary',
  MOTION_ORBIT_PLAYER: 'builtin.motion.orbit-player',
  COLLISION_STANDARD: 'builtin.collision.standard',
  COLLISION_SEGMENT: 'builtin.collision.segment',
  COLLISION_SECTOR: 'builtin.collision.sector',
  EFFECT_DAMAGE: 'builtin.effect.damage',
  EFFECT_KNOCKBACK: 'builtin.effect.knockback',
  RENDER_CIRCLE: 'builtin.render.circle',
  RENDER_RING: 'builtin.render.ring',
  RENDER_BEAM: 'builtin.render.beam',
  RENDER_ARC: 'builtin.render.arc',
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
const facingTargetSchema = schema('builtin.schema.target.facing.v1', []);

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
const targetGroundOriginSchema = schema(
  'builtin.schema.origin.target-ground.v1',
  ['xOffset', 'yOffset', 'fallbackDistance'],
  [],
  {
    xOffset: { min: -128, max: 128 },
    yOffset: { min: -128, max: 128 },
    fallbackDistance: { min: 0, max: 800 },
  }
);

const singlePatternSchema = schema('builtin.schema.pattern.single.v1', []);
const fanPatternSchema = schema(
  'builtin.schema.pattern.fan.v1',
  ['spreadRadians'],
  ['spreadRadians'],
  { spreadRadians: { min: 0, max: Math.PI * 2 } }
);
const ringPatternSchema = schema(
  'builtin.schema.pattern.ring.v1',
  ['rotationOffset'],
  [],
  { rotationOffset: { min: -Math.PI * 2, max: Math.PI * 2 } }
);
const straightMotionSchema = schema('builtin.schema.motion.straight.v1', []);
const stationaryMotionSchema = schema('builtin.schema.motion.stationary.v1', []);
const orbitPlayerMotionSchema = schema(
  'builtin.schema.motion.orbit-player.v1',
  ['radius', 'angularSpeed', 'phaseOffset'],
  ['radius', 'angularSpeed'],
  {
    radius: { min: 16, max: 600 },
    angularSpeed: { min: -12, max: 12 },
    phaseOffset: { min: -Math.PI * 2, max: Math.PI * 2 },
  }
);
const standardCollisionSchema = schema(
  'builtin.schema.collision.standard.v1',
  ['stopOnMap'],
  [],
  {},
  {},
  ['stopOnMap']
);
const segmentCollisionSchema = schema(
  'builtin.schema.collision.segment.v1',
  ['length', 'widthScale'],
  ['length'],
  {
    length: { min: 16, max: 1200 },
    widthScale: { min: 0.25, max: 4 },
  }
);
const sectorCollisionSchema = schema(
  'builtin.schema.collision.sector.v1',
  ['reach', 'arcRadians'],
  ['reach', 'arcRadians'],
  {
    reach: { min: 16, max: 600 },
    arcRadians: { min: 0.05, max: Math.PI * 2 },
  }
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
const ringRenderSchema = schema(
  'builtin.schema.render.ring.v1',
  ['colorSlot', 'radiusScale', 'thicknessScale', 'opacityScale'],
  [],
  {
    radiusScale: { min: 0.1, max: 8 },
    thicknessScale: { min: 0.05, max: 2 },
    opacityScale: { min: 0, max: 1 },
  },
  { colorSlot: ['primary', 'secondary', 'accent'] }
);
const beamRenderSchema = schema(
  'builtin.schema.render.beam.v1',
  ['colorSlot', 'length', 'widthScale', 'opacityScale'],
  ['length'],
  {
    length: { min: 16, max: 1200 },
    widthScale: { min: 0.1, max: 8 },
    opacityScale: { min: 0, max: 1 },
  },
  { colorSlot: ['primary', 'secondary', 'accent'] }
);
const arcRenderSchema = schema(
  'builtin.schema.render.arc.v1',
  ['colorSlot', 'reach', 'arcRadians', 'widthScale', 'opacityScale'],
  ['reach', 'arcRadians'],
  {
    reach: { min: 16, max: 600 },
    arcRadians: { min: 0.05, max: Math.PI * 2 },
    widthScale: { min: 0.1, max: 8 },
    opacityScale: { min: 0, max: 1 },
  },
  { colorSlot: ['primary', 'secondary', 'accent'] }
);

function getProjectileDirection(
  projectile: { vx: number; vy: number; headingAngle?: number }
): { x: number; y: number; angle: number } {
  const length = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
  if (length <= 0.0001) {
    const angle = projectile.headingAngle ?? 0;
    return { x: Math.cos(angle), y: Math.sin(angle), angle };
  }
  return {
    x: projectile.vx / length,
    y: projectile.vy / length,
    angle: Math.atan2(projectile.vy, projectile.vx),
  };
}

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
          chargeDuration: 0,
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

    api.targetingStrategies.register(CoreWeaponPrimitiveId.TARGET_FACING, Object.freeze<TargetingPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.TARGET_FACING,
        'targeting',
        '角色朝向',
        '不查询敌人，始终沿角色当前朝向施放。',
        facingTargetSchema,
        { category: 'constant', baseCost: 0.02, variableCosts: [] },
        ['projectile', 'direction-only']
      ),
      compile(params, path) {
        assertClosedParams(params, facingTargetSchema, path);
        return Object.freeze<ResolvedTargeting>({
          primitiveId: CoreWeaponPrimitiveId.TARGET_FACING,
          fallback: 'forward',
          select(_player, _enemyQuery, _count, output) {
            output.length = 0;
            return 0;
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

    api.castOrigins.register(CoreWeaponPrimitiveId.ORIGIN_TARGET_GROUND, Object.freeze<CastOriginPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.ORIGIN_TARGET_GROUND,
        'cast-origin',
        '目标地面落点',
        '把弹体放置在目标位置；没有目标时放置在角色朝向或环射方向的受限距离处。',
        targetGroundOriginSchema,
        { category: 'constant', baseCost: 0.08, variableCosts: ['fallbackDistance'] },
        ['projectile', 'ground-placement']
      ),
      compile(params, path) {
        assertClosedParams(params, targetGroundOriginSchema, path);
        const xOffset = readNumber(params, 'xOffset', path, -128, 128, 0);
        const yOffset = readNumber(params, 'yOffset', path, -128, 128, 0);
        const fallbackDistance = readNumber(params, 'fallbackDistance', path, 0, 800, 180);
        return Object.freeze<ResolvedCastOrigin>({
          primitiveId: CoreWeaponPrimitiveId.ORIGIN_TARGET_GROUND,
          resolve(player, _index, _total, output, target, fallbackAngle = 0) {
            output.x = (target?.x ?? player.x + Math.cos(fallbackAngle) * fallbackDistance) + xOffset;
            output.y = (target?.y ?? player.y + Math.sin(fallbackAngle) * fallbackDistance) + yOffset;
          },
        });
      },
    }));

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

    api.emissionPatterns.register(CoreWeaponPrimitiveId.PATTERN_RING, Object.freeze<EmissionPatternPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.PATTERN_RING,
        'emission-pattern',
        '环形阵型',
        '围绕基础方向把弹体均匀分布到完整圆周。',
        ringPatternSchema,
        { category: 'per-projectile', baseCost: 0.12, variableCosts: ['count'] },
        ['projectile', 'radial']
      ),
      compile(params, path) {
        assertClosedParams(params, ringPatternSchema, path);
        const rotationOffset = readNumber(
          params,
          'rotationOffset',
          path,
          -Math.PI * 2,
          Math.PI * 2,
          0
        );
        return Object.freeze<ResolvedEmissionPattern>({
          primitiveId: CoreWeaponPrimitiveId.PATTERN_RING,
          resolveAngle(baseAngle, index, total) {
            return baseAngle + rotationOffset + (index / Math.max(1, total)) * Math.PI * 2;
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

    api.projectileMotions.register(CoreWeaponPrimitiveId.MOTION_STATIONARY, Object.freeze<ProjectileMotionPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.MOTION_STATIONARY,
        'projectile-motion',
        '静止',
        '保持弹体生成位置不变，适合地面区域、瞬时打击和近战判定。',
        stationaryMotionSchema,
        { category: 'per-projectile', baseCost: 0.02, variableCosts: [] },
        ['projectile', 'stationary']
      ),
      compile(params, path) {
        assertClosedParams(params, stationaryMotionSchema, path);
        return Object.freeze<ResolvedProjectileMotion>({
          primitiveId: CoreWeaponPrimitiveId.MOTION_STATIONARY,
          update() {},
        });
      },
    }));

    api.projectileMotions.register(CoreWeaponPrimitiveId.MOTION_ORBIT_PLAYER, Object.freeze<ProjectileMotionPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.MOTION_ORBIT_PLAYER,
        'projectile-motion',
        '环绕角色',
        '让弹体以受限半径和角速度持续围绕角色运动。',
        orbitPlayerMotionSchema,
        { category: 'per-projectile', baseCost: 0.18, variableCosts: ['radius', 'angularSpeed'] },
        ['projectile', 'orbit', 'player-follow']
      ),
      compile(params, path) {
        assertClosedParams(params, orbitPlayerMotionSchema, path);
        const radius = readNumber(params, 'radius', path, 16, 600);
        const angularSpeed = readNumber(params, 'angularSpeed', path, -12, 12);
        const phaseOffset = readNumber(
          params,
          'phaseOffset',
          path,
          -Math.PI * 2,
          Math.PI * 2,
          0
        );
        return Object.freeze<ResolvedProjectileMotion>({
          primitiveId: CoreWeaponPrimitiveId.MOTION_ORBIT_PLAYER,
          update(projectile, dt, player) {
            const centerX = player?.x ?? projectile.originX ?? projectile.x;
            const centerY = player?.y ?? projectile.originY ?? projectile.y;
            if (projectile.orbitAngle === undefined) {
              projectile.orbitAngle = getProjectileDirection(projectile).angle + phaseOffset;
            }
            projectile.orbitRadius = radius;
            projectile.orbitSpeed = angularSpeed;
            projectile.orbitFollowPlayer = true;
            projectile.originX = centerX;
            projectile.originY = centerY;
            projectile.orbitAngle += angularSpeed * dt;
            projectile.x = centerX + Math.cos(projectile.orbitAngle) * radius;
            projectile.y = centerY + Math.sin(projectile.orbitAngle) * radius;
            projectile.vx = -Math.sin(projectile.orbitAngle) * radius * angularSpeed;
            projectile.vy = Math.cos(projectile.orbitAngle) * radius * angularSpeed;
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
          mapResponse: stopOnMap ? 'expire' : 'pass',
          repeatHitInterval: 0,
          maximumTargetsPerTick: 1,
          getLookupRadius(projectile) {
            return projectile.radius + 64;
          },
          overlaps(projectile, enemy) {
            const dx = projectile.x - enemy.x;
            const dy = projectile.y - enemy.y;
            const radius = projectile.radius + enemy.radius;
            return dx * dx + dy * dy <= radius * radius;
          },
          handleMapCollision() {
            return !stopOnMap;
          },
        });
      },
    }));

    api.collisionBehaviors.register(CoreWeaponPrimitiveId.COLLISION_SEGMENT, Object.freeze<CollisionBehaviorPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.COLLISION_SEGMENT,
        'collision',
        '线段碰撞',
        '沿弹体方向使用受限长度和宽度进行贯穿线段判定。',
        segmentCollisionSchema,
        { category: 'per-projectile', baseCost: 0.45, variableCosts: ['length', 'widthScale'] },
        ['projectile', 'segment', 'piercing']
      ),
      compile(params, path) {
        assertClosedParams(params, segmentCollisionSchema, path);
        const length = readNumber(params, 'length', path, 16, 1200);
        const widthScale = readNumber(params, 'widthScale', path, 0.25, 4, 1);
        return Object.freeze<ResolvedCollisionBehavior>({
          primitiveId: CoreWeaponPrimitiveId.COLLISION_SEGMENT,
          stopOnMap: false,
          mapResponse: 'pass',
          repeatHitInterval: 0,
          maximumTargetsPerTick: 1000,
          getLookupRadius(projectile) {
            return length + projectile.radius * widthScale + 64;
          },
          overlaps(projectile, enemy) {
            const direction = getProjectileDirection(projectile);
            const relativeX = enemy.x - projectile.x;
            const relativeY = enemy.y - projectile.y;
            const projection = Math.max(0, Math.min(length, relativeX * direction.x + relativeY * direction.y));
            const closestX = projectile.x + direction.x * projection;
            const closestY = projectile.y + direction.y * projection;
            const dx = enemy.x - closestX;
            const dy = enemy.y - closestY;
            const radius = projectile.radius * widthScale + enemy.radius;
            return dx * dx + dy * dy <= radius * radius;
          },
          handleMapCollision() {
            return true;
          },
        });
      },
    }));

    api.collisionBehaviors.register(CoreWeaponPrimitiveId.COLLISION_SECTOR, Object.freeze<CollisionBehaviorPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.COLLISION_SECTOR,
        'collision',
        '扇区碰撞',
        '沿弹体方向检测受限距离和夹角内的敌人。',
        sectorCollisionSchema,
        { category: 'area-query', baseCost: 0.5, variableCosts: ['reach', 'arcRadians'] },
        ['projectile', 'sector', 'melee']
      ),
      compile(params, path) {
        assertClosedParams(params, sectorCollisionSchema, path);
        const reach = readNumber(params, 'reach', path, 16, 600);
        const arcRadians = readNumber(params, 'arcRadians', path, 0.05, Math.PI * 2);
        return Object.freeze<ResolvedCollisionBehavior>({
          primitiveId: CoreWeaponPrimitiveId.COLLISION_SECTOR,
          stopOnMap: false,
          mapResponse: 'pass',
          repeatHitInterval: 0,
          maximumTargetsPerTick: 1000,
          getLookupRadius(projectile) {
            return reach + projectile.radius + 64;
          },
          overlaps(projectile, enemy) {
            const direction = getProjectileDirection(projectile);
            const dx = enemy.x - projectile.x;
            const dy = enemy.y - projectile.y;
            const distanceSquared = dx * dx + dy * dy;
            const reachWithRadius = reach + enemy.radius + projectile.radius;
            if (distanceSquared > reachWithRadius * reachWithRadius) return false;
            if (arcRadians >= Math.PI * 2 - 0.001) return true;
            const distance = Math.sqrt(distanceSquared) || 1;
            const dot = (dx / distance) * direction.x + (dy / distance) * direction.y;
            const padding = Math.min(0.36, (enemy.radius + projectile.radius) / Math.max(16, distance));
            return dot >= Math.cos(arcRadians * 0.5 + padding);
          },
          handleMapCollision() {
            return true;
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
          maximumDamageMultiplier: scale,
          maximumExtraTargets: 0,
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
          maximumDamageMultiplier: 0,
          maximumExtraTargets: 0,
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

    api.projectileRenderers.register(CoreWeaponPrimitiveId.RENDER_RING, Object.freeze<ProjectileRenderPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.RENDER_RING,
        'render',
        '圆环视觉层',
        '使用调色板颜色绘制受限半径和线宽的圆环。',
        ringRenderSchema,
        { category: 'per-projectile', baseCost: 0.12, variableCosts: ['radiusScale', 'thicknessScale'] },
        ['projectile', 'shape', 'ring']
      ),
      compile(params, path) {
        assertClosedParams(params, ringRenderSchema, path);
        const colorSlot = readEnum(
          params,
          'colorSlot',
          path,
          ['primary', 'secondary', 'accent'] as const,
          'primary'
        );
        const radiusScale = readNumber(params, 'radiusScale', path, 0.1, 8, 1);
        const thicknessScale = readNumber(params, 'thicknessScale', path, 0.05, 2, 0.25);
        const opacityScale = readNumber(params, 'opacityScale', path, 0, 1, 1);
        return Object.freeze<ResolvedProjectileRenderPrimitive>({
          primitiveId: CoreWeaponPrimitiveId.RENDER_RING,
          draw(context) {
            const color = context.palette[colorSlot] ?? context.palette.primary;
            context.ctx.save();
            context.ctx.globalAlpha = context.lifeAlpha * context.recipeOpacity * opacityScale;
            context.ctx.strokeStyle = color;
            context.ctx.lineWidth = Math.max(
              1,
              context.projectile.radius * context.recipeScale * thicknessScale
            );
            context.ctx.beginPath();
            context.ctx.arc(
              context.projectile.x,
              context.projectile.y,
              context.projectile.radius * context.recipeScale * radiusScale,
              0,
              Math.PI * 2
            );
            context.ctx.stroke();
            context.ctx.restore();
          },
        });
      },
    }));

    api.projectileRenderers.register(CoreWeaponPrimitiveId.RENDER_BEAM, Object.freeze<ProjectileRenderPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.RENDER_BEAM,
        'render',
        '光束视觉层',
        '沿弹体方向绘制受限长度和宽度的直线光束。',
        beamRenderSchema,
        { category: 'per-projectile', baseCost: 0.2, variableCosts: ['length', 'widthScale'] },
        ['projectile', 'shape', 'beam']
      ),
      compile(params, path) {
        assertClosedParams(params, beamRenderSchema, path);
        const colorSlot = readEnum(
          params,
          'colorSlot',
          path,
          ['primary', 'secondary', 'accent'] as const,
          'primary'
        );
        const length = readNumber(params, 'length', path, 16, 1200);
        const widthScale = readNumber(params, 'widthScale', path, 0.1, 8, 1);
        const opacityScale = readNumber(params, 'opacityScale', path, 0, 1, 1);
        return Object.freeze<ResolvedProjectileRenderPrimitive>({
          primitiveId: CoreWeaponPrimitiveId.RENDER_BEAM,
          draw(context) {
            const color = context.palette[colorSlot] ?? context.palette.primary;
            const direction = getProjectileDirection(context.projectile);
            context.ctx.save();
            context.ctx.globalAlpha = context.lifeAlpha * context.recipeOpacity * opacityScale;
            context.ctx.strokeStyle = color;
            context.ctx.lineCap = 'round';
            context.ctx.lineWidth = Math.max(
              1,
              context.projectile.radius * 2 * context.recipeScale * widthScale
            );
            context.ctx.beginPath();
            context.ctx.moveTo(context.projectile.x, context.projectile.y);
            context.ctx.lineTo(
              context.projectile.x + direction.x * length * context.recipeScale,
              context.projectile.y + direction.y * length * context.recipeScale
            );
            context.ctx.stroke();
            context.ctx.restore();
          },
        });
      },
    }));

    api.projectileRenderers.register(CoreWeaponPrimitiveId.RENDER_ARC, Object.freeze<ProjectileRenderPrimitive>({
      descriptor: descriptor(
        CoreWeaponPrimitiveId.RENDER_ARC,
        'render',
        '圆弧视觉层',
        '围绕弹体方向绘制受限距离、夹角和线宽的攻击圆弧。',
        arcRenderSchema,
        { category: 'per-projectile', baseCost: 0.2, variableCosts: ['reach', 'arcRadians', 'widthScale'] },
        ['projectile', 'shape', 'arc']
      ),
      compile(params, path) {
        assertClosedParams(params, arcRenderSchema, path);
        const colorSlot = readEnum(
          params,
          'colorSlot',
          path,
          ['primary', 'secondary', 'accent'] as const,
          'primary'
        );
        const reach = readNumber(params, 'reach', path, 16, 600);
        const arcRadians = readNumber(params, 'arcRadians', path, 0.05, Math.PI * 2);
        const widthScale = readNumber(params, 'widthScale', path, 0.1, 8, 1);
        const opacityScale = readNumber(params, 'opacityScale', path, 0, 1, 1);
        return Object.freeze<ResolvedProjectileRenderPrimitive>({
          primitiveId: CoreWeaponPrimitiveId.RENDER_ARC,
          draw(context) {
            const color = context.palette[colorSlot] ?? context.palette.primary;
            const direction = getProjectileDirection(context.projectile);
            context.ctx.save();
            context.ctx.globalAlpha = context.lifeAlpha * context.recipeOpacity * opacityScale;
            context.ctx.strokeStyle = color;
            context.ctx.lineCap = 'round';
            context.ctx.lineWidth = Math.max(
              1,
              context.projectile.radius * context.recipeScale * widthScale
            );
            context.ctx.beginPath();
            context.ctx.arc(
              context.projectile.x,
              context.projectile.y,
              reach * context.recipeScale,
              direction.angle - arcRadians * 0.5,
              direction.angle + arcRadians * 0.5
            );
            context.ctx.stroke();
            context.ctx.restore();
          },
        });
      },
    }));
  },
});
