import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game';
import { bossRushMode, campaignMode, practiceMode } from '../src/game/modes/index';
import { makeFact } from '../src/learning/facts';
import { initialFactState } from '../src/learning/model';
import { chooseStrategy } from '../src/learning/strategies';
import type { FactId, FactState } from '../src/learning/types';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';

const STEP = 1 / 60;

/** Le dernier résultat des étapes doit être le produit (ou l'identité). */
function lastResult(s: ReturnType<typeof chooseStrategy>): number {
  const last = s.steps[s.steps.length - 1]!;
  return last.key === 'identity' ? last.params.x! : last.params.r!;
}

describe('chooseStrategy', () => {
  it('propose une méthode cohérente pour chaque second facteur de 1 à 12', () => {
    const expected: Record<number, string> = { 1: 'identity', 2: 'double', 3: 'double-plus', 4: 'double-double', 5: 'half-tens', 6: 'five-plus', 7: 'five-two', 8: 'double-four', 9: 'tens-minus', 10: 'tens', 11: 'eleven', 12: 'twelve' };
    for (let b = 1; b <= 12; b++) {
      const s = chooseStrategy(makeFact(7, b), new Map(), 12);
      expect(s.kind).toBe(expected[b]);
      expect(lastResult(s)).toBe(7 * b);
      expect(s.parts.filter((p) => p.color === 'main' || p.color === 'alt').reduce((n, p) => n + p.cols, 0)).toBe(b);
    }
  });

  it("retourne le calcul quand l'autre facteur est plus simple, en rappelant la commutativité", () => {
    const s = chooseStrategy(makeFact(9, 7));
    expect(s.commuted).toBe(true);
    expect(s.a).toBe(7);
    expect(s.b).toBe(9);
    expect(s.kind).toBe('tens-minus');
    expect(s.steps[0]!.key).toBe('commute');
    expect(lastResult(s)).toBe(63);
    expect(chooseStrategy(makeFact(7, 9)).commuted).toBe(false);
    expect(chooseStrategy(makeFact(3, 8)).kind).toBe('double-plus'); // 8 × 3 : le double de 8 plus 8
  });

  it('utilise un fait voisin bien connu quand il existe', () => {
    const states = new Map<FactId, FactState>();
    states.set('6x6', { ...initialFactState(makeFact(6, 6)), pKnown: 0.95, reps: 5 });
    const s = chooseStrategy(makeFact(6, 7), states);
    expect(s.kind).toBe('neighbor-down');
    expect(s.steps.map((x) => x.params.r)).toEqual([36, 42]);
    const up = new Map<FactId, FactState>([['8x10', { ...initialFactState(makeFact(8, 10)), pKnown: 0.95, reps: 5 }]]);
    expect(chooseStrategy(makeFact(8, 9), up).kind).toBe('neighbor-up');
    // jamais de voisin pour ×1, ×2, ×10 (déjà triviaux)
    const triv = new Map<FactId, FactState>([['7x3', { ...initialFactState(makeFact(7, 3)), pKnown: 0.95, reps: 5 }]]);
    expect(chooseStrategy(makeFact(7, 2), triv).kind).toBe('double');
    // Pas de méthode « voisin » pour un cas trivial, même si le voisin est connu (7 × 1 = 1 × 7 avec 1 × 6 connu).
    const one = new Map<FactId, FactState>([['1x6', { ...initialFactState(makeFact(1, 6)), pKnown: 0.95, reps: 5 }]]);
    expect(chooseStrategy(makeFact(7, 1), one).kind).toBe('identity');
    expect(chooseStrategy(makeFact(1, 7), one).kind).toBe('identity');
  });

  it('les clés i18n des stratégies existent en français et en anglais', () => {
    for (const kind of ['identity', 'double', 'tens', 'half-tens', 'tens-minus', 'double-double', 'double-plus', 'five-plus', 'double-four', 'five-two', 'eleven', 'twelve', 'neighbor-down', 'neighbor-up']) {
      expect((fr as Record<string, string>)[`strategy.${kind}`]).toBeTruthy();
      expect((en as Record<string, string>)[`strategy.${kind}`]).toBeTruthy();
    }
    for (const step of ['times', 'plus', 'minus', 'half', 'zero', 'identity', 'commute']) expect((fr as Record<string, string>)[`strategy.step.${step}`]).toBeTruthy();
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
});

describe('carte de méthode en jeu', () => {
  function started(mode = campaignMode(3, { maxTable: 10, fluentMs: 4000, seed: 7 })): Game {
    const game = new Game(mode, new Map());
    game.start();
    for (let i = 0; i < 60 * 6; i++) game.update(STEP);
    expect(game.focus).not.toBeNull();
    return game;
  }

  it('fige le temps, coupe le combo et marque la cible ; un chiffre tapé ferme la carte', () => {
    const game = started();
    game.combo = 5;
    const focus = game.focus!;
    let opened = 0;
    game.events.on('help', () => opened++);
    expect(game.requestHelp(1000)).toBe(true);
    expect(game.phase).toBe('help');
    expect(opened).toBe(1);
    expect(game.combo).toBe(0);
    expect(focus.helped).toBe(true);
    expect(game.help?.strategy.product).toBe(focus.answer);
    const t0 = game.time;
    for (let i = 0; i < 60; i++) game.update(STEP);
    expect(game.time).toBe(t0);
    game.typeDigit(Number(String(focus.answer)[0]));
    expect(game.phase).toBe('playing');
    // Le chiffre est pris en compte : soit dans le tampon, soit tir automatique immédiat.
    expect(game.buffer === String(focus.answer)[0] || game.projectiles.length === 1).toBe(true);
    expect(game.buildResult(false).helps).toBe(1);
  });

  it("une cible aidée n'est jamais fluide et ne nourrit pas le calibrage", () => {
    const game = started();
    const focus = game.focus!;
    game.requestHelp(0);
    game.closeHelp();
    let fluent: boolean | null = null;
    game.events.on('destroyed', (e) => (fluent = e.fluent));
    for (const ch of String(focus.answer)) game.typeDigit(Number(ch));
    game.fire();
    for (let i = 0; i < 60 * 2 && fluent === null; i++) game.update(STEP);
    expect(fluent).toBe(false);
    const r = game.buildResult(false);
    expect(r.correct).toBe(1);
    expect(r.correctRts).toEqual([]);
    expect(r.fluentRatio).toBe(0);
  });

  it('refuse l\'aide face au Fantôme', () => {
    const game = new Game(bossRushMode(['phantom'], [6], { maxTable: 10, fluentMs: 4000, tables: [6], seed: 2 }), new Map());
    game.start();
    for (let i = 0; i < 60 * 6; i++) game.update(STEP);
    expect(game.boss?.kind).toBe('phantom');
    let refused = 0;
    game.events.on('helpRefused', () => refused++);
    expect(game.requestHelp(0)).toBe(false);
    expect(refused).toBe(1);
    expect(game.phase).toBe('boss');
  });

  it("l'aide est gratuite en Entraînement", () => {
    const game = started(practiceMode({ maxTable: 10, fluentMs: 4000, tables: [8], seed: 3 }));
    game.combo = 4;
    game.requestHelp(0);
    expect(game.combo).toBe(4);
    expect(game.focus?.helped).toBe(false);
    game.closeHelp();
    expect(game.phase).toBe('playing');
  });
});
