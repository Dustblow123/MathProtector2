import { parseFactId } from './facts';
import { retrievability } from './model';
import type { FactId, FactState } from './types';

export interface DueFact {
  id: FactId;
  table: number;
  priority: number;
}

/**
 * Faits "dus" pour la révision du jour : déjà rencontrés et dont la rétention estimée
 * est passée sous 90 %. Triés du plus urgent au moins urgent.
 */
export function dueFacts(states: ReadonlyMap<FactId, FactState>, now: number): DueFact[] {
  const out: DueFact[] = [];
  for (const [id, s] of states) {
    if (s.reps === 0) continue;
    const r = retrievability(s, now);
    if (r >= 0.9) continue;
    out.push({ id, table: parseFactId(id).table, priority: (1 - r) + (1 - s.pKnown) });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

export function dueTables(due: readonly DueFact[]): number[] {
  return [...new Set(due.map((d) => d.table))].sort((a, b) => a - b);
}
