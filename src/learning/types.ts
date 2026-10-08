/**
 * Identifiant d'un fait ordonné : "7x8" (multiplication 7 × 8) ou "7d8" (division 56 ÷ 7 = 8).
 * Le fait appartient à la table de `a`. Les deux opérations ont chacune leur état d'apprentissage.
 */
export type FactId = string;

/** Opération d'un fait : multiplication, ou division dont le résultat est toujours entier (p ÷ a = b). */
export type Op = 'mul' | 'div';

/** Choix au lancement d'une partie. */
export type OpChoice = Op | 'mixed';

export interface Fact {
  id: FactId;
  op: Op;
  a: number;
  b: number;
  product: number;
  /** Ce qu'il faut taper : le produit (mul) ou le quotient `b` (div). */
  answer: number;
  /** Table à laquelle appartient le fait (= a, le diviseur en division). */
  table: number;
}

export interface AnswerRecord {
  correct: boolean;
  /** Temps de réponse en millisecondes. */
  rt: number;
}

/** État mémoire d'un fait pour un joueur. Sérialisable tel quel. */
export interface FactState {
  id: FactId;
  /** Probabilité (BKT) que le fait soit connu. */
  pKnown: number;
  /** Stabilité mémorielle en jours (intervalle pour 90 % de rappel). */
  stability: number;
  /** Timestamp (ms) de la dernière réponse, 0 si jamais vu. */
  lastReview: number;
  reps: number;
  lapses: number;
  /** Moyenne mobile exponentielle du temps de réponse (ms). 0 si jamais vu. */
  rtEma: number;
  /** Les 8 dernières réponses, la plus récente en dernier. */
  recent: AnswerRecord[];
  streak: number;
}

export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

export type ErrorKind =
  | 'neighbor-b' // a×(b±1)
  | 'neighbor-a' // (a±1)×b
  | 'addition' // a+b
  | 'digit-swap' // 42 ↔ 24
  | 'other-table' // produit d'un autre fait de la plage
  | 'off-by-table' // a×b ± a ou ± b (saut de table)
  | 'divisor-echo' // division : l'enfant tape le diviseur (56 ÷ 7 → 7)
  | 'unknown';

export interface ErrorAnalysis {
  kind: ErrorKind;
  /** Fait avec lequel la confusion a eu lieu, si identifiable. */
  confusedWith?: Fact;
}

export interface LearnerParams {
  /** Seuil de fluidité en ms : une réponse plus lente n'est pas "fluide". */
  fluentMs: number;
  /** Plage des tables (10 ou 12). */
  maxTable: number;
}

export interface BucketQuotas {
  new: number;
  learning: number;
  review: number;
  maintenance: number;
}
