import * as THREE from 'three';
import {
  animateAvatarLimbs,
  buildStudentAvatarMesh,
  createVoiceIndicatorSprite,
  disposeObject3D,
  normalizeSkin,
  updateVoiceIndicatorSprite
} from './AvatarBuilder.js';

function makeStudentBadge(peer) {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 152;
  const ctx = canvas.getContext('2d');

  const accent = peer.color || '#22d3ee';
  const borderCol = peer.diplomaEarned || peer.rank === 1 ? '#fbbf24' : accent;

  ctx.fillStyle = 'rgba(9, 15, 30, 0.9)';
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(10, 10, 520, 132, 22);
  ctx.fill();
  ctx.stroke();

  const rankText = peer.rank ? `#${peer.rank}` : 'CIEL';
  ctx.fillStyle =
    peer.rank === 1
      ? '#fbbf24'
      : peer.rank === 2
        ? '#cbd5e1'
        : peer.rank === 3
          ? '#fb923c'
          : accent;
  ctx.beginPath();
  ctx.roundRect(24, 24, 72, 40, 10);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rankText, 60, 44);

  const avgText = typeof peer.average === 'number' ? `${peer.average.toFixed(1)}/20` : '--/20';
  const avgColor =
    typeof peer.average !== 'number'
      ? '#94a3b8'
      : peer.average >= 14
        ? '#34d399'
        : peer.average >= 10
          ? '#38bdf8'
          : '#fb7185';
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = avgColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(410, 24, 106, 40, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = avgColor;
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText(avgText, 463, 44);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const nameLabel = `${peer.name}${peer.diplomaEarned ? ' 🎓' : ''}`;
  ctx.fillText(nameLabel.slice(0, 20), 253, 46, 300);

  const subRank = peer.rankLabel || 'Apprenti CIEL';
  const subTp = `${peer.completedCount || 0}/5 TPs`;
  const locText = peer.zoneLabel || 'U300';
  const actPart =
    peer.activity && peer.activity !== 'Dans l’atelier'
      ? `${peer.activity} (${locText})`
      : `📍 ${locText}`;
  const actText = `${actPart} • ${subRank} (${subTp})`;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(actText.slice(0, 50), 270, 106, 496);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBubbleTexture(text, { isEmote = false, color = '#22d3ee' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = isEmote ? 'rgba(15, 23, 42, 0.95)' : 'rgba(248, 250, 252, 0.96)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.roundRect(14, 12, 492, 92, 24);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(244, 102);
  ctx.lineTo(260, 128);
  ctx.lineTo(276, 102);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isEmote ? '#f8fafc' : '#0f172a';
  ctx.font = isEmote ? 'bold 34px system-ui, sans-serif' : 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const clean = String(text || '').trim().slice(0, 44);
  const display = clean.length === 44 ? `${clean.slice(0, 41)}...` : clean;
  ctx.fillText(display, 260, 58);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSpeechBubble(yOffset = 2.94) {
  const mat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.65, 1);
  sprite.position.set(0, yOffset, 0);
  sprite.visible = false;
  sprite.renderOrder = 10;
  sprite.userData = { ttl: 0, baseY: yOffset };
  return sprite;
}

export function showSpeechBubble(sprite, text, { isEmote = false, color = '#22d3ee' } = {}) {
  if (!sprite || !text) return;
  const newTex = makeBubbleTexture(text, { isEmote, color });
  sprite.material.map?.dispose();
  sprite.material.map = newTex;
  sprite.material.opacity = 1;
  sprite.material.needsUpdate = true;
  sprite.visible = true;
  sprite.position.y = sprite.userData.baseY;
  sprite.userData.ttl = isEmote ? 3.4 : 4.6;
}

export function updateSpeechBubble(sprite, dt) {
  if (!sprite || !sprite.visible) return;
  sprite.userData.ttl -= dt;
  if (sprite.userData.ttl <= 0) {
    sprite.visible = false;
    return;
  }
  const ageOffset = Math.sin(sprite.userData.ttl * 3.5) * 0.04;
  sprite.position.y = sprite.userData.baseY + ageOffset;
  if (sprite.userData.ttl < 0.6) {
    sprite.material.opacity = Math.max(0, sprite.userData.ttl / 0.6);
  } else {
    sprite.material.opacity = 1;
  }
}

export class RemotePlayersManager {
  constructor(scene) {
    this.scene = scene;
    this.peers = new Map();
  }

  setPeers(peerList = []) {
    const incomingIds = new Set(peerList.map((p) => p.id));
    for (const id of this.peers.keys()) {
      if (!incomingIds.has(id)) this.removePeer(id);
    }
    for (const p of peerList) {
      this.upsertPeer(p);
    }
  }

  upsertPeer(p) {
    if (!p || !p.id) return;
    if (this.peers.has(p.id)) {
      this.movePeer(p.id, p.x, p.y, p.z, p.yaw);
      if (p.skin) {
        const existing = this.peers.get(p.id);
        if (JSON.stringify(existing.skin) !== JSON.stringify(normalizeSkin(p.skin))) {
          this.setSkin(p.id, p.skin);
        }
      }
      if (p.activity) this.setActivity(p.id, p.activity);
      if (p.zoneId || p.zoneLabel) this.setZone(p.id, p.zoneId, p.zoneLabel);
      this.setStats(p.id, p);
      return;
    }

    const skin = normalizeSkin(p.skin || { outfitColor: p.color || '#22d3ee' });
    const accentColor = skin.outfitColor || p.color || '#22d3ee';
    const meshData = buildStudentAvatarMesh(skin);
    meshData.group.position.set(p.x ?? -3.95, Math.max(0, p.y || 0), p.z ?? 0.65);
    meshData.group.rotation.y = (p.yaw || 0) + Math.PI;

    const peerData = {
      id: p.id,
      name: p.name,
      color: accentColor,
      skin,
      activity: p.activity || 'Dans l’atelier',
      zoneId: p.zoneId || 'U300',
      zoneLabel: p.zoneLabel || 'U300 - Couloir Central',
      xp: p.xp || 0,
      average: typeof p.average === 'number' ? p.average : null,
      completedCount: p.completedCount || 0,
      diplomaEarned: Boolean(p.diplomaEarned),
      rank: p.rank || null,
      rankLabel: p.rankLabel || 'Apprenti CIEL',
      group: meshData.group,
      leftLeg: meshData.leftLeg,
      rightLeg: meshData.rightLeg,
      leftArm: meshData.leftArm,
      rightArm: meshData.rightArm,
      _walkPhase: 0,
      badge: null,
      bubble: null,
      voiceIndicator: null,
      micEnabled: Boolean(p.micEnabled),
      isSpeaking: Boolean(p.isSpeaking),
      targetPos: new THREE.Vector3(p.x ?? -3.95, Math.max(0, p.y || 0), p.z ?? 0.65),
      targetYaw: p.yaw || 0,
      horizSpeed: 0
    };

    const badgeTex = makeStudentBadge(peerData);
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const badge = new THREE.Sprite(badgeMat);
    badge.scale.set(2.3, 0.65, 1);
    badge.position.set(0, 2.28, 0);
    badge.renderOrder = 6;
    peerData.badge = badge;
    peerData.group.add(badge);

    const voiceIndicator = createVoiceIndicatorSprite(2.78);
    peerData.voiceIndicator = voiceIndicator;
    peerData.group.add(voiceIndicator);

    const bubble = createSpeechBubble(3.08);
    peerData.bubble = bubble;
    peerData.group.add(bubble);

    this.scene.add(peerData.group);
    this.peers.set(p.id, peerData);
  }

  _refreshBadge(peer) {
    if (!peer?.badge) return;
    const newTex = makeStudentBadge(peer);
    peer.badge.material.map?.dispose();
    peer.badge.material.map = newTex;
    peer.badge.material.needsUpdate = true;
  }

  setSkin(id, rawSkin) {
    const peer = this.peers.get(id);
    if (!peer) return;
    const nextSkin = normalizeSkin(rawSkin);
    const oldGroup = peer.group;
    const pos = oldGroup.position.clone();
    const rotY = oldGroup.rotation.y;

    oldGroup.remove(peer.badge);
    oldGroup.remove(peer.bubble);
    if (peer.voiceIndicator) oldGroup.remove(peer.voiceIndicator);
    this.scene.remove(oldGroup);
    disposeObject3D(oldGroup, new Set([peer.badge, peer.bubble, peer.voiceIndicator].filter(Boolean)));

    const meshData = buildStudentAvatarMesh(nextSkin);
    meshData.group.position.copy(pos);
    meshData.group.rotation.y = rotY;
    meshData.group.add(peer.badge);
    meshData.group.add(peer.bubble);
    if (peer.voiceIndicator) meshData.group.add(peer.voiceIndicator);

    peer.skin = nextSkin;
    peer.color = nextSkin.outfitColor;
    peer.group = meshData.group;
    peer.leftLeg = meshData.leftLeg;
    peer.rightLeg = meshData.rightLeg;
    peer.leftArm = meshData.leftArm;
    peer.rightArm = meshData.rightArm;
    peer._walkPhase = 0;

    this.scene.add(peer.group);
    this._refreshBadge(peer);
  }

  movePeer(id, x, y, z, yaw) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.targetPos.set(x, Math.max(0, Number(y) || 0), z);
    peer.targetYaw = yaw || 0;
  }

  setActivity(id, activity) {
    const peer = this.peers.get(id);
    if (!peer || peer.activity === activity) return;
    peer.activity = activity;
    this._refreshBadge(peer);
  }

  setZone(id, zoneId, zoneLabel) {
    const peer = this.peers.get(id);
    if (!peer) return;
    const nextLabel = zoneLabel || peer.zoneLabel;
    const nextId = zoneId || peer.zoneId;
    if (peer.zoneId === nextId && peer.zoneLabel === nextLabel) return;
    peer.zoneId = nextId;
    peer.zoneLabel = nextLabel;
    this._refreshBadge(peer);
  }

  getMiniMapPeers() {
    const out = [];
    for (const peer of this.peers.values()) {
      out.push({
        id: peer.id,
        name: peer.name,
        color: peer.color,
        x: peer.group.position.x,
        z: peer.group.position.z,
        zoneLabel: peer.zoneLabel
      });
    }
    return out;
  }

  setStats(id, stats = {}) {
    const peer = this.peers.get(id);
    if (!peer) return;
    let changed = false;
    if (typeof stats.xp === 'number' && stats.xp !== peer.xp) {
      peer.xp = stats.xp;
      changed = true;
    }
    if ((typeof stats.average === 'number' || stats.average === null) && stats.average !== peer.average) {
      peer.average = stats.average;
      changed = true;
    }
    if (typeof stats.completedCount === 'number' && stats.completedCount !== peer.completedCount) {
      peer.completedCount = stats.completedCount;
      changed = true;
    }
    if (typeof stats.diplomaEarned === 'boolean' && stats.diplomaEarned !== peer.diplomaEarned) {
      peer.diplomaEarned = stats.diplomaEarned;
      changed = true;
    }
    if (typeof stats.rank === 'number' && stats.rank !== peer.rank) {
      peer.rank = stats.rank;
      changed = true;
    }
    if (stats.rankLabel && stats.rankLabel !== peer.rankLabel) {
      peer.rankLabel = stats.rankLabel;
      changed = true;
    }
    if (changed) this._refreshBadge(peer);
  }

  syncLeaderboardRanks(leaderboard = []) {
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) return;
    const byName = new Map();
    for (const row of leaderboard) {
      if (row?.name) byName.set(row.name.toLowerCase(), row);
    }
    for (const peer of this.peers.values()) {
      const entry = byName.get(peer.name.toLowerCase());
      if (entry) {
        this.setStats(peer.id, entry);
      }
    }
  }

  showBubble(id, text, options = {}) {
    const peer = this.peers.get(id);
    if (!peer) return;
    showSpeechBubble(peer.bubble, text, {
      color: options.color || peer.color,
      isEmote: Boolean(options.isEmote)
    });
  }

  setVoiceState(id, { micEnabled = false, isSpeaking = false } = {}) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.micEnabled = Boolean(micEnabled);
    peer.isSpeaking = Boolean(micEnabled && isSpeaking);
    if (!peer.isSpeaking && peer.voiceIndicator) {
      updateVoiceIndicatorSprite(peer.voiceIndicator, 0, false);
    }
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.badge.material.map?.dispose();
    peer.badge.material.dispose();
    peer.bubble.material.map?.dispose();
    peer.bubble.material.dispose();
    if (peer.voiceIndicator) {
      peer.voiceIndicator.material.map?.dispose();
      peer.voiceIndicator.material.dispose();
    }
    this.scene.remove(peer.group);
    disposeObject3D(peer.group);
    this.peers.delete(id);
  }

  clearAll() {
    for (const id of [...this.peers.keys()]) {
      this.removePeer(id);
    }
  }

  update(dt) {
    const smoothXZ = 1 - Math.exp(-15 * dt);
    const smoothY = 1 - Math.exp(-18 * dt);
    const smoothYaw = 1 - Math.exp(-13 * dt);

    for (const peer of this.peers.values()) {
      const dx = peer.targetPos.x - peer.group.position.x;
      const dz = peer.targetPos.z - peer.group.position.z;
      const horizDist = Math.hypot(dx, dz);

      peer.group.position.x += dx * smoothXZ;
      peer.group.position.z += dz * smoothXZ;
      peer.group.position.y += (peer.targetPos.y - peer.group.position.y) * smoothY;

      let diff = (peer.targetYaw + Math.PI) - peer.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      peer.group.rotation.y += diff * smoothYaw;

      const instantSpeed = dt > 0 ? (horizDist * smoothXZ) / dt : 0;
      peer.horizSpeed = peer.horizSpeed * 0.6 + instantSpeed * 0.4;

      const isMoving = horizDist > 0.025 || peer.horizSpeed > 0.25;
      const isGrounded = peer.group.position.y < 0.08;
      animateAvatarLimbs(peer, dt, {
        isMoving,
        isGrounded,
        speedRatio: Math.max(0.8, Math.min(1.5, peer.horizSpeed / 5.2))
      });

      updateSpeechBubble(peer.bubble, dt);
      updateVoiceIndicatorSprite(peer.voiceIndicator, dt, peer.isSpeaking);
    }
  }
}
