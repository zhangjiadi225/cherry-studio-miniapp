import { GenericModifierType, WeaponType } from '../../types';
import { eventBus, GameEvent } from '../../events';
import { GENERIC_MODIFIER_DATA } from '../../constants';

type OscillatorKind = OscillatorType;

export const MUTE_STORAGE_KEY = 'survivor_audio_muted';

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private muted: boolean;
  private readonly unsubs: Array<() => void> = [];
  private readonly modifierSoundTimes = new Map<GenericModifierType, number>();

  constructor(muted = false) {
    this.muted = muted;
    this.unsubs.push(
      eventBus.on(GameEvent.PLAYER_HIT, () => this.playHit()),
      eventBus.on(GameEvent.ENEMY_DEATH, () => this.playDeath()),
      eventBus.on(GameEvent.PLAYER_LEVEL_UP, () => this.playLevelUp()),
      eventBus.on(GameEvent.XP_COLLECTED, () => this.playXp()),
      eventBus.on(GameEvent.BOSS_WARNING, () => this.playBossWarning()),
      eventBus.on(GameEvent.WEAPON_FIRE, (weaponType) => this.playWeaponFire(weaponType)),
      eventBus.on(GameEvent.MODIFIER_TRIGGER, (modifierType) => this.playModifierTrigger(modifierType))
    );
  }

  destroy() {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.context?.close();
    this.context = undefined;
    this.master = undefined;
  }

  isMuted() {
    return this.muted;
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!muted) void this.ensureContext()?.resume();
  }

  suspend() {
    void this.context?.suspend();
  }

  private ensureContext() {
    if (this.context) return this.context;
    const AudioCtor = window.AudioContext || (window as Window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioCtor) return undefined;

    const context = new AudioCtor();
    const master = context.createGain();
    master.gain.value = 0.18;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    return context;
  }

  private playWeaponFire(weaponType: WeaponType) {
    if (this.muted) return;
    switch (weaponType) {
      case WeaponType.MAGIC_WAND:
        this.playTone(660, 0.055, 'triangle', 0.08);
        break;
      case WeaponType.FIRE_WAND:
        this.playSweep(220, 130, 0.12, 'sawtooth', 0.09);
        break;
      case WeaponType.AXE:
        this.playSweep(190, 90, 0.09, 'square', 0.06);
        break;
      case WeaponType.RUNE_LANCE:
        this.playSweep(760, 420, 0.06, 'triangle', 0.055);
        break;
      case WeaponType.MOON_BLADE:
        this.playSweep(520, 700, 0.07, 'sine', 0.05);
        break;
      case WeaponType.LIGHTNING:
        this.playTone(900, 0.04, 'square', 0.07);
        this.playTone(1220, 0.035, 'square', 0.05, 0.025);
        break;
      case WeaponType.WHIP:
        this.playSweep(520, 240, 0.07, 'triangle', 0.07);
        break;
      case WeaponType.BIBLE:
        this.playTone(360, 0.08, 'sine', 0.055);
        break;
      case WeaponType.HOLY_WATER:
        this.playTone(480, 0.08, 'sine', 0.045);
        this.playTone(610, 0.07, 'triangle', 0.035, 0.03);
        break;
      case WeaponType.GARLIC:
        this.playTone(180, 0.05, 'sine', 0.025);
        break;
    }
  }

  private playXp() {
    if (this.muted) return;
    this.playTone(740, 0.045, 'triangle', 0.035);
  }

  private playModifierTrigger(modifierType: GenericModifierType) {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context || !this.master) return;
    const now = context.currentTime;
    const last = this.modifierSoundTimes.get(modifierType) ?? -Infinity;
    if (now - last < 0.09) return;
    this.modifierSoundTimes.set(modifierType, now);

    switch (GENERIC_MODIFIER_DATA[modifierType].visual.audio) {
      case 'rush':
        this.playSweep(980, 740, 0.055, 'sine', 0.035);
        break;
      case 'echo':
        this.playTone(780, 0.045, 'triangle', 0.04);
        this.playTone(1040, 0.04, 'triangle', 0.032, 0.035);
        break;
      case 'crack':
        this.playSweep(620, 340, 0.065, 'square', 0.04);
        break;
      case 'chain':
        this.playTone(920, 0.035, 'square', 0.035);
        this.playTone(1280, 0.035, 'square', 0.028, 0.03);
        break;
      case 'pulse':
        this.playSweep(280, 150, 0.08, 'sine', 0.045);
        break;
      case 'push':
        this.playSweep(190, 95, 0.07, 'triangle', 0.038);
        break;
      case 'burst':
        this.playSweep(270, 95, 0.09, 'sawtooth', 0.05);
        break;
    }
  }

  private playHit() {
    if (this.muted) return;
    this.playSweep(150, 70, 0.12, 'sawtooth', 0.1);
  }

  private playDeath() {
    if (this.muted) return;
    this.playSweep(260, 120, 0.08, 'triangle', 0.05);
  }

  private playLevelUp() {
    if (this.muted) return;
    this.playTone(523, 0.09, 'triangle', 0.07);
    this.playTone(659, 0.09, 'triangle', 0.07, 0.08);
    this.playTone(784, 0.12, 'triangle', 0.08, 0.16);
  }

  private playBossWarning() {
    if (this.muted) return;
    this.playSweep(110, 70, 0.22, 'sawtooth', 0.12);
    this.playSweep(110, 70, 0.22, 'sawtooth', 0.1, 0.28);
  }

  private playTone(frequency: number, duration: number, type: OscillatorKind, volume: number, delay = 0) {
    const context = this.ensureContext();
    if (!context || !this.master) return;
    void context.resume();

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private playSweep(
    from: number,
    to: number,
    duration: number,
    type: OscillatorKind,
    volume: number,
    delay = 0
  ) {
    const context = this.ensureContext();
    if (!context || !this.master) return;
    void context.resume();

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
