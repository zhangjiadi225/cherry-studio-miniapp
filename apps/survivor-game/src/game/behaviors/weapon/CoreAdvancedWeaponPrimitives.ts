import type { Enemy, Projectile, WeaponAudioCue, WeaponType } from '../../types';
import { WeaponType as WeaponTypes } from '../../types';
import type { PrimitiveParamsV1 } from '../../recipes/weapon/WeaponRecipe';
import { eventBus, GameEvent } from '../../events';
import { weaponSpriteRegistry } from '../../renderers/WeaponSpriteRegistry';
import type { EnginePlugin } from '../EngineRegistry';
import {
  WeaponPrimitiveParameterError,
  type CollisionBehaviorPrimitive,
  type EmissionPatternPrimitive,
  type EmissionSchedulePrimitive,
  type HitEffectPrimitive,
  type PrimitiveParameterSchemaV1,
  type ProjectileLifecyclePrimitive,
  type ProjectileMotionPrimitive,
  type ProjectileRenderPrimitive,
  type ResolvedCollisionBehavior,
  type ResolvedEmissionPattern,
  type ResolvedEmissionSchedule,
  type ResolvedHitEffect,
  type ResolvedProjectileLifecycle,
  type ResolvedProjectileMotion,
  type ResolvedProjectileRenderPrimitive,
  type ResolvedTargeting,
  type ResolvedWeaponDelivery,
  type ResolvedWeaponFeedbackEffect,
  type ResolvedWeaponTrigger,
  type TargetingPrimitive,
  type WeaponDeliveryPrimitive,
  type WeaponFeedbackPrimitive,
  type WeaponPrimitiveDescriptorV1,
  type WeaponPrimitiveKind,
  type WeaponTriggerPrimitive,
} from '../../recipes/weapon/WeaponRuntimePlan';

export const CoreAdvancedWeaponPrimitiveId = {
  DELIVERY_PROJECTILE: 'builtin.delivery.projectile',
  DELIVERY_ZONE: 'builtin.delivery.zone',
  DELIVERY_AURA: 'builtin.delivery.aura',
  DELIVERY_STRIKE: 'builtin.delivery.strike',
  DELIVERY_SWING: 'builtin.delivery.swing',
  EMISSION_SINGLE: 'builtin.emission.single',
  EMISSION_BURST: 'builtin.emission.burst',
  TRIGGER_CHARGE: 'builtin.trigger.charge',
  TARGET_LOWEST_HP: 'builtin.target.lowest-hp',
  TARGET_RANDOM_SEEDED: 'builtin.target.random-seeded',
  TARGET_CLUSTER: 'builtin.target.cluster',
  PATTERN_SPIRAL: 'builtin.pattern.spiral',
  MOTION_HOMING: 'builtin.motion.homing',
  MOTION_ACCELERATING: 'builtin.motion.accelerating',
  MOTION_RETURN: 'builtin.motion.return',
  COLLISION_AREA_PERIODIC: 'builtin.collision.area-periodic',
  COLLISION_WALL_BOUNCE: 'builtin.collision.wall-bounce',
  COLLISION_TERRAIN_STOP: 'builtin.collision.terrain-stop',
  EFFECT_SLOW: 'builtin.effect.slow',
  EFFECT_BURN: 'builtin.effect.burn',
  EFFECT_CHAIN: 'builtin.effect.chain',
  EFFECT_AREA_DAMAGE: 'builtin.effect.area-damage',
  LIFECYCLE_SPLIT_ON_HIT: 'builtin.lifecycle.split-on-hit',
  LIFECYCLE_SPLIT_ON_EXPIRE: 'builtin.lifecycle.split-on-expire',
  LIFECYCLE_BOUNCE: 'builtin.lifecycle.bounce',
  RENDER_SPRITE: 'builtin.render.sprite',
  AUDIO_CUE: 'builtin.audio.cue',
  CAMERA_IMPULSE: 'builtin.camera.impulse',
} as const;

function schema(
  schemaId: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = [],
  numericBounds: PrimitiveParameterSchemaV1['numericBounds'] = {},
  enumValues: PrimitiveParameterSchemaV1['enumValues'] = {},
  booleanKeys: readonly string[] = []
): PrimitiveParameterSchemaV1 {
  return { schemaId, allowedKeys, requiredKeys, numericBounds, enumValues, booleanKeys };
}

function descriptor(
  id: string,
  kind: WeaponPrimitiveKind,
  name: string,
  description: string,
  parameterSchema: PrimitiveParameterSchemaV1,
  budget: WeaponPrimitiveDescriptorV1['budget'],
  tags: readonly string[],
  requires: readonly string[] = [],
  conflictsWith: readonly string[] = []
): WeaponPrimitiveDescriptorV1 {
  return Object.freeze({
    id,
    version: '1.0.0',
    kind,
    name,
    description,
    parameterSchema: Object.freeze({
      ...parameterSchema,
      allowedKeys: Object.freeze([...parameterSchema.allowedKeys]),
      requiredKeys: Object.freeze([...parameterSchema.requiredKeys]),
      numericBounds: Object.freeze(Object.fromEntries(
        Object.entries(parameterSchema.numericBounds).map(([key, bounds]) => [
          key, Object.freeze({ ...bounds }),
        ])
      )),
      enumValues: Object.freeze(Object.fromEntries(
        Object.entries(parameterSchema.enumValues).map(([key, values]) => [
          key, Object.freeze([...values]),
        ])
      )),
      booleanKeys: Object.freeze([...parameterSchema.booleanKeys]),
    }),
    compatibility: Object.freeze({
      requires: Object.freeze([...requires]),
      conflictsWith: Object.freeze([...conflictsWith]),
      tags: Object.freeze([...tags]),
    }),
    budget: Object.freeze({
      ...budget,
      variableCosts: Object.freeze([...budget.variableCosts]),
    }),
  });
}

function assertClosed(params: PrimitiveParamsV1, definition: PrimitiveParameterSchemaV1, path: string): void {
  const allowed = new Set(definition.allowedKeys);
  for (const key of Object.keys(params)) {
    if (!allowed.has(key)) {
      throw new WeaponPrimitiveParameterError(
        'UNKNOWN_PRIMITIVE_PARAM', `${path}.${key}`, `unknown parameter "${key}"`
      );
    }
  }
  for (const key of definition.requiredKeys) {
    if (!(key in params)) {
      throw new WeaponPrimitiveParameterError(
        'MISSING_PRIMITIVE_PARAM', `${path}.${key}`, `missing required parameter "${key}"`
      );
    }
  }
}

function numberParam(
  params: PrimitiveParamsV1,
  key: string,
  path: string,
  min: number,
  max: number,
  fallback?: number,
  integer = false
): number {
  const value = params[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (
    typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM', `${path}.${key}`, `expected ${min}..${max}${integer ? ' integer' : ''}`
    );
  }
  return value;
}

function booleanParam(params: PrimitiveParamsV1, key: string, path: string, fallback: boolean): boolean {
  const value = params[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM', `${path}.${key}`, 'expected boolean'
    );
  }
  return value;
}

function enumParam<T extends string>(
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
      'INVALID_PRIMITIVE_PARAM', `${path}.${key}`, `expected ${values.join('|')}`
    );
  }
  return value as T;
}

function projectileAngle(projectile: Projectile): number {
  if (Math.abs(projectile.vx) + Math.abs(projectile.vy) > 0.001) {
    return Math.atan2(projectile.vy, projectile.vx);
  }
  return projectile.headingAngle ?? 0;
}

function circleOverlaps(projectile: Projectile, enemy: Enemy, radiusScale = 1): boolean {
  const dx = projectile.x - enemy.x;
  const dy = projectile.y - enemy.y;
  const radius = projectile.radius * radiusScale + enemy.radius;
  return dx * dx + dy * dy <= radius * radius;
}

function registerDelivery(
  api: Parameters<EnginePlugin['register']>[0],
  id: string,
  name: string,
  family: ResolvedWeaponDelivery['family'],
  definition: PrimitiveParameterSchemaV1,
  activationDelay: (params: PrimitiveParamsV1, path: string) => number,
  handlers: (
    params: PrimitiveParamsV1,
    path: string
  ) => Pick<ResolvedWeaponDelivery, 'initialize' | 'update'>,
  tags: readonly string[],
  requires: readonly string[] = []
): void {
  api.weaponDeliveries.register(id, Object.freeze<WeaponDeliveryPrimitive>({
    descriptor: descriptor(
      id, 'delivery', name, `使用 ${name} 的确定性交付语义。`, definition,
      { category: 'per-projectile', baseCost: 0.08, variableCosts: [...definition.allowedKeys] },
      tags,
      requires
    ),
    compile(params, path) {
      assertClosed(params, definition, path);
      const delay = activationDelay(params, path);
      const resolvedHandlers = handlers(params, path);
      return Object.freeze<ResolvedWeaponDelivery>({
        primitiveId: id,
        family,
        activationDelay: delay,
        initialize: resolvedHandlers.initialize,
        update: resolvedHandlers.update,
        canCollide(projectile) {
          return (projectile.activationRemaining ?? 0) <= 0;
        },
      });
    },
  }));
}

const emptyDeliverySchema = schema('builtin.schema.delivery.projectile.v1', []);
const auraDeliverySchema = schema(
  'builtin.schema.delivery.aura.v1', ['xOffset', 'yOffset'], [],
  { xOffset: { min: -256, max: 256 }, yOffset: { min: -256, max: 256 } }
);
const strikeDeliverySchema = schema(
  'builtin.schema.delivery.strike.v1', ['telegraphDelay'], [],
  { telegraphDelay: { min: 0, max: 2 } }
);
const swingDeliverySchema = schema(
  'builtin.schema.delivery.swing.v1', ['forwardOffset'], [],
  { forwardOffset: { min: 0, max: 240 } }
);
const burstSchema = schema(
  'builtin.schema.emission.burst.v1', ['burstCount', 'burstInterval'], ['burstCount', 'burstInterval'],
  { burstCount: { min: 2, max: 8 }, burstInterval: { min: 0.03, max: 1.5 } }
);
const chargeSchema = schema(
  'builtin.schema.trigger.charge.v1', ['cooldown', 'chargeDuration'], ['cooldown', 'chargeDuration'],
  { cooldown: { min: 0.2, max: 60 }, chargeDuration: { min: 0.05, max: 5 } }
);
const rangeTargetSchema = schema(
  'builtin.schema.target.range.v1', ['range', 'fallback'], ['range'],
  { range: { min: 32, max: 2400 } }, { fallback: ['forward', 'radial'] }
);
const seededTargetSchema = schema(
  'builtin.schema.target.random-seeded.v1', ['range', 'seed', 'fallback'], ['range', 'seed'],
  { range: { min: 32, max: 2400 }, seed: { min: 0, max: 2147483647 } },
  { fallback: ['forward', 'radial'] }
);
const clusterTargetSchema = schema(
  'builtin.schema.target.cluster.v1', ['range', 'clusterRadius', 'fallback'], ['range', 'clusterRadius'],
  { range: { min: 32, max: 2400 }, clusterRadius: { min: 24, max: 600 } },
  { fallback: ['forward', 'radial'] }
);
const spiralSchema = schema(
  'builtin.schema.pattern.spiral.v1', ['turns', 'rotationOffset'], ['turns'],
  { turns: { min: 0.125, max: 4 }, rotationOffset: { min: -Math.PI * 2, max: Math.PI * 2 } }
);
const homingSchema = schema(
  'builtin.schema.motion.homing.v1', ['range', 'turnRate', 'minimumSpeed'], ['range', 'turnRate'],
  { range: { min: 32, max: 1200 }, turnRate: { min: 0.1, max: 24 }, minimumSpeed: { min: 0, max: 2400 } }
);
const acceleratingSchema = schema(
  'builtin.schema.motion.accelerating.v1', ['acceleration', 'maxSpeed'], ['acceleration', 'maxSpeed'],
  { acceleration: { min: -2400, max: 2400 }, maxSpeed: { min: 0, max: 2400 } }
);
const returnSchema = schema(
  'builtin.schema.motion.return.v1', ['outboundDuration', 'returnSpeed', 'catchRadius'],
  ['outboundDuration', 'returnSpeed'],
  { outboundDuration: { min: 0.05, max: 8 }, returnSpeed: { min: 16, max: 2400 }, catchRadius: { min: 4, max: 128 } }
);
const periodicCollisionSchema = schema(
  'builtin.schema.collision.area-periodic.v1',
  ['radiusScale', 'tickInterval', 'maxTargetsPerTick', 'stopOnMap'],
  ['tickInterval', 'maxTargetsPerTick'],
  {
    radiusScale: { min: 0.25, max: 8 }, tickInterval: { min: 0.08, max: 3 },
    maxTargetsPerTick: { min: 1, max: 32 },
  }, {}, ['stopOnMap']
);
const wallBounceSchema = schema(
  'builtin.schema.collision.wall-bounce.v1', ['maxBounces', 'speedRetention'], ['maxBounces'],
  { maxBounces: { min: 1, max: 12 }, speedRetention: { min: 0.2, max: 1 } }
);
const terrainStopSchema = schema('builtin.schema.collision.terrain-stop.v1', []);
const slowSchema = schema(
  'builtin.schema.effect.slow.v1', ['speedMultiplier', 'duration'], ['speedMultiplier', 'duration'],
  { speedMultiplier: { min: 0.2, max: 1 }, duration: { min: 0.1, max: 12 } }
);
const burnSchema = schema(
  'builtin.schema.effect.burn.v1', ['damagePerSecondScale', 'duration'], ['damagePerSecondScale', 'duration'],
  { damagePerSecondScale: { min: 0.05, max: 3 }, duration: { min: 0.2, max: 12 } }
);
const areaDamageSchema = schema(
  'builtin.schema.effect.area-damage.v1', ['radius', 'damageScale', 'maxTargets'],
  ['radius', 'damageScale', 'maxTargets'],
  { radius: { min: 16, max: 500 }, damageScale: { min: 0.05, max: 4 }, maxTargets: { min: 1, max: 16 } }
);
const chainSchema = schema(
  'builtin.schema.effect.chain.v1', ['range', 'damageScale', 'maxTargets'],
  ['range', 'damageScale', 'maxTargets'],
  { range: { min: 16, max: 600 }, damageScale: { min: 0.05, max: 3 }, maxTargets: { min: 1, max: 12 } }
);
const splitSchema = schema(
  'builtin.schema.lifecycle.split.v1',
  ['childCount', 'spreadRadians', 'damageScale', 'speedScale', 'lifetimeScale', 'maxDepth', 'inheritLifecycle'],
  ['childCount', 'spreadRadians', 'damageScale', 'speedScale', 'lifetimeScale', 'maxDepth'],
  {
    childCount: { min: 2, max: 6 }, spreadRadians: { min: 0, max: Math.PI * 2 },
    damageScale: { min: 0.05, max: 1 }, speedScale: { min: 0.1, max: 2 },
    lifetimeScale: { min: 0.1, max: 1 }, maxDepth: { min: 1, max: 3 },
  }, {}, ['inheritLifecycle']
);
const lifecycleBounceSchema = schema(
  'builtin.schema.lifecycle.bounce.v1', ['maxBounces', 'angleOffset', 'speedRetention'], ['maxBounces'],
  {
    maxBounces: { min: 1, max: 8 }, angleOffset: { min: 0.1, max: Math.PI },
    speedRetention: { min: 0.2, max: 1 },
  }
);
const spriteSchema = schema(
  'builtin.schema.render.sprite.v1', ['asset', 'sizeScale', 'rotationOffset', 'glow'], ['asset'],
  { sizeScale: { min: 0.25, max: 6 }, rotationOffset: { min: -Math.PI * 2, max: Math.PI * 2 } },
  { asset: Object.values(WeaponTypes) }, ['glow']
);
const audioCueSchema = schema(
  'builtin.schema.audio.cue.v1', ['event', 'cue', 'intensity'], ['event', 'cue'],
  { intensity: { min: 0.1, max: 1 } },
  { event: ['charge', 'cast', 'hit', 'kill', 'expire'], cue: ['charge', 'cast', 'impact', 'burst', 'pulse'] }
);
const cameraImpulseSchema = schema(
  'builtin.schema.camera.impulse.v1', ['event', 'duration', 'intensity'], ['event', 'duration', 'intensity'],
  { duration: { min: 0.02, max: 0.4 }, intensity: { min: 0.1, max: 12 } },
  { event: ['charge', 'cast', 'hit', 'kill', 'expire'] }
);

const targetCandidates: Enemy[] = [];
export const CORE_ADVANCED_WEAPON_PRIMITIVE_PLUGIN: EnginePlugin = Object.freeze<EnginePlugin>({
  id: 'builtin.plugin.advanced-weapon-primitives',
  version: '1.0.0',
  register(api) {
    registerDelivery(
      api, CoreAdvancedWeaponPrimitiveId.DELIVERY_PROJECTILE, '飞行弹体', 'projectile',
      emptyDeliverySchema, () => 0,
      () => ({ initialize() {}, update() {} }), ['projectile']
    );
    registerDelivery(
      api, CoreAdvancedWeaponPrimitiveId.DELIVERY_ZONE, '地面区域', 'zone',
      emptyDeliverySchema, () => 0,
      () => ({ initialize() {}, update() {} }),
      ['zone', 'ground-placement'],
      ['builtin.origin.target-ground', 'builtin.motion.stationary', 'builtin.collision.area-periodic']
    );
    registerDelivery(
      api, CoreAdvancedWeaponPrimitiveId.DELIVERY_AURA, '角色光环', 'aura',
      auraDeliverySchema, () => 0,
      (params, path) => {
        const xOffset = numberParam(params, 'xOffset', path, -256, 256, 0);
        const yOffset = numberParam(params, 'yOffset', path, -256, 256, 0);
        return {
          initialize(projectile, player) {
            projectile.deliveryOffsetX = xOffset;
            projectile.deliveryOffsetY = yOffset;
            projectile.x = player.x + xOffset;
            projectile.y = player.y + yOffset;
          },
          update(projectile, _dt, player) {
            if (!player) return;
            projectile.x = player.x + (projectile.deliveryOffsetX ?? 0);
            projectile.y = player.y + (projectile.deliveryOffsetY ?? 0);
          },
        };
      },
      ['aura', 'player-follow'],
      ['builtin.origin.player', 'builtin.motion.stationary', 'builtin.collision.area-periodic']
    );
    registerDelivery(
      api, CoreAdvancedWeaponPrimitiveId.DELIVERY_STRIKE, '延迟打击', 'strike',
      strikeDeliverySchema,
      (params, path) => numberParam(params, 'telegraphDelay', path, 0, 2, 0.35),
      () => ({ initialize() {}, update() {} }),
      ['strike', 'telegraph'],
      ['builtin.origin.target-ground', 'builtin.motion.stationary', 'builtin.particle.telegraph']
    );
    registerDelivery(
      api, CoreAdvancedWeaponPrimitiveId.DELIVERY_SWING, '近战挥击', 'swing',
      swingDeliverySchema, () => 0,
      (params, path) => {
        const forwardOffset = numberParam(params, 'forwardOffset', path, 0, 240, 42);
        return {
          initialize(projectile, player) {
            projectile.deliveryOffsetX = forwardOffset;
            projectile.deliveryOffsetY = 0;
            projectile.originX = player.x;
            projectile.originY = player.y;
          },
          update(projectile, _dt, player) {
            if (!player) return;
            const sign = player.facingLeft ? -1 : 1;
            const offset = projectile.deliveryOffsetX ?? forwardOffset;
            projectile.originX = player.x;
            projectile.originY = player.y;
            projectile.x = player.x + sign * offset;
            projectile.y = player.y;
            projectile.headingAngle = sign < 0 ? Math.PI : 0;
            projectile.vx = sign;
            projectile.vy = 0;
          },
        };
      },
      ['swing', 'melee', 'player-follow'],
      ['builtin.origin.player', 'builtin.motion.stationary', 'builtin.collision.sector']
    );

    api.emissionSchedules.register(CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE, Object.freeze<EmissionSchedulePrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE, 'emission-schedule', '单次齐射',
        '每次施放生成一次齐射。', emptyDeliverySchema,
        { category: 'constant', baseCost: 0.02, variableCosts: [] }, ['emission']
      ),
      compile(params, path) {
        assertClosed(params, emptyDeliverySchema, path);
        return Object.freeze<ResolvedEmissionSchedule>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_SINGLE,
          burstCount: 1,
          burstInterval: 0,
        });
      },
    }));
    api.emissionSchedules.register(CoreAdvancedWeaponPrimitiveId.EMISSION_BURST, Object.freeze<EmissionSchedulePrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.EMISSION_BURST, 'emission-schedule', '受限连发',
        '按固定间隔生成受限次数的齐射，单帧最多追赶两次。', burstSchema,
        { category: 'per-projectile', baseCost: 0.12, variableCosts: ['burstCount', 'burstInterval'] },
        ['emission', 'burst']
      ),
      compile(params, path) {
        assertClosed(params, burstSchema, path);
        return Object.freeze<ResolvedEmissionSchedule>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.EMISSION_BURST,
          burstCount: numberParam(params, 'burstCount', path, 2, 8, undefined, true),
          burstInterval: numberParam(params, 'burstInterval', path, 0.03, 1.5),
        });
      },
    }));

    api.weaponTriggers.register(CoreAdvancedWeaponPrimitiveId.TRIGGER_CHARGE, Object.freeze<WeaponTriggerPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.TRIGGER_CHARGE, 'trigger', '充能触发',
        '冷却完成后进入确定性充能窗口，再执行施放。', chargeSchema,
        { category: 'constant', baseCost: 0.08, variableCosts: ['chargeDuration'] }, ['charge']
      ),
      compile(params, path) {
        assertClosed(params, chargeSchema, path);
        return Object.freeze<ResolvedWeaponTrigger>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.TRIGGER_CHARGE,
          cooldown: numberParam(params, 'cooldown', path, 0.2, 60),
          chargeDuration: numberParam(params, 'chargeDuration', path, 0.05, 5),
        });
      },
    }));

    api.targetingStrategies.register(CoreAdvancedWeaponPrimitiveId.TARGET_LOWEST_HP, Object.freeze<TargetingPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.TARGET_LOWEST_HP, 'targeting', '最低生命目标',
        '在范围内按生命值、距离和实体 ID 稳定排序。', rangeTargetSchema,
        { category: 'area-query', baseCost: 1.1, variableCosts: ['range', 'count'] }, ['targeting']
      ),
      compile(params, path) {
        assertClosed(params, rangeTargetSchema, path);
        const range = numberParam(params, 'range', path, 32, 2400);
        const fallback = enumParam(params, 'fallback', path, ['forward', 'radial'] as const, 'radial');
        return Object.freeze<ResolvedTargeting>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.TARGET_LOWEST_HP,
          fallback,
          select(player, enemyQuery, count, output) {
            output.length = 0;
            enemyQuery.forNearby(player.x, player.y, range, (enemy) => {
              if (enemy.hp <= 0) return;
              output.push(enemy);
            });
            output.sort((a, b) => {
              const adx = a.x - player.x;
              const ady = a.y - player.y;
              const bdx = b.x - player.x;
              const bdy = b.y - player.y;
              return a.hp - b.hp ||
                adx * adx + ady * ady - bdx * bdx - bdy * bdy ||
                a.id - b.id;
            });
            output.length = Math.min(count, output.length);
            return output.length;
          },
        });
      },
    }));

    api.targetingStrategies.register(CoreAdvancedWeaponPrimitiveId.TARGET_RANDOM_SEEDED, Object.freeze<TargetingPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.TARGET_RANDOM_SEEDED, 'targeting', '种子随机目标',
        '以显式种子和实体 ID 生成稳定伪随机顺序，不调用 Math.random。', seededTargetSchema,
        { category: 'area-query', baseCost: 1.15, variableCosts: ['range', 'count'] }, ['targeting', 'deterministic-rng']
      ),
      compile(params, path) {
        assertClosed(params, seededTargetSchema, path);
        const range = numberParam(params, 'range', path, 32, 2400);
        const seed = numberParam(params, 'seed', path, 0, 2147483647, undefined, true) | 0;
        const fallback = enumParam(params, 'fallback', path, ['forward', 'radial'] as const, 'radial');
        return Object.freeze<ResolvedTargeting>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.TARGET_RANDOM_SEEDED,
          fallback,
          select(player, enemyQuery, count, output, castSeed) {
            output.length = 0;
            enemyQuery.forNearby(player.x, player.y, range, (enemy) => {
              if (enemy.hp <= 0) return;
              output.push(enemy);
            });
            output.sort((a, b) => {
              const castSubseed = Math.imul(castSeed + 1, 0x85ebca6b);
              const scoreA = Math.imul((a.id ^ seed ^ castSubseed) >>> 0, 0x9e3779b1) >>> 0;
              const scoreB = Math.imul((b.id ^ seed ^ castSubseed) >>> 0, 0x9e3779b1) >>> 0;
              return scoreA - scoreB || a.id - b.id;
            });
            output.length = Math.min(count, output.length);
            return output.length;
          },
        });
      },
    }));

    api.targetingStrategies.register(CoreAdvancedWeaponPrimitiveId.TARGET_CLUSTER, Object.freeze<TargetingPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.TARGET_CLUSTER, 'targeting', '敌群中心',
        '在最多 64 个候选中选择邻居最密集的目标，再按中心距离稳定选取。', clusterTargetSchema,
        { category: 'area-query', baseCost: 1.8, variableCosts: ['range', 'clusterRadius', 'count'] },
        ['targeting', 'cluster']
      ),
      compile(params, path) {
        assertClosed(params, clusterTargetSchema, path);
        const range = numberParam(params, 'range', path, 32, 2400);
        const clusterRadius = numberParam(params, 'clusterRadius', path, 24, 600);
        const fallback = enumParam(params, 'fallback', path, ['forward', 'radial'] as const, 'radial');
        return Object.freeze<ResolvedTargeting>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.TARGET_CLUSTER,
          fallback,
          select(player, enemyQuery, count, output) {
            targetCandidates.length = 0;
            enemyQuery.forNearby(player.x, player.y, range, (enemy) => {
              if (enemy.hp > 0 && targetCandidates.length < 64) targetCandidates.push(enemy);
            });
            let center: Enemy | undefined;
            let bestNeighbors = -1;
            for (const candidate of targetCandidates) {
              let neighbors = 0;
              enemyQuery.forNearby(candidate.x, candidate.y, clusterRadius, (enemy) => {
                if (enemy.hp > 0) neighbors++;
              });
              if (neighbors > bestNeighbors || (neighbors === bestNeighbors && candidate.id < (center?.id ?? Infinity))) {
                bestNeighbors = neighbors;
                center = candidate;
              }
            }
            output.length = 0;
            if (!center) return 0;
            output.push(...targetCandidates);
            output.sort((a, b) => {
              const adx = a.x - center!.x;
              const ady = a.y - center!.y;
              const bdx = b.x - center!.x;
              const bdy = b.y - center!.y;
              return adx * adx + ady * ady - bdx * bdx - bdy * bdy || a.id - b.id;
            });
            output.length = Math.min(count, output.length);
            return output.length;
          },
        });
      },
    }));

    api.emissionPatterns.register(CoreAdvancedWeaponPrimitiveId.PATTERN_SPIRAL, Object.freeze<EmissionPatternPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.PATTERN_SPIRAL, 'emission-pattern', '螺旋阵型',
        '让同次齐射沿受限圈数递进旋转。', spiralSchema,
        { category: 'per-projectile', baseCost: 0.14, variableCosts: ['turns', 'count'] }, ['pattern', 'spiral']
      ),
      compile(params, path) {
        assertClosed(params, spiralSchema, path);
        const turns = numberParam(params, 'turns', path, 0.125, 4);
        const offset = numberParam(params, 'rotationOffset', path, -Math.PI * 2, Math.PI * 2, 0);
        return Object.freeze<ResolvedEmissionPattern>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.PATTERN_SPIRAL,
          resolveAngle(baseAngle, index, total) {
            return baseAngle + offset + (index / Math.max(1, total)) * Math.PI * 2 * turns;
          },
        });
      },
    }));

    api.projectileMotions.register(CoreAdvancedWeaponPrimitiveId.MOTION_HOMING, Object.freeze<ProjectileMotionPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.MOTION_HOMING, 'projectile-motion', '追踪运动',
        '通过空间查询寻找最近目标，并以受限角速度转向。', homingSchema,
        { category: 'area-query', baseCost: 0.8, variableCosts: ['range', 'turnRate'] }, ['motion', 'homing']
      ),
      compile(params, path) {
        assertClosed(params, homingSchema, path);
        const range = numberParam(params, 'range', path, 32, 1200);
        const turnRate = numberParam(params, 'turnRate', path, 0.1, 24);
        const minimumSpeed = numberParam(params, 'minimumSpeed', path, 0, 2400, 0);
        return Object.freeze<ResolvedProjectileMotion>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.MOTION_HOMING,
          update(projectile, dt, _player, enemyQuery) {
            let target: Enemy | undefined;
            let best = range * range;
            enemyQuery?.forNearby(projectile.x, projectile.y, range, (enemy) => {
              if (enemy.hp <= 0) return;
              const dx = enemy.x - projectile.x;
              const dy = enemy.y - projectile.y;
              const distance = dx * dx + dy * dy;
              if (distance < best || (distance === best && enemy.id < (target?.id ?? Infinity))) {
                best = distance;
                target = enemy;
              }
            });
            const speed = Math.max(minimumSpeed, Math.sqrt(projectile.vx ** 2 + projectile.vy ** 2));
            let angle = projectileAngle(projectile);
            if (target) {
              const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
              const delta = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
              angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, delta));
            }
            projectile.headingAngle = angle;
            projectile.vx = Math.cos(angle) * speed;
            projectile.vy = Math.sin(angle) * speed;
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
          },
        });
      },
    }));

    api.projectileMotions.register(CoreAdvancedWeaponPrimitiveId.MOTION_ACCELERATING, Object.freeze<ProjectileMotionPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.MOTION_ACCELERATING, 'projectile-motion', '加速运动',
        '沿当前方向施加固定加速度并限制最高速度。', acceleratingSchema,
        { category: 'per-projectile', baseCost: 0.16, variableCosts: ['acceleration'] }, ['motion']
      ),
      compile(params, path) {
        assertClosed(params, acceleratingSchema, path);
        const acceleration = numberParam(params, 'acceleration', path, -2400, 2400);
        const maxSpeed = numberParam(params, 'maxSpeed', path, 0, 2400);
        return Object.freeze<ResolvedProjectileMotion>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.MOTION_ACCELERATING,
          update(projectile, dt) {
            const angle = projectileAngle(projectile);
            const current = Math.sqrt(projectile.vx ** 2 + projectile.vy ** 2);
            const speed = Math.max(0, Math.min(maxSpeed, current + acceleration * dt));
            projectile.vx = Math.cos(angle) * speed;
            projectile.vy = Math.sin(angle) * speed;
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
          },
        });
      },
    }));

    api.projectileMotions.register(CoreAdvancedWeaponPrimitiveId.MOTION_RETURN, Object.freeze<ProjectileMotionPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.MOTION_RETURN, 'projectile-motion', '回旋运动',
        '先直线飞行，再返回角色；接近角色时结束生命周期。', returnSchema,
        { category: 'per-projectile', baseCost: 0.22, variableCosts: ['outboundDuration', 'returnSpeed'] },
        ['motion', 'player-follow']
      ),
      compile(params, path) {
        assertClosed(params, returnSchema, path);
        const outboundDuration = numberParam(params, 'outboundDuration', path, 0.05, 8);
        const returnSpeed = numberParam(params, 'returnSpeed', path, 16, 2400);
        const catchRadius = numberParam(params, 'catchRadius', path, 4, 128, 20);
        return Object.freeze<ResolvedProjectileMotion>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.MOTION_RETURN,
          update(projectile, dt, player) {
            projectile.motionAge = (projectile.motionAge ?? 0) + dt;
            projectile.returnPhase ||= projectile.motionAge >= outboundDuration;
            if (!projectile.returnPhase || !player) {
              projectile.x += projectile.vx * dt;
              projectile.y += projectile.vy * dt;
              return true;
            }
            const dx = player.x - projectile.x;
            const dy = player.y - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= catchRadius) return false;
            projectile.vx = dx / distance * returnSpeed;
            projectile.vy = dy / distance * returnSpeed;
            projectile.headingAngle = Math.atan2(projectile.vy, projectile.vx);
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
            return true;
          },
        });
      },
    }));

    api.collisionBehaviors.register(CoreAdvancedWeaponPrimitiveId.COLLISION_AREA_PERIODIC, Object.freeze<CollisionBehaviorPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.COLLISION_AREA_PERIODIC, 'collision', '周期区域碰撞',
        '区域内同一敌人按固定最短间隔重复命中。', periodicCollisionSchema,
        {
          category: 'area-query',
          baseCost: 0.7,
          variableCosts: ['radiusScale', 'tickInterval', 'maxTargetsPerTick'],
        },
        ['collision', 'area']
      ),
      compile(params, path) {
        assertClosed(params, periodicCollisionSchema, path);
        const radiusScale = numberParam(params, 'radiusScale', path, 0.25, 8, 1);
        const tickInterval = numberParam(params, 'tickInterval', path, 0.08, 3);
        const maximumTargetsPerTick = numberParam(
          params, 'maxTargetsPerTick', path, 1, 32, undefined, true
        );
        const stopOnMap = booleanParam(params, 'stopOnMap', path, false);
        return Object.freeze<ResolvedCollisionBehavior>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.COLLISION_AREA_PERIODIC,
          stopOnMap,
          mapResponse: stopOnMap ? 'expire' : 'pass',
          repeatHitInterval: tickInterval,
          maximumTargetsPerTick,
          getLookupRadius(projectile) {
            return projectile.radius * radiusScale + 64;
          },
          getSweepRadius() {
            return undefined;
          },
          overlaps(projectile, enemy) {
            return circleOverlaps(projectile, enemy, radiusScale);
          },
          handleMapCollision() {
            return !stopOnMap;
          },
        });
      },
    }));

    api.collisionBehaviors.register(CoreAdvancedWeaponPrimitiveId.COLLISION_WALL_BOUNCE, Object.freeze<CollisionBehaviorPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.COLLISION_WALL_BOUNCE, 'collision', '墙面反弹',
        '地图碰撞时回到上一位置、反转速度，并限制反弹次数。', wallBounceSchema,
        { category: 'per-projectile', baseCost: 0.35, variableCosts: ['maxBounces'] }, ['collision', 'bounce']
      ),
      compile(params, path) {
        assertClosed(params, wallBounceSchema, path);
        const maxBounces = numberParam(params, 'maxBounces', path, 1, 12, undefined, true);
        const retention = numberParam(params, 'speedRetention', path, 0.2, 1, 0.85);
        return Object.freeze<ResolvedCollisionBehavior>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.COLLISION_WALL_BOUNCE,
          stopOnMap: true,
          mapResponse: 'bounce',
          repeatHitInterval: 0,
          maximumTargetsPerTick: 1,
          getLookupRadius(projectile) {
            return projectile.radius + 64;
          },
          getSweepRadius(projectile) {
            return projectile.radius;
          },
          overlaps(projectile, enemy) {
            return circleOverlaps(projectile, enemy);
          },
          handleMapCollision(projectile) {
            const nextCount = (projectile.mapBounceCount ?? 0) + 1;
            projectile.mapBounceCount = nextCount;
            if (nextCount > maxBounces) return false;
            projectile.x = projectile.previousX ?? projectile.x;
            projectile.y = projectile.previousY ?? projectile.y;
            projectile.vx *= -retention;
            projectile.vy *= -retention;
            projectile.headingAngle = projectileAngle(projectile);
            return true;
          },
        });
      },
    }));

    api.collisionBehaviors.register(CoreAdvancedWeaponPrimitiveId.COLLISION_TERRAIN_STOP, Object.freeze<CollisionBehaviorPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.COLLISION_TERRAIN_STOP, 'collision', '地形阻挡',
        '命中地图阻挡后立即结束弹体。', terrainStopSchema,
        { category: 'per-projectile', baseCost: 0.22, variableCosts: [] }, ['collision', 'terrain']
      ),
      compile(params, path) {
        assertClosed(params, terrainStopSchema, path);
        return Object.freeze<ResolvedCollisionBehavior>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.COLLISION_TERRAIN_STOP,
          stopOnMap: true,
          mapResponse: 'expire',
          repeatHitInterval: 0,
          maximumTargetsPerTick: 1,
          getLookupRadius(projectile) {
            return projectile.radius + 64;
          },
          getSweepRadius(projectile) {
            return projectile.radius;
          },
          overlaps(projectile, enemy) {
            return circleOverlaps(projectile, enemy);
          },
          handleMapCollision() {
            return false;
          },
        });
      },
    }));

    const registerHitEffect = (
      id: string,
      name: string,
      descriptionText: string,
      definition: PrimitiveParameterSchemaV1,
      compile: (params: PrimitiveParamsV1, path: string) => ResolvedHitEffect
    ) => api.hitEffects.register(id, Object.freeze<HitEffectPrimitive>({
      descriptor: descriptor(
        id, 'hit-effect', name, descriptionText, definition,
        { category: 'per-hit', baseCost: 0.35, variableCosts: [...definition.allowedKeys] }, ['hit-effect']
      ),
      compile(params, path) {
        assertClosed(params, definition, path);
        return compile(params, path);
      },
    }));

    registerHitEffect(
      CoreAdvancedWeaponPrimitiveId.EFFECT_SLOW, '减速', '以最强值刷新受限持续时间。', slowSchema,
      (params, path) => {
        const speedMultiplier = numberParam(params, 'speedMultiplier', path, 0.2, 1);
        const duration = numberParam(params, 'duration', path, 0.1, 12);
        return Object.freeze<ResolvedHitEffect>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_SLOW,
          maximumDamageMultiplier: 0,
          maximumExtraTargets: 0,
          apply(context) { context.applySlow(speedMultiplier, duration); },
        });
      }
    );
    registerHitEffect(
      CoreAdvancedWeaponPrimitiveId.EFFECT_BURN, '灼烧', '以最高每秒伤害刷新受限持续时间。', burnSchema,
      (params, path) => {
        const scale = numberParam(params, 'damagePerSecondScale', path, 0.05, 3);
        const duration = numberParam(params, 'duration', path, 0.2, 12);
        return Object.freeze<ResolvedHitEffect>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_BURN,
          maximumDamageMultiplier: scale * duration,
          maximumExtraTargets: 0,
          apply(context) { context.applyBurn(scale, duration); },
        });
      }
    );
    registerHitEffect(
      CoreAdvancedWeaponPrimitiveId.EFFECT_AREA_DAMAGE, '范围伤害', '在空间查询内对有限目标造成额外伤害。', areaDamageSchema,
      (params, path) => {
        const radius = numberParam(params, 'radius', path, 16, 500);
        const scale = numberParam(params, 'damageScale', path, 0.05, 4);
        const maxTargets = numberParam(params, 'maxTargets', path, 1, 16, undefined, true);
        return Object.freeze<ResolvedHitEffect>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_AREA_DAMAGE,
          maximumDamageMultiplier: scale * maxTargets,
          maximumExtraTargets: maxTargets,
          apply(context) { context.dealAreaDamage(radius, scale, maxTargets); },
        });
      }
    );
    registerHitEffect(
      CoreAdvancedWeaponPrimitiveId.EFFECT_CHAIN, '连锁伤害', '按距离与实体 ID 稳定连接有限目标。', chainSchema,
      (params, path) => {
        const range = numberParam(params, 'range', path, 16, 600);
        const scale = numberParam(params, 'damageScale', path, 0.05, 3);
        const maxTargets = numberParam(params, 'maxTargets', path, 1, 12, undefined, true);
        return Object.freeze<ResolvedHitEffect>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.EFFECT_CHAIN,
          maximumDamageMultiplier: scale * maxTargets,
          maximumExtraTargets: maxTargets,
          apply(context) { context.dealChainDamage(range, scale, maxTargets); },
        });
      }
    );

    const registerSplit = (id: string, event: ResolvedProjectileLifecycle['event'], name: string) => {
      api.projectileLifecycles.register(id, Object.freeze<ProjectileLifecyclePrimitive>({
        descriptor: descriptor(
          id, 'lifecycle', name, '在受限深度内从对象池生成有限子弹体。', splitSchema,
          { category: 'per-projectile', baseCost: 0.6, variableCosts: ['childCount', 'maxDepth'] },
          ['lifecycle', 'split']
        ),
        compile(params, path) {
          assertClosed(params, splitSchema, path);
          const childCount = numberParam(params, 'childCount', path, 2, 6, undefined, true);
          const spread = numberParam(params, 'spreadRadians', path, 0, Math.PI * 2);
          const damageScale = numberParam(params, 'damageScale', path, 0.05, 1);
          const speedScale = numberParam(params, 'speedScale', path, 0.1, 2);
          const lifetimeScale = numberParam(params, 'lifetimeScale', path, 0.1, 1);
          const maxDepth = numberParam(params, 'maxDepth', path, 1, 3, undefined, true);
          const inherit = booleanParam(params, 'inheritLifecycle', path, false);
          return Object.freeze<ResolvedProjectileLifecycle>({
            primitiveId: id,
            event,
            maximumChildren: childCount,
            maximumDepth: maxDepth,
            handle(context) {
              if (context.triggerCount > 0 || (context.projectile.lifecycleDepth ?? 0) >= maxDepth) return;
              context.setTriggerCount(context.triggerCount + 1);
              const base = projectileAngle(context.projectile);
              for (let index = 0; index < childCount; index++) {
                const offset = childCount <= 1 ? 0 : -spread / 2 + spread * index / (childCount - 1);
                context.spawnChild(base + offset, damageScale, speedScale, lifetimeScale, inherit);
              }
            },
          });
        },
      }));
    };
    registerSplit(CoreAdvancedWeaponPrimitiveId.LIFECYCLE_SPLIT_ON_HIT, 'hit', '命中分裂');
    registerSplit(CoreAdvancedWeaponPrimitiveId.LIFECYCLE_SPLIT_ON_EXPIRE, 'expire', '消失分裂');

    api.projectileLifecycles.register(CoreAdvancedWeaponPrimitiveId.LIFECYCLE_BOUNCE, Object.freeze<ProjectileLifecyclePrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.LIFECYCLE_BOUNCE, 'lifecycle', '敌人间弹跳',
        '命中后改变方向并保留弹体，次数和速度均受限。', lifecycleBounceSchema,
        { category: 'per-hit', baseCost: 0.32, variableCosts: ['maxBounces'] }, ['lifecycle', 'bounce']
      ),
      compile(params, path) {
        assertClosed(params, lifecycleBounceSchema, path);
        const maxBounces = numberParam(params, 'maxBounces', path, 1, 8, undefined, true);
        const offset = numberParam(params, 'angleOffset', path, 0.1, Math.PI, Math.PI * 0.55);
        const retention = numberParam(params, 'speedRetention', path, 0.2, 1, 0.82);
        return Object.freeze<ResolvedProjectileLifecycle>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.LIFECYCLE_BOUNCE,
          event: 'hit',
          maximumChildren: 0,
          maximumDepth: 0,
          handle(context) {
            if (context.triggerCount >= maxBounces) return;
            const direction = context.triggerCount % 2 === 0 ? 1 : -1;
            context.setTriggerCount(context.triggerCount + 1);
            context.redirect(projectileAngle(context.projectile) + offset * direction, retention);
            context.preserveProjectile();
          },
        });
      },
    }));

    api.projectileRenderers.register(CoreAdvancedWeaponPrimitiveId.RENDER_SPRITE, Object.freeze<ProjectileRenderPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.RENDER_SPRITE, 'render', '内置精灵',
        '仅从已打包的武器精灵白名单中绘制，不加载网络资源。', spriteSchema,
        { category: 'per-projectile', baseCost: 0.24, variableCosts: ['sizeScale'] }, ['render', 'sprite', 'packaged-asset']
      ),
      compile(params, path) {
        assertClosed(params, spriteSchema, path);
        const asset = enumParam(params, 'asset', path, Object.values(WeaponTypes), WeaponTypes.MAGIC_WAND) as WeaponType;
        const sizeScale = numberParam(params, 'sizeScale', path, 0.25, 6, 2.5);
        const rotationOffset = numberParam(params, 'rotationOffset', path, -Math.PI * 2, Math.PI * 2, 0);
        const glow = booleanParam(params, 'glow', path, false);
        return Object.freeze<ResolvedProjectileRenderPrimitive>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.RENDER_SPRITE,
          draw(context) {
            weaponSpriteRegistry.drawWeapon(
              context.ctx,
              asset,
              context.projectile.x,
              context.projectile.y,
              context.projectile.radius * context.recipeScale * sizeScale,
              {
                alpha: context.lifeAlpha * context.recipeOpacity,
                rotation: projectileAngle(context.projectile) + rotationOffset,
                glow,
              }
            );
          },
        });
      },
    }));

    api.weaponFeedbackEffects.register(CoreAdvancedWeaponPrimitiveId.AUDIO_CUE, Object.freeze<WeaponFeedbackPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.AUDIO_CUE, 'feedback', '音效提示',
        '向音频表现系统发送白名单音色提示。', audioCueSchema,
        { category: 'constant', baseCost: 0.08, variableCosts: ['event', 'intensity'] }, ['feedback', 'audio']
      ),
      compile(params, path) {
        assertClosed(params, audioCueSchema, path);
        const event = enumParam(params, 'event', path, ['charge', 'cast', 'hit', 'kill', 'expire'] as const, 'cast');
        const cue = enumParam(params, 'cue', path, ['charge', 'cast', 'impact', 'burst', 'pulse'] as const, 'cast') as WeaponAudioCue;
        const intensity = numberParam(params, 'intensity', path, 0.1, 1, 0.6);
        const signal = Object.freeze({ kind: 'audio' as const, cue, intensity });
        return Object.freeze<ResolvedWeaponFeedbackEffect>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.AUDIO_CUE,
          event,
          estimatedCost: 0.08,
          emit() {
            eventBus.emit(GameEvent.WEAPON_FEEDBACK, signal);
          },
        });
      },
    }));

    api.weaponFeedbackEffects.register(CoreAdvancedWeaponPrimitiveId.CAMERA_IMPULSE, Object.freeze<WeaponFeedbackPrimitive>({
      descriptor: descriptor(
        CoreAdvancedWeaponPrimitiveId.CAMERA_IMPULSE, 'feedback', '镜头冲击',
        '向镜头系统发送受限时长与强度的震动请求。', cameraImpulseSchema,
        { category: 'constant', baseCost: 0.08, variableCosts: ['event', 'intensity'] }, ['feedback', 'camera']
      ),
      compile(params, path) {
        assertClosed(params, cameraImpulseSchema, path);
        const event = enumParam(params, 'event', path, ['charge', 'cast', 'hit', 'kill', 'expire'] as const, 'hit');
        const duration = numberParam(params, 'duration', path, 0.02, 0.4);
        const intensity = numberParam(params, 'intensity', path, 0.1, 12);
        const signal = Object.freeze({ kind: 'camera' as const, duration, intensity });
        return Object.freeze<ResolvedWeaponFeedbackEffect>({
          primitiveId: CoreAdvancedWeaponPrimitiveId.CAMERA_IMPULSE,
          event,
          estimatedCost: 0.08,
          emit() {
            eventBus.emit(GameEvent.WEAPON_FEEDBACK, signal);
          },
        });
      },
    }));
  },
});
