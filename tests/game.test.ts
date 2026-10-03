import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game';
import { blitzMode, bossRushMode, campaignMode, dailyMode, practiceMode, survivalMode } from '../src/game/modes/index';
import type { BossKind, SessionResult } from '../src/game/types';

const STEP = 1 / 60;

/** Joueur simulé : répond au focus avec une précision donnée après un délai. */
function play(game: Game, opts: { accuracy: number; delayMs: number; maxSeconds: number; seed?: number }): { result: SessionResult | null; ms: number } {
  let result: SessionResult | null = null;
  game.events.on('victory', (r) => (result = r));
  game.events.on('gameOver', (r) => (result = r));
  game.start();
  let ms = 0;
  let wait = 0;
  let k = opts.seed ?? 1;
  const rand = () => {
    k = (k * 1103515245 + 12345) & 0x7fffffff;
    return k / 0x7fffffff;
  };
  while (!result && ms < opts.maxSeconds * 1000) {
    game.update(STEP);
    ms += STEP * 1000;
    wait += STEP * 1000;
    const f = game.focus;
    if (f && wait >= opts.delayMs && game.projectiles.length === 0) {
      wait = 0;
      const correct = rand() < opts.accuracy;
      const ans = correct ? f.answer : f.answer + 1;
      for (const ch of String(ans)) game.typeDigit(Number(ch));
      game.fire();
    }
  }
  return { result, ms };
}

describe('Game (simulation headless)', () => {
  it('un joueur parfait termine le secteur 1 de campagne avec 3 étoiles', () => {
    const game = new Game(campaignMode(0, { maxTable: 10, fluentMs: 4000, seed: 1 }), new Map());
    const { result } = play(game, { accuracy: 1, delayMs: 900, maxSeconds: 600 });
    expect(result).not.toBeNull();
    expect(result!.victory).toBe(true);
    expect(result!.stars).toBe(3);
    expect(result!.bossesDefeated).toEqual(['titan']);
    expect(result!.wavesCleared).toBe(5);
    expect(result!.destroyed).toBeGreaterThan(40);
  });

  it('un joueur qui ne répond jamais perd la partie', () => {
    const game = new Game(campaignMode(3, { maxTable: 10, fluentMs: 4000, seed: 2 }), new Map());
    let result: SessionResult | null = null;
    game.events.on('gameOver', (r) => (result = r));
    game.start();
    for (let i = 0; i < 60 * 200 && !result; i++) game.update(STEP);
    expect(result).not.toBeNull();
    expect(result!.victory).toBe(false);
    expect(result!.hitsTaken).toBe(5);
  });

  it('le mode Blitz se termine à la fin du chrono', () => {
    const game = new Game(blitzMode({ maxTable: 10, fluentMs: 4000, tables: [2, 5, 10], seed: 3 }), new Map());
    const { result, ms } = play(game, { accuracy: 0.9, delayMs: 2200, maxSeconds: 300 });
    expect(result!.victory).toBe(true);
    expect(ms).toBeGreaterThan(60_000);
    expect(ms).toBeLessThan(200_000);
  });

  it('le mode Entraînement est invulnérable et donne des indices', () => {
    const game = new Game(practiceMode({ maxTable: 10, fluentMs: 4000, tables: [7], seed: 4 }), new Map());
    let hints = 0;
    game.events.on('hint', () => hints++);
    game.start();
    for (let i = 0; i < 60 * 90; i++) game.update(STEP);
    expect(game.earth.hp).toBe(game.earth.maxHp);
    expect(hints).toBeGreaterThan(0);
    expect(game.phase).not.toBe('ended');
  });

  it('le mode Survie continue indéfiniment et monte en intensité', () => {
    const game = new Game(survivalMode({ maxTable: 10, fluentMs: 4000, tables: [2, 3, 4, 5], seed: 5 }), new Map());
    const start = game.flow.intensity;
    play(game, { accuracy: 1, delayMs: 800, maxSeconds: 240 });
    expect(game.wave).toBeGreaterThan(3);
    expect(game.flow.intensity).toBeGreaterThan(start);
  });

  it('le défi du jour est reproductible (même seed → mêmes faits)', () => {
    const run = () => {
      const g = new Game(dailyMode('2026-10-03', { maxTable: 10, fluentMs: 4000, tables: [2, 3, 4] }), new Map());
      const ids: string[] = [];
      g.events.on('spawn', (a) => ids.push(a.fact.id));
      play(g, { accuracy: 1, delayMs: 700, maxSeconds: 200 });
      return ids.join(',');
    };
    expect(run()).toBe(run());
  });

  for (const kind of ['titan', 'hydra', 'mirror', 'chrono', 'mothership'] as BossKind[]) {
    it(`le boss ${kind} peut être vaincu`, () => {
      const game = new Game(bossRushMode([kind], [7], { maxTable: 10, fluentMs: 4000, tables: [2, 5, 7], seed: 6 }), new Map());
      let defeated: BossKind | null = null;
      game.events.on('bossDefeated', ({ boss }) => (defeated = boss.kind));
      const { result } = play(game, { accuracy: 1, delayMs: 700, maxSeconds: 400 });
      expect(defeated).toBe(kind);
      expect(result!.victory).toBe(true);
      expect(result!.bossesDefeated).toEqual([kind]);
    });
  }

  it("une mauvaise réponse est attribuée au focus et réinjectée", () => {
    const game = new Game(practiceMode({ maxTable: 10, fluentMs: 4000, tables: [6], seed: 7 }), new Map());
    game.start();
    for (let i = 0; i < 60 * 3; i++) game.update(STEP);
    const f = game.focus!;
    expect(f).toBeTruthy();
    let miss = 0;
    game.events.on('miss', () => miss++);
    for (const ch of String(f.answer + 100)) game.typeDigit(Number(ch));
    game.fire();
    expect(miss).toBe(1);
    expect(game.scheduler.pendingReinjections.map((r) => r.factId)).toContain(f.fact.id);
    expect(game.combo).toBe(0);
  });

  it('les powerups fonctionnent (gel, bouclier, nova)', () => {
    const game = new Game(survivalMode({ maxTable: 10, fluentMs: 4000, tables: [2, 3], seed: 8 }), new Map());
    game.start();
    for (let i = 0; i < 60 * 8; i++) game.update(STEP);
    expect(game.asteroids.length).toBeGreaterThan(0);
    game.inventory = ['freeze', 'shield', 'nova'];
    game.usePowerup(0);
    expect(game.frozen).toBe(true);
    const y = game.asteroids[0]!.y;
    for (let i = 0; i < 30; i++) game.update(STEP);
    expect(game.asteroids[0]!.y).toBe(y);
    game.usePowerup(0); // shield (slot 0 après décalage)
    expect(game.earth.shield).toBe(true);
    game.usePowerup(0); // nova
    expect(game.asteroids.every((a) => !a.alive)).toBe(true);
    expect(game.inventory).toEqual([]);
  });
});
