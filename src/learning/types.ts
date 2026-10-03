/** Identifiant d'un fait ordonné, ex. "7x8". Le fait appartient à la table du premier facteur. */
export type FactId = string;

export interface Fact {
  id: FactId;
  a: number;
  b: number;
  product: number;
  /** Table à laquelle appartient le fait (= a). */
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
