import { t } from '../i18n';
import { factLabel } from '../learning/facts';
import type { ErrorAnalysis, Fact } from '../learning/types';

/** Message pédagogique court après une mauvaise réponse (vide si rien d'utile à dire). */
export function confusionMessage(fact: Fact, analysis: ErrorAnalysis | undefined, answer: number): string {
  if (!analysis) return '';
  if (analysis.kind === 'addition') return t('game.addition', { answer, a: fact.a, b: fact.b });
  if (analysis.kind === 'digit-swap') return t('game.digitSwap', { product: fact.answer });
  if (analysis.kind === 'divisor-echo') return t('game.divisorEcho', { answer, a: fact.a, p: fact.product });
  if (analysis.confusedWith) return t('game.confusedWith', { answer, fact: factLabel(analysis.confusedWith) });
  return '';
}
