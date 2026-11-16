export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sinkStreamDest = null;
    this.sinkAudioEl = null;
    this.usingStreamSink = false;
    this.muted = false;
    this.sinkId = this._readSavedSinkId();
  }

  _readSavedSinkId() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('ciel_audio_output_id') || '' : '';
    } catch {
      return '';
    }
  }

  isSinkSelectionSupported() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx?.prototype && typeof AudioCtx.prototype.setSinkId === 'function') {
      return true;
    }
    if (typeof HTMLAudioElement !== 'undefined' && typeof HTMLAudioElement.prototype?.setSinkId === 'function') {
      return true;
    }
    return false;
  }

  getOutputDeviceId() {
    return this.sinkId;
  }

  _getOutputNode() {
    return this.masterGain || this.ctx?.destination || null;
  }

  async _applySinkToContext(targetId = '') {
    if (!this.ctx) {
      return { supported: this.isSinkSelectionSupported(), applied: false, deferred: true };
    }
    const cleanId = String(targetId || '');
    if (typeof this.ctx.setSinkId === 'function') {
      try {
        await this.ctx.setSinkId(cleanId);
        return { supported: true, applied: true, deviceId: cleanId };
      } catch (err) {
        if (cleanId) {
          try {
            await this.ctx.setSinkId('');
          } catch {}
        }
        return {
          supported: true,
          applied: false,
          error: err?.name || 'SinkError',
          deviceId: ''
        };
      }
    }

    if (typeof document !== 'undefined' && typeof this.ctx.createMediaStreamDestination === 'function') {
      if (!this.sinkAudioEl) {
        const el = document.createElement('audio');
        el.autoplay = true;
        el.playsInline = true;
        this.sinkAudioEl = el;
      }
      if (typeof this.sinkAudioEl.setSinkId === 'function') {
        if (!cleanId) {
          if (this.usingStreamSink && this.masterGain) {
            try {
              this.masterGain.disconnect();
            } catch {}
            this.masterGain.connect(this.ctx.destination);
            this.usingStreamSink = false;
          }
          try {
            this.sinkAudioEl.pause?.();
          } catch {}
          return { supported: true, applied: true, deviceId: '' };
        }
        try {
          if (!this.sinkStreamDest) {
            this.sinkStreamDest = this.ctx.createMediaStreamDestination();
          }
          if (this.masterGain && !this.usingStreamSink) {
            try {
              this.masterGain.disconnect();
            } catch {}
            this.masterGain.connect(this.sinkStreamDest);
            this.usingStreamSink = true;
          }
          this.sinkAudioEl.srcObject = this.sinkStreamDest.stream;
          await this.sinkAudioEl.setSinkId(cleanId);
          this.sinkAudioEl.play?.().catch(() => {});
          return { supported: true, applied: true, deviceId: cleanId };
        } catch (err) {
          if (this.usingStreamSink && this.masterGain) {
            try {
              this.masterGain.disconnect();
            } catch {}
            this.masterGain.connect(this.ctx.destination);
            this.usingStreamSink = false;
          }
          return {
            supported: true,
            applied: false,
            error: err?.name || 'SinkError',
            deviceId: ''
          };
        }
      }
    }

    return { supported: false, applied: false, deviceId: '' };
  }

  async setOutputDevice(deviceId = '') {
    this.sinkId = String(deviceId || '');
    return this._applySinkToContext(this.sinkId);
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        if (this.sinkId) {
          this._applySinkToContext(this.sinkId).catch(() => {});
        }
      }
    }
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
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

  playTone(freq = 440, duration = 0.08, type = 'sine', volume = 0.08, delaySec = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const safeFreq = Number.isFinite(Number(freq)) ? Math.max(40, Math.min(8000, Number(freq))) : 440;
    const safeDur = Number.isFinite(Number(duration)) ? Math.max(0.015, Math.min(2.5, Number(duration))) : 0.08;
    const safeVol = Number.isFinite(Number(volume)) ? Math.max(0.002, Math.min(0.4, Number(volume))) : 0.08;
    const startAt = ctx.currentTime + Math.max(0, Number(delaySec) || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(safeFreq, startAt);
    gain.gain.setValueAtTime(safeVol, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + safeDur);
    osc.connect(gain);
    gain.connect(this._getOutputNode());
    osc.start(startAt);
    osc.stop(startAt + safeDur);
  }

  click() {
    this.playTone(620, 0.045, 'triangle', 0.06);
  }

  snap() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(820, 0.04, 'triangle', 0.07, 0);
    this.playTone(1180, 0.05, 'sine', 0.06, 0.028);
  }

  xlrPlug() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(195, 0.05, 'triangle', 0.075, 0);
    this.playTone(940, 0.045, 'sine', 0.065, 0.025);
    this.playTone(1320, 0.06, 'triangle', 0.07, 0.055);
  }

  dmxAddressBeep(ok = true) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (ok) {
      this.playTone(987.77, 0.05, 'sine', 0.065, 0);
      this.playTone(1318.51, 0.075, 'triangle', 0.07, 0.045);
    } else {
      this.playTone(740, 0.045, 'sine', 0.055, 0);
    }
  }

  faderTick(ratio = 0.5) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    this.playTone(320 + clamped * 480, 0.025, 'sine', 0.035, 0);
  }

  phantomPowerTone(enabled = true) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (enabled) {
      this.playTone(330, 0.06, 'sine', 0.06, 0);
      this.playTone(554.37, 0.07, 'sine', 0.065, 0.045);
      this.playTone(880, 0.09, 'triangle', 0.07, 0.095);
    } else {
      this.playTone(660, 0.06, 'sine', 0.055, 0);
      this.playTone(330, 0.08, 'triangle', 0.05, 0.05);
    }
  }

  atemCut() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(740, 0.045, 'square', 0.05, 0);
    this.playTone(1046.5, 0.075, 'triangle', 0.075, 0.035);
  }

  audioTestTone(db = -12) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const safeDb = Number.isFinite(Number(db)) ? Number(db) : -12;
    const inZone = safeDb >= -14.5 && safeDb <= -9.5;
    if (inZone) {
      this.playTone(1000, 0.12, 'sine', 0.07, 0);
      this.playTone(1250, 0.1, 'sine', 0.06, 0.11);
    } else {
      this.playTone(440, 0.12, 'sawtooth', 0.05, 0);
    }
  }

  sdiPatch() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(680, 0.04, 'triangle', 0.065, 0);
    this.playTone(1020, 0.055, 'sine', 0.07, 0.035);
  }

  cableSelect() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(540, 0.04, 'sine', 0.055, 0);
    this.playTone(760, 0.04, 'triangle', 0.05, 0.025);
  }

  stageComplete() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(587.33, 0.08, 'triangle', 0.065, 0);
    this.playTone(880, 0.12, 'sine', 0.075, 0.07);
  }

  jump() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(280, 0.06, 'sine', 0.05, 0);
    this.playTone(420, 0.07, 'sine', 0.04, 0.035);
  }

  interact() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(523.25, 0.07, 'sine', 0.07, 0);
    this.playTone(659.25, 0.09, 'sine', 0.07, 0.055);
  }

  success() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.14, 'triangle', 0.08, idx * 0.075);
    });
  }

  error() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(210, 0.14, 'sawtooth', 0.06, 0);
    this.playTone(165, 0.18, 'sawtooth', 0.06, 0.11);
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
    gain.connect(this._getOutputNode());
    noise.start();
  }

  alert() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(880, 0.09, 'square', 0.045, 0);
    this.playTone(660, 0.09, 'square', 0.045, 0.095);
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
    gain.connect(this._getOutputNode());
    src.start(startAt);
    src.stop(startAt + dur);
  }

  applaud() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    for (let i = 0; i < 10; i++) {
      const delay = i * 0.048 + Math.random() * 0.018;
      const freq = 1050 + Math.random() * 850;
      this._playClapGrain(delay, freq, 0.045);
    }
    this.playTone(880, 0.09, 'triangle', 0.055, 0);
    this.playTone(1174.66, 0.12, 'triangle', 0.06, 0.07);
  }

  celebrate20() {
    this.playAscensionFanfare('cyber');
  }

  playAscensionFanfare(specialty = 'cyber') {
    const ctx = this._ensureCtx();
    if (!ctx) return;
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
      { f: 659.25 * baseShift, t: 0.095, d: 0.16 },
      { f: 783.99 * baseShift, t: 0.19, d: 0.18 },
      { f: 1046.5 * baseShift, t: 0.3, d: 0.28 },
      { f: 783.99 * baseShift, t: 0.46, d: 0.14 },
      { f: 1046.5 * baseShift, t: 0.58, d: 0.36 },
      { f: 1318.5 * baseShift, t: 0.76, d: 0.42 },
      { f: 1567.98 * baseShift, t: 0.96, d: 0.55 }
    ];
    fanfare.forEach((n) => {
      this.playTone(n.f, n.d, 'triangle', 0.085, n.t);
      this.playTone(n.f * 0.5, n.d, 'sine', 0.05, n.t);
    });
    for (let i = 0; i < 38; i++) {
      const delay = 0.25 + i * 0.065 + Math.random() * 0.03;
      const freq = 950 + Math.random() * 1100;
      const vol = 0.032 + Math.sin((i / 38) * Math.PI) * 0.028;
      this._playClapGrain(delay, freq, vol);
    }
  }

  playIntroChime() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      this.playTone(freq, 0.24, 'triangle', 0.065, idx * 0.07);
    });
  }

  playSecretUnlockFanfare() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const notes = [
      { f: 523.25, t: 0, d: 0.2 },
      { f: 659.25, t: 0.08, d: 0.22 },
      { f: 783.99, t: 0.16, d: 0.24 },
      { f: 987.77, t: 0.25, d: 0.28 },
      { f: 1174.66, t: 0.36, d: 0.35 },
      { f: 1567.98, t: 0.5, d: 0.55 },
      { f: 2093.0, t: 0.68, d: 0.72 }
    ];
    notes.forEach((n) => {
      this.playTone(n.f, n.d, 'triangle', 0.09, n.t);
      this.playTone(n.f * 0.5, n.d, 'sine', 0.055, n.t);
    });
  }
}

export const sfx = new SoundEngine();
