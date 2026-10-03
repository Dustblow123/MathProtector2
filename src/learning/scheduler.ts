import type { Rng } from '../core/rng';
import { classifyError } from './confusions';
import { factorOrder, tableOrder } from './curriculum';
import { commuted, factsOfTable, makeFact, parseFactId } from './facts';
import { initialFactState, recordAnswer, recordCommutedCredit, retrievability } from './model';
import type { BucketQuotas, ErrorAnalysis, Fact, FactId, FactState } from './types';

export type Bucket = 'new' | 'learning' | 'review' | 'maintenance';

export interface SchedulerConfig {
  /** Tables dont les faits peuvent apparaître. */
  activeTables: number[];
  /** Tables où de nouveaux faits (jamais vus) peuvent être introduits. Par défaut : activeTables. */
  newTables?: number[];
  maxTable: number;
  fluentMs: number;
  maxNewPerWave?: number;
  quotas?: BucketQuotas;
  reinjectErrors?: boolean;
  /** Fenêtre de récence : un fait ne réapparaît pas dans les K prochains tirages (sauf réinjection). */
  recencyWindow?: number;
}

export const DEFAULT_QUOTAS: BucketQuotas = { new: 0.15, learning: 0.45, review: 0.3, maintenance: 0.1 };

interface Reinjection {
  factId: FactId;
  due: number;
  /** Passe 1 (après erreur) ou 2 (après réussite de la passe 1). */
  pass: 1 | 2;
}

export interface ResultReport {
  fact: Fact;
  correct: boolean;
  /** true si la réponse était fluide (juste et dans le délai). */
  fluent: boolean;
  analysis?: ErrorAnalysis;
  reinjected: boolean;
}

/**
 * Sélectionne les faits à faire apparaître et met à jour le modèle de l'apprenant.
 * Toute la logique est déterministe pour un Rng donné.
 */
export class Scheduler {
  readonly states: Map<FactId, FactState>;
  private readonly cfg: Required<Omit<SchedulerConfig, 'newTables'>> & { newTables: number[] };
  private readonly rng: Rng;
  private counter = 0;
  private history: FactId[] = [];
  private reinjections: Reinjection[] = [];
  private waveCounts: Record<Bucket, number> = { new: 0, learning: 0, review: 0, maintenance: 0 };
  private waveTotal = 0;
  /** Faits en passe de réinjection (pour planifier la passe 2). */
  private pendingPass = new Map<FactId, 1 | 2>();

  constructor(states: Map<FactId, FactState>, config: SchedulerConfig, rng: Rng) {
    this.states = states;
    this.rng = rng;
    this.cfg = {
      activeTables: [...config.activeTables],
      newTables: [...(config.newTables ?? config.activeTables)],
      maxTable: config.maxTable,
      fluentMs: config.fluentMs,
      maxNewPerWave: config.maxNewPerWave ?? 3,
      quotas: config.quotas ?? DEFAULT_QUOTAS,
      reinjectErrors: config.reinjectErrors ?? true,
      recencyWindow: config.recencyWindow ?? 6,
    };
    for (const t of this.cfg.activeTables) {
      for (const f of factsOfTable(t, this.cfg.maxTable)) {
        if (!this.states.has(f.id)) this.states.set(f.id, initialFactState(f));
      }
    }
  }

  get config(): Readonly<SchedulerConfig> {
    return this.cfg;
  }

  startWave(): void {
    this.waveCounts = { new: 0, learning: 0, review: 0, maintenance: 0 };
    this.waveTotal = 0;
  }

  bucketOf(state: FactState, now: number): Bucket {
    if (state.reps === 0) return 'new';
    if (state.pKnown < 0.8) return 'learning';
    if (retrievability(state, now) < 0.9) return 'review';
    return 'maintenance';
  }

  /** Fait "nouveau" suivant selon l'ordre pédagogique (table puis facteur). */
  private nextNewFact(excludedProducts: ReadonlySet<number>): Fact | null {
    for (const t of tableOrder(this.cfg.maxTable)) {
      if (!this.cfg.newTables.includes(t)) continue;
      for (const b of factorOrder(this.cfg.maxTable)) {
        const f = makeFact(t, b);
        const s = this.states.get(f.id);
        if (s && s.reps === 0 && !excludedProducts.has(f.product) && !this.recentlySeen(f.id)) return f;
      }
    }
    return null;
  }

  private recentlySeen(id: FactId): boolean {
    const window = this.history.slice(-this.cfg.recencyWindow);
    return window.includes(id);
  }

  private priority(state: FactState, now: number): number {
    const r = retrievability(state, now);
    const slowness = state.rtEma === 0 ? 0.5 : Math.min(1, state.rtEma / (this.cfg.fluentMs * 2));
    return 1.0 * (1 - r) + 1.2 * (1 - state.pKnown) + 0.6 * slowness + 0.05;
  }

  /**
   * Choisit le prochain fait à faire apparaître.
   * `onScreenProducts` : produits déjà visibles (jamais deux fois le même produit à l'écran).
   */
  pickNext(onScreenProducts: ReadonlySet<number>, now: number): Fact | null {
    // 1. Réinjections dues (erreurs récentes, pratique contrastive).
    const dueIdx = this.reinjections.findIndex((r) => r.due <= this.counter + 1);
    if (dueIdx >= 0) {
      const r = this.reinjections[dueIdx] as Reinjection;
      const f = parseFactId(r.factId);
      if (!onScreenProducts.has(f.product)) {
        this.reinjections.splice(dueIdx, 1);
        this.pendingPass.set(f.id, r.pass);
        return this.emit(f, this.bucketOf(this.states.get(f.id) as FactState, now));
      }
    }

    // 2. Candidats par file.
    const candidates: Record<Bucket, { fact: Fact; weight: number }[]> = {
      new: [],
      learning: [],
      review: [],
      maintenance: [],
    };
    for (const t of this.cfg.activeTables) {
      for (const f of factsOfTable(t, this.cfg.maxTable)) {
        const s = this.states.get(f.id);
        if (!s || s.reps === 0) continue;
        if (onScreenProducts.has(f.product) || this.recentlySeen(f.id)) continue;
        const b = this.bucketOf(s, now);
        candidates[b].push({ fact: f, weight: Math.exp(this.priority(s, now) * 1.6) });
      }
    }
    const newFact = this.waveCounts.new < this.cfg.maxNewPerWave ? this.nextNewFact(onScreenProducts) : null;
    if (newFact) candidates.new.push({ fact: newFact, weight: 1 });

    // 3. Choix de la file selon les quotas et le déficit courant dans la vague.
    const buckets: Bucket[] = ['new', 'learning', 'review', 'maintenance'];
    const weights = buckets.map((b) => {
      if (candidates[b].length === 0) return 0;
      const quota = this.cfg.quotas[b];
      const actual = this.waveTotal === 0 ? 0 : this.waveCounts[b] / this.waveTotal;
      return Math.max(0.02, quota + (quota - actual));
    });
    if (weights.every((w) => w === 0)) {
      // Rien d'éligible : on relâche la contrainte de récence parmi les faits déjà vus,
      // et on n'introduit un fait nouveau que si le vivier est trop petit.
      const seen: Fact[] = [];
      for (const t of this.cfg.activeTables) {
        for (const f of factsOfTable(t, this.cfg.maxTable)) {
          const s = this.states.get(f.id);
          if (s && s.reps > 0 && !onScreenProducts.has(f.product)) seen.push(f);
        }
      }
      const last = this.history[this.history.length - 1];
      const pool = seen.length > 1 ? seen.filter((f) => f.id !== last) : seen;
      const fresh = seen.length < 2 ? this.nextNewFact(onScreenProducts) : null;
      const f = fresh ?? (pool.length > 0 ? this.rng.pick(pool) : null);
      if (!f) return null;
      return this.emit(f, this.bucketOf(this.states.get(f.id) as FactState, now));
    }
    const bucket = this.rng.weighted(buckets, weights);
    const list = candidates[bucket];
    const chosen = this.rng.weighted(
      list.map((c) => c.fact),
      list.map((c) => c.weight),
    );
    return this.emit(chosen, bucket);
  }

  private emit(fact: Fact, bucket: Bucket): Fact {
    this.counter++;
    this.history.push(fact.id);
    if (this.history.length > 50) this.history.shift();
    this.waveCounts[bucket]++;
    this.waveTotal++;
    return fact;
  }

  /**
   * Enregistre le résultat d'une réponse (ou d'un impact : correct=false, answer=undefined).
   * Met à jour le modèle, programme les réinjections et la pratique contrastive.
   */
  reportResult(fact: Fact, correct: boolean, rt: number, now: number, answer?: number): ResultReport {
    const state = this.states.get(fact.id) ?? initialFactState(fact);
    const next = recordAnswer(state, { correct, rt, now, fluentMs: this.cfg.fluentMs });
    this.states.set(fact.id, next);

    const comm = commuted(fact);
    if (comm.id !== fact.id) {
      const cs = this.states.get(comm.id);
      if (cs) this.states.set(comm.id, recordCommutedCredit(cs, correct));
    }

    const fluent = correct && rt <= this.cfg.fluentMs;
    let analysis: ErrorAnalysis | undefined;
    let reinjected = false;

    if (!correct) {
      if (answer !== undefined) analysis = classifyError(fact, answer, this.cfg.maxTable);
      if (this.cfg.reinjectErrors) {
        this.schedule(fact.id, this.rng.int(3, 5), 1);
        reinjected = true;
        const cw = analysis?.confusedWith;
        if (cw && this.cfg.activeTables.includes(cw.table) && cw.product !== fact.product) {
          this.schedule(cw.id, this.rng.int(1, 3), 2);
        }
      }
      this.pendingPass.delete(fact.id);
    } else {
      const pass = this.pendingPass.get(fact.id);
      this.pendingPass.delete(fact.id);
      if (pass === 1 && this.cfg.reinjectErrors) {
        this.schedule(fact.id, this.rng.int(8, 12), 2);
        reinjected = true;
      }
    }
    return { fact, correct, fluent, analysis, reinjected };
  }

  private schedule(factId: FactId, offset: number, pass: 1 | 2): void {
    if (this.reinjections.some((r) => r.factId === factId)) return;
    this.reinjections.push({ factId, due: this.counter + offset, pass });
  }

  /** Pour les tests et l'affichage de débogage. */
  get pendingReinjections(): readonly Reinjection[] {
    return this.reinjections;
  }

  get spawnCount(): number {
    return this.counter;
  }
}
