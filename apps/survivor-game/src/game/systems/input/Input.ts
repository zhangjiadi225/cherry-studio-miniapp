import type { TouchJoystickState } from '../../types';

const TOUCH_DEAD_ZONE = 15;
const TOUCH_MAX_RADIUS = 58;

export class Input {
  keys = new Set<string>();
  private touchStart: { x: number; y: number } | null = null;
  private touchCurrent: { x: number; y: number } | null = null;
  touchDir = { x: 0, y: 0 };
  isTouching = false;
  touchTap = false;
  private canvas: HTMLCanvasElement;
  private readonly handleKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  private readonly handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private readonly handleBlur = () => this.reset();
  private readonly handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.touchStart = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    this.touchCurrent = { ...this.touchStart };
    this.isTouching = true;
    this.touchTap = true;
  };
  private readonly handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.touchStart) return;
    const t = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.touchCurrent = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    this.touchTap = false;
  };
  private readonly handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    this.resetTouch();
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.reset();
  }

  reset() {
    this.keys.clear();
    this.resetTouch();
  }

  private resetTouch() {
    this.touchStart = null;
    this.touchCurrent = null;
    this.isTouching = false;
    this.touchDir = { x: 0, y: 0 };
  }

  private getTouchVector() {
    if (!this.touchStart || !this.touchCurrent) {
      return { dx: 0, dy: 0, distance: 0, dirX: 0, dirY: 0 };
    }
    const dx = this.touchCurrent.x - this.touchStart.x;
    const dy = this.touchCurrent.y - this.touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const active = distance > TOUCH_DEAD_ZONE;
    return {
      dx,
      dy,
      distance,
      dirX: active ? dx / distance : 0,
      dirY: active ? dy / distance : 0,
    };
  }

  getMoveDir(): { x: number; y: number } {
    let kx = 0, ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      return { x: kx / len, y: ky / len };
    }

    const touch = this.getTouchVector();
    this.touchDir = { x: touch.dirX, y: touch.dirY };
    if (touch.distance > TOUCH_DEAD_ZONE) {
      return { x: touch.dirX, y: touch.dirY };
    }

    return { x: 0, y: 0 };
  }

  getJoystickState(): TouchJoystickState {
    if (!this.touchStart || !this.touchCurrent || !this.isTouching) {
      return {
        active: false,
        startX: 0,
        startY: 0,
        knobX: 0,
        knobY: 0,
        dirX: 0,
        dirY: 0,
        distance: 0,
        maxRadius: TOUCH_MAX_RADIUS,
      };
    }

    const touch = this.getTouchVector();
    const clampedDistance = Math.min(touch.distance, TOUCH_MAX_RADIUS);
    const knobX = this.touchStart.x + touch.dirX * clampedDistance;
    const knobY = this.touchStart.y + touch.dirY * clampedDistance;
    return {
      active: true,
      startX: this.touchStart.x,
      startY: this.touchStart.y,
      knobX: touch.distance > TOUCH_DEAD_ZONE ? knobX : this.touchStart.x,
      knobY: touch.distance > TOUCH_DEAD_ZONE ? knobY : this.touchStart.y,
      dirX: touch.dirX,
      dirY: touch.dirY,
      distance: clampedDistance,
      maxRadius: TOUCH_MAX_RADIUS,
    };
  }

  consumeTap(): boolean {
    if (this.touchTap) {
      this.touchTap = false;
      return true;
    }
    return false;
  }
}
