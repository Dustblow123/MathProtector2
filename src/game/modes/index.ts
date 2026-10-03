import { seedFromString } from '../../core/rng';
import { tableOrder } from '../../learning/curriculum';
import type { BossKind, ModeConfig, ModeId } from '../types';

export interface ModeInput {
  maxTable: number;
  fluentMs: number;
  /** Tables débloquées (campagne) ou choisies (autres modes). */
  tables: number[];
  seed?: number;
}

/** Boss associé à chaque secteur de campagne (index dans l'ordre pédagogique). */
export const SECTOR_BOSS: readonly BossKind[] = ['titan', 'swarm', 'hydra', 'twins', 'mirror', 'phantom', 'chrono', 'swarm', 'twins', 'mothership', 'phantom', 'chrono'];

export const CAMPAIGN_WAVES = 5;

export function sectorTable(sector: number, maxTable: number): number {
  return tableOrder(maxTable)[sector] ?? 1;
}

export function sectorCount(maxTable: number): number {
  return tableOrder(maxTable).length;
}

function base(id: ModeId, input: ModeInput): ModeConfig {
  return {
    id,
    tables: [...input.tables],
    newTables: [...input.tables],
    maxTable: input.maxTable,
    fluentMs: input.fluentMs,
    wavesTotal: null,
    asteroidsPerWave: 12,
    earthHp: 5,
    flow: { initial: 0.2, min: 0, max: 1 },
    rampPerWave: 0,
    timeLimitMs: 0,
    timeBonusMs: 0,
    bosses: [],
    bossTables: [],
    hintsAlways: false,
    powerups: true,
    seed: input.seed ?? (Math.random() * 2 ** 32) >>> 0,
    reinjectErrors: true,
    scoreMult: 1,
    sector: null,
    maxNewPerWave: 3,
  };
}

/**
 * Campagne : le secteur `sector` travaille sa table, avec révision des tables déjà terminées
 * (`reviewTables`, libre : les enfants n'apprennent pas les tables dans l'ordre).
 */
export function campaignMode(sector: number, input: Omit<ModeInput, 'tables'> & { reviewTables?: number[] }): ModeConfig {
  const order = tableOrder(input.maxTable);
  const table = order[sector] ?? 1;
  const review = (input.reviewTables ?? []).filter((t) => t !== table && t <= input.maxTable);
  const tables = [...review, table];
  const m = base('campaign', { ...input, tables });
  m.newTables = [table]; // seuls les faits de la table du secteur sont introduits ; les autres sont révisées
  m.wavesTotal = CAMPAIGN_WAVES;
  m.asteroidsPerWave = 10;
  m.flow = { initial: Math.min(0.5, 0.08 + sector * 0.04), min: 0, max: Math.min(1, 0.55 + sector * 0.05) };
  m.bosses = [SECTOR_BOSS[sector] ?? 'titan'];
  m.bossTables = [table];
  m.sector = sector;
  m.maxNewPerWave = sector === 0 ? 4 : 3;
  return m;
}

export function survivalMode(input: ModeInput): ModeConfig {
  const m = base('survival', input);
  m.asteroidsPerWave = 12;
  m.flow = { initial: 0.2, min: 0.1, max: 1 };
  m.rampPerWave = 0.04;
  m.scoreMult = 1.2;
  return m;
}

export function blitzMode(input: ModeInput): ModeConfig {
  const m = base('blitz', input);
  m.wavesTotal = 1;
  m.asteroidsPerWave = 400;
  m.earthHp = 0;
  m.timeLimitMs = 60_000;
  m.timeBonusMs = 1000;
  m.flow = { initial: 0.55, min: 0.35, max: 0.9 };
  m.scoreMult = 1.5;
  m.maxNewPerWave = 6;
  return m;
}

export function practiceMode(input: ModeInput): ModeConfig {
  const m = base('practice', input);
  m.earthHp = 0;
  m.hintsAlways = true;
  m.flow = { initial: 0.1, min: 0, max: 0.5 };
  m.powerups = false;
  m.asteroidsPerWave = 10;
  m.scoreMult = 0.5;
  m.maxNewPerWave = 4;
  return m;
}

export function bossRushMode(bosses: BossKind[], bossTables: number[], input: ModeInput): ModeConfig {
  const m = base('bossRush', input);
  m.wavesTotal = 0;
  m.bosses = [...bosses];
  m.bossTables = [...bossTables];
  m.flow = { initial: 0.4, min: 0.3, max: 0.8 };
  m.scoreMult = 1.5;
  return m;
}

/** Patrouille : révision automatique des tables terminées en campagne, sans fait nouveau. */
export function patrolMode(input: ModeInput): ModeConfig {
  const m = base('patrol', input);
  m.newTables = [];
  m.maxNewPerWave = 0;
  m.asteroidsPerWave = 12;
  m.flow = { initial: 0.25, min: 0.15, max: 0.85 };
  m.rampPerWave = 0.02;
  m.scoreMult = 1.1;
  return m;
}

export function dailyMode(dateKey: string, input: ModeInput): ModeConfig {
  const m = base('daily', { ...input, seed: seedFromString(dateKey) });
  m.wavesTotal = 1;
  m.asteroidsPerWave = 20;
  m.earthHp = 3;
  m.flow = { initial: 0.45, min: 0.45, max: 0.45 };
  m.reinjectErrors = false;
  m.scoreMult = 1.3;
  m.maxNewPerWave = 2;
  return m;
}

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
