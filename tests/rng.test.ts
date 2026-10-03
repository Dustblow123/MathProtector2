import { describe, expect, it } from 'vitest';
import { Rng, seedFromString } from '../src/core/rng';

describe('Rng', () => {
  it('est reproductible', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });
  it('seedFromString est stable', () => {
    expect(seedFromString('2026-10-03')).toBe(seedFromString('2026-10-03'));
    expect(seedFromString('2026-10-03')).not.toBe(seedFromString('2026-10-04'));
  });
  it('weighted respecte les poids', () => {
    const r = new Rng(1);
    let b = 0;
    for (let i = 0; i < 2000; i++) if (r.weighted(['a', 'b'], [1, 3]) === 'b') b++;
    expect(b / 2000).toBeGreaterThan(0.68);
    expect(b / 2000).toBeLessThan(0.82);
  });
});
