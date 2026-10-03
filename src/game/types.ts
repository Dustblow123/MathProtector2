import type { Fact, FactId } from '../learning/types';

export type AsteroidVariant = 'normal' | 'fire' | 'ice' | 'crystal' | 'split';

/** Tout ce qui peut être visé et détruit en tapant une réponse. */
export interface Target {
  id: number;
  fact: Fact;
  /** Ce qu'il faut taper (produit, ou facteur manquant pour le boss Miroir). */
  answer: number;
  /** Étiquette affichée, ex. "7 × 8" ou "7 × ? = 56". */
  label: string;
  x: number;
  y: number;
  radius: number;
  /** Temps de jeu (ms) d'apparition. */
  spawnTime: number;
  alive: boolean;
  type: 'asteroid' | 'boss';
}

export interface Asteroid extends Target {
  type: 'asteroid';
  variant: AsteroidVariant;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  shapeSeed: number;
  /** 0 = astéroïde initial, 1 = issu d'une scission. */
  generation: number;
  hinted: boolean;
  /** Échelle d'apparition (0 → 1). */
  scale: number;
}

export interface BossTarget extends Target {
  type: 'boss';
  /** Position relative au boss. */
  dx: number;
  dy: number;
  /** Temps limite (ms) pour le boss Chrono, 0 sinon. */
  deadline: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: number;
  /** Tir "raté" (sans cible valide) qui s'éteint tout seul. */
  fizzle: boolean;
  life: number;
  trail: { x: number; y: number }[];
}

export type PowerupType = 'freeze' | 'shield' | 'nova' | 'laser' | 'double' | 'oracle';

export type ModeId = 'campaign' | 'survival' | 'blitz' | 'practice' | 'bossRush' | 'daily';

export type BossKind = 'titan' | 'hydra' | 'mirror' | 'chrono' | 'mothership';

export interface ModeConfig {
  id: ModeId;
  /** Tables dont les faits peuvent apparaître. */
  tables: number[];
  /** Tables où des faits jamais vus peuvent être introduits. */
  newTables: number[];
  maxTable: number;
  fluentMs: number;
  /** Nombre de vagues avant le(s) boss / la fin. null = infini. */
  wavesTotal: number | null;
  asteroidsPerWave: number;
  /** 0 = Terre invulnérable. */
  earthHp: number;
  flow: { initial: number; min: number; max: number };
  /** Augmentation forcée d'intensité à chaque vague (survie). */
  rampPerWave: number;
  /** Chrono global (Blitz). */
  timeLimitMs: number;
  /** Secondes gagnées par astéroïde détruit (Blitz). */
  timeBonusMs: number;
  /** Boss affrontés après les vagues (campagne : 1, boss rush : plusieurs). */
  bosses: BossKind[];
  /** Table utilisée par chaque boss (alignée sur `bosses`). */
  bossTables: number[];
  hintsAlways: boolean;
  powerups: boolean;
  seed: number;
  reinjectErrors: boolean;
  scoreMult: number;
  /** Secteur de campagne (index) pour les récompenses. */
  sector: number | null;
  /** Nombre maximum de faits nouveaux par vague. */
  maxNewPerWave: number;
}

export interface FactOutcome {
  factId: FactId;
  correct: number;
  wrong: number;
  bestRt: number;
}

export interface SessionResult {
  modeId: ModeId;
  sector: number | null;
  score: number;
  destroyed: number;
  answered: number;
  errors: number;
  hitsTaken: number;
  accuracy: number;
  avgRt: number;
  fluentRatio: number;
  maxCombo: number;
  stardust: number;
  xp: number;
  stars: number;
  victory: boolean;
  bossesDefeated: BossKind[];
  durationMs: number;
  wavesCleared: number;
  factOutcomes: FactOutcome[];
  /** Faits sur lesquels il y a eu au moins une erreur dans la session. */
  weakFacts: FactId[];
  /** Faits passés au niveau "maîtrisé" pendant la session. */
  newlyMastered: FactId[];
  perfect: boolean;
}

export type HintKind = 'neighbor-down' | 'neighbor-up' | 'commute' | 'double' | 'repeat';

export interface HintData {
  fact: Fact;
  kind: HintKind;
  /** Fait d'appui (voisin ou commuté). */
  support?: Fact;
}
