import type { PowerupType } from './types';

export interface PowerupDef {
  type: PowerupType;
  /** Durée de l'effet en ms (0 = instantané). */
  duration: number;
  color: string;
  icon: string;
  /** Poids de tirage dans les cristaux. */
  weight: number;
}

export const POWERUPS: Record<PowerupType, PowerupDef> = {
  freeze: { type: 'freeze', duration: 5000, color: '#7fe3ff', icon: '❄', weight: 3 },
  shield: { type: 'shield', duration: 0, color: '#5cf2a6', icon: '⬢', weight: 3 },
  nova: { type: 'nova', duration: 0, color: '#ffd166', icon: '✺', weight: 1.5 },
  laser: { type: 'laser', duration: 0, color: '#ff4fd8', icon: '⚡', weight: 2 },
  double: { type: 'double', duration: 15000, color: '#ff9f43', icon: '×2', weight: 2.5 },
  oracle: { type: 'oracle', duration: 10000, color: '#8a6cff', icon: '◉', weight: 2 },
};

export const POWERUP_TYPES: PowerupType[] = ['freeze', 'shield', 'nova', 'laser', 'double', 'oracle'];

export const INVENTORY_SIZE = 3;

/** Paliers de combo qui offrent un powerup. */
export const COMBO_MILESTONES = [10, 20, 35, 50, 75, 100, 150, 200];
