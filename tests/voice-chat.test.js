import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { computeProximityAudioParams } from '../src/network/ProximityVoiceChat.js';
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
