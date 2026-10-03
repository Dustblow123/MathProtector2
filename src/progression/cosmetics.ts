export type CosmeticCategory = 'cannon' | 'trail' | 'explosion' | 'planet' | 'nebula' | 'reticle';

export type UnlockRule =
  | { type: 'default' }
  | { type: 'buy'; price: number }
  | { type: 'level'; level: number }
  | { type: 'achievement'; id: string }
  | { type: 'table'; table: number }
  | { type: 'boss'; kind: string }
  | { type: 'sector'; sector: number };

export interface CannonSkin {
  shape: 'classic' | 'twin' | 'crystal' | 'retro' | 'heavy' | 'needle' | 'orb' | 'phoenix';
  base: string;
  accent: string;
  glow: string;
}

export interface TrailSkin {
  style: 'line' | 'sparks' | 'rainbow' | 'plasma' | 'ice' | 'fire' | 'void' | 'star';
  color: string;
  color2: string;
}

export interface ExplosionSkin {
  style: 'burst' | 'ring' | 'confetti' | 'ice' | 'supernova';
  palette: string[];
}

export interface PlanetSkin {
  style: 'earth' | 'mars' | 'neon' | 'ice' | 'lava' | 'crystal';
  ocean: string;
  land: string;
  atmosphere: string;
  lights: string;
  rings: boolean;
}

export interface NebulaSkin {
  palette: string[];
  stars: string;
}

export interface ReticleSkin {
  style: 'ring' | 'brackets' | 'diamond' | 'crosshair';
  color: string;
}

export interface CosmeticItem<T = unknown> {
  id: string;
  category: CosmeticCategory;
  /** Clé i18n du nom. */
  nameKey: string;
  unlock: UnlockRule;
  data: T;
}

export const CANNONS: CosmeticItem<CannonSkin>[] = [
  { id: 'cannon_classic', category: 'cannon', nameKey: 'cos.cannon_classic', unlock: { type: 'default' }, data: { shape: 'classic', base: '#9fb3d9', accent: '#38e8ff', glow: '#38e8ff' } },
  { id: 'cannon_twin', category: 'cannon', nameKey: 'cos.cannon_twin', unlock: { type: 'buy', price: 150 }, data: { shape: 'twin', base: '#b8c4e6', accent: '#ff4fd8', glow: '#ff4fd8' } },
  { id: 'cannon_retro', category: 'cannon', nameKey: 'cos.cannon_retro', unlock: { type: 'level', level: 5 }, data: { shape: 'retro', base: '#d9c7a0', accent: '#ff9f43', glow: '#ffd166' } },
  { id: 'cannon_crystal', category: 'cannon', nameKey: 'cos.cannon_crystal', unlock: { type: 'table', table: 5 }, data: { shape: 'crystal', base: '#cfe9ff', accent: '#8a6cff', glow: '#b39cff' } },
  { id: 'cannon_heavy', category: 'cannon', nameKey: 'cos.cannon_heavy', unlock: { type: 'boss', kind: 'hydra' }, data: { shape: 'heavy', base: '#7f8aa8', accent: '#5cf2a6', glow: '#5cf2a6' } },
  { id: 'cannon_needle', category: 'cannon', nameKey: 'cos.cannon_needle', unlock: { type: 'achievement', id: 'combo_35' }, data: { shape: 'needle', base: '#e6ecff', accent: '#38e8ff', glow: '#ffffff' } },
  { id: 'cannon_orb', category: 'cannon', nameKey: 'cos.cannon_orb', unlock: { type: 'buy', price: 600 }, data: { shape: 'orb', base: '#3b2d6b', accent: '#ff4fd8', glow: '#c86bff' } },
  { id: 'cannon_phoenix', category: 'cannon', nameKey: 'cos.cannon_phoenix', unlock: { type: 'boss', kind: 'mothership' }, data: { shape: 'phoenix', base: '#ffb347', accent: '#ff5d73', glow: '#ffd166' } },
];

export const TRAILS: CosmeticItem<TrailSkin>[] = [
  { id: 'trail_cyan', category: 'trail', nameKey: 'cos.trail_cyan', unlock: { type: 'default' }, data: { style: 'line', color: '#38e8ff', color2: '#ffffff' } },
  { id: 'trail_magenta', category: 'trail', nameKey: 'cos.trail_magenta', unlock: { type: 'buy', price: 80 }, data: { style: 'line', color: '#ff4fd8', color2: '#ffffff' } },
  { id: 'trail_sparks', category: 'trail', nameKey: 'cos.trail_sparks', unlock: { type: 'buy', price: 200 }, data: { style: 'sparks', color: '#ffd166', color2: '#ff9f43' } },
  { id: 'trail_rainbow', category: 'trail', nameKey: 'cos.trail_rainbow', unlock: { type: 'achievement', id: 'perfect_wave' }, data: { style: 'rainbow', color: '#ff5d73', color2: '#38e8ff' } },
  { id: 'trail_plasma', category: 'trail', nameKey: 'cos.trail_plasma', unlock: { type: 'level', level: 10 }, data: { style: 'plasma', color: '#8a6cff', color2: '#ff4fd8' } },
  { id: 'trail_ice', category: 'trail', nameKey: 'cos.trail_ice', unlock: { type: 'table', table: 6 }, data: { style: 'ice', color: '#bfefff', color2: '#7fe3ff' } },
  { id: 'trail_fire', category: 'trail', nameKey: 'cos.trail_fire', unlock: { type: 'boss', kind: 'chrono' }, data: { style: 'fire', color: '#ff9f43', color2: '#ff5d73' } },
  { id: 'trail_void', category: 'trail', nameKey: 'cos.trail_void', unlock: { type: 'achievement', id: 'survival_10' }, data: { style: 'void', color: '#c86bff', color2: '#1a0b3a' } },
];

export const EXPLOSIONS: CosmeticItem<ExplosionSkin>[] = [
  { id: 'expl_burst', category: 'explosion', nameKey: 'cos.expl_burst', unlock: { type: 'default' }, data: { style: 'burst', palette: ['#ffd166', '#ff9f43', '#ffffff', '#ff5d73'] } },
  { id: 'expl_ring', category: 'explosion', nameKey: 'cos.expl_ring', unlock: { type: 'buy', price: 120 }, data: { style: 'ring', palette: ['#38e8ff', '#ffffff', '#8a6cff'] } },
  { id: 'expl_confetti', category: 'explosion', nameKey: 'cos.expl_confetti', unlock: { type: 'achievement', id: 'first_boss' }, data: { style: 'confetti', palette: ['#ff4fd8', '#5cf2a6', '#ffd166', '#38e8ff', '#ff5d73'] } },
  { id: 'expl_ice', category: 'explosion', nameKey: 'cos.expl_ice', unlock: { type: 'table', table: 8 }, data: { style: 'ice', palette: ['#bfefff', '#7fe3ff', '#ffffff'] } },
  { id: 'expl_supernova', category: 'explosion', nameKey: 'cos.expl_supernova', unlock: { type: 'level', level: 20 }, data: { style: 'supernova', palette: ['#ffffff', '#ffd166', '#ff4fd8', '#8a6cff'] } },
];

export const PLANETS: CosmeticItem<PlanetSkin>[] = [
  { id: 'planet_earth', category: 'planet', nameKey: 'cos.planet_earth', unlock: { type: 'default' }, data: { style: 'earth', ocean: '#1d5fd1', land: '#3fae5a', atmosphere: '#6fc3ff', lights: '#ffe9a6', rings: false } },
  { id: 'planet_mars', category: 'planet', nameKey: 'cos.planet_mars', unlock: { type: 'sector', sector: 2 }, data: { style: 'mars', ocean: '#b24a2a', land: '#d9775a', atmosphere: '#ffb08a', lights: '#ffd9c2', rings: false } },
  { id: 'planet_neon', category: 'planet', nameKey: 'cos.planet_neon', unlock: { type: 'buy', price: 300 }, data: { style: 'neon', ocean: '#1a0b3a', land: '#ff4fd8', atmosphere: '#c86bff', lights: '#38e8ff', rings: true } },
  { id: 'planet_ice', category: 'planet', nameKey: 'cos.planet_ice', unlock: { type: 'table', table: 7 }, data: { style: 'ice', ocean: '#8fd3ff', land: '#e8f7ff', atmosphere: '#bfefff', lights: '#ffffff', rings: true } },
  { id: 'planet_lava', category: 'planet', nameKey: 'cos.planet_lava', unlock: { type: 'boss', kind: 'mirror' }, data: { style: 'lava', ocean: '#2a1208', land: '#ff6a2a', atmosphere: '#ff9f43', lights: '#ffd166', rings: false } },
  { id: 'planet_crystal', category: 'planet', nameKey: 'cos.planet_crystal', unlock: { type: 'achievement', id: 'all_mastered' }, data: { style: 'crystal', ocean: '#2d1b6b', land: '#9b7bff', atmosphere: '#d6c8ff', lights: '#ffffff', rings: true } },
];

export const NEBULAE: CosmeticItem<NebulaSkin>[] = [
  { id: 'neb_deep', category: 'nebula', nameKey: 'cos.neb_deep', unlock: { type: 'default' }, data: { palette: ['#1a2a6c', '#2b1055', '#0f3460'], stars: '#ffffff' } },
  { id: 'neb_rose', category: 'nebula', nameKey: 'cos.neb_rose', unlock: { type: 'buy', price: 100 }, data: { palette: ['#6b1f5c', '#2b1055', '#8a2a6c'], stars: '#ffe6f7' } },
  { id: 'neb_emerald', category: 'nebula', nameKey: 'cos.neb_emerald', unlock: { type: 'sector', sector: 4 }, data: { palette: ['#0b4d3a', '#0f3460', '#1f6f5a'], stars: '#e6fff5' } },
  { id: 'neb_solar', category: 'nebula', nameKey: 'cos.neb_solar', unlock: { type: 'level', level: 15 }, data: { palette: ['#6b3a0b', '#4a1b1b', '#8a4a1b'], stars: '#fff2d6' } },
  { id: 'neb_void', category: 'nebula', nameKey: 'cos.neb_void', unlock: { type: 'boss', kind: 'titan' }, data: { palette: ['#0a0a1a', '#1a0b3a', '#141432'], stars: '#c8d8ff' } },
  { id: 'neb_aurora', category: 'nebula', nameKey: 'cos.neb_aurora', unlock: { type: 'achievement', id: 'streak_7' }, data: { palette: ['#0b4d6b', '#3a0b6b', '#0b6b4d'], stars: '#ffffff' } },
];

export const RETICLES: CosmeticItem<ReticleSkin>[] = [
  { id: 'ret_ring', category: 'reticle', nameKey: 'cos.ret_ring', unlock: { type: 'default' }, data: { style: 'ring', color: '#38e8ff' } },
  { id: 'ret_brackets', category: 'reticle', nameKey: 'cos.ret_brackets', unlock: { type: 'buy', price: 60 }, data: { style: 'brackets', color: '#5cf2a6' } },
  { id: 'ret_diamond', category: 'reticle', nameKey: 'cos.ret_diamond', unlock: { type: 'level', level: 8 }, data: { style: 'diamond', color: '#ff4fd8' } },
  { id: 'ret_cross', category: 'reticle', nameKey: 'cos.ret_cross', unlock: { type: 'achievement', id: 'blitz_40' }, data: { style: 'crosshair', color: '#ffd166' } },
];

export const ALL_COSMETICS: CosmeticItem[] = [...CANNONS, ...TRAILS, ...EXPLOSIONS, ...PLANETS, ...NEBULAE, ...RETICLES];

export const CATEGORIES: CosmeticCategory[] = ['cannon', 'trail', 'explosion', 'planet', 'nebula', 'reticle'];

export const DEFAULT_EQUIPPED: Record<CosmeticCategory, string> = {
  cannon: 'cannon_classic',
  trail: 'trail_cyan',
  explosion: 'expl_burst',
  planet: 'planet_earth',
  nebula: 'neb_deep',
  reticle: 'ret_ring',
};

export interface EquippedSkins {
  cannon: CannonSkin;
  trail: TrailSkin;
  explosion: ExplosionSkin;
  planet: PlanetSkin;
  nebula: NebulaSkin;
  reticle: ReticleSkin;
}

export function byId(id: string): CosmeticItem | undefined {
  return ALL_COSMETICS.find((c) => c.id === id);
}

export function resolveSkins(equipped: Partial<Record<CosmeticCategory, string>>): EquippedSkins {
  const get = <T>(cat: CosmeticCategory, list: CosmeticItem<T>[]): T => {
    const id = equipped[cat] ?? DEFAULT_EQUIPPED[cat];
    return (list.find((c) => c.id === id) ?? list[0]!).data;
  };
  return {
    cannon: get('cannon', CANNONS),
    trail: get('trail', TRAILS),
    explosion: get('explosion', EXPLOSIONS),
    planet: get('planet', PLANETS),
    nebula: get('nebula', NEBULAE),
    reticle: get('reticle', RETICLES),
  };
}
