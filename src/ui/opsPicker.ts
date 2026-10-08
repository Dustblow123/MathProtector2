import { t } from '../i18n';
import type { OpChoice } from '../learning/types';
import { clear, h } from './dom';

export const OP_CHOICES: OpChoice[] = ['mul', 'div', 'mixed'];

/** Symbole court pour les titres de partie : × / ÷ / × ÷. */
export function opsSymbol(ops: OpChoice): string {
  return ops === 'mul' ? '×' : ops === 'div' ? '÷' : '× ÷';
}

/** Suffixe de titre : vide en multiplication seule (comportement historique), « · ÷ » sinon. */
export function opsTitleSuffix(ops: OpChoice): string {
  return ops === 'mul' ? '' : ` · ${opsSymbol(ops)}`;
}

/** Sélecteur × / ÷ / les deux affiché avant de lancer une partie. */
export function createOpsPicker(current: OpChoice, onChange: (v: OpChoice) => void): HTMLElement {
  let value = current;
  const box = h('div', { class: 'seg ops-picker', role: 'group', 'aria-label': t('ops.title') });
  const render = () => {
    clear(box);
    for (const o of OP_CHOICES) {
      box.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: o === value ? 'sel' : '',
            title: t(`ops.${o}.desc` as 'ops.mul.desc'),
            onClick: () => {
              value = o;
              render();
              onChange(o);
            },
          },
          `${opsSymbol(o)} ${t(`ops.${o}` as 'ops.mul')}`,
        ),
      );
    }
  };
  render();
  return box;
}
