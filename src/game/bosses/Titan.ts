import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/** Astéroïde géant à segments : chaque phase expose un anneau de faits à détruire. */
export class Titan extends BossBase {
  readonly kind: BossKind = 'titan';
  readonly phases = 3;
  private readonly perPhase = [6, 5, 5];
  private total = 16;

  init(): void {
    this.attackInterval = 7000;
    this.attackTimer = 5000;
    this.spawnRing();
  }

  private spawnRing(): void {
    const n = this.perPhase[this.phase - 1] ?? 5;
    const radius = 120 + (3 - this.phase) * 10;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const f = this.pickFact();
      this.targets.push(this.makeTarget(f, Math.cos(ang) * radius, Math.sin(ang) * radius * 0.7 + 10, 36));
    }
  }

  onTargetDestroyed(_t: BossTarget): void {
    this.hp = 1 - this.kills / this.total;
    if (this.targets.length === 0) {
      if (this.phase >= this.phases) {
        this.defeated = true;
        this.hp = 0;
        return;
      }
      this.phase++;
      this.attackInterval = Math.max(3500, this.attackInterval - 1200);
      this.attackSpeedMul += 0.15;
      this.spawnRing();
      this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
    }
  }

  protected tick(_dt: number): void {
    /* mouvement géré par la base */
  }
}
