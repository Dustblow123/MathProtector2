import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Game } from '../src/game/Game';
import { bossRushMode, campaignMode } from '../src/game/modes/index';
import { STARDUST_RATE, StardustPurse } from '../src/game/scoring';
import type { SessionResult } from '../src/game/types';
import { ACHIEVEMENTS } from '../src/progression/achievements';

const STEP = 1 / 60;

/** Espionne la bourse du jeu pour reconstituer la poussière brute (avant taux). */
function spyPurse(game: Game): { raw: () => number; calls: () => number[] } {
  const purse = (game as unknown as { purse: StardustPurse }).purse;
  const orig = purse.add.bind(purse);
  const calls: number[] = [];
  purse.add = (n: number) => {
    calls.push(n);
    return orig(n);
  };
  return { raw: () => calls.reduce((a, b) => a + b, 0), calls: () => calls };
}

function play(game: Game, maxSeconds = 600): SessionResult {
  let result: SessionResult | null = null;
  game.events.on('victory', (r) => (result = r));
  game.events.on('gameOver', (r) => (result = r));
  game.start();
  let ms = 0;
  let wait = 0;
  while (!result && ms < maxSeconds * 1000) {
    game.update(STEP);
    ms += STEP * 1000;
    wait += STEP * 1000;
    const f = game.focus;
    if (f && wait >= 650 && game.projectiles.length === 0 && game.phase !== 'help') {
      wait = 0;
      for (const ch of String(f.answer)) game.typeDigit(Number(ch));
      game.fire();
    }
  }
  return result as unknown as SessionResult;
}

describe('StardustPurse : la poussière se gagne deux fois plus lentement', () => {
  it('le taux est de 0,5', () => {
    expect(STARDUST_RATE).toBe(0.5);
  });

  it('1 brut donne 0 puis 1 : le reste fractionnaire est reporté', () => {
    const p = new StardustPurse();
    expect(p.add(1)).toBe(0);
    expect(p.add(1)).toBe(1);
    expect(p.add(1)).toBe(0);
    expect(p.add(1)).toBe(1);
    expect(p.total).toBe(2);
  });

  it('10 ajouts de 1 donnent 5, un ajout de 50 donne 25, 7 ajouts de 1 donnent 3 (reste 0,5 reporté)', () => {
    const a = new StardustPurse();
    for (let i = 0; i < 10; i++) a.add(1);
    expect(a.total).toBe(5);
    const b = new StardustPurse();
    expect(b.add(50)).toBe(25);
    const c = new StardustPurse();
    for (let i = 0; i < 7; i++) c.add(1);
    expect(c.total).toBe(3);
    c.add(1);
    expect(c.total).toBe(4);
  });

  it('ne perd rien : le total vaut toujours floor(brut × 0,5), jamais négatif, jamais de poussière gratuite', () => {
    const rng = new Rng(9);
    for (let run = 0; run < 50; run++) {
      const p = new StardustPurse();
      let raw = 0;
      for (let i = 0; i < 200; i++) {
        const n = rng.int(0, 12);
        const whole = p.add(n);
        raw += n;
        expect(whole).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(whole)).toBe(true);
        expect(p.total).toBe(Math.floor(raw * 0.5));
      }
    }
    expect(new StardustPurse().add(-5)).toBe(0);
    expect(new StardustPurse().add(0)).toBe(0);
  });

  it('accepte un autre taux (outil de réglage)', () => {
    const p = new StardustPurse(0.25);
    for (let i = 0; i < 8; i++) p.add(1);
    expect(p.total).toBe(2);
  });
});

describe('poussière gagnée en partie', () => {
  it('un secteur complet rapporte exactement la moitié de la poussière brute, boss compris', () => {
    const game = new Game(campaignMode(3, { maxTable: 10, fluentMs: 4000, seed: 7, reviewTables: [1, 2] }), new Map());
    const spy = spyPurse(game);
    const events: number[] = [];
    game.events.on('stardust', (e) => events.push(e.amount));
    const r = play(game);
    expect(r.victory).toBe(true);
    expect(r.bossesDefeated.length).toBe(1);
    expect(spy.raw()).toBeGreaterThan(150); // l'ancien gain (≈ 220 ✦) est bien la poussière brute
    expect(r.stardust).toBe(Math.floor(spy.raw() * STARDUST_RATE));
    expect(game.stardust).toBe(r.stardust);
    // Les particules ne reçoivent que la part entière réellement créditée.
    expect(events.reduce((a, b) => a + b, 0)).toBe(r.stardust);
    expect(events.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    // Référence mesurée avant la modification : 220 ✦ pour ce même scénario, donc environ 110 maintenant.
    expect(r.stardust).toBeGreaterThan(80);
    expect(r.stardust).toBeLessThan(140);
  });

  it('le boss vaincu rapporte 25 ✦ au lieu de 50', () => {
    const game = new Game(bossRushMode(['titan'], [6], { maxTable: 10, fluentMs: 4000, tables: [2, 6], seed: 3 }), new Map());
    const spy = spyPurse(game);
    play(game);
    expect(spy.calls()).toContain(50);
    expect(game.stardust).toBe(Math.floor(spy.raw() * 0.5));
  });

  it("l'événement « poussière ×2 » double bien la poussière brute avant le taux", () => {
    const game = new Game(campaignMode(0, { maxTable: 10, fluentMs: 4000, seed: 1 }), new Map());
    const spy = spyPurse(game);
    const add = (game as unknown as { addStardust(n: number, x: number, y: number): void }).addStardust.bind(game);
    add(3, 0, 0);
    game.activeEvent = 'doubleDust';
    add(3, 0, 0);
    expect(spy.calls()).toEqual([3, 6]);
    expect(game.stardust).toBe(4); // floor(9 × 0,5)
  });
});

describe('récompenses de succès', () => {
  it('sont divisées par 2 : 1 875 ✦ au total au lieu de 3 750, toutes entières et positives', () => {
    expect(ACHIEVEMENTS.reduce((s, a) => s + a.reward, 0)).toBe(1875);
    for (const a of ACHIEVEMENTS) {
      expect(Number.isInteger(a.reward), a.id).toBe(true);
      expect(a.reward, a.id).toBeGreaterThan(0);
    }
    expect(ACHIEVEMENTS.find((a) => a.id === 'all_mastered')?.reward).toBe(250);
    expect(ACHIEVEMENTS.find((a) => a.id === 'first_blood')?.reward).toBe(10);
  });
});
