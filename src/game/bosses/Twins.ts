import { makeFact } from '../../learning/facts';
import type { Fact } from '../../learning/types';
import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/**
 * Jumeaux : les cibles vont par paires commutées (7 × 8 et 8 × 7). Détruire l'une détruit l'autre.
 * Fait travailler la commutativité.
 */
export class Twins extends BossBase {
  readonly kind: BossKind = 'twins';
  readonly phases = 3;
  private readonly pairsPerPhase = 3;
  private readonly total = 9;
  private pairsDone = 0;

  init(): void {
    this.attackInterval = 8000;
    this.attackTimer = 6000;
    this.spawnPairs();
  }

  private spawnPairs(): void {
    const used = new Set<number>();
    for (let k = 0; k < this.pairsPerPhase; k++) {
      // Paires commutées : 7 × 8 / 8 × 7, ou 56 ÷ 7 / 56 ÷ 8. Réponses distinctes d'une paire à l'autre.
      const clash = (x: Fact) => x.a === x.b || used.has(x.answer) || used.has(makeFact(x.b, x.a, x.op).answer);
      let f = this.pickFact();
      for (let i = 0; i < 10 && clash(f); i++) f = this.pickFact();
      if (f.a === f.b) f = makeFact(f.a, f.a === this.game.mode.maxTable ? f.a - 1 : f.a + 1, f.op);
      const twin = makeFact(f.b, f.a, f.op);
      used.add(f.answer);
      used.add(twin.answer);
      const dx = -250 + k * 250;
      const a = this.makeTarget(f, dx, 20, 38);
      const b = this.makeTarget(twin, dx + 40, 110, 38);
      a.twinId = b.id;
      b.twinId = a.id;
      this.targets.push(a, b);
    }
  }

  onTargetDestroyed(t: BossTarget): void {
    const twin = this.targets.find((x) => x.id === t.twinId);
    if (twin && twin.alive) {
      // Le jumeau tombe avec l'original (sans impact sur le modèle d'apprentissage).
      this.game.destroyTarget(twin, true);
      return;
    }
    this.pairsDone++;
    this.hp = 1 - this.pairsDone / this.total;
    if (this.targets.length === 0) {
      if (this.phase >= this.phases) {
        this.defeated = true;
        this.hp = 0;
        return;
      }
      this.phase++;
      this.attackSpeedMul += 0.15;
      this.spawnPairs();
      this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
    }
  }

  protected tick(_dt: number): void {
    // Les paires tournent lentement l'une autour de l'autre.
    for (const t of this.targets) {
      const twin = this.targets.find((x) => x.id === t.twinId);
      if (!twin) continue;
      const cx = this.x + (t.dx + twin.dx) / 2;
      const cy = this.y + (t.dy + twin.dy) / 2;
      const ang = this.tt * 0.8 + (t.id < twin.id ? 0 : Math.PI);
      t.x = cx + Math.cos(ang) * 55;
      t.y = cy + Math.sin(ang) * 45;
    }
  }
}
