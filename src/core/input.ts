import { Emitter } from './events';

export type InputEvents = {
  digit: number;
  backspace: void;
  confirm: void;
  cancel: void;
  cycleTarget: void;
  powerup: number; // index 0..2
  pause: void;
  help: void;
};

/** Saisie clavier unifiée (le pavé numérique DOM appelle les mêmes méthodes). */
export class Input extends Emitter<InputEvents> {
  enabled = true;
  private readonly onKey = (e: KeyboardEvent) => this.handle(e);

  attach(): void {
    window.addEventListener('keydown', this.onKey);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private handle(e: KeyboardEvent): void {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k >= '0' && k <= '9') {
      e.preventDefault();
      this.emit('digit', Number(k));
    } else if (k === 'Backspace') {
      e.preventDefault();
      this.emit('backspace', undefined);
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      this.emit('confirm', undefined);
    } else if (k === 'Escape') {
      e.preventDefault();
      this.emit('pause', undefined);
    } else if (k === 'Tab') {
      e.preventDefault();
      this.emit('cycleTarget', undefined);
    } else if (k === 'F1' || k === 'F2' || k === 'F3') {
      e.preventDefault();
      this.emit('powerup', Number(k.slice(1)) - 1);
    } else if (k === 'h' || k === 'H' || k === '?') {
      e.preventDefault();
      this.emit('help', undefined);
    } else if (k === 'Delete') {
      e.preventDefault();
      this.emit('cancel', undefined);
    }
  }
}
