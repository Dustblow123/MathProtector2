import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/** Chrono : une cible à la fois, à résoudre avant la fin d'un compte à rebours de plus en plus court. */
export class Chrono extends BossBase {
  readonly kind: BossKind = 'chrono';
  readonly phases = 3;
  readonly total = 12;
  private spawnDelay = 0;

  init(): void {
    this.attackInterval = 12000;
    this.attackTimer = 9000;
    this.spawnDelay = 1200;
  }

  /** Limite de temps courante (ms). */
  get limit(): number {
    const f = this.game.mode.fluentMs;
    const p = this.kills / this.total;
    return f * (1.6 - 0.8 * p);
  }

  private spawnOne(): void {
    const f = this.pickFact();
    const t = this.makeTarget(f, this.game.rng.range(-200, 200), 50, 46, { deadline: this.game.time + this.limit });
    this.targets.push(t);
  }

  onTargetDestroyed(_t: BossTarget): void {
    this.hp = 1 - this.kills / this.total;
    this.phase = Math.min(this.phases, 1 + Math.floor((this.kills / this.total) * this.phases));
    if (this.kills >= this.total) {
      this.defeated = true;
      this.hp = 0;
      return;
    }
    this.spawnDelay = 700;
  }

  protected tick(dt: number): void {
    if (this.game.frozen) {
      for (const t of this.targets) t.deadline += dt * 1000;
      return;
    }
    if (this.targets.length === 0 && !this.defeated) {
      this.spawnDelay -= dt * 1000;
      if (this.spawnDelay <= 0 && this.enterT >= 1) this.spawnOne();
    }
  }
}
