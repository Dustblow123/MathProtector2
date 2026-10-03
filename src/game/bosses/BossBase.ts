import type { Game } from '../Game';
import type { BossKind, BossTarget } from '../types';
import type { Fact } from '../../learning/types';

/**
 * Base commune des boss. Un boss expose des cibles (segments) qui se détruisent
 * comme des astéroïdes en tapant la réponse. Il attaque en lançant des astéroïdes.
 */
export abstract class BossBase {
  abstract readonly kind: BossKind;
  x = 640;
  y = 150;
  phase = 1;
  abstract readonly phases: number;
  targets: BossTarget[] = [];
  /** Progression 0..1 de la vie restante. */
  hp = 1;
  /** Temps avant la prochaine attaque (ms). */
  protected attackTimer = 4000;
  protected attackInterval = 6000;
  protected attackSpeedMul = 1.1;
  protected tt = 0;
  /** Temps d'apparition (animation d'entrée). */
  enterT = 0;
  defeated = false;
  /** Nombre de cibles détruites au total. */
  kills = 0;
  readonly table: number;

  constructor(protected readonly game: Game, table: number) {
    this.table = table;
  }

  /** Appelé une fois au début du combat. */
  abstract init(): void;
  abstract onTargetDestroyed(t: BossTarget): void;
  /** Mise à jour spécifique (après celle de la base). */
  protected abstract tick(dt: number): void;

  update(dt: number): void {
    this.tt += dt;
    this.enterT = Math.min(1, this.enterT + dt / 1.2);
    const amp = Math.max(0, Math.min(160, this.game.viewHalfWidth - 340));
    this.x = this.game.viewCenterX + Math.sin(this.tt * 0.5) * amp * this.enterT;
    this.y = 150 + Math.sin(this.tt * 0.9) * 18 - (1 - this.enterT) * 400;
    if (!this.game.frozen && this.enterT >= 1) {
      this.attackTimer -= dt * 1000;
      if (this.attackTimer <= 0) {
        this.attackTimer = this.attackInterval;
        this.attack();
      }
    }
    for (const t of this.targets) {
      t.x = this.x + t.dx;
      t.y = this.y + t.dy;
    }
    this.tick(dt);
  }

  protected attack(): void {
    const a = this.game.spawnAsteroid({ speedMul: this.attackSpeedMul, fromX: this.x, fromY: this.y + 40 });
    if (a) this.game.events.emit('bossAttack', { boss: this });
  }

  /** Crée une cible de boss liée à un fait. */
  protected makeTarget(fact: Fact, dx: number, dy: number, radius: number, opts: { mirror?: boolean; deadline?: number } = {}): BossTarget {
    const mirror = opts.mirror ?? false;
    const t: BossTarget = {
      id: this.game.nextId(),
      fact,
      answer: mirror ? fact.b : fact.product,
      label: mirror ? `${fact.a} × ? = ${fact.product}` : `${fact.a} × ${fact.b}`,
      x: this.x + dx,
      y: this.y + dy,
      dx,
      dy,
      radius,
      spawnTime: this.game.time,
      alive: true,
      type: 'boss',
      deadline: opts.deadline ?? 0,
    };
    return t;
  }

  /** Pioche un fait de la table du boss (via le scheduler) dont la réponse n'est pas déjà visible. */
  protected pickFact(mirror = false): Fact {
    return this.game.pickBossFact(this.table, mirror);
  }

  removeTarget(t: BossTarget): void {
    t.alive = false;
    this.targets = this.targets.filter((x) => x !== t);
  }
}
