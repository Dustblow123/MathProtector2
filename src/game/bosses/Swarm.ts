import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/**
 * Essaim : des drones en formation ondulante. Régulièrement, un drone pique vers la Terre
 * et devient un astéroïde ordinaire (à détruire comme les autres). Trois vagues de drones.
 */
export class Swarm extends BossBase {
  readonly kind: BossKind = 'swarm';
  readonly phases = 3;
  private readonly perPhase = [6, 6, 7];
  private readonly total = 19;
  private resolved = 0;
  private diveTimer = 5000;
  private diveInterval = 5000;

  init(): void {
    this.attackInterval = 999_999; // les attaques sont les piqués
    this.spawnFormation();
  }

  private spawnFormation(): void {
    const n = this.perPhase[this.phase - 1] ?? 6;
    for (let i = 0; i < n; i++) {
      const dx = -((n - 1) / 2) * 100 + i * 100;
      this.targets.push(this.makeTarget(this.pickFact(), dx, 20 + (i % 2) * 60, 30));
    }
  }

  private dive(): void {
    const alive = this.targets.filter((t) => t.alive);
    if (alive.length === 0) return;
    const t = this.game.rng.pick(alive);
    this.removeTarget(t);
    this.resolved++;
    const a = this.game.spawnAsteroid({ fact: t.fact, fromX: t.x, fromY: t.y, speedMul: 1.25, variant: 'fire' });
    if (a) this.game.events.emit('bossAttack', { boss: this });
    this.hp = 1 - this.resolved / this.total;
    this.checkPhase();
  }

  onTargetDestroyed(_t: BossTarget): void {
    this.resolved++;
    this.hp = 1 - this.resolved / this.total;
    this.checkPhase();
  }

  private checkPhase(): void {
    if (this.targets.length > 0) return;
    if (this.phase >= this.phases) {
      this.defeated = true;
      this.hp = 0;
      return;
    }
    this.phase++;
    this.diveInterval = Math.max(3000, this.diveInterval - 800);
    this.diveTimer = this.diveInterval;
    this.spawnFormation();
    this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
  }

  protected tick(dt: number): void {
    const n = this.targets.length;
    this.targets.forEach((t, i) => {
      t.x = this.x + t.dx + Math.sin(this.tt * 1.4 + i) * 22;
      t.y = this.y + t.dy + Math.cos(this.tt * 2 + i * 0.8) * 16;
      void n;
    });
    if (this.game.frozen || this.enterT < 1 || this.defeated) return;
    this.diveTimer -= dt * 1000;
    if (this.diveTimer <= 0) {
      this.diveTimer = this.diveInterval;
      this.dive();
    }
  }
}
