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
  /** Carte de méthode consultée pour cette cible. */
  helped: boolean;
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
  /** Échelle d'apparition (0 → 1). */
  scale: number;
  /** Ralenti (projectile givrant) jusqu'à ce temps de jeu (ms). */
  slowUntil: number;
}

export interface BossTarget extends Target {
  type: 'boss';
  /** Position relative au boss. */
  dx: number;
  dy: number;
  /** Temps limite (ms) pour le boss Chrono, 0 sinon. */
  deadline: number;
  /** Étiquette masquée (boss Fantôme) : la réponse reste acceptée. */
  hidden: boolean;
  /** Cible jumelle (boss Jumeaux) : détruite en même temps. */
  twinId: number;
}

export type ProjectileKind = 'bolt' | 'missile' | 'lightning' | 'frost' | 'twin' | 'shockwave';

export type CannonPerk = 'none' | 'stardust' | 'fastShot' | 'quickHint' | 'extraHp' | 'wideFluent' | 'crystals' | 'startShield';

/** Équipement à effet de gameplay choisi dans le Hangar. */
export interface Loadout {
  projectile: ProjectileKind;
  perk: CannonPerk;
}

export const DEFAULT_LOADOUT: Loadout = { projectile: 'bolt', perk: 'none' };

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
  kind: ProjectileKind;
  /** Temps écoulé depuis le tir (s), pour les trajectoires courbes. */
  age: number;
  /** Phase de l'ondulation (missile). */
  wobble: number;
}

export type PowerupType = 'freeze' | 'shield' | 'nova' | 'laser' | 'double' | 'oracle';

export type ModeId = 'campaign' | 'survival' | 'blitz' | 'practice' | 'bossRush' | 'daily' | 'patrol' | 'review' | 'weekly';

export type WaveEvent = 'meteorShower' | 'doubleDust' | 'crystalRush' | 'iceAge' | 'surpriseBoss';

export type BossKind = 'titan' | 'hydra' | 'mirror' | 'chrono' | 'mothership' | 'swarm' | 'phantom' | 'twins';

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
  /** Aide gratuite (pas de remise à zéro du combo ni de pénalité) : Entraînement. */
  freeHelp: boolean;
  powerups: boolean;
  seed: number;
  reinjectErrors: boolean;
  scoreMult: number;
  /** Secteur de campagne (index) pour les récompenses. */
  sector: number | null;
  /** Nombre maximum de faits nouveaux par vague. */
  maxNewPerWave: number;
  /** Faits servis en priorité (révision du jour). */
  priorityFacts: string[];
  /** Événements de vague aléatoires autorisés. */
  waveEvents: boolean;
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
  /** Cibles détruites, powerups compris. */
  destroyed: number;
  /** Réponses justes du joueur (hors powerups). */
  correct: number;
  /** Cibles détruites par un powerup (n'entrent pas dans la précision). */
  powerupKills: number;
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
  /** Partie interrompue par le joueur. */
  aborted: boolean;
  /** Temps de réponse des réponses justes (ms), pour le calibrage de la fluidité. */
  correctRts: number[];
  /** Faits prioritaires (révision) résolus correctement. */
  reviewed: number;
  /** Cartes de méthode consultées. */
  helps: number;
}

