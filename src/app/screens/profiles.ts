import { audio } from '../../audio/AudioManager';
import { AVATARS, createProfile, type AgePreset } from '../../data/profile';
import { importProfile } from '../../data/storage';
import { levelFromXp } from '../../game/scoring';
import { t } from '../../i18n';
import { button, clear, h, modal, toast } from '../../ui/dom';
import type { App, ScreenResult } from '../App';

export function renderProfiles(app: App): ScreenResult {
  const list = h('div', { class: 'profile-list' });
  const inner = h('div', { class: 'screen-inner' });
  const el = h('div', { class: 'screen' }, inner);

  const refresh = () => {
    clear(list);
    for (const p of app.save.profiles) {
      const lvl = levelFromXp(p.xp).level;
      const card = h(
        'button',
        {
          class: 'profile-card',
          onClick: () => {
            audio.click();
            app.setProfile(p);
            app.go('menu', undefined);
          },
        },
        h('span', { class: 'avatar' }, p.avatar),
        h('span', { class: 'name' }, p.name),
        h('span', { class: 'tag' }, t('common.levelShort', { n: lvl })),
      );
      const del = h('button', { class: 'del', title: t('common.delete'), onClick: (e: Event) => { e.stopPropagation(); confirmDelete(p.id, p.name); } }, '✕');
      card.appendChild(del);
      list.appendChild(card);
    }
    const add = h('button', { class: 'profile-card', onClick: () => showCreate() }, h('span', { class: 'avatar' }, '＋'), h('span', { class: 'name' }, t('profiles.new')));
    list.appendChild(add);
  };

  const confirmDelete = (id: string, name: string) => {
    modal(h('p', null, t('profiles.deleteConfirm', { name })), [
      { label: t('common.cancel'), onClick: () => undefined, cls: 'btn btn-ghost' },
      {
        label: t('common.delete'),
        cls: 'btn btn-danger',
        onClick: () => {
          app.save.profiles = app.save.profiles.filter((p) => p.id !== id);
          if (app.save.activeProfileId === id) app.save.activeProfileId = null;
          app.persist(true);
          refresh();
        },
      },
    ]);
  };

  const showCreate = () => {
    let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? '🚀';
    let age: AgePreset = 'mid';
    const nameInput = h('input', { type: 'text', maxLength: 16, placeholder: t('profiles.namePlaceholder'), autocomplete: 'off' }) as HTMLInputElement;
    const picker = h('div', { class: 'avatar-picker' });
    const renderPicker = () => {
      clear(picker);
      for (const a of AVATARS) picker.appendChild(h('button', { type: 'button', class: a === avatar ? 'sel' : '', onClick: () => { avatar = a; renderPicker(); } }, a));
    };
    renderPicker();
    const seg = h('div', { class: 'seg' });
    const renderSeg = () => {
      clear(seg);
      for (const a of ['young', 'mid', 'older'] as AgePreset[]) seg.appendChild(h('button', { type: 'button', class: a === age ? 'sel' : '', onClick: () => { age = a; renderSeg(); } }, t(`profiles.age.${a}`)));
    };
    renderSeg();
    const form = h(
      'div',
      { style: 'display:flex;flex-direction:column;gap:14px;text-align:left' },
      h('h2', null, t('profiles.new')),
      h('div', { class: 'field' }, h('label', null, t('profiles.name')), nameInput),
      h('div', { class: 'field' }, h('label', null, t('profiles.avatar')), picker),
      h('div', { class: 'field' }, h('label', null, t('profiles.age')), seg),
    );
    const m = modal(form, [
      { label: t('common.cancel'), onClick: () => undefined, cls: 'btn btn-ghost' },
      {
        label: t('profiles.create'),
        cls: 'btn btn-primary',
        onClick: () => {
          const name = nameInput.value.trim() || t('profiles.namePlaceholder');
          const p = createProfile(name, avatar, age);
          app.save.profiles.push(p);
          app.setProfile(p);
          audio.unlockJingle();
          app.go('menu', undefined);
        },
      },
    ]);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (m.querySelector('.btn-primary') as HTMLButtonElement | null)?.click();
    });
    setTimeout(() => nameInput.focus(), 50);
  };

  const importBtn = button(t('profiles.import'), () => {
    const input = h('input', { type: 'file', accept: 'application/json,.json' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const p = importProfile(await f.text());
        app.save.profiles.push(p);
        app.persist(true);
        refresh();
        toast(`${p.avatar} ${p.name}`, 'gold');
      } catch {
        toast(t('profiles.importError'));
      }
    });
    input.click();
  }, 'btn btn-ghost');

  inner.append(
    h('div', { class: 'menu-hero' }, h('h1', null, t('app.title')), h('p', null, t('app.tagline'))),
    h('h2', null, t('profiles.title')),
    app.save.profiles.length === 0 ? h('p', { class: 'muted' }, t('profiles.empty')) : '',
    list,
    h('div', { class: 'row' }, importBtn),
  );
  refresh();
  return { el };
}
