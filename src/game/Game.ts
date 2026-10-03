import { WORLD_H, WORLD_W } from '../core/canvas';
import { Emitter } from '../core/events';
import { clamp, dist } from '../core/math';
import { Rng } from '../core/rng';
import { FlowController, hintDelayMs } from '../learning/flow';
import { commuted, makeFact } from '../learning/facts';
import { masteryLevel } from '../learning/model';
import { Scheduler, type ResultReport } from '../learning/scheduler';
import type { Fact, FactId, FactState } from '../learning/types';
import type { BossBase } from './bosses/BossBase';
import { createBoss } from './bosses/index';
import { COMBO_MILESTONES, INVENTORY_SIZE, POWERUPS, POWERUP_TYPES } from './powerups';
import { scoreFor, stardustFor, xpFor } from './scoring';
import {
  DEFAULT_LOADOUT,
  type Asteroid,
  type AsteroidVariant,
  type BossKind,
  type BossTarget,
  type FactOutcome,
  type HintData,
  type Loadout,
  type ModeConfig,
  type PowerupType,
  type Projectile,
  type SessionResult,
  type Target,
} from './types';

export const EARTH_Y = WORLD_H - 70;
export const CANNON_X = WORLD_W / 2;
export const CANNON_Y = EARTH_Y - 18;

export type GameEvents = {
  spawn: Asteroid;
  destroyed: { target: Target; byPowerup: boolean; score: number; fluent: boolean; report?: ResultReport };
  earthHit: { target: Target };
  shieldAbsorb: { target: Target };
  shot: { target: Target | null };
  miss: { answer: number; target: Target | null; report?: ResultReport };
  feedback: { text: string; x: number; y: number; kind: 'correct' | 'wrong' | 'info' | 'bonus' };
  combo: { combo: number; milestone: boolean };
  waveStart: { wave: number; total: number | null };
  waveEnd: { wave: number };
  bossStart: { boss: BossBase };
  bossPhase: { boss: BossBase; phase: number };
  bossHit: { boss: BossBase; target: BossTarget };
  bossAttack: { boss: BossBase };
  bossDefeated: { boss: BossBase };
  powerupGained: { type: PowerupType };
  powerupUsed: { type: PowerupType };
  powerupFull: { type: PowerupType };
  hint: { target: Target; hint: HintData };
  gameOver: SessionResult;
  victory: SessionResult;
  split: { parent: Asteroid; children: Asteroid[] };
  /** Effet d'impact d'un projectile spécial. */
  splash: { kind: Projectile['kind']; x: number; y: number; radius: number };
  /** Éclair instantané : chemin du canon à la cible (et éventuel rebond). */
  lightning: { points: { x: number; y: number }[] };
  stardust: { amount: number; x: number; y: number };
  paused: boolean;
};

export interface SpawnOptions {
  speedMul?: number;
  fromX?: number;
  fromY?: number;
  variant?: AsteroidVariant;
  fact?: Fact;
  generation?: number;
}

export type GamePhase = 'intro' | 'playing' | 'intermission' | 'boss' | 'paused' | 'ended';

/**
 * Simulation complète d'une partie, indépendante du rendu et du DOM.
 * Le temps de jeu `time` est en millisecondes et n'avance que quand la partie tourne.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly rng: Rng;
  readonly scheduler: Scheduler;
  readonly flow: FlowController;
  readonly mode: ModeConfig;
  readonly loadout: Loadout;

  time = 0;
  phase: GamePhase = 'intro';
  private prePausePhase: GamePhase = 'playing';
  asteroids: Asteroid[] = [];
  projectiles: Projectile[] = [];
  boss: BossBase | null = null;
  earth = { hp: 5, maxHp: 5, shield: false, invulnerable: false, hitFlash: 0 };
  cannon = { x: CANNON_X, y: CANNON_Y, angle: -Math.PI / 2, targetId: -1, recoil: 0 };

  buffer = '';
  focusOverride: number | null = null;

  score = 0;
  combo = 0;
  maxCombo = 0;
  stardust = 0;
  inventory: PowerupType[] = [];
  effects = { freezeUntil: 0, doubleUntil: 0, oracleUntil: 0 };

  wave = 0;
  private waveSpawned = 0;
  private waveSize = 12;
  private spawnTimer = 1200;
  private intermissionTimer = 0;
  private bossQueue: BossKind[] = [];
  bossesDefeated: BossKind[] = [];
  timeLeft = 0;
  private lastResolve = 0;
  private idCounter = 1;
  private introTimer = 1500;

  private stats = { destroyed: 0, answered: 0, errors: 0, hits: 0, fluent: 0, rtSum: 0, waves: 0, powerupKills: 0 };
  private factOutcomes = new Map<FactId, FactOutcome>();
  private masteredBefore = new Set<FactId>();
  private comboAwarded = new Set<number>();

  constructor(mode: ModeConfig, states: Map<FactId, FactState>, loadout: Loadout = DEFAULT_LOADOUT) {
    this.mode = mode;
    this.loadout = loadout;
    this.rng = new Rng(mode.seed);
    this.scheduler = new Scheduler(
      states,
      {
        activeTables: mode.tables,
        newTables: mode.newTables,
        maxTable: mode.maxTable,
        fluentMs: mode.fluentMs,
        maxNewPerWave: mode.maxNewPerWave,
        reinjectErrors: mode.reinjectErrors,
      },
      this.rng,
    );
    this.flow = new FlowController({ fluentMs: mode.fluentMs, initial: mode.flow.initial, min: mode.flow.min, max: mode.flow.max });
    this.earth.maxHp = (mode.earthHp || 5) + (loadout.perk === 'extraHp' && mode.earthHp > 0 ? 1 : 0);
    this.earth.hp = this.earth.maxHp;
    this.earth.invulnerable = mode.earthHp === 0;
    if (loadout.perk === 'startShield' && !this.earth.invulnerable) this.earth.shield = true;
    this.timeLeft = mode.timeLimitMs;
    this.bossQueue = [...mode.bosses];
    for (const [id, s] of states) if (masteryLevel(s, mode.fluentMs) === 4) this.masteredBefore.add(id);
  }

  /** Zone visible en unités monde (le portrait n'affiche pas toute la largeur et voit au-dessus de y=0). */
  view = { left: 0, right: WORLD_W, top: 0 };

  setViewport(left: number, right: number, top: number): void {
    this.view = { left, right, top };
    this.cannon.x = (left + right) / 2;
  }

  get viewCenterX(): number {
    return (this.view.left + this.view.right) / 2;
  }

  get viewHalfWidth(): number {
    return (this.view.right - this.view.left) / 2;
  }

  // ---------------------------------------------------------------- accès

  nextId(): number {
    return this.idCounter++;
  }

  get frozen(): boolean {
    return this.time < this.effects.freezeUntil;
  }

  get doubleActive(): boolean {
    return this.time < this.effects.doubleUntil;
  }

  get oracleActive(): boolean {
    return this.time < this.effects.oracleUntil;
  }

  /** Horloge réelle utilisée par le modèle d'apprentissage (espacement en jours). */
  get wallClock(): number {
    return Date.now();
  }

  /** Toutes les cibles vivantes (astéroïdes puis segments de boss). */
  get targets(): Target[] {
    const out: Target[] = this.asteroids.filter((a) => a.alive);
    if (this.boss) for (const t of this.boss.targets) if (t.alive) out.push(t);
    return out;
  }

  get onScreenAnswers(): Set<number> {
    return new Set(this.targets.map((t) => t.answer));
  }

  /** Cible "focus" : celle qui reçoit l'attribution des erreurs et l'indice. */
  get focus(): Target | null {
    const ts = this.targets;
    if (ts.length === 0) return null;
    if (this.focusOverride !== null) {
      const o = ts.find((t) => t.id === this.focusOverride);
      if (o) return o;
      this.focusOverride = null;
    }
    const asteroids = ts.filter((t) => t.type === 'asteroid');
    if (asteroids.length > 0) return asteroids.reduce((best, t) => (t.y > best.y ? t : best));
    return ts.reduce((best, t) => (t.x < best.x ? t : best));
  }

  /** Cible visée par le canon : correspondance de préfixe avec la saisie, sinon le focus. */
  get aimed(): Target | null {
    if (this.buffer.length > 0) {
      const pref = this.targets.filter((t) => String(t.answer).startsWith(this.buffer));
      if (pref.length > 0) return pref.reduce((b, t) => (t.y > b.y ? t : b));
    }
    return this.focus;
  }

  get stardustTotal(): number {
    return this.stardust;
  }

  get waveSizeTotal(): number {
    return this.waveSize;
  }

  get waveProgress(): number {
    if (this.phase === 'boss' && this.boss) return 1 - this.boss.hp;
    return this.waveSize === 0 ? 0 : clamp(this.stats.destroyed === 0 ? 0 : this.waveDone / this.waveSize, 0, 1);
  }

  private waveDone = 0;

  // ---------------------------------------------------------------- cycle de vie

  start(): void {
    this.phase = 'intro';
    this.introTimer = 1200;
  }

  pause(): void {
    if (this.phase === 'ended' || this.phase === 'paused') return;
    this.prePausePhase = this.phase;
    this.phase = 'paused';
    this.events.emit('paused', true);
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = this.prePausePhase;
    this.events.emit('paused', false);
  }

  togglePause(): void {
    if (this.phase === 'paused') this.resume();
    else this.pause();
  }

  abort(): SessionResult {
    const r = this.buildResult(false);
    r.aborted = true;
    this.phase = 'ended';
    return r;
  }

  // ---------------------------------------------------------------- saisie

  typeDigit(d: number): void {
    if (this.phase === 'paused' || this.phase === 'ended' || this.phase === 'intro') return;
    if (this.buffer.length >= 4) return;
    if (this.buffer === '' && d === 0) return;
    this.buffer += String(d);
    const n = Number(this.buffer);
    const ts = this.targets;
    const exact = ts.filter((t) => t.answer === n);
    const longer = ts.filter((t) => t.answer !== n && String(t.answer).startsWith(this.buffer));
    if (exact.length > 0 && longer.length === 0 && this.autoFire) this.fire();
  }

  autoFire = true;

  backspace(): void {
    this.buffer = this.buffer.slice(0, -1);
  }

  clearBuffer(): void {
    this.buffer = '';
  }

  cycleTarget(): void {
    const ts = this.targets;
    if (ts.length < 2) return;
    const current = this.focus;
    const sorted = [...ts].sort((a, b) => b.y - a.y);
    const i = current ? sorted.findIndex((t) => t.id === current.id) : -1;
    const next = sorted[(i + 1) % sorted.length];
    if (next) this.focusOverride = next.id;
  }

  setFocus(id: number): void {
    if (this.targets.some((t) => t.id === id)) this.focusOverride = id;
  }

  /** Tir : déclenché par Entrée/Espace ou par le tir automatique. */
  fire(): void {
    if (this.phase === 'paused' || this.phase === 'ended' || this.phase === 'intro') return;
    if (this.buffer === '') return;
    const n = Number(this.buffer);
    this.buffer = '';
    const ts = this.targets;
    const exact = ts.filter((t) => t.answer === n);
    this.cannon.recoil = 1;
    if (exact.length > 0) {
      const target = exact.reduce((b, t) => (t.y > b.y ? t : b));
      this.launchProjectile(target);
      this.events.emit('shot', { target });
      return;
    }
    // Tir raté : erreur attribuée au focus.
    const focus = this.focus;
    this.launchProjectile(null);
    this.combo = 0;
    let report: ResultReport | undefined;
    if (focus) {
      const rt = this.responseTime(focus);
      report = this.scheduler.reportResult(focus.fact, false, rt, this.wallClock, n);
      this.flow.recordOutcome(false, rt);
      this.recordOutcome(focus.fact.id, false, rt);
      this.stats.errors++;
      this.stats.answered++;
      this.lastResolve = this.time;
    }
    this.events.emit('miss', { answer: n, target: focus, report });
    this.events.emit('shot', { target: null });
  }

  private responseTime(t: Target): number {
    const from = Math.max(t.spawnTime, this.lastResolve);
    return clamp(this.time - from, 150, 30000);
  }

  /** Vitesse du projectile selon son type et le perk du canon. */
  get projectileSpeed(): number {
    const base = { bolt: 1500, missile: 950, lightning: 1500, frost: 1300, twin: 1500, shockwave: 1100 }[this.loadout.projectile];
    return base * (this.loadout.perk === 'fastShot' ? 1.3 : 1);
  }

  private launchProjectile(target: Target | null): void {
    const angle = target ? Math.atan2(target.y - this.cannon.y, target.x - this.cannon.x) : this.cannon.angle;
    const kind = this.loadout.projectile;
    if (target && kind === 'lightning') {
      // Éclair : impact instantané, puis rebond sur une cible de la même table (sans effet sur le modèle).
      const points = [{ x: this.cannon.x + Math.cos(angle) * 40, y: this.cannon.y + Math.sin(angle) * 40 }, { x: target.x, y: target.y }];
      const table = target.fact.a;
      const other = this.asteroids
        .filter((a) => a.alive && a.id !== target.id && (a.fact.a === table || a.fact.b === table) && dist(a.x, a.y, target.x, target.y) < 280)
        .sort((a, b) => dist(a.x, a.y, target.x, target.y) - dist(b.x, b.y, target.x, target.y))[0];
      this.resolveHit(target);
      if (other) {
        points.push({ x: other.x, y: other.y });
        this.destroyTarget(other, true);
      }
      this.events.emit('lightning', { points });
      return;
    }
    const speed = this.projectileSpeed;
    this.projectiles.push({
      x: this.cannon.x + Math.cos(angle) * 40,
      y: this.cannon.y + Math.sin(angle) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      targetId: target ? target.id : -1,
      fizzle: !target,
      life: target ? 2.5 : 0.35,
      trail: [],
      kind,
      age: 0,
      wobble: this.rng.chance(0.5) ? 1 : -1,
    });
  }

  /** Effet d'impact des projectiles spéciaux (hors éclair). */
  private applyImpact(p: Projectile, t: Target): void {
    const near = (r: number) => this.asteroids.filter((a) => a.alive && a.id !== t.id && dist(a.x, a.y, t.x, t.y) < r);
    switch (p.kind) {
      case 'missile':
        for (const a of near(150)) {
          a.vy *= 0.35;
          a.y -= 36;
        }
        this.events.emit('splash', { kind: 'missile', x: t.x, y: t.y, radius: 150 });
        break;
      case 'frost':
        for (const a of near(170)) a.slowUntil = this.time + 3000;
        this.events.emit('splash', { kind: 'frost', x: t.x, y: t.y, radius: 170 });
        break;
      case 'shockwave': {
        const victims = near(120).sort((a, b) => dist(a.x, a.y, t.x, t.y) - dist(b.x, b.y, t.x, t.y)).slice(0, 1);
        for (const a of victims) this.destroyTarget(a, true);
        this.events.emit('splash', { kind: 'shockwave', x: t.x, y: t.y, radius: 120 });
        break;
      }
      case 'twin':
        this.addStardust(1, t.x, t.y);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- powerups

  usePowerup(slot: number): void {
    if (this.phase !== 'playing' && this.phase !== 'boss') return;
    const type = this.inventory[slot];
    if (!type) return;
    this.inventory.splice(slot, 1);
    this.applyPowerup(type);
    this.events.emit('powerupUsed', { type });
  }

  private applyPowerup(type: PowerupType): void {
    const def = POWERUPS[type];
    switch (type) {
      case 'freeze':
        this.effects.freezeUntil = this.time + def.duration;
        break;
      case 'double':
        this.effects.doubleUntil = this.time + def.duration;
        break;
      case 'oracle':
        this.effects.oracleUntil = this.time + def.duration;
        break;
      case 'shield':
        if (this.earth.shield && this.earth.hp < this.earth.maxHp) this.earth.hp++;
        else this.earth.shield = true;
        break;
      case 'nova':
        for (const a of [...this.asteroids]) if (a.alive) this.destroyTarget(a, true);
        if (this.boss) for (const t of [...this.boss.targets]) if (t.alive && this.boss.kind !== 'mothership') this.destroyTarget(t, true);
        break;
      case 'laser': {
        const f = this.focus;
        if (!f) break;
        const table = f.fact.a;
        for (const t of [...this.targets]) {
          if (t.fact.a === table || t.fact.b === table) this.destroyTarget(t, true);
        }
        break;
      }
    }
  }

  private gainPowerup(type: PowerupType): void {
    if (!this.mode.powerups) return;
    if (this.inventory.length >= INVENTORY_SIZE) {
      this.events.emit('powerupFull', { type });
      this.addStardust(5, this.cannon.x, this.cannon.y - 60);
      return;
    }
    this.inventory.push(type);
    this.events.emit('powerupGained', { type });
  }

  private randomPowerup(): PowerupType {
    return this.rng.weighted(
      POWERUP_TYPES,
      POWERUP_TYPES.map((t) => POWERUPS[t].weight),
    );
  }

  // ---------------------------------------------------------------- apparition

  /** Fait de boss : on évite les réponses déjà visibles (produit, ou facteur pour le Miroir). */
  pickBossFact(table: number, mirror: boolean): Fact {
    const visible = this.onScreenAnswers;
    for (let i = 0; i < 12; i++) {
      const f = this.scheduler.pickNext(mirror ? new Set() : visible, this.wallClock);
      if (!f) break;
      const answer = mirror ? f.b : f.product;
      const sameTable = f.a === table || f.b === table;
      if (!visible.has(answer) && (sameTable || i >= 6)) return f;
    }
    // Repli : un fait de la table non visible.
    const order = this.rng.shuffle(Array.from({ length: this.mode.maxTable }, (_, i) => i + 1));
    for (const b of order) {
      const f = makeFact(table, b);
      const answer = mirror ? f.b : f.product;
      if (!visible.has(answer)) return f;
    }
    return makeFact(table, 1);
  }

  spawnAsteroid(opts: SpawnOptions = {}): Asteroid | null {
    const fact = opts.fact ?? this.scheduler.pickNext(this.onScreenAnswers, this.wallClock);
    if (!fact) return null;
    const params = this.flow.params();
    const generation = opts.generation ?? 0;
    const variant = opts.variant ?? (generation > 0 ? 'normal' : this.chooseVariant(params.specialChance));
    const sizeBase = variant === 'ice' ? 54 : variant === 'fire' ? 36 : generation > 0 ? 34 : 44;
    const radius = sizeBase + this.rng.range(-3, 3);
    const x = opts.fromX ?? this.spawnX(radius);
    const y = opts.fromY ?? this.view.top - radius - 10;
    const speedVar = this.rng.range(0.9, 1.1);
    const variantSpeed = variant === 'fire' ? 1.5 : variant === 'ice' ? 0.7 : 1;
    const vy = params.fallSpeed * speedVar * variantSpeed * (opts.speedMul ?? 1);
    const a: Asteroid = {
      id: this.nextId(),
      fact,
      answer: fact.product,
      label: `${fact.a} × ${fact.b}`,
      x,
      y,
      radius,
      spawnTime: this.time,
      alive: true,
      type: 'asteroid',
      variant,
      vx: this.rng.range(-8, 8),
      vy,
      rotation: this.rng.range(0, Math.PI * 2),
      rotSpeed: this.rng.range(-0.6, 0.6),
      shapeSeed: this.rng.int(0, 1_000_000),
      generation,
      hinted: false,
      scale: generation > 0 ? 1 : 0,
      slowUntil: 0,
    };
    this.asteroids.push(a);
    this.events.emit('spawn', a);
    return a;
  }

  private chooseVariant(specialChance: number): AsteroidVariant {
    if (!this.rng.chance(specialChance)) return 'normal';
    const pool: AsteroidVariant[] = ['fire', 'ice', 'crystal', 'split'];
    const weights = [3, 2, (this.mode.powerups ? 3 : 1) * (this.loadout.perk === 'crystals' ? 2 : 1), 2];
    return this.rng.weighted(pool, weights);
  }

  private spawnX(radius: number): number {
    const lo = this.view.left + radius + 30;
    const hi = this.view.right - radius - 30;
    let best = this.rng.range(lo, hi);
    let bestD = -1;
    for (let i = 0; i < 6; i++) {
      const x = this.rng.range(lo, hi);
      let minD = Infinity;
      for (const a of this.asteroids) if (a.alive && a.y < 200) minD = Math.min(minD, Math.abs(a.x - x));
      if (minD > bestD) {
        bestD = minD;
        best = x;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- mise à jour

  update(dt: number): void {
    if (this.phase === 'paused' || this.phase === 'ended') return;
    const ms = dt * 1000;
    this.time += ms;
    this.cannon.recoil = Math.max(0, this.cannon.recoil - dt * 4);
    this.earth.hitFlash = Math.max(0, this.earth.hitFlash - dt * 2);

    if (this.phase === 'intro') {
      this.introTimer -= ms;
      if (this.introTimer <= 0) this.beginNextStage();
      this.updateCannon(dt);
      return;
    }

    if (this.mode.timeLimitMs > 0 && (this.phase === 'playing' || this.phase === 'boss')) {
      this.timeLeft -= ms;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.end(true);
        return;
      }
    }

    if (this.phase === 'intermission') {
      this.intermissionTimer -= ms;
      this.updateProjectiles(dt);
      this.updateCannon(dt);
      if (this.intermissionTimer <= 0) this.beginNextStage();
      return;
    }

    if (this.phase === 'playing') this.updateSpawning(ms);
    if (this.phase === 'boss' && this.boss) {
      this.boss.update(dt);
      this.checkBossDeadlines();
      if (this.boss.defeated) this.onBossDefeated();
    }
    if (!this.frozen) this.updateAsteroids(dt);
    this.updateProjectiles(dt);
    this.updateCannon(dt);
    this.updateHints();

    if (this.phase === 'playing' && this.waveSpawned >= this.waveSize && this.asteroids.every((a) => !a.alive)) {
      this.endWave();
    }
  }

  private updateSpawning(ms: number): void {
    if (this.waveSpawned >= this.waveSize) return;
    if (this.frozen) return;
    this.spawnTimer -= ms;
    const p = this.flow.params();
    const alive = this.asteroids.filter((a) => a.alive).length;
    if (this.spawnTimer <= 0 && alive < p.maxOnScreen) {
      if (this.spawnAsteroid()) {
        this.waveSpawned++;
        this.spawnTimer = p.spawnInterval * (alive === 0 ? 0.5 : 1);
      }
    } else if (alive === 0 && this.spawnTimer > 600) {
      this.spawnTimer = 600; // écran vide : on n'attend pas trop longtemps
    }
  }

  private updateAsteroids(dt: number): void {
    for (const a of this.asteroids) {
      if (!a.alive) continue;
      a.scale = Math.min(1, a.scale + dt * 2.5);
      const slow = this.time < a.slowUntil ? 0.45 : 1;
      a.x += a.vx * dt * slow;
      a.y += a.vy * dt * slow;
      a.rotation += a.rotSpeed * dt;
      if (a.x < this.view.left + a.radius) a.vx = Math.abs(a.vx);
      if (a.x > this.view.right - a.radius) a.vx = -Math.abs(a.vx);
      if (a.y + a.radius * 0.6 >= EARTH_Y) this.onEarthImpact(a);
    }
    this.asteroids = this.asteroids.filter((a) => a.alive);
  }

  private updateProjectiles(dt: number): void {
    const speed = this.projectileSpeed;
    for (const p of this.projectiles) {
      p.life -= dt;
      p.age += dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > (p.kind === 'missile' ? 14 : 8)) p.trail.shift();
      const t = p.targetId >= 0 ? this.targets.find((x) => x.id === p.targetId) : undefined;
      if (t) {
        const ang = Math.atan2(t.y - p.y, t.x - p.x);
        p.vx = Math.cos(ang) * speed;
        p.vy = Math.sin(ang) * speed;
        if (p.kind === 'missile') {
          // Trajectoire sinueuse : composante latérale qui s'amortit à l'approche de la cible.
          const d = dist(p.x, p.y, t.x, t.y);
          const lateral = Math.sin(p.age * 14) * 420 * p.wobble * Math.min(1, d / 220);
          p.vx += -Math.sin(ang) * lateral;
          p.vy += Math.cos(ang) * lateral;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (dist(p.x, p.y, t.x, t.y) < t.radius * 0.8 + 10) {
          p.life = 0;
          this.resolveHit(t);
          this.applyImpact(p, t);
        }
      } else {
        if (!p.fizzle && p.targetId >= 0) p.life = 0;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private updateCannon(dt: number): void {
    const aim = this.aimed;
    const targetAngle = aim ? Math.atan2(aim.y - this.cannon.y, aim.x - this.cannon.x) : -Math.PI / 2;
    let d = targetAngle - this.cannon.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.cannon.angle += d * Math.min(1, dt * 10);
    this.cannon.targetId = aim ? aim.id : -1;
  }

  private updateHints(): void {
    const f = this.focus;
    if (!f || f.type !== 'asteroid') return;
    const a = f as Asteroid;
    if (a.hinted) return;
    const delay = (this.mode.hintsAlways ? 400 : hintDelayMs(this.mode.fluentMs)) * (this.loadout.perk === 'quickHint' ? 0.6 : 1);
    if (this.time - Math.max(a.spawnTime, this.lastResolve) >= delay) {
      a.hinted = true;
      this.events.emit('hint', { target: a, hint: this.makeHint(a.fact) });
    }
  }

  /** Choisit une stratégie d'indice basée sur un fait voisin que le joueur connaît mieux. */
  private makeHint(fact: Fact): HintData {
    if (fact.a === 1 || fact.b === 1) return { fact, kind: 'identity' };
    if (fact.a === 2 || fact.b === 2) return { fact, kind: 'twice' };
    const states = this.scheduler.states;
    const known = (f: Fact) => (states.get(f.id)?.pKnown ?? 0) + (f.b === 1 || f.b === 2 || f.b === 5 || f.b === 10 ? 0.3 : 0);
    const comm = commuted(fact);
    const candidates: { kind: HintData['kind']; support: Fact; score: number }[] = [];
    if (fact.b > 1) candidates.push({ kind: 'neighbor-down', support: makeFact(fact.a, fact.b - 1), score: known(makeFact(fact.a, fact.b - 1)) });
    if (fact.b < this.mode.maxTable) candidates.push({ kind: 'neighbor-up', support: makeFact(fact.a, fact.b + 1), score: known(makeFact(fact.a, fact.b + 1)) - 0.1 });
    if (comm.id !== fact.id) candidates.push({ kind: 'commute', support: comm, score: known(comm) - 0.05 });
    if (fact.b % 2 === 0 && fact.b > 2) candidates.push({ kind: 'double', support: makeFact(fact.a, fact.b / 2), score: known(makeFact(fact.a, fact.b / 2)) - 0.05 });
    candidates.sort((x, y) => y.score - x.score);
    const best = candidates[0];
    if (!best || best.score < 0.45 || fact.b <= 3) return { fact, kind: 'repeat' };
    return { fact, kind: best.kind, support: best.support };
  }

  // ---------------------------------------------------------------- résolution

  private resolveHit(t: Target): void {
    if (!t.alive) return;
    const rt = this.responseTime(t);
    const fluent = rt <= this.mode.fluentMs;
    const report = this.scheduler.reportResult(t.fact, true, rt, this.wallClock);
    this.flow.recordOutcome(true, rt);
    this.recordOutcome(t.fact.id, true, rt);
    this.stats.answered++;
    this.stats.rtSum += rt;
    if (fluent) this.stats.fluent++;
    this.lastResolve = this.time;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const milestone = COMBO_MILESTONES.includes(this.combo) && !this.comboAwarded.has(this.combo);
    if (milestone) {
      this.comboAwarded.add(this.combo);
      this.gainPowerup(this.randomPowerup());
    }
    this.events.emit('combo', { combo: this.combo, milestone });
    const score = scoreFor(rt, this.mode.fluentMs * (this.loadout.perk === 'wideFluent' ? 1.25 : 1), this.combo, this.doubleActive, this.mode.scoreMult);
    this.destroyTarget(t, false, score, fluent, report);
    if (this.mode.timeBonusMs > 0) this.timeLeft += this.mode.timeBonusMs;
    if (this.focusOverride === t.id) this.focusOverride = null;
  }

  /** Détruit une cible (par tir ou par powerup). */
  destroyTarget(t: Target, byPowerup: boolean, score = 0, fluent = false, report?: ResultReport): void {
    if (!t.alive) return;
    t.alive = false;
    if (byPowerup) {
      score = Math.round((50 * this.mode.scoreMult) / 5) * 5;
      this.stats.powerupKills++;
    }
    this.score += score;
    this.stats.destroyed++;
    this.waveDone++;
    if (t.type === 'asteroid') {
      const a = t as Asteroid;
      const dust = stardustFor(fluent, a.variant) + (this.loadout.perk === 'stardust' && !byPowerup ? 1 : 0);
      this.addStardust(dust, a.x, a.y);
      if (a.variant === 'crystal' && !byPowerup) this.gainPowerup(this.randomPowerup());
      if (a.variant === 'split' && !byPowerup && a.generation === 0) this.splitAsteroid(a);
    } else if (this.boss) {
      const bt = t as BossTarget;
      this.boss.removeTarget(bt);
      this.boss.kills++;
      this.boss.onTargetDestroyed(bt);
      this.events.emit('bossHit', { boss: this.boss, target: bt });
      this.addStardust(2, t.x, t.y);
    }
    this.events.emit('destroyed', { target: t, byPowerup, score, fluent, report });
  }

  private splitAsteroid(a: Asteroid): void {
    const f = a.fact;
    const facts: Fact[] = [];
    if (f.b > 1) facts.push(makeFact(f.a, f.b - 1));
    if (f.b < this.mode.maxTable) facts.push(makeFact(f.a, f.b + 1));
    const visible = this.onScreenAnswers;
    const children: Asteroid[] = [];
    let i = 0;
    for (const cf of facts.filter((x) => !visible.has(x.product)).slice(0, 2)) {
      const c = this.spawnAsteroid({ fact: cf, fromX: a.x + (i === 0 ? -40 : 40), fromY: a.y, generation: 1, speedMul: 0.8 });
      if (c) {
        c.vx = i === 0 ? -35 : 35;
        children.push(c);
      }
      i++;
    }
    if (children.length > 0) this.events.emit('split', { parent: a, children });
  }

  private onEarthImpact(a: Asteroid): void {
    a.alive = false;
    this.waveDone++;
    const rt = this.responseTime(a);
    this.lastResolve = this.time;
    this.combo = 0;
    if (this.focusOverride === a.id) this.focusOverride = null;
    if (this.earth.shield) {
      this.earth.shield = false;
      this.events.emit('shieldAbsorb', { target: a });
      // Même protégé, le fait non résolu est réinjecté (sans compter comme erreur de score).
      this.scheduler.reportResult(a.fact, false, rt, this.wallClock);
      this.recordOutcome(a.fact.id, false, rt);
      return;
    }
    this.scheduler.reportResult(a.fact, false, rt, this.wallClock);
    this.flow.recordOutcome(false, rt);
    this.flow.onEarthHit();
    this.recordOutcome(a.fact.id, false, rt);
    this.stats.errors++;
    this.stats.hits++;
    this.stats.answered++;
    this.earth.hitFlash = 1;
    if (!this.earth.invulnerable) this.earth.hp--;
    this.events.emit('earthHit', { target: a });
    if (this.earth.hp <= 0) this.end(false);
  }

  /** Dégâts directs infligés par un boss (Chrono). */
  damageEarth(source: Target): void {
    this.combo = 0;
    this.earth.hitFlash = 1;
    if (this.earth.shield) {
      this.earth.shield = false;
      this.events.emit('shieldAbsorb', { target: source });
      return;
    }
    this.stats.hits++;
    if (!this.earth.invulnerable) this.earth.hp--;
    this.flow.onEarthHit();
    this.events.emit('earthHit', { target: source });
    if (this.earth.hp <= 0) this.end(false);
  }

  private checkBossDeadlines(): void {
    if (!this.boss) return;
    for (const t of [...this.boss.targets]) {
      if (t.deadline > 0 && this.time >= t.deadline && t.alive) {
        this.boss.removeTarget(t);
        const rt = this.responseTime(t);
        this.scheduler.reportResult(t.fact, false, rt, this.wallClock);
        this.recordOutcome(t.fact.id, false, rt);
        this.stats.errors++;
        this.stats.answered++;
        this.lastResolve = this.time;
        this.events.emit('miss', { answer: -1, target: t });
        this.damageEarth(t);
        this.boss.onTargetDestroyed(t);
      }
    }
  }

  private addStardust(n: number, x: number, y: number): void {
    this.stardust += n;
    this.events.emit('stardust', { amount: n, x, y });
  }

  private recordOutcome(id: FactId, correct: boolean, rt: number): void {
    let o = this.factOutcomes.get(id);
    if (!o) {
      o = { factId: id, correct: 0, wrong: 0, bestRt: Infinity };
      this.factOutcomes.set(id, o);
    }
    if (correct) {
      o.correct++;
      o.bestRt = Math.min(o.bestRt, rt);
    } else o.wrong++;
  }

  // ---------------------------------------------------------------- vagues et boss

  private beginNextStage(): void {
    if (this.endAfterIntermission) {
      this.endAfterIntermission = false;
      this.end(true);
      return;
    }
    const total = this.mode.wavesTotal;
    if (total !== null && this.wave >= total) {
      if (this.bossQueue.length > 0) this.startBoss(this.bossQueue.shift() as BossKind);
      else this.end(true);
      return;
    }
    this.startWave();
  }

  private startWave(): void {
    this.wave++;
    this.phase = 'playing';
    this.scheduler.startWave();
    const i = this.flow.intensity;
    this.waveSize = Math.round(this.mode.asteroidsPerWave * (1 + i * 0.4));
    this.waveSpawned = 0;
    this.waveDone = 0;
    this.spawnTimer = 400;
    this.events.emit('waveStart', { wave: this.wave, total: this.mode.wavesTotal });
  }

  private endWave(): void {
    this.stats.waves++;
    this.flow.endWave();
    if (this.mode.rampPerWave > 0) this.flow.intensity = Math.min(this.flow.max, this.flow.intensity + this.mode.rampPerWave);
    this.events.emit('waveEnd', { wave: this.wave });
    this.phase = 'intermission';
    this.intermissionTimer = 1800;
  }

  private startBoss(kind: BossKind): void {
    this.phase = 'boss';
    const idx = this.mode.bosses.length - this.bossQueue.length - 1;
    const table = this.mode.bossTables[idx] ?? this.mode.tables[this.mode.tables.length - 1] ?? 2;
    this.boss = createBoss(kind, this, table);
    this.boss.init();
    this.scheduler.startWave();
    this.events.emit('bossStart', { boss: this.boss });
  }

  private onBossDefeated(): void {
    const b = this.boss as BossBase;
    this.boss = null;
    this.bossesDefeated.push(b.kind);
    this.score += Math.round(1000 * this.mode.scoreMult);
    this.addStardust(50, b.x, b.y);
    this.events.emit('bossDefeated', { boss: b });
    for (const a of [...this.asteroids]) if (a.alive) this.destroyTarget(a, true);
    if (this.bossQueue.length > 0) {
      this.phase = 'intermission';
      this.intermissionTimer = 2600;
    } else {
      // Fin de partie après la célébration.
      this.phase = 'intermission';
      this.intermissionTimer = 2200;
      this.endAfterIntermission = true;
    }
  }

  private endAfterIntermission = false;

  private end(victory: boolean): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    const result = this.buildResult(victory);
    this.events.emit(victory ? 'victory' : 'gameOver', result);
  }

  buildResult(victory: boolean): SessionResult {
    const s = this.stats;
    const accuracy = s.answered === 0 ? 1 : (s.answered - s.errors) / s.answered;
    const perfect = s.errors === 0 && s.hits === 0 && s.destroyed > 0;
    const xp = xpFor({ destroyed: s.destroyed, fluentCount: s.fluent, bosses: this.bossesDefeated.length, victory, perfect });
    const newlyMastered: FactId[] = [];
    for (const [id, st] of this.scheduler.states) {
      if (!this.masteredBefore.has(id) && masteryLevel(st, this.mode.fluentMs) === 4 && this.factOutcomes.has(id)) newlyMastered.push(id);
    }
    const outcomes = [...this.factOutcomes.values()];
    let stars = 0;
    if (victory && this.mode.id === 'campaign') {
      stars = 1;
      if (accuracy >= 0.85 && s.hits <= 2) stars = 2;
      if (accuracy >= 0.95 && s.hits === 0) stars = 3;
    }
    return {
      modeId: this.mode.id,
      sector: this.mode.sector,
      score: this.score,
      destroyed: s.destroyed,
      correct: s.answered - s.errors,
      powerupKills: s.powerupKills,
      answered: s.answered,
      errors: s.errors,
      hitsTaken: s.hits,
      accuracy,
      avgRt: s.answered - s.errors > 0 ? s.rtSum / (s.answered - s.errors) : 0,
      fluentRatio: s.answered - s.errors > 0 ? s.fluent / (s.answered - s.errors) : 0,
      maxCombo: this.maxCombo,
      stardust: this.stardust,
      xp,
      stars,
      victory,
      bossesDefeated: [...this.bossesDefeated],
      durationMs: this.time,
      wavesCleared: s.waves,
      factOutcomes: outcomes,
      weakFacts: outcomes.filter((o) => o.wrong > 0).map((o) => o.factId),
      newlyMastered,
      perfect,
      aborted: false,
    };
  }
}
