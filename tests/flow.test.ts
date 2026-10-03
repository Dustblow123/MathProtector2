import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { FlowController, flowParams } from '../src/learning/flow';

describe('FlowController', () => {
  it('monte en intensité pour un joueur fort et descend pour un joueur en difficulté', () => {
    const strong = new FlowController({ fluentMs: 4000, initial: 0.3 });
    for (let w = 0; w < 10; w++) {
      for (let i = 0; i < 12; i++) strong.recordOutcome(true, 1200);
      strong.endWave();
    }
    expect(strong.intensity).toBeGreaterThan(0.6);

    const weak = new FlowController({ fluentMs: 4000, initial: 0.5 });
    for (let w = 0; w < 10; w++) {
      for (let i = 0; i < 12; i++) weak.recordOutcome(i % 2 === 0, 5000);
      weak.endWave();
    }
    expect(weak.intensity).toBeLessThan(0.2);
  });

  it("converge vers une zone stable pour un joueur simulé dont la réussite dépend de l'intensité", () => {
    const rng = new Rng(5);
    const flow = new FlowController({ fluentMs: 4000, initial: 0.1 });
    const history: number[] = [];
    for (let w = 0; w < 60; w++) {
      for (let i = 0; i < 12; i++) {
        // Le joueur réussit à 97 % quand c'est facile, 60 % quand c'est très dur.
        const pSuccess = 0.97 - flow.intensity * 0.37;
        flow.recordOutcome(rng.chance(pSuccess), 1500 + flow.intensity * 2500);
      }
      history.push(flow.endWave());
    }
    const tail = history.slice(-20);
    const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
    expect(mean).toBeGreaterThan(0.25);
    expect(mean).toBeLessThan(0.75);
    const spread = Math.max(...tail) - Math.min(...tail);
    expect(spread).toBeLessThan(0.35);
  });

  it('respecte les bornes', () => {
    const f = new FlowController({ fluentMs: 4000, initial: 0.9, max: 0.5 });
    expect(f.intensity).toBe(0.5);
    const p = flowParams(1);
    expect(p.maxOnScreen).toBe(4);
    expect(flowParams(0).maxOnScreen).toBe(1);
  });
});
