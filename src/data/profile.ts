import type { BossKind } from '../game/types';
import type { FactId, FactState } from '../learning/types';
import type { CosmeticCategory } from '../progression/cosmetics';
import { DEFAULT_EQUIPPED } from '../progression/cosmetics';

export type AgePreset = 'young' | 'mid' | 'older';

export const FLUENT_MS: Record<AgePreset, number> = { young: 6000, mid: 4000, older: 3000 };

export interface DayStat {
  /** "YYYY-MM-DD" */
  day: string;
  sessions: number;
  destroyed: number;
  errors: number;
  timeMs: number;
}

export interface SectorProgress {
  stars: number;
  bestScore: number;
  attempts: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  agePreset: AgePreset;
  maxTable: number;
  facts: Record<FactId, FactState>;
  xp: number;
  stardust: number;
  /** Secteurs de campagne : index → progression. */
  sectors: Record<number, SectorProgress>;
  /** Index du secteur le plus avancé débloqué. */
  unlockedSector: number;
  achievements: string[];
  cosmeticsOwned: string[];
  equipped: Record<CosmeticCategory, string>;
  bossesDefeated: BossKind[];
  bestSurvival: { score: number; waves: number };
  bestBlitz: { score: number; destroyed: number };
  daily: { lastDay: string; score: number; medal: string } | null;
  /** Tables choisies par le parent comme prioritaires (vide = automatique). */
  focusTables: number[];
  stats: {
    sessions: number;
    destroyed: number;
    fluent: number;
    errors: number;
    timeMs: number;
    lastPlayedDay: string;
    streakDays: number;
    /** Confusions : "7x8>63" → nombre d'occurrences. */
    confusions: Record<string, number>;
    days: DayStat[];
  };
}

export const AVATARS = ['🚀', '🛸', '🪐', '🌙', '⭐', '☄️', '🤖', '👽', '🦊', '🐱', '🐼', '🦄'];

export function createProfile(name: string, avatar: string, agePreset: AgePreset = 'mid'): Profile {
  return {
    id: `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    avatar,
    createdAt: Date.now(),
    agePreset,
    maxTable: 10,
    facts: {},
    xp: 0,
    stardust: 0,
    sectors: {},
    unlockedSector: 0,
    achievements: [],
    cosmeticsOwned: Object.values(DEFAULT_EQUIPPED),
    equipped: { ...DEFAULT_EQUIPPED },
    bossesDefeated: [],
    bestSurvival: { score: 0, waves: 0 },
    bestBlitz: { score: 0, destroyed: 0 },
    daily: null,
    focusTables: [],
    stats: { sessions: 0, destroyed: 0, fluent: 0, errors: 0, timeMs: 0, lastPlayedDay: '', streakDays: 0, confusions: {}, days: [] },
  };
}

export function factsMap(p: Profile): Map<FactId, FactState> {
  return new Map(Object.entries(p.facts));
}

export function storeFacts(p: Profile, m: Map<FactId, FactState>): void {
  const out: Record<FactId, FactState> = {};
  for (const [k, v] of m) out[k] = v;
  p.facts = out;
}
