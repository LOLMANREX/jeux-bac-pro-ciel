class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq = 440, duration = 0.08, type = 'sine', volume = 0.08) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  click() {
    this.playTone(620, 0.045, 'triangle', 0.06);
  }

  jump() {
    this.playTone(280, 0.06, 'sine', 0.05);
    setTimeout(() => this.playTone(420, 0.07, 'sine', 0.04), 35);
  }

  interact() {
    this.playTone(523.25, 0.07, 'sine', 0.07);
    setTimeout(() => this.playTone(659.25, 0.09, 'sine', 0.07), 55);
  }

  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.14, 'triangle', 0.08), idx * 75);
    });
  }

  error() {
    this.playTone(210, 0.14, 'sawtooth', 0.06);
    setTimeout(() => this.playTone(165, 0.18, 'sawtooth', 0.06), 110);
  }

  solderSizzle() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.18;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2600;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  alert() {
    this.playTone(880, 0.09, 'square', 0.045);
    setTimeout(() => this.playTone(660, 0.09, 'square', 0.045), 95);
  }

  _playClapGrain(delaySec = 0, bandFreq = 1350, volume = 0.045) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const startAt = ctx.currentTime + Math.max(0, delaySec);
    const dur = 0.055;
    const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 1.8);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(bandFreq, startAt);
    filter.Q.setValueAtTime(1.8, startAt);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startAt);
    src.stop(startAt + dur);
  }

  applaud() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    for (let i = 0; i < 10; i++) {
      const delay = i * 0.048 + (Math.random() * 0.018);
      const freq = 1050 + Math.random() * 850;
      this._playClapGrain(delay, freq, 0.045);
    }
    this.playTone(880, 0.09, 'triangle', 0.055);
    setTimeout(() => this.playTone(1174.66, 0.12, 'triangle', 0.06), 70);
  }

  celebrate20() {
    this.playAscensionFanfare('cyber');
  }

  playAscensionFanfare(specialty = 'cyber') {
    const baseShift =
      specialty === 'reseaux'
        ? 1.05
        : specialty === 'electronique'
          ? 1.12
          : specialty === 'systemes'
            ? 0.96
            : 1.0;
    const fanfare = [
      { f: 523.25 * baseShift, t: 0, d: 0.16 },
      { f: 659.25 * baseShift, t: 95, d: 0.16 },
      { f: 783.99 * baseShift, t: 190, d: 0.18 },
      { f: 1046.5 * baseShift, t: 300, d: 0.28 },
      { f: 783.99 * baseShift, t: 460, d: 0.14 },
      { f: 1046.5 * baseShift, t: 580, d: 0.36 },
      { f: 1318.5 * baseShift, t: 760, d: 0.42 },
      { f: 1567.98 * baseShift, t: 960, d: 0.55 }
    ];
    fanfare.forEach((n) => {
      setTimeout(() => {
        this.playTone(n.f, n.d, 'triangle', 0.085);
        this.playTone(n.f * 0.5, n.d, 'sine', 0.05);
      }, n.t);
    });
    const ctx = this._ensureCtx();
    if (!ctx) return;
    for (let i = 0; i < 38; i++) {
      const delay = 0.25 + i * 0.065 + (Math.random() * 0.03);
      const freq = 950 + Math.random() * 1100;
      const vol = 0.032 + Math.sin((i / 38) * Math.PI) * 0.028;
      this._playClapGrain(delay, freq, vol);
    }
  }
}

export const sfx = new SoundEngine();
