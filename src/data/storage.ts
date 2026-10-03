import type { Lang } from '../i18n';
import { AVATARS, createProfile, type Profile } from './profile';

export const STORAGE_KEY = 'mp2:save';
export const SAVE_VERSION = 2;

export interface Settings {
  lang: Lang | null;
  sfxVolume: number;
  musicVolume: number;
  autoFire: boolean;
  numpad: 'auto' | 'on' | 'off';
  reducedMotion: boolean;
  /** Indices : texte, visuel (grille de points / ligne numérique) ou les deux. */
  hintStyle: 'text' | 'visual' | 'both';
  /** Lecture vocale des calculs (Web Speech). */
  speech: boolean;
  readableFont: boolean;
  largeText: boolean;
  colorblind: boolean;
  highContrast: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  activeProfileId: string | null;
  profiles: Profile[];
}

export const DEFAULT_SETTINGS: Settings = {
  lang: null,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  autoFire: true,
  numpad: 'auto',
  reducedMotion: false,
  hintStyle: 'both',
  speech: false,
  readableFont: false,
  largeText: false,
  colorblind: false,
  highContrast: false,
};

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, settings: { ...DEFAULT_SETTINGS }, activeProfileId: null, profiles: [] };
}

/** Migre une sauvegarde d'une version antérieure vers la version courante. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return emptySave();
  const data = raw as Partial<SaveData> & { version?: number };
  const out = emptySave();
  out.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
  out.activeProfileId = data.activeProfileId ?? null;
  out.profiles = Array.isArray(data.profiles) ? data.profiles.map(normalizeProfile) : [];
  // v1 → v2 : nouveaux champs de profil (weekly, reviewDoneDay, autoFluent, stats.recentRts…) ajoutés par normalizeProfile.
  out.version = SAVE_VERSION;
  return out;
}

/** Complète les champs manquants d'un profil (robustesse face aux anciennes versions ou aux imports). */
export function normalizeProfile(p: Partial<Profile>): Profile {
  const base = createProfile(p.name ?? 'Joueur', p.avatar ?? AVATARS[0]!, p.agePreset ?? 'mid');
  const merged: Profile = { ...base, ...p, stats: { ...base.stats, ...(p.stats ?? {}) }, equipped: { ...base.equipped, ...(p.equipped ?? {}) } };
  if (!merged.id) merged.id = base.id;
  if (!Array.isArray(merged.cosmeticsOwned)) merged.cosmeticsOwned = [...base.cosmeticsOwned];
  for (const d of base.cosmeticsOwned) if (!merged.cosmeticsOwned.includes(d)) merged.cosmeticsOwned.push(d);
  if (!merged.facts || typeof merged.facts !== 'object') merged.facts = {};
  return merged;
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySave();
    return migrate(JSON.parse(raw));
  } catch {
    return emptySave();
  }
}

let pending: number | null = null;

export function save(data: SaveData, immediate = false): void {
  const write = () => {
    pending = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota ou stockage indisponible : on ignore */
    }
  };
  if (immediate) {
    if (pending !== null) clearTimeout(pending);
    write();
    return;
  }
  if (pending !== null) return;
  pending = window.setTimeout(write, 400);
}

export function exportProfile(p: Profile): string {
  return JSON.stringify({ app: 'MathProtector2', version: SAVE_VERSION, profile: p }, null, 2);
}

export function importProfile(json: string): Profile {
  const parsed = JSON.parse(json) as { profile?: Partial<Profile> } | Partial<Profile>;
  const raw = 'profile' in parsed && parsed.profile ? parsed.profile : (parsed as Partial<Profile>);
  if (!raw || typeof raw !== 'object' || !('name' in raw)) throw new Error('invalid');
  const p = normalizeProfile(raw);
  p.id = `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  return p;
}
