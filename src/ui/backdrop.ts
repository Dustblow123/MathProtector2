import { WORLD_H, WORLD_W } from '../core/canvas';
import { Background } from '../render/background';
import type { NebulaSkin } from '../progression/cosmetics';

/** Fond animé (nébuleuse + étoiles) derrière les menus. */
export class MenuBackdrop {
  readonly el: HTMLCanvasElement;
  private readonly bg = new Background();
  private raf = 0;
  private last = 0;
  private running = false;
  reducedMotion = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('canvas');
    this.el.className = 'menu-backdrop';
    parent.appendChild(this.el);
  }

  setSkin(skin: NebulaSkin): void {
    this.bg.setSkin(skin);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private draw(dt: number): void {
    const w = this.el.clientWidth || window.innerWidth;
    const h = this.el.clientHeight || window.innerHeight;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    if (this.el.width !== Math.round(w * dpr) || this.el.height !== Math.round(h * dpr)) {
      this.el.width = Math.round(w * dpr);
      this.el.height = Math.round(h * dpr);
    }
    const c = this.el.getContext('2d');
    if (!c) return;
    const scale = Math.max(w / WORLD_W, h / WORLD_H);
    c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const viewW = w / scale;
    const viewH = h / scale;
    const ox = (viewW - WORLD_W) / 2;
    const oy = (viewH - WORLD_H) / 2;
    c.translate(ox, oy);
    this.bg.update(this.reducedMotion ? 0 : dt, this.reducedMotion);
    this.bg.draw(c, viewW, viewH, ox, oy, 0.1);
  }
}
