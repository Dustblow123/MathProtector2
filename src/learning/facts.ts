import type { Fact, FactId } from './types';

export function factId(a: number, b: number): FactId {
  return `${a}x${b}`;
}

export function makeFact(a: number, b: number): Fact {
  return { id: factId(a, b), a, b, product: a * b, table: a };
}

export function parseFactId(id: FactId): Fact {
  const [a, b] = id.split('x').map(Number);
  if (!a || !b) throw new Error(`FactId invalide : ${id}`);
  return makeFact(a, b);
}

/** Tous les faits ordonnés a×b avec a, b ∈ [1, maxTable]. */
export function allFacts(maxTable: number): Fact[] {
  const out: Fact[] = [];
  for (let a = 1; a <= maxTable; a++) for (let b = 1; b <= maxTable; b++) out.push(makeFact(a, b));
  return out;
}

/** Les faits de la "table de T" : T×1 … T×maxTable. */
export function factsOfTable(table: number, maxTable: number): Fact[] {
  const out: Fact[] = [];
  for (let b = 1; b <= maxTable; b++) out.push(makeFact(table, b));
  return out;
}

export function commuted(fact: Fact): Fact {
  return makeFact(fact.b, fact.a);
}

/** Tous les couples ordonnés dont le produit vaut `product` dans la plage. */
export function factsWithProduct(product: number, maxTable: number): Fact[] {
  const out: Fact[] = [];
  for (let a = 1; a <= maxTable; a++) {
    if (product % a === 0) {
      const b = product / a;
      if (b >= 1 && b <= maxTable) out.push(makeFact(a, b));
    }
  }
  return out;
}
