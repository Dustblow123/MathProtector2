import { audio } from '../../audio/AudioManager';
import { SECTOR_BOSS, blitzMode, bossRushMode, dailyMode, dateKey, practiceMode, sectorTable, survivalMode } from '../../game/modes/index';
import type { BossKind, ModeConfig } from '../../game/types';
import { t } from '../../i18n';
import { tableOrder } from '../../learning/curriculum';
import { button, clear, h, toast } from '../../ui/dom';
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
  const input = () => ({ maxTable: p.maxTable, fluentMs: app.fluentMs(), tables: tables() });
  const launch = (title: string, build: () => ModeConfig) => {
    if (tables().length === 0) {
      toast(t('modes.needTable'));
      return;
    }
    audio.click();
    app.go('game', { mode: build(), title, rebuild: build });
  };

  const card = (icon: string, title: string, desc: string, best: string, action: HTMLElement) =>
    h('div', { class: 'mode-card' }, h('div', { class: 'title' }, h('span', null, icon), title), h('div', { class: 'desc' }, desc), best ? h('div', { class: 'small', style: 'color:var(--gold)' }, best) : '', action);

  const defeated = p.bossesDefeated;
  const rushBosses: BossKind[] = (['titan', 'hydra', 'mirror', 'chrono', 'mothership'] as BossKind[]).filter((b) => defeated.includes(b));
  const rushTables = rushBosses.map((b) => sectorTable(Math.max(0, SECTOR_BOSS.indexOf(b)), p.maxTable));
  const dailyKey = dateKey();
  const dailyDone = p.daily?.lastDay === dailyKey;

  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('modes.title'))),
      h('div', { class: 'panel' }, h('h3', null, t('modes.chooseTables')), h('div', { style: 'margin-top:10px' }, chips)),
      h(
        'div',
        { class: 'grid' },
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
      ),
    ),
  );
  if (dailyDone) (el.querySelectorAll('.mode-card .btn')[4] as HTMLButtonElement | undefined)?.setAttribute('disabled', 'true');
  return { el };
}
