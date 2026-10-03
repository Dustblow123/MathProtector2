import { audio } from '../../audio/AudioManager';
import { LANGS, getLang, t, type Lang } from '../../i18n';
import { button, clear, h } from '../../ui/dom';
import type { App, ScreenResult } from '../App';

export function renderSettings(app: App): ScreenResult {
  const s = app.settings;
  const update = () => {
    app.applySettings();
    app.persist();
  };
  const toggle = (label: string, desc: string, get: () => boolean, set: (v: boolean) => void) => {
    const sw = h('button', { class: `switch ${get() ? 'on' : ''}`, type: 'button', onClick: () => { set(!get()); sw.classList.toggle('on', get()); update(); audio.click(); } });
    return h('div', { class: 'toggle' }, h('div', null, h('b', null, label), desc ? h('div', { class: 'desc' }, desc) : ''), sw);
  };
  const slider = (label: string, get: () => number, set: (v: number) => void, onInput?: () => void) => {
    const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: get() }) as HTMLInputElement;
    input.addEventListener('input', () => { set(Number(input.value)); update(); });
    input.addEventListener('change', () => onInput?.());
    return h('div', { class: 'toggle' }, h('b', null, label), input);
  };
  const seg = <T extends string>(label: string, options: { value: T; label: string }[], get: () => T, set: (v: T) => void) => {
    const box = h('div', { class: 'seg' });
    const render = () => {
      clear(box);
      for (const o of options) box.appendChild(h('button', { type: 'button', class: o.value === get() ? 'sel' : '', onClick: () => { set(o.value); render(); update(); } }, o.label));
    };
    render();
    return h('div', { class: 'toggle' }, h('b', null, label), box);
  };

  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('settings.title'))),
      h(
        'div',
        { class: 'panel' },
        seg<Lang>(t('settings.lang'), LANGS.map((l) => ({ value: l, label: l === 'fr' ? 'Français' : 'English' })), () => getLang(), (l) => app.setLang(l)),
        slider(t('settings.sfx'), () => s.sfxVolume, (v) => (s.sfxVolume = v), () => audio.laser()),
        slider(t('settings.music'), () => s.musicVolume, (v) => (s.musicVolume = v)),
        toggle(t('settings.autoFire'), t('settings.autoFire.desc'), () => s.autoFire, (v) => (s.autoFire = v)),
        seg(t('settings.numpad'), [{ value: 'auto', label: t('settings.numpad.auto') }, { value: 'on', label: t('settings.numpad.on') }, { value: 'off', label: t('settings.numpad.off') }], () => s.numpad, (v) => (s.numpad = v)),
        toggle(t('settings.reducedMotion'), t('settings.reducedMotion.desc'), () => s.reducedMotion, (v) => (s.reducedMotion = v)),
      ),
      h('p', { class: 'muted small' }, t('settings.about')),
    ),
  );
  return { el };
}
