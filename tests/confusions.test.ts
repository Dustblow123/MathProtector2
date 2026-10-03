import { describe, expect, it } from 'vitest';
import { classifyError } from '../src/learning/confusions';
import { makeFact } from '../src/learning/facts';

describe('classifyError', () => {
  it('détecte la confusion avec la table voisine (6×7 → 48 = 6×8)', () => {
    const r = classifyError(makeFact(6, 7), 48, 10);
    expect(r.kind).toBe('neighbor-b');
    expect(r.confusedWith?.id).toBe('6x8');
  });

  it('détecte (a±1)×b', () => {
    const r = classifyError(makeFact(6, 7), 35, 10);
    expect(r.kind).toBe('neighbor-a');
    expect(r.confusedWith?.id).toBe('5x7');
  });

  it("détecte l'addition", () => {
    expect(classifyError(makeFact(3, 4), 7, 10).kind).toBe('addition');
  });

  it("détecte l'inversion de chiffres", () => {
    expect(classifyError(makeFact(6, 7), 24, 10).kind).toBe('digit-swap');
  });

  it('détecte un produit d\'une autre table', () => {
    const r = classifyError(makeFact(7, 8), 54, 10);
    expect(r.kind).toBe('other-table');
    expect(r.confusedWith?.product).toBe(54);
  });

  it('retourne unknown pour une réponse farfelue', () => {
    expect(classifyError(makeFact(7, 8), 1234, 10).kind).toBe('unknown');
  });
});
