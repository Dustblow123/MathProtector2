import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/** Miroir : "a × ? = p", il faut taper le facteur manquant (lien avec la division). */
export class Mirror extends BossBase {
  readonly kind: BossKind = 'mirror';
  readonly phases = 3;
  private readonly perPhase = 4;

  init(): void {
    this.attackInterval = 7500;
    this.attackTimer = 6000;
    this.spawnSet();
  }

  private spawnSet(): void {
    for (let i = 0; i < this.perPhase; i++) {
      const f = this.pickFact(true);
      const dx = -240 + i * 160;
      const dy = 30 + (i % 2) * 70;
      this.targets.push(this.makeTarget(f, dx, dy, 42, { mirror: true }));
    }
  }

  onTargetDestroyed(_t: BossTarget): void {
    this.hp = 1 - this.kills / (this.perPhase * this.phases);
    if (this.targets.length === 0) {
      if (this.phase >= this.phases) {
        this.defeated = true;
        this.hp = 0;
        return;
      }
      this.phase++;
      this.attackSpeedMul += 0.15;
      this.spawnSet();
      this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
    }
  }

  protected tick(_dt: number): void {
    /* rien de plus */
  }
}
