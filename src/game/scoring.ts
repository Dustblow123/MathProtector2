import { clamp } from '../core/math';

export const BASE_SCORE = 100;

/** Bonus de vitesse : jusqu'à ×2 pour une réponse instantanée, ×1 au seuil de fluidité. */
export function speedBonus(rt: number, fluentMs: number): number {
  return 1 + clamp((fluentMs - rt) / fluentMs, 0, 1);
}

/** Multiplicateur de combo : +0,5 tous les 5 enchaînements, plafonné à ×4. */
export function comboMultiplier(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 5) * 0.5);
}

export function scoreFor(rt: number, fluentMs: number, combo: number, double: boolean, modeMult: number): number {
  const s = BASE_SCORE * speedBonus(rt, fluentMs) * comboMultiplier(combo) * (double ? 2 : 1) * modeMult;
  return Math.round(s / 5) * 5;
}

/**
 * Part de la poussière « brute » réellement créditée. 0,5 = la poussière d'étoiles se gagne
 * deux fois plus lentement (les prix du Hangar et les valeurs brutes ci-dessous ne changent pas).
 */
export const STARDUST_RATE = 0.5;

/**
 * Bourse de poussière d'étoiles : applique le taux et reporte le reste fractionnaire,
 * pour que rien ne se perde (1 brut → 0, puis 1 au coup suivant, avec un taux de 0,5).
 */
export class StardustPurse {
  total = 0;
  private carry = 0;

  constructor(private readonly rate: number = STARDUST_RATE) {}

  /** Ajoute de la poussière brute ; renvoie la part entière créditée. */
  add(raw: number): number {
    if (raw <= 0) return 0;
    this.carry += raw * this.rate;
    const whole = Math.floor(this.carry);
    this.carry -= whole;
    this.total += whole;
    return whole;
  }
}

export function stardustFor(fluent: boolean, variant: string): number {
  let n = 1;
  if (fluent) n += 1;
  if (variant === 'crystal') n += 5;
  if (variant === 'fire') n += 1;
  return n;
}

/** XP de session : récompense surtout le volume de pratique correcte et la fluidité. */
export function xpFor(input: { destroyed: number; fluentCount: number; bosses: number; victory: boolean; perfect: boolean }): number {
  let xp = input.destroyed * 10 + input.fluentCount * 5 + input.bosses * 150;
  if (input.victory) xp += 100;
  if (input.perfect) xp += 75;
  return xp;
}

/** Niveau à partir de l'XP cumulée : paliers croissants (niveau 1 à 50). */
export function levelFromXp(xp: number): { level: number; current: number; next: number } {
  let level = 1;
  let remaining = xp;
  let need = xpForLevel(level);
  while (remaining >= need && level < 50) {
    remaining -= need;
    level++;
    need = xpForLevel(level);
  }
  return { level, current: remaining, next: need };
}

export function xpForLevel(level: number): number {
  return Math.round(400 + level * level * 35);
}
