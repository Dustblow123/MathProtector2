import { factsWithProduct, makeFact } from './facts';
import type { ErrorAnalysis, Fact } from './types';

/** Analyse une mauvaise réponse pour identifier la confusion la plus probable. */
export function classifyError(fact: Fact, answer: number, maxTable: number): ErrorAnalysis {
  return fact.op === 'div' ? classifyDivisionError(fact, answer, maxTable) : classifyMultiplicationError(fact, answer, maxTable);
}

/** Division « p ÷ a = b » : écho du diviseur, quotient voisin, chiffres inversés. */
function classifyDivisionError(fact: Fact, answer: number, maxTable: number): ErrorAnalysis {
  const { a, b } = fact;
  if (answer === b) return { kind: 'unknown' };
  if (answer === a) return { kind: 'divisor-echo' };
  if (answer === b + 1 && b + 1 <= maxTable) return { kind: 'neighbor-b', confusedWith: makeFact(a, b + 1, 'div') };
  if (answer === b - 1 && b - 1 >= 1) return { kind: 'neighbor-b', confusedWith: makeFact(a, b - 1, 'div') };
  const swapped = Number(String(b).split('').reverse().join(''));
  if (b >= 10 && answer === swapped) return { kind: 'digit-swap' };
  return { kind: 'unknown' };
}

function classifyMultiplicationError(fact: Fact, answer: number, maxTable: number): ErrorAnalysis {
  const { a, b, product } = fact;
  if (answer === product) return { kind: 'unknown' };

  if (answer === a * (b + 1) && b + 1 <= maxTable) return { kind: 'neighbor-b', confusedWith: makeFact(a, b + 1) };
  if (answer === a * (b - 1) && b - 1 >= 1) return { kind: 'neighbor-b', confusedWith: makeFact(a, b - 1) };
  if (answer === (a + 1) * b && a + 1 <= maxTable) return { kind: 'neighbor-a', confusedWith: makeFact(a + 1, b) };
  if (answer === (a - 1) * b && a - 1 >= 1) return { kind: 'neighbor-a', confusedWith: makeFact(a - 1, b) };
  if (answer === a + b) return { kind: 'addition' };

  const swapped = Number(String(product).split('').reverse().join(''));
  if (product >= 10 && answer === swapped) return { kind: 'digit-swap' };

  if (answer === product + a || answer === product - a || answer === product + b || answer === product - b) {
    return { kind: 'off-by-table' };
  }

  const others = factsWithProduct(answer, maxTable).filter((f) => f.a === a || f.b === b || f.a === b || f.b === a);
  const other = others[0] ?? factsWithProduct(answer, maxTable)[0];
  if (other) return { kind: 'other-table', confusedWith: other };

  return { kind: 'unknown' };
}
