import { TAU } from '../core/math';
import type { Strategy } from '../learning/strategies';

const COLORS = { main: '#38e8ff', alt: '#ffd166', minus: '#ff5d73', ghost: 'rgba(159,179,217,0.35)' } as const;

/** Visuel de décomposition : grille de `a` rangées dont les colonnes sont colorées par partie. */
export function drawStrategyVisual(c: CanvasRenderingContext2D, s: Strategy, w: number, h: number): void {
  c.clearRect(0, 0, w, h);
  const rows = s.a;
  const cols = s.parts.reduce((n, p) => n + p.cols, 0);
  const groups = Math.max(0, s.parts.length - 1);
  const cell = Math.min((w - 40) / (cols + groups * 0.8), (h - 40) / rows, 18);
  const totalW = cols * cell + groups * cell * 0.8;
  const totalH = rows * cell;
  const x0 = (w - totalW) / 2 + cell / 2;
  const y0 = (h - totalH) / 2 + cell / 2 - 6;
  let col = 0;
  let gx = 0;
  s.parts.forEach((part, pi) => {
    const color = COLORS[part.color];
    const startX = x0 + col * cell + gx;
    for (let k = 0; k < part.cols; k++) {
      for (let r = 0; r < rows; r++) {
        const x = startX + k * cell;
        const y = y0 + r * cell;
        c.fillStyle = color;
        c.beginPath();
        c.arc(x, y, cell * 0.34, 0, TAU);
        c.fill();
        if (part.color === 'minus') {
          c.strokeStyle = '#ff5d73';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x - cell * 0.4, y - cell * 0.4);
          c.lineTo(x + cell * 0.4, y + cell * 0.4);
          c.stroke();
        }
      }
    }
    // Étiquette sous chaque partie
    const label = part.color === 'ghost' ? '' : `${rows} × ${part.cols} = ${rows * part.cols}`;
    if (label) {
      c.fillStyle = color;
      c.font = '800 13px Nunito, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText(label, startX + ((part.cols - 1) * cell) / 2, y0 + totalH - cell / 2 + 8);
    }
    col += part.cols;
    if (pi < s.parts.length - 1) gx += cell * 0.8;
  });
}
