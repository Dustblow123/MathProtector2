import { t } from '../i18n';
import { h } from './dom';

export interface NumpadHandlers {
  onDigit: (d: number) => void;
  onBackspace: () => void;
  onConfirm: () => void;
}

/** Pavé numérique tactile réutilisable (jeu et mini-drill). */
export function createNumpad(handlers: NumpadHandlers, opts: { hidden?: boolean; confirmLabel?: string } = {}): HTMLElement {
  const pad = h('div', { class: `numpad ${opts.hidden ? 'hidden' : ''}` });
  const key = (label: string, onPress: () => void, cls = '') =>
    h('button', { class: cls, type: 'button', onPointerdown: (e: Event) => { e.preventDefault(); onPress(); } }, label);
  // Disposition 4 colonnes : 1 2 3 ⌫ / 4 5 6 0 / 7 8 9 Tir (la CSS passe en 3 colonnes sur grand écran).
  const order: (number | 'del' | 'zero' | 'fire')[] = [1, 2, 3, 'del', 4, 5, 6, 'zero', 7, 8, 9, 'fire'];
  for (const k of order) {
    if (k === 'del') pad.appendChild(key(t('numpad.del'), handlers.onBackspace, 'del'));
    else if (k === 'zero') pad.appendChild(key('0', () => handlers.onDigit(0)));
    else if (k === 'fire') pad.appendChild(key(opts.confirmLabel ?? t('numpad.fire'), handlers.onConfirm, 'fire'));
    else pad.appendChild(key(String(k), () => handlers.onDigit(k)));
  }
  return pad;
}
