import { t } from '../i18n';
import type { Strategy, StrategyStep } from '../learning/strategies';

/** Titre de la méthode (clé i18n par type de stratégie). */
export function strategyTitle(s: Strategy): string {
  return t(`strategy.${s.kind}` as 'strategy.identity');
}

function stepText(step: StrategyStep): string {
  return t(`strategy.step.${step.key}` as 'strategy.step.times', step.params);
}

/** Lignes des étapes, prêtes à afficher ou à lire. */
export function strategyLines(s: Strategy): string[] {
  return s.steps.map(stepText);
}
