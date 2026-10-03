import { TAU } from '../core/math';
import type { Fact } from '../learning/types';

/**
 * Indice visuel : grille de points a × b (groupes de 5 séparés) ou, pour les petits
 * facteurs, ligne numérique avec sauts de b. Dessiné centré en (cx, cy) dans w × h.
 */
export function drawVisualHint(c: CanvasRenderingContext2D, f: Fact, cx: number, cy: number, w: number, h: number): void {
  const useLine = f.a <= 3 || f.b === 1;
  if (useLine) drawNumberLine(c, f, cx, cy, w);
  else drawDotGrid(c, f, cx, cy, w, h);
}

function drawDotGrid(c: CanvasRenderingContext2D, f: Fact, cx: number, cy: number, w: number, h: number): void {
  const rows = f.a;
  const cols = f.b;
  const gapGroups = (n: number) => Math.floor((n - 1) / 5);
  const cell = Math.min(w / (cols + gapGroups(cols) * 0.6), h / (rows + gapGroups(rows) * 0.6), 14);
  const totalW = cols * cell + gapGroups(cols) * cell * 0.6;
  const totalH = rows * cell + gapGroups(rows) * cell * 0.6;
  const x0 = cx - totalW / 2 + cell / 2;
  const y0 = cy - totalH / 2 + cell / 2;
  c.fillStyle = '#38e8ff';
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = x0 + k * cell + Math.floor(k / 5) * cell * 0.6;
      const y = y0 + r * cell + Math.floor(r / 5) * cell * 0.6;
      c.globalAlpha = (r + k) % 2 === 0 ? 1 : 0.8;
      c.beginPath();
      c.arc(x, y, cell * 0.32, 0, TAU);
      c.fill();
    }
  }
  c.globalAlpha = 1;
  c.fillStyle = '#9fb3d9';
  c.font = '700 12px Nunito, system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`${rows} × ${cols}`, cx, cy + totalH / 2 + 12);
}

function drawNumberLine(c: CanvasRenderingContext2D, f: Fact, cx: number, cy: number, w: number): void {
  const jumps = f.a;
  const step = f.b;
  const max = jumps * step;
  const x0 = cx - w / 2 + 10;
  const x1 = cx + w / 2 - 10;
  const px = (v: number) => x0 + ((x1 - x0) * v) / Math.max(1, max);
  c.strokeStyle = '#9fb3d9';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x0, cy + 10);
  c.lineTo(x1, cy + 10);
  c.stroke();
  c.strokeStyle = '#38e8ff';
  c.fillStyle = '#38e8ff';
  c.font = '700 12px Nunito, system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'top';
  for (let i = 0; i <= jumps; i++) {
    const v = i * step;
    const x = px(v);
    c.beginPath();
    c.arc(x, cy + 10, 3.5, 0, TAU);
    c.fill();
    c.fillStyle = '#eaf2ff';
    c.fillText(String(v), x, cy + 16);
    c.fillStyle = '#38e8ff';
    if (i < jumps) {
      c.beginPath();
      c.arc((x + px(v + step)) / 2, cy + 10, (px(v + step) - x) / 2, Math.PI, 0);
      c.stroke();
    }
  }
}
