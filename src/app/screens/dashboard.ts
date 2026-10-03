import { audio } from '../../audio/AudioManager';
import { formatDuration } from '../../core/math';
import { FLUENT_MS, createProfile, factsMap, type AgePreset } from '../../data/profile';
import { exportProfile, importProfile } from '../../data/storage';
import { t } from '../../i18n';
import { tableOrder, tableStats } from '../../learning/curriculum';
import { makeFact, parseFactId } from '../../learning/facts';
import { masteryLevel } from '../../learning/model';
import type { MasteryLevel } from '../../learning/types';
import { button, clear, h, modal, toast } from '../../ui/dom';
import type { App, ScreenResult } from '../App';

export function renderDashboard(app: App): ScreenResult {
  const p = app.p;
  const facts = factsMap(p);
  const fluent = app.fluentMs();
  const n = p.maxTable;

  // --- Heatmap
  const heat = h('div', { class: 'heatmap', style: `--n:${n}` });
  heat.appendChild(h('div', { class: 'hd' }, '×'));
  for (let b = 1; b <= n; b++) heat.appendChild(h('div', { class: 'hd' }, String(b)));
  const levelName = (m: MasteryLevel) => t(`dash.legend.${m}` as 'dash.legend.0');
  for (let a = 1; a <= n; a++) {
    heat.appendChild(h('div', { class: 'hd' }, String(a)));
    for (let b = 1; b <= n; b++) {
      const f = makeFact(a, b);
      const s = facts.get(f.id);
      const m: MasteryLevel = s ? masteryLevel(s, fluent) : 0;
      const acc = s && s.reps > 0 ? Math.round(((s.reps - s.lapses) / s.reps) * 100) : 0;
      const title = s ? t('dash.factDetail', { fact: `${a} × ${b}`, p: f.product, level: levelName(m), acc, rt: s.rtEma ? `${(s.rtEma / 1000).toFixed(1)} s` : '—' }) : `${a} × ${b} = ${f.product}`;
      heat.appendChild(h('div', { class: `cell m${m}`, title }, String(f.product)));
    }
  }
  const legend = h('div', { class: 'legend' }, [0, 1, 2, 3, 4].map((m) => h('span', null, h('i', { class: `cell m${m}`, style: 'display:inline-block;width:12px;height:12px' }), levelName(m as MasteryLevel))));

  // --- Barres par table
  const bars = h('div', { class: 'table-bars' });
  for (const tb of tableOrder(n)) {
    const st = tableStats(facts, tb, n, fluent);
    const pct = Math.round(st.avgMastery * 25);
    bars.appendChild(h('div', { class: 'table-bar' }, h('b', null, t('dash.tableShort', { n: tb })), h('div', { class: `progress ${pct >= 90 ? 'gold' : ''}` }, h('i', { style: `width:${pct}%` })), h('span', { class: 'small muted' }, `${pct} %`)));
  }

  // --- Stats
  const st = p.stats;
  const answered = st.correct + st.errors;
  const accuracy = answered > 0 ? Math.round((st.correct / answered) * 100) : 0;
  const rts = [...facts.values()].filter((s) => s.rtEma > 0).map((s) => s.rtEma);
  const avgRt = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
  const last7 = st.days.slice(-7);
  const statGrid = h(
    'div',
    { class: 'stat-grid' },
    stat(String(st.sessions), t('dash.sessions')),
    stat(formatDuration(st.timeMs), t('dash.time')),
    stat(String(st.destroyed), t('dash.destroyed')),
    stat(`${accuracy} %`, t('dash.accuracy')),
    stat(avgRt > 0 ? `${(avgRt / 1000).toFixed(1)} s` : '—', t('dash.avgRt')),
    stat(String(st.streakDays), t('dash.streak')),
  );
  const week = h('div', { class: 'row', style: 'gap:6px;align-items:flex-end;height:70px' });
  const maxD = Math.max(1, ...last7.map((d) => d.destroyed));
  for (const d of last7) week.appendChild(h('div', { title: `${d.day} · ${d.destroyed}`, style: `width:28px;height:${Math.max(4, (d.destroyed / maxD) * 60)}px;background:linear-gradient(180deg,var(--cyan),var(--violet));border-radius:4px` }));

  // --- Confusions
  const conf = Object.entries(st.confusions).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const kindLabel: Record<string, string> = { 'neighbor-b': '±1 (b)', 'neighbor-a': '±1 (a)', addition: '+', 'digit-swap': '⇄', 'other-table': '≠', 'off-by-table': '±' };
  const confList = conf.length === 0 ? h('p', { class: 'muted small' }, t('dash.noConfusions')) : h('div', { class: 'fact-chips' }, conf.map(([k, v]) => {
    const [id, kind] = k.split('>');
    const f = parseFactId(id ?? '1x1');
    return h('span', { class: 'fact-chip', title: kind }, t('dash.confusionRow', { fact: `${f.a} × ${f.b}`, answer: kindLabel[kind ?? ''] ?? kind ?? '?', n: v }));
  }));

  // --- Faits fragiles
  const weakest = [...facts.values()].filter((s) => s.reps > 0).sort((a, b) => a.pKnown - b.pKnown).slice(0, 8);
  const weakList = h('div', { class: 'fact-chips' }, weakest.map((s) => { const f = parseFactId(s.id); return h('span', { class: 'fact-chip' }, `${f.a} × ${f.b} = ${f.product}`); }));

  // --- Focus tables
  const focusChips = h('div', { class: 'chips' });
  const renderFocus = () => {
    clear(focusChips);
    for (const tb of tableOrder(n).slice().sort((a, b) => a - b)) {
      const sel = p.focusTables.includes(tb);
      focusChips.appendChild(h('button', { class: `chip ${sel ? 'sel' : ''}`, onClick: () => { p.focusTables = sel ? p.focusTables.filter((x) => x !== tb) : [...p.focusTables, tb]; app.persist(); renderFocus(); } }, String(tb)));
    }
  };
  renderFocus();

  // --- Réglages du profil
  const maxSeg = h('div', { class: 'seg' });
  const renderMax = () => {
    clear(maxSeg);
    for (const v of [10, 12]) maxSeg.appendChild(h('button', { type: 'button', class: p.maxTable === v ? 'sel' : '', onClick: () => { p.maxTable = v; app.persist(true); app.go('dashboard', undefined); } }, String(v)));
  };
  renderMax();
  const ageSeg = h('div', { class: 'seg' });
  const renderAge = () => {
    clear(ageSeg);
    for (const a of ['young', 'mid', 'older'] as AgePreset[]) ageSeg.appendChild(h('button', { type: 'button', class: p.agePreset === a ? 'sel' : '', onClick: () => { p.agePreset = a; app.persist(); renderAge(); } }, t(`profiles.age.${a}`)));
  };
  renderAge();
  const fluentNow = app.fluentMs();
  const fluentLabel = h('span', { class: 'small muted' }, p.autoFluent ? t('dash.fluentAuto', { s: (fluentNow / 1000).toFixed(1) }) : t('dash.fluentFixed', { s: (FLUENT_MS[p.agePreset] / 1000).toFixed(1) }));
  const autoSwitch = h('button', { class: `switch ${p.autoFluent ? 'on' : ''}`, type: 'button', onClick: () => { p.autoFluent = !p.autoFluent; app.persist(); app.go('dashboard', undefined); } });

  const exportBtn = button(`⬇ ${t('dash.export')}`, () => {
    const blob = new Blob([exportProfile(p)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `mathprotector2-${p.name}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const importBtn = button(`⬆ ${t('dash.import')}`, () => {
    const input = h('input', { type: 'file', accept: 'application/json,.json' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const q = importProfile(await f.text());
        app.save.profiles.push(q);
        app.persist(true);
        toast(`${q.avatar} ${q.name}`, 'gold');
      } catch {
        toast(t('profiles.importError'));
      }
    });
    input.click();
  });
  const resetBtn = button(t('dash.reset'), () => {
    modal(h('p', null, t('dash.resetConfirm', { name: p.name })), [
      { label: t('common.cancel'), onClick: () => undefined, cls: 'btn btn-ghost' },
      {
        label: t('dash.reset'),
        cls: 'btn btn-danger',
        onClick: () => {
          const fresh = createProfile(p.name, p.avatar, p.agePreset);
          fresh.id = p.id;
          fresh.maxTable = p.maxTable;
          const idx = app.save.profiles.findIndex((x) => x.id === p.id);
          if (idx >= 0) app.save.profiles[idx] = fresh;
          app.persist(true);
          audio.click();
          app.go('dashboard', undefined);
        },
      },
    ]);
  }, 'btn btn-danger');

  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('dash.title')), h('span', { class: 'muted' }, t('dash.subtitle', { name: `${p.avatar} ${p.name}` }))),
      h(
        'div',
        { class: 'dash-grid' },
        h('div', { class: 'panel' }, h('h3', null, t('dash.heatmap')), h('div', { style: 'margin:10px 0' }, heat), legend),
        h('div', { class: 'panel' }, h('h3', null, t('dash.tables')), h('div', { style: 'margin-top:10px' }, bars)),
        h('div', { class: 'panel' }, h('h3', null, t('dash.stats')), h('div', { style: 'margin-top:10px' }, statGrid), h('h3', { style: 'margin-top:14px' }, t('dash.last7')), week),
        h('div', { class: 'panel' }, h('h3', null, t('dash.confusions')), h('div', { style: 'margin:10px 0 14px' }, confList), h('h3', null, t('dash.weakest')), h('div', { style: 'margin-top:10px' }, weakList)),
        h('div', { class: 'panel' }, h('h3', null, t('dash.focus')), h('p', { class: 'small muted' }, t('dash.focusHint')), focusChips, h('div', { class: 'toggle' }, h('b', null, t('dash.maxTable')), maxSeg), h('div', { class: 'toggle' }, h('b', null, t('dash.age')), ageSeg), h('div', { class: 'toggle' }, h('div', null, h('b', null, t('dash.autoFluent')), h('div', { class: 'desc' }, t('dash.fluent'), ' : ', fluentLabel)), autoSwitch)),
        h('div', { class: 'panel' }, h('div', { class: 'row' }, exportBtn, importBtn), h('div', { style: 'margin-top:14px' }, resetBtn)),
      ),
    ),
  );
  return { el };
}

function stat(value: string, label: string): HTMLElement {
  return h('div', { class: 'stat' }, h('b', null, value), h('span', null, label));
}
