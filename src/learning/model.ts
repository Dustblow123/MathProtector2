import type { Fact, FactState, MasteryLevel } from './types';

/** Paramètres BKT. "guess" est bas car la réponse est saisie (pas un QCM). */
export const BKT = {
  guess: 0.1,
  slip: 0.1,
  transit: 0.15,
} as const;

export const DAY_MS = 86_400_000;

/** A priori de connaissance selon la table : certaines tables sont (presque) acquises d'emblée. */
export function priorForFact(fact: Fact): number {
  const easy = (n: number) => n === 1 || n === 2 || n === 10 || n === 5;
  if (fact.a === 1 || fact.b === 1) return 0.6;
  if (fact.a === 10 || fact.b === 10) return 0.5;
  if (easy(fact.a) && easy(fact.b)) return 0.4;
  if (easy(fact.a) || easy(fact.b)) return 0.3;
  if (fact.a === fact.b) return 0.25; // les carrés sont souvent mieux retenus
  return 0.15;
}

export function initialFactState(fact: Fact): FactState {
  return {
    id: fact.id,
    pKnown: priorForFact(fact),
    stability: 0.5,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    rtEma: 0,
    recent: [],
    streak: 0,
  };
}

/** Rétention estimée (0..1) : 0.9 au bout de `stability` jours. */
export function retrievability(state: FactState, now: number): number {
  if (state.lastReview === 0) return 0;
  const days = Math.max(0, (now - state.lastReview) / DAY_MS);
  return Math.pow(0.9, days / Math.max(0.05, state.stability));
}

export function isDue(state: FactState, now: number): boolean {
  return state.lastReview !== 0 && retrievability(state, now) < 0.9;
}

/** Mise à jour bayésienne de pKnown après une observation. */
export function bktUpdate(pKnown: number, correct: boolean, transit: number = BKT.transit): number {
  const { guess, slip } = BKT;
  const pL = clamp01(pKnown);
  let posterior: number;
  if (correct) {
    const num = pL * (1 - slip);
    posterior = num / (num + (1 - pL) * guess);
  } else {
    const num = pL * slip;
    posterior = num / (num + (1 - pL) * (1 - guess));
  }
  return clamp01(posterior + (1 - posterior) * transit);
}

export interface AnswerInput {
  correct: boolean;
  rt: number;
  now: number;
  fluentMs: number;
}

/**
 * Applique une réponse à un état de fait et renvoie le nouvel état (immutable).
 * - BKT : une réponse juste mais lente ne vaut qu'une demi-preuve d'apprentissage.
 * - Espacement : la stabilité croît d'autant plus que la rétention était basse (effet d'espacement),
 *   et davantage si la réponse est fluide ; elle chute fortement sur une erreur.
 */
export function recordAnswer(state: FactState, input: AnswerInput): FactState {
  const { correct, rt, now, fluentMs } = input;
  const fluent = correct && rt <= fluentMs;
  const r = retrievability(state, now);

  const transit = correct ? (fluent ? BKT.transit : BKT.transit * 0.5) : BKT.transit * 0.5;
  const pKnown = bktUpdate(state.pKnown, correct, transit);

  let stability: number;
  if (correct) {
    const spacingBonus = 1 + (1 - r) * 2.5; // réponse juste après un oubli partiel = fort gain
    const speedBonus = fluent ? 1.25 : 0.85;
    const growth = state.lastReview === 0 ? 1.6 : 1.9 * spacingBonus * speedBonus;
    stability = Math.min(365, Math.max(state.stability * growth, state.stability + 0.1));
  } else {
    stability = Math.max(0.1, state.stability * 0.3);
  }

  const rtEma = state.rtEma === 0 ? rt : state.rtEma * 0.7 + rt * 0.3;
  const recent = [...state.recent, { correct, rt }].slice(-8);

  return {
    ...state,
    pKnown,
    stability,
    lastReview: now,
    reps: state.reps + 1,
    lapses: state.lapses + (correct ? 0 : 1),
    rtEma,
    recent,
    streak: correct ? state.streak + 1 : 0,
  };
}

/** Crédit partiel apporté par la réussite du fait commuté (7×6 réussi aide 6×7). */
export function recordCommutedCredit(state: FactState, correct: boolean): FactState {
  if (!correct) return state;
  return { ...state, pKnown: bktUpdate(state.pKnown, true, BKT.transit * 0.5) };
}

export function masteryLevel(state: FactState, fluentMs: number): MasteryLevel {
  if (state.reps === 0) return 0;
  const lastFive = state.recent.slice(-5);
  const allRecentCorrect = lastFive.length >= 5 && lastFive.every((r) => r.correct);
  if (state.pKnown >= 0.95 && state.rtEma > 0 && state.rtEma <= fluentMs && allRecentCorrect) return 4;
  if (state.pKnown >= 0.8) return 3;
  if (state.pKnown >= 0.5) return 2;
  return 1;
}

export function isFluent(state: FactState, fluentMs: number): boolean {
  return masteryLevel(state, fluentMs) === 4;
}

/** Score 0..1 combinant connaissance et vitesse, pour les barres de progression. */
export function masteryScore(state: FactState, fluentMs: number): number {
  if (state.reps === 0) return 0;
  const speed = state.rtEma === 0 ? 0.5 : Math.min(1, fluentMs / Math.max(state.rtEma, 1));
  return clamp01(state.pKnown * (0.6 + 0.4 * speed));
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
