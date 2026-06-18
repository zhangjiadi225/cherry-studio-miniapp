import type { Enemy, GameState, UpgradeOption, WeaponType } from '../types';
import { GameEvent } from './GameEvents';

export interface GameEventMap {
  [GameEvent.STATE_CHANGE]: [state: GameState, previous: GameState];
  [GameEvent.GAME_START]: [];
  [GameEvent.GAME_OVER]: [stats: { time: number; kills: number; level: number }];
  [GameEvent.PLAYER_HIT]: [damage: number, enemy: Enemy];
  [GameEvent.PLAYER_DEATH]: [];
  [GameEvent.PLAYER_LEVEL_UP]: [level: number];
  [GameEvent.ENEMY_DEATH]: [enemy: Enemy];
  [GameEvent.ENEMY_SPAWN]: [enemy: Enemy];
  [GameEvent.BOSS_WARNING]: [bossName: string, bossTime: number];
  [GameEvent.BOSS_SPAWN]: [boss: Enemy];
  [GameEvent.BOSS_DEATH]: [boss: Enemy];
  [GameEvent.WEAPON_FIRE]: [weaponType: WeaponType];
  [GameEvent.XP_COLLECTED]: [amount: number];
  [GameEvent.UPGRADE_SELECT]: [option: UpgradeOption];
  [GameEvent.PAUSE]: [];
  [GameEvent.RESUME]: [];
}

export type EventCallback<Args extends unknown[]> = (...args: Args) => void;

export class EventBus<EventMap extends { [K in keyof EventMap]: unknown[] } = GameEventMap> {
  private listeners = new Map<keyof EventMap, Set<EventCallback<EventMap[keyof EventMap]>>>();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    let set = this.listeners.get(event) as Set<EventCallback<EventMap[K]>> | undefined;
    if (!set) {
      set = new Set();
      this.listeners.set(event, set as Set<EventCallback<EventMap[keyof EventMap]>>);
    }
    set.add(callback);
    return () => set!.delete(callback);
  }

  once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    const unsub = this.on(event, (...args) => {
      unsub();
      callback(...args);
    });
    return unsub;
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]) {
    const set = this.listeners.get(event) as Set<EventCallback<EventMap[K]>> | undefined;
    if (set) {
      for (const cb of set) cb(...args);
    }
  }

  off<K extends keyof EventMap>(event: K, callback?: EventCallback<EventMap[K]>) {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      const set = this.listeners.get(event) as Set<EventCallback<EventMap[K]>> | undefined;
      set?.delete(callback);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus<GameEventMap>();
