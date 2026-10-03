import { describe, expect, it } from 'vitest';
import { makeFact } from '../src/learning/facts';
import {
  DAY_MS,
  bktUpdate,
  initialFactState,
  isDue,
  masteryLevel,
  recordAnswer,
  retrievability,
} from '../src/learning/model';

const FLUENT = 4000;

describe('BKT', () => {
  it('augmente pKnown sur une réponse juste et le diminue sur une erreur', () => {
    const p = 0.4;
    expect(bktUpdate(p, true)).toBeGreaterThan(p);
    expect(bktUpdate(p, false)).toBeLessThan(p);
  });

  it('reste borné dans [0, 1]', () => {
    let p = 0.01;
    for (let i = 0; i < 50; i++) p = bktUpdate(p, true);
    expect(p).toBeLessThanOrEqual(1);
    for (let i = 0; i < 50; i++) p = bktUpdate(p, false);
    expect(p).toBeGreaterThanOrEqual(0);
  });
});

describe('recordAnswer', () => {
  it('fait croître la stabilité sur une réussite et la réduit sur une erreur', () => {
    const f = makeFact(7, 8);
    let s = initialFactState(f);
    const t0 = 1_000_000;
    s = recordAnswer(s, { correct: true, rt: 2000, now: t0, fluentMs: FLUENT });
    const st1 = s.stability;
    s = recordAnswer(s, { correct: true, rt: 2000, now: t0 + DAY_MS, fluentMs: FLUENT });
    expect(s.stability).toBeGreaterThan(st1);
    const st2 = s.stability;
    s = recordAnswer(s, { correct: false, rt: 6000, now: t0 + 2 * DAY_MS, fluentMs: FLUENT });
    expect(s.stability).toBeLessThan(st2);
    expect(s.lapses).toBe(1);
    expect(s.streak).toBe(0);
  });

  it('une réponse juste mais lente progresse moins qu\'une réponse fluide', () => {
    const f = makeFact(6, 7);
    const base = initialFactState(f);
    const fast = recordAnswer(base, { correct: true, rt: 1500, now: 1, fluentMs: FLUENT });
    const slow = recordAnswer(base, { correct: true, rt: 9000, now: 1, fluentMs: FLUENT });
    expect(fast.pKnown).toBeGreaterThan(slow.pKnown);
  });

  it('la rétention décroît avec le temps et le fait devient dû', () => {
    const f = makeFact(3, 4);
    let s = initialFactState(f);
    const t0 = 5_000_000;
    s = recordAnswer(s, { correct: true, rt: 1000, now: t0, fluentMs: FLUENT });
    expect(retrievability(s, t0)).toBeCloseTo(1, 5);
    expect(isDue(s, t0)).toBe(false);
    const later = t0 + s.stability * DAY_MS * 3;
    expect(retrievability(s, later)).toBeLessThan(0.9);
    expect(isDue(s, later)).toBe(true);
  });
});

describe('masteryLevel', () => {
  it('va de 0 (nouveau) à 4 (maîtrisé) avec des réponses rapides et justes', () => {
    const f = makeFact(8, 9);
    let s = initialFactState(f);
    expect(masteryLevel(s, FLUENT)).toBe(0);
    let now = 1;
    for (let i = 0; i < 8; i++) {
      s = recordAnswer(s, { correct: true, rt: 1200, now, fluentMs: FLUENT });
      now += DAY_MS;
    }
    expect(masteryLevel(s, FLUENT)).toBe(4);
  });

  it('un fait connu mais lent plafonne à 3', () => {
    const f = makeFact(8, 9);
    let s = initialFactState(f);
    for (let i = 0; i < 12; i++) s = recordAnswer(s, { correct: true, rt: 7000, now: i + 1, fluentMs: FLUENT });
    expect(s.pKnown).toBeGreaterThan(0.9);
    expect(masteryLevel(s, FLUENT)).toBe(3);
  });
});
