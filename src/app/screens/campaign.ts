import { audio } from '../../audio/AudioManager';
import { factsMap } from '../../data/profile';
import { CAMPAIGN_WAVES, SECTOR_BOSS, campaignMode, sectorCount, sectorTable } from '../../game/modes/index';
import { t } from '../../i18n';
import { tableStats } from '../../learning/curriculum';
import { button, h } from '../../ui/dom';
import { createOpsPicker, opsTitleSuffix } from '../../ui/opsPicker';
import type { App, ScreenResult } from '../App';

const PLANET_COLORS = ['#2d7bff', '#ff9f43', '#5cf2a6', '#ff4fd8', '#ffd166', '#8a6cff', '#38e8ff', '#ff5d73', '#b5e853', '#c86bff', '#4ad7d1', '#ff7f50'];

export function renderCampaign(app: App): ScreenResult {
  const p = app.p;
  const facts = factsMap(p);
  const fluent = app.fluentMs();
  const n = sectorCount(p.maxTable);
  const recommended = app.recommendedSector();
  const galaxy = h('div', { class: 'galaxy' });

  for (let i = 0; i < n; i++) {
    const table = sectorTable(i, p.maxTable);
    const prog = p.sectors[i];
    const stars = prog?.stars ?? 0;
    const stats = tableStats(facts, table, p.maxTable, fluent, p.ops);
    const pct = Math.round(stats.avgMastery * 25);
    const boss = SECTOR_BOSS[i] ?? 'titan';
    const color = PLANET_COLORS[i % PLANET_COLORS.length];
    const card = h(
      'button',
      {
        class: `sector ${i === recommended ? 'current' : ''}`,
        onClick: () => {
          audio.click();
          launch(i);
        },
      },
      h('span', { class: `tag ${i === recommended ? 'tag-gold' : ''}` }, i === recommended ? t('campaign.recommended') : t('common.sector', { n: i + 1 })),
      h('div', { class: 'planet', style: `background: radial-gradient(circle at 35% 30%, #fff8 0, ${color} 35%, #05081a 110%)` }, String(table)),
      h('span', { class: 'label' }, t('common.table', { n: table })),
      h('span', { class: 'stars' }, [1, 2, 3].map((k) => h('span', { class: k <= stars ? '' : 'off' }, '★'))),
      h('span', { class: 'boss' }, `👾 ${t(`boss.${boss}`)}`),
      h('div', { class: 'mastery' }, h('div', { class: `progress ${pct >= 90 ? 'gold' : ''}`, title: t('campaign.mastery', { pct }) }, h('i', { style: `width:${pct}%` }))),
      h('span', { class: 'small muted' }, t('campaign.mastery', { pct })),
    );
    galaxy.appendChild(card);
  }

  function launch(sector: number): void {
    const build = () => campaignMode(sector, { maxTable: p.maxTable, fluentMs: app.fluentMs(), reviewTables: app.completedTables(), ops: p.ops });
    app.go('game', { mode: build(), title: `${t('common.sector', { n: sector + 1 })} · ${t('common.table', { n: sectorTable(sector, p.maxTable) })}${opsTitleSuffix(p.ops)}`, rebuild: build });
  }

  const allDone = app.completedTables().length === n;
  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('campaign.title')), h('span', { class: 'muted small' }, t('campaign.waves', { n: CAMPAIGN_WAVES }))),
      allDone ? h('div', { class: 'panel' }, `🏆 ${t('campaign.complete')}`) : '',
      h('div', { class: 'row ops-row' }, h('span', { class: 'muted small' }, t('ops.title')), createOpsPicker(p.ops, (v) => { p.ops = v; app.persist(); app.go('campaign', undefined); })),
      galaxy,
      h('p', { class: 'muted small' }, t('campaign.freeHint')),
    ),
  );
  return { el };
}
