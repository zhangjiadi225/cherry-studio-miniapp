import { GameState } from '../types';
import { eventBus } from './EventBus';
import { GameEvent } from './GameEvents';

type Transition = {
  from: GameState[];
  to: GameState;
};

const TRANSITIONS: Record<string, Transition> = {
  start: { from: ['menu', 'gameover'], to: 'playing' },
  pause: { from: ['playing'], to: 'paused' },
  resume: { from: ['paused'], to: 'playing' },
  upgrade: { from: ['playing'], to: 'upgrading' },
  finishUpgrade: { from: ['upgrading'], to: 'playing' },
  die: { from: ['playing'], to: 'gameover' },
  timeout: { from: ['playing'], to: 'gameover' },
  continueEndless: { from: ['gameover'], to: 'playing' },
};

export class GameStateMachine {
  private _state: GameState = 'menu';
  private _previous: GameState = 'menu';

  get state(): GameState { return this._state; }
  get previous(): GameState { return this._previous; }

  can(action: string): boolean {
    const t = TRANSITIONS[action];
    return t ? t.from.includes(this._state) : false;
  }

  transition(action: string): boolean {
    const t = TRANSITIONS[action];
    if (!t || !t.from.includes(this._state)) return false;
    this._previous = this._state;
    this._state = t.to;
    eventBus.emit(GameEvent.STATE_CHANGE, this._state, this._previous);
    return true;
  }

  is(state: GameState): boolean {
    return this._state === state;
  }

  reset() {
    this._previous = this._state;
    this._state = 'menu';
    eventBus.emit(GameEvent.STATE_CHANGE, this._state, this._previous);
  }
}

export const gameState = new GameStateMachine();
