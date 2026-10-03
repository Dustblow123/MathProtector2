import type { Rng } from '../core/rng';
import type { WaveEvent } from './types';

export const WAVE_EVENTS: { id: WaveEvent; weight: number }[] = [
  { id: 'meteorShower', weight: 3 },
  { id: 'doubleDust', weight: 3 },
  { id: 'crystalRush', weight: 2 },
  { id: 'iceAge', weight: 2 },
  { id: 'surpriseBoss', weight: 1.5 },
];

export const WAVE_EVENT_CHANCE = 0.25;

/**
 * Tire (ou non) un événement pour la vague qui commence.
 * Jamais en vague 1, jamais deux vagues de suite, jamais si le mode l'interdit.
 */
export function rollWaveEvent(rng: Rng, wave: number, previous: WaveEvent | null, enabled: boolean, allowBoss: boolean): WaveEvent | null {
  if (!enabled || wave < 2 || previous !== null) return null;
  if (!rng.chance(WAVE_EVENT_CHANCE)) return null;
  const pool = WAVE_EVENTS.filter((e) => allowBoss || e.id !== 'surpriseBoss');
  return rng.weighted(
    pool.map((e) => e.id),
    pool.map((e) => e.weight),
  );
}
