import type { WeaponFireContext } from '../../behaviors/weapon/WeaponBehavior';
import type { Enemy } from '../../types';
import type { WeaponRuntimePlan } from './WeaponRuntimePlan';

const targetScratch: Enemy[] = [];
const originScratch = { x: 0, y: 0 };

export interface ProjectileRecipeRuntimeAdapter {
  spawn(
    context: WeaponFireContext,
    plan: WeaponRuntimePlan,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius: number,
    lifetime: number,
    pierce: number,
    knockback: number
  ): boolean;
}

export function fireProjectileRecipe(
  context: WeaponFireContext,
  adapter: ProjectileRecipeRuntimeAdapter
): boolean {
  const { weapon, player, damage, enemyQuery } = context;
  const plan = weapon.runtimePlan;
  if (!plan) return false;
  if (plan.emission.burstCount !== 1 || plan.emission.burstInterval !== 0) return false;

  const count = plan.emission.count;
  const targetCount = plan.targeting.select(player, enemyQuery, count, targetScratch);
  let fired = false;
  for (let i = 0; i < count; i++) {
    const target = targetCount > 0 ? targetScratch[i % targetCount] : undefined;
    plan.emission.origin.resolve(player, i, count, originScratch);
    const fallbackAngle = plan.targeting.fallback === 'forward'
      ? (player.facingLeft ? Math.PI : 0)
      : (i / count) * Math.PI * 2 + player.animTimer * 0.1;
    const baseAngle = target
      ? Math.atan2(target.y - originScratch.y, target.x - originScratch.x)
      : fallbackAngle;
    const angle = plan.emission.pattern.resolveAngle(baseAngle, i, count);
    fired = adapter.spawn(
      context,
      plan,
      originScratch.x,
      originScratch.y,
      Math.cos(angle) * plan.projectile.speed,
      Math.sin(angle) * plan.projectile.speed,
      damage,
      plan.projectile.radius * player.area,
      plan.projectile.lifetime,
      plan.projectile.pierce,
      plan.projectile.knockback
    ) || fired;
  }
  return fired;
}
