import { describe, expect, it } from 'vitest';
import { Rng, seedFromString } from '../src/core/rng';
import { migrate } from '../src/data/storage';
import { Game } from '../src/game/Game';
import { bossRushMode, campaignMode, dailyMode, reviewMode, survivalMode } from '../src/game/modes/index';
import type { BossKind, ModeConfig, SessionResult } from '../src/game/types';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { classifyError } from '../src/learning/confusions';
import { commuted, factEquation, factLabel, factsOfTable, makeFact, mirrorOf, parseFactId, twinOp } from '../src/learning/facts';
import { DAY_MS, fluentFor, initialFactState, masteryLevel, recordAnswer } from '../src/learning/model';
import { Scheduler } from '../src/learning/scheduler';
import { chooseStrategy } from '../src/learning/strategies';
import type { Fact, FactId, FactState } from '../src/learning/types';

const STEP = 1 / 60;
const FLUENT = 4000;

/** Joueur parfait : tape la réponse attendue de la cible focus. `onFrame` permet d'observer l'état. */
function play(game: Game, opts: { delayMs?: number; maxSeconds?: number; onFrame?: (g: Game) => void } = {}): SessionResult | null {
  let result: SessionResult | null = null;
  game.events.on('victory', (r) => (result = r));
  game.events.on('gameOver', (r) => (result = r));
  game.start();
  let ms = 0;
  let wait = 0;
  const delay = opts.delayMs ?? 650;
  while (!result && ms < (opts.maxSeconds ?? 500) * 1000) {
    game.update(STEP);
    ms += STEP * 1000;
    wait += STEP * 1000;
    opts.onFrame?.(game);
    const f = game.focus;
    if (f && wait >= delay && game.projectiles.length === 0 && game.phase !== 'help') {
      wait = 0;
      for (const ch of String(f.answer)) game.typeDigit(Number(ch));
      game.fire();
    }
  }
  return result;
}

describe('faits de division : résultats toujours entiers', () => {
  it('chaque division des tables 1 à 12 tombe juste (pas de reste, pas de zéro)', () => {
    for (let table = 1; table <= 12; table++) {
      for (const f of factsOfTable(table, 12, 'div')) {
        expect(f.op).toBe('div');
        expect(f.product % f.a).toBe(0);
        expect(Number.isInteger(f.product / f.a)).toBe(true);
        expect(f.product / f.a).toBe(f.answer);
        expect(f.answer * f.a).toBe(f.product);
        expect(f.a).toBeGreaterThanOrEqual(1);
        expect(f.answer).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('identifiants, libellés, commutation et jumeau', () => {
    const d = makeFact(7, 8, 'div');
    expect(d.id).toBe('7d8');
    expect(factLabel(d)).toBe('56 ÷ 7');
    expect(factEquation(d)).toBe('56 ÷ 7 = 8');
    expect(parseFactId('7d8')).toEqual(d);
    expect(parseFactId('7x8').op).toBe('mul');
    expect(factEquation(makeFact(7, 8))).toBe('7 × 8 = 56');
    expect(commuted(d).id).toBe('8d7');
    expect(factLabel(commuted(d))).toBe('56 ÷ 8');
    expect(twinOp(d).id).toBe('7x8');
    expect(twinOp(makeFact(7, 8)).id).toBe('7d8');
    expect(mirrorOf(d)).toEqual({ label: '? ÷ 7 = 8', answer: 56 });
    expect(mirrorOf(makeFact(7, 8))).toEqual({ label: '7 × ? = 56', answer: 8 });
    expect(() => parseFactId('7z8')).toThrow();
  });
});

describe('modèle et confusions en division', () => {
  it('la division a un seuil de fluidité × 1,25 (maîtrise et réponse fluide)', () => {
    expect(fluentFor(4000, 'div')).toBe(5000);
    expect(fluentFor(4000, 'mul')).toBe(4000);
    const mk = (f: Fact): FactState => ({ ...initialFactState(f), pKnown: 0.97, reps: 8, rtEma: 4500, recent: Array.from({ length: 5 }, () => ({ correct: true, rt: 4500 })) });
    expect(masteryLevel(mk(makeFact(7, 8)), 4000)).toBe(3);
    expect(masteryLevel(mk(makeFact(7, 8, 'div')), 4000)).toBe(4);
    // Une réponse en 4,5 s fait progresser la division plus vite que la multiplication.
    const mul = recordAnswer(initialFactState(makeFact(6, 7)), { correct: true, rt: 4500, now: 1, fluentMs: 4000 });
    const div = recordAnswer(initialFactState(makeFact(6, 7, 'div')), { correct: true, rt: 4500, now: 1, fluentMs: 4000 });
    expect(div.stability).toBeGreaterThan(0);
    expect(div.pKnown / initialFactState(makeFact(6, 7, 'div')).pKnown).toBeGreaterThan(mul.pKnown / initialFactState(makeFact(6, 7)).pKnown);
  });

  it('classifie les erreurs de division : écho du diviseur, quotient voisin', () => {
    const f = makeFact(7, 8, 'div'); // 56 ÷ 7 = 8
    expect(classifyError(f, 7, 10).kind).toBe('divisor-echo');
    const nb = classifyError(f, 9, 10);
    expect(nb.kind).toBe('neighbor-b');
    expect(nb.confusedWith?.id).toBe('7d9');
    expect(classifyError(f, 7 + 1, 10).kind).toBe('unknown'); // 8 = bonne réponse
    expect(classifyError(f, 3, 10).kind).toBe('unknown');
  });

  it('la carte de méthode d\'une division pense « a × ? = p » avec la méthode de la multiplication', () => {
    const s = chooseStrategy(makeFact(7, 8, 'div'));
    expect(s.op).toBe('div');
    expect(s.steps[0]).toEqual({ key: 'divide', params: { p: 56, a: 7, b: 8 } });
    expect(s.steps[s.steps.length - 1]).toEqual({ key: 'divAnswer', params: { p: 56, a: 7, b: 8 } });
    expect(s.steps.length).toBeGreaterThan(2);
    expect(chooseStrategy(makeFact(7, 8)).op).toBe('mul');
    // Division par 1 : pas d'étape de commutation redondante.
    const byOne = chooseStrategy(makeFact(1, 7, 'div'));
    expect(byOne.steps.map((x) => x.key)).toEqual(['divide', 'identity', 'divAnswer']);
  });
});

describe('scheduler avec divisions', () => {
  it('en mode ÷ il ne sert que des divisions, en mode mixte les deux', () => {
    const div = new Scheduler(new Map(), { activeTables: [3, 7], maxTable: 10, fluentMs: FLUENT, ops: 'div' }, new Rng(1));
    div.startWave();
    for (let i = 0; i < 300; i++) {
      const f = div.pickNext(new Set(), 1000 + i)!;
      expect(f.op).toBe('div');
      div.reportResult(f, true, 1500, 1000 + i);
    }
    const mixed = new Scheduler(new Map(), { activeTables: [3, 7], maxTable: 10, fluentMs: FLUENT, ops: 'mixed', maxNewPerWave: 6 }, new Rng(2));
    const ops = new Set<string>();
    for (let w = 0; w < 30; w++) {
      mixed.startWave();
      for (let i = 0; i < 12; i++) {
        const f = mixed.pickNext(new Set(), 1000 + w * 20 + i)!;
        ops.add(f.op);
        mixed.reportResult(f, true, 1500, 1000 + w * 20 + i);
      }
    }
    expect(ops).toEqual(new Set(['mul', 'div']));
  });

  it('en mode mixte, jamais deux réponses identiques à l\'écran (7 × 1 et 56 ÷ 8 valent 7)', () => {
    const rng = new Rng(5);
    const sch = new Scheduler(new Map(), { activeTables: [1, 2, 7, 8], maxTable: 10, fluentMs: FLUENT, ops: 'mixed', maxNewPerWave: 8 }, rng);
    sch.startWave();
    const onScreen: number[] = [];
    for (let i = 0; i < 600; i++) {
      const f = sch.pickNext(new Set(onScreen), 1000 + i);
      expect(f).not.toBeNull();
      expect(onScreen).not.toContain(f!.answer);
      onScreen.push(f!.answer);
      if (onScreen.length > 3) onScreen.shift();
      sch.reportResult(f!, rng.chance(0.85), 2000, 1000 + i);
    }
  });

  it('en mode mixte une division n\'est introduite qu\'après sa multiplication jumelle', () => {
    const states = new Map<FactId, FactState>();
    const sch = new Scheduler(states, { activeTables: [7], maxTable: 10, fluentMs: FLUENT, ops: 'mixed', maxNewPerWave: 4 }, new Rng(3));
    const seenDiv = new Set<string>();
    for (let w = 0; w < 25; w++) {
      sch.startWave();
      for (let i = 0; i < 10; i++) {
        const f = sch.pickNext(new Set(), 1000 + w * 30 + i)!;
        if (f.op === 'div' && !seenDiv.has(f.id)) {
          seenDiv.add(f.id);
          // Avant la toute première apparition, la multiplication jumelle avait déjà été jouée.
          expect(states.get(twinOp(f).id)!.reps).toBeGreaterThan(0);
        }
        sch.reportResult(f, true, 1500, 1000 + w * 30 + i);
      }
    }
    expect(seenDiv.size).toBeGreaterThan(0);
  });

  it('amorce une division à partir de la multiplication jumelle connue, sans la compter comme vue', () => {
    const now = 50 * DAY_MS;
    const states = new Map<FactId, FactState>();
    let s = initialFactState(makeFact(7, 8));
    for (let i = 0; i < 6; i++) s = recordAnswer(s, { correct: true, rt: 1500, now: now - (6 - i) * DAY_MS, fluentMs: FLUENT });
    states.set('7x8', s);
    new Scheduler(states, { activeTables: [7], maxTable: 10, fluentMs: FLUENT, ops: 'div' }, new Rng(1));
    const d = states.get('7d8')!;
    expect(d.reps).toBe(0);
    expect(d.pKnown).toBeGreaterThan(initialFactState(makeFact(7, 8, 'div')).pKnown);
    expect(d.pKnown).toBeLessThanOrEqual(0.7);
    // Une table jamais jouée en multiplication garde le prior de division.
    expect(states.get('7d3')!.pKnown).toBeLessThan(0.5);
  });

  it('un succès en multiplication donne un petit crédit à la division jumelle déjà vue, pas à une division jamais vue', () => {
    const states = new Map<FactId, FactState>();
    const sch = new Scheduler(states, { activeTables: [6], maxTable: 10, fluentMs: FLUENT, ops: 'mixed' }, new Rng(1));
    states.set('6d7', { ...states.get('6d7')!, reps: 3, pKnown: 0.4, lastReview: 1 });
    const before = states.get('6d7')!.pKnown;
    const untouched = states.get('6d8')!.pKnown;
    sch.reportResult(makeFact(6, 7), true, 1500, 1000);
    expect(states.get('6d7')!.pKnown).toBeGreaterThan(before);
    sch.reportResult(makeFact(6, 8), true, 1500, 1000);
    expect(states.get('6d8')!.pKnown).toBe(untouched);
  });

  it('la file prioritaire accepte les identifiants de division', () => {
    const states = new Map<FactId, FactState>();
    const sch = new Scheduler(states, { activeTables: [7], maxTable: 10, fluentMs: FLUENT, ops: 'div', priorityFacts: ['7d8', '7d6'] }, new Rng(1));
    sch.startWave();
    expect(sch.pickNext(new Set([8]), 1000)?.id).toBe('7d6'); // 8 déjà à l'écran
    expect(sch.pickNext(new Set(), 1000)?.id).toBe('7d8');
  });
});

describe('parties en division', () => {
  const input = (ops: 'mul' | 'div' | 'mixed', extra: Partial<{ tables: number[]; seed: number }> = {}) => ({ maxTable: 10, fluentMs: FLUENT, tables: [2, 5, 7], seed: 11, ops, ...extra });

  it('un secteur de campagne se gagne entièrement en divisions, toutes à résultat entier', () => {
    const mode = campaignMode(3, { maxTable: 10, fluentMs: FLUENT, seed: 4, reviewTables: [1, 2], ops: 'div' });
    expect(mode.ops).toBe('div');
    const game = new Game(mode, new Map());
    const labels = new Set<string>();
    game.events.on('spawn', (a) => {
      labels.add(a.label);
      expect(a.label).toMatch(/^\d+ ÷ \d+$/);
      const [dividend, divisor] = a.label.split(' ÷ ').map(Number);
      expect(dividend! % divisor!).toBe(0);
      expect(dividend! / divisor!).toBe(a.answer);
      expect(a.fact.op).toBe('div');
    });
    const r = play(game)!;
    expect(r.victory).toBe(true);
    expect(r.ops).toBe('div');
    expect(r.errors).toBe(0);
    expect(r.divCorrect).toBe(r.correct);
    expect(r.divCorrect).toBeGreaterThan(30);
    expect(labels.size).toBeGreaterThan(5);
    // Les états de division existent, ceux de multiplication de la table jouée n'ont pas bougé.
    expect([...game.scheduler.states.keys()].some((k) => k.includes('d'))).toBe(true);
    expect(r.factOutcomes.every((o) => o.factId.includes('d'))).toBe(true);
  });

  it('une partie mixte mélange × et ÷ sans jamais montrer deux réponses identiques', () => {
    const game = new Game(survivalMode(input('mixed', { tables: [1, 2, 5] })), new Map());
    const kinds = new Set<string>();
    game.events.on('spawn', (a) => kinds.add(a.fact.op));
    let clashes = 0;
    let maxOnScreen = 0;
    play(game, {
      maxSeconds: 240,
      onFrame: (g) => {
        const alive = g.asteroids.filter((a) => a.alive).map((a) => a.answer);
        maxOnScreen = Math.max(maxOnScreen, alive.length);
        if (new Set(alive).size !== alive.length) clashes++;
      },
    });
    expect(kinds).toEqual(new Set(['mul', 'div']));
    expect(clashes).toBe(0);
    expect(maxOnScreen).toBeGreaterThan(1);
  });

  it('les parties en multiplication n\'ont aucune division (comportement inchangé)', () => {
    const game = new Game(survivalMode(input('mul')), new Map());
    game.events.on('spawn', (a) => {
      expect(a.fact.op).toBe('mul');
      expect(a.label).toContain('×');
    });
    play(game, { maxSeconds: 60 });
    expect([...game.scheduler.states.keys()].every((k) => !k.includes('d'))).toBe(true);
  });

  it('chaque boss se bat en divisions ; le Miroir demande le dividende (« ? ÷ 7 = 8 »)', () => {
    const kinds: BossKind[] = ['titan', 'swarm', 'hydra', 'twins', 'mirror', 'phantom', 'chrono', 'mothership'];
    for (const kind of kinds) {
      const game = new Game(bossRushMode([kind], [6], { ...input('div', { tables: [2, 6] }), seed: 21 }), new Map());
      let defeated: BossKind | null = null;
      const labels: string[] = [];
      game.events.on('bossDefeated', ({ boss }) => (defeated = boss.kind));
      const r = play(game, {
        delayMs: 600,
        maxSeconds: 400,
        onFrame: (g) => {
          for (const t of g.boss?.targets ?? []) if (!labels.includes(t.label)) labels.push(t.label);
          // Jamais deux cibles de boss avec la même réponse (hors paires jumelles volontaires).
          if (kind !== 'twins') {
            const alive = (g.boss?.targets ?? []).filter((t) => t.alive);
            const ans = alive.map((t) => t.answer);
            expect(new Set(ans).size, `${kind}: ${alive.map((t) => `${t.label}=${t.answer}`).join(' | ')}`).toBe(ans.length);
          }
        },
      });
      expect(defeated, kind).toBe(kind);
      expect(r?.victory, kind).toBe(true);
      expect(labels.length, kind).toBeGreaterThan(0);
      for (const l of labels) {
        if (kind === 'mirror' || kind === 'mothership') {
          expect(l.includes('÷')).toBe(true);
          expect(l.includes('×')).toBe(false);
        } else {
          expect(l, `${kind}: ${l}`).toMatch(/^\d+ ÷ \d+$/);
        }
      }
      if (kind === 'mirror') {
        for (const l of labels) {
          if (l.startsWith('?')) expect(/^\? ÷ (\d+) = (\d+)$/.exec(l), l).not.toBeNull();
        }
      }
    }
  });

  it('les jumeaux de division sont des diviseurs commutés (56 ÷ 7 et 56 ÷ 8)', () => {
    const game = new Game(bossRushMode(['twins'], [7], input('div', { tables: [7], seed: 8 })), new Map());
    game.start();
    for (let i = 0; i < 60 * 6; i++) game.update(STEP);
    const targets = game.boss!.targets;
    expect(targets.length).toBeGreaterThanOrEqual(2);
    for (const t of targets) {
      const twin = targets.find((x) => x.id === t.twinId)!;
      expect(twin).toBeDefined();
      expect(t.fact.product).toBe(twin.fact.product);
      expect(t.fact.a).toBe(twin.fact.b);
      expect(t.answer).toBe(twin.fact.a);
    }
  });

  it('le seuil de rapidité en division est × 1,25 et les temps du calibrage sont normalisés', () => {
    const fast = new Game(campaignMode(0, { maxTable: 10, fluentMs: FLUENT, seed: 1, ops: 'div' }), new Map());
    const r = play(fast, { delayMs: 1200 })!;
    expect(r.correctRts.length).toBe(r.correct);
    // rt normalisé = rt réel / 1,25 : jamais au-dessus du temps réel moyen.
    expect(Math.max(...r.correctRts)).toBeLessThan(FLUENT * 3);
  });

  it('la révision du jour sert aussi des divisions dues', () => {
    const now = Date.now();
    const states = new Map<FactId, FactState>();
    for (const f of factsOfTable(7, 10, 'div')) {
      let s = initialFactState(f);
      for (let i = 0; i < 3; i++) s = recordAnswer(s, { correct: true, rt: 2000, now: now - 20 * DAY_MS - (3 - i) * DAY_MS, fluentMs: FLUENT });
      states.set(f.id, s);
    }
    const due = ['7d4', '7d6', '7d8', '7d9'];
    const mode: ModeConfig = reviewMode(due, { maxTable: 10, fluentMs: FLUENT, tables: [7], seed: 5, ops: 'div' });
    const r = play(new Game(mode, states))!;
    expect(r.victory).toBe(true);
    expect(r.reviewed).toBe(due.length);
  });
});

describe('défis seedés, sauvegarde et traductions', () => {
  it('la seed du défi du jour ne change pas en multiplication et diffère en division', () => {
    const mul = dailyMode('2026-10-03', { maxTable: 10, fluentMs: FLUENT, tables: [2, 3], ops: 'mul' });
    const none = dailyMode('2026-10-03', { maxTable: 10, fluentMs: FLUENT, tables: [2, 3] });
    const div = dailyMode('2026-10-03', { maxTable: 10, fluentMs: FLUENT, tables: [2, 3], ops: 'div' });
    expect(mul.seed).toBe(seedFromString('2026-10-03'));
    expect(none.seed).toBe(mul.seed);
    expect(div.seed).not.toBe(mul.seed);
    expect(div.seed).toBe(seedFromString('2026-10-03:div'));
  });

  it('migre une sauvegarde v2 : états de multiplication intacts, ops par défaut, compteur de divisions', () => {
    const fact = { id: '7x8', pKnown: 0.9, stability: 3, lastReview: 5, reps: 4, lapses: 0, rtEma: 2000, recent: [], streak: 4 };
    const m = migrate({ version: 2, profiles: [{ name: 'Léa', facts: { '7x8': fact }, stats: { sessions: 2, destroyed: 9 } }], settings: {} });
    const p = m.profiles[0]!;
    expect(m.version).toBe(3);
    expect(p.ops).toBe('mul');
    expect(p.stats.divCorrect).toBe(0);
    expect(p.facts['7x8']).toEqual(fact);
    expect(Object.keys(p.facts)).toEqual(['7x8']);
    expect(p.stats.sessions).toBe(2);
  });

  it('toutes les clés de division existent en français et en anglais, et les deux langues restent alignées', () => {
    const keys = ['ops.title', 'ops.mul', 'ops.div', 'ops.mixed', 'ops.mul.desc', 'ops.div.desc', 'ops.mixed.desc', 'ops.hint', 'game.divisorEcho', 'strategy.divide', 'strategy.step.divide', 'strategy.step.divAnswer', 'speech.divides', 'speech.divEquals', 'dash.divGridHint', 'dash.divCorrect', 'ach.div_first', 'ach.div_first.desc', 'ach.div_master', 'ach.div_master.desc'];
    for (const k of keys) {
      expect((fr as Record<string, string>)[k], k).toBeTruthy();
      expect((en as Record<string, string>)[k], k).toBeTruthy();
    }
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
});
