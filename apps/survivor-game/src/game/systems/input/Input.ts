export class Input {
  keys = new Set<string>();
  private touchStart: { x: number; y: number } | null = null;
  private touchCurrent: { x: number; y: number } | null = null;
  touchDir = { x: 0, y: 0 };
  isTouching = false;
  touchTap = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touchStart = null;
      this.touchCurrent = null;
      this.isTouching = false;
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchStart = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      this.touchCurrent = { ...this.touchStart };
      this.isTouching = true;
      this.touchTap = true;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.touchStart) return;
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchCurrent = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      this.touchTap = false;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.touchStart = null;
      this.touchCurrent = null;
      this.isTouching = false;
    }, { passive: false });
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

    if (this.touchStart && this.touchCurrent) {
      const dx = this.touchCurrent.x - this.touchStart.x;
      const dy = this.touchCurrent.y - this.touchStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 15) {
        return { x: dx / len, y: dy / len };
      }
    }

    return { x: 0, y: 0 };
  }

  consumeTap(): boolean {
    if (this.touchTap) {
      this.touchTap = false;
      return true;
    }
    return false;
  }
}
