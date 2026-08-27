import {
  Registry,
  assertStableId,
  type ReadonlyRegistry,
} from '../../content/registry/Registry';
import type { WeaponBehaviorHandler } from './weapon/WeaponBehavior';

export interface EnginePluginApi {
  readonly weaponBehaviors: Registry<WeaponBehaviorHandler>;
}

export interface EnginePlugin {
  readonly id: string;
  readonly version: string;
  register(api: EnginePluginApi): void;
}

export interface EngineRegistrySnapshot {
  readonly pluginIds: readonly string[];
  readonly weaponBehaviors: ReadonlyRegistry<WeaponBehaviorHandler>;
}

export function buildEngineRegistrySnapshot(
  plugins: readonly EnginePlugin[]
): EngineRegistrySnapshot {
  const pluginIds = new Set<string>();
  const weaponBehaviors = new Registry<WeaponBehaviorHandler>('weapon behaviors');
  const api: EnginePluginApi = Object.freeze({ weaponBehaviors });

  for (const plugin of plugins) {
    assertStableId(plugin.id);
    if (pluginIds.has(plugin.id)) {
      throw new Error(`Duplicate engine plugin ID: ${plugin.id}`);
    }
    pluginIds.add(plugin.id);
    plugin.register(api);
  }

  return Object.freeze({
    pluginIds: Object.freeze([...pluginIds]),
    weaponBehaviors: weaponBehaviors.freeze(),
  });
}
