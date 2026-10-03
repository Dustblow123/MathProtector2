import { describe, expect, it } from 'vitest';
import { createProfile } from '../src/data/profile';
import { SAVE_VERSION, exportProfile, importProfile, migrate, normalizeProfile } from '../src/data/storage';

describe('storage', () => {
  it('migre une sauvegarde vide ou corrompue', () => {
    expect(migrate(null).version).toBe(SAVE_VERSION);
    expect(migrate('x').profiles).toEqual([]);
    const m = migrate({ version: 0, profiles: [{ name: 'Léa' }] });
    expect(m.profiles[0]!.name).toBe('Léa');
    expect(m.profiles[0]!.equipped.cannon).toBe('cannon_classic');
    expect(m.settings.autoFire).toBe(true);
  });

  it('normalise un profil partiel sans perdre les données', () => {
    const p = normalizeProfile({ name: 'Tom', xp: 500, facts: { '7x8': { id: '7x8', pKnown: 0.9, stability: 3, lastReview: 1, reps: 4, lapses: 0, rtEma: 2000, recent: [], streak: 4 } } });
    expect(p.xp).toBe(500);
    expect(p.facts['7x8']?.pKnown).toBe(0.9);
    expect(p.stats.sessions).toBe(0);
  });

  it('exporte puis importe un profil (nouvel id)', () => {
    const p = createProfile('Zoé', '🚀');
    p.stardust = 42;
    const json = exportProfile(p);
    const q = importProfile(json);
    expect(q.name).toBe('Zoé');
    expect(q.stardust).toBe(42);
    expect(q.id).not.toBe(p.id);
    expect(() => importProfile('{"foo":1}')).toThrow();
  });
});
