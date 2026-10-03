import { BossBase } from './BossBase';
import type { BossKind, BossTarget } from '../types';

/**
 * Vaisseau-mère (boss final) : 4 phases.
 * 1. Segments classiques · 2. Facteurs manquants · 3. Salve : 3 faits de la même table
 * à détruire en moins de 8 s sinon le bouclier se régénère · 4. Cœur chronométré.
 */
export class Mothership extends BossBase {
  readonly kind: BossKind = 'mothership';
  readonly phases = 4;
  private readonly total = 4 + 4 + 3 + 3;
  private salvoTimer = 0;
  private salvoKilled = 0;
  private coreKills = 0;
  private coreDelay = 0;
  /** Temps restant de la salve (ms), exposé pour le rendu. */
  salvoLeft = 0;
  readonly salvoLimit = 8000;

  init(): void {
    this.attackInterval = 6500;
    this.attackTimer = 5000;
    this.spawnPhase();
  }

  private spawnPhase(): void {
    this.targets = [];
    if (this.phase === 1) {
      for (let i = 0; i < 4; i++) this.targets.push(this.makeTarget(this.pickFact(), -210 + i * 140, 40 + (i % 2) * 50, 38));
    } else if (this.phase === 2) {
      for (let i = 0; i < 4; i++) this.targets.push(this.makeTarget(this.pickFact(true), -210 + i * 140, 40 + (i % 2) * 50, 40, { mirror: true }));
    } else if (this.phase === 3) {
      this.salvoKilled = 0;
      this.salvoTimer = 0;
      this.salvoLeft = 0;
      for (let i = 0; i < 3; i++) this.targets.push(this.makeTarget(this.pickFact(), -150 + i * 150, 60, 40));
    } else {
      this.coreDelay = 800;
    }
  }

  private spawnCore(): void {
    const t = this.makeTarget(this.pickFact(), 0, 60, 52, { deadline: this.game.time + this.game.mode.fluentMs * 1.3 });
    this.targets.push(t);
  }

  onTargetDestroyed(t: BossTarget): void {
    if (this.phase === 3) {
      if (!t.alive && this.targets.length < 3) {
        this.salvoKilled++;
        if (this.salvoKilled === 1) {
          this.salvoTimer = this.salvoLimit;
          this.salvoLeft = this.salvoLimit;
        }
      }
    }
    if (this.phase === 4) {
      // Appelé aussi quand la limite de temps expire (cible retirée sans kill).
      if (this.kills > this.coreKillsSeen) {
        this.coreKills++;
        this.coreKillsSeen = this.kills;
      }
      if (this.coreKills >= 3) {
        this.defeated = true;
        this.hp = 0;
        return;
      }
      this.coreDelay = 700;
    }
    this.hp = 1 - this.kills / this.total;
    if (this.targets.length === 0 && this.phase < 4) {
      this.phase++;
      this.attackSpeedMul += 0.1;
      this.spawnPhase();
      this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
    }
  }

  private coreKillsSeen = 0;

  protected tick(dt: number): void {
    if (this.game.frozen) {
      for (const t of this.targets) if (t.deadline > 0) t.deadline += dt * 1000;
      return;
    }
    if (this.phase === 3 && this.salvoTimer > 0) {
      this.salvoTimer -= dt * 1000;
      this.salvoLeft = Math.max(0, this.salvoTimer);
      if (this.salvoTimer <= 0 && this.targets.length > 0) {
        // Bouclier régénéré : les segments détruits reviennent.
        this.game.events.emit('bossPhase', { boss: this, phase: this.phase });
        this.spawnPhase();
      }
    }
    if (this.phase === 4 && this.targets.length === 0 && !this.defeated) {
      this.coreDelay -= dt * 1000;
      if (this.coreDelay <= 0) this.spawnCore();
    }
  }
}
