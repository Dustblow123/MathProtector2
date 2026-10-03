import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game';
import { bossRushMode, campaignMode, patrolMode, survivalMode } from '../src/game/modes/index';
import type { BossKind, Loadout, SessionResult } from '../src/game/types';

const STEP = 1 / 60;

function play(game: Game, opts: { accuracy: number; delayMs: number; maxSeconds: number }): SessionResult | null {
  let result: SessionResult | null = null;
  game.events.on('victory', (r) => (result = r));
  game.events.on('gameOver', (r) => (result = r));
  game.start();
  let ms = 0;
  let wait = 0;
  let k = 3;
  const rand = () => ((k = (k * 1103515245 + 12345) & 0x7fffffff), k / 0x7fffffff);
  while (!result && ms < opts.maxSeconds * 1000) {
    game.update(STEP);
    ms += STEP * 1000;
    wait += STEP * 1000;
    const f = game.focus;
    if (f && wait >= opts.delayMs && game.projectiles.length === 0) {
      wait = 0;
      const ans = rand() < opts.accuracy ? f.answer : f.answer + 1;
      for (const ch of String(ans)) game.typeDigit(Number(ch));
      game.fire();
    }
  }
  return result;
}

describe('v2 : précision, campagne libre, patrouille', () => {
  it("les kills par powerup n'entrent pas dans la précision ni dans les réponses justes", () => {
    const game = new Game(survivalMode({ maxTable: 10, fluentMs: 4000, tables: [2, 3], seed: 8 }), new Map());
    game.start();
    for (let i = 0; i < 60 * 10; i++) game.update(STEP);
    game.inventory = ['nova'];
    game.usePowerup(0);
    const r = game.buildResult(false);
    expect(r.powerupKills).toBeGreaterThan(0);
    expect(r.correct).toBe(0);
    expect(r.answered).toBe(0);
    expect(r.accuracy).toBe(1);
    expect(r.destroyed).toBe(r.correct + r.powerupKills);
  });

  it('la campagne accepte une table au choix avec les tables terminées en révision', () => {
    const m = campaignMode(7, { maxTable: 10, fluentMs: 4000, seed: 1, reviewTables: [2, 5] });
    expect(m.bossTables).toEqual([7]);
    expect(m.tables).toEqual([2, 5, 7]);
    expect(m.newTables).toEqual([7]);
    const alone = campaignMode(3, { maxTable: 10, fluentMs: 4000, seed: 1 });
    expect(alone.tables).toEqual([5]);
  });

  it("la patrouille n'introduit aucun fait nouveau et tourne sur les tables données", () => {
    const m = patrolMode({ maxTable: 10, fluentMs: 4000, tables: [2, 5], seed: 2 });
    expect(m.maxNewPerWave).toBe(0);
    const game = new Game(m, new Map());
    const seen = new Set<number>();
    game.events.on('spawn', (a) => seen.add(a.fact.a));
    play(game, { accuracy: 1, delayMs: 800, maxSeconds: 120 });
    expect([...seen].every((t) => t === 2 || t === 5)).toBe(true);
    expect(game.wave).toBeGreaterThan(2);
  });
});

describe('v2 : projectiles et perks', () => {
  const loadouts: Loadout[] = [
    { projectile: 'missile', perk: 'fastShot' },
    { projectile: 'frost', perk: 'quickHint' },
    { projectile: 'lightning', perk: 'stardust' },
    { projectile: 'shockwave', perk: 'crystals' },
    { projectile: 'twin', perk: 'wideFluent' },
  ];
  for (const lo of loadouts) {
    it(`le projectile ${lo.projectile} avec le perk ${lo.perk} permet de finir le secteur 1`, () => {
      const game = new Game(campaignMode(0, { maxTable: 10, fluentMs: 4000, seed: 5 }), new Map(), lo);
      const r = play(game, { accuracy: 1, delayMs: 700, maxSeconds: 500 });
      expect(r?.victory).toBe(true);
      expect(r!.errors).toBe(0);
    });
  }

  it('le perk extraHp donne 6 boucliers et startShield un bouclier initial', () => {
    const a = new Game(survivalMode({ maxTable: 10, fluentMs: 4000, tables: [2], seed: 1 }), new Map(), { projectile: 'bolt', perk: 'extraHp' });
    expect(a.earth.maxHp).toBe(6);
    const b = new Game(survivalMode({ maxTable: 10, fluentMs: 4000, tables: [2], seed: 1 }), new Map(), { projectile: 'bolt', perk: 'startShield' });
    expect(b.earth.shield).toBe(true);
  });

  it("l'éclair touche instantanément et peut rebondir (kill powerup)", () => {
    const game = new Game(survivalMode({ maxTable: 10, fluentMs: 4000, tables: [4], seed: 9 }), new Map(), { projectile: 'lightning', perk: 'none' });
    game.flow.intensity = 1;
    game.start();
    for (let i = 0; i < 60 * 14; i++) game.update(STEP);
    const alive = game.asteroids.filter((a) => a.alive).length;
    expect(alive).toBeGreaterThanOrEqual(2);
    let bolts = 0;
    game.events.on('lightning', () => bolts++);
    const f = game.focus!;
    for (const ch of String(f.answer)) game.typeDigit(Number(ch));
    game.fire();
    expect(bolts).toBe(1);
    expect(game.projectiles.length).toBe(0);
    expect(game.asteroids.filter((a) => a.alive).length).toBeLessThan(alive);
  });
});

describe('v2 : nouveaux boss', () => {
  for (const kind of ['swarm', 'phantom', 'twins'] as BossKind[]) {
    it(`le boss ${kind} peut être vaincu`, () => {
      const game = new Game(bossRushMode([kind], [6], { maxTable: 10, fluentMs: 4000, tables: [2, 6], seed: 12 }), new Map());
      let defeated: BossKind | null = null;
      game.events.on('bossDefeated', ({ boss }) => (defeated = boss.kind));
      const r = play(game, { accuracy: 1, delayMs: 600, maxSeconds: 400 });
      expect(defeated).toBe(kind);
      expect(r?.victory).toBe(true);
    });
  }

  it('le Fantôme cache ses étiquettes par intermittence', () => {
    const game = new Game(bossRushMode(['phantom'], [6], { maxTable: 10, fluentMs: 4000, tables: [6], seed: 2 }), new Map());
    game.start();
    let hiddenSeen = false;
    let visibleSeen = false;
    for (let i = 0; i < 60 * 12; i++) {
      game.update(STEP);
      for (const t of game.boss?.targets ?? []) (t.hidden ? (hiddenSeen = true) : (visibleSeen = true));
    }
    expect(hiddenSeen && visibleSeen).toBe(true);
  });
});
