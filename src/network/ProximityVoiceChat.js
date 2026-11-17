const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const VOICE_FULL_VOLUME_RANGE = 3;
export const VOICE_MAX_RANGE = 18;

export function computeProximityAudioParams({
  listenerPos,
  listenerYaw = 0,
  sourcePos,
  maxRange = VOICE_MAX_RANGE,
  fullVolumeRange = VOICE_FULL_VOLUME_RANGE,
  masterVolume = 1
} = {}) {
  if (!listenerPos || !sourcePos) {
    return { distance: Infinity, gain: 0, pan: 0, audible: false };
  }

  const dx = Number(sourcePos.x) - Number(listenerPos.x);
  const dy = (Number(sourcePos.y) || 0) - (Number(listenerPos.y) || 0);
  const dz = Number(sourcePos.z) - Number(listenerPos.z);

  if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
    return { distance: Infinity, gain: 0, pan: 0, audible: false };
  }

  const distance = Math.hypot(dx, Number.isFinite(dy) ? dy : 0, dz);
  const safeMax = Math.max(0.5, Number(maxRange) || VOICE_MAX_RANGE);
  const safeFull = Math.max(0, Math.min(safeMax - 0.1, Number(fullVolumeRange) ?? VOICE_FULL_VOLUME_RANGE));

  if (distance >= safeMax) {
    return { distance, gain: 0, pan: 0, audible: false };
  }

  let attenuation = 1;
  if (distance > safeFull) {
    const t = (distance - safeFull) / (safeMax - safeFull);
    attenuation = Math.pow(Math.max(0, 1 - t), 1.6);
  }

  const clampedMaster = Math.max(0, Math.min(2, Number(masterVolume) || 0));
  const gain = Math.round(attenuation * clampedMaster * 10000) / 10000;

  const cosY = Math.cos(Number(listenerYaw) || 0);
  const sinY = Math.sin(Number(listenerYaw) || 0);
  const rightDot = dx * cosY - dz * sinY;
  const pan = Math.max(-1, Math.min(1, rightDot / Math.max(distance, 0.75)));

  return {
    distance,
    gain,
    pan: Math.round(pan * 1000) / 1000,
    audible: gain > 0.001
  };
}

export function computeRmsMicLevel(samples) {
  if (!samples || !samples.length) return { rms: 0, level: 0 };
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const norm = (samples[i] - 128) / 128;
    sumSq += norm * norm;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  const level = Math.max(0, Math.min(1, Math.round(rms * 4.5 * 1000) / 1000));
  return { rms, level };
}

export class ProximityVoiceChat {
  constructor(network, options = {}) {
    this.network = network;
    this.onStateChange = options.onStateChange || null;
    this.onToast = options.onToast || null;
    this.onDevicesChange = options.onDevicesChange || null;
    this.onMicLevel = options.onMicLevel || null;

    this.maxRange = options.maxRange || VOICE_MAX_RANGE;
    this.fullVolumeRange = options.fullVolumeRange || VOICE_FULL_VOLUME_RANGE;

    this.supported =
      typeof window !== 'undefined' &&
      typeof RTCPeerConnection !== 'undefined' &&
      Boolean(navigator?.mediaDevices?.getUserMedia);

    this.audioCtx = null;
    this.masterGain = null;
    this.outputSinkDest = null;
    this.outputSinkEl = null;
    this.usingStreamSink = false;
    this.localStream = null;
    this.localTrack = null;
    this.localSource = null;
    this.analyser = null;
    this.vadBuffer = null;

    this.meterStream = null;
    this.meterTrack = null;
    this.meterSource = null;
    this.meterAnalyser = null;
    this.meterBuffer = null;
    this.meterActive = false;
    this.micLevel = 0;
    this.micRms = 0;

    this.peers = new Map();
    this.remoteVoiceStates = new Map();
    this.nearbySpeakers = [];

    this.inputDeviceId = String(options.inputDeviceId ?? this._readStorage('ciel_audio_input_id') ?? '');
    this.outputDeviceId = String(options.outputDeviceId ?? this._readStorage('ciel_audio_output_id') ?? '');
    this.audioInputs = [];
    this.audioOutputs = [];
    this.sinkSupported = this.isOutputSelectionSupported();
    this.sinkStatusMessage = '';

    this.micEnabled = false;
    this.pttHeld = false;
    this.isSpeaking = false;
    this.lastVoiceSignalAt = 0;
    this.inTp = false;
    this.mode = options.mode === 'ptt' ? 'ptt' : 'open';
    this.tpBehavior = ['active', 'duck', 'mute'].includes(options.tpBehavior) ? options.tpBehavior : 'duck';
    this.masterVolume = Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1;
    this.permissionState = 'idle';
    this.errorMessage = '';
    this.joined = false;
    this.pendingConnectTimer = null;

    this._lastSentState = null;
    this._onDeviceChangeBound = () => {
      this.refreshDevices().catch(() => {});
    };
    this._bindDeviceChangeListener();
  }

  _readStorage(key) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  _writeStorage(key, value) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem(key, String(value));
        else localStorage.removeItem(key);
      }
    } catch {
      return;
    }
  }

  _bindDeviceChangeListener() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    try {
      navigator.mediaDevices.ondevicechange = this._onDeviceChangeBound;
      this._boundViaProperty = true;
    } catch {
      this._boundViaProperty = false;
      if (typeof navigator.mediaDevices.addEventListener === 'function') {
        navigator.mediaDevices.addEventListener('devicechange', this._onDeviceChangeBound);
        this._boundViaEvent = true;
      }
    }
  }

  _unbindDeviceChangeListener() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    if (this._boundViaProperty && navigator.mediaDevices.ondevicechange === this._onDeviceChangeBound) {
      try {
        navigator.mediaDevices.ondevicechange = null;
      } catch {}
    }
    if (this._boundViaEvent && typeof navigator.mediaDevices.removeEventListener === 'function') {
      navigator.mediaDevices.removeEventListener('devicechange', this._onDeviceChangeBound);
    }
    this._boundViaProperty = false;
    this._boundViaEvent = false;
  }

  isOutputSelectionSupported() {
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

  _buildAudioConstraints(deviceId = this.inputDeviceId) {
    const audio = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    const cleanId = String(deviceId || '');
    if (cleanId && cleanId !== 'default') {
      audio.deviceId = { exact: cleanId };
    }
    return { audio, video: false };
  }

  async refreshDevices() {
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.enumerateDevices !== 'function') {
      this.audioInputs = [];
      this.audioOutputs = [];
      return { audioInputs: [], audioOutputs: [] };
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const raw = Array.isArray(list) ? list : [];
      const inputs = [];
      const outputs = [];
      for (const dev of raw) {
        if (!dev) continue;
        if (dev.kind === 'audioinput') {
          const idx = inputs.length + 1;
          inputs.push({
            deviceId: String(dev.deviceId || ''),
            label: dev.label || (dev.deviceId === 'default' ? 'Microphone par défaut' : `Microphone ${idx}`)
          });
        } else if (dev.kind === 'audiooutput') {
          const idx = outputs.length + 1;
          outputs.push({
            deviceId: String(dev.deviceId || ''),
            label: dev.label || (dev.deviceId === 'default' ? 'Sortie système par défaut' : `Sortie audio ${idx}`)
          });
        }
      }
      this.audioInputs = inputs;
      this.audioOutputs = outputs;

      const hasNamedInputs = inputs.some((d) => d.deviceId && d.deviceId !== 'default');
      if (hasNamedInputs && this.inputDeviceId && this.inputDeviceId !== 'default' && !inputs.some((d) => d.deviceId === this.inputDeviceId)) {
        this.inputDeviceId = '';
        this._writeStorage('ciel_audio_input_id', '');
        if (this.micEnabled) {
          await this.setInputDevice('');
        }
      }
      const hasNamedOutputs = outputs.some((d) => d.deviceId && d.deviceId !== 'default');
      if (hasNamedOutputs && this.outputDeviceId && this.outputDeviceId !== 'default' && !outputs.some((d) => d.deviceId === this.outputDeviceId)) {
        this.outputDeviceId = '';
        this._writeStorage('ciel_audio_output_id', '');
        await this.setOutputDevice('');
      }

      this.onDevicesChange?.({
        audioInputs: this.audioInputs,
        audioOutputs: this.audioOutputs,
        inputDeviceId: this.inputDeviceId,
        outputDeviceId: this.outputDeviceId
      });
      this._emitState();
      return { audioInputs: this.audioInputs, audioOutputs: this.audioOutputs };
    } catch {
      return { audioInputs: this.audioInputs, audioOutputs: this.audioOutputs };
    }
  }

  setMode(mode) {
    this.mode = mode === 'ptt' ? 'ptt' : 'open';
    if (this.mode === 'open') {
      this.pttHeld = false;
    }
    this._syncLocalTrackEnabled();
    this._emitState();
  }

  setTpBehavior(behavior) {
    this.tpBehavior = ['active', 'duck', 'mute'].includes(behavior) ? behavior : 'duck';
    this._applyMasterVolume();
    this._syncLocalTrackEnabled();
    this._emitState();
  }

  setVolume(vol) {
    const num = Number(vol);
    this.masterVolume = Math.max(0, Math.min(1.5, Number.isFinite(num) ? num : 1));
    this._applyMasterVolume();
    this._emitState();
  }

  setInTp(inTp) {
    this.inTp = Boolean(inTp);
    if (this.inTp && this.tpBehavior === 'mute') {
      this.pttHeld = false;
    }
    this._applyMasterVolume();
    this._syncLocalTrackEnabled();
    this._emitState();
  }

  isTransmitting() {
    if (!this.micEnabled || !this.localTrack) return false;
    if (this.inTp && this.tpBehavior === 'mute') return false;
    if (this.mode === 'ptt') return this.pttHeld;
    return true;
  }

  _applyMasterVolume() {
    if (!this.masterGain || !this.audioCtx) return;
    const duckFactor = this.inTp && this.tpBehavior === 'duck' ? 0.35 : 1;
    const target = Math.max(0, Math.min(1.5, this.masterVolume * duckFactor));
    this.masterGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.04);
  }

  async ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
      this._applyMasterVolume();
      if (this.outputDeviceId) {
        this._applySinkToAudioContext(this.outputDeviceId).catch(() => {});
      }
    }
    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        return this.audioCtx;
      }
    }
    return this.audioCtx;
  }

  async _getStreamForDevice(deviceId = this.inputDeviceId) {
    const cleanId = String(deviceId || '');
    try {
      return await navigator.mediaDevices.getUserMedia(this._buildAudioConstraints(cleanId));
    } catch (err) {
      const name = err?.name || '';
      if (cleanId && cleanId !== 'default' && (name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'DevicesNotFoundError')) {
        this.inputDeviceId = '';
        this._writeStorage('ciel_audio_input_id', '');
        return navigator.mediaDevices.getUserMedia(this._buildAudioConstraints(''));
      }
      throw err;
    }
  }

  _bindLocalStreamAnalyser(stream) {
    if (this.localSource) {
      try {
        this.localSource.disconnect();
      } catch {}
      this.localSource = null;
    }
    if (!this.audioCtx || !stream || typeof this.audioCtx.createMediaStreamSource !== 'function') return;
    this.localSource = this.audioCtx.createMediaStreamSource(stream);
    if (!this.analyser && typeof this.audioCtx.createAnalyser === 'function') {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.65;
      this.vadBuffer = new Uint8Array(this.analyser.fftSize);
    }
    if (this.analyser) {
      this.localSource.connect(this.analyser);
    }
  }

  async _acquireMicrophone() {
    if (!this.supported) {
      this.permissionState = 'unsupported';
      this.errorMessage = 'Voice chat non supporté par ce navigateur ou connexion non HTTPS.';
      this.onToast?.(this.errorMessage, 'error');
      this._emitState();
      return false;
    }

    if (this.localStream && this.localTrack && this.localTrack.readyState === 'live') {
      return true;
    }

    try {
      await this.ensureAudioContext();
      this.localStream = await this._getStreamForDevice(this.inputDeviceId);
      this.localTrack = this.localStream.getAudioTracks()[0] || null;
      if (!this.localTrack) {
        this.permissionState = 'error';
        this.errorMessage = 'Aucun microphone détecté sur cet appareil.';
        this.onToast?.(this.errorMessage, 'error');
        this._emitState();
        return false;
      }

      this.localTrack.onended = () => {
        this.disableMicrophone();
      };

      this._bindLocalStreamAnalyser(this.localStream);
      this.permissionState = 'granted';
      this.errorMessage = '';
      this.refreshDevices().catch(() => {});
      return true;
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.permissionState = 'denied';
        this.errorMessage = 'Accès microphone refusé par le navigateur.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        this.permissionState = 'missing';
        this.errorMessage = 'Aucun microphone détecté.';
      } else {
        this.permissionState = 'error';
        this.errorMessage = 'Impossible d’activer le microphone (vérifiez HTTPS ou les permissions).';
      }
      this.micEnabled = false;
      this.pttHeld = false;
      this.onToast?.(this.errorMessage, 'error');
      this._emitState();
      return false;
    }
  }

  async setInputDevice(deviceId = '') {
    const prevInputId = this.inputDeviceId;
    const nextId = String(deviceId || '');
    this.inputDeviceId = nextId;
    this._writeStorage('ciel_audio_input_id', nextId);

    const hasLiveStream = Boolean(
      this.localStream && this.localTrack && this.localTrack.readyState !== 'ended'
    );
    if (!this.supported || (!this.micEnabled && !hasLiveStream)) {
      if (this.meterActive) {
        await this.startMicTest();
      } else {
        this._emitState();
      }
      return { switched: true, active: false, deviceId: this.inputDeviceId, replacedPeers: 0 };
    }

    let nextStream = null;
    try {
      await this.ensureAudioContext();
      nextStream = await navigator.mediaDevices.getUserMedia(this._buildAudioConstraints(nextId));
    } catch (err) {
      this.inputDeviceId = prevInputId;
      this._writeStorage('ciel_audio_input_id', prevInputId);
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Accès au microphone refusé.'
          : 'Impossible de basculer sur le microphone sélectionné.';
      this.errorMessage = msg;
      this.onToast?.(msg, 'error');
      this._emitState();
      return { switched: false, active: true, error: err?.name || 'Error', deviceId: this.inputDeviceId };
    }

    const nextTrack = nextStream.getAudioTracks?.()[0] || null;
    if (!nextTrack) {
      for (const t of nextStream.getTracks?.() || []) t.stop();
      this.inputDeviceId = prevInputId;
      this._writeStorage('ciel_audio_input_id', prevInputId);
      this._emitState();
      return { switched: false, active: true, error: 'NoAudioTrack', deviceId: this.inputDeviceId };
    }

    const prevStream = this.localStream;
    this.localStream = nextStream;
    this.localTrack = nextTrack;
    this.localTrack.enabled = this.isTransmitting();
    this.localTrack.onended = () => {
      if (this.localTrack === nextTrack) {
        this.disableMicrophone();
      }
    };

    this._bindLocalStreamAnalyser(nextStream);

    let replacedPeers = 0;
    for (const entry of this.peers.values()) {
      const pc = entry?.pc;
      if (!pc) continue;
      const sender =
        entry.audioTransceiver?.sender ||
        pc.getSenders?.().find((s) => s.track?.kind === 'audio');
      if (sender && typeof sender.replaceTrack === 'function') {
        try {
          await sender.replaceTrack(nextTrack);
          replacedPeers += 1;
        } catch {}
      } else {
        try {
          await this._syncPeerLocalTrack(entry);
          await this._negotiatePeer(entry);
          replacedPeers += 1;
        } catch {}
      }
    }

    if (prevStream && prevStream !== nextStream) {
      for (const t of prevStream.getTracks?.() || []) {
        t.onended = null;
        t.stop();
      }
    }

    this.permissionState = 'granted';
    this.errorMessage = '';
    this.refreshDevices().catch(() => {});
    this._emitState();
    return { switched: true, active: true, deviceId: this.inputDeviceId, replacedPeers };
  }

  async _applySinkToElement(audioEl, targetId = '') {
    if (!audioEl || typeof audioEl.setSinkId !== 'function') {
      return { supported: false, applied: false };
    }
    try {
      await audioEl.setSinkId(String(targetId || ''));
      return { supported: true, applied: true };
    } catch (err) {
      if (targetId) {
        try {
          await audioEl.setSinkId('');
        } catch {}
      }
      return { supported: true, applied: false, error: err?.name || 'SinkError' };
    }
  }

  async _applySinkToAudioContext(targetId = '') {
    if (!this.audioCtx) {
      return { supported: this.isOutputSelectionSupported(), applied: false, deferred: true };
    }
    const cleanId = String(targetId || '');
    if (typeof this.audioCtx.setSinkId === 'function') {
      try {
        await this.audioCtx.setSinkId(cleanId);
        return { supported: true, applied: true };
      } catch (err) {
        if (cleanId) {
          try {
            await this.audioCtx.setSinkId('');
          } catch {}
        }
        return { supported: true, applied: false, error: err?.name || 'SinkError' };
      }
    }

    if (typeof document !== 'undefined' && typeof this.audioCtx.createMediaStreamDestination === 'function') {
      if (!this.outputSinkEl) {
        const el = document.createElement('audio');
        el.autoplay = true;
        el.playsInline = true;
        this.outputSinkEl = el;
      }
      if (typeof this.outputSinkEl.setSinkId === 'function') {
        if (!cleanId) {
          if (this.usingStreamSink && this.masterGain) {
            try {
              this.masterGain.disconnect();
            } catch {}
            this.masterGain.connect(this.audioCtx.destination);
            this.usingStreamSink = false;
          }
          try {
            this.outputSinkEl.pause?.();
          } catch {}
          return { supported: true, applied: true };
        }
        try {
          if (!this.outputSinkDest) {
            this.outputSinkDest = this.audioCtx.createMediaStreamDestination();
          }
          if (this.masterGain && !this.usingStreamSink) {
            try {
              this.masterGain.disconnect();
            } catch {}
            this.masterGain.connect(this.outputSinkDest);
            this.usingStreamSink = true;
          }
          this.outputSinkEl.srcObject = this.outputSinkDest.stream;
          await this.outputSinkEl.setSinkId(cleanId);
          this.outputSinkEl.play?.().catch(() => {});
          return { supported: true, applied: true };
        } catch (err) {
          if (this.usingStreamSink && this.masterGain) {
            try {
              this.masterGain.disconnect();
            } catch {}
            this.masterGain.connect(this.audioCtx.destination);
            this.usingStreamSink = false;
          }
          return { supported: true, applied: false, error: err?.name || 'SinkError' };
        }
      }
    }

    return { supported: false, applied: false };
  }

  async setOutputDevice(deviceId = '') {
    const nextId = String(deviceId || '');
    this.outputDeviceId = nextId;
    this._writeStorage('ciel_audio_output_id', nextId);

    let anySupported = this.isOutputSelectionSupported();
    let anyApplied = false;
    let lastErr = '';

    for (const entry of this.peers.values()) {
      if (entry?.audioEl) {
        const res = await this._applySinkToElement(entry.audioEl, nextId);
        if (res.supported) anySupported = true;
        if (res.applied) anyApplied = true;
        if (res.error) lastErr = res.error;
      }
    }

    const ctxRes = await this._applySinkToAudioContext(nextId);
    if (ctxRes.supported) anySupported = true;
    if (ctxRes.applied) anyApplied = true;
    if (ctxRes.error) lastErr = ctxRes.error;

    this.sinkSupported = anySupported;
    if (!anySupported && nextId) {
      this.sinkStatusMessage = 'Sortie audio système utilisée (setSinkId non supporté par ce navigateur).';
    } else if (lastErr) {
      this.sinkStatusMessage = 'Périphérique de sortie indisponible : retour à la sortie système.';
    } else {
      this.sinkStatusMessage = '';
    }

    this._emitState();
    return {
      supported: anySupported,
      applied: anyApplied || (!nextId && anySupported),
      deviceId: this.outputDeviceId,
      error: lastErr || undefined
    };
  }

  async startMicTest() {
    if (this.localStream && this.localTrack && this.localTrack.enabled && this.analyser) {
      this.stopMicTest(false);
      return { ok: true, mode: 'live' };
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      return { ok: false, reason: 'unsupported' };
    }
    this.stopMicTest(false);
    try {
      const ctx = await this.ensureAudioContext();
      this.meterStream = await this._getStreamForDevice(this.inputDeviceId);
      this.meterTrack = this.meterStream.getAudioTracks?.()[0] || null;
      if (ctx && typeof ctx.createMediaStreamSource === 'function' && typeof ctx.createAnalyser === 'function') {
        this.meterSource = ctx.createMediaStreamSource(this.meterStream);
        this.meterAnalyser = ctx.createAnalyser();
        this.meterAnalyser.fftSize = 256;
        this.meterAnalyser.smoothingTimeConstant = 0.6;
        this.meterSource.connect(this.meterAnalyser);
        this.meterBuffer = new Uint8Array(this.meterAnalyser.fftSize);
      }
      this.meterActive = true;
      this.refreshDevices().catch(() => {});
      this._emitState();
      return { ok: true, mode: 'preview' };
    } catch (err) {
      this.meterActive = false;
      this._emitState();
      return { ok: false, reason: err?.name || 'Error' };
    }
  }

  stopMicTest(emit = true) {
    if (this.meterStream) {
      for (const t of this.meterStream.getTracks?.() || []) {
        t.stop();
      }
    }
    if (this.meterSource) {
      try {
        this.meterSource.disconnect();
      } catch {}
    }
    if (this.meterAnalyser) {
      try {
        this.meterAnalyser.disconnect();
      } catch {}
    }
    this.meterStream = null;
    this.meterTrack = null;
    this.meterSource = null;
    this.meterAnalyser = null;
    this.meterBuffer = null;
    this.meterActive = false;
    if (!this.isTransmitting()) {
      this.micLevel = 0;
      this.micRms = 0;
      this.onMicLevel?.(0);
    }
    if (emit) this._emitState();
  }

  getMicMetrics() {
    return {
      micEnabled: Boolean(this.micEnabled),
      transmitting: Boolean(this.isTransmitting()),
      isSpeaking: Boolean(this.isSpeaking),
      rms: Number(this.micRms) || 0,
      level: Number(this.micLevel) || 0
    };
  }

  sampleMicLevel() {
    if (this.isTransmitting() && this.analyser && this.vadBuffer) {
      this.analyser.getByteTimeDomainData(this.vadBuffer);
      const { rms, level } = computeRmsMicLevel(this.vadBuffer);
      this.micRms = rms;
      this.micLevel = level;
      this.onMicLevel?.(level);
      return level;
    }
    if (this.meterActive && this.meterAnalyser && this.meterBuffer) {
      this.meterAnalyser.getByteTimeDomainData(this.meterBuffer);
      const { rms, level } = computeRmsMicLevel(this.meterBuffer);
      this.micRms = rms;
      this.micLevel = level;
      this.onMicLevel?.(level);
      return level;
    }
    this.micRms = 0;
    this.micLevel = 0;
    this.onMicLevel?.(0);
    return 0;
  }

  async enableMicrophone() {
    if (!this.joined) return false;
    const ok = await this._acquireMicrophone();
    if (!ok) return false;
    this.micEnabled = true;
    this._syncLocalTrackEnabled();
    await this._attachLocalTrackToAllPeers();
    this._emitState();
    return true;
  }

  disableMicrophone() {
    this.micEnabled = false;
    this.pttHeld = false;
    this.isSpeaking = false;
    if (this.localTrack) {
      this.localTrack.enabled = false;
    }
    this._sendVoiceStateIfChanged(true);
    this._emitState();
  }

  async toggleMicrophone() {
    await this.ensureAudioContext();
    if (this.mode === 'ptt') {
      if (!this.micEnabled) {
        const ok = await this.enableMicrophone();
        if (ok) {
          this.onToast?.('🎙️ Micro prêt : maintenez V (ou le bouton micro) pour parler.', 'info');
        }
        return ok;
      }
      this.disableMicrophone();
      this.onToast?.('🔇 Microphone désactivé.', 'info');
      return false;
    }

    if (this.micEnabled) {
      this.disableMicrophone();
      this.onToast?.('🔇 Micro coupé.', 'info');
      return false;
    }

    const ok = await this.enableMicrophone();
    if (ok) {
      this.onToast?.('🎙️ Micro ouvert activé (Voice Chat de proximité).', 'success');
    }
    return ok;
  }

  async startPushToTalk() {
    if (!this.joined) return false;
    await this.ensureAudioContext();
    if (!this.micEnabled) {
      const ok = await this._acquireMicrophone();
      if (!ok) return false;
      this.micEnabled = true;
      await this._attachLocalTrackToAllPeers();
    }
    this.pttHeld = true;
    this._syncLocalTrackEnabled();
    this._emitState();
    return true;
  }

  stopPushToTalk() {
    if (!this.pttHeld) return;
    this.pttHeld = false;
    this.isSpeaking = false;
    this._syncLocalTrackEnabled();
    this._sendVoiceStateIfChanged(true);
    this._emitState();
  }

  _syncLocalTrackEnabled() {
    const active = this.isTransmitting();
    if (this.localTrack) {
      this.localTrack.enabled = active;
    }
    if (!active) {
      this.isSpeaking = false;
    }
    this._sendVoiceStateIfChanged(true);
  }

  _sendVoiceStateIfChanged(force = false) {
    if (!this.joined) return;
    const mic = this.isTransmitting();
    const speaking = mic && this.isSpeaking;
    const prev = this._lastSentState;
    if (!force && prev && prev.mic === mic && prev.speaking === speaking) return;
    this._lastSentState = { mic, speaking };
    this.network.sendVoiceState(mic, speaking);
  }

  onRoomJoined(peers = []) {
    this.joined = true;
    this.ensureAudioContext();
    const activeIds = new Set(peers.map((p) => p?.id).filter(Boolean));
    for (const oldId of [...this.peers.keys()]) {
      if (!activeIds.has(oldId)) {
        this.removePeer(oldId);
      }
    }
    this.remoteVoiceStates.clear();
    for (const p of peers) {
      if (!p?.id) continue;
      this.remoteVoiceStates.set(p.id, {
        micEnabled: Boolean(p.micEnabled),
        isSpeaking: Boolean(p.isSpeaking),
        name: p.name || 'Élève'
      });
      if (this.micEnabled || p.micEnabled) {
        this._ensurePeerConnection(p.id, p.name);
      }
    }
    this._sendVoiceStateIfChanged(true);
    this._emitState();
  }

  onPeerJoined(peer) {
    if (!this.joined || !peer?.id || peer.id === this.network.clientId) return;
    this.remoteVoiceStates.set(peer.id, {
      micEnabled: Boolean(peer.micEnabled),
      isSpeaking: Boolean(peer.isSpeaking),
      name: peer.name || 'Élève'
    });
    if (this.micEnabled || peer.micEnabled) {
      this._ensurePeerConnection(peer.id, peer.name);
    }
  }

  onPeerVoiceState({ id, micEnabled, isSpeaking }) {
    if (!id || id === this.network.clientId) return;
    const prev = this.remoteVoiceStates.get(id) || { name: 'Élève' };
    this.remoteVoiceStates.set(id, {
      ...prev,
      micEnabled: Boolean(micEnabled),
      isSpeaking: Boolean(micEnabled && isSpeaking)
    });
    const entry = this.peers.get(id);
    if (entry) {
      entry.micEnabled = Boolean(micEnabled);
      entry.isSpeaking = Boolean(micEnabled && isSpeaking);
    } else if (micEnabled && this.joined) {
      this._ensurePeerConnection(id, prev.name);
    }
  }

  removePeer(id) {
    this.remoteVoiceStates.delete(id);
    const entry = this.peers.get(id);
    if (!entry) return;
    this.peers.delete(id);
    this._disposePeerEntry(entry);
  }

  disconnect() {
    this.joined = false;
    this.stopMicTest(false);
    this.disableMicrophone();
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) {
        t.stop();
      }
    }
    if (this.localSource) {
      try {
        this.localSource.disconnect();
      } catch {}
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
    }
    if (this.outputSinkEl) {
      try {
        this.outputSinkEl.pause?.();
        this.outputSinkEl.srcObject = null;
      } catch {}
    }
    this.localStream = null;
    this.localTrack = null;
    this.localSource = null;
    this.analyser = null;
    this.vadBuffer = null;
    this.micLevel = 0;
    this.remoteVoiceStates.clear();
    this.nearbySpeakers = [];
    this._lastSentState = null;

    for (const entry of this.peers.values()) {
      this._disposePeerEntry(entry);
    }
    this.peers.clear();
    this._emitState();
  }

  dispose() {
    this.disconnect();
    this._unbindDeviceChangeListener();
    if (this.audioCtx && typeof this.audioCtx.close === 'function') {
      try {
        this.audioCtx.close().catch?.(() => {});
      } catch {}
    }
    this.audioCtx = null;
    this.masterGain = null;
    this.outputSinkDest = null;
    this.outputSinkEl = null;
    this.usingStreamSink = false;
  }

  _disposePeerEntry(entry) {
    if (!entry) return;
    if (entry.mediaSource) {
      try {
        entry.mediaSource.disconnect();
      } catch {}
    }
    if (entry.gainNode) {
      try {
        entry.gainNode.disconnect();
      } catch {}
    }
    if (entry.pannerNode) {
      try {
        entry.pannerNode.disconnect();
      } catch {}
    }
    if (entry.audioEl) {
      try {
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
      } catch {}
    }
    if (entry.pc) {
      try {
        entry.pc.ontrack = null;
        entry.pc.onicecandidate = null;
        entry.pc.onnegotiationneeded = null;
        entry.pc.onconnectionstatechange = null;
        entry.pc.close();
      } catch {}
    }
  }

  _ensurePeerConnection(peerId, name = 'Élève') {
    if (!this.supported || !this.joined || !peerId || peerId === this.network.clientId) return null;
    if (this.peers.has(peerId)) return this.peers.get(peerId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const localId = String(this.network.clientId || '');
    const polite = localId < String(peerId);
    const remoteMeta = this.remoteVoiceStates.get(peerId);

    const entry = {
      id: peerId,
      name: remoteMeta?.name || name || 'Élève',
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      audioTransceiver: null,
      remoteStream: null,
      audioEl: null,
      mediaSource: null,
      gainNode: null,
      pannerNode: null,
      micEnabled: Boolean(remoteMeta?.micEnabled),
      isSpeaking: Boolean(remoteMeta?.isSpeaking),
      lastDistance: Infinity
    };
    this.peers.set(peerId, entry);

    if (this.localTrack && this.localStream) {
      entry.audioTransceiver = pc.addTransceiver(this.localTrack, {
        direction: 'sendrecv',
        streams: [this.localStream]
      });
    } else if (!polite) {
      entry.audioTransceiver = pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.network.sendRtcIceCandidate(peerId, ev.candidate);
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      this._attachRemoteStream(entry, stream);
    };

    pc.onnegotiationneeded = async () => {
      await this._negotiatePeer(entry);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    if (!polite && entry.audioTransceiver) {
      this._negotiatePeer(entry);
    }

    return entry;
  }

  async _negotiatePeer(entry) {
    const pc = entry?.pc;
    if (!pc || pc.signalingState !== 'stable' || entry.makingOffer) return;
    try {
      entry.makingOffer = true;
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      this.network.sendRtcOffer(entry.id, pc.localDescription || offer);
    } catch {
      return;
    } finally {
      entry.makingOffer = false;
    }
  }

  async _syncPeerLocalTrack(entry) {
    const pc = entry?.pc;
    if (!pc || !this.localTrack || !this.localStream) return;
    if (!entry.audioTransceiver) {
      const existing = pc.getTransceivers?.().find((t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio');
      if (existing) {
        entry.audioTransceiver = existing;
      }
    }
    if (entry.audioTransceiver) {
      entry.audioTransceiver.direction = 'sendrecv';
      await entry.audioTransceiver.sender.replaceTrack(this.localTrack);
    } else {
      entry.audioTransceiver = pc.addTransceiver(this.localTrack, {
        direction: 'sendrecv',
        streams: [this.localStream]
      });
    }
  }

  async _attachLocalTrackToAllPeers() {
    for (const [peerId, meta] of this.remoteVoiceStates.entries()) {
      const entry = this._ensurePeerConnection(peerId, meta.name);
      if (!entry) continue;
      await this._syncPeerLocalTrack(entry);
      await this._negotiatePeer(entry);
    }
  }

  async handleOffer({ fromId, sdp }) {
    if (!fromId || !sdp || !this.joined) return;
    const entry = this._ensurePeerConnection(fromId);
    if (!entry) return;
    const pc = entry.pc;

    const offerCollision = entry.makingOffer || pc.signalingState !== 'stable';
    entry.ignoreOffer = !entry.polite && offerCollision;
    if (entry.ignoreOffer) return;

    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }
      await pc.setRemoteDescription(sdp);
      if (this.localTrack && this.localStream) {
        await this._syncPeerLocalTrack(entry);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.network.sendRtcAnswer(fromId, pc.localDescription || answer);
      await this._flushPendingCandidates(entry);
    } catch {
      return;
    }
  }

  async handleAnswer({ fromId, sdp }) {
    const entry = this.peers.get(fromId);
    if (!entry || !sdp) return;
    try {
      if (entry.pc.signalingState === 'have-local-offer') {
        await entry.pc.setRemoteDescription(sdp);
        await this._flushPendingCandidates(entry);
      }
    } catch {
      return;
    }
  }

  async handleIceCandidate({ fromId, candidate }) {
    const entry = this.peers.get(fromId);
    if (!entry || !candidate) return;
    if (!entry.pc.remoteDescription) {
      entry.pendingCandidates.push(candidate);
      return;
    }
    try {
      await entry.pc.addIceCandidate(candidate);
    } catch {
      if (!entry.ignoreOffer) return;
    }
  }

  async _flushPendingCandidates(entry) {
    if (!entry?.pendingCandidates?.length || !entry.pc.remoteDescription) return;
    const list = entry.pendingCandidates.splice(0, entry.pendingCandidates.length);
    for (const cand of list) {
      try {
        await entry.pc.addIceCandidate(cand);
      } catch {
        continue;
      }
    }
  }

  async _attachRemoteStream(entry, stream) {
    if (!entry || !stream) return;
    if (entry.remoteStream === stream && entry.gainNode) return;
    entry.remoteStream = stream;

    if (typeof document !== 'undefined') {
      if (!entry.audioEl) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = true;
        audio.volume = 0;
        entry.audioEl = audio;
      }
      entry.audioEl.srcObject = stream;
      if (this.outputDeviceId) {
        this._applySinkToElement(entry.audioEl, this.outputDeviceId).catch(() => {});
      }
      entry.audioEl.play().catch(() => {});
    }

    const ctx = await this.ensureAudioContext();
    if (!ctx || !this.masterGain) {
      if (entry.audioEl) {
        entry.audioEl.muted = false;
        entry.audioEl.volume = 0.6;
      }
      return;
    }

    if (entry.mediaSource) {
      try {
        entry.mediaSource.disconnect();
      } catch {}
    }

    entry.mediaSource = ctx.createMediaStreamSource(stream);
    entry.gainNode = ctx.createGain();
    entry.gainNode.gain.value = 0;
    entry.pannerNode = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

    if (entry.pannerNode) {
      entry.mediaSource.connect(entry.gainNode);
      entry.gainNode.connect(entry.pannerNode);
      entry.pannerNode.connect(this.masterGain);
    } else {
      entry.mediaSource.connect(entry.gainNode);
      entry.gainNode.connect(this.masterGain);
    }
  }

  _updateLocalVad(nowMs) {
    const transmitting = this.isTransmitting();
    if (!transmitting || !this.analyser || !this.vadBuffer) {
      if (!this.meterActive) {
        this.micLevel = 0;
        this.onMicLevel?.(0);
      }
      if (this.isSpeaking) {
        this.isSpeaking = false;
        this._sendVoiceStateIfChanged(true);
        this._emitState();
      }
      return;
    }

    this.analyser.getByteTimeDomainData(this.vadBuffer);
    const { rms, level } = computeRmsMicLevel(this.vadBuffer);
    this.micRms = rms;
    this.micLevel = level;
    this.onMicLevel?.(level);
    let nextSpeaking = this.isSpeaking;
    if (rms > 0.022) {
      this.lastVoiceSignalAt = nowMs;
      nextSpeaking = true;
    } else if (rms < 0.014 && nowMs - this.lastVoiceSignalAt > 340) {
      nextSpeaking = false;
    }

    if (nextSpeaking !== this.isSpeaking) {
      this.isSpeaking = nextSpeaking;
      this._sendVoiceStateIfChanged(true);
      this._emitState();
    }
  }

  update(listenerPos, listenerYaw, remotePeersMap, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    if (!this.joined) return;
    this._updateLocalVad(nowMs);

    const activeSpeakers = [];
    const ctxNow = this.audioCtx?.currentTime || 0;

    if (remotePeersMap && listenerPos) {
      for (const peer of remotePeersMap.values()) {
        const peerPos = peer?.group?.position || peer?.position || null;
        const voiceEntry = this.peers.get(peer.id);
        const params = computeProximityAudioParams({
          listenerPos,
          listenerYaw,
          sourcePos: peerPos,
          maxRange: this.maxRange,
          fullVolumeRange: this.fullVolumeRange,
          masterVolume: 1
        });

        if (voiceEntry) {
          voiceEntry.lastDistance = params.distance;
          if (voiceEntry.gainNode && this.audioCtx) {
            voiceEntry.gainNode.gain.setTargetAtTime(params.gain, ctxNow, 0.045);
          } else if (voiceEntry.audioEl && !voiceEntry.mediaSource) {
            voiceEntry.audioEl.muted = !params.audible;
            voiceEntry.audioEl.volume = Math.max(0, Math.min(1, params.gain * this.masterVolume));
          }
          if (voiceEntry.pannerNode && this.audioCtx) {
            voiceEntry.pannerNode.pan.setTargetAtTime(params.pan, ctxNow, 0.045);
          }
        }

        const remoteVoice = this.remoteVoiceStates.get(peer.id);
        const speaking = Boolean(peer.isSpeaking || remoteVoice?.isSpeaking);
        if (speaking && params.distance <= this.maxRange) {
          activeSpeakers.push({
            id: peer.id,
            name: peer.name,
            color: peer.color || '#22d3ee',
            distance: Math.round(params.distance * 10) / 10
          });
        }
      }
    }

    activeSpeakers.sort((a, b) => a.distance - b.distance);
    const sig = activeSpeakers.map((s) => `${s.id}:${Math.round(s.distance)}`).join('|');
    if (sig !== this._lastSpeakerSig) {
      this._lastSpeakerSig = sig;
      this.nearbySpeakers = activeSpeakers;
      this._emitState();
    }
  }

  _emitState() {
    this.onStateChange?.({
      supported: this.supported,
      micEnabled: this.micEnabled,
      transmitting: this.isTransmitting(),
      isSpeaking: this.isSpeaking,
      pttHeld: this.pttHeld,
      mode: this.mode,
      tpBehavior: this.tpBehavior,
      inTp: this.inTp,
      volume: this.masterVolume,
      permissionState: this.permissionState,
      errorMessage: this.errorMessage,
      nearbySpeakers: this.nearbySpeakers,
      inputDeviceId: this.inputDeviceId,
      outputDeviceId: this.outputDeviceId,
      audioInputs: this.audioInputs,
      audioOutputs: this.audioOutputs,
      micLevel: this.micLevel,
      meterActive: this.meterActive,
      sinkSupported: this.sinkSupported,
      sinkStatusMessage: this.sinkStatusMessage
    });
  }
}
