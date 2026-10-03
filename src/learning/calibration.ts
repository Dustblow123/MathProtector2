/**
 * Calibrage automatique du seuil de fluidité : plutôt qu'un préréglage d'âge fixe,
 * on s'aligne sur le temps de réponse médian réel de l'enfant (réponses justes).
 */
export const CALIBRATION_MIN_SAMPLES = 15;
export const RECENT_RTS_MAX = 60;

export function calibratedFluentMs(base: number, recentRts: readonly number[]): number {
  if (recentRts.length < CALIBRATION_MIN_SAMPLES) return base;
  const sorted = [...recentRts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? base;
  const target = median * 1.3;
  const lo = base * 0.6;
  const hi = base * 1.4;
  return Math.round(Math.min(hi, Math.max(lo, target)));
}

/** Ajoute des mesures au tampon circulaire (les plus récentes à la fin). */
export function pushRts(buffer: number[], rts: readonly number[]): number[] {
  const out = [...buffer, ...rts.filter((r) => r > 0 && r < 30000)];
  return out.length > RECENT_RTS_MAX ? out.slice(out.length - RECENT_RTS_MAX) : out;
}
