import { audio } from '../../audio/AudioManager';
import { dateKey } from '../../game/modes/index';
import { levelFromXp } from '../../game/scoring';
import { t } from '../../i18n';
import { h } from '../../ui/dom';
import type { App, ScreenResult } from '../App';

export function renderMenu(app: App): ScreenResult {
  const p = app.p;
  const lvl = levelFromXp(p.xp);
  const dailyDone = p.daily?.lastDay === dateKey();

  const card = (icon: string, title: string, desc: string, onClick: () => void, cls = '') =>
    h('button', { class: `menu-card ${cls}`, onClick: () => { audio.click(); onClick(); } }, h('span', { class: 'icon' }, icon), h('span', { class: 'title' }, title), h('span', { class: 'desc' }, desc));

  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h(
        'div',
        { class: 'topbar' },
        h(
          'div',
          { class: 'profile-chip' },
          h('span', { class: 'avatar' }, p.avatar),
          h('div', null, h('b', null, p.name), h('span', { class: 'small muted' }, `${t('common.level', { n: lvl.level })} · ✦ ${t('menu.stardust', { n: p.stardust })}`)),
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn btn-ghost', onClick: () => app.go('profiles', undefined) }, `👥 ${t('menu.switchProfile')}`),
      ),
      h('div', { class: 'menu-hero' }, h('h1', null, t('app.title')), h('p', null, t('app.tagline'))),
      h('div', { class: 'progress', title: `${lvl.current}/${lvl.next} XP` }, h('i', { style: `width:${Math.round((lvl.current / lvl.next) * 100)}%` })),
      h(
        'div',
        { class: 'menu-grid' },
        card('🚀', t('menu.campaign'), t('menu.campaign.desc'), () => app.go('campaign', undefined), 'big'),
        card('🎮', t('menu.modes'), dailyDone ? t('menu.dailyDone', { medal: t(`medal.${p.daily?.medal ?? 'bronze'}` as 'medal.gold') }) : `${t('menu.modes.desc')} · ${t('menu.dailyReady')}`, () => app.go('modes', undefined), 'accent'),
        card('🛠️', t('menu.hangar'), t('menu.hangar.desc'), () => app.go('hangar', undefined)),
        card('🏅', t('menu.achievements'), t('achievements.progress', { n: p.achievements.length, total: 25 }), () => app.go('achievements', undefined)),
        card('📊', t('menu.dashboard'), t('dash.subtitle', { name: p.name }), () => app.go('dashboard', undefined)),
        card('⚙️', t('menu.settings'), '', () => app.go('settings', undefined)),
      ),
    ),
  );
  return { el };
}
