/** Boucle de jeu à pas fixe (simulation) et rendu interpolé via requestAnimationFrame. */
export class GameLoop {
  readonly step = 1 / 60;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  /** Facteur de temps (0.3 = ralenti, 1 = normal). */
  timeScale = 1;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number, dt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25; // onglet inactif : on ne rattrape pas tout le temps perdu
      this.acc += dt * this.timeScale;
      let guard = 0;
      while (this.acc >= this.step && guard++ < 8) {
        this.update(this.step);
        this.acc -= this.step;
      }
      this.render(this.acc / this.step, dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
