import { WORLD_H, WORLD_W } from '../core/canvas';
import { TAU } from '../core/math';
import { Rng } from '../core/rng';
import type { NebulaSkin } from '../progression/cosmetics';

interface Star {
  x: number;
  y: number;
  size: number;
  layer: number;
  phase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/** Fond spatial : nébuleuse pré-rendue + 3 couches d'étoiles en parallaxe + étoiles filantes. */
export class Background {
  private stars: Star[] = [];
  private shooting: ShootingStar[] = [];
  private nebula: HTMLCanvasElement | null = null;
  private skinKey = '';
  private t = 0;
  private rng = new Rng(1234);
  private starColor = '#ffffff';

  constructor() {
    const r = new Rng(99);
    for (let i = 0; i < 260; i++) {
      const layer = i < 150 ? 0 : i < 230 ? 1 : 2;
      this.stars.push({ x: r.range(0, WORLD_W * 1.6), y: r.range(0, WORLD_H * 1.4), size: layer === 0 ? r.range(0.6, 1.3) : layer === 1 ? r.range(1.2, 2) : r.range(2, 3), layer, phase: r.range(0, TAU) });
    }
  }

  setSkin(skin: NebulaSkin): void {
    const key = skin.palette.join('|');
    if (key === this.skinKey) return;
    this.skinKey = key;
    this.starColor = skin.stars;
    this.nebula = buildNebula(skin);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.t += dt;
    if (!reducedMotion && this.rng.chance(dt * 0.12)) {
      this.shooting.push({ x: this.rng.range(0, WORLD_W), y: this.rng.range(-20, WORLD_H * 0.4), vx: this.rng.range(-500, -250), vy: this.rng.range(120, 260), life: 1 });
    }
    for (const s of this.shooting) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.4;
    }
    this.shooting = this.shooting.filter((s) => s.life > 0);
  }

  draw(c: CanvasRenderingContext2D, viewW: number, viewH: number, offsetX: number, offsetY: number, intensity: number): void {
    c.fillStyle = '#05081a';
    c.fillRect(-offsetX, -offsetY, viewW, viewH);
    if (this.nebula) {
      c.globalAlpha = 0.9;
      c.drawImage(this.nebula, -offsetX, -offsetY, viewW, viewH);
      c.globalAlpha = 1;
    }
    const drift = this.t * (6 + intensity * 14);
    c.fillStyle = this.starColor;
    for (const s of this.stars) {
      const speed = (s.layer + 1) * 0.5;
      const y = ((s.y + drift * speed) % (WORLD_H * 1.4)) - WORLD_H * 0.2 - offsetY;
      const x = s.x - WORLD_W * 0.3 - offsetX;
      if (y < -offsetY - 5 || y > viewH - offsetY + 5 || x < -offsetX - 5 || x > viewW - offsetX + 5) continue;
      const tw = 0.6 + 0.4 * Math.sin(this.t * (1 + s.layer) + s.phase);
      c.globalAlpha = (0.35 + s.layer * 0.25) * tw;
      c.beginPath();
      c.arc(x, y, s.size, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    for (const s of this.shooting) {
      const g = c.createLinearGradient(s.x, s.y, s.x - s.vx * 0.25, s.y - s.vy * 0.25);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * s.life})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = g;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(s.x - s.vx * 0.25, s.y - s.vy * 0.25);
      c.stroke();
    }
  }
}

function buildNebula(skin: NebulaSkin): HTMLCanvasElement {
  const w = 640;
  const h = 360;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#05081a';
  c.fillRect(0, 0, w, h);
  const r = new Rng(777);
  const blobs = 9;
  for (let i = 0; i < blobs; i++) {
    const col = skin.palette[i % skin.palette.length] ?? '#223';
    const x = r.range(0, w);
    const y = r.range(0, h);
    const rad = r.range(140, 320);
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, hexToRgba(col, 0.55));
    g.addColorStop(0.5, hexToRgba(col, 0.22));
    g.addColorStop(1, hexToRgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  // Voile sombre vers le bas pour la lisibilité près de la Terre.
  const v = c.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(5,8,26,0)');
  v.addColorStop(1, 'rgba(5,8,26,0.55)');
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  return cv;
}

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
