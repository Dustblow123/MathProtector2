/**
 * Contrôleur de difficulté ("flow") : ajuste une intensité 0..1 pour maintenir
 * le joueur autour de 80–85 % de réussite avec un temps de réponse fluide.
 */
export interface FlowParams {
  /** Vitesse de chute en unités monde par seconde. */
  fallSpeed: number;
  /** Intervalle entre deux apparitions (ms). */
  spawnInterval: number;
  /** Nombre maximal d'astéroïdes simultanés. */
  maxOnScreen: number;
  /** Probabilité qu'un astéroïde soit spécial (feu, glace, cristal, fissuré). */
  specialChance: number;
}

export interface FlowOptions {
  fluentMs: number;
  min?: number;
  max?: number;
  initial?: number;
  targetAccuracy?: number; // 0.82 par défaut
  step?: number; // 0.05 par défaut
}

export class FlowController {
  intensity: number;
  readonly min: number;
  readonly max: number;
  private readonly fluentMs: number;
  private readonly target: number;
  private readonly step: number;
  private outcomes: { correct: boolean; rt: number }[] = [];

  constructor(opts: FlowOptions) {
    this.fluentMs = opts.fluentMs;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.target = opts.targetAccuracy ?? 0.82;
    this.step = opts.step ?? 0.05;
    this.intensity = clamp(opts.initial ?? 0.15, this.min, this.max);
  }

  recordOutcome(correct: boolean, rt: number): void {
    this.outcomes.push({ correct, rt });
    if (this.outcomes.length > 12) this.outcomes.shift();
  }

  get accuracy(): number {
    if (this.outcomes.length === 0) return this.target;
    return this.outcomes.filter((o) => o.correct).length / this.outcomes.length;
  }

  get medianRt(): number {
    const rts = this.outcomes.filter((o) => o.correct).map((o) => o.rt).sort((a, b) => a - b);
    if (rts.length === 0) return this.fluentMs;
    return rts[Math.floor(rts.length / 2)] ?? this.fluentMs;
  }

  /** À appeler à la fin de chaque vague : une seule marche d'ajustement par vague, pour rester stable. */
  endWave(): number {
    if (this.outcomes.length >= 4) {
      const acc = this.accuracy;
      const fast = this.medianRt <= this.fluentMs;
      if (acc >= this.target + 0.08 && fast) this.intensity += this.step;
      else if (acc >= this.target + 0.08) this.intensity += this.step * 0.5;
      else if (acc < this.target - 0.12) this.intensity -= this.step * 1.5;
      else if (acc < this.target - 0.04) this.intensity -= this.step;
    }
    this.intensity = clamp(this.intensity, this.min, this.max);
    return this.intensity;
  }

  /** Réaction immédiate à un impact sur la Terre : on relâche un peu la pression. */
  onEarthHit(): void {
    this.intensity = clamp(this.intensity - this.step * 0.5, this.min, this.max);
  }

  params(): FlowParams {
    return flowParams(this.intensity);
  }
}

export function flowParams(intensity: number): FlowParams {
  const i = clamp(intensity, 0, 1);
  return {
    fallSpeed: 28 + i * 72, // 28 → 100 unités/s (monde 720 de haut : 25 s → 7 s de chute)
    spawnInterval: 5200 - i * 3600, // 5.2 s → 1.6 s
    maxOnScreen: 1 + Math.round(i * 3), // 1 → 4
    specialChance: 0.08 + i * 0.2,
  };
}


function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
