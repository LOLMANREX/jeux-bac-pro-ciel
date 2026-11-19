import * as THREE from 'three';
import { getBattlePassTierSpec } from '../core/battlePassSkins.js';
import {
  animateAvatarLimbs,
  applySessionDivineSkin,
  attachRemoteVrVisuals,
  buildStudentAvatarMesh,
  createVoiceIndicatorSprite,
  disposeObject3D,
  isUltimateSecretSkinId,
  normalizeSkin,
  resolveAscensionSpecialty,
  ULTIMATE_SECRET_SKIN,
  ULTIMATE_SECRET_SKIN_ID,
  updateVoiceIndicatorSprite
} from './AvatarBuilder.js';
import { animateCombatWeaponMesh, buildCombatWeaponMesh } from './CombatWeapons.js';
import { buildPetMesh } from './PetBuilder.js';
import { isShopPetId } from './ShopCatalog.js';

function makeStudentBadge(peer) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 152;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const isSecret = Boolean(
    peer.skin?.secretSkin || isUltimateSecretSkinId(peer.skin?.divineSpecialty)
  );
  const divineSpec =
    !isSecret && peer.skin?.divineSpecialty
      ? resolveAscensionSpecialty(peer.skin.divineSpecialty)
      : null;
  const bpSpec =
    !isSecret && !divineSpec && peer.skin?.battlePassTier
      ? getBattlePassTierSpec(peer.skin.battlePassTier)
      : null;
  const accent = isSecret
    ? ULTIMATE_SECRET_SKIN.primaryColor
    : divineSpec
      ? divineSpec.primaryColor
      : bpSpec
        ? bpSpec.accentColor || '#fbbf24'
        : peer.color || '#22d3ee';
  const borderCol = isSecret
    ? '#e879f9'
    : divineSpec || bpSpec
      ? '#fde047'
      : peer.diplomaEarned || peer.rank === 1
        ? '#fbbf24'
        : accent;

  ctx.fillStyle = isSecret
    ? 'rgba(18, 8, 42, 0.94)'
    : bpSpec
      ? 'rgba(28, 18, 4, 0.94)'
      : 'rgba(9, 15, 30, 0.9)';
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = isSecret || bpSpec ? 5 : 4;
  ctx.beginPath();
  ctx.roundRect(10, 10, 520, 132, 22);
  ctx.fill();
  ctx.stroke();

  const rankText = isSecret
    ? '🌌ULTIME'
    : divineSpec
      ? '⚡DIEU'
      : bpSpec
        ? `${bpSpec.icon}VIP`
        : peer.rank
          ? `#${peer.rank}`
          : 'CIEL';
  ctx.fillStyle = isSecret
    ? '#e879f9'
    : divineSpec || bpSpec
      ? '#fde047'
      : peer.rank === 1
        ? '#fbbf24'
        : peer.rank === 2
          ? '#cbd5e1'
          : peer.rank === 3
            ? '#fb923c'
            : accent;
  ctx.beginPath();
  ctx.roundRect(24, 24, isSecret ? 86 : 72, 40, 10);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = isSecret ? '900 17px system-ui, sans-serif' : '800 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rankText, isSecret ? 67 : 60, 44);

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

  ctx.fillStyle = isSecret ? '#f5d0fe' : divineSpec || bpSpec ? '#fef08a' : '#f8fafc';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const suffix = isSecret
    ? ' 🌌👑'
    : divineSpec
      ? ` ⚡${divineSpec.icon}`
      : bpSpec
        ? ` ${bpSpec.icon}`
        : peer.diplomaEarned
          ? ' 🎓'
          : '';
  const nameLabel = `${peer.name}${suffix}`;
  ctx.fillText(nameLabel.slice(0, 20), isSecret ? 260 : 253, 46, 290);

  const subRank = isSecret
    ? 'Entité Quantique CIEL'
    : divineSpec
      ? `Dieu CIEL (${divineSpec.shortLabel})`
      : bpSpec
        ? `Passe VIP P.${bpSpec.tier}`
        : peer.rankLabel || 'Apprenti CIEL';
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
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

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
    this._allowedPeerIds = null;
    this._povPosePos = new THREE.Vector3();
  }

  setInstanceFilter(allowedIds = null) {
    if (!allowedIds) {
      this._allowedPeerIds = null;
      return;
    }
    const nextSet = new Set(Array.isArray(allowedIds) ? allowedIds : [...allowedIds]);
    this._allowedPeerIds = nextSet;
    for (const id of [...this.peers.keys()]) {
      if (!nextSet.has(id)) {
        this.removePeer(id);
      }
    }
  }

  getPeerPoseForPov(id) {
    const peer = this.peers.get(id);
    if (!peer) return null;
    this._povPosePos.copy(peer.group.position);
    return {
      id: peer.id,
      name: peer.name,
      position: this._povPosePos,
      yaw: peer.group.rotation.y - Math.PI,
      vrData: peer.vrData || null,
      activity: peer.activity || 'Dans l’atelier',
      zoneLabel: peer.zoneLabel || 'U300',
      group: peer.group
    };
  }

  setPeerPovHidden(id, hidden) {
    const peer = this.peers.get(id);
    if (!peer?.group) return;
    if (hidden) {
      if (peer._prePovVisible === undefined) {
        peer._prePovVisible = peer.group.visible;
      }
      peer.group.visible = false;
      if (peer.petMesh?.group) peer.petMesh.group.visible = false;
    } else if (peer._prePovVisible !== undefined) {
      peer.group.visible = peer._prePovVisible;
      if (peer.petMesh?.group) peer.petMesh.group.visible = peer._prePovVisible;
      delete peer._prePovVisible;
    }
  }

  _syncPeerPet(peer, rawPetId) {
    if (!peer) return;
    const nextPetId = isShopPetId(rawPetId) ? rawPetId : null;
    if (peer.equippedPet === nextPetId && Boolean(peer.petMesh) === Boolean(nextPetId)) {
      return;
    }
    if (peer.petMesh) {
      if (peer.petMesh.group) {
        this.scene.remove(peer.petMesh.group);
      }
      peer.petMesh.dispose?.();
      peer.petMesh = null;
    }
    peer.equippedPet = nextPetId;
    if (nextPetId) {
      peer.petMesh = buildPetMesh(nextPetId);
      peer.petMesh.snapToOwner(peer.group.position, peer.group.rotation.y - Math.PI);
      this.scene.add(peer.petMesh.group);
    }
  }

  setPet(id, petId) {
    const peer = this.peers.get(id);
    if (!peer) return null;
    if (isShopPetId(petId)) {
      peer.skin = { ...peer.skin, equippedPet: petId };
    } else if (peer.skin) {
      peer.skin = { ...peer.skin };
      delete peer.skin.equippedPet;
    }
    this._syncPeerPet(peer, petId);
    return peer.petMesh;
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
    if (this._allowedPeerIds && !this._allowedPeerIds.has(p.id)) return;
    if (this.peers.has(p.id)) {
      this.movePeer(p.id, p.x, p.y, p.z, p.yaw, p.vrData);
      if (p.skin) {
        const existing = this.peers.get(p.id);
        const nextNorm = normalizeSkin({
          ...p.skin,
          equippedPet: p.equippedPet ?? p.skin.equippedPet,
          equippedTrail: p.equippedTrail ?? p.skin.equippedTrail
        });
        if (JSON.stringify(existing.skin) !== JSON.stringify(nextNorm)) {
          this.setSkin(p.id, nextNorm);
        }
      } else if (p.equippedPet !== undefined) {
        this.setPet(p.id, p.equippedPet);
      }
      if (p.activity) this.setActivity(p.id, p.activity);
      if (p.zoneId || p.zoneLabel) this.setZone(p.id, p.zoneId, p.zoneLabel);
      this.setStats(p.id, p);
      return;
    }

    const skin = normalizeSkin({
      ...(p.skin || { outfitColor: p.color || '#22d3ee' }),
      equippedPet: p.equippedPet ?? p.skin?.equippedPet,
      equippedTrail: p.equippedTrail ?? p.skin?.equippedTrail
    });
    const accentColor = skin.outfitColor || p.color || '#22d3ee';
    const meshData = buildStudentAvatarMesh(skin);
    meshData.group.position.set(p.x ?? -3.95, Math.max(0, p.y || 0), p.z ?? 0.65);
    meshData.group.rotation.y = (p.yaw || 0) + Math.PI;

    const peerData = {
      id: p.id,
      name: p.name,
      color: accentColor,
      skin,
      equippedPet: null,
      petMesh: null,
      activity: p.activity || 'Dans l’atelier',
      zoneId: p.zoneId || 'U300',
      zoneLabel: p.zoneLabel || 'U300 - Couloir Central',
      xp: p.xp || 0,
      average: typeof p.average === 'number' ? p.average : null,
      completedCount: p.completedCount || 0,
      diplomaEarned: Boolean(p.diplomaEarned),
      rank: p.rank || null,
      rankLabel: p.rankLabel || 'Apprenti CIEL',
      avatar: meshData,
      group: meshData.group,
      leftLeg: meshData.leftLeg,
      rightLeg: meshData.rightLeg,
      leftArm: meshData.leftArm,
      rightArm: meshData.rightArm,
      headGroup: meshData.headGroup,
      torsoMat: meshData.torsoMat,
      updateEffects: meshData.updateEffects,
      setCreatorAura: meshData.setCreatorAura,
      setDivineSpecialty: meshData.setDivineSpecialty,
      setSecretSkin: meshData.setSecretSkin,
      hasSecretSkin: meshData.hasSecretSkin,
      hasDivineSkin: meshData.hasDivineSkin,
      _walkPhase: 0,
      badge: null,
      bubble: null,
      voiceIndicator: null,
      micEnabled: Boolean(p.micEnabled),
      isSpeaking: Boolean(p.isSpeaking),
      vrTracker: null,
      vrData: p.vrData || null,
      targetPos: new THREE.Vector3(p.x ?? -3.95, Math.max(0, p.y || 0), p.z ?? 0.65),
      targetYaw: p.yaw || 0,
      levitationOffset: 0,
      horizSpeed: 0
    };

    peerData.vrTracker = attachRemoteVrVisuals(peerData, peerData.skin);

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
    this._syncPeerPet(peerData, skin.equippedPet || p.equippedPet);
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

    peer.vrTracker?.dispose?.();
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
    peer.avatar = meshData;
    peer.group = meshData.group;
    peer.leftLeg = meshData.leftLeg;
    peer.rightLeg = meshData.rightLeg;
    peer.leftArm = meshData.leftArm;
    peer.rightArm = meshData.rightArm;
    peer.headGroup = meshData.headGroup;
    peer.torsoMat = meshData.torsoMat;
    peer.updateEffects = meshData.updateEffects;
    peer.setCreatorAura = meshData.setCreatorAura;
    peer.setDivineSpecialty = meshData.setDivineSpecialty;
    peer.setSecretSkin = meshData.setSecretSkin;
    peer.hasSecretSkin = meshData.hasSecretSkin;
    peer.hasDivineSkin = meshData.hasDivineSkin;
    peer.vrTracker = attachRemoteVrVisuals(peer, nextSkin);
    peer._walkPhase = 0;

    this.scene.add(peer.group);
    this._syncPeerPet(peer, nextSkin.equippedPet ?? rawSkin?.equippedPet);
    this._refreshBadge(peer);
  }

  setDivineSkin(id, specialtyInput) {
    const peer = this.peers.get(id);
    if (!peer) return null;
    if (isUltimateSecretSkinId(specialtyInput)) {
      return this.setSecretSkin(id);
    }
    const spec = resolveAscensionSpecialty(specialtyInput);
    const nextSkin = applySessionDivineSkin(peer.skin, spec.id);
    this.setSkin(id, nextSkin);
    peer.rankLabel = `Dieu CIEL (${spec.shortLabel})`;
    this._refreshBadge(peer);
    return spec;
  }

  setSecretSkin(id) {
    const peer = this.peers.get(id);
    if (!peer) return null;
    const nextSkin = applySessionDivineSkin(peer.skin, ULTIMATE_SECRET_SKIN_ID);
    this.setSkin(id, nextSkin);
    peer.rankLabel = 'Entité Quantique CIEL';
    this._refreshBadge(peer);
    return ULTIMATE_SECRET_SKIN;
  }

  teleportPeer(id, x, y, z, yaw = 0) {
    const peer = this.peers.get(id);
    if (!peer) return;
    const ny = Math.max(0, Number(y) || 0);
    peer.targetPos.set(x, ny, z);
    peer.targetYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : 0;
    peer.group.position.set(x, ny + (peer.levitationOffset || 0), z);
    peer.group.rotation.y = peer.targetYaw + Math.PI;
    peer.horizSpeed = 0;
  }

  setLevitation(id, yOffset = 0) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.levitationOffset = Math.max(0, Number(yOffset) || 0);
  }

  setCreatorAura(id, enabled) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.skin = { ...peer.skin };
    if (enabled) {
      peer.skin.creatorAura = true;
    } else {
      delete peer.skin.creatorAura;
    }
    peer.setCreatorAura?.(Boolean(enabled));
  }

  movePeer(id, x, y, z, yaw, vrData = undefined) {
    if (this._allowedPeerIds && !this._allowedPeerIds.has(id)) return;
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.targetPos.set(x, Math.max(0, Number(y) || 0), z);
    peer.targetYaw = yaw || 0;
    if (vrData !== undefined) {
      peer.vrData = vrData;
    }
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
    if (!this._miniMapScratch) {
      this._miniMapScratch = [];
    }
    const out = this._miniMapScratch;
    let idx = 0;
    for (const peer of this.peers.values()) {
      if (!peer.group.visible) continue;
      let slot = out[idx];
      if (!slot) {
        slot = { id: '', name: '', color: '', x: 0, z: 0, zoneLabel: '' };
        out[idx] = slot;
      }
      slot.id = peer.id;
      slot.name = peer.name;
      slot.color = peer.color;
      slot.x = peer.group.position.x;
      slot.z = peer.group.position.z;
      slot.zoneLabel = peer.zoneLabel;
      idx++;
    }
    out.length = idx;
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

  setPeerCombatWeapon(id, weaponId = null) {
    const peer = this.peers.get(id);
    if (!peer) return;
    const nextId = weaponId || null;
    if (peer.combatWeaponId === nextId && Boolean(peer.combatWeaponObj) === Boolean(nextId)) {
      return;
    }
    if (peer.combatWeaponObj) {
      peer.combatWeaponObj.group.parent?.remove(peer.combatWeaponObj.group);
      peer.combatWeaponObj.dispose?.();
      peer.combatWeaponObj = null;
    }
    peer.combatWeaponId = nextId;
    if (!nextId) return;
    const obj = buildCombatWeaponMesh(nextId, { viewModel: false });
    const vrRight = peer.vrTracker?.rightHand?.root;
    if (peer.vrData?.active && vrRight) {
      obj.group.position.set(0, -0.02, -0.06);
      vrRight.add(obj.group);
    } else if (peer.rightArm) {
      obj.group.position.set(0, -0.34, -0.14);
      peer.rightArm.add(obj.group);
    }
    peer.combatWeaponObj = obj;
  }

  triggerPeerAttackAnim(id) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.combatAttackUntil = Date.now() + 220;
    }
  }

  clearAllCombatWeapons() {
    for (const id of this.peers.keys()) {
      this.setPeerCombatWeapon(id, null);
    }
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (peer.combatWeaponObj) {
      peer.combatWeaponObj.group.parent?.remove(peer.combatWeaponObj.group);
      peer.combatWeaponObj.dispose?.();
      peer.combatWeaponObj = null;
      peer.combatWeaponId = null;
    }
    if (peer.petMesh) {
      if (peer.petMesh.group) {
        this.scene.remove(peer.petMesh.group);
      }
      peer.petMesh.dispose?.();
      peer.petMesh = null;
    }
    peer.vrTracker?.dispose?.();
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

  update(dt, elapsed = 0) {
    const smoothXZ = 1 - Math.exp(-15 * dt);
    const smoothY = 1 - Math.exp(-18 * dt);
    const smoothYaw = 1 - Math.exp(-13 * dt);
    const nowMs = Date.now();

    for (const peer of this.peers.values()) {
      const dx = peer.targetPos.x - peer.group.position.x;
      const dz = peer.targetPos.z - peer.group.position.z;
      const horizDist = Math.hypot(dx, dz);

      peer.group.position.x += dx * smoothXZ;
      peer.group.position.z += dz * smoothXZ;
      const desiredY = peer.targetPos.y + (peer.levitationOffset || 0);
      peer.group.position.y += (desiredY - peer.group.position.y) * smoothY;

      let diff = (peer.targetYaw + Math.PI) - peer.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      peer.group.rotation.y += diff * smoothYaw;

      if (!peer.group.visible) {
        if (peer.petMesh?.group) peer.petMesh.group.visible = false;
        continue;
      }

      const instantSpeed = dt > 0 ? (horizDist * smoothXZ) / dt : 0;
      peer.horizSpeed = peer.horizSpeed * 0.6 + instantSpeed * 0.4;

      const isMoving = horizDist > 0.025 || peer.horizSpeed > 0.25;
      const isGrounded = peer.group.position.y < 0.08;
      animateAvatarLimbs(peer, dt, {
        isMoving,
        isGrounded,
        speedRatio: Math.max(0.8, Math.min(1.5, peer.horizSpeed / 5.2))
      });
      if (peer.combatWeaponId && peer.rightArm) {
        peer.rightArm.rotation.x =
          peer.combatAttackUntil && nowMs < peer.combatAttackUntil ? -1.18 : -0.62;
        if (peer.combatWeaponObj) {
          animateCombatWeaponMesh(peer.combatWeaponObj, { elapsed });
        }
      }

      peer.updateEffects?.(elapsed);
      if (peer.petMesh) {
        if (peer.petMesh.group) {
          peer.petMesh.group.visible = peer.group.visible;
        }
        peer.petMesh.update(dt, elapsed, peer.group.position, peer.group.rotation.y - Math.PI);
      }
      peer.vrTracker?.update?.(peer.vrData, dt, elapsed);
      updateSpeechBubble(peer.bubble, dt);
      updateVoiceIndicatorSprite(peer.voiceIndicator, dt, peer.isSpeaking);
    }
  }
}
