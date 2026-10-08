import { factsOfTable, opsOf } from './facts';
import { masteryLevel } from './model';
import type { FactId, FactState, OpChoice } from './types';

/** Ordre pédagogique d'introduction des tables : faciles d'abord, 6/7/8/9 en dernier. */
export const TABLE_ORDER: readonly number[] = [1, 2, 10, 5, 3, 4, 6, 7, 8, 9, 11, 12];

/** Ordre d'introduction du second facteur à l'intérieur d'une table. */
export const FACTOR_ORDER: readonly number[] = [1, 2, 10, 5, 3, 4, 6, 7, 8, 9, 11, 12];

export function tableOrder(maxTable: number): number[] {
  return TABLE_ORDER.filter((t) => t <= maxTable);
}

export function factorOrder(maxTable: number): number[] {
  return FACTOR_ORDER.filter((t) => t <= maxTable);
}

export interface TableStats {
  table: number;
  avgPKnown: number;
  fluentRatio: number;
  seenRatio: number;
  avgMastery: number; // 0..4
}

export function tableStats(
  states: ReadonlyMap<FactId, FactState>,
  table: number,
  maxTable: number,
  fluentMs: number,
  op: OpChoice = 'mul',
): TableStats {
  const facts = opsOf(op).flatMap((o) => factsOfTable(table, maxTable, o));
  let sumP = 0;
  let fluent = 0;
  let seen = 0;
  let sumMastery = 0;
  for (const f of facts) {
    const s = states.get(f.id);
    if (!s) continue;
    sumP += s.pKnown;
    const m = masteryLevel(s, fluentMs);
    sumMastery += m;
    if (m === 4) fluent++;
    if (s.reps > 0) seen++;
  }
  const n = facts.length;
  return { table, avgPKnown: sumP / n, fluentRatio: fluent / n, seenRatio: seen / n, avgMastery: sumMastery / n };
}

/** Une table est "validée" (son secteur suivant se débloque) quand elle est bien connue et majoritairement fluide. */
export function isTableValidated(stats: TableStats): boolean {
  return stats.avgPKnown >= 0.8 && stats.fluentRatio >= 0.6;
}

/** Première table de la plage ; les suivantes se débloquent par validation ou victoire sur le boss. */
export function nextTableAfter(table: number, maxTable: number): number | null {
  const order = tableOrder(maxTable);
  const i = order.indexOf(table);
  if (i < 0 || i + 1 >= order.length) return null;
  return order[i + 1] ?? null;
}
