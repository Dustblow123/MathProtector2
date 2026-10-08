import type { Fact, FactId, Op, OpChoice } from './types';

export function factId(a: number, b: number, op: Op = 'mul'): FactId {
  return `${a}${op === 'div' ? 'd' : 'x'}${b}`;
}

/**
 * Fait ordonné. Division : `a × b = produit`, question « produit ÷ a », réponse `b`
 * (toujours un entier, jamais de reste ni de division par zéro).
 */
export function makeFact(a: number, b: number, op: Op = 'mul'): Fact {
  const product = a * b;
  return { id: factId(a, b, op), op, a, b, product, answer: op === 'div' ? b : product, table: a };
}

export function opOfId(id: FactId): Op {
  return id.includes('d') ? 'div' : 'mul';
}

export function parseFactId(id: FactId): Fact {
  const m = /^(\d+)([xd])(\d+)$/.exec(id);
  const a = Number(m?.[1]);
  const b = Number(m?.[3]);
  if (!m || !a || !b) throw new Error(`FactId invalide : ${id}`);
  return makeFact(a, b, m[2] === 'd' ? 'div' : 'mul');
}

/** Opérations actives pour un choix de lancement. */
export function opsOf(choice: OpChoice): Op[] {
  return choice === 'mixed' ? ['mul', 'div'] : [choice];
}

/** Tous les faits ordonnés a×b avec a, b ∈ [1, maxTable]. */
export function allFacts(maxTable: number, op: Op = 'mul'): Fact[] {
  const out: Fact[] = [];
  for (let a = 1; a <= maxTable; a++) for (let b = 1; b <= maxTable; b++) out.push(makeFact(a, b, op));
  return out;
}

/** Les faits de la "table de T" : T×1 … T×maxTable (ou les divisions par T correspondantes). */
export function factsOfTable(table: number, maxTable: number, op: Op = 'mul'): Fact[] {
  const out: Fact[] = [];
  for (let b = 1; b <= maxTable; b++) out.push(makeFact(table, b, op));
  return out;
}

/** Fait commuté, de même opération (7 × 8 ↔ 8 × 7, 56 ÷ 7 ↔ 56 ÷ 8). */
export function commuted(fact: Fact): Fact {
  return makeFact(fact.b, fact.a, fact.op);
}

/** Le même couple (a, b) dans l'autre opération (7 × 8 ↔ 56 ÷ 7). */
export function twinOp(fact: Fact): Fact {
  return makeFact(fact.a, fact.b, fact.op === 'mul' ? 'div' : 'mul');
}

/** Question affichée : « 7 × 8 » ou « 56 ÷ 7 ». */
export function factLabel(f: Fact): string {
  return f.op === 'div' ? `${f.product} ÷ ${f.a}` : `${f.a} × ${f.b}`;
}

/** Égalité complète : « 7 × 8 = 56 » ou « 56 ÷ 7 = 8 ». */
export function factEquation(f: Fact): string {
  return `${factLabel(f)} = ${f.answer}`;
}

/**
 * Variante « terme manquant » (boss Miroir) : « 7 × ? = 56 » (réponse 8) ou « ? ÷ 7 = 8 » (réponse 56).
 * En division on cherche le dividende : demander le diviseur donnerait toujours le numéro de la table
 * (réponses identiques à l'écran), alors que le dividende varie et relie division et multiplication.
 */
export function mirrorOf(f: Fact): { label: string; answer: number } {
  return f.op === 'div' ? { label: `? ÷ ${f.a} = ${f.b}`, answer: f.product } : { label: `${f.a} × ? = ${f.product}`, answer: f.b };
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
