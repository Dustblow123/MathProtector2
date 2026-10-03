import { describe, expect, it } from 'vitest';
import { isTableValidated, nextTableAfter, tableOrder, tableStats } from '../src/learning/curriculum';
import { factsOfTable } from '../src/learning/facts';
import { DAY_MS, initialFactState, recordAnswer } from '../src/learning/model';
import type { FactId, FactState } from '../src/learning/types';

describe('curriculum', () => {
  it('ordonne les tables pédagogiquement et borne à la plage', () => {
    expect(tableOrder(10)).toEqual([1, 2, 10, 5, 3, 4, 6, 7, 8, 9]);
    expect(tableOrder(12)).toEqual([1, 2, 10, 5, 3, 4, 6, 7, 8, 9, 11, 12]);
    expect(nextTableAfter(10, 10)).toBe(5);
    expect(nextTableAfter(9, 10)).toBeNull();
    expect(nextTableAfter(9, 12)).toBe(11);
  });

  it('valide une table quand elle est connue et fluide', () => {
    const states = new Map<FactId, FactState>();
    for (const f of factsOfTable(4, 10)) {
      let s = initialFactState(f);
      for (let i = 0; i < 8; i++) s = recordAnswer(s, { correct: true, rt: 1000, now: (i + 1) * DAY_MS, fluentMs: 4000 });
      states.set(f.id, s);
    }
    const stats = tableStats(states, 4, 10, 4000);
    expect(stats.fluentRatio).toBe(1);
    expect(isTableValidated(stats)).toBe(true);
    expect(isTableValidated(tableStats(new Map(), 4, 10, 4000))).toBe(false);
  });
});
