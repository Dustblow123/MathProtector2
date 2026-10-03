import { t } from '../../i18n';
import { ACHIEVEMENTS } from '../../progression/achievements';
import { button, h } from '../../ui/dom';
import type { App, ScreenResult } from '../App';

export function renderAchievements(app: App): ScreenResult {
  const p = app.p;
  const got = new Set(p.achievements);
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(got.has(b.id)) - Number(got.has(a.id)));
  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('achievements.title')), h('span', { class: 'tag tag-gold' }, t('achievements.progress', { n: got.size, total: ACHIEVEMENTS.length }))),
      h(
        'div',
        { class: 'grid' },
        sorted.map((a) =>
          h(
            'div',
            { class: `ach-card ${got.has(a.id) ? '' : 'locked'}` },
            h('span', { class: 'icon' }, a.icon),
            h('div', null, h('b', null, t(`ach.${a.id}` as 'ach.first_blood')), h('span', { class: 'small muted' }, t(`ach.${a.id}.desc` as 'ach.first_blood.desc'))),
            h('span', { class: 'reward-tag' }, `+${a.reward} ✦`),
          ),
        ),
      ),
    ),
  );
  return { el };
}
