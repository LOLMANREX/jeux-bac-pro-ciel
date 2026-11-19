import * as THREE from 'three';
import {
  animateCombatWeaponMesh,
  buildCombatWeaponMesh,
  getCombatWeaponById,
  getDefaultWeaponForMode,
  getWeaponVrErgonomics
} from '../world/CombatWeapons.js';

export const VR_FOREGRIP_GRAB_RADIUS = 0.24;
export const VR_FOREGRIP_HINT_RADIUS = 0.4;
export const VR_FOREGRIP_BREAKOUT_EXTRA = 0.48;
export const VR_TWO_HAND_SMOOTH_RATE = 18;

export class VRCombatController {
  constructor(vrManager) {
    this.vr = vrManager;
    this.active = false;
    this.mode = 'guns';
    this.callbacks = null;
    this.weaponObj = null;
    this.weaponId = null;

    this.adsActive = false;
    this.scopeZoomActive = false;
    this.guardActive = false;
    this.twoHanded = false;
    this.foregripInRange = false;
    this.foregripDistance = Infinity;

    this._lastAttackAt = 0;
    this._prevRightTrigger = false;
    this._prevRightGrip = false;
    this._prevRightAction = false;
    this._prevLeftAction = false;
    this._prevGuard = false;
    this._hasPrevRightHandPos = false;

    this._recoilZ = 0;
    this._recoilPitch = 0;
    this._recoilNorm = 0;
    this._pumpPhase = 0;
    this._returnBlend = 0;
    this._hitmarkerTimer = 0;
    this._hitmarkerMax = 0.22;
    this._worldHitTimer = 0;
    this._worldHitMax = 0.26;

    this._prevRightHandWorldPos = new THREE.Vector3();
    this._curRightHandWorldPos = new THREE.Vector3();
    this._domGripWorldPos = new THREE.Vector3();
    this._offHandWorldPos = new THREE.Vector3();
    this._foregripWorldPos = new THREE.Vector3();
    this._aimOrigin = new THREE.Vector3();
    this._aimDir = new THREE.Vector3(0, 0, -1);
    this._headPos = new THREE.Vector3();
    this._headDir = new THREE.Vector3(0, 0, -1);

    this._oneHandLocalQuat = new THREE.Quaternion();
    this._oneHandWorldQuat = new THREE.Quaternion();
    this._targetTwoHandWorldQuat = new THREE.Quaternion();
    this._smoothedTwoHandWorldQuat = new THREE.Quaternion();
    this._releaseStartLocalQuat = new THREE.Quaternion();
    this._parentWorldQuat = new THREE.Quaternion();
    this._parentWorldQuatInv = new THREE.Quaternion();

    this._xAxis = new THREE.Vector3();
    this._yAxis = new THREE.Vector3();
    this._zAxis = new THREE.Vector3();
    this._domUp = new THREE.Vector3();
    this._domRight = new THREE.Vector3();
    this._vecScratch = new THREE.Vector3();
    this._basisMat = new THREE.Matrix4();
    this._eulerScratch = new THREE.Euler(0, 0, 0, 'YXZ');

    this.weaponPivot = new THREE.Group();
    this.weaponPivot.name = 'vr-combat-weapon-pivot';
    this.recoilGroup = new THREE.Group();
    this.recoilGroup.name = 'vr-combat-weapon-recoil';
    this.weaponPivot.add(this.recoilGroup);
    if (this.vr?.slots?.right?.visualParent) {
      this.vr.slots.right.visualParent.add(this.weaponPivot);
    }

    this.reticleGroup = new THREE.Group();
    this.reticleGroup.name = 'vr-combat-reticle';
    this.reticleGroup.rotation.y = Math.PI;
    this.reticleGroup.visible = false;

    this.reticleMat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthTest: false
    });
    this.reticleRing = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.032, 20), this.reticleMat);
    this.reticleDot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), this.reticleMat);
    this.reticleGroup.add(this.reticleRing);
    this.reticleGroup.add(this.reticleDot);

    this.hitmarkerGroup = new THREE.Group();
    this.hitmarkerGroup.name = 'vr-combat-hitmarker';
    this.hitmarkerGroup.visible = false;
    this.hitmarkerMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthTest: false
    });
    const barGeo = new THREE.PlaneGeometry(0.034, 0.0075);
    const barSpecs = [
      [-0.022, 0.022, -Math.PI / 4],
      [0.022, 0.022, Math.PI / 4],
      [-0.022, -0.022, Math.PI / 4],
      [0.022, -0.022, -Math.PI / 4]
    ];
    for (let i = 0; i < barSpecs.length; i++) {
      const bar = new THREE.Mesh(barGeo, this.hitmarkerMat);
      bar.position.set(barSpecs[i][0], barSpecs[i][1], 0.002);
      bar.rotation.z = barSpecs[i][2];
      this.hitmarkerGroup.add(bar);
    }
    this.reticleGroup.add(this.hitmarkerGroup);

    this.foregripHaloGroup = new THREE.Group();
    this.foregripHaloGroup.name = 'vr-foregrip-halo';
    this.foregripHaloGroup.visible = false;
    this.foregripHaloMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.foregripHaloRing = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0042, 8, 22), this.foregripHaloMat);
    this.foregripHaloRing.rotation.x = Math.PI / 2;
    this.foregripHaloGroup.add(this.foregripHaloRing);

    this.worldHitRingMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthTest: false
    });
    this.worldHitRing = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.145, 20), this.worldHitRingMat);
    this.worldHitRing.name = 'vr-world-hit-ring';
    this.worldHitRing.visible = false;
    this.vr?.sceneMgr?.scene?.add?.(this.worldHitRing);
  }

  _ensurePivotAttached() {
    const rightVisual = this.vr?.slots?.right?.visualParent;
    if (rightVisual && this.weaponPivot.parent !== rightVisual) {
      rightVisual.add(this.weaponPivot);
    }
  }

  _isXrControllerMode() {
    const slot = this.vr?.slots?.right;
    return Boolean(!this.vr?.simMode && slot && slot.trackingMode !== 'hand');
  }

  _computeOneHandLocalPose() {
    const spec = getCombatWeaponById(this.weaponId) || getDefaultWeaponForMode(this.mode);
    const ergo = getWeaponVrErgonomics(spec.id);
    if (this._isXrControllerMode()) {
      this.weaponPivot.position.set(0, 0.008, -0.015);
      this._eulerScratch.set(ergo.vrPitchOffset, 0, 0, 'YXZ');
      this._oneHandLocalQuat.setFromEuler(this._eulerScratch);
    } else {
      this.weaponPivot.position.set(0, 0, -0.02);
      this._oneHandLocalQuat.identity();
    }
  }

  _syncReticleStyle(weaponId) {
    const spec = getCombatWeaponById(weaponId);
    if (!spec || !this.active || !this.weaponObj?.muzzle) {
      this.reticleGroup.visible = false;
      return;
    }
    if (this.reticleGroup.parent !== this.weaponObj.muzzle) {
      this.weaponObj.muzzle.add(this.reticleGroup);
    }
    this.reticleMat.color.set(spec.beamColor || '#22d3ee');
    if (spec.id === 'udp_shotgun') {
      this.reticleRing.scale.setScalar(2.15);
    } else if (spec.id === 'ping_sniper') {
      this.reticleRing.scale.setScalar(0.85);
    } else if (spec.mode === 'melee') {
      this.reticleRing.scale.setScalar(1.3);
    } else {
      this.reticleRing.scale.setScalar(1.1);
    }
    this.reticleGroup.position.set(0, 0, this.mode === 'melee' ? 1.4 : 2.6);
    this.reticleGroup.visible = true;
  }

  setWeaponModel(weaponId = null) {
    const cleanId = weaponId ? String(weaponId) : null;
    if (this.weaponId === cleanId && Boolean(this.weaponObj) === Boolean(cleanId)) {
      this._syncReticleStyle(cleanId);
      return this.weaponObj;
    }
    if (this.reticleGroup.parent) {
      this.reticleGroup.parent.remove(this.reticleGroup);
    }
    if (this.foregripHaloGroup.parent) {
      this.foregripHaloGroup.parent.remove(this.foregripHaloGroup);
    }
    if (this.weaponObj) {
      this.weaponObj.group.parent?.remove(this.weaponObj.group);
      this.weaponObj.dispose?.();
      this.weaponObj = null;
    }
    this.weaponId = cleanId;
    this.twoHanded = false;
    this.foregripInRange = false;
    this._returnBlend = 0;
    this._recoilZ = 0;
    this._recoilPitch = 0;
    this._recoilNorm = 0;

    if (!cleanId) {
      this.reticleGroup.visible = false;
      this.foregripHaloGroup.visible = false;
      return null;
    }

    this._ensurePivotAttached();
    const obj = buildCombatWeaponMesh(cleanId, { viewModel: true });
    const s = obj.group.scale.x || 0.96;
    const gOff = obj.gripOffset || { x: 0, y: 0, z: 0 };
    obj.group.position.set(-gOff.x * s, -gOff.y * s, -gOff.z * s);
    this.recoilGroup.add(obj.group);
    if (obj.foregripAnchor) {
      obj.foregripAnchor.add(this.foregripHaloGroup);
      this.foregripHaloGroup.position.set(0, 0, 0);
      this.foregripHaloGroup.visible = false;
    }
    this.weaponObj = obj;
    this._computeOneHandLocalPose();
    this.weaponPivot.quaternion.copy(this._oneHandLocalQuat);
    this.recoilGroup.position.set(0, 0, 0);
    this.recoilGroup.rotation.set(0, 0, 0);
    this._syncReticleStyle(cleanId);
    this.weaponPivot.updateMatrixWorld(true);
    return obj;
  }

  setMode(active, opts = {}) {
    this.active = Boolean(active);
    this._hasPrevRightHandPos = false;
    this._lastAttackAt = 0;
    this._prevRightTrigger = false;
    this._prevRightGrip = false;
    this._prevRightAction = false;
    this._prevLeftAction = false;
    this._prevGuard = false;
    this.adsActive = false;
    this.scopeZoomActive = false;
    this.guardActive = false;
    this.twoHanded = false;
    this.foregripInRange = false;
    this.foregripDistance = Infinity;
    this._recoilZ = 0;
    this._recoilPitch = 0;
    this._recoilNorm = 0;
    this._pumpPhase = 0;
    this._returnBlend = 0;
    this._hitmarkerTimer = 0;
    this._worldHitTimer = 0;
    this.hitmarkerGroup.visible = false;
    this.worldHitRing.visible = false;

    if (!this.active) {
      this.mode = 'guns';
      this.callbacks = null;
      this.setWeaponModel(null);
      this.reticleGroup.visible = false;
      this.foregripHaloGroup.visible = false;
      this.vr?.wristPanel?.updateState?.({ combatStatus: null });
      return false;
    }
    this.mode = opts.mode === 'melee' ? 'melee' : 'guns';
    this.callbacks = opts.callbacks || null;
    if (opts.weaponId) {
      this.setWeaponModel(opts.weaponId);
    }
    return true;
  }

  getMuzzleRay(outOrigin = this._aimOrigin, outDir = this._aimDir) {
    if (!this.weaponObj?.muzzle) return null;
    this.weaponPivot.updateMatrixWorld(true);
    this.weaponObj.muzzle.getWorldPosition(outOrigin);
    this.weaponObj.muzzle.getWorldDirection(outDir);
    if (outDir.lengthSq() < 1e-6) {
      outDir.set(0, 0, -1);
    } else {
      outDir.normalize();
    }
    return { origin: outOrigin, dir: outDir };
  }

  triggerHitFeedback({ killed = false, headshot = false, damage = 0, hitPos = null } = {}) {
    if (!this.active) return false;
    this._hitmarkerMax = killed ? 0.34 : 0.22;
    this._hitmarkerTimer = this._hitmarkerMax;
    this.hitmarkerMat.color.set(killed ? '#ff2e4c' : headshot ? '#fde047' : '#ffffff');
    this.hitmarkerMat.opacity = 1;
    this.hitmarkerGroup.scale.setScalar(killed ? 1.55 : headshot ? 1.3 : 1.15);
    this.hitmarkerGroup.visible = true;

    if (hitPos && Number.isFinite(Number(hitPos.x)) && Number.isFinite(Number(hitPos.y)) && Number.isFinite(Number(hitPos.z))) {
      if (this.vr?.sceneMgr?.scene && this.worldHitRing.parent !== this.vr.sceneMgr.scene) {
        this.vr.sceneMgr.scene.add(this.worldHitRing);
      }
      this.worldHitRing.position.set(Number(hitPos.x), Number(hitPos.y), Number(hitPos.z));
      this.worldHitRingMat.color.set(killed ? '#ff2e4c' : headshot ? '#fde047' : '#38bdf8');
      this.worldHitRingMat.opacity = 0.95;
      this.worldHitRing.scale.setScalar(killed ? 1.4 : 1.0);
      this.worldHitRing.visible = true;
      this._worldHitMax = killed ? 0.32 : 0.22;
      this._worldHitTimer = this._worldHitMax;
    }

    const hitIntensity = killed ? 0.95 : headshot ? 0.78 : Math.min(0.72, 0.48 + (Number(damage) || 0) * 0.005);
    const hitDuration = killed ? 85 : 40;
    this.vr._pulseHaptic(this.vr.slots.right, hitIntensity, hitDuration);
    if (this.twoHanded) {
      this.vr._pulseHaptic(this.vr.slots.left, hitIntensity * 0.65, Math.round(hitDuration * 0.8));
    }
    return true;
  }

  _updateTwoHandedGrip(dt, leftState, elapsed) {
    const domSlot = this.vr.slots.right;
    const offSlot = this.vr.slots.left;
    const domVisual = domSlot.visualParent;
    const offVisual = offSlot.visualParent;

    this._ensurePivotAttached();
    this._computeOneHandLocalPose();

    domVisual.updateWorldMatrix(true, false);
    offVisual.updateWorldMatrix(true, false);
    domVisual.getWorldQuaternion(this._parentWorldQuat);
    this._oneHandWorldQuat.copy(this._parentWorldQuat).multiply(this._oneHandLocalQuat);

    this._domGripWorldPos.copy(this.weaponPivot.position).applyMatrix4(domVisual.matrixWorld);
    offVisual.getWorldPosition(this._offHandWorldPos);

    if (!this.twoHanded) {
      this.weaponPivot.quaternion.copy(this._oneHandLocalQuat);
    }
    this.weaponPivot.updateMatrixWorld(true);

    let distToForegrip = Infinity;
    let expectedForegripLen = 0.34;
    if (this.weaponObj?.foregripAnchor) {
      this.weaponObj.foregripAnchor.getWorldPosition(this._foregripWorldPos);
      distToForegrip = this._offHandWorldPos.distanceTo(this._foregripWorldPos);
      expectedForegripLen = Math.max(0.08, this._domGripWorldPos.distanceTo(this._foregripWorldPos));
    }
    this.foregripDistance = distToForegrip;

    const leftSqueezeHeld = Boolean((leftState?.gripVal || 0) > 0.55 || offSlot.xrSqueezePressed);
    const leftTriggerHeld = Boolean(leftState?.triggerPressed || (leftState?.triggerVal || 0) > 0.65);
    const secondaryGrabHeld = leftSqueezeHeld || leftTriggerHeld;

    const inGrabRange = distToForegrip <= VR_FOREGRIP_GRAB_RADIUS;
    if (!this.twoHanded && inGrabRange && !this.foregripInRange) {
      this.vr._pulseHaptic(offSlot, 0.22, 22);
    }
    this.foregripInRange = inGrabRange;

    if (!this.twoHanded && inGrabRange && secondaryGrabHeld && this.weaponObj?.foregripAnchor) {
      this.twoHanded = true;
      this.weaponPivot.getWorldQuaternion(this._smoothedTwoHandWorldQuat);
      this._returnBlend = 0;
      this.vr._pulseHaptic(offSlot, 0.42, 30);
      this.vr._pulseHaptic(domSlot, 0.2, 18);
    } else if (this.twoHanded) {
      const handSep = this._offHandWorldPos.distanceTo(this._domGripWorldPos);
      const maxSep = expectedForegripLen + VR_FOREGRIP_BREAKOUT_EXTRA;
      if (!secondaryGrabHeld || handSep > maxSep || handSep < 0.04) {
        this.twoHanded = false;
        this._releaseStartLocalQuat.copy(this.weaponPivot.quaternion);
        this._returnBlend = 1;
        this.vr._pulseHaptic(offSlot, 0.15, 16);
      }
    }

    if (this.twoHanded) {
      this._vecScratch.subVectors(this._offHandWorldPos, this._domGripWorldPos);
      if (this._vecScratch.lengthSq() > 1e-4) {
        this._vecScratch.normalize();
        this._zAxis.copy(this._vecScratch).negate();
        this._domUp.set(0, 1, 0).applyQuaternion(this._oneHandWorldQuat);
        this._xAxis.crossVectors(this._domUp, this._zAxis);
        if (this._xAxis.lengthSq() < 1e-5) {
          this._domRight.set(1, 0, 0).applyQuaternion(this._oneHandWorldQuat);
          this._yAxis.crossVectors(this._zAxis, this._domRight).normalize();
          this._xAxis.crossVectors(this._yAxis, this._zAxis).normalize();
        } else {
          this._xAxis.normalize();
          this._yAxis.crossVectors(this._zAxis, this._xAxis).normalize();
        }
        this._basisMat.makeBasis(this._xAxis, this._yAxis, this._zAxis);
        this._targetTwoHandWorldQuat.setFromRotationMatrix(this._basisMat);
        const alpha = 1 - Math.exp(-VR_TWO_HAND_SMOOTH_RATE * Math.max(0.001, Math.min(0.1, dt)));
        this._smoothedTwoHandWorldQuat.slerp(this._targetTwoHandWorldQuat, alpha);
      }
      this._parentWorldQuatInv.copy(this._parentWorldQuat).invert();
      this.weaponPivot.quaternion.copy(this._parentWorldQuatInv).multiply(this._smoothedTwoHandWorldQuat);

      this.foregripHaloGroup.visible = true;
      this.foregripHaloMat.color.set('#10b981');
      this.foregripHaloMat.opacity = 0.22;
      this.foregripHaloGroup.scale.setScalar(0.92);
    } else {
      if (this._returnBlend > 0.001) {
        this._returnBlend = Math.max(0, this._returnBlend - dt * 15);
        this.weaponPivot.quaternion.copy(this._oneHandLocalQuat).slerp(this._releaseStartLocalQuat, this._returnBlend);
      } else {
        this._returnBlend = 0;
        this.weaponPivot.quaternion.copy(this._oneHandLocalQuat);
      }

      if (distToForegrip <= VR_FOREGRIP_HINT_RADIUS && this.weaponObj?.foregripAnchor) {
        const pulse = 0.94 + Math.sin(elapsed * 8) * 0.09;
        this.foregripHaloGroup.visible = true;
        this.foregripHaloGroup.scale.setScalar(pulse);
        if (inGrabRange) {
          this.foregripHaloMat.color.set('#34d399');
          this.foregripHaloMat.opacity = 0.72;
        } else {
          this.foregripHaloMat.color.set('#38bdf8');
          this.foregripHaloMat.opacity = 0.38;
        }
      } else {
        this.foregripHaloGroup.visible = false;
      }
    }

    return { leftSqueezeHeld, leftTriggerHeld };
  }

  _updateRecoilAndVisuals(dt, elapsed) {
    const damp = this.twoHanded ? 16 : 11;
    const factor = Math.exp(-damp * Math.max(0.001, Math.min(0.1, dt)));
    this._recoilZ *= factor;
    this._recoilPitch *= factor;
    this._recoilNorm *= factor;
    if (this._recoilZ < 0.0004) this._recoilZ = 0;
    if (this._recoilPitch < 0.0004) this._recoilPitch = 0;
    if (this._recoilNorm < 0.001) this._recoilNorm = 0;
    if (this._pumpPhase > 0) {
      this._pumpPhase = Math.max(0, this._pumpPhase - dt * 3.1);
    }

    this.recoilGroup.position.set(0, 0, this._recoilZ);
    this.recoilGroup.rotation.set(this._recoilPitch, 0, 0);

    if (this.weaponObj) {
      animateCombatWeaponMesh(this.weaponObj, {
        elapsed,
        recoil: this._recoilNorm,
        pumpPhase: this._pumpPhase
      });
    }

    if (this._hitmarkerTimer > 0) {
      this._hitmarkerTimer = Math.max(0, this._hitmarkerTimer - dt);
      const t = this._hitmarkerMax > 0 ? this._hitmarkerTimer / this._hitmarkerMax : 0;
      this.hitmarkerMat.opacity = Math.min(1, t * 1.4);
      this.hitmarkerGroup.scale.setScalar(1.0 + t * 0.35);
      this.hitmarkerGroup.visible = this._hitmarkerTimer > 0;
    } else if (this.hitmarkerGroup.visible) {
      this.hitmarkerGroup.visible = false;
    }

    if (this._worldHitTimer > 0) {
      this._worldHitTimer = Math.max(0, this._worldHitTimer - dt);
      const t = this._worldHitMax > 0 ? this._worldHitTimer / this._worldHitMax : 0;
      this.worldHitRingMat.opacity = Math.min(0.95, t * 1.2);
      this.worldHitRing.scale.setScalar(0.85 + (1 - t) * 0.9);
      if (this.vr?.camera) {
        this.vr.camera.getWorldPosition(this._headPos);
        this.worldHitRing.lookAt(this._headPos);
      }
      this.worldHitRing.visible = this._worldHitTimer > 0;
    } else if (this.worldHitRing.visible) {
      this.worldHitRing.visible = false;
    }
  }

  _applyShotRecoilAndHaptics(spec) {
    const ergo = getWeaponVrErgonomics(spec.id);
    const mult = this.twoHanded ? ergo.recoil.twoHandMult : 1.0;
    this._recoilZ = Math.min(0.11, this._recoilZ + ergo.recoil.kickZ * mult);
    this._recoilPitch = Math.min(0.28, this._recoilPitch + ergo.recoil.pitchX * mult);
    this._recoilNorm = Math.min(1, this._recoilNorm + (this.twoHanded ? 0.45 : 1.0));
    if (spec.id === 'udp_shotgun') {
      this._pumpPhase = 1;
    }

    const baseIntensity = ergo.haptic?.intensity ?? (this.mode === 'melee' ? 0.85 : 0.7);
    const baseDuration = ergo.haptic?.durationMs ?? 45;
    this.vr._pulseHaptic(this.vr.slots.right, baseIntensity, baseDuration);
    if (this.twoHanded) {
      this.vr._pulseHaptic(this.vr.slots.left, Math.min(1, baseIntensity * 0.78), Math.round(baseDuration * 0.85));
    }
  }

  update(dt, nowMs, leftState, rightState, elapsed = 0) {
    if (!this.active || !this.vr.active || this.vr.worldPanel || this.vr.tpContext) {
      this._hasPrevRightHandPos = false;
      this.adsActive = false;
      this.scopeZoomActive = false;
      this.guardActive = false;
      this.twoHanded = false;
      this.foregripInRange = false;
      this.reticleGroup.visible = false;
      this.foregripHaloGroup.visible = false;
      return;
    }

    const spec = getCombatWeaponById(this.weaponId) || getDefaultWeaponForMode(this.mode);
    const { leftSqueezeHeld } = this._updateTwoHandedGrip(dt, leftState, elapsed);
    this._updateRecoilAndVisuals(dt, elapsed);

    const visualParent = this.vr.slots.right.visualParent;
    visualParent.getWorldPosition(this._curRightHandWorldPos);

    let handSpeed = 0;
    if (this._hasPrevRightHandPos && dt > 0.002) {
      handSpeed = this._curRightHandWorldPos.distanceTo(this._prevRightHandWorldPos) / dt;
    }
    this._prevRightHandWorldPos.copy(this._curRightHandWorldPos);
    this._hasPrevRightHandPos = true;

    this.getMuzzleRay(this._aimOrigin, this._aimDir);

    this.vr.camera?.getWorldPosition?.(this._headPos);
    this.vr.camera?.getWorldDirection?.(this._headDir);
    const handToHeadDist = this._curRightHandWorldPos.distanceTo(this._headPos);
    const aimHeadDot = this._aimDir.dot(this._headDir);
    const naturalSightAligned = handToHeadDist < 0.46 && aimHeadDot > 0.65;

    if (this.mode === 'guns') {
      this.adsActive = Boolean(naturalSightAligned || this.twoHanded || leftSqueezeHeld);
      this.scopeZoomActive = Boolean(this.adsActive && spec.id === 'ping_sniper');
      this.guardActive = false;
    } else {
      this.adsActive = false;
      this.scopeZoomActive = false;
      this.guardActive = Boolean((!this.twoHanded && leftSqueezeHeld) || (handToHeadDist < 0.46 && this._curRightHandWorldPos.y > this._headPos.y - 0.35));
    }

    if (this.guardActive !== this._prevGuard) {
      this._prevGuard = this.guardActive;
      this.callbacks?.onGuardChange?.(this.guardActive);
    }

    const showReticleBody = !naturalSightAligned || this.scopeZoomActive;
    this.reticleRing.visible = showReticleBody;
    this.reticleDot.visible = showReticleBody;
    this.reticleGroup.visible = Boolean(showReticleBody || this.hitmarkerGroup.visible);
    if (this.scopeZoomActive) {
      this.reticleGroup.position.set(0, 0, 0.55);
      this.reticleRing.scale.setScalar(1.65);
    } else {
      this.reticleGroup.position.set(0, 0, this.mode === 'melee' ? 1.4 : 2.6);
    }

    const triggerNow = Boolean(rightState?.triggerPressed);
    const triggerJust = triggerNow && !this._prevRightTrigger;
    this._prevRightTrigger = triggerNow;

    const gripNow = (rightState?.gripVal || 0) > 0.75;
    const gripJust = gripNow && !this._prevRightGrip;
    this._prevRightGrip = gripNow;

    const rActionNow = Boolean(rightState?.actionBtn);
    const rActionJust = rActionNow && !this._prevRightAction;
    this._prevRightAction = rActionNow;

    const lActionNow = Boolean(leftState?.actionBtn);
    const lActionJust = lActionNow && !this._prevLeftAction;
    this._prevLeftAction = lActionNow;

    if (gripJust || lActionJust) {
      this.vr._pulseHaptic(this.vr.slots.right, 0.35, 30);
      this.callbacks?.onCycleWeapon?.();
    }

    if (rActionJust) {
      if (this.mode === 'guns') {
        this.vr._pulseHaptic(this.vr.slots.right, 0.4, 35);
        this.callbacks?.onReload?.();
      } else {
        this.vr._pulseHaptic(this.vr.slots.right, 0.35, 30);
        this.callbacks?.onCycleWeapon?.();
      }
    }

    const cooldown = spec.fireRateMs || 280;
    let shouldAttack = false;
    let isVrSwing = false;

    if (this.mode === 'guns') {
      shouldAttack = spec.auto ? triggerNow : triggerJust;
    } else {
      isVrSwing = handSpeed >= 1.75;
      shouldAttack = triggerJust || isVrSwing;
    }

    if (shouldAttack && nowMs - this._lastAttackAt >= cooldown) {
      this._lastAttackAt = nowMs;
      const fireResult = this.callbacks?.onAttack?.({
        weaponId: this.weaponId || spec.id,
        origin: {
          x: this._aimOrigin.x,
          y: this._aimOrigin.y,
          z: this._aimOrigin.z
        },
        dir: {
          x: this._aimDir.x,
          y: this._aimDir.y,
          z: this._aimDir.z
        },
        isVrSwing,
        isVrShot: true,
        ads: this.adsActive,
        twoHanded: this.twoHanded
      });
      if (fireResult !== false) {
        this._applyShotRecoilAndHaptics(spec);
      }
    }
  }

  dispose() {
    this.setMode(false);
    this.reticleGroup.parent?.remove(this.reticleGroup);
    this.foregripHaloGroup.parent?.remove(this.foregripHaloGroup);
    this.worldHitRing.parent?.remove(this.worldHitRing);
    this.weaponPivot.parent?.remove(this.weaponPivot);
    this.reticleRing.geometry.dispose();
    this.reticleDot.geometry.dispose();
    this.reticleMat.dispose();
    this.hitmarkerGroup.children.forEach((c) => c.geometry?.dispose?.());
    this.hitmarkerMat.dispose();
    this.foregripHaloRing.geometry.dispose();
    this.foregripHaloMat.dispose();
    this.worldHitRing.geometry.dispose();
    this.worldHitRingMat.dispose();
  }
}
