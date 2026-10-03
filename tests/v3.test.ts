import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { pickDrillFacts } from '../src/app/screens/drill';
import { migrate } from '../src/data/storage';
import { Game } from '../src/game/Game';
import { campaignMode, reviewMode, survivalMode, weekKey, weeklyMode } from '../src/game/modes/index';
import type { SessionResult, WaveEvent } from '../src/game/types';
import { rollWaveEvent } from '../src/game/waveEvents';
import { calibratedFluentMs, pushRts } from '../src/learning/calibration';
import { factsOfTable, makeFact } from '../src/learning/facts';
import { DAY_MS, initialFactState, recordAnswer } from '../src/learning/model';
import { dueFacts, dueTables } from '../src/learning/review';
import { Scheduler } from '../src/learning/scheduler';
import type { FactId, FactState } from '../src/learning/types';

const STEP = 1 / 60;
const FLUENT = 4000;

function states(now: number): Map<FactId, FactState> {
  const m = new Map<FactId, FactState>();
  for (const f of factsOfTable(7, 10)) {
    let s = initialFactState(f);
    // faits b pairs : revus il y a longtemps (dus) ; impairs : revus à l'instant
    const when = f.b % 2 === 0 ? now - 20 * DAY_MS : now;
    for (let i = 0; i < 3; i++) s = recordAnswer(s, { correct: true, rt: 1500, now: when - (3 - i) * DAY_MS, fluentMs: FLUENT });
    m.set(f.id, s);
  }
  m.set('3x3', initialFactState(makeFact(3, 3))); // jamais vu : jamais dû
  return m;
}

describe('révision du jour', () => {
  it('sélectionne les faits dus, triés par urgence, sans les faits jamais vus', () => {
    const now = 100 * DAY_MS;
    const due = dueFacts(states(now), now);
    expect(due.length).toBe(5);
    expect(due.every((d) => Number(d.id.split('x')[1]) % 2 === 0)).toBe(true);
    expect(due.map((d) => d.id)).not.toContain('3x3');
    for (let i = 1; i < due.length; i++) expect(due[i - 1]!.priority).toBeGreaterThanOrEqual(due[i]!.priority);
    expect(dueTables(due)).toEqual([7]);
  });

  it('le scheduler sert la file prioritaire en premier, sans doublon de produit', () => {
    const now = 100 * DAY_MS;
    const s = new Scheduler(states(now), { activeTables: [7], maxTable: 10, fluentMs: FLUENT, priorityFacts: ['7x8', '7x6', '7x4'] }, new Rng(1));
    s.startWave();
    const first = s.pickNext(new Set([56]), now); // 56 déjà à l'écran → 7x6 d'abord
    expect(first?.id).toBe('7x6');
    expect(s.pickNext(new Set(), now)?.id).toBe('7x8');
    expect(s.pickNext(new Set(), now)?.id).toBe('7x4');
    expect(s.priorityLeft).toBe(0);
  });

  it('une session de révision compte les faits prioritaires résolus', () => {
    const now = Date.now();
    const st = states(now);
    const due = dueFacts(st, now).map((d) => d.id);
    const game = new Game(reviewMode(due, { maxTable: 10, fluentMs: FLUENT, tables: [7], seed: 4 }), st);
    let result: SessionResult | null = null;
    game.events.on('victory', (r) => (result = r));
    game.start();
    let ms = 0;
    let wait = 0;
    while (!result && ms < 300_000) {
      game.update(STEP);
      ms += STEP * 1000;
      wait += STEP * 1000;
      const f = game.focus;
      if (f && wait > 600 && game.projectiles.length === 0) {
        wait = 0;
        for (const ch of String(f.answer)) game.typeDigit(Number(ch));
        game.fire();
      }
    }
    expect(result).not.toBeNull();
    expect(result!.reviewed).toBe(due.length);
    expect(result!.correctRts.length).toBe(result!.correct);
  });
});

describe('calibrage de la fluidité', () => {
  it('garde le préréglage sous 15 mesures, puis suit la médiane dans des bornes', () => {
    expect(calibratedFluentMs(4000, [1000, 1000])).toBe(4000);
    const fast = Array.from({ length: 30 }, () => 1200);
    expect(calibratedFluentMs(4000, fast)).toBe(2400); // borne basse 0,6 × base
    const slow = Array.from({ length: 30 }, () => 9000);
    expect(calibratedFluentMs(4000, slow)).toBe(5600); // borne haute 1,4 × base
    const mid = Array.from({ length: 30 }, (_, i) => 2000 + (i % 5) * 100);
    const v = calibratedFluentMs(4000, mid);
    expect(v).toBeGreaterThan(2500);
    expect(v).toBeLessThan(3200);
  });
  it('pushRts conserve les 60 dernières mesures valides', () => {
    const b = pushRts(Array.from({ length: 55 }, () => 1000), [500, 0, 40000, 700, 800, 900, 1000, 1100, 1200]);
    expect(b.length).toBe(60);
    expect(b[b.length - 1]).toBe(1200);
    expect(b).not.toContain(0);
  });
});

describe('événements et défi hebdo', () => {
  it("ne tire jamais d'événement en vague 1, deux fois de suite ou quand le mode l'interdit", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      expect(rollWaveEvent(rng, 1, null, true, true)).toBeNull();
      expect(rollWaveEvent(rng, 3, 'doubleDust', true, true)).toBeNull();
      expect(rollWaveEvent(rng, 3, null, false, true)).toBeNull();
    }
    const seen = new Set<WaveEvent>();
    for (let i = 0; i < 500; i++) {
      const e = rollWaveEvent(rng, 2, null, true, false);
      if (e) seen.add(e);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(seen.has('surpriseBoss')).toBe(false);
  });

  it('un boss surprise se joue puis la partie continue jusqu\'à la victoire', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const game = new Game(campaignMode(2, { maxTable: 10, fluentMs: FLUENT, seed, reviewTables: [1, 2] }), new Map());
      const events: WaveEvent[] = [];
      let surpriseBeaten = false;
      game.events.on('waveEvent', ({ event }) => events.push(event));
      game.events.on('bossDefeated', ({ boss }) => { if (boss.surprise) surpriseBeaten = true; });
      let result: SessionResult | null = null;
      game.events.on('victory', (r) => (result = r));
      game.events.on('gameOver', (r) => (result = r));
      game.start();
      let ms = 0;
      let wait = 0;
      while (!result && ms < 600_000) {
        game.update(STEP);
        ms += STEP * 1000;
        wait += STEP * 1000;
        const f = game.focus;
        if (f && wait > 500 && game.projectiles.length === 0) {
          wait = 0;
          for (const ch of String(f.answer)) game.typeDigit(Number(ch));
          game.fire();
        }
      }
      if (events.includes('surpriseBoss')) {
        found = true;
        expect(surpriseBeaten).toBe(true);
        expect(result!.victory).toBe(true);
        expect(result!.bossesDefeated).toEqual(['titan', 'hydra']);
      }
    }
    expect(found).toBe(true);
  });

  it('la clé de semaine et le défi hebdo sont stables', () => {
    expect(weekKey(new Date(2026, 9, 3))).toBe('2026-W40');
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');
    const a = weeklyMode('2026-W40', ['hydra', 'chrono'], { maxTable: 10, fluentMs: FLUENT, tables: [2, 5] });
    const b = weeklyMode('2026-W40', ['hydra', 'chrono'], { maxTable: 10, fluentMs: FLUENT, tables: [2, 5] });
    expect(a.seed).toBe(b.seed);
    expect(a.bosses).toEqual(b.bosses);
    expect(['hydra', 'chrono']).toContain(a.bosses[0]);
    expect(a.waveEvents).toBe(false);
    expect(survivalMode({ maxTable: 10, fluentMs: FLUENT, tables: [2] }).waveEvents).toBe(true);
  });
});

describe('mini-drill et migration', () => {
  it('choisit au plus 5 faits : ratés puis voisins, sans produit répété d\'affilée', () => {
    const base = { modeId: 'campaign', sector: 0, score: 0, destroyed: 0, correct: 0, powerupKills: 0, answered: 0, errors: 0, hitsTaken: 0, accuracy: 1, avgRt: 0, fluentRatio: 0, maxCombo: 0, stardust: 0, xp: 0, stars: 0, victory: true, bossesDefeated: [], durationMs: 0, wavesCleared: 0, factOutcomes: [], newlyMastered: [], perfect: false, aborted: false, correctRts: [], reviewed: 0 } as Omit<SessionResult, 'weakFacts'>;
    const facts = pickDrillFacts({ ...base, weakFacts: ['7x8', '6x7'] }, 10);
    expect(facts.length).toBe(5);
    expect(facts.slice(0, 2).map((f) => f.id)).toEqual(['7x8', '6x7']);
    for (let i = 1; i < facts.length; i++) expect(facts[i]!.product).not.toBe(facts[i - 1]!.product);
    expect(pickDrillFacts({ ...base, weakFacts: [] }, 10)).toEqual([]);
  });

  it('migre une sauvegarde v1 vers v2 avec les nouveaux champs', () => {
    const m = migrate({ version: 1, profiles: [{ name: 'Léa', stats: { sessions: 3, destroyed: 10 } }], settings: { autoFire: false } });
    const p = m.profiles[0]!;
    expect(m.version).toBe(2);
    expect(p.autoFluent).toBe(true);
    expect(p.weekly).toBeNull();
    expect(p.stats.recentRts).toEqual([]);
    expect(p.stats.sessions).toBe(3);
    expect(m.settings.hintStyle).toBe('both');
    expect(m.settings.autoFire).toBe(false);
  });
});
