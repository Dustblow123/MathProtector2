import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/**
 * Fantôme : les multiplications s'affichent quelques secondes puis disparaissent.
 * Il faut répondre de mémoire (rappel actif) ; la réponse reste acceptée pendant la phase cachée.
 */
export class Phantom extends BossBase {
  readonly kind: BossKind = 'phantom';
  readonly phases = 3;
  private readonly perPhase = 3;
  private readonly total = 9;
  private cycles = new Map<number, number>();
  visibleMs = 2400;
  hiddenMs = 2600;

  init(): void {
    this.attackInterval = 9000;
    this.attackTimer = 7000;
    this.spawnSet();
  }

  private spawnSet(): void {
    for (let i = 0; i < this.perPhase; i++) {
      const t = this.makeTarget(this.pickFact(), -200 + i * 200, 50 + (i % 2) * 40, 42);
      this.cycles.set(t.id, this.game.time + i * 700); // décalage pour ne pas tout cacher en même temps
      this.targets.push(t);
    }
  }

  onTargetDestroyed(t: BossTarget): void {
    this.cycles.delete(t.id);
    this.hp = 1 - this.kills / this.total;
    if (this.targets.length === 0) {
      if (this.phase >= this.phases) {
        this.defeated = true;
        this.hp = 0;
        return;
      }
      this.phase++;
      this.visibleMs = Math.max(1400, this.visibleMs - 450);
      this.hiddenMs += 400;
      this.spawnSet();
      this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
    }
  }

  /** 0..1 : progression dans la phase visible (pour l'animation de fondu). */
  visibility(t: BossTarget): number {
    const start = this.cycles.get(t.id) ?? 0;
    const period = this.visibleMs + this.hiddenMs;
    const phase = ((this.game.time - start) % period + period) % period;
    if (phase < this.visibleMs) return Math.min(1, (this.visibleMs - phase) / 500);
    return 0;
  }

  protected tick(dt: number): void {
    if (this.game.frozen) {
      for (const [id, start] of this.cycles) this.cycles.set(id, start + dt * 1000);
    }
    for (const t of this.targets) t.hidden = this.visibility(t) === 0;
  }
}
