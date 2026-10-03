import { WORLD_H, WORLD_W, type GameCanvas } from '../core/canvas';
import { TAU, clamp } from '../core/math';
import { Rng } from '../core/rng';
import { EARTH_Y, type Game } from '../game/Game';
import type { BossBase } from '../game/bosses/BossBase';
import type { Chrono } from '../game/bosses/Chrono';
import type { Mothership } from '../game/bosses/Mothership';
import type { Phantom } from '../game/bosses/Phantom';
import { POWERUPS } from '../game/powerups';
import type { Asteroid, BossTarget, Projectile, Target } from '../game/types';
import { t } from '../i18n';
import type { CannonSkin, EquippedSkins, PlanetSkin, ReticleSkin, TrailSkin } from '../progression/cosmetics';
import { Background, hexToRgba } from './background';
import { ScreenEffects } from './effects';
import { ParticleSystem } from './particles';
import { asteroidSprite, glowSprite } from './sprites';
import { FloatingTexts, outlinedText } from './text';

export interface RendererOptions {
  reducedMotion: boolean;
  colorblind?: boolean;
  largeText?: boolean;
  highContrast?: boolean;
  /** Point (coordonnées monde) vers lequel file la poussière d'étoiles. */
  stardustTarget: () => { x: number; y: number };
}

/** Rendu Canvas complet d'une partie. S'abonne aux événements du jeu pour les effets. */
export class Renderer {
  readonly particles: ParticleSystem;
  readonly texts = new FloatingTexts();
  readonly fx = new ScreenEffects();
  readonly background = new Background();
  private planetStrip: HTMLCanvasElement | null = null;
  private planetKey = '';
  private time = 0;
  private offs: (() => void)[] = [];
  private bossIntro = 0;
  private lightnings: { points: { x: number; y: number }[]; life: number }[] = [];
  private get okColor(): string {
    return this.opts.colorblind ? '#4da3ff' : '#5cf2a6';
  }
  private get koColor(): string {
    return this.opts.colorblind ? '#ff9f43' : '#ff5d73';
  }

  constructor(
    private readonly canvas: GameCanvas,
    private game: Game,
    private skins: EquippedSkins,
    private readonly opts: RendererOptions,
  ) {
    this.particles = new ParticleSystem(new Rng(42));
    this.background.setSkin(skins.nebula);
    this.bind(game);
  }

  setSkins(skins: EquippedSkins): void {
    this.skins = skins;
    this.background.setSkin(skins.nebula);
  }

  attach(game: Game): void {
    this.unbind();
    this.game = game;
    this.particles.clear();
    this.texts.items = [];
    this.bind(game);
  }

  private unbind(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }

  private bind(game: Game): void {
    const ev = game.events;
    const sk = () => this.skins;
    this.offs.push(
      ev.on('destroyed', ({ target, byPowerup, score, fluent }) => {
        const r = target.radius;
        this.particles.burst(target.x, target.y, sk().explosion.palette, sk().explosion.style, r, byPowerup ? 0.6 : 1);
        this.fx.addShake(byPowerup ? 2 : Math.min(8, r * 0.12));
        const f = target.fact;
        const eq = target.type === 'boss' && target.label.includes('?') ? `${f.a} × ${f.b} = ${f.product}` : `${target.label} = ${target.answer}`;
        this.texts.add(`${this.opts.colorblind ? '✓ ' : ''}${eq}`, target.x, target.y - r - 6, byPowerup ? '#ffd166' : fluent ? this.okColor : '#eaf2ff', 24, 1.5);
        if (score > 0 && !byPowerup) this.texts.add(`+${score}`, target.x, target.y + 10, '#ffd166', 20, 1);
      }),
      ev.on('earthHit', ({ target }) => {
        this.particles.burst(target.x, EARTH_Y - 10, ['#ff5d73', '#ff9f43', '#ffffff'], 'burst', 60, 1.4);
        this.fx.addShake(18);
        this.fx.flash('#ff2d55', 0.35);
        this.texts.add(`${this.opts.colorblind ? '✗ ' : ''}${target.label} = ${target.answer}`, target.x, EARTH_Y - 110, this.koColor, 34, 2.2);
      }),
      ev.on('shieldAbsorb', ({ target }) => {
        this.particles.burst(target.x, EARTH_Y - 20, ['#5cf2a6', '#38e8ff', '#ffffff'], 'ring', 60, 1);
        this.fx.flash('#38e8ff', 0.2);
        this.texts.add(t('game.shieldAbsorb'), target.x, EARTH_Y - 110, this.okColor, 28, 1.5);
        this.texts.add(`${target.label} = ${target.answer}`, target.x, EARTH_Y - 80, '#eaf2ff', 22, 2);
      }),
      ev.on('miss', ({ answer, target, report }) => {
        if (!target) return;
        this.fx.addShake(4);
        if (answer >= 0) this.texts.add(t('game.wrongWas', { answer }), target.x, target.y - target.radius - 6, this.koColor, 24, 1.3);
        const a = report?.analysis;
        let extra = '';
        if (a?.kind === 'addition') extra = t('game.addition', { answer, a: target.fact.a, b: target.fact.b });
        else if (a?.kind === 'digit-swap') extra = t('game.digitSwap', { product: target.fact.product });
        else if (a?.confusedWith) extra = t('game.confusedWith', { answer, fact: `${a.confusedWith.a} × ${a.confusedWith.b}` });
        if (extra) this.texts.add(extra, target.x, target.y + target.radius + 22, '#ff9f43', 18, 2.4, false);
      }),
      ev.on('combo', ({ combo, milestone }) => {
        if (milestone) {
          this.texts.add(t('game.comboMilestone', { n: combo }), WORLD_W / 2, 200, '#ff4fd8', 34, 1.8);
          this.fx.flash('#ff4fd8', 0.15);
        } else if (combo > 0 && combo % 5 === 0) {
          this.texts.add(`×${combo}`, WORLD_W / 2, 160, '#38e8ff', 30, 1);
        }
      }),
      ev.on('stardust', ({ amount, x, y }) => {
        const tgt = this.opts.stardustTarget();
        this.particles.motes(x, y, Math.min(12, amount), tgt.x, tgt.y);
      }),
      ev.on('bossStart', () => {
        this.bossIntro = 2.4;
        this.fx.addShake(10);
        this.fx.flash('#8a6cff', 0.25);
      }),
      ev.on('bossPhase', ({ boss }) => {
        this.fx.flash('#ffffff', 0.2);
        this.fx.addShake(8);
        this.particles.burst(boss.x, boss.y, ['#ffffff', '#8a6cff', '#ff4fd8'], 'ring', 120, 1);
      }),
      ev.on('bossDefeated', ({ boss }) => {
        this.fx.triggerSlowMo(1.4);
        this.fx.flash('#ffffff', 0.6);
        this.fx.addShake(24);
        for (let i = 0; i < 5; i++) {
          this.particles.burst(boss.x + (i - 2) * 60, boss.y + ((i * 37) % 80) - 40, ['#ffffff', '#ffd166', '#ff4fd8', '#38e8ff'], 'supernova', 120, 1.3);
        }
        this.texts.add(t('game.bossDefeated'), WORLD_W / 2, 300, '#ffd166', 48, 2.4);
      }),
      ev.on('bossAttack', ({ boss }) => {
        this.particles.burst(boss.x, boss.y + 40, ['#ff5d73', '#ff9f43'], 'burst', 30, 0.5);
      }),
      ev.on('split', ({ parent }) => {
        this.particles.burst(parent.x, parent.y, ['#ffd166', '#b59a7a'], 'ice', parent.radius, 0.7);
      }),
      ev.on('powerupGained', ({ type }) => {
        this.texts.add(`${POWERUPS[type].icon} ${t(`powerup.${type}`)}`, WORLD_W / 2, 240, POWERUPS[type].color, 30, 1.6);
      }),
      ev.on('powerupFull', () => {
        this.texts.add(t('game.inventoryFull'), WORLD_W / 2, 240, '#ffd166', 22, 1.6, false);
      }),
      ev.on('powerupUsed', ({ type }) => {
        const col = POWERUPS[type].color;
        this.fx.flash(col, 0.25);
        if (type === 'nova') {
          this.fx.addShake(16);
          this.particles.burst(WORLD_W / 2, WORLD_H / 2, ['#ffffff', col, '#ffd166'], 'supernova', 200, 1.5);
        }
        if (type === 'laser') this.fx.addShake(8);
      }),
      ev.on('lightning', ({ points }) => {
        this.lightnings.push({ points, life: 0.3 });
        this.fx.flash('#ffd166', 0.12);
      }),
      ev.on('splash', ({ kind, x, y, radius }) => {
        const col = kind === 'frost' ? ['#bfefff', '#7fe3ff', '#ffffff'] : kind === 'missile' ? ['#ff9f43', '#ffd166'] : ['#ff4fd8', '#ffffff'];
        this.particles.burst(x, y, col, kind === 'frost' ? 'ice' : 'ring', radius * 0.5, 0.8);
        if (kind === 'shockwave') this.fx.addShake(6);
      }),
      ev.on('waveStart', ({ wave }) => this.texts.add(t('game.waveStart', { n: wave }), WORLD_W / 2, 260, '#38e8ff', 40, 1.6)),
      ev.on('waveEnd', () => this.texts.add(t('game.waveClear'), WORLD_W / 2, 280, '#5cf2a6', 36, 1.6)),
    );
  }

  /** Mise à jour des effets visuels ; renvoie le facteur de temps (ralenti). */
  update(dt: number): number {
    this.time += dt;
    this.background.update(dt, this.opts.reducedMotion);
    this.particles.update(dt);
    this.texts.update(dt);
    this.bossIntro = Math.max(0, this.bossIntro - dt);
    for (const l of this.lightnings) l.life -= dt;
    this.lightnings = this.lightnings.filter((l) => l.life > 0);
    return this.fx.update(dt, this.opts.reducedMotion);
  }

  draw(): void {
    const cv = this.canvas;
    const c = cv.begin();
    const g = this.game;
    c.save();
    c.translate(this.fx.shakeX, this.fx.shakeY);
    this.background.draw(c, cv.viewW, cv.viewH, cv.offsetX, cv.offsetY, g.flow.intensity);

    if (g.boss) this.drawBoss(c, g.boss);
    this.drawPlanet(c);
    this.drawCannon(c);

    for (const a of g.asteroids) if (a.alive) this.drawAsteroid(c, a);
    if (g.boss) for (const bt of g.boss.targets) if (bt.alive) this.drawBossTarget(c, bt, g.boss);

    const focus = g.focus;
    if (focus) this.drawReticle(c, focus);

    this.drawProjectiles(c);
    this.particles.draw(c);
    this.texts.draw(c);

    if (g.frozen) this.drawFreeze(c);
    if (g.activeEvent === 'iceAge' && !g.frozen) {
      c.fillStyle = 'rgba(127,227,255,0.05)';
      c.fillRect(-400, -400, WORLD_W + 800, WORLD_H + 800);
    }
    if (g.phase === 'help') {
      c.fillStyle = 'rgba(5,8,26,0.55)';
      c.fillRect(-400, -400, WORLD_W + 800, WORLD_H + 800);
    }
    if (g.phase === 'intro' || this.bossIntro > 0) this.drawBanner(c);
    c.restore();
    this.fx.drawOverlay(c, -cv.offsetX, -cv.offsetY, cv.viewW, cv.viewH);
    this.drawVignette(c, -cv.offsetX, -cv.offsetY, cv.viewW, cv.viewH);
  }

  // ------------------------------------------------------------- planète & canon

  private drawPlanet(c: CanvasRenderingContext2D): void {
    const skin = this.skins.planet;
    const key = JSON.stringify(skin);
    if (key !== this.planetKey) {
      this.planetKey = key;
      this.planetStrip = buildPlanetStrip(skin);
    }
    const g = this.game;
    const flash = g.earth.hitFlash;
    // Atmosphère
    const atmo = c.createRadialGradient(WORLD_W / 2, EARTH_Y + 830, 820, WORLD_W / 2, EARTH_Y + 830, 905);
    const atmoCol = flash > 0 ? '#ff5d73' : g.earth.shield ? '#5cf2a6' : skin.atmosphere;
    atmo.addColorStop(0, hexToRgba(atmoCol, 0.0));
    atmo.addColorStop(0.5, hexToRgba(atmoCol, 0.35 + flash * 0.3));
    atmo.addColorStop(1, hexToRgba(atmoCol, 0));
    c.fillStyle = atmo;
    c.fillRect(-400, EARTH_Y - 120, WORLD_W + 800, 200);
    if (skin.rings) {
      c.save();
      c.globalAlpha = 0.5;
      c.strokeStyle = hexToRgba(skin.atmosphere, 0.7);
      c.lineWidth = 6;
      c.beginPath();
      c.ellipse(WORLD_W / 2, EARTH_Y + 40, 760, 60, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      c.restore();
    }
    if (this.planetStrip) c.drawImage(this.planetStrip, -400, EARTH_Y - 20, WORLD_W + 800, 140);
    if (g.earth.shield) {
      c.save();
      c.globalAlpha = 0.5 + Math.sin(this.time * 4) * 0.15;
      c.strokeStyle = '#5cf2a6';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(WORLD_W / 2, EARTH_Y + 830, 850, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
      c.restore();
    }
    if (flash > 0) {
      c.fillStyle = `rgba(255,60,90,${flash * 0.25})`;
      c.fillRect(-400, EARTH_Y - 20, WORLD_W + 800, 140);
    }
  }

  private drawCannon(c: CanvasRenderingContext2D): void {
    const g = this.game;
    const skin = this.skins.cannon;
    const { x, y, angle, recoil } = g.cannon;
    const glow = glowSprite(skin.glow, 70);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.6 + (g.buffer ? 0.3 : 0);
    c.drawImage(glow, x - 70, y - 70);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // Socle
    c.fillStyle = '#1b2250';
    c.beginPath();
    c.arc(x, y + 8, 34, Math.PI, 0);
    c.fill();
    c.fillStyle = skin.base;
    c.beginPath();
    c.arc(x, y + 6, 24, Math.PI, 0);
    c.fill();
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.translate(-recoil * 10, 0);
    drawBarrel(c, skin);
    c.restore();
    // Saisie en cours
    if (g.buffer) {
      outlinedText(c, g.buffer, x, y - 58, 34, '#ffffff', '900', 'Orbitron');
    }
  }

  // ------------------------------------------------------------- astéroïdes & cibles

  private drawAsteroid(c: CanvasRenderingContext2D, a: Asteroid): void {
    const sprite = asteroidSprite(a.variant, a.shapeSeed, a.radius);
    const s = a.scale;
    c.save();
    c.translate(a.x, a.y);
    c.rotate(a.rotation);
    c.scale(s, s);
    c.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    c.restore();
    if (this.game.time < a.slowUntil) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5;
      c.drawImage(glowSprite('#7fe3ff', a.radius + 14), a.x - a.radius - 14, a.y - a.radius - 14);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    if (a.variant === 'fire') {
      // Traînée de feu
      c.globalCompositeOperation = 'lighter';
      const gr = c.createLinearGradient(a.x, a.y, a.x, a.y - a.radius * 2.2);
      gr.addColorStop(0, 'rgba(255,120,40,0.45)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = gr;
      c.beginPath();
      c.ellipse(a.x, a.y - a.radius, a.radius * 0.7, a.radius * 1.4, 0, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    this.drawLabel(c, a, a.radius);
  }

  private drawLabel(c: CanvasRenderingContext2D, tg: Target, radius: number): void {
    const size = clamp(radius * 0.62, 20, 34) * (this.opts.largeText ? 1.25 : 1);
    const isAimed = this.game.cannon.targetId === tg.id && this.game.buffer.length > 0;
    if (this.opts.highContrast) {
      c.fillStyle = 'rgba(5,8,26,0.75)';
      roundRect(c, tg.x - size * 2.2, tg.y - size * 0.7, size * 4.4, size * 1.4, 8);
      c.fill();
    }
    outlinedText(c, tg.label, tg.x, tg.y, size, isAimed ? '#ffd166' : '#ffffff', '800');
    if (tg.helped) outlinedText(c, '?', tg.x + tg.radius * 0.8, tg.y - tg.radius * 0.8, size * 0.7, '#ffd166', '900');
    if (this.game.oracleActive) {
      const first = String(tg.answer)[0] ?? '';
      const rest = '_'.repeat(String(tg.answer).length - 1);
      outlinedText(c, `${first}${rest}`, tg.x, tg.y + size * 1.05, size * 0.75, '#c86bff', '800');
    }
  }

  private drawBossTarget(c: CanvasRenderingContext2D, bt: BossTarget, boss: BossBase): void {
    const r = bt.radius;
    const vis = boss.kind === 'phantom' ? (boss as Phantom).visibility(bt) : 1;
    if (bt.twinId >= 0) {
      const twin = boss.targets.find((x) => x.id === bt.twinId);
      if (twin && twin.id > bt.id) {
        c.strokeStyle = 'rgba(255,209,102,0.5)';
        c.lineWidth = 3;
        c.setLineDash([6, 6]);
        c.beginPath();
        c.moveTo(bt.x, bt.y);
        c.lineTo(twin.x, twin.y);
        c.stroke();
        c.setLineDash([]);
      }
    }
    c.save();
    c.globalAlpha = boss.kind === 'phantom' ? 0.35 + 0.65 * vis : 1;
    c.translate(bt.x, bt.y);
    c.rotate(this.time * 0.3);
    const grad = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#2b1055');
    grad.addColorStop(1, '#0f1a4a');
    c.fillStyle = grad;
    c.strokeStyle = '#8a6cff';
    c.lineWidth = 3;
    polygon(c, 6, r);
    c.fill();
    c.stroke();
    c.restore();
    if (bt.deadline > 0) {
      const chrono = boss as Chrono;
      const limit = typeof (chrono as { limit?: number }).limit === 'number' ? (chrono as Chrono).limit : this.game.mode.fluentMs * 1.3;
      const left = clamp((bt.deadline - this.game.time) / limit, 0, 1);
      c.strokeStyle = left < 0.3 ? '#ff5d73' : '#ffd166';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(bt.x, bt.y, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      c.stroke();
    }
    if (bt.hidden) outlinedText(c, '?', bt.x, bt.y, clamp(r * 0.8, 24, 40), '#c86bff', '900');
    else {
      c.save();
      c.globalAlpha = boss.kind === 'phantom' ? Math.max(0.15, vis) : 1;
      this.drawLabel(c, bt, r);
      c.restore();
    }
  }

  private drawReticle(c: CanvasRenderingContext2D, tg: Target): void {
    const skin: ReticleSkin = this.skins.reticle;
    const r = tg.radius + 12;
    c.save();
    c.translate(tg.x, tg.y);
    c.strokeStyle = skin.color;
    c.lineWidth = 2.5;
    c.globalAlpha = 0.85;
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
        c.rotate(this.time * 1.2);
        polygon(c, 4, r);
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
        c.rotate(this.time * 0.8);
        c.setLineDash([r * 0.5, r * 0.3]);
        c.beginPath();
        c.arc(0, 0, r, 0, TAU);
        c.stroke();
    }
    c.restore();
  }

  // ------------------------------------------------------------- boss

  private drawBoss(c: CanvasRenderingContext2D, boss: BossBase): void {
    const { x, y } = boss;
    c.save();
    c.globalAlpha = boss.enterT;
    const glow = glowSprite('#8a6cff', 200);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5 * boss.enterT;
    c.drawImage(glow, x - 200, y - 200);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = boss.enterT;
    switch (boss.kind) {
      case 'titan': {
        const sp = asteroidSprite('normal', 5, 96);
        c.save();
        c.translate(x, y);
        c.rotate(this.time * 0.15);
        c.drawImage(sp, -sp.width / 2, -sp.height / 2);
        c.restore();
        const core = glowSprite('#ff5d73', 60);
        c.globalCompositeOperation = 'lighter';
        c.drawImage(core, x - 60, y - 60);
        c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'hydra': {
        c.strokeStyle = '#2f8f6a';
        c.lineWidth = 14;
        c.lineCap = 'round';
        for (const tg of boss.targets) {
          c.beginPath();
          c.moveTo(x, y);
          c.quadraticCurveTo((x + tg.x) / 2, tg.y - 40, tg.x, tg.y);
          c.stroke();
        }
        const g = c.createRadialGradient(x - 20, y - 20, 10, x, y, 80);
        g.addColorStop(0, '#5cf2a6');
        g.addColorStop(1, '#0b4d3a');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x, y, 80, 60, 0, 0, TAU);
        c.fill();
        c.fillStyle = '#ffd166';
        for (const dx of [-28, 28]) {
          c.beginPath();
          c.ellipse(x + dx, y - 12, 10, 14, 0, 0, TAU);
          c.fill();
          c.fillStyle = '#05081a';
          c.beginPath();
          c.ellipse(x + dx, y - 12, 4, 10, 0, 0, TAU);
          c.fill();
          c.fillStyle = '#ffd166';
        }
        break;
      }
      case 'mirror': {
        c.save();
        c.translate(x, y);
        const g = c.createLinearGradient(-120, -60, 120, 60);
        g.addColorStop(0, '#d6c8ff');
        g.addColorStop(0.5, '#6b4bd6');
        g.addColorStop(1, '#2b1055');
        c.fillStyle = g;
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -70);
        c.lineTo(140, 0);
        c.lineTo(0, 70);
        c.lineTo(-140, 0);
        c.closePath();
        c.fill();
        c.stroke();
        c.globalAlpha *= 0.5;
        c.beginPath();
        c.moveTo(0, -70);
        c.lineTo(0, 70);
        c.moveTo(-140, 0);
        c.lineTo(140, 0);
        c.stroke();
        c.restore();
        break;
      }
      case 'chrono': {
        c.save();
        c.translate(x, y);
        c.strokeStyle = '#ffd166';
        c.lineWidth = 8;
        c.beginPath();
        c.arc(0, 0, 90, 0, TAU);
        c.stroke();
        c.strokeStyle = '#ff9f43';
        c.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
          c.rotate(TAU / 12);
          c.beginPath();
          c.moveTo(0, -78);
          c.lineTo(0, -88);
          c.stroke();
        }
        c.rotate(this.time * 2);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -70);
        c.stroke();
        c.restore();
        break;
      }
      case 'swarm': {
        c.save();
        c.translate(x, y - 40);
        const g = c.createRadialGradient(0, 0, 10, 0, 0, 70);
        g.addColorStop(0, '#ffd166');
        g.addColorStop(1, '#6b3a0b');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 70, 36, 0, 0, TAU);
        c.fill();
        c.strokeStyle = '#ff9f43';
        c.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const a = this.time * 2 + (i / 6) * TAU;
          c.beginPath();
          c.moveTo(Math.cos(a) * 30, Math.sin(a) * 16);
          c.lineTo(Math.cos(a) * 95, Math.sin(a) * 50);
          c.stroke();
        }
        c.restore();
        for (const tg of boss.targets) {
          c.fillStyle = '#ff9f43';
          c.beginPath();
          c.ellipse(tg.x, tg.y - tg.radius - 8, 14, 5, 0, 0, TAU);
          c.fill();
        }
        break;
      }
      case 'phantom': {
        c.save();
        c.translate(x, y);
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.5);
        c.globalAlpha = boss.enterT * (0.35 + pulse * 0.4);
        const g = c.createRadialGradient(0, -10, 10, 0, 0, 110);
        g.addColorStop(0, '#d6c8ff');
        g.addColorStop(0.6, '#6b4bd6');
        g.addColorStop(1, 'rgba(43,16,85,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-90, 40);
        c.quadraticCurveTo(-100, -90, 0, -90);
        c.quadraticCurveTo(100, -90, 90, 40);
        for (let i = 0; i < 5; i++) c.quadraticCurveTo(90 - i * 36 - 18, 40 + (i % 2 === 0 ? 24 : -8) + Math.sin(this.time * 4 + i) * 8, 90 - (i + 1) * 36, 40);
        c.closePath();
        c.fill();
        c.globalAlpha = boss.enterT;
        c.fillStyle = '#05081a';
        for (const dx of [-26, 26]) {
          c.beginPath();
          c.ellipse(dx, -25, 11, 15 + pulse * 4, 0, 0, TAU);
          c.fill();
        }
        c.restore();
        break;
      }
      case 'twins': {
        c.save();
        c.translate(x, y - 30);
        for (const side of [-1, 1]) {
          const g = c.createRadialGradient(side * 50 - 10, -10, 8, side * 50, 0, 50);
          g.addColorStop(0, side < 0 ? '#38e8ff' : '#ff4fd8');
          g.addColorStop(1, '#0f1a4a');
          c.fillStyle = g;
          c.beginPath();
          c.arc(side * 50, 0, 46, 0, TAU);
          c.fill();
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(side * 50 - side * 10, -8, 7, 0, TAU);
          c.fill();
        }
        c.strokeStyle = '#ffd166';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(-10, 0);
        c.lineTo(10, 0);
        c.stroke();
        c.restore();
        break;
      }
      case 'mothership': {
        const ms = boss as Mothership;
        c.save();
        c.translate(x, y);
        const g = c.createLinearGradient(0, -40, 0, 50);
        g.addColorStop(0, '#5b6a9e');
        g.addColorStop(1, '#1b2250');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 260, 50, 0, 0, TAU);
        c.fill();
        c.fillStyle = '#9fb3d9';
        c.beginPath();
        c.ellipse(0, -30, 110, 45, 0, Math.PI, 0);
        c.fill();
        c.fillStyle = '#ff4fd8';
        for (let i = 0; i < 9; i++) {
          const lx = -220 + i * 55;
          c.globalAlpha = boss.enterT * (0.5 + 0.5 * Math.sin(this.time * 4 + i));
          c.beginPath();
          c.arc(lx, 20, 8, 0, TAU);
          c.fill();
        }
        c.globalAlpha = boss.enterT;
        if (ms.phase === 3) {
          const left = ms.salvoLeft > 0 ? ms.salvoLeft / ms.salvoLimit : 1;
          c.strokeStyle = hexToRgba('#38e8ff', 0.6);
          c.lineWidth = 6;
          c.beginPath();
          c.arc(0, 60, 300, Math.PI * 1.1, Math.PI * 1.1 + Math.PI * 0.8 * left);
          c.stroke();
          if (ms.salvoLeft > 0) outlinedText(c, t('game.salvo', { s: Math.ceil(ms.salvoLeft / 1000) }), 0, -90, 22, '#38e8ff');
        }
        c.restore();
        break;
      }
    }
    c.restore();
  }

  // ------------------------------------------------------------- projectiles & overlays

  private drawProjectiles(c: CanvasRenderingContext2D): void {
    const skin: TrailSkin = this.skins.trail;
    c.globalCompositeOperation = 'lighter';
    for (const l of this.lightnings) {
      const a = l.life / 0.3;
      c.globalAlpha = a;
      for (const [w, col] of [[9, 'rgba(255,209,102,0.5)'], [3, '#ffffff']] as const) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.lineJoin = 'round';
        c.beginPath();
        for (let i = 0; i < l.points.length - 1; i++) {
          const p0 = l.points[i] as { x: number; y: number };
          const p1 = l.points[i + 1] as { x: number; y: number };
          if (i === 0) c.moveTo(p0.x, p0.y);
          const segs = 7;
          for (let k = 1; k <= segs; k++) {
            const t = k / segs;
            const jitter = k === segs ? 0 : (Math.sin(this.time * 90 + k * 13 + i * 7) * 18);
            c.lineTo(p0.x + (p1.x - p0.x) * t - (p1.y - p0.y) * 0.1 * jitter / 18, p0.y + (p1.y - p0.y) * t + (p1.x - p0.x) * 0.1 * jitter / 18);
          }
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    for (const p of this.game.projectiles) {
      const pskin = this.skins.projectile;
      const offsets = p.kind === 'twin' ? [-7, 7] : [0];
      for (const off of offsets) {
        c.save();
        c.translate(off, 0);
        this.drawOneProjectile(c, p, skin, pskin.color);
        c.restore();
      }
    }
    c.globalCompositeOperation = 'source-over';
  }

  private drawOneProjectile(c: CanvasRenderingContext2D, p: Projectile, skin: TrailSkin, headColor: string): void {
    {
      if (p.trail.length > 1) {
        const first = p.trail[0] as { x: number; y: number };
        const grad = c.createLinearGradient(first.x, first.y, p.x, p.y);
        if (skin.style === 'rainbow') {
          grad.addColorStop(0, 'rgba(255,93,115,0)');
          grad.addColorStop(0.5, '#ffd166');
          grad.addColorStop(1, '#38e8ff');
        } else {
          grad.addColorStop(0, hexToRgba(skin.color, 0));
          grad.addColorStop(1, skin.color2);
        }
        c.strokeStyle = grad;
        c.lineWidth = p.fizzle ? 3 : skin.style === 'plasma' || skin.style === 'fire' ? 10 : 6;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(first.x, first.y);
        for (const pt of p.trail) c.lineTo(pt.x, pt.y);
        c.lineTo(p.x, p.y);
        c.stroke();
        if (skin.style === 'sparks' || skin.style === 'fire' || skin.style === 'star') {
          c.fillStyle = skin.color;
          for (let i = 0; i < 3; i++) {
            const pt = p.trail[(p.trail.length - 1 - i * 2) as number];
            if (!pt) continue;
            c.beginPath();
            c.arc(pt.x + Math.sin(this.time * 40 + i) * 6, pt.y + Math.cos(this.time * 35 + i) * 6, 2.5, 0, TAU);
            c.fill();
          }
        }
      }
      const glow = glowSprite(p.fizzle ? '#ff5d73' : headColor, p.kind === 'missile' || p.kind === 'shockwave' ? 30 : 22);
      c.drawImage(glow, p.x - glow.width / 2, p.y - glow.height / 2);
      c.fillStyle = '#ffffff';
      if (p.kind === 'missile') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(Math.atan2(p.vy, p.vx));
        c.fillStyle = headColor;
        c.beginPath();
        c.moveTo(12, 0);
        c.lineTo(-8, -5);
        c.lineTo(-8, 5);
        c.closePath();
        c.fill();
        c.restore();
      } else if (p.kind === 'frost') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(this.time * 6);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          c.rotate(Math.PI / 3);
          c.beginPath();
          c.moveTo(-8, 0);
          c.lineTo(8, 0);
          c.stroke();
        }
        c.restore();
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.fizzle ? 3 : p.kind === 'shockwave' ? 7 : 5, 0, TAU);
        c.fill();
      }
    }
  }

  private drawFreeze(c: CanvasRenderingContext2D): void {
    const left = (this.game.effects.freezeUntil - this.game.time) / 5000;
    c.fillStyle = `rgba(127,227,255,${0.08 + 0.05 * Math.sin(this.time * 6)})`;
    c.fillRect(-400, -400, WORLD_W + 800, WORLD_H + 800);
    outlinedText(c, `❄ ${t('game.frozen')} ${Math.ceil(left * 5)}`, WORLD_W / 2, 90, 26, '#bfefff', '800', 'Orbitron');
  }

  private drawBanner(c: CanvasRenderingContext2D): void {
    const g = this.game;
    let text = '';
    let sub = '';
    if (g.phase === 'intro') text = t('game.getReady');
    else if (g.boss) {
      text = `${t('game.bossIncoming')} · ${t(`boss.${g.boss.kind}`)}`;
      sub = t(`boss.${g.boss.kind}.desc`);
    }
    if (!text) return;
    const pulse = 1 + Math.sin(this.time * 5) * 0.03;
    outlinedText(c, text, WORLD_W / 2, 300, 40 * pulse, g.boss ? '#ff4fd8' : '#38e8ff', '900', 'Orbitron');
    if (sub) outlinedText(c, sub, WORLD_W / 2, 350, 22, '#eaf2ff', '600');
  }

  private drawVignette(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const g = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.45, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }

  destroy(): void {
    this.unbind();
  }
}

// ------------------------------------------------------------- helpers de dessin

function polygon(c: CanvasRenderingContext2D, sides: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

/** Dessine le fût du canon (orienté vers +x) selon le skin. */
export function drawBarrel(c: CanvasRenderingContext2D, skin: CannonSkin): void {
  c.fillStyle = skin.base;
  c.strokeStyle = skin.accent;
  c.lineWidth = 2;
  switch (skin.shape) {
    case 'twin':
      for (const dy of [-9, 9]) {
        roundRect(c, 0, dy - 5, 46, 10, 4);
        c.fill();
        c.stroke();
      }
      break;
    case 'heavy':
      roundRect(c, -6, -14, 54, 28, 6);
      c.fill();
      c.stroke();
      c.fillStyle = skin.accent;
      c.fillRect(30, -10, 6, 20);
      break;
    case 'needle':
      roundRect(c, 0, -4, 64, 8, 4);
      c.fill();
      c.stroke();
      c.fillStyle = skin.accent;
      c.beginPath();
      c.moveTo(64, -4);
      c.lineTo(76, 0);
      c.lineTo(64, 4);
      c.fill();
      break;
    case 'crystal':
      c.beginPath();
      c.moveTo(0, -12);
      c.lineTo(40, -8);
      c.lineTo(54, 0);
      c.lineTo(40, 8);
      c.lineTo(0, 12);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    case 'retro':
      roundRect(c, 0, -9, 44, 18, 9);
      c.fill();
      c.stroke();
      c.fillStyle = skin.accent;
      for (const dx of [10, 22, 34]) c.fillRect(dx, -11, 3, 22);
      break;
    case 'orb':
      c.beginPath();
      c.arc(22, 0, 16, 0, TAU);
      c.fill();
      c.stroke();
      c.strokeStyle = skin.glow;
      c.beginPath();
      c.ellipse(22, 0, 24, 8, 0.4, 0, TAU);
      c.stroke();
      break;
    case 'phoenix':
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-14, -26);
      c.lineTo(24, -8);
      c.lineTo(52, 0);
      c.lineTo(24, 8);
      c.lineTo(-14, 26);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    default:
      roundRect(c, 0, -8, 48, 16, 5);
      c.fill();
      c.stroke();
      c.fillStyle = skin.accent;
      c.fillRect(36, -10, 5, 20);
  }
  // Lueur de bouche
  c.fillStyle = skin.glow;
  c.beginPath();
  c.arc(skin.shape === 'needle' ? 70 : 50, 0, 4, 0, TAU);
  c.fill();
}

/** Bande de planète pré-rendue (1280+800 de large, 140 de haut). */
function buildPlanetStrip(skin: PlanetSkin): HTMLCanvasElement {
  const w = WORLD_W + 800;
  const h = 140;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  const cx = w / 2;
  const cy = 850;
  const R = 840;
  c.save();
  c.beginPath();
  c.arc(cx, cy, R, 0, TAU);
  c.clip();
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, skin.ocean);
  g.addColorStop(1, '#05081a');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const rng = new Rng(2024);
  c.fillStyle = skin.land;
  for (let i = 0; i < 14; i++) {
    const x = rng.range(0, w);
    const y = rng.range(10, 90);
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const rr = rng.range(30, 90);
      const px = x + Math.cos(a) * rr * 1.6;
      const py = y + Math.sin(a) * rr * 0.5;
      if (k === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.globalAlpha = 0.85;
    c.fill();
  }
  c.globalAlpha = 1;
  // Lumières de villes
  c.fillStyle = skin.lights;
  for (let i = 0; i < 160; i++) {
    const x = rng.range(0, w);
    const y = 12 + Math.pow(rng.next(), 2) * 60;
    c.globalAlpha = rng.range(0.3, 0.9);
    c.fillRect(x, y, 2, 2);
  }
  c.globalAlpha = 1;
  if (skin.style === 'lava') {
    c.strokeStyle = '#ffd166';
    c.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      c.beginPath();
      c.moveTo(rng.range(0, w), rng.range(0, 60));
      c.lineTo(rng.range(0, w), rng.range(20, 100));
      c.stroke();
    }
  }
  if (skin.style === 'neon' || skin.style === 'crystal') {
    c.strokeStyle = hexToRgba(skin.lights, 0.5);
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 30, h);
      c.stroke();
    }
  }
  c.restore();
  // Liseré d'horizon
  c.strokeStyle = hexToRgba(skin.atmosphere, 0.9);
  c.lineWidth = 3;
  c.beginPath();
  c.arc(cx, cy, R, Math.PI * 1.02, Math.PI * 1.98);
  c.stroke();
  return cv;
}
