import { getLang, t } from '../i18n';
import type { Fact } from '../learning/types';

/** Lecture vocale via Web Speech (aucun fichier audio). Silencieux si l'API est absente. */
class Speech {
  enabled = false;

  private get synth(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  }

  speak(text: string, interrupt = true): void {
    const synth = this.synth;
    if (!this.enabled || !synth) return;
    try {
      if (interrupt) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = getLang() === 'fr' ? 'fr-FR' : 'en-US';
      u.rate = 0.95;
      u.pitch = 1.05;
      synth.speak(u);
    } catch {
      /* ignoré */
    }
  }

  fact(f: Fact): void {
    this.speak(t('speech.times', { a: f.a, b: f.b }));
  }

  answer(f: Fact): void {
    this.speak(t('speech.equals', { a: f.a, b: f.b, p: f.product }));
  }

  cancel(): void {
    try {
      this.synth?.cancel();
    } catch {
      /* ignoré */
    }
  }
}

export const speech = new Speech();
