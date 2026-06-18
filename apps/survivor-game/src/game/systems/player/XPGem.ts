import { XPGem, Player } from '../../types';
import { XP_SMALL, XP_MEDIUM, XP_LARGE, XP_MAGNET_SPEED, GEM_LIFETIME, GEM_ATTRACT_RANGE } from '../../constants';
import { dist } from '../../utils/math';
import { pools } from '../../utils/PoolManager';

export function createXPGem(x: number, y: number, value: number): XPGem {
  const gem = pools.xpGems.acquire();
  let type: 'small' | 'medium' | 'large' = 'small';
  let radius = 4;
  if (value >= XP_LARGE) { type = 'large'; radius = 8; }
  else if (value >= XP_MEDIUM) { type = 'medium'; radius = 6; }

  gem.x = x;
  gem.y = y;
  gem.value = value;
  gem.radius = radius;
  gem.magnetized = false;
  gem.life = GEM_LIFETIME;
  gem.animTimer = Math.random() * Math.PI * 2;
  gem.type = type;
  return gem;
}

export function updateXPGem(
  gem: XPGem,
  player: Player,
  dt: number,
  hasMagnet: boolean
): { collected: boolean; value: number } {
  gem.life -= dt;
  gem.animTimer += dt * 4;
  if (gem.life <= 0) return { collected: false, value: 0 };

  const d = dist(gem, player);
  const attractRange = player.pickupRange + GEM_ATTRACT_RANGE;

  if (d < GEM_ATTRACT_RANGE || (hasMagnet && d < attractRange * 3) || gem.magnetized) {
    gem.magnetized = true;
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) {
      const speed = XP_MAGNET_SPEED * (gem.magnetized ? 2 : 1);
      gem.x += (dx / len) * speed * dt;
      gem.y += (dy / len) * speed * dt;
    }
    if (d < player.radius + gem.radius) {
      return { collected: true, value: gem.value };
    }
  } else if (d < attractRange) {
    gem.magnetized = true;
  }

  return { collected: false, value: 0 };
}
