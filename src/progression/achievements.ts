import type { SessionResult } from '../game/types';

export interface AchievementDef {
  id: string;
  /** Icône (emoji) affichée dans la liste. */
  icon: string;
  /** Récompense en poussière d'étoiles. */
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', icon: '💥', reward: 20 },
  { id: 'first_wave', icon: '🌊', reward: 30 },
  { id: 'first_boss', icon: '👾', reward: 80 },
  { id: 'combo_10', icon: '🔥', reward: 30 },
  { id: 'combo_20', icon: '🔥', reward: 60 },
  { id: 'combo_35', icon: '🔥', reward: 120 },
  { id: 'perfect_wave', icon: '✨', reward: 60 },
  { id: 'perfect_sector', icon: '🌟', reward: 150 },
  { id: 'boss_no_damage', icon: '🛡️', reward: 150 },
  { id: 'table_2', icon: '2️⃣', reward: 40 },
  { id: 'table_5', icon: '5️⃣', reward: 40 },
  { id: 'table_7', icon: '7️⃣', reward: 100 },
  { id: 'table_9', icon: '9️⃣', reward: 100 },
  { id: 'all_mastered', icon: '🏆', reward: 500 },
  { id: 'survival_10', icon: '⏳', reward: 120 },
  { id: 'blitz_40', icon: '⚡', reward: 100 },
  { id: 'daily_first', icon: '📅', reward: 40 },
  { id: 'streak_3', icon: '🗓️', reward: 60 },
  { id: 'streak_7', icon: '🗓️', reward: 200 },
  { id: 'fluent_100', icon: '🚀', reward: 80 },
  { id: 'destroyed_500', icon: '☄️', reward: 100 },
  { id: 'destroyed_2000', icon: '☄️', reward: 300 },
  { id: 'all_bosses', icon: '👑', reward: 400 },
  { id: 'collector', icon: '🎨', reward: 150 },
  { id: 'night_owl', icon: '🦉', reward: 30 },
];

export interface AchievementContext {
  result: SessionResult;
  totals: { destroyed: number; fluent: number; sessions: number; streakDays: number };
  masteredTables: number[];
  allTablesMastered: boolean;
  bossesEverDefeated: string[];
  cosmeticsOwned: number;
  hour: number;
}

/** Retourne les identifiants des succès nouvellement obtenus. */
export function evaluateAchievements(ctx: AchievementContext, already: ReadonlySet<string>): string[] {
  const got: string[] = [];
  const r = ctx.result;
  const add = (id: string, cond: boolean) => {
    if (cond && !already.has(id) && !got.includes(id)) got.push(id);
  };
  add('first_blood', r.destroyed > 0);
  add('first_wave', r.wavesCleared > 0);
  add('first_boss', r.bossesDefeated.length > 0);
  add('combo_10', r.maxCombo >= 10);
  add('combo_20', r.maxCombo >= 20);
  add('combo_35', r.maxCombo >= 35);
  add('perfect_wave', r.wavesCleared > 0 && r.errors === 0 && r.hitsTaken === 0);
  add('perfect_sector', r.modeId === 'campaign' && r.victory && r.perfect);
  add('boss_no_damage', r.bossesDefeated.length > 0 && r.hitsTaken === 0);
  for (const tb of [2, 5, 7, 9]) add(`table_${tb}`, ctx.masteredTables.includes(tb));
  add('all_mastered', ctx.allTablesMastered);
  add('survival_10', r.modeId === 'survival' && r.wavesCleared >= 10);
  add('blitz_40', r.modeId === 'blitz' && r.destroyed >= 40);
  add('daily_first', r.modeId === 'daily');
  add('streak_3', ctx.totals.streakDays >= 3);
  add('streak_7', ctx.totals.streakDays >= 7);
  add('fluent_100', ctx.totals.fluent >= 100);
  add('destroyed_500', ctx.totals.destroyed >= 500);
  add('destroyed_2000', ctx.totals.destroyed >= 2000);
  add('all_bosses', ['titan', 'swarm', 'hydra', 'twins', 'mirror', 'phantom', 'chrono', 'mothership'].every((b) => ctx.bossesEverDefeated.includes(b)));
  add('collector', ctx.cosmeticsOwned >= 15);
  add('night_owl', ctx.hour >= 21 || ctx.hour < 6);
  return got;
}
