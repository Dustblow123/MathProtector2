import { audio } from '../../audio/AudioManager';
import { campaignMode, sectorCount, sectorTable } from '../../game/modes/index';
import { levelFromXp } from '../../game/scoring';
import { t } from '../../i18n';
import { parseFactId } from '../../learning/facts';
import { ACHIEVEMENTS } from '../../progression/achievements';
import { button, h } from '../../ui/dom';
import type { App, ResultsParams, ScreenResult } from '../App';

export function renderResults(app: App, params: ResultsParams): ScreenResult {
  const { launch, result, outcome, drillDone } = params;
  const p = app.p;
  const title = result.aborted ? t('results.aborted') : result.victory ? (launch.mode.timeLimitMs > 0 ? t('results.timeUp') : t('results.victory')) : t('results.defeat');
  const lvl = levelFromXp(p.xp);
  const fmtFact = (id: string) => {
    const f = parseFactId(id);
    return `${f.a} × ${f.b} = ${f.product}`;
  };

  const rewards: HTMLElement[] = [];
  if (outcome.levelAfter > outcome.levelBefore) rewards.push(h('div', { class: 'reward' }, h('span', { class: 'icon' }, '🆙'), h('b', null, t('results.levelUp', { n: outcome.levelAfter }))));
  if (outcome.sectorUnlocked !== null) rewards.push(h('div', { class: 'reward' }, h('span', { class: 'icon' }, '🪐'), h('b', null, t('results.sectorDone', { table: sectorTable(result.sector ?? 0, p.maxTable) }))));
  if (outcome.dailyMedal) rewards.push(h('div', { class: 'reward' }, h('span', { class: 'icon' }, outcome.dailyMedal === 'gold' ? '🥇' : outcome.dailyMedal === 'silver' ? '🥈' : '🥉'), h('b', null, t('results.medal', { medal: t(`medal.${outcome.dailyMedal}` as 'medal.gold') }))));
  for (const id of outcome.newAchievements) {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    rewards.push(h('div', { class: 'reward' }, h('span', { class: 'icon' }, def?.icon ?? '🏅'), h('div', null, h('b', null, t(`ach.${id}` as 'ach.first_blood')), h('div', { class: 'small muted' }, t(`ach.${id}.desc` as 'ach.first_blood.desc'))), h('span', { class: 'spacer' }), h('span', { class: 'tag tag-gold' }, `+${def?.reward ?? 0} ✦`)));
  }
  for (const c of outcome.newCosmetics) rewards.push(h('div', { class: 'reward' }, h('span', { class: 'icon' }, '🎨'), h('div', null, h('b', null, t(c.nameKey as 'cos.cannon_classic')), h('div', { class: 'small muted' }, t(`cat.${c.category}` as 'cat.cannon')))));
  if (drillDone) rewards.unshift(h('div', { class: 'reward' }, h('span', { class: 'icon' }, '🔁'), h('b', null, t('results.drillDone', { correct: drillDone.correct, total: drillDone.total }))));
  if (rewards.length > 0) setTimeout(() => audio.unlockJingle(), 400);

  const stars = result.modeId === 'campaign' && result.victory ? h('div', { class: 'stars' }, [1, 2, 3].map((i) => h('span', { class: i <= result.stars ? '' : 'off' }, '★'))) : '';

  const actions = h('div', { class: 'row', style: 'justify-content:center' });
  if (result.weakFacts.length > 0 && !drillDone && !result.aborted) {
    actions.appendChild(button(`🔁 ${t('results.drill', { n: Math.min(5, result.weakFacts.length + 2) })}`, () => app.go('drill', params), 'btn btn-accent btn-big'));
  }
  const nextSector = result.modeId === 'campaign' && result.victory && result.sector !== null && app.completedTables().length < sectorCount(p.maxTable) ? app.recommendedSector() : null;
  if (nextSector !== null && nextSector !== result.sector) {
    actions.appendChild(
      button(`${t('results.nextSector')} →`, () => {
        const sector = nextSector;
        const build = () => campaignMode(sector, { maxTable: p.maxTable, fluentMs: app.fluentMs(), reviewTables: app.completedTables() });
        app.go('game', { mode: build(), title: `${t('common.sector', { n: sector + 1 })} · ${t('common.table', { n: sectorTable(sector, p.maxTable) })}`, rebuild: build });
      }, 'btn btn-primary btn-big'),
    );
  }
  if (result.modeId !== 'daily' && result.modeId !== 'weekly') actions.appendChild(button(`↻ ${t('common.replay')}`, () => app.go('game', { ...launch, mode: launch.rebuild() }), nextSector !== null ? 'btn btn-big' : 'btn btn-primary btn-big'));
  actions.appendChild(button(t('common.menu'), () => app.go('menu', undefined), 'btn btn-ghost btn-big'));

  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'results-hero' }, h('h1', { style: result.victory || result.aborted ? '' : 'color:var(--red);text-shadow:0 0 18px rgba(255,93,115,.5)' }, title), h('p', { class: 'muted' }, launch.title), stars, result.perfect ? h('span', { class: 'tag tag-green' }, t('results.perfect')) : ''),
      h(
        'div',
        { class: 'panel' },
        h(
          'div',
          { class: 'stat-grid' },
          stat(result.score.toLocaleString(), t('results.score')),
          stat(String(result.destroyed), t('results.destroyed')),
          stat(`${result.correct}${result.powerupKills > 0 ? ` (+${result.powerupKills})` : ''}`, t('results.correct')),
          stat(`${Math.round(result.accuracy * 100)} %`, t('results.accuracy')),
          stat(result.avgRt > 0 ? `${(result.avgRt / 1000).toFixed(1)} s` : '—', t('results.avgRt')),
          stat(`×${result.maxCombo}`, t('results.maxCombo')),
          stat(`+${result.stardust} ✦`, t('results.stardust')),
          stat(`+${result.xp}`, t('results.xp')),
          result.wavesCleared > 0 ? stat(String(result.wavesCleared), t('results.waves')) : '',
          result.modeId === 'review' ? stat(String(result.reviewed), t('results.reviewed')) : '',
          result.helps > 0 ? stat(String(result.helps), t('results.helps')) : '',
        ),
        h('div', { style: 'margin-top:14px' }, h('div', { class: 'row small muted', style: 'justify-content:space-between' }, h('span', null, t('common.level', { n: lvl.level })), h('span', null, `${lvl.current} / ${lvl.next} XP`)), h('div', { class: 'progress' }, h('i', { style: `width:${Math.round((lvl.current / lvl.next) * 100)}%` }))),
      ),
      rewards.length > 0 ? h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:8px' }, rewards) : '',
      result.newlyMastered.length > 0 ? h('div', { class: 'panel' }, h('h3', null, t('results.mastered')), h('div', { class: 'fact-chips', style: 'margin-top:8px' }, result.newlyMastered.map((id) => h('span', { class: 'fact-chip good' }, fmtFact(id))))) : '',
      result.weakFacts.length > 0 ? h('div', { class: 'panel' }, h('h3', null, t('results.weakFacts')), h('div', { class: 'fact-chips', style: 'margin-top:8px' }, result.weakFacts.slice(0, 12).map((id) => h('span', { class: 'fact-chip' }, fmtFact(id))))) : '',
      actions,
    ),
  );
  return { el };
}

function stat(value: string, label: string): HTMLElement {
  return h('div', { class: 'stat' }, h('b', null, value), h('span', null, label));
}
