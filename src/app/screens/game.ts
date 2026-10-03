import { audio } from '../../audio/AudioManager';
import { GameCanvas } from '../../core/canvas';
import { Input } from '../../core/input';
import { GameLoop } from '../../core/loop';
import { dist } from '../../core/math';
import { factsMap } from '../../data/profile';
import { Game } from '../../game/Game';
import { INVENTORY_SIZE, POWERUPS } from '../../game/powerups';
import type { SessionResult } from '../../game/types';
import { t } from '../../i18n';
import { applySession } from '../../progression/apply';
import { Renderer } from '../../render/Renderer';
import { button, clear, h, modal } from '../../ui/dom';
import type { App, GameLaunch, ScreenResult } from '../App';

export function renderGame(app: App, launch: GameLaunch): ScreenResult {
  const profile = app.p;
  const settings = app.settings;
  const root = h('div', { class: 'game-root' });
  const canvas = new GameCanvas(root);
  const game = new Game(launch.mode, factsMap(profile));
  game.autoFire = settings.autoFire;
  (window as unknown as { mp2game: Game }).mp2game = game;
  const confusions: Record<string, number> = {};

  // ---------------------------------------------------------------- HUD
  const scoreEl = h('div', { class: 'hud-score' }, '0');
  const comboEl = h('div', { class: 'hud-combo' }, '');
  const waveLabel = h('div', { class: 'hud-label' }, '');
  const waveBar = h('i', { style: 'width:0%' });
  const heartsEl = h('div', { class: 'hearts' });
  const dustEl = h('div', { class: 'hud-stardust' }, '✦ 0');
  const timeEl = h('div', { class: 'hud-time' }, '');
  const bossName = h('div', { class: 'name' }, '');
  const bossBarFill = h('i', { style: 'width:100%' });
  const bossBar = h('div', { class: 'boss-bar', style: 'display:none' }, bossName, h('div', { class: 'progress' }, bossBarFill));
  const slotsEl = h('div', { class: 'powerups' });
  const effectsEl = h('div', { class: 'effects' });
  const pauseBtn = h('button', { class: 'btn btn-icon pause-btn', title: t('hud.pause'), onClick: () => togglePause() }, '⏸');

  const hud = h(
    'div',
    { class: 'hud' },
    h(
      'div',
      { class: 'hud-top' },
      h('div', { class: 'hud-box' }, h('div', { class: 'hud-label' }, t('hud.score')), scoreEl, comboEl),
      h('div', { class: 'hud-box hud-wave' }, waveLabel, h('div', { class: 'progress' }, waveBar)),
      h('div', { class: 'hud-right' }, h('div', { class: 'row' }, h('div', { class: 'hud-box' }, heartsEl), pauseBtn), h('div', { class: 'hud-box' }, dustEl), launch.mode.timeLimitMs > 0 ? h('div', { class: 'hud-box' }, timeEl) : ''),
    ),
    h('div', { class: 'hud-bottom' }, h('div', null, slotsEl, effectsEl), buildNumpad()),
    bossBar,
  );
  root.appendChild(hud);

  function buildNumpad(): HTMLElement {
    const pad = h('div', { class: `numpad ${app.usesTouch() ? '' : 'hidden'}` });
    const key = (label: string, onPress: () => void, cls = '') =>
      h('button', { class: cls, type: 'button', onPointerdown: (e: Event) => { e.preventDefault(); onPress(); } }, label);
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9]) pad.appendChild(key(String(d), () => digit(d)));
    pad.appendChild(key(t('numpad.del'), () => game.backspace()));
    pad.appendChild(key('0', () => digit(0)));
    pad.appendChild(key(t('numpad.fire'), () => confirm(), 'fire'));
    return pad;
  }

  const renderSlots = () => {
    clear(slotsEl);
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const type = game.inventory[i];
      const def = type ? POWERUPS[type] : null;
      const slot = h(
        'button',
        {
          class: `pslot ${def ? 'filled' : ''}`,
          style: def ? `color:${def.color};border-color:${def.color}` : '',
          title: def ? `${t(`powerup.${def.type}`)} — ${t(`powerup.${def.type}.desc`)}` : '',
          onPointerdown: (e: Event) => { e.preventDefault(); if (def) game.usePowerup(i); },
        },
        def ? def.icon : '',
        h('span', { class: 'key' }, `F${i + 1}`),
      );
      slotsEl.appendChild(slot);
    }
  };
  renderSlots();

  const renderHearts = () => {
    clear(heartsEl);
    if (game.earth.invulnerable) {
      heartsEl.appendChild(h('span', { class: 'heart shield' }, '∞'));
      return;
    }
    for (let i = 0; i < game.earth.maxHp; i++) heartsEl.appendChild(h('span', { class: `heart ${i < game.earth.hp ? '' : 'lost'}` }, '🛡️'));
    if (game.earth.shield) heartsEl.appendChild(h('span', { class: 'heart shield' }, '🟢'));
  };
  renderHearts();

  let lastCombo = -1;
  let lastHp = -1;
  let lastShield = false;
  let lastInv = '';
  const updateHud = () => {
    scoreEl.textContent = game.score.toLocaleString();
    if (game.combo !== lastCombo) {
      lastCombo = game.combo;
      comboEl.textContent = game.combo >= 2 ? `${t('hud.combo')} ×${game.combo}` : '';
      comboEl.classList.add('pop');
      setTimeout(() => comboEl.classList.remove('pop'), 150);
    }
    if (game.earth.hp !== lastHp || game.earth.shield !== lastShield) {
      lastHp = game.earth.hp;
      lastShield = game.earth.shield;
      renderHearts();
    }
    const inv = game.inventory.join(',');
    if (inv !== lastInv) {
      lastInv = inv;
      renderSlots();
    }
    dustEl.textContent = `✦ ${game.stardust}`;
    if (game.phase === 'boss' && game.boss) {
      bossBar.style.display = '';
      bossName.textContent = `${t(`boss.${game.boss.kind}`)} · ${t('hud.phase', { n: game.boss.phase, total: game.boss.phases })}`;
      bossBarFill.style.width = `${Math.round(game.boss.hp * 100)}%`;
      waveLabel.textContent = t('hud.boss');
      waveBar.style.width = `${Math.round((1 - game.boss.hp) * 100)}%`;
    } else {
      bossBar.style.display = 'none';
      const total = launch.mode.wavesTotal;
      waveLabel.textContent = total && total > 0 ? t('hud.waveOf', { n: Math.min(game.wave, total), total }) : t('hud.wave', { n: game.wave });
      waveBar.style.width = `${Math.round(game.waveProgress * 100)}%`;
    }
    if (launch.mode.timeLimitMs > 0) {
      const s = Math.ceil(game.timeLeft / 1000);
      timeEl.textContent = `⏱ ${s}`;
      timeEl.classList.toggle('low', s <= 10);
    }
    clear(effectsEl);
    if (game.doubleActive) effectsEl.appendChild(h('span', { class: 'effect-pill', style: `background:${POWERUPS.double.color}` }, t('game.double')));
    if (game.oracleActive) effectsEl.appendChild(h('span', { class: 'effect-pill', style: `background:${POWERUPS.oracle.color}` }, t('game.oracle')));
  };

  // ---------------------------------------------------------------- rendu & boucle
  const renderer = new Renderer(canvas, game, app.skins(), {
    reducedMotion: settings.reducedMotion,
    stardustTarget: () => {
      const r = dustEl.getBoundingClientRect();
      return canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    },
  });

  const loop = new GameLoop(
    (dt) => game.update(dt),
    (_alpha, dt) => {
      loop.timeScale = renderer.update(dt);
      renderer.draw();
      updateHud();
    },
  );

  // ---------------------------------------------------------------- audio
  const ev = game.events;
  ev.on('shot', ({ target }) => (target ? audio.laser() : audio.fizzle()));
  ev.on('destroyed', ({ target, byPowerup }) => audio.explosion(byPowerup ? 0.5 : Math.min(1.6, target.radius / 40)));
  ev.on('earthHit', () => audio.impact());
  ev.on('shieldAbsorb', () => audio.shield());
  ev.on('miss', ({ target, report }) => {
    audio.miss();
    if (target && report?.analysis && report.analysis.kind !== 'unknown') {
      const key = `${target.fact.id}>${report.analysis.kind}`;
      confusions[key] = (confusions[key] ?? 0) + 1;
    }
  });
  ev.on('combo', ({ combo, milestone }) => {
    if (milestone) audio.powerupGain();
    else if (combo > 1) audio.combo(combo);
  });
  ev.on('powerupGained', () => audio.powerupGain());
  ev.on('powerupUsed', ({ type }) => (type === 'freeze' ? audio.freeze() : audio.powerupUse()));
  ev.on('bossStart', () => {
    audio.bossRoar();
    audio.intensity = Math.min(1, game.flow.intensity + 0.35);
  });
  ev.on('bossHit', () => audio.bossHit());
  ev.on('bossPhase', () => audio.bossRoar());
  ev.on('bossDefeated', () => audio.bossDefeated());
  ev.on('waveEnd', () => {
    audio.waveClear();
    audio.intensity = game.flow.intensity;
  });
  ev.on('waveStart', () => (audio.intensity = game.flow.intensity));
  ev.on('victory', (r) => {
    audio.victory();
    finish(r);
  });
  ev.on('gameOver', (r) => {
    audio.gameOver();
    finish(r);
  });

  // ---------------------------------------------------------------- saisie
  const input = new Input();
  const digit = (d: number) => {
    game.typeDigit(d);
    audio.type();
  };
  const confirm = () => game.fire();
  input.on('digit', digit);
  input.on('backspace', () => game.backspace());
  input.on('confirm', confirm);
  input.on('cancel', () => game.clearBuffer());
  input.on('cycleTarget', () => game.cycleTarget());
  input.on('powerup', (i) => game.usePowerup(i));
  input.on('pause', () => togglePause());
  input.attach();

  canvas.el.addEventListener('pointerdown', (e) => {
    const w = canvas.toWorld(e.clientX, e.clientY);
    let best: { id: number; d: number } | null = null;
    for (const tg of game.targets) {
      const d = dist(w.x, w.y, tg.x, tg.y);
      if (d < tg.radius + 30 && (!best || d < best.d)) best = { id: tg.id, d };
    }
    if (best) game.setFocus(best.id);
  });

  // ---------------------------------------------------------------- pause / fin
  let pauseOverlay: HTMLElement | null = null;
  let ended = false;
  function togglePause(): void {
    if (ended || game.phase === 'intro') return;
    if (game.phase === 'paused') {
      game.resume();
      pauseOverlay?.remove();
      pauseOverlay = null;
      return;
    }
    game.pause();
    pauseOverlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'panel' },
        h('h2', null, t('pause.title')),
        h('p', { class: 'muted small' }, t('pause.tip')),
        button(t('game.resume'), () => togglePause(), 'btn btn-primary btn-big'),
        button(t('game.quit'), () => {
          modal(h('p', null, t('game.quitConfirm')), [
            { label: t('common.cancel'), onClick: () => undefined, cls: 'btn btn-ghost' },
            { label: t('game.quit'), cls: 'btn btn-danger', onClick: () => finish(game.abort(), true) },
          ]);
        }, 'btn btn-ghost'),
      ),
    );
    root.appendChild(pauseOverlay);
  }

  function finish(result: SessionResult, immediate = false): void {
    if (ended) return;
    ended = true;
    input.enabled = false;
    const outcome = applySession(profile, result, game.scheduler.states, confusions);
    app.persist(true);
    const go = () => app.go('results', { launch, result, outcome });
    if (immediate) go();
    else setTimeout(go, 1800);
  }

  const onVisibility = () => {
    if (document.hidden && game.phase !== 'paused' && !ended) togglePause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ---------------------------------------------------------------- démarrage
  const start = () => {
    game.start();
    audio.intensity = game.flow.intensity;
    audio.startMusic();
  };
  loop.start();
  const firstTime = profile.stats.sessions === 0 && launch.mode.id === 'campaign';
  if (firstTime) {
    const tut = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'panel tutorial' },
        h('h2', null, t('tutorial.title')),
        h('ol', null, h('li', null, t('tutorial.1')), h('li', null, t('tutorial.2')), h('li', null, t('tutorial.3')), h('li', null, t('tutorial.4'))),
        button(t('tutorial.go'), () => { tut.remove(); start(); }, 'btn btn-primary btn-big'),
      ),
    );
    root.appendChild(tut);
  } else start();

  return {
    el: root,
    destroy: () => {
      loop.stop();
      input.detach();
      renderer.destroy();
      canvas.destroy();
      audio.stopMusic();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
