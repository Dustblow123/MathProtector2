import type { Profile } from '../data/profile';
import { tableStats, isTableValidated, tableOrder } from '../learning/curriculum';
import { factsMap, FLUENT_MS } from '../data/profile';
import { levelFromXp } from '../game/scoring';
import { ALL_COSMETICS, type CosmeticItem, type UnlockRule } from './cosmetics';

export interface UnlockStatus {
  owned: boolean;
  /** Peut être obtenu maintenant (achat possible ou condition remplie). */
  available: boolean;
  rule: UnlockRule;
}

export function masteredTables(p: Profile, op: 'mul' | 'div' = 'mul'): number[] {
  const facts = factsMap(p);
  const fluent = FLUENT_MS[p.agePreset];
  return tableOrder(p.maxTable).filter((t) => isTableValidated(tableStats(facts, t, p.maxTable, fluent, op)));
}

export function cosmeticStatus(p: Profile, item: CosmeticItem, mastered: number[] = masteredTables(p)): UnlockStatus {
  const owned = p.cosmeticsOwned.includes(item.id);
  const r = item.unlock;
  let available = false;
  switch (r.type) {
    case 'default':
      available = true;
      break;
    case 'buy':
      available = p.stardust >= r.price;
      break;
    case 'level':
      available = levelFromXp(p.xp).level >= r.level;
      break;
    case 'achievement':
      available = p.achievements.includes(r.id);
      break;
    case 'table':
      available = mastered.includes(r.table);
      break;
    case 'boss':
      available = p.bossesDefeated.includes(r.kind as Profile['bossesDefeated'][number]);
      break;
    case 'sector':
      available = (p.sectors[r.sector]?.stars ?? 0) > 0;
      break;
  }
  return { owned, available, rule: r };
}

/** Attribue automatiquement les cosmétiques dont la condition (hors achat) est remplie. Renvoie les nouveaux. */
export function grantEarnedCosmetics(p: Profile): CosmeticItem[] {
  const mastered = masteredTables(p);
  const granted: CosmeticItem[] = [];
  for (const item of ALL_COSMETICS) {
    if (item.unlock.type === 'buy') continue;
    const st = cosmeticStatus(p, item, mastered);
    if (!st.owned && st.available) {
      p.cosmeticsOwned.push(item.id);
      granted.push(item);
    }
  }
  return granted;
}

export function buyCosmetic(p: Profile, item: CosmeticItem): boolean {
  if (item.unlock.type !== 'buy') return false;
  if (p.cosmeticsOwned.includes(item.id) || p.stardust < item.unlock.price) return false;
  p.stardust -= item.unlock.price;
  p.cosmeticsOwned.push(item.id);
  return true;
}
