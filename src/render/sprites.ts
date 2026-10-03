import { TAU } from '../core/math';
import { Rng } from '../core/rng';
import type { AsteroidVariant } from '../game/types';
import { hexToRgba } from './background';

const cache = new Map<string, HTMLCanvasElement>();

const VARIANT_COLORS: Record<AsteroidVariant, { base: string; dark: string; light: string; glow: string | null }> = {
  normal: { base: '#6e6a7a', dark: '#3b3847', light: '#a39fb3', glow: null },
  fire: { base: '#8a3a1f', dark: '#3a1208', light: '#ff9f43', glow: '#ff6a2a' },
  ice: { base: '#6fb6d9', dark: '#2a5e80', light: '#e8f7ff', glow: '#7fe3ff' },
  crystal: { base: '#5b3a9e', dark: '#2a1550', light: '#d6c8ff', glow: '#c86bff' },
  split: { base: '#6a5a4a', dark: '#2e2418', light: '#b59a7a', glow: '#ffd166' },
};

/** Sprite d'astéroïde procédural, mis en cache par (variante, seed réduit, rayon arrondi). */
export function asteroidSprite(variant: AsteroidVariant, seed: number, radius: number): HTMLCanvasElement {
  const r = Math.round(radius / 4) * 4;
  const s = seed % 24;
  const key = `${variant}-${s}-${r}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pad = 14;
  const size = (r + pad) * 2;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  const rng = new Rng(seed * 31 + 7);
  const cx = size / 2;
  const cy = size / 2;
  const col = VARIANT_COLORS[variant];

  if (col.glow) {
    const g = c.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + pad);
    g.addColorStop(0, hexToRgba(col.glow, 0.55));
    g.addColorStop(1, hexToRgba(col.glow, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }

  const n = variant === 'crystal' ? 7 : 11;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (variant === 'crystal' ? rng.range(0.75, 1) : rng.range(0.82, 1));
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  c.beginPath();
  pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
  c.closePath();
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, col.light);
  g.addColorStop(0.45, col.base);
  g.addColorStop(1, col.dark);
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  // Cratères / facettes
  if (variant === 'crystal') {
    c.strokeStyle = hexToRgba(col.light, 0.5);
    c.lineWidth = 1.5;
    for (const p of pts) {
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(p.x, p.y);
      c.stroke();
    }
  } else {
    const craters = rng.int(3, 6);
    for (let i = 0; i < craters; i++) {
      const a = rng.range(0, TAU);
      const d = rng.range(0, r * 0.6);
      const cr = rng.range(r * 0.1, r * 0.25);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      c.fillStyle = hexToRgba(col.dark, 0.7);
      c.beginPath();
      c.arc(x, y, cr, 0, TAU);
      c.fill();
      c.fillStyle = hexToRgba(col.light, 0.25);
      c.beginPath();
      c.arc(x - cr * 0.25, y - cr * 0.25, cr * 0.6, 0, TAU);
      c.fill();
    }
    if (variant === 'split') {
      c.strokeStyle = hexToRgba('#ffd166', 0.9);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - r * 0.7, cy - r * 0.3);
      c.lineTo(cx - r * 0.2, cy + r * 0.1);
      c.lineTo(cx + r * 0.1, cy - r * 0.2);
      c.lineTo(cx + r * 0.6, cy + r * 0.5);
      c.stroke();
    }
    if (variant === 'fire') {
      const fg = c.createRadialGradient(cx, cy + r * 0.3, 0, cx, cy, r);
      fg.addColorStop(0, 'rgba(255,200,80,0.55)');
      fg.addColorStop(1, 'rgba(255,100,40,0)');
      c.fillStyle = fg;
      c.fillRect(0, 0, size, size);
    }
  }
  c.restore();
  // Liseré lumineux
  c.strokeStyle = hexToRgba(col.light, 0.45);
  c.lineWidth = 1.5;
  c.stroke();
  cache.set(key, cv);
  return cv;
}

/** Halo radial réutilisable (évite shadowBlur). */
export function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `glow-${color}-${Math.round(radius)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = Math.ceil(radius * 2);
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, hexToRgba(color, 0.8));
  g.addColorStop(0.4, hexToRgba(color, 0.3));
  g.addColorStop(1, hexToRgba(color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  cache.set(key, cv);
  return cv;
}
