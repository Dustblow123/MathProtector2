import { makeFact } from '../../learning/facts';
import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/** Hydre : chaque tête détruite se scinde en deux têtes aux faits voisins (travail du voisinage). */
export class Hydra extends BossBase {
  readonly kind: BossKind = 'hydra';
  readonly phases = 3;
  private gen = new Map<number, number>();
  private readonly maxGen = 2;
  private readonly total = 2 + 4 + 8;

  init(): void {
    this.attackInterval = 8000;
    this.attackTimer = 6000;
    for (let i = 0; i < 2; i++) {
      const t = this.makeTarget(this.pickFact(), i === 0 ? -150 : 150, 40, 40);
      this.gen.set(t.id, 0);
      this.targets.push(t);
    }
  }

  onTargetDestroyed(t: BossTarget): void {
    this.hp = 1 - this.kills / this.total;
    const g = this.gen.get(t.id) ?? 0;
    this.gen.delete(t.id);
    if (g < this.maxGen) {
      const visible = this.game.onScreenAnswers;
      const f = t.fact;
      const candidates = [makeFact(f.a, Math.max(1, f.b - 1), f.op), makeFact(f.a, Math.min(this.game.mode.maxTable, f.b + 1), f.op)];
      let placed = 0;
      for (const cf of candidates) {
        let fact = cf;
        if (visible.has(fact.answer) || fact.id === f.id) fact = this.pickFact();
        if (visible.has(fact.answer)) continue;
        const dx = Math.max(-320, Math.min(320, t.dx + (placed === 0 ? -70 : 70) + this.game.rng.range(-20, 20)));
        const dy = Math.min(140, t.dy + 45 + g * 10);
        const nt = this.makeTarget(fact, dx, dy, Math.max(26, t.radius - 6));
        this.gen.set(nt.id, g + 1);
        this.targets.push(nt);
        visible.add(fact.answer);
        placed++;
      }
      this.phase = Math.min(this.phases, g + 2);
      this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
    }
    if (this.targets.length === 0) {
      this.defeated = true;
      this.hp = 0;
    }
  }

  protected tick(dt: number): void {
    // Les têtes ondulent légèrement.
    for (const t of this.targets) t.y += Math.sin(this.tt * 2 + t.id) * 12 * dt;
  }
}
