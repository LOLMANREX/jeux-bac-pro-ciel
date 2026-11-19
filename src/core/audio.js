export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sinkStreamDest = null;
    this.sinkAudioEl = null;
    this.usingStreamSink = false;
    this.muted = false;
    this.volume = 0.8;
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

  setVolume(vol = 0.8) {
    const n = Number(vol);
    this.volume = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8;
    if (this.volume <= 0.001) {
      this.muted = true;
    } else if (this.muted && n > 0.01) {
      this.muted = false;
    }
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      } catch {}
    }
    return this.volume;
  }

  getVolume() {
    return this.muted ? 0 : this.volume;
  }

  playTone(freq = 440, duration = 0.08, type = 'sine', volume = 0.08, delaySec = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const volScale = Number.isFinite(this.volume) ? Math.max(0, Math.min(1, this.volume)) : 0.8;
    if (volScale <= 0.001) return;
    const safeFreq = Number.isFinite(Number(freq)) ? Math.max(40, Math.min(8000, Number(freq))) : 440;
    const safeDur = Number.isFinite(Number(duration)) ? Math.max(0.015, Math.min(2.5, Number(duration))) : 0.08;
    const rawVol = Number.isFinite(Number(volume)) ? Math.max(0.002, Math.min(0.4, Number(volume))) : 0.08;
    const safeVol = Math.max(0.0015, rawVol * volScale);
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

  perfect20() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const notes = [
      { f: 523.25, t: 0, d: 0.14 },
      { f: 659.25, t: 0.08, d: 0.14 },
      { f: 783.99, t: 0.16, d: 0.16 },
      { f: 1046.5, t: 0.25, d: 0.26 },
      { f: 1318.51, t: 0.36, d: 0.38 },
      { f: 1567.98, t: 0.48, d: 0.48 }
    ];
    notes.forEach((n) => {
      this.playTone(n.f, n.d, 'triangle', 0.085, n.t);
      this.playTone(n.f * 0.5, n.d, 'sine', 0.045, n.t);
    });
    for (let i = 0; i < 12; i++) {
      this._playClapGrain(0.24 + i * 0.052, 1100 + Math.random() * 800, 0.036);
    }
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

  startHorrorAmbience() {
    const ctx = this._ensureCtx();
    if (!ctx || this._horrorAmbience) return false;
    try {
      const droneA = ctx.createOscillator();
      const droneB = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const master = ctx.createGain();

      droneA.type = 'sawtooth';
      droneA.frequency.value = 46;
      droneB.type = 'triangle';
      droneB.frequency.value = 51.5;

      lfo.type = 'sine';
      lfo.frequency.value = 0.28;
      lfoGain.gain.value = 65;

      filter.type = 'lowpass';
      filter.frequency.value = 150;
      filter.Q.value = 3.5;

      master.gain.value = 0.032;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      droneA.connect(filter);
      droneB.connect(filter);
      filter.connect(master);
      master.connect(this._getOutputNode());

      droneA.start();
      droneB.start();
      lfo.start();
      this._horrorAmbience = { droneA, droneB, lfo, lfoGain, filter, master };
      return true;
    } catch {
      return false;
    }
  }

  stopHorrorAmbience() {
    if (!this._horrorAmbience) return;
    const amb = this._horrorAmbience;
    this._horrorAmbience = null;
    try {
      amb.droneA?.stop?.();
      amb.droneB?.stop?.();
      amb.lfo?.stop?.();
      amb.master?.disconnect?.();
    } catch {}
  }

  playHeavyFootstep(distance = 8, maxRange = 20) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const dist = Math.max(0.5, Number(distance) || 8);
    if (dist > maxRange) return;
    const scale = Math.pow(Math.max(0, 1 - dist / maxRange), 1.4);
    const vol = Math.max(0.015, Math.min(0.28, scale * 0.24));
    const startAt = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, startAt);
    osc.frequency.exponentialRampToValueAtTime(34, startAt + 0.16);
    gain.gain.setValueAtTime(vol, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.18);
    osc.connect(gain);
    gain.connect(this._getOutputNode());
    osc.start(startAt);
    osc.stop(startAt + 0.19);
  }

  playHorrorHeartbeat(intensity = 0.5) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const vol = Math.max(0.02, Math.min(0.24, 0.05 + Number(intensity || 0) * 0.18));
    this.playTone(62, 0.09, 'sine', vol, 0);
    this.playTone(54, 0.11, 'sine', vol * 0.85, 0.14);
  }

  playHorrorAlert() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(290, 0.16, 'sawtooth', 0.08, 0);
    this.playTone(415, 0.22, 'sawtooth', 0.09, 0.05);
    this.playTone(155, 0.32, 'square', 0.07, 0.11);
  }

  playJumpscareSound() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(95, 0.55, 'sawtooth', 0.24, 0);
    this.playTone(485, 0.42, 'square', 0.18, 0);
    this.playTone(730, 0.36, 'sawtooth', 0.16, 0.04);
    this.playTone(1180, 0.28, 'sawtooth', 0.12, 0.08);
    try {
      const len = Math.max(128, Math.floor(ctx.sampleRate * 0.42));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.65);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.18;
      src.connect(gain);
      gain.connect(this._getOutputNode());
      src.start();
    } catch {}
  }

  playLockerDoorSound(entering = true) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (entering) {
      this.playTone(185, 0.08, 'triangle', 0.09, 0);
      this.playTone(120, 0.12, 'square', 0.05, 0.05);
    } else {
      this.playTone(140, 0.07, 'square', 0.05, 0);
      this.playTone(230, 0.09, 'triangle', 0.08, 0.04);
    }
  }

  playHorrorVictory() {
    this.playAscensionFanfare('cyber');
  }

  playHorrorDefeat() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(196, 0.35, 'sawtooth', 0.09, 0);
    this.playTone(155.56, 0.42, 'sawtooth', 0.09, 0.22);
    this.playTone(116.54, 0.68, 'triangle', 0.11, 0.44);
  }

  playElectricCrackle(delaySec = 0, duration = 0.14, volume = 0.08) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    try {
      const startAt = ctx.currentTime + Math.max(0, Number(delaySec) || 0);
      const dur = Math.max(0.03, Math.min(0.6, Number(duration) || 0.14));
      const len = Math.max(64, Math.floor((ctx.sampleRate || 44100) * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const spike = i % 19 < 4 ? 1.0 : 0.25;
        data[i] = (Math.random() * 2 - 1) * spike * Math.pow(1 - i / len, 0.45);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, startAt);
      filter.Q.setValueAtTime(1.4, startAt);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.01, Math.min(0.25, Number(volume) || 0.08)), startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this._getOutputNode());
      src.start(startAt);
      src.stop(startAt + dur);
    } catch {}
  }

  playSurvivalIntroAlarm() {
    const ctx = this._ensureCtx();
    if (!ctx) return false;
    try {
      const t0 = ctx.currentTime;
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      dropOsc.type = 'sawtooth';
      dropOsc.frequency.setValueAtTime(220, t0);
      dropOsc.frequency.exponentialRampToValueAtTime(42, t0 + 0.92);
      dropGain.gain.setValueAtTime(0.11, t0);
      dropGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.96);
      dropOsc.connect(dropGain);
      dropGain.connect(this._getOutputNode());
      dropOsc.start(t0);
      dropOsc.stop(t0 + 0.98);
    } catch {}

    this.playElectricCrackle(0.04, 0.16, 0.09);
    this.playElectricCrackle(0.24, 0.12, 0.075);
    this.playElectricCrackle(0.52, 0.18, 0.09);
    this.playElectricCrackle(0.84, 0.14, 0.07);
    this.playElectricCrackle(1.18, 0.12, 0.06);

    [0.75, 1.85, 2.95].forEach((offset) => {
      this.playTone(540, 0.28, 'sawtooth', 0.065, offset);
      this.playTone(360, 0.32, 'square', 0.055, offset + 0.24);
    });

    this.playTone(72, 0.65, 'sawtooth', 0.12, 1.9);
    this.playTone(138, 0.48, 'triangle', 0.08, 1.95);
    return true;
  }

  osBoot() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    [329.63, 440, 659.25, 880].forEach((n, idx) => {
      this.playTone(n, 0.14, 'triangle', 0.065, idx * 0.055);
    });
  }

  osClick() {
    this.playTone(760, 0.035, 'triangle', 0.055, 0);
  }

  osWindowOpen() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(480, 0.055, 'sine', 0.06, 0);
    this.playTone(720, 0.075, 'triangle', 0.065, 0.04);
  }

  osWindowClose() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(680, 0.05, 'triangle', 0.055, 0);
    this.playTone(420, 0.07, 'sine', 0.05, 0.038);
  }

  arcadeBeep(freq = 660, duration = 0.045, type = 'square') {
    this.playTone(freq, duration, type, 0.055, 0);
  }

  arcadePowerup() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((n, idx) => {
      this.playTone(n, 0.07, 'square', 0.06, idx * 0.045);
    });
  }

  arcadeGameOver() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    [392, 349.23, 329.63, 261.63].forEach((n, idx) => {
      this.playTone(n, 0.14, 'sawtooth', 0.065, idx * 0.09);
    });
  }

  arcadeVictory() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, idx) => {
      this.playTone(n, 0.12, 'triangle', 0.075, idx * 0.065);
    });
  }

  coinEarned() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(987.77, 0.09, 'sine', 0.07, 0);
    this.playTone(1318.51, 0.16, 'triangle', 0.08, 0.07);
  }

  shopPurchase() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((n, idx) => {
      this.playTone(n, 0.11, 'triangle', 0.07, idx * 0.055);
    });
  }

  startRackServerHum() {
    const ctx = this._ensureCtx();
    if (!ctx || this._rackHum) return false;
    try {
      const len = Math.max(512, Math.floor((ctx.sampleRate || 44100) * 1.2));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buffer;
      noiseSrc.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 320;
      filter.Q.value = 1.6;

      const fanOsc = ctx.createOscillator();
      fanOsc.type = 'sine';
      fanOsc.frequency.value = 110;

      const fanGain = ctx.createGain();
      fanGain.gain.value = 0.012;

      const master = ctx.createGain();
      master.gain.value = 0.026;

      noiseSrc.connect(filter);
      filter.connect(master);
      fanOsc.connect(fanGain);
      fanGain.connect(master);
      master.connect(this._getOutputNode());

      noiseSrc.start();
      fanOsc.start();
      this._rackHum = { noiseSrc, fanOsc, filter, fanGain, master };
      return true;
    } catch {
      return false;
    }
  }

  stopRackServerHum() {
    if (!this._rackHum) return;
    const hum = this._rackHum;
    this._rackHum = null;
    try {
      hum.noiseSrc?.stop?.();
      hum.fanOsc?.stop?.();
      hum.master?.disconnect?.();
    } catch {}
  }

  playCombatShot(weaponId = 'fiber_rifle') {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (weaponId === 'udp_shotgun') {
      this.playTone(160, 0.14, 'sawtooth', 0.12, 0);
      this.playTone(95, 0.18, 'square', 0.09, 0.015);
      this._playClapGrain(0, 920, 0.09);
      return;
    }
    if (weaponId === 'ping_sniper') {
      this.playTone(1380, 0.08, 'triangle', 0.1, 0);
      this.playTone(420, 0.24, 'sawtooth', 0.11, 0.02);
      this.playTone(2120, 0.14, 'sine', 0.07, 0.03);
      return;
    }
    if (weaponId === 'plasma_solder_pistol') {
      this.playTone(920, 0.06, 'sine', 0.08, 0);
      this.playTone(540, 0.08, 'triangle', 0.07, 0.02);
      return;
    }
    this.playTone(780, 0.055, 'sawtooth', 0.065, 0);
    this.playTone(510, 0.07, 'triangle', 0.06, 0.02);
  }

  playCombatMelee(weaponId = 'ddr5_katana') {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (weaponId === 'switch24_hammer') {
      this.playTone(145, 0.22, 'sawtooth', 0.13, 0);
      this.playTone(72, 0.26, 'sine', 0.14, 0.02);
      return;
    }
    if (weaponId === 'rj45_crimper_heavy') {
      this.playTone(240, 0.12, 'square', 0.1, 0);
      this.playTone(115, 0.16, 'triangle', 0.1, 0.04);
      return;
    }
    if (weaponId === 'solder_iron_blade') {
      this.playTone(680, 0.06, 'triangle', 0.06, 0);
      this.solderSizzle();
      return;
    }
    this.playTone(860, 0.07, 'triangle', 0.075, 0);
    this.playTone(420, 0.09, 'sine', 0.06, 0.03);
  }

  playCombatHitmarker(isKill = false) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (isKill) {
      this.playTone(1046.5, 0.07, 'triangle', 0.09, 0);
      this.playTone(1567.98, 0.11, 'sine', 0.095, 0.05);
    } else {
      this.playTone(1240, 0.04, 'triangle', 0.075, 0);
    }
  }

  playCombatReload() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(420, 0.05, 'square', 0.05, 0);
    this.playTone(680, 0.06, 'triangle', 0.065, 0.09);
    this.playTone(960, 0.07, 'sine', 0.065, 0.17);
  }

  playCombatPickup() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(659.25, 0.08, 'sine', 0.07, 0);
    this.playTone(987.77, 0.12, 'triangle', 0.08, 0.06);
  }

  playCombatHurt() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this.playTone(180, 0.12, 'sawtooth', 0.09, 0);
    this.playTone(110, 0.16, 'sine', 0.09, 0.04);
  }
}

export const sfx = new SoundEngine();
