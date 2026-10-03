import { TAU } from '../core/math';
import type { Rng } from '../core/rng';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: 'dot' | 'spark' | 'ring' | 'square' | 'shard' | 'mote';
  drag: number;
  gravity: number;
  rot: number;
  rotV: number;
  /** Cible d'attraction (poussière d'étoiles vers le HUD). */
  tx?: number;
  ty?: number;
  additive: boolean;
}

const MAX_PARTICLES = 900;

/** Système de particules avec pool et plafond, rendu en un seul passage. */
export class ParticleSystem {
  particles: Particle[] = [];
  private pool: Particle[] = [];

  constructor(private readonly rng: Rng) {}

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.pool.push(...this.particles);
    this.particles = [];
  }

  private alloc(): Particle | null {
    if (this.particles.length >= MAX_PARTICLES) return null;
    const p = this.pool.pop() ?? ({} as Particle);
    this.particles.push(p);
    return p;
  }

  spawn(init: Partial<Particle> & { x: number; y: number }): void {
    const p = this.alloc();
    if (!p) return;
    p.x = init.x;
    p.y = init.y;
    p.vx = init.vx ?? 0;
    p.vy = init.vy ?? 0;
    p.maxLife = init.maxLife ?? 0.8;
    p.life = p.maxLife;
    p.size = init.size ?? 3;
    p.color = init.color ?? '#ffffff';
    p.shape = init.shape ?? 'dot';
    p.drag = init.drag ?? 0.9;
    p.gravity = init.gravity ?? 0;
    p.rot = init.rot ?? 0;
    p.rotV = init.rotV ?? 0;
    p.tx = init.tx;
    p.ty = init.ty;
    p.additive = init.additive ?? true;
  }

  burst(x: number, y: number, palette: string[], style: string, radius: number, intensity = 1): void {
    const r = this.rng;
    const n = Math.round((18 + radius * 0.5) * intensity);
    const pick = () => palette[r.int(0, palette.length - 1)] ?? '#fff';
    switch (style) {
      case 'ring':
        this.spawn({ x, y, size: radius * 0.3, maxLife: 0.5, color: pick(), shape: 'ring', drag: 1 });
        this.spawn({ x, y, size: radius * 0.15, maxLife: 0.7, color: '#ffffff', shape: 'ring', drag: 1 });
        for (let i = 0; i < n; i++) {
          const a = r.range(0, TAU);
          const s = r.range(60, 220) * intensity;
          this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: r.range(1.5, 3.5), maxLife: r.range(0.4, 0.9), color: pick(), shape: 'dot', drag: 0.92 });
        }
        break;
      case 'confetti':
        for (let i = 0; i < n * 1.3; i++) {
          const a = r.range(0, TAU);
          const s = r.range(80, 320) * intensity;
          this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, size: r.range(3, 6), maxLife: r.range(0.8, 1.4), color: pick(), shape: 'square', drag: 0.94, gravity: 260, rot: r.range(0, TAU), rotV: r.range(-8, 8), additive: false });
        }
        this.spawn({ x, y, size: radius * 0.4, maxLife: 0.35, color: '#ffffff', shape: 'ring', drag: 1 });
        break;
      case 'ice':
        for (let i = 0; i < n; i++) {
          const a = r.range(0, TAU);
          const s = r.range(40, 200) * intensity;
          this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: r.range(3, 7), maxLife: r.range(0.6, 1.2), color: pick(), shape: 'shard', drag: 0.95, gravity: 120, rot: a, rotV: r.range(-4, 4) });
        }
        this.spawn({ x, y, size: radius * 0.5, maxLife: 0.6, color: '#bfefff', shape: 'ring', drag: 1 });
        break;
      case 'supernova':
        this.spawn({ x, y, size: radius * 0.6, maxLife: 0.9, color: '#ffffff', shape: 'ring', drag: 1 });
        this.spawn({ x, y, size: radius * 0.3, maxLife: 1.2, color: pick(), shape: 'ring', drag: 1 });
        for (let i = 0; i < n * 1.6; i++) {
          const a = r.range(0, TAU);
          const s = r.range(100, 420) * intensity;
          this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: r.range(1, 4), maxLife: r.range(0.5, 1.3), color: pick(), shape: i % 3 === 0 ? 'spark' : 'dot', drag: 0.9 });
        }
        break;
      default:
        for (let i = 0; i < n; i++) {
          const a = r.range(0, TAU);
          const s = r.range(50, 260) * intensity;
          this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: r.range(1.5, 4.5), maxLife: r.range(0.4, 1), color: pick(), shape: i % 4 === 0 ? 'spark' : 'dot', drag: 0.91, gravity: 40 });
        }
        this.spawn({ x, y, size: radius * 0.35, maxLife: 0.45, color: '#ffffff', shape: 'ring', drag: 1 });
        // Fumée sombre
        for (let i = 0; i < 6; i++) {
          const a = r.range(0, TAU);
          this.spawn({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 20, size: r.range(10, 18), maxLife: r.range(0.8, 1.3), color: 'rgba(40,30,60,0.5)', shape: 'dot', drag: 0.96, additive: false });
        }
    }
  }

  /** Poussière d'étoiles qui file vers un point du HUD. */
  motes(x: number, y: number, n: number, tx: number, ty: number, color = '#ffd166'): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, TAU);
      const s = this.rng.range(40, 120);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: 3, maxLife: 1.1, color, shape: 'mote', drag: 0.97, tx, ty });
    }
  }

  update(dt: number): void {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        continue;
      }
      if (p.tx !== undefined && p.ty !== undefined) {
        const t = 1 - p.life / p.maxLife;
        const k = Math.min(1, t * t * 6);
        p.vx += (p.tx - p.x) * k * dt * 10;
        p.vy += (p.ty - p.y) * k * dt * 10;
      }
      p.vy += p.gravity * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      alive.push(p);
    }
    this.particles = alive;
  }

  draw(c: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      c.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      c.globalAlpha = p.shape === 'ring' ? t * 0.9 : Math.min(1, t * 1.5);
      c.fillStyle = p.color;
      c.strokeStyle = p.color;
      switch (p.shape) {
        case 'dot': {
          const s = p.size * (0.5 + t * 0.5);
          c.beginPath();
          c.arc(p.x, p.y, s, 0, TAU);
          c.fill();
          break;
        }
        case 'mote': {
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, TAU);
          c.fill();
          c.globalAlpha *= 0.4;
          c.beginPath();
          c.arc(p.x, p.y, p.size * 2.2, 0, TAU);
          c.fill();
          break;
        }
        case 'spark': {
          c.lineWidth = p.size * 0.6;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          c.stroke();
          break;
        }
        case 'ring': {
          const grow = 1 - t;
          c.lineWidth = Math.max(1, 8 * t);
          c.beginPath();
          c.arc(p.x, p.y, p.size + grow * p.size * 4, 0, TAU);
          c.stroke();
          break;
        }
        case 'square':
        case 'shard': {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          if (p.shape === 'square') c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          else {
            c.beginPath();
            c.moveTo(0, -p.size);
            c.lineTo(p.size * 0.5, 0);
            c.lineTo(0, p.size);
            c.lineTo(-p.size * 0.5, 0);
            c.closePath();
            c.fill();
          }
          c.restore();
          break;
        }
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}
