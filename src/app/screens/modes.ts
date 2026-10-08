import { audio } from '../../audio/AudioManager';
import { SECTOR_BOSS, blitzMode, bossRushMode, dailyMode, dateKey, patrolMode, practiceMode, sectorTable, survivalMode, weekKey, weeklyMode } from '../../game/modes/index';
import { BOSS_KINDS } from '../../game/bosses/index';
import type { BossKind, ModeConfig } from '../../game/types';
import { t } from '../../i18n';
import { tableOrder } from '../../learning/curriculum';
import { button, clear, h, toast } from '../../ui/dom';
import { createOpsPicker, opsTitleSuffix } from '../../ui/opsPicker';
import type { App, ScreenResult } from '../App';

export function renderModes(app: App): ScreenResult {
  const p = app.p;
  const unlocked = app.unlockedTables();
  const all = tableOrder(p.maxTable).slice().sort((a, b) => a - b);
  let selected = new Set<number>(p.focusTables.length > 0 ? p.focusTables : unlocked);

  const chips = h('div', { class: 'chips' });
  const renderChips = () => {
    clear(chips);
    for (const tb of all) {
      chips.appendChild(
        h('button', { class: `chip ${selected.has(tb) ? 'sel' : ''} ${unlocked.includes(tb) ? '' : 'gold'}`, onClick: () => { selected.has(tb) ? selected.delete(tb) : selected.add(tb); renderChips(); } }, String(tb)),
      );
    }
    chips.appendChild(h('button', { class: 'chip', onClick: () => { selected = new Set(all); renderChips(); } }, t('modes.allTables')));
    chips.appendChild(h('button', { class: 'chip', onClick: () => { selected = new Set(unlocked); renderChips(); } }, t('modes.unlockedTables')));
  };
  renderChips();

  const tables = () => [...selected].sort((a, b) => a - b);
  const input = () => ({ maxTable: p.maxTable, fluentMs: app.fluentMs(), tables: tables(), ops: p.ops });
  const launch = (title: string, build: () => ModeConfig) => {
    if (tables().length === 0) {
      toast(t('modes.needTable'));
      return;
    }
    audio.click();
    app.go('game', { mode: build(), title: `${title}${opsTitleSuffix(p.ops)}`, rebuild: build });
  };

  const card = (icon: string, title: string, desc: string, best: string, action: HTMLElement) =>
    h('div', { class: 'mode-card' }, h('div', { class: 'title' }, h('span', null, icon), title), h('div', { class: 'desc' }, desc), best ? h('div', { class: 'small', style: 'color:var(--gold)' }, best) : '', action);

  const defeated = p.bossesDefeated;
  const rushBosses: BossKind[] = BOSS_KINDS.filter((b) => defeated.includes(b));
  const completed = app.completedTables();
  const rushTables = rushBosses.map((b) => {
    // Table du dernier secteur terminé qui affronte ce boss, sinon la première table du boss.
    let best = SECTOR_BOSS.indexOf(b);
    for (let i = 0; i < SECTOR_BOSS.length; i++) if (SECTOR_BOSS[i] === b && completed.includes(sectorTable(i, p.maxTable))) best = i;
    return sectorTable(Math.max(0, best), p.maxTable);
  });
  const dailyKey = dateKey();
  const dailyDone = p.daily?.lastDay === dailyKey;
  const wk = weekKey();
  const weeklyDone = p.weekly?.week === wk;

  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('modes.title'))),
      h('div', { class: 'panel' }, h('div', { class: 'row ops-row' }, h('h3', null, t('ops.title')), createOpsPicker(p.ops, (v) => { p.ops = v; app.persist(); })), h('p', { class: 'small muted', style: 'margin:6px 0 0' }, t('ops.hint')), h('h3', { style: 'margin-top:14px' }, t('modes.chooseTables')), h('div', { style: 'margin-top:10px' }, chips)),
      h(
        'div',
        { class: 'grid' },
        card(
          '🛰️',
          t('modes.patrol'),
          completed.length > 0 ? `${t('modes.patrol.desc')} (${completed.slice().sort((a, b) => a - b).join(', ')})` : t('modes.patrol.locked'),
          p.bestPatrol.score > 0 ? t('modes.bestSurvival', { score: p.bestPatrol.score, waves: p.bestPatrol.waves }) : '',
          completed.length > 0
            ? button(t('common.play'), () => { audio.click(); const build = () => patrolMode({ maxTable: p.maxTable, fluentMs: app.fluentMs(), tables: completed, ops: p.ops }); app.go('game', { mode: build(), title: `${t('modes.patrol')}${opsTitleSuffix(p.ops)}`, rebuild: build }); }, 'btn btn-accent')
            : button(t('common.locked'), () => undefined, 'btn'),
        ),
        card('♾️', t('modes.survival'), t('modes.survival.desc'), p.bestSurvival.score > 0 ? t('modes.bestSurvival', { score: p.bestSurvival.score, waves: p.bestSurvival.waves }) : '', button(t('common.play'), () => launch(t('modes.survival'), () => survivalMode(input())), 'btn btn-primary')),
        card('⚡', t('modes.blitz'), t('modes.blitz.desc'), p.bestBlitz.score > 0 ? t('modes.bestBlitz', { score: p.bestBlitz.score, n: p.bestBlitz.destroyed }) : '', button(t('common.play'), () => launch(t('modes.blitz'), () => blitzMode(input())), 'btn btn-primary')),
        card('🧘', t('modes.practice'), t('modes.practice.desc'), '', button(t('common.play'), () => launch(t('modes.practice'), () => practiceMode(input())), 'btn btn-primary')),
        card(
          '👾',
          t('modes.bossRush'),
          rushBosses.length > 0 ? `${t('modes.bossRush.desc')} (${rushBosses.map((b) => t(`boss.${b}`)).join(', ')})` : t('modes.bossRush.locked'),
          '',
          rushBosses.length > 0 ? button(t('common.play'), () => launch(t('modes.bossRush'), () => bossRushMode(rushBosses, rushTables, input())), 'btn btn-accent') : button(t('common.locked'), () => undefined, 'btn'),
        ),
        card(
          '📅',
          t('modes.daily'),
          dailyDone ? t('modes.daily.done', { score: p.daily?.score ?? 0, medal: t(`medal.${p.daily?.medal ?? 'bronze'}` as 'medal.gold') }) : t('modes.daily.desc'),
          '',
          dailyDone ? button('✓', () => undefined, 'btn') : button(t('common.play'), () => launch(`${t('modes.daily')} · ${dailyKey}`, () => dailyMode(dailyKey, { ...input(), tables: unlocked })), 'btn btn-accent'),
        ),
        card(
          '🏆',
          t('modes.weekly'),
          weeklyDone ? t('modes.weekly.done', { score: p.weekly?.score ?? 0, medal: t(`medal.${p.weekly?.medal ?? 'bronze'}` as 'medal.gold') }) : t('modes.weekly.desc'),
          '',
          weeklyDone ? button('✓', () => undefined, 'btn') : button(t('common.play'), () => launch(`${t('modes.weekly')} · ${wk}`, () => weeklyMode(wk, p.bossesDefeated, { ...input(), tables: unlocked })), 'btn btn-accent'),
        ),
      ),
    ),
  );
  const btns = el.querySelectorAll('.mode-card .btn');
  if (dailyDone) (btns[5] as HTMLButtonElement | undefined)?.setAttribute('disabled', 'true');
  if (weeklyDone) (btns[6] as HTMLButtonElement | undefined)?.setAttribute('disabled', 'true');
  return { el };
}
