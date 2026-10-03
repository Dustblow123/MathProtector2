import { en } from './en';
import { fr } from './fr';

export type Lang = 'fr' | 'en';
export type TKey = keyof typeof fr;

const dicts: Record<Lang, Record<TKey, string>> = { fr, en };
let current: Lang = 'fr';

export function setLang(l: Lang): void {
  current = l;
  document.documentElement.lang = l;
}

export function getLang(): Lang {
  return current;
}

export function detectLang(): Lang {
  const nav = (navigator.language || 'fr').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'fr';
}

/** Traduit une clé avec interpolation `{param}`. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  let s: string = dicts[current][key] ?? dicts.fr[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const LANGS: Lang[] = ['fr', 'en'];
