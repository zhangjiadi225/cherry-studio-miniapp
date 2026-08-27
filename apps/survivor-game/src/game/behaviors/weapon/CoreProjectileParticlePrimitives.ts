import { MAX_ACTIVE_PARTICLES } from '../../constants';
import { createParticle } from '../../effects/Particle';
import type { PrimitiveParamsV1 } from '../../recipes/weapon/WeaponRecipe';
import {
  WeaponPrimitiveParameterError,
  type PrimitiveParameterSchemaV1,
  type ProjectileParticlePrimitive,
  type ResolvedProjectileParticleEffect,
  type WeaponPrimitiveDescriptorV1,
} from '../../recipes/weapon/WeaponRuntimePlan';
import type { EnginePlugin } from '../EngineRegistry';

export const CoreProjectileParticlePrimitiveId = {
  TRAIL: 'builtin.particle.trail',
  HIT_BURST: 'builtin.particle.hit-burst',
  EXPLOSION: 'builtin.particle.explosion',
  TELEGRAPH: 'builtin.particle.telegraph',
  SHOCKWAVE: 'builtin.particle.shockwave',
} as const;

type ColorSlot = 'primary' | 'secondary' | 'accent';
type ParticleShape = 'circle' | 'square' | 'star' | 'spark';

function freezeSchema(schema: PrimitiveParameterSchemaV1): PrimitiveParameterSchemaV1 {
  return Object.freeze({
    ...schema,
    allowedKeys: Object.freeze([...schema.allowedKeys]),
    requiredKeys: Object.freeze([...schema.requiredKeys]),
    numericBounds: Object.freeze(Object.fromEntries(
      Object.entries(schema.numericBounds).map(([key, bounds]) => [key, Object.freeze({ ...bounds })])
    )),
    enumValues: Object.freeze(Object.fromEntries(
      Object.entries(schema.enumValues).map(([key, values]) => [key, Object.freeze([...values])])
    )),
    booleanKeys: Object.freeze([...schema.booleanKeys]),
  });
}

function schema(
  schemaId: string,
  allowedKeys: readonly string[],
  numericBounds: PrimitiveParameterSchemaV1['numericBounds'],
  enumValues: PrimitiveParameterSchemaV1['enumValues'],
  booleanKeys: readonly string[] = []
): PrimitiveParameterSchemaV1 {
  return {
    schemaId,
    allowedKeys,
    requiredKeys: [],
    numericBounds,
    enumValues,
    booleanKeys,
  };
}

function descriptor(
  id: string,
  name: string,
  description: string,
  parameterSchema: PrimitiveParameterSchemaV1,
  category: WeaponPrimitiveDescriptorV1['budget']['category'],
  baseCost: number,
  variableCosts: readonly string[],
  tags: readonly string[]
): WeaponPrimitiveDescriptorV1 {
  return Object.freeze({
    id,
    version: '1.0.0',
    kind: 'particle',
    name,
    description,
    parameterSchema: freezeSchema(parameterSchema),
    compatibility: Object.freeze({
      requires: Object.freeze([]),
      conflictsWith: Object.freeze([]),
      tags: Object.freeze(['projectile', 'visual-only', ...tags]),
    }),
    budget: Object.freeze({
      category,
      baseCost,
      variableCosts: Object.freeze([...variableCosts]),
    }),
  });
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
}

function readNumber(
  params: PrimitiveParamsV1,
  key: string,
  path: string,
  min: number,
  max: number,
  fallback: number,
  integer = false
): number {
  const value = params[key] ?? fallback;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM',
      `${path}.${key}`,
      `expected ${integer ? 'integer ' : ''}${min}..${max}`
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
  const value = params[key] ?? fallback;
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
  const value = params[key] ?? fallback;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new WeaponPrimitiveParameterError(
      'INVALID_PRIMITIVE_PARAM',
      `${path}.${key}`,
      `expected ${values.join('|')}`
    );
  }
  return value as T;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function paletteColor(
  palette: { readonly primary: string; readonly secondary?: string; readonly accent?: string },
  slot: ColorSlot
): string {
  return palette[slot] ?? palette.primary;
}

function pushParticle(
  context: Parameters<ResolvedProjectileParticleEffect['emit']>[0],
  color: string,
  shape: ParticleShape,
  angle: number,
  speed: number,
  lifetime: number,
  radius: number,
  glow: boolean,
  random: () => number
): void {
  if (context.particles.length >= MAX_ACTIVE_PARTICLES) return;
  context.particles.push(createParticle(
    context.x,
    context.y,
    color,
    speed,
    lifetime,
    radius,
    {
      type: shape,
      angle,
      minSpeed: speed,
      maxSpeed: speed,
      glow,
      glowRadius: radius * 4,
      rotSpeed: (random() * 2 - 1) * 5,
      random,
    }
  ));
}

const colorSlots = ['primary', 'secondary', 'accent'] as const;
const particleShapes = ['circle', 'square', 'star', 'spark'] as const;

const trailSchema = schema(
  'builtin.schema.particle.trail.v1',
  ['colorSlot', 'shape', 'rate', 'count', 'speed', 'lifetime', 'radius', 'spreadRadians', 'glow'],
  {
    rate: { min: 1, max: 30 },
    count: { min: 1, max: 4 },
    speed: { min: 0, max: 120 },
    lifetime: { min: 0.05, max: 1 },
    radius: { min: 0.5, max: 8 },
    spreadRadians: { min: 0, max: Math.PI * 2 },
  },
  { colorSlot: colorSlots, shape: particleShapes },
  ['glow']
);

const hitBurstSchema = schema(
  'builtin.schema.particle.hit-burst.v1',
  ['colorSlot', 'shape', 'count', 'speed', 'lifetime', 'radius', 'glow'],
  {
    count: { min: 1, max: 16 },
    speed: { min: 0, max: 400 },
    lifetime: { min: 0.05, max: 1.5 },
    radius: { min: 0.5, max: 12 },
  },
  { colorSlot: colorSlots, shape: particleShapes },
  ['glow']
);

const explosionSchema = schema(
  'builtin.schema.particle.explosion.v1',
  ['event', 'colorSlot', 'innerColorSlot', 'shape', 'count', 'ringCount', 'speed', 'lifetime', 'radius', 'glow'],
  {
    count: { min: 4, max: 32 },
    ringCount: { min: 0, max: 16 },
    speed: { min: 0, max: 500 },
    lifetime: { min: 0.1, max: 2 },
    radius: { min: 1, max: 16 },
  },
  {
    event: ['kill', 'expire'],
    colorSlot: colorSlots,
    innerColorSlot: colorSlots,
    shape: particleShapes,
  },
  ['glow']
);

const telegraphSchema = schema(
  'builtin.schema.particle.telegraph.v1',
  ['colorSlot', 'count', 'ringRadius', 'lifetime', 'particleRadius', 'glow'],
  {
    count: { min: 4, max: 24 },
    ringRadius: { min: 8, max: 320 },
    lifetime: { min: 0.05, max: 2 },
    particleRadius: { min: 0.5, max: 10 },
  },
  { colorSlot: colorSlots },
  ['glow']
);

const shockwaveSchema = schema(
  'builtin.schema.particle.shockwave.v1',
  ['event', 'colorSlot', 'count', 'speed', 'lifetime', 'radius', 'glow'],
  {
    count: { min: 4, max: 24 },
    speed: { min: 20, max: 500 },
    lifetime: { min: 0.05, max: 1.5 },
    radius: { min: 0.5, max: 14 },
  },
  { event: ['hit', 'kill', 'expire'], colorSlot: colorSlots },
  ['glow']
);

export const CORE_PROJECTILE_PARTICLE_PLUGIN: EnginePlugin = Object.freeze<EnginePlugin>({
  id: 'builtin.plugin.projectile-particles',
  version: '1.0.0',
  register(api) {
    api.projectileParticleEffects.register(
      CoreProjectileParticlePrimitiveId.TRAIL,
      Object.freeze<ProjectileParticlePrimitive>({
        descriptor: descriptor(
          CoreProjectileParticlePrimitiveId.TRAIL,
          '弹体拖尾',
          '按受限频率在弹体后方发射纯视觉粒子。',
          trailSchema,
          'per-projectile',
          0.2,
          ['rate', 'count', 'lifetime'],
          ['trail']
        ),
        compile(params, path) {
          assertClosedParams(params, trailSchema, path);
          const colorSlot = readEnum(params, 'colorSlot', path, colorSlots, 'primary');
          const shape = readEnum(params, 'shape', path, particleShapes, 'circle');
          const rate = readNumber(params, 'rate', path, 1, 30, 12);
          const count = readNumber(params, 'count', path, 1, 4, 1, true);
          const speed = readNumber(params, 'speed', path, 0, 120, 24);
          const lifetime = readNumber(params, 'lifetime', path, 0.05, 1, 0.24);
          const radius = readNumber(params, 'radius', path, 0.5, 8, 1.8);
          const spread = readNumber(params, 'spreadRadians', path, 0, Math.PI * 2, 0.8);
          const glow = readBoolean(params, 'glow', path, true);
          return Object.freeze<ResolvedProjectileParticleEffect>({
            primitiveId: CoreProjectileParticlePrimitiveId.TRAIL,
            event: 'trail',
            emissionInterval: 1 / rate,
            particlesPerEmission: count,
            maxParticleLifetime: lifetime,
            emit(context) {
              const random = seededRandom(context.seed);
              const hasVelocity = Math.abs(context.projectile.vx) + Math.abs(context.projectile.vy) > 0.0001;
              const headingAngle = hasVelocity
                ? Math.atan2(context.projectile.vy, context.projectile.vx)
                : context.projectile.headingAngle ?? 0;
              const baseAngle = headingAngle + Math.PI;
              for (let index = 0; index < count; index++) {
                const offset = count === 1 ? 0 : spread * (index / (count - 1) - 0.5);
                pushParticle(
                  context,
                  paletteColor(context.palette, colorSlot),
                  shape,
                  baseAngle + offset,
                  speed * (0.75 + random() * 0.25),
                  lifetime,
                  radius,
                  glow,
                  random
                );
              }
            },
          });
        },
      })
    );

    api.projectileParticleEffects.register(
      CoreProjectileParticlePrimitiveId.HIT_BURST,
      Object.freeze<ProjectileParticlePrimitive>({
        descriptor: descriptor(
          CoreProjectileParticlePrimitiveId.HIT_BURST,
          '命中爆散',
          '命中敌人时均匀发射一组纯视觉粒子。',
          hitBurstSchema,
          'per-hit',
          0.25,
          ['count', 'lifetime'],
          ['hit']
        ),
        compile(params, path) {
          assertClosedParams(params, hitBurstSchema, path);
          const colorSlot = readEnum(params, 'colorSlot', path, colorSlots, 'accent');
          const shape = readEnum(params, 'shape', path, particleShapes, 'spark');
          const count = readNumber(params, 'count', path, 1, 16, 6, true);
          const speed = readNumber(params, 'speed', path, 0, 400, 150);
          const lifetime = readNumber(params, 'lifetime', path, 0.05, 1.5, 0.4);
          const radius = readNumber(params, 'radius', path, 0.5, 12, 2.5);
          const glow = readBoolean(params, 'glow', path, true);
          return Object.freeze<ResolvedProjectileParticleEffect>({
            primitiveId: CoreProjectileParticlePrimitiveId.HIT_BURST,
            event: 'hit',
            emissionInterval: 0,
            particlesPerEmission: count,
            maxParticleLifetime: lifetime,
            emit(context) {
              const random = seededRandom(context.seed);
              const phase = random() * Math.PI * 2;
              for (let index = 0; index < count; index++) {
                pushParticle(
                  context,
                  paletteColor(context.palette, colorSlot),
                  shape,
                  phase + (index / count) * Math.PI * 2,
                  speed * (0.65 + random() * 0.35),
                  lifetime,
                  radius,
                  glow,
                  random
                );
              }
            },
          });
        },
      })
    );

    api.projectileParticleEffects.register(
      CoreProjectileParticlePrimitiveId.EXPLOSION,
      Object.freeze<ProjectileParticlePrimitive>({
        descriptor: descriptor(
          CoreProjectileParticlePrimitiveId.EXPLOSION,
          '事件爆炸',
          '在弹体到期或击杀时发射带内环的纯视觉爆炸，不产生伤害。',
          explosionSchema,
          'per-projectile',
          0.35,
          ['count', 'ringCount', 'lifetime'],
          ['kill', 'expire', 'explosion']
        ),
        compile(params, path) {
          assertClosedParams(params, explosionSchema, path);
          const event = readEnum(params, 'event', path, ['kill', 'expire'] as const, 'expire');
          const colorSlot = readEnum(params, 'colorSlot', path, colorSlots, 'accent');
          const innerColorSlot = readEnum(params, 'innerColorSlot', path, colorSlots, 'secondary');
          const shape = readEnum(params, 'shape', path, particleShapes, 'spark');
          const count = readNumber(params, 'count', path, 4, 32, 16, true);
          const ringCount = readNumber(params, 'ringCount', path, 0, 16, 6, true);
          if (ringCount > count) {
            throw new WeaponPrimitiveParameterError(
              'INVALID_PRIMITIVE_PARAM',
              `${path}.ringCount`,
              'ringCount cannot exceed count'
            );
          }
          const speed = readNumber(params, 'speed', path, 0, 500, 190);
          const lifetime = readNumber(params, 'lifetime', path, 0.1, 2, 0.6);
          const radius = readNumber(params, 'radius', path, 1, 16, 3.5);
          const glow = readBoolean(params, 'glow', path, true);
          return Object.freeze<ResolvedProjectileParticleEffect>({
            primitiveId: CoreProjectileParticlePrimitiveId.EXPLOSION,
            event,
            emissionInterval: 0,
            particlesPerEmission: count,
            maxParticleLifetime: lifetime,
            emit(context) {
              const random = seededRandom(context.seed);
              const phase = random() * Math.PI * 2;
              for (let index = 0; index < count; index++) {
                const inRing = index < ringCount;
                pushParticle(
                  context,
                  paletteColor(context.palette, inRing ? innerColorSlot : colorSlot),
                  shape,
                  phase + (index / count) * Math.PI * 2,
                  speed * (inRing ? 0.72 : 0.7 + random() * 0.3),
                  lifetime * (inRing ? 0.72 : 1),
                  radius * (inRing ? 1.35 : 1),
                  glow,
                  random
                );
              }
            },
          });
        },
      })
    );

    api.projectileParticleEffects.register(
      CoreProjectileParticlePrimitiveId.TELEGRAPH,
      Object.freeze<ProjectileParticlePrimitive>({
        descriptor: descriptor(
          CoreProjectileParticlePrimitiveId.TELEGRAPH,
          '落点预警',
          '弹体生成时在落点绘制由有限粒子组成的纯视觉预警环。',
          telegraphSchema,
          'per-projectile',
          0.3,
          ['count', 'lifetime'],
          ['spawn', 'telegraph']
        ),
        compile(params, path) {
          assertClosedParams(params, telegraphSchema, path);
          const colorSlot = readEnum(params, 'colorSlot', path, colorSlots, 'accent');
          const count = readNumber(params, 'count', path, 4, 24, 12, true);
          const ringRadius = readNumber(params, 'ringRadius', path, 8, 320, 48);
          const lifetime = readNumber(params, 'lifetime', path, 0.05, 2, 0.35);
          const radius = readNumber(params, 'particleRadius', path, 0.5, 10, 2);
          const glow = readBoolean(params, 'glow', path, true);
          return Object.freeze<ResolvedProjectileParticleEffect>({
            primitiveId: CoreProjectileParticlePrimitiveId.TELEGRAPH,
            event: 'spawn',
            emissionInterval: 0,
            particlesPerEmission: count,
            maxParticleLifetime: lifetime,
            emit(context) {
              const random = seededRandom(context.seed);
              const phase = random() * Math.PI * 2;
              for (let index = 0; index < count; index++) {
                if (context.particles.length >= MAX_ACTIVE_PARTICLES) break;
                const angle = phase + index / count * Math.PI * 2;
                const particle = createParticle(
                  context.x + Math.cos(angle) * ringRadius,
                  context.y + Math.sin(angle) * ringRadius,
                  paletteColor(context.palette, colorSlot),
                  0,
                  lifetime,
                  radius,
                  {
                    type: 'circle', minSpeed: 0, maxSpeed: 0, glow,
                    glowRadius: radius * 4, rotSpeed: 0, random,
                  }
                );
                context.particles.push(particle);
              }
            },
          });
        },
      })
    );

    api.projectileParticleEffects.register(
      CoreProjectileParticlePrimitiveId.SHOCKWAVE,
      Object.freeze<ProjectileParticlePrimitive>({
        descriptor: descriptor(
          CoreProjectileParticlePrimitiveId.SHOCKWAVE,
          '冲击波',
          '在命中、击杀或到期时径向发射一圈纯视觉粒子。',
          shockwaveSchema,
          'per-hit',
          0.34,
          ['count', 'lifetime'],
          ['shockwave']
        ),
        compile(params, path) {
          assertClosedParams(params, shockwaveSchema, path);
          const event = readEnum(params, 'event', path, ['hit', 'kill', 'expire'] as const, 'hit');
          const colorSlot = readEnum(params, 'colorSlot', path, colorSlots, 'accent');
          const count = readNumber(params, 'count', path, 4, 24, 12, true);
          const speed = readNumber(params, 'speed', path, 20, 500, 180);
          const lifetime = readNumber(params, 'lifetime', path, 0.05, 1.5, 0.35);
          const radius = readNumber(params, 'radius', path, 0.5, 14, 2.5);
          const glow = readBoolean(params, 'glow', path, true);
          return Object.freeze<ResolvedProjectileParticleEffect>({
            primitiveId: CoreProjectileParticlePrimitiveId.SHOCKWAVE,
            event,
            emissionInterval: 0,
            particlesPerEmission: count,
            maxParticleLifetime: lifetime,
            emit(context) {
              const random = seededRandom(context.seed);
              const phase = random() * Math.PI * 2;
              for (let index = 0; index < count; index++) {
                pushParticle(
                  context,
                  paletteColor(context.palette, colorSlot),
                  'circle',
                  phase + index / count * Math.PI * 2,
                  speed,
                  lifetime,
                  radius,
                  glow,
                  random
                );
              }
            },
          });
        },
      })
    );
  },
});
