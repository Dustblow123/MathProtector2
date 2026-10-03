import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { factsOfTable, makeFact } from '../src/learning/facts';
import { DAY_MS, initialFactState, recordAnswer } from '../src/learning/model';
import { Scheduler } from '../src/learning/scheduler';
import type { FactId, FactState } from '../src/learning/types';

const FLUENT = 4000;

function trainedStates(tables: number[], maxTable: number, now: number, opts: { pKnown?: number } = {}) {
  const states = new Map<FactId, FactState>();
  for (const t of tables) {
    for (const f of factsOfTable(t, maxTable)) {
      let s = initialFactState(f);
      for (let i = 0; i < 6; i++) s = recordAnswer(s, { correct: true, rt: 1500, now: now - (6 - i) * DAY_MS, fluentMs: FLUENT });
      if (opts.pKnown !== undefined) s = { ...s, pKnown: opts.pKnown };
      states.set(f.id, s);
    }
  }
  return states;
}

describe('Scheduler', () => {
  it('est déterministe pour une seed donnée', () => {
    const run = () => {
      const s = new Scheduler(new Map(), { activeTables: [2, 5], maxTable: 10, fluentMs: FLUENT }, new Rng(42));
      s.startWave();
      const out: string[] = [];
      for (let i = 0; i < 20; i++) {
        const f = s.pickNext(new Set(), 1000);
        if (f) {
          out.push(f.id);
          s.reportResult(f, i % 3 !== 0, 2000, 1000 + i);
        }
      }
      return out.join(',');
    };
    expect(run()).toBe(run());
  });

  it("ne propose jamais un produit déjà à l'écran", () => {
    const rng = new Rng(7);
    const s = new Scheduler(new Map(), { activeTables: [2, 3, 4, 6], maxTable: 10, fluentMs: FLUENT }, rng);
    s.startWave();
    for (let round = 0; round < 300; round++) {
      const onScreen = new Set<number>([12, 24, 6, 18]);
      const f = s.pickNext(onScreen, 1000 + round);
      expect(f).not.toBeNull();
      expect(onScreen.has(f!.product)).toBe(false);
      s.reportResult(f!, rng.chance(0.8), 2000, 1000 + round);
    }
  });

  it('introduit les faits nouveaux progressivement (max par vague) et dans l\'ordre pédagogique', () => {
    const s = new Scheduler(new Map(), { activeTables: [7], maxTable: 10, fluentMs: FLUENT, maxNewPerWave: 2 }, new Rng(1));
    s.startWave();
    const firstWave: string[] = [];
    for (let i = 0; i < 10; i++) {
      const f = s.pickNext(new Set(), 1000 + i);
      if (!f) break;
      firstWave.push(f.id);
      s.reportResult(f, true, 1500, 1000 + i);
    }
    const distinct = new Set(firstWave);
    expect(distinct.size).toBeLessThanOrEqual(2);
    expect(firstWave[0]).toBe('7x1');
    expect(firstWave).toContain('7x2');
  });

  it("réinjecte un fait raté dans les 3 à 5 tirages suivants, puis une seconde fois après réussite", () => {
    const rng = new Rng(3);
    const now = 10 * DAY_MS;
    const states = trainedStates([2, 3, 4, 5], 10, now);
    const s = new Scheduler(states, { activeTables: [2, 3, 4, 5], maxTable: 10, fluentMs: FLUENT }, rng);
    s.startWave();
    const target = makeFact(3, 4);
    s.reportResult(target, false, 5000, now, 15);
    const pending = s.pendingReinjections.map((r) => r.factId);
    expect(pending).toContain('3x4');
    const seq: string[] = [];
    let secondSeen = -1;
    for (let i = 0; i < 20; i++) {
      const f = s.pickNext(new Set(), now + i);
      seq.push(f!.id);
      if (f!.id === '3x4') {
        if (seq.length <= 5) {
          s.reportResult(f!, true, 1500, now + i); // passe 1 réussie → passe 2 programmée
        } else {
          secondSeen = seq.length;
          break;
        }
      } else {
        s.reportResult(f!, true, 1500, now + i);
      }
    }
    const firstSeen = seq.indexOf('3x4') + 1;
    expect(firstSeen).toBeGreaterThanOrEqual(3);
    expect(firstSeen).toBeLessThanOrEqual(5);
    expect(secondSeen).toBeGreaterThan(firstSeen + 7);
  });

  it('programme la pratique contrastive sur une confusion de table voisine', () => {
    const now = 10 * DAY_MS;
    const states = trainedStates([6], 10, now);
    const s = new Scheduler(states, { activeTables: [6], maxTable: 10, fluentMs: FLUENT }, new Rng(9));
    s.startWave();
    const r = s.reportResult(makeFact(6, 7), false, 3000, now, 48);
    expect(r.analysis?.kind).toBe('neighbor-b');
    const ids = s.pendingReinjections.map((x) => x.factId);
    expect(ids).toContain('6x7');
    expect(ids).toContain('6x8');
  });

  it('respecte approximativement les quotas des files sur un grand échantillon', () => {
    const now = 30 * DAY_MS;
    const states = new Map<FactId, FactState>();
    const tables = [2, 3, 4, 5, 6];
    for (const t of tables) {
      for (const f of factsOfTable(t, 10)) {
        let st = initialFactState(f);
        const roll = f.b % 4;
        if (roll === 0) {
          // jamais vu → new
        } else if (roll === 1) {
          st = recordAnswer(st, { correct: true, rt: 2000, now: now - DAY_MS, fluentMs: FLUENT });
          st = { ...st, pKnown: 0.5 }; // learning
        } else if (roll === 2) {
          for (let i = 0; i < 5; i++) st = recordAnswer(st, { correct: true, rt: 1500, now: now - 20 * DAY_MS, fluentMs: FLUENT });
          st = { ...st, pKnown: 0.9, stability: 1 }; // review (dû)
        } else {
          for (let i = 0; i < 5; i++) st = recordAnswer(st, { correct: true, rt: 1500, now, fluentMs: FLUENT });
          st = { ...st, pKnown: 0.97, stability: 60 }; // maintenance
        }
        states.set(f.id, st);
      }
    }
    const s = new Scheduler(states, { activeTables: tables, maxTable: 10, fluentMs: FLUENT, reinjectErrors: false, maxNewPerWave: 3 }, new Rng(11));
    const counts = { new: 0, learning: 0, review: 0, maintenance: 0 };
    let total = 0;
    for (let w = 0; w < 60; w++) {
      s.startWave();
      for (let i = 0; i < 14; i++) {
        const f = s.pickNext(new Set(), now);
        if (!f) continue;
        const st = s.states.get(f.id)!;
        counts[s.bucketOf(st, now)]++;
        total++;
        // on ne modifie pas le modèle pour garder les files stables
      }
    }
    const ratio = (k: keyof typeof counts) => counts[k] / total;
    expect(ratio('learning')).toBeGreaterThan(0.3);
    expect(ratio('review')).toBeGreaterThan(0.18);
    expect(ratio('maintenance')).toBeLessThan(0.25);
    expect(ratio('new')).toBeLessThan(0.3);
  });
});
