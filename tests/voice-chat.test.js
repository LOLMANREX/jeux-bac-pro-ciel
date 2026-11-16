import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { SoundEngine } from '../src/core/audio.js';
import {
  computeProximityAudioParams,
  computeRmsMicLevel,
  ProximityVoiceChat
} from '../src/network/ProximityVoiceChat.js';
import {
  createVoiceIndicatorSprite,
  updateVoiceIndicatorSprite
} from '../src/world/AvatarBuilder.js';

function waitForMsg(sock, predicate, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off('message', handler);
      reject(new Error('Timeout waiting for WS message'));
    }, timeoutMs);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString('utf8'));
      if (predicate(msg)) {
        clearTimeout(timer);
        sock.off('message', handler);
        resolve(msg);
      }
    };
    sock.on('message', handler);
  });
}

function assertNoMsg(sock, predicate, waitMs = 220) {
  return new Promise((resolve, reject) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString('utf8'));
      if (predicate(msg)) {
        clearTimeout(timer);
        sock.off('message', handler);
        reject(new Error(`Unexpected message received: ${msg.type}`));
      }
    };
    const timer = setTimeout(() => {
      sock.off('message', handler);
      resolve();
    }, waitMs);
    sock.on('message', handler);
  });
}

test('computeProximityAudioParams applique la courbe 0..3m = 100%, 3..18m atténuée, >18m = 0 et le panning stéréo', () => {
  const origin = { x: 0, y: 0, z: 0 };

  const veryClose = computeProximityAudioParams({
    listenerPos: origin,
    listenerYaw: 0,
    sourcePos: { x: 2.5, y: 0, z: 0 }
  });
  assert.equal(veryClose.gain, 1);
  assert.equal(veryClose.audible, true);
  assert.ok(veryClose.pan > 0.9);

  const boundaryFull = computeProximityAudioParams({
    listenerPos: origin,
    listenerYaw: 0,
    sourcePos: { x: 0, y: 0, z: -3 }
  });
  assert.equal(boundaryFull.gain, 1);
  assert.equal(boundaryFull.pan, 0);

  const midRange = computeProximityAudioParams({
    listenerPos: origin,
    listenerYaw: 0,
    sourcePos: { x: -10.5, y: 0, z: 0 }
  });
  assert.ok(midRange.gain > 0.1 && midRange.gain < 0.6);
  assert.ok(midRange.pan < -0.9);

  const far = computeProximityAudioParams({
    listenerPos: origin,
    listenerYaw: 0,
    sourcePos: { x: 0, y: 0, z: 18.5 }
  });
  assert.equal(far.gain, 0);
  assert.equal(far.audible, false);

  const turnedLeft = computeProximityAudioParams({
    listenerPos: origin,
    listenerYaw: Math.PI / 2,
    sourcePos: { x: 0, y: 0, z: -6 }
  });
  assert.ok(turnedLeft.pan > 0.9);
  assert.ok(turnedLeft.gain > 0.5);

  const invalid = computeProximityAudioParams({ listenerPos: null, sourcePos: origin });
  assert.equal(invalid.gain, 0);
  assert.equal(invalid.audible, false);
});

test('createVoiceIndicatorSprite et updateVoiceIndicatorSprite pilotent la visibilité 3D sans DOM', () => {
  const sprite = createVoiceIndicatorSprite(2.78);
  assert.equal(sprite.visible, false);
  assert.equal(sprite.position.y, 2.78);

  updateVoiceIndicatorSprite(sprite, 0.12, true);
  assert.equal(sprite.visible, true);
  assert.ok(sprite.scale.x > 0.3);

  updateVoiceIndicatorSprite(sprite, 0.12, false);
  assert.equal(sprite.visible, false);
  assert.equal(sprite.position.y, 2.78);
});

test('Serveur WebSocket relaie voice_state, rtc_offer, rtc_answer et rtc_ice_candidate uniquement dans la même salle et nettoie à la déconnexion', async () => {
  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const wsAlice = new WebSocket(wsUrl);
  const wsBob = new WebSocket(wsUrl);
  const wsEve = new WebSocket(wsUrl);

  try {
    await Promise.all([
      new Promise((r) => wsAlice.once('open', r)),
      new Promise((r) => wsBob.once('open', r)),
      new Promise((r) => wsEve.once('open', r))
    ]);

    const pAlice = waitForMsg(wsAlice, (m) => m.type === 'welcome');
    wsAlice.send(JSON.stringify({ type: 'join', name: 'AliceVoice', room: 'plateau-u300' }));
    const wAlice = await pAlice;

    const pBob = waitForMsg(wsBob, (m) => m.type === 'welcome');
    wsBob.send(JSON.stringify({ type: 'join', name: 'BobVoice', room: 'plateau-u300' }));
    const wBob = await pBob;

    const pEve = waitForMsg(wsEve, (m) => m.type === 'welcome');
    wsEve.send(JSON.stringify({ type: 'join', name: 'EveOtherRoom', room: 'groupe-b' }));
    const wEve = await pEve;

    const bobSeesVoice = waitForMsg(wsBob, (m) => m.type === 'voice_state' && m.id === wAlice.id);
    const eveSilentVoice = assertNoMsg(wsEve, (m) => m.type === 'voice_state' && m.id === wAlice.id);
    wsAlice.send(JSON.stringify({ type: 'voice_state', micEnabled: true, isSpeaking: true }));
    const vsMsg = await bobSeesVoice;
    await eveSilentVoice;
    assert.equal(vsMsg.micEnabled, true);
    assert.equal(vsMsg.isSpeaking, true);

    const bobGetsOffer = waitForMsg(wsBob, (m) => m.type === 'rtc_offer' && m.fromId === wAlice.id);
    wsAlice.send(
      JSON.stringify({
        type: 'rtc_offer',
        targetId: wBob.id,
        sdp: { type: 'offer', sdp: 'v=0-fake-offer' }
      })
    );
    const offerMsg = await bobGetsOffer;
    assert.equal(offerMsg.sdp.sdp, 'v=0-fake-offer');

    const aliceGetsAnswer = waitForMsg(wsAlice, (m) => m.type === 'rtc_answer' && m.fromId === wBob.id);
    wsBob.send(
      JSON.stringify({
        type: 'rtc_answer',
        targetId: wAlice.id,
        sdp: { type: 'answer', sdp: 'v=0-fake-answer' }
      })
    );
    const answerMsg = await aliceGetsAnswer;
    assert.equal(answerMsg.sdp.sdp, 'v=0-fake-answer');

    const bobGetsIce = waitForMsg(wsBob, (m) => m.type === 'rtc_ice_candidate' && m.fromId === wAlice.id);
    wsAlice.send(
      JSON.stringify({
        type: 'rtc_ice_candidate',
        targetId: wBob.id,
        candidate: { candidate: 'candidate:1 1 udp 123 127.0.0.1 9999 typ host' }
      })
    );
    const iceMsg = await bobGetsIce;
    assert.ok(iceMsg.candidate.candidate.includes('127.0.0.1'));

    const aliceNoCrossRoom = assertNoMsg(
      wsAlice,
      (m) => m.type === 'rtc_offer' && m.fromId === wEve.id
    );
    wsEve.send(
      JSON.stringify({
        type: 'rtc_offer',
        targetId: wAlice.id,
        sdp: { type: 'offer', sdp: 'cross-room-attempt' }
      })
    );
    await aliceNoCrossRoom;

    const bobSeesVoiceOff = waitForMsg(
      wsBob,
      (m) => m.type === 'voice_state' && m.id === wAlice.id && m.micEnabled === false
    );
    const bobSeesLeft = waitForMsg(wsBob, (m) => m.type === 'player_left' && m.id === wAlice.id);
    wsAlice.close();
    const [offMsg, leftMsg] = await Promise.all([bobSeesVoiceOff, bobSeesLeft]);
    assert.equal(offMsg.isSpeaking, false);
    assert.equal(leftMsg.id, wAlice.id);

    wsBob.close();
    wsEve.close();
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.17 : Sélecteur entrée/sortie audio, vu-mètre, bascule micro à chaud (replaceTrack), setSinkId et ondevicechange', async () => {
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevNav = globalThis.navigator;
  const prevRtc = globalThis.RTCPeerConnection;
  const prevStorage = globalThis.localStorage;
  const prevHtmlAudio = globalThis.HTMLAudioElement;

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  let deviceList = [
    { kind: 'audioinput', deviceId: 'mic-1', label: 'Micro Intégré' },
    { kind: 'audioinput', deviceId: 'mic-2', label: 'Casque USB Logitech' },
    { kind: 'audiooutput', deviceId: 'spk-1', label: 'Haut-parleurs PC' },
    { kind: 'audiooutput', deviceId: 'headset-2', label: 'Casque Quest / USB' }
  ];

  const acquiredConstraints = [];
  const createdTracks = [];
  const createdAudioEls = [];
  const ctxSinkCalls = [];
  const replacedTracks = [];
  let sampleValue = 165;

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = 'running';
      this.destination = { id: 'dest' };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createGain() {
      return {
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
        connect() {},
        disconnect() {}
      };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect() {},
        start() {},
        stop() {}
      };
    }
    createStereoPanner() {
      return {
        pan: { setTargetAtTime() {} },
        connect() {},
        disconnect() {}
      };
    }
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createAnalyser() {
      return {
        fftSize: 512,
        smoothingTimeConstant: 0.65,
        connect() {},
        disconnect() {},
        getByteTimeDomainData(arr) {
          arr.fill(sampleValue);
        }
      };
    }
    async setSinkId(id) {
      ctxSinkCalls.push(id);
    }
  }

  class FakeHTMLAudioElement {
    constructor() {
      this.autoplay = false;
      this.playsInline = false;
      this.muted = false;
      this.volume = 1;
      this.srcObject = null;
      this.sinkCalls = [];
      createdAudioEls.push(this);
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
    async setSinkId(id) {
      this.sinkCalls.push(id);
    }
  }

  class FakeRtcPeerConnection {
    constructor() {
      this.signalingState = 'stable';
      this.connectionState = 'connected';
      this.transceivers = [];
    }
    addTransceiver(track) {
      const sender = {
        track,
        async replaceTrack(nextTrack) {
          replacedTracks.push(nextTrack);
          sender.track = nextTrack;
        }
      };
      const t = { direction: 'sendrecv', sender, receiver: { track: { kind: 'audio' } } };
      this.transceivers.push(t);
      return t;
    }
    getTransceivers() {
      return this.transceivers;
    }
    getSenders() {
      return this.transceivers.map((t) => t.sender);
    }
    async createOffer() {
      return { type: 'offer', sdp: 'fake-sdp' };
    }
    async setLocalDescription() {}
    close() {}
  }

  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.HTMLAudioElement = FakeHTMLAudioElement;
  globalThis.RTCPeerConnection = FakeRtcPeerConnection;
  globalThis.document = {
    createElement(tag) {
      if (tag === 'audio') return new FakeHTMLAudioElement();
      return {};
    }
  };
  globalThis.navigator = {
    mediaDevices: {
      ondevicechange: null,
      async enumerateDevices() {
        return deviceList;
      },
      async getUserMedia(constraints) {
        acquiredConstraints.push(constraints);
        const requestedId = constraints?.audio?.deviceId?.exact || 'default';
        const track = {
          kind: 'audio',
          readyState: 'live',
          enabled: true,
          deviceId: requestedId,
          stopped: false,
          stop() {
            this.stopped = true;
            this.readyState = 'ended';
          }
        };
        createdTracks.push(track);
        return {
          getAudioTracks: () => [track],
          getTracks: () => [track]
        };
      }
    }
  };

  let voiceChat = null;
  try {
    const sentVoiceStates = [];
    const fakeNetwork = {
      clientId: 'local-1',
      sendVoiceState(mic, speaking) {
        sentVoiceStates.push({ mic, speaking });
      },
      sendRtcOffer() {},
      sendRtcAnswer() {},
      sendRtcIceCandidate() {}
    };

    voiceChat = new ProximityVoiceChat(fakeNetwork);
    assert.equal(typeof globalThis.navigator.mediaDevices.ondevicechange, 'function');

    const devs1 = await voiceChat.refreshDevices();
    assert.equal(devs1.audioInputs.length, 2);
    assert.equal(devs1.audioOutputs.length, 2);

    deviceList = [
      ...deviceList,
      { kind: 'audiooutput', deviceId: 'bt-3', label: 'Casque Bluetooth' }
    ];
    await globalThis.navigator.mediaDevices.ondevicechange();
    assert.equal(voiceChat.audioOutputs.length, 3);

    voiceChat.onRoomJoined([{ id: 'peer-2', name: 'Bob', micEnabled: true, isSpeaking: false }]);
    assert.equal(await voiceChat.enableMicrophone(), true);
    assert.equal(voiceChat.peers.size, 1);

    const peerEntry = voiceChat.peers.get('peer-2');
    await voiceChat._attachRemoteStream(peerEntry, { id: 'remote-stream-1' });
    assert.ok(peerEntry.audioEl);

    const hotSwap = await voiceChat.setInputDevice('mic-2');
    assert.equal(hotSwap.switched, true);
    assert.equal(hotSwap.active, true);
    assert.equal(hotSwap.replacedPeers, 1);
    assert.equal(voiceChat.joined, true);
    assert.equal(voiceChat.peers.size, 1);
    assert.equal(replacedTracks.length, 1);
    assert.equal(replacedTracks[0].deviceId, 'mic-2');
    assert.equal(acquiredConstraints.at(-1).audio.deviceId.exact, 'mic-2');
    assert.equal(createdTracks[0].stopped, true);
    assert.equal(store.get('ciel_audio_input_id'), 'mic-2');

    const lvlLoud = voiceChat.sampleMicLevel();
    assert.ok(lvlLoud > 0.5);
    sampleValue = 128;
    const lvlSilent = voiceChat.sampleMicLevel();
    assert.equal(lvlSilent, 0);
    assert.equal(computeRmsMicLevel(new Uint8Array([128, 128])).level, 0);

    const outRes = await voiceChat.setOutputDevice('headset-2');
    assert.equal(outRes.supported, true);
    assert.equal(outRes.applied, true);
    assert.equal(store.get('ciel_audio_output_id'), 'headset-2');
    assert.ok(peerEntry.audioEl.sinkCalls.includes('headset-2'));
    assert.ok(ctxSinkCalls.includes('headset-2'));

    const engine = new SoundEngine();
    engine.click();
    const sfxRes = await engine.setOutputDevice('headset-2');
    assert.equal(sfxRes.supported, true);
    assert.equal(sfxRes.applied, true);
    assert.ok(ctxSinkCalls.includes('headset-2'));

    delete FakeAudioContext.prototype.setSinkId;
    delete FakeHTMLAudioElement.prototype.setSinkId;
    const fallbackOut = await voiceChat.setOutputDevice('bt-3');
    assert.equal(fallbackOut.supported, false);
    assert.equal(fallbackOut.applied, false);

    voiceChat.dispose();
    assert.equal(globalThis.navigator.mediaDevices.ondevicechange, null);
  } finally {
    voiceChat?.dispose?.();
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevNav === undefined) delete globalThis.navigator;
    else globalThis.navigator = prevNav;
    if (prevRtc === undefined) delete globalThis.RTCPeerConnection;
    else globalThis.RTCPeerConnection = prevRtc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
    if (prevHtmlAudio === undefined) delete globalThis.HTMLAudioElement;
    else globalThis.HTMLAudioElement = prevHtmlAudio;
  }
});
