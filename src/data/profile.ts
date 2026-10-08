import type { BossKind } from '../game/types';
import type { FactId, FactState, OpChoice } from '../learning/types';
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
  bestPatrol: { score: number; waves: number };
  bestBlitz: { score: number; destroyed: number };
  daily: { lastDay: string; score: number; medal: string } | null;
  weekly: { week: string; score: number; medal: string } | null;
  /** Dernier jour (YYYY-MM-DD) où une révision du jour a été faite. */
  reviewDoneDay: string;
  /** Seuil de fluidité calibré automatiquement sur les temps de réponse réels. */
  autoFluent: boolean;
  /** Dernier choix du sélecteur de lancement : multiplications, divisions (résultats entiers) ou les deux. */
  ops: OpChoice;
  /** Tables choisies par le parent comme prioritaires (vide = automatique). */
  focusTables: number[];
  stats: {
    sessions: number;
    destroyed: number;
    /** Réponses justes (hors powerups), base de la précision. */
    correct: number;
    fluent: number;
    errors: number;
    timeMs: number;
    lastPlayedDay: string;
    streakDays: number;
    /** Confusions : "7x8>63" → nombre d'occurrences. */
    confusions: Record<string, number>;
    days: DayStat[];
    /** Temps de réponse récents (réponses justes) pour le calibrage. */
    recentRts: number[];
    /** Nombre de révisions du jour effectuées et jours consécutifs. */
    reviewSessions: number;
    reviewStreak: number;
    lastReviewDay: string;
    /** Réponses du mini-drill. */
    drillAnswers: number;
    /** Cartes de méthode consultées. */
    helps: number;
    /** Divisions réussies (hors powerups). */
    divCorrect: number;
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
    bestPatrol: { score: 0, waves: 0 },
    bestBlitz: { score: 0, destroyed: 0 },
    daily: null,
    weekly: null,
    reviewDoneDay: '',
    autoFluent: true,
    ops: 'mul',
    focusTables: [],
    stats: { sessions: 0, destroyed: 0, correct: 0, fluent: 0, errors: 0, timeMs: 0, lastPlayedDay: '', streakDays: 0, confusions: {}, days: [], recentRts: [], reviewSessions: 0, reviewStreak: 0, lastReviewDay: '', drillAnswers: 0, helps: 0, divCorrect: 0 },
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
