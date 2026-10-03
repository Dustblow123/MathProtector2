import type { Profile } from '../data/profile';
import { FLUENT_MS, factsMap, storeFacts } from '../data/profile';
import { dateKey, sectorCount, weekKey } from '../game/modes/index';
import { pushRts } from '../learning/calibration';
import { levelFromXp } from '../game/scoring';
import type { SessionResult } from '../game/types';
import { tableOrder } from '../learning/curriculum';
import type { FactId, FactState } from '../learning/types';
import { ACHIEVEMENTS, evaluateAchievements } from './achievements';
import type { CosmeticItem } from './cosmetics';
import { grantEarnedCosmetics, masteredTables } from './unlocks';

export interface ApplyOutcome {
  levelBefore: number;
  levelAfter: number;
  newAchievements: string[];
  newCosmetics: CosmeticItem[];
  sectorUnlocked: number | null;
  achievementStardust: number;
  dailyMedal: string | null;
}

function medalFor(r: SessionResult): string {
  if (r.accuracy >= 0.95 && r.hitsTaken === 0) return 'gold';
  if (r.accuracy >= 0.8) return 'silver';
  return 'bronze';
}

/** Applique le résultat d'une session au profil : modèle, XP, monnaie, campagne, succès, stats. */
export function applySession(p: Profile, result: SessionResult, facts: Map<FactId, FactState>, confusions: Record<string, number>): ApplyOutcome {
  storeFacts(p, facts);
  const levelBefore = levelFromXp(p.xp).level;
  p.xp += result.xp;
  p.stardust += result.stardust;

  let sectorUnlocked: number | null = null;
  if (result.modeId === 'campaign' && result.sector !== null) {
    const prev = p.sectors[result.sector];
    const wasNew = (prev?.stars ?? 0) === 0;
    const s = prev ?? { stars: 0, bestScore: 0, attempts: 0 };
    s.attempts++;
    s.bestScore = Math.max(s.bestScore, result.score);
    if (result.victory) {
      s.stars = Math.max(s.stars, result.stars);
      const next = result.sector + 1;
      if (next < sectorCount(p.maxTable) && p.unlockedSector < next) p.unlockedSector = next;
      // Première victoire sur ce secteur : on signale le secteur suivant (les tables restent libres).
      if (wasNew && next < sectorCount(p.maxTable)) sectorUnlocked = next;
    }
    p.sectors[result.sector] = s;
  }
  if (result.modeId === 'patrol') {
    if (result.score > p.bestPatrol.score) p.bestPatrol = { score: result.score, waves: result.wavesCleared };
  }
  if (result.modeId === 'survival') {
    if (result.score > p.bestSurvival.score) p.bestSurvival = { score: result.score, waves: result.wavesCleared };
  }
  if (result.modeId === 'blitz') {
    if (result.score > p.bestBlitz.score) p.bestBlitz = { score: result.score, destroyed: result.destroyed };
  }
  let dailyMedal: string | null = null;
  if (result.modeId === 'weekly') {
    dailyMedal = medalFor(result);
    p.weekly = { week: weekKey(), score: result.score, medal: dailyMedal };
  }
  if (result.modeId === 'daily') {
    dailyMedal = medalFor(result);
    p.daily = { lastDay: dateKey(), score: result.score, medal: dailyMedal };
  }
  for (const b of result.bossesDefeated) if (!p.bossesDefeated.includes(b)) p.bossesDefeated.push(b);

  // Statistiques
  const today = dateKey();
  const st = p.stats;
  st.sessions++;
  st.destroyed += result.destroyed;
  st.correct += result.correct;
  st.fluent += Math.round(result.fluentRatio * (result.answered - result.errors));
  st.errors += result.errors;
  st.timeMs += result.durationMs;
  if (st.lastPlayedDay !== today) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    st.streakDays = st.lastPlayedDay === dateKey(y) ? st.streakDays + 1 : 1;
    st.lastPlayedDay = today;
  }
  let day = st.days.find((d) => d.day === today);
  if (!day) {
    day = { day: today, sessions: 0, destroyed: 0, errors: 0, timeMs: 0 };
    st.days.push(day);
    if (st.days.length > 120) st.days.shift();
  }
  day.sessions++;
  day.destroyed += result.destroyed;
  day.errors += result.errors;
  day.timeMs += result.durationMs;
  for (const [k, v] of Object.entries(confusions)) st.confusions[k] = (st.confusions[k] ?? 0) + v;
  st.recentRts = pushRts(st.recentRts, result.correctRts);
  st.helps += result.helps;
  if (result.modeId === 'review' && result.reviewed > 0) {
    st.reviewSessions++;
    if (st.lastReviewDay !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      st.reviewStreak = st.lastReviewDay === dateKey(y) ? st.reviewStreak + 1 : 1;
      st.lastReviewDay = today;
    }
    p.reviewDoneDay = today;
  }

  // Succès et cosmétiques
  const mastered = masteredTables(p);
  const already = new Set(p.achievements);
  const newAchievements = evaluateAchievements(
    {
      result,
      totals: { destroyed: st.destroyed, fluent: st.fluent, sessions: st.sessions, streakDays: st.streakDays, reviewSessions: st.reviewSessions, reviewStreak: st.reviewStreak },
      masteredTables: mastered,
      allTablesMastered: tableOrder(p.maxTable).every((t) => mastered.includes(t)),
      bossesEverDefeated: p.bossesDefeated,
      cosmeticsOwned: p.cosmeticsOwned.length,
      hour: new Date().getHours(),
    },
    already,
  );
  let achievementStardust = 0;
  for (const id of newAchievements) {
    p.achievements.push(id);
    achievementStardust += ACHIEVEMENTS.find((a) => a.id === id)?.reward ?? 0;
  }
  p.stardust += achievementStardust;
  const newCosmetics = grantEarnedCosmetics(p);
  // Un succès "collectionneur" peut se débloquer après l'octroi de cosmétiques.
  if (p.cosmeticsOwned.length >= 15 && !p.achievements.includes('collector')) {
    p.achievements.push('collector');
    newAchievements.push('collector');
    const rw = ACHIEVEMENTS.find((a) => a.id === 'collector')?.reward ?? 0;
    p.stardust += rw;
    achievementStardust += rw;
  }

  return { levelBefore, levelAfter: levelFromXp(p.xp).level, newAchievements, newCosmetics, sectorUnlocked, achievementStardust, dailyMedal };
}

export function fluentMsFor(p: Profile): number {
  return FLUENT_MS[p.agePreset];
}

export { medalFor };

export { factsMap };
