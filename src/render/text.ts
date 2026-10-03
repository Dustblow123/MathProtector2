export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  bold: boolean;
}

export class FloatingTexts {
  items: FloatingText[] = [];

  add(text: string, x: number, y: number, color: string, size = 26, life = 1.4, bold = true): void {
    this.items.push({ text, x, y, vy: -38, life, maxLife: life, color, size, bold });
    if (this.items.length > 40) this.items.shift();
  }

  update(dt: number): void {
    for (const t of this.items) {
      t.y += t.vy * dt;
      t.vy *= 0.97;
      t.life -= dt;
    }
    this.items = this.items.filter((t) => t.life > 0);
  }

  draw(c: CanvasRenderingContext2D): void {
    for (const t of this.items) {
      const p = t.life / t.maxLife;
      const alpha = p < 0.3 ? p / 0.3 : 1;
      const pop = p > 0.85 ? 1 + (1 - (1 - p) / 0.15) * 0.35 : 1;
      c.globalAlpha = alpha;
      c.font = `${t.bold ? '800' : '600'} ${Math.round(t.size * pop)}px Nunito, system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 5;
      c.strokeStyle = 'rgba(5,8,26,0.85)';
      c.lineJoin = 'round';
      c.strokeText(t.text, t.x, t.y);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
  }
}

/** Texte avec contour sombre pour rester lisible sur n'importe quel fond. */
export function outlinedText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = '800', font = 'Nunito'): void {
  c.font = `${weight} ${size}px ${font}, system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size * 0.18);
  c.strokeStyle = 'rgba(5,8,26,0.9)';
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}
