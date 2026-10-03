export const WORLD_W = 1280;
export const WORLD_H = 720;

/** Canvas plein écran mis à l'échelle sur un monde logique 1280×720 (letterbox), HiDPI jusqu'à 2×. */
export class GameCanvas {
  readonly el: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  /** Largeur/hauteur visibles en unités monde (peut dépasser 1280×720 pour couvrir l'écran). */
  viewW = WORLD_W;
  viewH = WORLD_H;
  private dpr = 1;
  private readonly onResize = () => this.resize();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('canvas');
    this.el.className = 'game-canvas';
    parent.appendChild(this.el);
    const ctx = this.el.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    window.addEventListener('resize', this.onResize);
    this.resize();
    // Le parent n'est pas forcément encore dans le DOM : on recalcule à la frame suivante.
    requestAnimationFrame(this.onResize);
    if (typeof ResizeObserver !== 'undefined' && parent) {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(parent);
    }
  }

  private observer: ResizeObserver | null = null;

  resize(): void {
    const rect = this.el.parentElement?.getBoundingClientRect();
    const w = Math.max(320, rect && rect.width > 0 ? rect.width : window.innerWidth);
    const h = Math.max(240, rect && rect.height > 0 ? rect.height : window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.el.width = Math.round(w * this.dpr);
    this.el.height = Math.round(h * this.dpr);
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    // On garde la hauteur du monde (720) visible en entier ; la largeur s'adapte (portrait = plus étroit).
    this.scale = Math.min(w / WORLD_W, h / WORLD_H);
    const portrait = h > w;
    if (portrait) this.scale = w / Math.min(WORLD_W, Math.max(720, w * (WORLD_H / h)));
    this.viewW = w / this.scale;
    this.viewH = h / this.scale;
    this.offsetX = (this.viewW - WORLD_W) / 2;
    this.offsetY = (this.viewH - WORLD_H) / 2;
  }

  /** Prépare la transformation monde → écran pour une frame. */
  begin(): CanvasRenderingContext2D {
    const c = this.ctx;
    c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    c.translate(this.offsetX, this.offsetY);
    return c;
  }

  /** Convertit une position client (pointer) en coordonnées monde. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.el.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale - this.offsetX,
      y: (clientY - rect.top) / this.scale - this.offsetY,
    };
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.el.remove();
  }
}
