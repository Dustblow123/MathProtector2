/** Effets d'écran : secousse, flash coloré, ralenti, vignette. */
export class ScreenEffects {
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  flashColor = '#ffffff';
  flashAlpha = 0;
  slowMo = 0;
  private seed = 0;

  addShake(amount: number): void {
    this.shake = Math.min(28, this.shake + amount);
  }

  flash(color: string, alpha: number): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  triggerSlowMo(seconds: number): void {
    this.slowMo = Math.max(this.slowMo, seconds);
  }

  update(dt: number, reducedMotion: boolean): number {
    if (reducedMotion) {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    } else {
      this.shake = Math.max(0, this.shake - dt * 40);
      this.seed += dt * 60;
      this.shakeX = Math.sin(this.seed * 1.7) * this.shake;
      this.shakeY = Math.cos(this.seed * 2.3) * this.shake;
    }
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    this.slowMo = Math.max(0, this.slowMo - dt);
    return this.slowMo > 0 ? 0.35 : 1;
  }

  drawOverlay(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.flashAlpha > 0) {
      c.globalAlpha = this.flashAlpha;
      c.fillStyle = this.flashColor;
      c.fillRect(x, y, w, h);
      c.globalAlpha = 1;
    }
  }
}
