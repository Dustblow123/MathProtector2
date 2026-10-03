/**
 * Audio 100 % procédural (Web Audio) : aucun fichier son.
 * Effets synthétisés + musique générative dont le tempo suit l'intensité du jeu.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  sfxVolume = 0.8;
  musicVolume = 0.5;
  private musicOn = false;
  private nextBeat = 0;
  private beat = 0;
  private timer: number | null = null;
  intensity = 0.2;
  private chordIdx = 0;
  private unlocked = false;

  /** À appeler sur la première interaction utilisateur. */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.applyVolumes();
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.unlocked = true;
    } catch {
      this.ctx = null;
    }
    void this.ctx?.resume();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume * 0.6;
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private tone(freq: number, type: OscillatorType, dur: number, vol: number, dest: AudioNode | null = this.sfxGain, opts: { sweepTo?: number; attack?: number; detune?: number } = {}): void {
    if (!this.ctx || !dest) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.now);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.sweepTo) o.frequency.exponentialRampToValueAtTime(opts.sweepTo, this.now + dur);
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0, this.now);
    g.gain.linearRampToValueAtTime(vol, this.now + a);
    g.gain.exponentialRampToValueAtTime(0.001, this.now + dur);
    o.connect(g);
    g.connect(dest);
    o.start();
    o.stop(this.now + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFrom: number, filterTo: number, q = 1): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(filterFrom, this.now);
    f.frequency.exponentialRampToValueAtTime(filterTo, this.now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.now);
    g.gain.exponentialRampToValueAtTime(0.001, this.now + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start();
    src.stop(this.now + dur + 0.05);
  }

  // ------------------------------------------------------------ effets

  laser(): void {
    this.tone(880, 'sawtooth', 0.14, 0.18, this.sfxGain, { sweepTo: 220 });
    this.tone(1760, 'sine', 0.08, 0.08, this.sfxGain, { sweepTo: 440 });
  }

  fizzle(): void {
    this.tone(300, 'square', 0.18, 0.08, this.sfxGain, { sweepTo: 120 });
  }

  explosion(size = 1): void {
    this.noise(0.35 * size, 0.5, 2400, 120, 0.8);
    this.tone(120, 'sine', 0.25 * size, 0.25, this.sfxGain, { sweepTo: 40 });
  }

  impact(): void {
    this.noise(0.6, 0.7, 900, 60, 0.5);
    this.tone(70, 'sine', 0.6, 0.5, this.sfxGain, { sweepTo: 30 });
    this.tone(55, 'triangle', 0.5, 0.3, this.sfxGain, { detune: 10 });
  }

  shield(): void {
    this.tone(660, 'sine', 0.3, 0.15, this.sfxGain, { sweepTo: 990 });
    this.tone(330, 'triangle', 0.4, 0.1);
  }

  miss(): void {
    this.tone(220, 'square', 0.12, 0.07, this.sfxGain, { sweepTo: 180 });
    this.tone(165, 'square', 0.16, 0.06, this.sfxGain, { sweepTo: 140 });
  }

  combo(n: number): void {
    const f = 440 * Math.pow(2, Math.min(24, n) / 12);
    this.tone(f, 'sine', 0.12, 0.08);
  }

  powerupGain(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.22, 0.14), i * 70));
  }

  powerupUse(): void {
    this.tone(300, 'sawtooth', 0.4, 0.14, this.sfxGain, { sweepTo: 1200 });
    this.noise(0.3, 0.2, 400, 4000);
  }

  freeze(): void {
    this.tone(1200, 'sine', 0.6, 0.12, this.sfxGain, { sweepTo: 2400 });
    this.tone(1500, 'triangle', 0.8, 0.08, this.sfxGain, { sweepTo: 3000 });
  }

  bossRoar(): void {
    if (!this.ctx || !this.sfxGain) return;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 65;
    lfo.frequency.value = 7;
    lfoG.gain.value = 25;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    g.gain.setValueAtTime(0, this.now);
    g.gain.linearRampToValueAtTime(0.35, this.now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, this.now + 1.2);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start();
    lfo.start();
    o.stop(this.now + 1.3);
    lfo.stop(this.now + 1.3);
    this.noise(1, 0.3, 300, 80);
  }

  bossHit(): void {
    this.tone(200, 'square', 0.2, 0.15, this.sfxGain, { sweepTo: 90 });
    this.noise(0.25, 0.35, 1800, 200);
  }

  bossDefeated(): void {
    this.noise(1.4, 0.6, 3000, 60);
    [262, 330, 392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.5, 0.16), i * 110));
  }

  waveClear(): void {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.25, 0.12), i * 90));
  }

  victory(): void {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.6, 0.14), i * 130));
  }

  gameOver(): void {
    [440, 392, 349, 294].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.6, 0.14), i * 220));
  }

  click(): void {
    this.tone(900, 'sine', 0.06, 0.06, this.sfxGain, { sweepTo: 600 });
  }

  type(): void {
    this.tone(1300, 'sine', 0.04, 0.04);
  }

  stardust(): void {
    this.tone(1800, 'sine', 0.1, 0.05, this.sfxGain, { sweepTo: 2400 });
  }

  unlockJingle(): void {
    [659, 784, 988, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.35, 0.12), i * 100));
  }

  // ------------------------------------------------------------ musique générative

  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBeat = this.now + 0.1;
    this.beat = 0;
    this.schedule();
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    if (!this.musicOn || !this.ctx) return;
    const bpm = 96 + this.intensity * 48;
    const beatLen = 60 / bpm;
    while (this.nextBeat < this.now + 0.3) {
      this.playBeat(this.nextBeat, beatLen);
      this.nextBeat += beatLen / 2; // croches
      this.beat++;
    }
    this.timer = window.setTimeout(() => this.schedule(), 120);
  }

  private static readonly CHORDS = [
    [0, 3, 7, 10], // i7
    [5, 8, 12, 15], // iv7
    [3, 7, 10, 14], // III
    [7, 10, 14, 17], // v
  ];

  private playBeat(t: number, beatLen: number): void {
    if (!this.ctx || !this.musicGain) return;
    const root = 110; // La
    if (this.beat % 16 === 0) this.chordIdx = (this.chordIdx + 1) % AudioManager.CHORDS.length;
    const chord = AudioManager.CHORDS[this.chordIdx] ?? [0, 3, 7, 10];
    const semis = (n: number) => root * Math.pow(2, n / 12);
    const eighth = this.beat % 2;
    // Basse sur les temps
    if (eighth === 0) {
      const bass = semis((chord[0] ?? 0) - 12 + (this.beat % 8 === 6 ? 7 : 0));
      this.mtone(bass, 'triangle', t, beatLen * 0.9, 0.22);
    }
    // Arpège en croches, filtré
    const idx = Math.floor(this.beat / 1) % chord.length;
    const arp = semis((chord[idx] ?? 0) + 12);
    this.mtone(arp, 'square', t, beatLen * 0.45, 0.05 + this.intensity * 0.04, 1800 + this.intensity * 2500);
    // Nappe tous les 4 temps
    if (this.beat % 8 === 0) {
      for (const n of chord.slice(0, 3)) this.mtone(semis(n), 'sine', t, beatLen * 4, 0.05, 900, 0.3);
    }
    // Charley quand l'intensité monte
    if (this.intensity > 0.45 && this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(eighth === 0 ? 0.05 : 0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      src.start(t);
      src.stop(t + 0.06);
    }
  }

  private mtone(freq: number, type: OscillatorType, t: number, dur: number, vol: number, cutoff = 20000, attack = 0.01): void {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export const audio = new AudioManager();
