import { audio } from '../../audio/AudioManager';
import { TAU } from '../../core/math';
import { Rng } from '../../core/rng';
import { t } from '../../i18n';
import { CATEGORIES, type CannonSkin, type CosmeticCategory, type CosmeticItem, type ExplosionSkin, type NebulaSkin, type PlanetSkin, type ProjectileSkin, type ReticleSkin, type TrailSkin, ALL_COSMETICS } from '../../progression/cosmetics';
import { buyCosmetic, cosmeticStatus, masteredTables } from '../../progression/unlocks';
import { drawBarrel } from '../../render/Renderer';
import { ParticleSystem } from '../../render/particles';
import { hexToRgba } from '../../render/background';
import { button, clear, h, toast } from '../../ui/dom';
import type { App, ScreenResult } from '../App';

export function renderHangar(app: App): ScreenResult {
  const p = app.p;
  let cat: CosmeticCategory = 'cannon';
  const dust = h('span', { class: 'tag tag-gold' }, `✦ ${p.stardust}`);
  const tabs = h('div', { class: 'tabs' });
  const grid = h('div', { class: 'grid' });
  const animations: (() => void)[] = [];
  let raf = 0;

  const renderTabs = () => {
    clear(tabs);
    for (const c of CATEGORIES) tabs.appendChild(h('button', { class: c === cat ? 'sel' : '', onClick: () => { cat = c; renderTabs(); renderGrid(); audio.click(); } }, t(`cat.${c}` as 'cat.cannon')));
  };

  const condText = (item: CosmeticItem): string => {
    const r = item.unlock;
    switch (r.type) {
      case 'level':
        return t('hangar.locked.level', { n: r.level });
      case 'achievement':
        return t('hangar.locked.achievement', { name: t(`ach.${r.id}` as 'ach.first_blood') });
      case 'table':
        return t('hangar.locked.table', { n: r.table });
      case 'boss':
        return t('hangar.locked.boss', { name: t(`boss.${r.kind}` as 'boss.titan') });
      case 'sector':
        return t('hangar.locked.sector', { n: r.sector + 1 });
      default:
        return '';
    }
  };

  const renderGrid = () => {
    clear(grid);
    animations.length = 0;
    const mastered = masteredTables(p);
    for (const item of ALL_COSMETICS.filter((c) => c.category === cat)) {
      const st = cosmeticStatus(p, item, mastered);
      const equipped = p.equipped[cat] === item.id;
      const cv = h('canvas', { width: 320, height: 200 }) as HTMLCanvasElement;
      animations.push(makePreview(cv, item));
      let action: HTMLElement;
      if (equipped) action = h('span', { class: 'tag' }, t('hangar.equipped'));
      else if (st.owned) action = button(t('hangar.equip'), () => { p.equipped[cat] = item.id; app.persist(); audio.click(); renderGrid(); }, 'btn btn-primary');
      else if (item.unlock.type === 'buy') {
        const price = item.unlock.price;
        action = button(t('hangar.buy', { price }), () => {
          if (buyCosmetic(p, item)) {
            p.equipped[cat] = item.id;
            app.persist(true);
            audio.unlockJingle();
            dust.textContent = `✦ ${p.stardust}`;
            toast(t('hangar.bought'), 'gold');
            renderGrid();
          } else toast(t('hangar.notEnough'));
        }, `btn ${st.available ? 'btn-accent' : ''}`);
      } else action = h('span', { class: 'tag' }, `🔒 ${t('common.locked')}`);
      let effect = '';
      if (item.category === 'cannon') effect = t(`perk.${(item.data as CannonSkin).perk}` as 'perk.none');
      if (item.category === 'projectile') effect = t(`proj.${(item.data as ProjectileSkin).kind}` as 'proj.bolt');
      grid.appendChild(
        h(
          'div',
          { class: `item-card ${equipped ? 'equipped' : ''} ${st.owned ? '' : 'locked'}` },
          cv,
          h('div', { class: 'name' }, t(item.nameKey as 'cos.cannon_classic')),
          effect ? h('div', { class: 'small', style: 'color:var(--cyan)' }, effect) : '',
          h('div', { class: 'cond' }, st.owned ? '' : condText(item)),
          action,
        ),
      );
    }
  };

  renderTabs();
  renderGrid();
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const a of animations) a();
    void dt;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const el = h(
    'div',
    { class: 'screen' },
    h('div', { class: 'screen-inner' }, h('div', { class: 'topbar' }, button(`← ${t('common.back')}`, () => app.go('menu', undefined), 'btn btn-ghost'), h('h2', null, t('hangar.title')), dust), tabs, grid),
  );
  return { el, destroy: () => cancelAnimationFrame(raf) };
}

/** Prévisualisation animée d'un cosmétique dans un petit canvas. Renvoie la fonction de frame. */
function makePreview(cv: HTMLCanvasElement, item: CosmeticItem): () => void {
  const c = cv.getContext('2d')!;
  const w = cv.width;
  const hgt = cv.height;
  let tt = 0;
  const rng = new Rng(7);
  const particles = new ParticleSystem(rng);
  let nextBurst = 0;
  return () => {
    tt += 1 / 60;
    c.fillStyle = '#05081a';
    c.fillRect(0, 0, w, hgt);
    switch (item.category) {
      case 'cannon': {
        const skin = item.data as CannonSkin;
        const g = c.createRadialGradient(w / 2, hgt * 0.7, 10, w / 2, hgt * 0.7, 90);
        g.addColorStop(0, hexToRgba(skin.glow, 0.5));
        g.addColorStop(1, hexToRgba(skin.glow, 0));
        c.fillStyle = g;
        c.fillRect(0, 0, w, hgt);
        c.fillStyle = '#1b2250';
        c.beginPath();
        c.arc(w / 2, hgt * 0.75, 44, Math.PI, 0);
        c.fill();
        c.fillStyle = skin.base;
        c.beginPath();
        c.arc(w / 2, hgt * 0.73, 32, Math.PI, 0);
        c.fill();
        c.save();
        c.translate(w / 2, hgt * 0.68);
        c.rotate(-Math.PI / 2 + Math.sin(tt * 1.3) * 0.6);
        c.scale(1.4, 1.4);
        drawBarrel(c, skin);
        c.restore();
        break;
      }
      case 'projectile': {
        const skin = item.data as ProjectileSkin;
        const x0 = 30;
        const y0 = hgt - 24;
        const x1 = w - 60;
        const y1 = 40;
        const prog = (tt * 0.6) % 1.3;
        const pr = Math.min(1, prog);
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = hexToRgba(skin.color, 0.9);
        c.lineWidth = 4;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x0, y0);
        const steps = 30;
        let hx = x0;
        let hy = y0;
        for (let i = 1; i <= steps * pr; i++) {
          const u = i / steps;
          let px = x0 + (x1 - x0) * u;
          let py = y0 + (y1 - y0) * u;
          if (skin.kind === 'missile') {
            const lat = Math.sin(u * 14) * 26 * (1 - u);
            px += -(y1 - y0) / 300 * lat;
            py += (x1 - x0) / 300 * lat;
          }
          if (skin.kind === 'lightning') {
            px += Math.sin(i * 7.3) * 9;
            py += Math.cos(i * 5.1) * 9;
          }
          if (skin.kind === 'twin') {
            px += 5;
            py += 5;
          }
          c.lineTo(px, py);
          hx = px;
          hy = py;
        }
        c.stroke();
        if (skin.kind === 'twin') {
          c.beginPath();
          c.moveTo(x0 - 10, y0 - 10);
          c.lineTo(hx - 10, hy - 10);
          c.stroke();
        }
        // Cible
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#4a4660';
        c.beginPath();
        c.arc(x1, y1, 22, 0, TAU);
        c.fill();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(hx, hy, 5, 0, TAU);
        c.fill();
        if (prog > 1) {
          const k = (prog - 1) / 0.3;
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = hexToRgba(skin.color2, 1 - k);
          c.lineWidth = 3;
          c.beginPath();
          c.arc(x1, y1, 22 + k * (skin.kind === 'bolt' || skin.kind === 'twin' ? 20 : 60), 0, TAU);
          c.stroke();
          c.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'trail': {
        const skin = item.data as TrailSkin;
        const x0 = 40;
        const y0 = hgt - 30;
        const prog = (tt * 0.5) % 1;
        const x1 = x0 + (w - 80) * prog;
        const y1 = y0 - (hgt - 60) * prog;
        const grad = c.createLinearGradient(x0, y0, x1, y1);
        if (skin.style === 'rainbow') {
          grad.addColorStop(0, 'rgba(255,93,115,0)');
          grad.addColorStop(0.5, '#ffd166');
          grad.addColorStop(1, '#38e8ff');
        } else {
          grad.addColorStop(0, hexToRgba(skin.color, 0));
          grad.addColorStop(1, skin.color2);
        }
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = grad;
        c.lineWidth = skin.style === 'plasma' || skin.style === 'fire' ? 12 : 7;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(x1, y1, 6, 0, TAU);
        c.fill();
        if (skin.style === 'sparks' || skin.style === 'fire' || skin.style === 'star') {
          c.fillStyle = skin.color;
          for (let i = 0; i < 4; i++) {
            c.beginPath();
            c.arc(x1 - i * 14 + Math.sin(tt * 30 + i) * 5, y1 + i * 10 + Math.cos(tt * 25 + i) * 5, 3, 0, TAU);
            c.fill();
          }
        }
        c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'explosion': {
        const skin = item.data as ExplosionSkin;
        nextBurst -= 1 / 60;
        if (nextBurst <= 0) {
          particles.burst(w / 2, hgt / 2, skin.palette, skin.style, 40, 0.8);
          nextBurst = 1.6;
        }
        particles.update(1 / 60);
        particles.draw(c);
        break;
      }
      case 'planet': {
        const skin = item.data as PlanetSkin;
        const cx = w / 2;
        const cy = hgt / 2 + 10;
        const r = 62;
        const atmo = c.createRadialGradient(cx, cy, r, cx, cy, r + 22);
        atmo.addColorStop(0, hexToRgba(skin.atmosphere, 0.5));
        atmo.addColorStop(1, hexToRgba(skin.atmosphere, 0));
        c.fillStyle = atmo;
        c.fillRect(0, 0, w, hgt);
        if (skin.rings) {
          c.strokeStyle = hexToRgba(skin.atmosphere, 0.7);
          c.lineWidth = 5;
          c.beginPath();
          c.ellipse(cx, cy, r + 34, 14, -0.3, Math.PI * 0.95, Math.PI * 2.05);
          c.stroke();
        }
        const g = c.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 6, cx, cy, r);
        g.addColorStop(0, skin.atmosphere);
        g.addColorStop(0.3, skin.ocean);
        g.addColorStop(1, '#05081a');
        c.fillStyle = g;
        c.beginPath();
        c.arc(cx, cy, r, 0, TAU);
        c.fill();
        c.save();
        c.beginPath();
        c.arc(cx, cy, r, 0, TAU);
        c.clip();
        c.fillStyle = skin.land;
        const lr = new Rng(3);
        for (let i = 0; i < 6; i++) {
          const bx = cx - r + ((lr.range(0, 2 * r) + tt * 12) % (2 * r + 60)) - 30;
          const by = cy + lr.range(-r * 0.7, r * 0.7);
          c.beginPath();
          c.ellipse(bx, by, lr.range(14, 30), lr.range(8, 16), lr.range(0, 1), 0, TAU);
          c.fill();
        }
        c.restore();
        if (skin.rings) {
          c.strokeStyle = hexToRgba(skin.atmosphere, 0.9);
          c.lineWidth = 5;
          c.beginPath();
          c.ellipse(cx, cy, r + 34, 14, -0.3, Math.PI * -0.05, Math.PI * 0.95);
          c.stroke();
        }
        break;
      }
      case 'nebula': {
        const skin = item.data as NebulaSkin;
        skin.palette.forEach((col, i) => {
          const x = w * (0.2 + 0.3 * i) + Math.sin(tt + i) * 10;
          const y = hgt * (0.3 + 0.2 * (i % 2));
          const g = c.createRadialGradient(x, y, 0, x, y, 110);
          g.addColorStop(0, hexToRgba(col, 0.7));
          g.addColorStop(1, hexToRgba(col, 0));
          c.fillStyle = g;
          c.fillRect(0, 0, w, hgt);
        });
        c.fillStyle = skin.stars;
        const sr = new Rng(11);
        for (let i = 0; i < 50; i++) {
          c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(tt * 2 + i));
          c.fillRect(sr.range(0, w), sr.range(0, hgt), 2, 2);
        }
        c.globalAlpha = 1;
        break;
      }
      case 'reticle': {
        const skin = item.data as ReticleSkin;
        const cx = w / 2;
        const cy = hgt / 2;
        const r = 50;
        c.fillStyle = '#4a4660';
        c.beginPath();
        c.arc(cx, cy, 34, 0, TAU);
        c.fill();
        c.save();
        c.translate(cx, cy);
        c.strokeStyle = skin.color;
        c.lineWidth = 3;
        switch (skin.style) {
          case 'brackets': {
            const l = r * 0.4;
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
              c.beginPath();
              c.moveTo(sx * r, sy * (r - l));
              c.lineTo(sx * r, sy * r);
              c.lineTo(sx * (r - l), sy * r);
              c.stroke();
            }
            break;
          }
          case 'diamond':
            c.rotate(tt * 1.2);
            c.beginPath();
            c.moveTo(0, -r);
            c.lineTo(r, 0);
            c.lineTo(0, r);
            c.lineTo(-r, 0);
            c.closePath();
            c.stroke();
            break;
          case 'crosshair':
            c.beginPath();
            c.arc(0, 0, r, 0, TAU);
            c.stroke();
            for (let i = 0; i < 4; i++) {
              c.rotate(Math.PI / 2);
              c.beginPath();
              c.moveTo(r - 8, 0);
              c.lineTo(r + 8, 0);
              c.stroke();
            }
            break;
          default:
            c.rotate(tt * 0.8);
            c.setLineDash([r * 0.5, r * 0.3]);
            c.beginPath();
            c.arc(0, 0, r, 0, TAU);
            c.stroke();
        }
        c.restore();
        break;
      }
    }
  };
}
