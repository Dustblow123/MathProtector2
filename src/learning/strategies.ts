import { makeFact } from './facts';
import type { Fact, FactId, FactState } from './types';

export type StrategyKind =
  | 'identity'
  | 'double'
  | 'tens'
  | 'half-tens'
  | 'tens-minus'
  | 'double-double'
  | 'double-plus'
  | 'five-plus'
  | 'double-four'
  | 'five-two'
  | 'eleven'
  | 'twelve'
  | 'neighbor-down'
  | 'neighbor-up';

/** Étape affichée : clé i18n + paramètres numériques (le module reste pur, sans dépendance à l'interface). */
export interface StrategyStep {
  key: 'times' | 'plus' | 'minus' | 'half' | 'zero' | 'identity' | 'commute';
  params: Record<string, number>;
}

export interface StrategyPart {
  cols: number;
  color: 'main' | 'alt' | 'minus' | 'ghost';
}

export interface Strategy {
  kind: StrategyKind;
  /** Orientation utilisée : `a` rangées de `b` (le produit est celui du fait d'origine). */
  a: number;
  b: number;
  product: number;
  /** Vrai si le fait a été retourné (commutativité rappelée en première étape). */
  commuted: boolean;
  steps: StrategyStep[];
  /** Colonnes du visuel (grille de `a` rangées), par parties colorées. */
  parts: StrategyPart[];
}

/** Ordre de simplicité du second facteur : plus l'index est bas, plus la méthode est facile. */
const SIMPLICITY: readonly number[] = [1, 2, 10, 5, 9, 11, 4, 3, 6, 12, 8, 7];

function simplicity(n: number): number {
  const i = SIMPLICITY.indexOf(n);
  return i < 0 ? 99 : i;
}

const KNOWN = 0.85;

/** Choisit la méthode de calcul la plus utile pour un fait, en tenant compte des faits voisins déjà connus. */
export function chooseStrategy(fact: Fact, states: ReadonlyMap<FactId, FactState> = new Map(), _maxTable = 10): Strategy {
  const known = (x: number, y: number) => (states.get(makeFact(x, y).id)?.pKnown ?? 0) >= KNOWN;

  // 1. Voisin bien connu dans l'une ou l'autre orientation : méthode la plus rapide pour l'enfant.
  const orientations: [number, number, boolean][] = fact.a === fact.b ? [[fact.a, fact.b, false]] : [[fact.a, fact.b, false], [fact.b, fact.a, true]];
  for (const [oa, ob, flipped] of orientations) {
    if (ob <= 2 || ob === 10) continue;
    const pre: StrategyStep[] = flipped ? [{ key: 'commute', params: { a: fact.a, b: fact.b } }] : [];
    const p = oa * ob;
    if (known(oa, ob - 1)) {
      return { kind: 'neighbor-down', a: oa, b: ob, product: p, commuted: flipped, steps: [...pre, { key: 'times', params: { x: oa, y: ob - 1, r: oa * (ob - 1) } }, { key: 'plus', params: { x: oa * (ob - 1), y: oa, r: p } }], parts: [{ cols: ob - 1, color: 'main' }, { cols: 1, color: 'alt' }] };
    }
    if (ob + 1 <= 12 && known(oa, ob + 1)) {
      return { kind: 'neighbor-up', a: oa, b: ob, product: p, commuted: flipped, steps: [...pre, { key: 'times', params: { x: oa, y: ob + 1, r: oa * (ob + 1) } }, { key: 'minus', params: { x: oa * (ob + 1), y: oa, r: p } }], parts: [{ cols: ob, color: 'main' }, { cols: 1, color: 'minus' }] };
    }
  }

  // 2. Méthode générique : orientation dont le second facteur est le plus simple.
  let a = fact.a;
  let b = fact.b;
  let commuted = false;
  if (simplicity(fact.a) < simplicity(fact.b)) {
    a = fact.b;
    b = fact.a;
    commuted = true;
  }
  const p = a * b;
  const steps: StrategyStep[] = [];
  if (commuted) steps.push({ key: 'commute', params: { a: fact.a, b: fact.b } });

  const make = (kind: StrategyKind, more: StrategyStep[], parts: StrategyPart[]): Strategy => ({ kind, a, b, product: p, commuted, steps: [...steps, ...more], parts });
  switch (b) {
    case 1:
      return make('identity', [{ key: 'identity', params: { x: a } }], [{ cols: 1, color: 'main' }]);
    case 2:
      return make('double', [{ key: 'plus', params: { x: a, y: a, r: p } }], [{ cols: 1, color: 'main' }, { cols: 1, color: 'alt' }]);
    case 10:
      return make('tens', [{ key: 'zero', params: { x: a, r: p } }], [{ cols: 10, color: 'main' }]);
    case 5:
      return make('half-tens', [{ key: 'times', params: { x: a, y: 10, r: a * 10 } }, { key: 'half', params: { x: a * 10, r: p } }], [{ cols: 5, color: 'main' }, { cols: 5, color: 'ghost' }]);
    case 9:
      return make('tens-minus', [{ key: 'times', params: { x: a, y: 10, r: a * 10 } }, { key: 'minus', params: { x: a * 10, y: a, r: p } }], [{ cols: 9, color: 'main' }, { cols: 1, color: 'minus' }]);
    case 4:
      return make('double-double', [{ key: 'plus', params: { x: a, y: a, r: a * 2 } }, { key: 'plus', params: { x: a * 2, y: a * 2, r: p } }], [{ cols: 2, color: 'main' }, { cols: 2, color: 'alt' }]);
    case 3:
      return make('double-plus', [{ key: 'plus', params: { x: a, y: a, r: a * 2 } }, { key: 'plus', params: { x: a * 2, y: a, r: p } }], [{ cols: 2, color: 'main' }, { cols: 1, color: 'alt' }]);
    case 6:
      return make('five-plus', [{ key: 'times', params: { x: a, y: 5, r: a * 5 } }, { key: 'plus', params: { x: a * 5, y: a, r: p } }], [{ cols: 5, color: 'main' }, { cols: 1, color: 'alt' }]);
    case 8:
      return make('double-four', [{ key: 'times', params: { x: a, y: 4, r: a * 4 } }, { key: 'plus', params: { x: a * 4, y: a * 4, r: p } }], [{ cols: 4, color: 'main' }, { cols: 4, color: 'alt' }]);
    case 7:
      return make('five-two', [{ key: 'times', params: { x: a, y: 5, r: a * 5 } }, { key: 'times', params: { x: a, y: 2, r: a * 2 } }, { key: 'plus', params: { x: a * 5, y: a * 2, r: p } }], [{ cols: 5, color: 'main' }, { cols: 2, color: 'alt' }]);
    case 11:
      return make('eleven', [{ key: 'times', params: { x: a, y: 10, r: a * 10 } }, { key: 'plus', params: { x: a * 10, y: a, r: p } }], [{ cols: 10, color: 'main' }, { cols: 1, color: 'alt' }]);
    case 12:
      return make('twelve', [{ key: 'times', params: { x: a, y: 10, r: a * 10 } }, { key: 'times', params: { x: a, y: 2, r: a * 2 } }, { key: 'plus', params: { x: a * 10, y: a * 2, r: p } }], [{ cols: 10, color: 'main' }, { cols: 2, color: 'alt' }]);
    default:
      return make('five-plus', [{ key: 'times', params: { x: a, y: b, r: p } }], [{ cols: b, color: 'main' }]);
  }
}
