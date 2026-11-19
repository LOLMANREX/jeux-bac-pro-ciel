import * as THREE from 'three';
import {
  applyShopSkin,
  buildStudentAvatarMesh,
  DEFAULT_SKIN,
  disposeObject3D
} from '../world/AvatarBuilder.js';
import { animateCombatWeaponMesh, buildCombatWeaponMesh, getCombatWeaponById } from '../world/CombatWeapons.js';
import { buildPetMesh } from '../world/PetBuilder.js';
import { pickLabInteractable } from '../world/SceneManager.js';
import { hasFullMapLineOfSight, pointCollidesWithColliders } from '../world/SurvivalEngine.js';
import { buildArticulatedVRHand } from './VRHandBuilder.js';
import { createTpSpatialPanel, createVrDebugPanel, createWristHudPanel } from './VRHudPanel.js';

const XR_FINGER_CHAINS = {
  thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  index: ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-tip'],
  middle: ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-tip'],
  ring: ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-tip'],
  pinky: ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-tip']
};

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export class VRManager {
  constructor(sceneMgr, player, options = {}) {
    this.sceneMgr = sceneMgr;
    this.player = player;
    this.options = options;

    this.xrSupported = false;
    this.xrSession = null;
    this.worldFloorY = Number.isFinite(Number(options.floorY)) ? Number(options.floorY) : 0;
    this.xrFloorFallbackOffset = 0;
    this.xrReferenceSpaceType = 'local-floor';
    this.simMode = false;
    this.active = false;
    this.isPrivateDebug = Boolean(options.isPrivateDebug);
    this.debugOverlayEnabled = Boolean(options.debugOverlayEnabled ?? this.isPrivateDebug);
    this.skin = options.skin || {};

    this.vrRig = new THREE.Group();
    this.vrRig.name = 'vr-rig';
    this.vrRig.userData.__isVrRig = true;

    this.simHeadGroup = new THREE.Group();
    this.simHandsGroup = new THREE.Group();
    this.simRightPivot = new THREE.Group();
    this.simLeftPivot = new THREE.Group();
    this.simHandsGroup.add(this.simLeftPivot);
    this.simHandsGroup.add(this.simRightPivot);
    this.vrRig.add(this.simHeadGroup);
    this.vrRig.add(this.simHandsGroup);

    this.renderer = sceneMgr?.renderer || null;
    this.camera = sceneMgr?.camera || null;
    this.sceneMgr?.bindVrManager?.(this);

    this.slots = {
      left: this._createHandSlot('left'),
      right: this._createHandSlot('right')
    };

    this.ctrlAssignments = [null, null];
    this.xrControllers = [];
    this.xrGrips = [];
    this.xrHands = [];

    this.wristPanel = createWristHudPanel({
      name: options.playerName || 'Eleve_CIEL',
      mapData: options.mapData || null
    });
    this.wristPanel.group.position.set(0.032, 0.036, 0.058);
    const wristBasis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0)
    );
    const wristBaseQuat = new THREE.Quaternion().setFromRotationMatrix(wristBasis);
    const wristRadialRoll = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -THREE.MathUtils.degToRad(42)
    );
    const wristUserTilt = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -THREE.MathUtils.degToRad(14)
    );
    this.wristPanel.group.quaternion
      .copy(wristRadialRoll)
      .multiply(wristBaseQuat)
      .multiply(wristUserTilt);
    this.slots.left.hand.root.add(this.wristPanel.group);
    this.wristPanel.group.visible = false;
    this.wristTouchPressed = false;
    this.wristDirectTouchHovered = false;

    this.debugPanel = createVrDebugPanel();
    this.debugPanel.group.visible = false;
    this.vrRig.add(this.debugPanel.group);
    this.xrErrors = [];
    this.frameCount = 0;

    this.tpPanel = null;
    this.worldPanel = null;
    this.activePcStation = null;
    this.shopPreviewGroup = null;
    this.shopPreviewObject = null;
    this.shopPreviewItemId = null;
    this.shopPreviewKind = null;
    this.tpContext = null;
    this.tpCamOffsetYaw = 0;
    this.tpZoomScale = 1;
    this.tpCurrentPose = null;
    this.savedExplorePose = null;

    this.snapAngleRad = THREE.MathUtils.degToRad(35);
    this.snapCooldownUntil = 0;
    this.snapNeedsRelease = false;
    this.lastSentVrSyncAt = 0;
    this.simWatchInspect = false;
    this.simGestureState = { trigger: 0, grip: 0, thumb: 0 };
    this.simStickState = { lx: 0, ly: 0, rx: 0, sprint: false };
    this.simKeys = new Set();
    this.simMouseTrigger = false;
    this.simLookPitch = -0.06;
    this.simLookYaw = 0;
    this.seatedMode = false;
    this.seatedPose = null;
    this.seatedAnchorLocalY = 0;
    this.seatedAnchorCaptured = false;
    this.hidingInRack = false;
    this.hidingPose = null;
    this.detentionHudHidden = false;
    this.combatActive = false;
    this.combatMode = 'guns';
    this.combatCallbacks = null;
    this.combatWeaponObj = null;
    this.combatWeaponId = null;
    this.combatAdsActive = false;
    this.combatScopeZoomActive = false;
    this.combatGuardActive = false;
    this.combatReticleGroup = null;
    this.combatReticleRing = null;
    this.combatReticleDot = null;
    this.combatReticleMat = null;
    this._combatLastAttackAt = 0;
    this._combatPrevRightTrigger = false;
    this._combatPrevRightGrip = false;
    this._combatPrevRightAction = false;
    this._combatPrevLeftAction = false;
    this._combatPrevGuard = false;
    this._hasPrevRightHandPos = false;
    this._prevRightHandWorldPos = new THREE.Vector3();
    this._curRightHandWorldPos = new THREE.Vector3();
    this._combatAimOrigin = new THREE.Vector3();
    this._combatAimDir = new THREE.Vector3();
    this._combatHeadPos = new THREE.Vector3();
    this._combatHeadDir = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.tempOrigin = new THREE.Vector3();
    this.tempDir = new THREE.Vector3();
    this.tempVecA = new THREE.Vector3();
    this.tempVecB = new THREE.Vector3();
    this.tempVecC = new THREE.Vector3();
    this.tempVecD = new THREE.Vector3();
    this.tempQuat = new THREE.Quaternion();
    this.lastForwardDir = new THREE.Vector3(0, 0, -1);
    this.lastXrLocalXZ = new THREE.Vector2(0, 0);
    this.defaultPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
    this.workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
    this.tempWorkPt = new THREE.Vector3();
    this.tempProjVec = new THREE.Vector3();
    this._worldSurfHoverThisFrame = new Map();

    this._onXrSessionEnd = () => {
      if (this.xrSession || this.active) {
        this._teardownSession();
      }
    };

    this._initXrControllers();
    this.checkSupport();
  }

  _createHandSlot(handedness) {
    const visualParent = new THREE.Group();
    const handMount = new THREE.Group();
    visualParent.add(handMount);

    const rayParent = new THREE.Group();
    const hand = buildArticulatedVRHand({ handedness, skin: this.skin });
    handMount.add(hand.root);

    const rayPts = [new THREE.Vector3(0, 0, -0.03), new THREE.Vector3(0, 0, -3.5)];
    const rayGeom = new THREE.BufferGeometry().setFromPoints(rayPts);
    const rayMat = new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.65
    });
    const rayLine = new THREE.Line(rayGeom, rayMat);
    rayParent.add(rayLine);

    const dotMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const dotMesh = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.017, 18), dotMat);
    dotMesh.visible = false;
    rayParent.add(dotMesh);

    const slot = {
      handedness,
      hand,
      handMount,
      visualParent,
      rayParent,
      rayLine,
      rayGeom,
      rayMat,
      dotMesh,
      dotMat,
      inputSource: null,
      trackingMode: 'controller',
      prevTrigger: false,
      prevActionBtn: false,
      xrSelectPressed: false,
      xrSelectQueued: false,
      hoveredKey: null,
      dragState: null,
      panelDrag: null,
      tpPanelTouchPressed: false,
      worldPanelTouchPressed: false,
      worldSurfTouchPressed: false,
      fingerPose: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 }
    };
    this._applySlotHandOffset(slot, 'controller');
    return slot;
  }

  _applySlotHandOffset(slot, mode) {
    if (!slot?.handMount) return;
    if (mode === 'hand' || this.simMode) {
      slot.handMount.position.set(0, 0, 0);
      slot.handMount.rotation.set(0, 0, 0);
      return;
    }
    const sign = slot.handedness === 'left' ? 1 : -1;
    slot.handMount.position.set(0.014 * sign, -0.014, 0.024);
    slot.handMount.rotation.set(-0.22, 0.05 * sign, 0.85 * sign);
  }

  _initXrControllers() {
    if (!this.renderer?.xr || typeof this.renderer.xr.getController !== 'function') return;

    this.renderer.xr.addEventListener?.('sessionend', this._onXrSessionEnd);

    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      const xrHand = typeof this.renderer.xr.getHand === 'function' ? this.renderer.xr.getHand(i) : null;
      ctrl.visible = false;
      grip.visible = false;
      this.vrRig.add(ctrl);
      this.vrRig.add(grip);
      if (xrHand) {
        xrHand.visible = false;
        this.vrRig.add(xrHand);
        this.xrHands.push(xrHand);
      }
      this.xrControllers.push(ctrl);
      this.xrGrips.push(grip);

      ctrl.addEventListener('connected', (ev) => {
        const src = ev.data || null;
        const otherSide = this.ctrlAssignments[1 - i];
        const fallbackSide = otherSide === 'left' ? 'right' : otherSide === 'right' ? 'left' : i === 0 ? 'left' : 'right';
        const side =
          src?.handedness === 'left'
            ? 'left'
            : src?.handedness === 'right'
              ? 'right'
              : fallbackSide;
        this.ctrlAssignments[i] = side;
        const slot = this.slots[side];
        slot.inputSource = src;
        slot.trackingMode = src?.hand ? 'hand' : 'controller';
        ctrl.visible = true;
        ctrl.add(slot.rayParent);

        if (src?.hand) {
          grip.visible = false;
          this.vrRig.add(slot.visualParent);
          this._applySlotHandOffset(slot, 'hand');
        } else {
          grip.visible = true;
          grip.add(slot.visualParent);
          slot.visualParent.position.set(0, 0, 0);
          slot.visualParent.quaternion.identity();
          this._applySlotHandOffset(slot, 'controller');
        }
      });

      ctrl.addEventListener('selectstart', () => {
        const side = this.ctrlAssignments[i];
        const slot = side ? this.slots[side] : null;
        if (!slot) return;
        slot.xrSelectPressed = true;
        slot.xrSelectQueued = true;
      });

      ctrl.addEventListener('selectend', () => {
        const side = this.ctrlAssignments[i];
        const slot = side ? this.slots[side] : null;
        if (!slot) return;
        slot.xrSelectPressed = false;
      });

      ctrl.addEventListener('disconnected', () => {
        const side = this.ctrlAssignments[i];
        this.ctrlAssignments[i] = null;
        if (side && this.slots[side]) {
          const slot = this.slots[side];
          slot.inputSource = null;
          slot.trackingMode = 'controller';
          slot.hoveredKey = null;
          slot.xrSelectPressed = false;
          slot.xrSelectQueued = false;
          slot.panelDrag = null;
          this._clearSlotDrag(slot);
        }
        ctrl.visible = false;
        grip.visible = false;
      });
    }
  }

  async checkSupport() {
    if (typeof navigator === 'undefined' || !navigator.xr?.isSessionSupported) {
      this.xrSupported = false;
      this.options.onStateChange?.(this.getPublicState());
      return false;
    }
    try {
      this.xrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch {
      this.xrSupported = false;
    }
    this.options.onStateChange?.(this.getPublicState());
    return this.xrSupported;
  }

  recordError(source, err) {
    const rawMsg =
      err instanceof Error
        ? `${err.name ? `${err.name}: ` : ''}${err.message || ''}`.trim()
        : typeof err === 'string'
          ? err
          : String(err || 'Erreur WebXR');
    const entry = `[${source}] ${rawMsg}`.slice(0, 140);
    if (this.xrErrors[this.xrErrors.length - 1] !== entry) {
      this.xrErrors.push(entry);
      if (this.xrErrors.length > 8) {
        this.xrErrors.shift();
      }
    }
  }

  getCapturedErrors() {
    const sceneErrs = this.sceneMgr?.getXrErrors?.() || [];
    const combined = [...this.xrErrors];
    for (const e of sceneErrs) {
      if (!combined.includes(e)) combined.push(e);
    }
    return combined.slice(-8);
  }

  getPublicState() {
    return {
      xrSupported: this.xrSupported,
      active: this.active,
      xrPresenting: Boolean(this.xrSession),
      simMode: this.simMode,
      isPrivateDebug: this.isPrivateDebug,
      debugOverlayEnabled: this.debugOverlayEnabled,
      debugPanelVisible: Boolean(this.debugPanel?.group?.visible),
      seatedMode: this.seatedMode,
      detentionHudHidden: this.detentionHudHidden,
      referenceSpaceType: this.simMode ? 'sim' : this.xrReferenceSpaceType,
      rigPosition: {
        x: Number(this.vrRig.position.x.toFixed(2)),
        y: Number(this.vrRig.position.y.toFixed(2)),
        z: Number(this.vrRig.position.z.toFixed(2))
      },
      frameCount: this.frameCount,
      errors: this.getCapturedErrors()
    };
  }

  shouldShowDebugPanel() {
    return Boolean(this.active && this.debugOverlayEnabled && !this.detentionHudHidden);
  }

  _applyDebugPanelVisibility() {
    const show = this.shouldShowDebugPanel();
    if (this.debugPanel?.setVisible) {
      this.debugPanel.setVisible(show);
    } else if (this.debugPanel?.group) {
      this.debugPanel.group.visible = show;
    }
    if (show) {
      this.vrRig?.updateMatrixWorld?.(true);
      this.debugPanel.updateTransform(this.vrRig, this.camera, 1, true);
      this._syncDebugPanel(true);
    }
  }

  setPrivateDebug(enabled) {
    this.isPrivateDebug = Boolean(enabled);
    this.debugOverlayEnabled = this.isPrivateDebug;
    this._applyDebugPanelVisibility();
    this.options.onStateChange?.(this.getPublicState());
    return this.isPrivateDebug;
  }

  setDebugPanelEnabled(enabled) {
    this.debugOverlayEnabled = Boolean(enabled);
    this._applyDebugPanelVisibility();
    this.options.onStateChange?.(this.getPublicState());
    return this.debugOverlayEnabled;
  }

  toggleDebugPanel() {
    return this.setDebugPanelEnabled(!this.debugOverlayEnabled);
  }

  isVrActive() {
    return this.active;
  }

  setSkin(skin) {
    this.skin = skin || {};
    this.slots.left.hand.applySkin(this.skin);
    this.slots.right.hand.applySkin(this.skin);
  }

  setMapData(mapData) {
    this.wristPanel.setMapData(mapData);
  }

  updateMiniMap(data = {}) {
    this.wristPanel.updateMiniMap(data);
  }

  updateHudInfo(info = {}) {
    this.wristPanel.updateState({
      ...info,
      vrLabel: this.xrSession ? 'Quitter VR' : 'Quitter Sim VR'
    });
  }

  async toggleVr() {
    if (this.active) {
      await this.exitVr();
      return false;
    }
    return this.enterVr();
  }

  async enterVr() {
    if (this.active) return true;
    if (typeof navigator !== 'undefined' && typeof navigator.xr?.requestSession === 'function' && this.renderer?.xr) {
      this.renderer.xr.enabled = true;
      let session = null;
      let lastErr = null;
      try {
        session = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['bounded-floor', 'hand-tracking']
        });
      } catch (err) {
        lastErr = err;
        if (err && (err.name === 'NotSupportedError' || err.name === 'TypeError' || err.name === 'OverconstrainedError')) {
          try {
            session = await navigator.xr.requestSession('immersive-vr', {
              optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
            });
            lastErr = null;
          } catch (fallbackErr) {
            lastErr = fallbackErr;
            session = null;
          }
        }
      }
      if (session) {
        this.xrSupported = true;
        try {
          await this._activateXrSession(session);
          return true;
        } catch (actErr) {
          this.recordError('setSession', actErr);
          try {
            await session.end?.();
          } catch {
          }
          this._teardownSession();
          this.options.onToast?.(
            `Erreur démarrage session WebXR : ${actErr?.message || actErr}`,
            'error'
          );
          return false;
        }
      }
      if (lastErr) {
        this.recordError('requestSession', lastErr);
        if (lastErr.name === 'SecurityError' || lastErr.name === 'NotAllowedError') {
          this.options.onToast?.(
            'Autorisation WebXR requise : cliquez directement sur « Mode VR » dans la barre supérieure.',
            'info'
          );
          return false;
        }
      }
      this.options.onToast?.(
        'Casque WebXR non détecté : passage en Mode Simulation VR sur PC (Touche F9).',
        'info'
      );
    } else {
      this.options.onToast?.(
        'WebXR indisponible sur ce navigateur : activation du Mode Simulation VR PC (F9).',
        'info'
      );
    }
    return this.enterSimulationMode();
  }

  async _activateXrSession(session) {
    let refType = 'local-floor';
    if (typeof session.requestReferenceSpace === 'function') {
      try {
        await session.requestReferenceSpace('local-floor');
      } catch {
        refType = 'local';
      }
    }

    this.xrReferenceSpaceType = refType;
    this.xrFloorFallbackOffset = refType === 'local' ? 1.65 : 0;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType(refType);
    this.renderer.setRenderTarget?.(null);

    await this.renderer.xr.setSession(session);

    this.xrSession = session;
    this.simMode = false;
    this.active = true;
    this.frameCount = 0;

    session.addEventListener('end', this._onXrSessionEnd);
    this.sceneMgr?.setVrPresentingState?.(true);
    this._mountVrRigForWorld(false);
    this.wristPanel.setForceVisible(false);
    this._applyDebugPanelVisibility();
    this.options.onEnterVr?.({ mode: 'xr', referenceSpaceType: refType });
    this.options.onStateChange?.(this.getPublicState());
    this.options.onToast?.(`🥽 Mode VR WebXR (Quest / ${refType}) activé !`, 'success');
  }

  handleXrSessionStart() {
    this.sceneMgr?.setVrPresentingState?.(true);
    if (this.active && !this.simMode && this.camera && this.camera.parent !== this.vrRig) {
      this._mountVrRigForWorld(false);
    }
    if (this.active) {
      this._applyDebugPanelVisibility();
    }
  }

  enterSimulationMode() {
    if (this.xrSession) return false;
    this.simMode = true;
    this.active = true;
    this.simWatchInspect = false;
    this.xrFloorFallbackOffset = 0;
    this.frameCount = 0;

    this.simRightPivot.add(this.slots.right.rayParent);
    this.simRightPivot.add(this.slots.right.visualParent);
    this.simLeftPivot.add(this.slots.left.rayParent);
    this.simLeftPivot.add(this.slots.left.visualParent);
    this._applySlotHandOffset(this.slots.left, 'hand');
    this._applySlotHandOffset(this.slots.right, 'hand');

    this.simLeftPivot.position.set(-0.26, -0.32, -0.42);
    this.simLeftPivot.rotation.set(0.22, -0.22, 0.18);
    this.simRightPivot.position.set(0.26, -0.32, -0.44);
    this.simRightPivot.rotation.set(0.05, 0.04, -0.04);

    this._mountVrRigForWorld(true);
    this.wristPanel.setForceVisible(false);
    this._applyDebugPanelVisibility();
    this.options.onEnterVr?.({ mode: 'sim', referenceSpaceType: 'sim' });
    this.options.onStateChange?.(this.getPublicState());
    this.options.onToast?.(
      '🥽 Simulation VR PC active (F9 quitter • H smartwatch minimap • F grip • G pouce • Clic laser)',
      'success'
    );
    return true;
  }

  _resolveClearRigPose() {
    const fallbackX = -3.95;
    const fallbackZ = 0.65;
    const rawX = Number(this.player?.position?.x);
    const rawZ = Number(this.player?.position?.z);
    const yaw = Number.isFinite(Number(this.player?.yaw)) ? Number(this.player.yaw) : 0;

    let x = Number.isFinite(rawX) ? rawX : fallbackX;
    let z = Number.isFinite(rawZ) ? rawZ : fallbackZ;
    const bnd = this.player?.bounds;
    const outOfBounds =
      bnd &&
      (x < bnd.minX + 0.45 || x > bnd.maxX - 0.45 || z < bnd.minZ + 0.45 || z > bnd.maxZ - 0.45);
    const blocked = typeof this.player?._collides === 'function' && this.player._collides(x, z);
    if (outOfBounds || blocked) {
      x = fallbackX;
      z = fallbackZ;
      this.player?.setVrPose?.({ x, z, yaw });
    }
    return { x, z, yaw };
  }

  _mountVrRigForWorld(isSim) {
    if (!this.sceneMgr?.scene || !this.camera) return;
    this.sceneMgr.scene.add(this.vrRig);
    const { x: targetX, z: targetZ, yaw } = this._resolveClearRigPose();
    const groundY = this.worldFloorY;

    this.vrRig.scale.set(1, 1, 1);
    this.camera.scale.set(1, 1, 1);
    this.camera.near = 0.05;
    this.camera.far = Math.max(180, Number(this.camera.far) || 180);
    if (!this.renderer?.xr?.isPresenting) {
      this.camera.updateProjectionMatrix();
    }

    if (isSim) {
      this.vrRig.position.set(targetX, groundY, targetZ);
      this.vrRig.rotation.set(0, yaw, 0);
      this.simLookYaw = 0;
      this.simLookPitch = Number.isFinite(Number(this.player?.pitch)) ? this.player.pitch : -0.06;
      this.camera.position.set(0, 1.65, 0);
      this.camera.rotation.set(this.simLookPitch, 0, 0, 'YXZ');
      this.vrRig.add(this.camera);
      this.simHandsGroup.position.set(0, 1.65, 0);
    } else {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const lx = Number.isFinite(this.lastXrLocalXZ.x) ? this.lastXrLocalXZ.x : 0;
      const lz = Number.isFinite(this.lastXrLocalXZ.y) ? this.lastXrLocalXZ.y : 0;
      const worldOffX = lx * cosY + lz * sinY;
      const worldOffZ = -lx * sinY + lz * cosY;
      this.vrRig.position.set(
        targetX - worldOffX,
        groundY + this.xrFloorFallbackOffset,
        targetZ - worldOffZ
      );
      this.vrRig.rotation.set(0, yaw, 0);
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0, 'YXZ');
      this.vrRig.add(this.camera);
    }

    this.vrRig.add(this.debugPanel.group);
    this.vrRig.updateMatrixWorld(true);
    if (this.seatedMode && this.seatedPose) {
      this.setSeatedMode(true, this.seatedPose);
    }
    if (this.shouldShowDebugPanel()) {
      this.debugPanel.updateTransform(this.vrRig, this.camera, 1, true);
    }
    this.camera.getWorldDirection(this.tempVecB);
    const flatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
    if (flatLen > 0.08) {
      this.lastForwardDir.set(this.tempVecB.x / flatLen, 0, this.tempVecB.z / flatLen);
    }
  }

  async exitVr() {
    if (!this.active) return;
    if (this.xrSession) {
      const sess = this.xrSession;
      this.xrSession = null;
      try {
        await sess.end();
      } catch {
        this._teardownSession();
      }
      return;
    }
    this._teardownSession();
  }

  _teardownSession() {
    this._clearSlotDrag(this.slots.left);
    this._clearSlotDrag(this.slots.right);
    for (const s of [this.slots.left, this.slots.right]) {
      s.xrSelectPressed = false;
      s.xrSelectQueued = false;
      s.panelDrag = null;
      s.tpPanelTouchPressed = false;
      s.worldPanelTouchPressed = false;
    }
    if (this.tpContext) {
      this.detachTpContext();
    }
    this.closeWorldSpatialPanel();
    this.options.onHoverInteractable?.(null);
    this.active = false;
    this.simMode = false;
    this.simWatchInspect = false;
    this.simMouseTrigger = false;
    this.simKeys.clear();
    this.simStickState = { lx: 0, ly: 0, rx: 0, sprint: false };
    this.xrSession = null;
    this.xrFloorFallbackOffset = 0;
    this.lastXrLocalXZ.set(0, 0);
    this.seatedMode = false;
    this.seatedPose = null;
    this.seatedAnchorLocalY = 0;
    this.seatedAnchorCaptured = false;
    this.hidingInRack = false;
    this.hidingPose = null;
    this.setCombatMode(false);
    this.detentionHudHidden = false;
    this.wristPanel.setHudSuppressed?.(false);
    this.wristPanel.setForceVisible(false);
    this.wristPanel.group.visible = false;
    this.wristTouchPressed = false;
    this.wristDirectTouchHovered = false;
    if (this.debugPanel?.setVisible) {
      this.debugPanel.setVisible(false);
    } else if (this.debugPanel?.group) {
      this.debugPanel.group.visible = false;
    }
    this.sceneMgr?.setVrPresentingState?.(false);

    if (this.sceneMgr?.scene && this.camera) {
      this.sceneMgr.scene.add(this.camera);
      this.sceneMgr.scene.remove(this.vrRig);
    }
    this.player?._applyCamera?.();
    this.options.onExitVr?.();
    this.options.onStateChange?.(this.getPublicState());
  }

  toggleWristWatchSim() {
    if (!this.active) return false;
    this.simWatchInspect = !this.simWatchInspect;
    this.wristPanel.setForceVisible(this.simWatchInspect);
    if (!this.simWatchInspect) {
      this.wristPanel.group.visible = false;
    }
    return this.simWatchInspect;
  }

  setSimKey(code, pressed) {
    if (!this.simMode) return;
    if (pressed) this.simKeys.add(code);
    else this.simKeys.delete(code);
  }

  setSimInput({
    trigger,
    grip,
    thumb,
    lookDx = 0,
    lookDy = 0,
    mouseTrigger,
    lx,
    ly,
    rx,
    sprint
  } = {}) {
    if (!this.simMode) return;
    if (typeof trigger === 'number') this.simGestureState.trigger = trigger;
    if (typeof grip === 'number') this.simGestureState.grip = grip;
    if (typeof thumb === 'number') this.simGestureState.thumb = thumb;
    if (typeof mouseTrigger === 'boolean') this.simMouseTrigger = mouseTrigger;
    if (typeof lx === 'number') this.simStickState.lx = Math.max(-1, Math.min(1, lx));
    if (typeof ly === 'number') this.simStickState.ly = Math.max(-1, Math.min(1, ly));
    if (typeof rx === 'number') this.simStickState.rx = Math.max(-1, Math.min(1, rx));
    if (typeof sprint === 'boolean') this.simStickState.sprint = sprint;
    if (lookDx || lookDy) {
      this.simLookYaw -= lookDx * 0.004;
      this.simLookPitch = Math.max(-1.1, Math.min(1.1, this.simLookPitch - lookDy * 0.004));
      if (this.hidingInRack) {
        const maxY = Math.PI / 4;
        const maxP = (20 * Math.PI) / 180;
        this.simLookYaw = Math.max(-maxY, Math.min(maxY, this.simLookYaw));
        this.simLookPitch = Math.max(-maxP, Math.min(maxP, this.simLookPitch));
      }
    }
  }

  snapTurn(direction = 1) {
    if (!this.camera || !this.vrRig) return 0;
    const sign = direction >= 0 ? 1 : -1;
    const delta = -sign * this.snapAngleRad;
    this.vrRig.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.tempVecA);
    const beforeX = this.tempVecA.x;
    const beforeZ = this.tempVecA.z;
    this.vrRig.rotation.y += delta;
    this.vrRig.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.tempVecA);
    this.vrRig.position.x += beforeX - this.tempVecA.x;
    this.vrRig.position.z += beforeZ - this.tempVecA.z;
    this.vrRig.updateMatrixWorld(true);

    this.camera.getWorldDirection(this.tempVecB);
    const flatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
    if (flatLen > 0.08) {
      this.lastForwardDir.set(this.tempVecB.x / flatLen, 0, this.tempVecB.z / flatLen);
    }
    return delta;
  }

  openWorldSpatialPanel(mode = 'dialogue', state = {}, opts = {}) {
    if (!this.active || !this.sceneMgr?.scene) return null;
    if (this.tpContext) {
      this.detachTpContext();
    }
    this._clearVrShopPreview();
    if (this.worldPanel) {
      this.worldPanel.group.parent?.remove(this.worldPanel.group);
      this.worldPanel.dispose();
      this.worldPanel = null;
    }
    this.worldPanel = createTpSpatialPanel();
    if (Number.isFinite(Number(opts?.scale))) {
      this.worldPanel.group.scale.setScalar(Number(opts.scale));
    }
    this.sceneMgr.scene.add(this.worldPanel.group);
    if (this.camera) {
      this.camera.updateMatrixWorld(true);
      const dist = Number.isFinite(Number(opts?.dist)) ? Number(opts.dist) : 1.24;
      const yOffset = Number.isFinite(Number(opts?.yOffset)) ? Number(opts.yOffset) : 0.04;
      this.worldPanel.placeRelativeToCamera(this.camera, dist, yOffset);
    }
    this.worldPanel.updateState({ mode, ...state }, { immediate: true });
    return this.worldPanel;
  }

  _clearVrShopPreview() {
    if (this.shopPreviewGroup) {
      this.shopPreviewGroup.parent?.remove(this.shopPreviewGroup);
    }
    if (this.shopPreviewObject?.dispose) {
      this.shopPreviewObject.dispose();
    } else if (this.shopPreviewGroup) {
      disposeObject3D(this.shopPreviewGroup);
    }
    this.shopPreviewGroup = null;
    this.shopPreviewObject = null;
    this.shopPreviewItemId = null;
    this.shopPreviewKind = null;
  }

  _syncVrShopPreview(shopState) {
    const item = shopState?.selectedItem || null;
    if (!this.worldPanel || !item) {
      this._clearVrShopPreview();
      return;
    }
    if (this.shopPreviewItemId === item.id && this.shopPreviewGroup) {
      return;
    }
    this._clearVrShopPreview();
    const previewRoot = new THREE.Group();
    previewRoot.name = 'vr-shop-preview-root';
    previewRoot.position.set(0.92, -0.24, 0.08);
    this.worldPanel.group.add(previewRoot);

    const base = this.skin || DEFAULT_SKIN;
    if (item.category === 'pets') {
      const pet = buildPetMesh(item.id);
      pet.group.scale.setScalar(0.76);
      previewRoot.add(pet.group);
      this.shopPreviewObject = pet;
      this.shopPreviewKind = 'pets';
    } else if (item.category === 'skins') {
      const av = buildStudentAvatarMesh(applyShopSkin(base, item.id));
      av.group.scale.setScalar(0.36);
      previewRoot.add(av.group);
      this.shopPreviewObject = av;
      this.shopPreviewKind = 'skins';
    } else {
      const av = buildStudentAvatarMesh({ ...base, equippedTrail: item.id });
      av.group.scale.setScalar(0.36);
      previewRoot.add(av.group);
      this.shopPreviewObject = av;
      this.shopPreviewKind = 'accessories';
    }
    this.shopPreviewGroup = previewRoot;
    this.shopPreviewItemId = item.id;
  }

  openShopSpatialPanel(shopState, options = {}) {
    const panel = this.openWorldSpatialPanel(
      'shop',
      {
        title: '🛒 BOUTIQUE CIEL',
        shop: shopState
      },
      {
        dist: options.dist ?? 1.24,
        yOffset: options.yOffset ?? 0.04
      }
    );
    if (panel) {
      this._syncVrShopPreview(shopState);
    }
    return panel;
  }

  updateShopSpatialPanel(shopState) {
    if (!this.worldPanel || this.worldPanel.getState?.()?.mode !== 'shop') return;
    this.worldPanel.updateState({ mode: 'shop', shop: shopState });
    this._syncVrShopPreview(shopState);
  }

  closeShopSpatialPanel() {
    this._clearVrShopPreview();
    if (this.worldPanel?.getState?.()?.mode === 'shop') {
      this.closeWorldSpatialPanel();
      return true;
    }
    return false;
  }

  pulseBothHands(intensity = 0.9, durationMs = 280) {
    this._pulseHaptic(this.slots.left, intensity, durationMs);
    this._pulseHaptic(this.slots.right, intensity, durationMs);
  }

  syncWorldTeleport(x, z, yaw = null) {
    if (!this.active || !this.vrRig || !this.camera || this.tpContext) return false;
    const nextYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : Number(this.player?.yaw) || 0;
    const groundY = this.worldFloorY;
    if (this.simMode) {
      this.vrRig.position.set(x, groundY, z);
      this.vrRig.rotation.set(0, nextYaw, 0);
      this.simLookYaw = 0;
      this.vrRig.updateMatrixWorld(true);
    } else {
      const cosY = Math.cos(nextYaw);
      const sinY = Math.sin(nextYaw);
      const lx = Number.isFinite(this.camera.position.x) ? this.camera.position.x : 0;
      const lz = Number.isFinite(this.camera.position.z) ? this.camera.position.z : 0;
      const worldOffX = lx * cosY + lz * sinY;
      const worldOffZ = -lx * sinY + lz * cosY;
      this.vrRig.position.set(x - worldOffX, groundY + this.xrFloorFallbackOffset, z - worldOffZ);
      this.vrRig.rotation.set(0, nextYaw, 0);
      this.vrRig.updateMatrixWorld(true);
    }
    this.camera.getWorldDirection(this.tempVecB);
    const flatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
    if (flatLen > 0.08) {
      this.lastForwardDir.set(this.tempVecB.x / flatLen, 0, this.tempVecB.z / flatLen);
    }
    return true;
  }

  enterHidingRackVr(interiorX, interiorZ, yaw = 0, eyeY = 1.52) {
    const ix = Number.isFinite(Number(interiorX)) ? Number(interiorX) : Number(this.player?.position?.x) || 0;
    const iz = Number.isFinite(Number(interiorZ)) ? Number(interiorZ) : Number(this.player?.position?.z) || 0;
    const nextYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : 0;
    const ey = Number.isFinite(Number(eyeY)) ? Number(eyeY) : 1.52;
    this.hidingInRack = true;
    this.hidingPose = { x: ix, y: ey, z: iz, yaw: nextYaw };
    this.seatedMode = false;
    this.seatedPose = null;
    if (this.active && this.vrRig && this.camera) {
      this.syncWorldTeleport(ix, iz, nextYaw);
      if (this.simMode) {
        this.simLookYaw = 0;
        this.simLookPitch = 0;
        this.camera.position.set(0, ey, 0);
        this.camera.rotation.set(0, 0, 0, 'YXZ');
        this.simHandsGroup.position.set(0, ey, 0);
        this.simHandsGroup.rotation.set(0, 0, 0, 'YXZ');
      }
      this.vrRig.updateMatrixWorld(true);
    }
    this.player?.setVrPose?.({ x: ix, z: iz, yaw: nextYaw });
    return true;
  }

  exitHidingRackVr(exitX, exitZ, yaw = null) {
    this.closeWorldSpatialPanel?.();
    this.hidingInRack = false;
    this.hidingPose = null;
    this.seatedMode = false;
    this.seatedPose = null;
    this.player?.setHidingInRack?.(false);
    if (this.player) {
      this.player.setMovementLocked?.(false);
      this.player.setEnabled?.(true);
    }
    if (this.active) {
      if (this.simMode && this.camera) {
        this.simLookYaw = 0;
        this.simLookPitch = -0.05;
        this.camera.position.set(0, 1.65, 0);
        this.simHandsGroup.position.set(0, 1.65, 0);
      }
      return this.syncWorldTeleport(exitX, exitZ, yaw);
    }
    return false;
  }

  _ensureCombatReticle() {
    if (this.combatReticleGroup) return this.combatReticleGroup;
    const grp = new THREE.Group();
    grp.name = 'vr-combat-reticle';
    grp.position.set(0, 0, -2.4);
    grp.visible = false;
    const mat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthTest: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.032, 20), mat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), mat);
    grp.add(ring);
    grp.add(dot);
    this.slots.right.rayParent.add(grp);
    this.combatReticleGroup = grp;
    this.combatReticleRing = ring;
    this.combatReticleDot = dot;
    this.combatReticleMat = mat;
    return grp;
  }

  _syncCombatReticleStyle(weaponId) {
    const grp = this._ensureCombatReticle();
    const spec = getCombatWeaponById(weaponId);
    if (!spec || !this.combatActive) {
      grp.visible = false;
      return;
    }
    this.combatReticleMat.color.set(spec.beamColor || '#22d3ee');
    if (spec.id === 'udp_shotgun') {
      this.combatReticleRing.scale.setScalar(2.15);
      this.combatReticleRing.visible = true;
    } else if (spec.id === 'ping_sniper') {
      this.combatReticleRing.scale.setScalar(0.85);
      this.combatReticleRing.visible = true;
    } else if (spec.mode === 'melee') {
      this.combatReticleRing.scale.setScalar(1.3);
      this.combatReticleRing.visible = true;
    } else {
      this.combatReticleRing.scale.setScalar(1.1);
      this.combatReticleRing.visible = true;
    }
    grp.visible = true;
  }

  setCombatWeaponModel(weaponId = null) {
    const cleanId = weaponId ? String(weaponId) : null;
    if (this.combatWeaponId === cleanId && Boolean(this.combatWeaponObj) === Boolean(cleanId)) {
      this._syncCombatReticleStyle(cleanId);
      return this.combatWeaponObj;
    }
    if (this.combatWeaponObj) {
      this.combatWeaponObj.group.parent?.remove(this.combatWeaponObj.group);
      this.combatWeaponObj.dispose?.();
      this.combatWeaponObj = null;
    }
    this.combatWeaponId = cleanId;
    if (!cleanId) {
      if (this.combatReticleGroup) this.combatReticleGroup.visible = false;
      return null;
    }
    const obj = buildCombatWeaponMesh(cleanId, { viewModel: true });
    obj.group.position.set(0.01, -0.02, -0.08);
    this.slots.right.visualParent.add(obj.group);
    this.combatWeaponObj = obj;
    this._syncCombatReticleStyle(cleanId);
    return obj;
  }

  setCombatMode(active, opts = {}) {
    this.combatActive = Boolean(active);
    this._hasPrevRightHandPos = false;
    this._combatLastAttackAt = 0;
    this._combatPrevRightTrigger = false;
    this._combatPrevRightGrip = false;
    this._combatPrevRightAction = false;
    this._combatPrevLeftAction = false;
    this._combatPrevGuard = false;
    this.combatAdsActive = false;
    this.combatScopeZoomActive = false;
    this.combatGuardActive = false;
    if (!this.combatActive) {
      this.combatMode = 'guns';
      this.combatCallbacks = null;
      this.setCombatWeaponModel(null);
      if (this.combatReticleGroup) this.combatReticleGroup.visible = false;
      this.wristPanel?.updateState?.({ combatStatus: null });
      return false;
    }
    this.combatMode = opts.mode === 'melee' ? 'melee' : 'guns';
    this.combatCallbacks = opts.callbacks || null;
    if (opts.weaponId) {
      this.setCombatWeaponModel(opts.weaponId);
    }
    return true;
  }

  _updateCombatVr(dt, nowMs, leftState, rightState, elapsed = 0) {
    if (!this.combatActive || !this.active || this.worldPanel || this.tpContext) {
      this._hasPrevRightHandPos = false;
      this.combatAdsActive = false;
      this.combatScopeZoomActive = false;
      this.combatGuardActive = false;
      if (this.combatReticleGroup) this.combatReticleGroup.visible = false;
      return;
    }

    const spec = getCombatWeaponById(this.combatWeaponId);
    if (this.combatWeaponObj) {
      animateCombatWeaponMesh(this.combatWeaponObj, { elapsed });
    }
    const visualParent = this.slots.right.visualParent;
    visualParent.updateWorldMatrix?.(true, false);
    visualParent.getWorldPosition(this._curRightHandWorldPos);

    let handSpeed = 0;
    if (this._hasPrevRightHandPos && dt > 0.002) {
      handSpeed = this._curRightHandWorldPos.distanceTo(this._prevRightHandWorldPos) / dt;
    }
    this._prevRightHandWorldPos.copy(this._curRightHandWorldPos);
    this._hasPrevRightHandPos = true;

    const rayParent = this.slots.right.rayParent;
    rayParent.updateWorldMatrix?.(true, false);
    rayParent.getWorldPosition(this._combatAimOrigin);
    this.tempMatrix.extractRotation(rayParent.matrixWorld);
    this._combatAimDir.set(0, 0, -1).applyMatrix4(this.tempMatrix).normalize();

    this.camera?.getWorldPosition?.(this._combatHeadPos);
    this.camera?.getWorldDirection?.(this._combatHeadDir);
    const handToHeadDist = this._curRightHandWorldPos.distanceTo(this._combatHeadPos);
    const aimHeadDot = this._combatAimDir.dot(this._combatHeadDir);
    const leftGripHeld = (leftState?.gripVal || 0) > 0.65;
    const naturalSightAligned = handToHeadDist < 0.44 && aimHeadDot > 0.68;

    if (this.combatMode === 'guns') {
      this.combatAdsActive = Boolean(naturalSightAligned || leftGripHeld);
      this.combatScopeZoomActive = Boolean(this.combatAdsActive && spec?.id === 'ping_sniper');
      this.combatGuardActive = false;
    } else {
      this.combatAdsActive = false;
      this.combatScopeZoomActive = false;
      this.combatGuardActive = Boolean(leftGripHeld || (handToHeadDist < 0.46 && this._curRightHandWorldPos.y > this._combatHeadPos.y - 0.35));
    }

    if (this.combatGuardActive !== this._combatPrevGuard) {
      this._combatPrevGuard = this.combatGuardActive;
      this.combatCallbacks?.onGuardChange?.(this.combatGuardActive);
    }

    if (this.combatReticleGroup) {
      this.combatReticleGroup.visible = !this.combatAdsActive || this.combatScopeZoomActive;
      if (this.combatScopeZoomActive) {
        this.combatReticleGroup.position.set(0, 0, -0.55);
        this.combatReticleRing.scale.setScalar(1.65);
      } else {
        this.combatReticleGroup.position.set(0, 0, this.combatMode === 'melee' ? -1.4 : -2.4);
      }
    }

    const triggerNow = Boolean(rightState?.triggerPressed);
    const triggerJust = triggerNow && !this._combatPrevRightTrigger;
    this._combatPrevRightTrigger = triggerNow;

    const gripNow = (rightState?.gripVal || 0) > 0.75;
    const gripJust = gripNow && !this._combatPrevRightGrip;
    this._combatPrevRightGrip = gripNow;

    const rActionNow = Boolean(rightState?.actionBtn);
    const rActionJust = rActionNow && !this._combatPrevRightAction;
    this._combatPrevRightAction = rActionNow;

    const lActionNow = Boolean(leftState?.actionBtn);
    const lActionJust = lActionNow && !this._combatPrevLeftAction;
    this._combatPrevLeftAction = lActionNow;

    if (gripJust || lActionJust) {
      this._pulseHaptic(this.slots.right, 0.35, 30);
      this.combatCallbacks?.onCycleWeapon?.();
    }

    if (rActionJust) {
      if (this.combatMode === 'guns') {
        this._pulseHaptic(this.slots.right, 0.4, 35);
        this.combatCallbacks?.onReload?.();
      } else {
        this._pulseHaptic(this.slots.right, 0.35, 30);
        this.combatCallbacks?.onCycleWeapon?.();
      }
    }

    const cooldown = spec?.fireRateMs || 280;
    let shouldAttack = false;
    let isVrSwing = false;

    if (this.combatMode === 'guns') {
      shouldAttack = spec?.auto ? triggerNow : triggerJust;
    } else {
      isVrSwing = handSpeed >= 1.75;
      shouldAttack = triggerJust || isVrSwing;
    }

    if (shouldAttack && nowMs - this._combatLastAttackAt >= cooldown) {
      this._combatLastAttackAt = nowMs;
      this._pulseHaptic(this.slots.right, this.combatMode === 'melee' ? 0.85 : 0.7, 45);
      this.combatCallbacks?.onAttack?.({
        weaponId: this.combatWeaponId,
        origin: {
          x: this._combatAimOrigin.x,
          y: this._combatAimOrigin.y,
          z: this._combatAimOrigin.z
        },
        dir: {
          x: this._combatAimDir.x,
          y: this._combatAimDir.y,
          z: this._combatAimDir.z
        },
        isVrSwing,
        ads: this.combatAdsActive
      });
    }
  }

  setDetentionHudHidden(hidden) {
    this.detentionHudHidden = Boolean(hidden);
    this.wristPanel?.setHudSuppressed?.(this.detentionHudHidden);
    if (this.detentionHudHidden) {
      this.closeWorldSpatialPanel();
    }
    this._applyDebugPanelVisibility();
    this.options.onStateChange?.(this.getPublicState());
    return this.detentionHudHidden;
  }

  setSeatedMode(active, pose = null) {
    this.seatedMode = Boolean(active);
    if (!this.seatedMode) {
      this.seatedPose = null;
      this.seatedAnchorLocalY = 0;
      this.seatedAnchorCaptured = false;
      if (this.active && this.simMode && this.camera) {
        this.camera.position.set(0, 1.65, 0);
        this.simHandsGroup.position.set(0, 1.65, 0);
      }
      if (this.active) {
        this._stabilizeFloor();
        this.vrRig?.updateMatrixWorld?.(true);
      }
      this.options.onStateChange?.(this.getPublicState());
      return false;
    }

    const seatX = Number.isFinite(Number(pose?.x)) ? Number(pose.x) : Number(this.player?.position?.x) || 0;
    const seatY = Number.isFinite(Number(pose?.y)) ? Number(pose.y) : 1.28;
    const seatZ = Number.isFinite(Number(pose?.z)) ? Number(pose.z) : Number(this.player?.position?.z) || 0;
    const nextYaw = Number.isFinite(Number(pose?.yaw)) ? Number(pose.yaw) : 0;
    this.seatedPose = { x: seatX, y: seatY, z: seatZ, yaw: nextYaw };
    this.seatedAnchorLocalY = 0;
    this.seatedAnchorCaptured = false;

    if (this.active && this.vrRig && this.camera) {
      if (this.simMode) {
        this.vrRig.position.set(seatX, this.worldFloorY, seatZ);
        this.vrRig.rotation.set(0, nextYaw, 0);
        this.simLookYaw = 0;
        this.simLookPitch = Number.isFinite(Number(pose?.pitch)) ? Number(pose.pitch) : -0.08;
        this.camera.position.set(0, seatY, 0);
        this.camera.rotation.set(this.simLookPitch, 0, 0, 'YXZ');
        this.simHandsGroup.position.set(0, seatY, 0);
      } else {
        const cosY = Math.cos(nextYaw);
        const sinY = Math.sin(nextYaw);
        const lx = Number.isFinite(this.camera.position?.x) ? this.camera.position.x : 0;
        const lz = Number.isFinite(this.camera.position?.z) ? this.camera.position.z : 0;
        const worldOffX = lx * cosY + lz * sinY;
        const worldOffZ = -lx * sinY + lz * cosY;
        const curLocalY = Number(this.camera.position?.y) || 0;
        if (this.xrReferenceSpaceType === 'local') {
          this.seatedAnchorLocalY = 0;
          this.seatedAnchorCaptured = true;
        } else if (Math.abs(curLocalY) > 0.15) {
          this.seatedAnchorLocalY = curLocalY;
          this.seatedAnchorCaptured = true;
        }
        const rigY = this.seatedAnchorCaptured ? seatY - this.seatedAnchorLocalY : seatY - 1.55;
        this.vrRig.position.set(seatX - worldOffX, rigY, seatZ - worldOffZ);
        this.vrRig.rotation.set(0, nextYaw, 0);
      }
      this.vrRig.updateMatrixWorld(true);
      this.camera.getWorldDirection(this.tempVecB);
      const flatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
      if (flatLen > 0.08) {
        this.lastForwardDir.set(this.tempVecB.x / flatLen, 0, this.tempVecB.z / flatLen);
      }
    }
    if (typeof this.player?.setVrPose === 'function') {
      this.player.setVrPose({ x: seatX, z: seatZ, yaw: nextYaw });
    }
    this.options.onStateChange?.(this.getPublicState());
    return true;
  }

  applySurvivalIntroPose(x, z, lookTarget = null, safetyCtx = null) {
    if (!this.active) return false;
    let safeX = Number.isFinite(Number(x)) ? Number(x) : Number(this.player?.position?.x) || 0;
    let safeZ = Number.isFinite(Number(z)) ? Number(z) : Number(this.player?.position?.z) || 0;
    const colliders = Array.isArray(safetyCtx?.colliders) ? safetyCtx.colliders : null;
    const bounds = safetyCtx?.bounds || this.player?.bounds || null;

    if (lookTarget && Number.isFinite(Number(lookTarget.x)) && Number.isFinite(Number(lookTarget.z))) {
      const tx = Number(lookTarget.x);
      const tz = Number(lookTarget.z);
      if (
        colliders &&
        (pointCollidesWithColliders(safeX, safeZ, colliders, bounds, 0.36) ||
          !hasFullMapLineOfSight(tx, tz, safeX, safeZ, colliders, bounds, 0.32, 0.16))
      ) {
        const dx = safeX - tx;
        const dz = safeZ - tz;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          const steps = Math.max(6, Math.ceil(dist / 0.15));
          let bestX = tx;
          let bestZ = tz;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = tx + dx * t;
            const pz = tz + dz * t;
            if (pointCollidesWithColliders(px, pz, colliders, bounds, 0.36)) break;
            bestX = px;
            bestZ = pz;
          }
          safeX = bestX;
          safeZ = bestZ;
        }
      }
    }

    let yaw = Number(this.player?.yaw) || 0;
    if (lookTarget && Number.isFinite(Number(lookTarget.x)) && Number.isFinite(Number(lookTarget.z))) {
      yaw = Math.atan2(-(Number(lookTarget.x) - safeX), -(Number(lookTarget.z) - safeZ));
    }
    const ok = this.syncWorldTeleport(safeX, safeZ, yaw);
    if (ok && this.simMode) {
      this.simLookPitch = -0.04;
      this.camera?.rotation?.set(this.simLookPitch, 0, 0, 'YXZ');
    }
    return ok;
  }

  updateWorldSpatialPanel(state = {}) {
    if (!this.worldPanel) return;
    this.worldPanel.updateState(state);
  }

  openCielOsPanel(pcStation, options = {}) {
    if (!this.active || !this.sceneMgr?.scene || !pcStation?.desktop) return null;
    if (this.tpContext) {
      this.detachTpContext();
    }
    this.closeWorldSpatialPanel();

    const screenWidth = 1.38;
    const screenHeight = 0.86;
    const group = new THREE.Group();
    group.name = `vr-ciel-os-panel-${pcStation.id}`;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(screenWidth + 0.05, screenHeight + 0.05, 0.022),
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        metalness: 0.72,
        roughness: 0.26,
        emissive: '#0284c7',
        emissiveIntensity: 0.35
      })
    );
    frame.position.z = -0.012;
    group.add(frame);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(screenWidth, screenHeight),
      new THREE.MeshBasicMaterial({
        map: pcStation.texture,
        transparent: true,
        opacity: 0.99
      })
    );
    group.add(screenMesh);
    this.sceneMgr.scene.add(group);

    const placeRelativeToCamera = (camera, dist = 1.08, yOffset = -0.02) => {
      if (!camera) return;
      camera.updateMatrixWorld(true);
      camera.getWorldPosition(this.tempVecA);
      camera.getWorldDirection(this.tempVecB);
      this.tempVecB.y = 0;
      if (this.tempVecB.lengthSq() < 1e-6) {
        this.tempVecB.set(0, 0, -1);
      } else {
        this.tempVecB.normalize();
      }
      group.position.set(
        this.tempVecA.x + this.tempVecB.x * dist,
        this.tempVecA.y + yOffset,
        this.tempVecA.z + this.tempVecB.z * dist
      );
      group.lookAt(this.tempVecA.x, this.tempVecA.y, this.tempVecA.z);
      group.updateMatrixWorld(true);
    };

    if (this.camera) {
      const dist = Number.isFinite(Number(options.dist)) ? Number(options.dist) : 1.08;
      const yOffset = Number.isFinite(Number(options.yOffset)) ? Number(options.yOffset) : -0.02;
      placeRelativeToCamera(this.camera, dist, yOffset);
    }

    this.activePcStation = pcStation;
    pcStation.isActiveSession = true;
    const prevExit = pcStation.desktop.onRequestExit;
    pcStation.desktop.onRequestExit = () => {
      this.closeCielOsPanel();
      options.onExit?.();
    };

    this.worldPanel = {
      group,
      screenMesh,
      screenWidth,
      screenHeight,
      pcStation,
      isCielOsPanel: true,
      hitTestUv: (uv) => pcStation.desktop.hitTestUv(uv),
      setHovered: (id) => pcStation.desktop.setHovered(id),
      updateState: () => pcStation.desktop.redraw(),
      getState: () => ({
        mode: 'ciel_os',
        pcId: pcStation.id,
        activeAppId: pcStation.desktop.activeAppId
      }),
      getHitBoxes: () => pcStation.desktop.getHitBoxes(),
      placeRelativeToCamera,
      dispose: () => {
        if (pcStation.desktop.onRequestExit) {
          pcStation.desktop.onRequestExit = prevExit || null;
        }
        frame.geometry.dispose();
        frame.material.dispose();
        screenMesh.geometry.dispose();
        screenMesh.material.dispose();
      }
    };

    pcStation.desktop.redraw();
    return this.worldPanel;
  }

  closeCielOsPanel() {
    if (this.activePcStation) {
      this.activePcStation.isActiveSession = false;
      this.activePcStation = null;
    }
    if (this.worldPanel?.isCielOsPanel) {
      this.closeWorldSpatialPanel();
      return true;
    }
    return false;
  }

  closeWorldSpatialPanel() {
    this._clearVrShopPreview();
    this.slots.left.panelDrag = null;
    this.slots.right.panelDrag = null;
    this.slots.left.worldPanelTouchPressed = false;
    this.slots.right.worldPanelTouchPressed = false;
    if (this.activePcStation) {
      this.activePcStation.isActiveSession = false;
      this.activePcStation = null;
    }
    if (this.worldPanel) {
      this.worldPanel.group.parent?.remove(this.worldPanel.group);
      this.worldPanel.dispose();
      this.worldPanel = null;
    }
  }

  applyTpCameraPose(pose) {
    this._applyTpCameraPose(pose);
  }

  _applyTpCameraPose(pose) {
    if (!this.tpContext || !this.vrRig || !this.camera) return;
    const rawPos = Array.isArray(pose?.pos) ? pose.pos : [0, 1.35, 1.35];
    const rawLook = Array.isArray(pose?.lookAt) ? pose.lookAt : [0, 0.14, 0];
    this.tpCurrentPose = {
      pos: [Number(rawPos[0]) || 0, Number(rawPos[1]) || 1.35, Number(rawPos[2]) || 1.35],
      lookAt: [Number(rawLook[0]) || 0, Number(rawLook[1]) || 0.14, Number(rawLook[2]) || 0]
    };

    const lx = this.tpCurrentPose.lookAt[0];
    const ly = this.tpCurrentPose.lookAt[1];
    const lz = this.tpCurrentPose.lookAt[2];
    const dx = this.tpCurrentPose.pos[0] - lx;
    const dz = this.tpCurrentPose.pos[2] - lz;
    const flatDist = Math.hypot(dx, dz) || 1.2;
    const scaledDist = Math.max(0.68, Math.min(2.4, flatDist * 0.78 * this.tpZoomScale));
    const baseYaw = Math.atan2(dx, dz) + this.tpCamOffsetYaw;
    const eyeX = lx + Math.sin(baseYaw) * scaledDist;
    const eyeZ = lz + Math.cos(baseYaw) * scaledDist;
    const eyeY = Math.max(0.66, Math.min(1.52, this.tpCurrentPose.pos[1] * 0.58 + ly * 0.42));

    const localHeadY = this.simMode
      ? 1.65
      : Number(this.camera.position?.y) > 0.25
        ? Number(this.camera.position.y)
        : 1.48;

    this.vrRig.position.set(eyeX, eyeY - localHeadY, eyeZ);
    this.vrRig.rotation.set(0, baseYaw, 0);

    if (this.simMode) {
      this.simLookYaw = 0;
      this.simLookPitch = -0.22;
      this.camera.position.set(0, 1.65, 0);
      this.camera.rotation.set(this.simLookPitch, 0, 0, 'YXZ');
      this.simHandsGroup.position.set(0, 1.65, 0);
      this.simHandsGroup.rotation.set(this.simLookPitch * 0.65, 0, 0, 'YXZ');
    }

    if (this.tpPanel) {
      const fwdX = -Math.sin(baseYaw);
      const fwdZ = -Math.cos(baseYaw);
      const panelDist = 1.24;
      const panelX = eyeX + fwdX * panelDist;
      const panelZ = eyeZ + fwdZ * panelDist;
      const panelY = Math.max(ly + 0.72, eyeY + 0.24);
      this.tpPanel.group.position.set(panelX, panelY, panelZ);
      this.tpPanel.group.lookAt(eyeX, eyeY - 0.04, eyeZ);
    }

    this.vrRig.updateMatrixWorld(true);
  }

  adjustTpZoom(delta) {
    if (!this.tpContext) return;
    this.tpZoomScale = Math.max(0.56, Math.min(1.65, (this.tpZoomScale || 1) + Number(delta || 0)));
    this._applyTpCameraPose(this.tpCurrentPose || this.tpContext.getSnapshot?.()?.cameraPose);
  }

  adjustTpOrbit(deltaRad) {
    if (!this.tpContext) return;
    this.tpCamOffsetYaw = (this.tpCamOffsetYaw || 0) + Number(deltaRad || 0);
    this._applyTpCameraPose(this.tpCurrentPose || this.tpContext.getSnapshot?.()?.cameraPose);
  }

  attachTpContext(ctx) {
    if (!this.active || !ctx?.scene) return;
    this.closeWorldSpatialPanel();
    this.options.onHoverInteractable?.(null);
    this._lastTpHoverLabel = '';
    for (const s of [this.slots.left, this.slots.right]) {
      s.hoveredKey = null;
      s.prevTrigger = false;
      s.xrSelectQueued = false;
      s.panelDrag = null;
      s.tpPanelTouchPressed = false;
      this._clearSlotDrag(s);
    }
    this.tpContext = ctx;
    this.tpCamOffsetYaw = 0;
    this.tpZoomScale = 1;
    if (!this.savedExplorePose) {
      this.savedExplorePose = {
        pos: this.vrRig.position.clone(),
        rotY: this.vrRig.rotation.y
      };
    }

    if (this.tpPanel) {
      this.tpPanel.group.parent?.remove(this.tpPanel.group);
      this.tpPanel.dispose();
    }
    this.tpPanel = createTpSpatialPanel();
    ctx.scene.add(this.tpPanel.group);
    ctx.scene.add(this.vrRig);

    const initPose = ctx.getSnapshot?.()?.cameraPose || { pos: [0, 1.35, 1.35], lookAt: [0, 0.14, 0] };
    this._applyTpCameraPose(initPose);
    this.syncTpPanelFromContext();
  }

  syncTpPanelFromContext() {
    if (!this.tpPanel || !this.tpContext) return;
    const snap = this.tpContext.getSnapshot?.() || {};
    this.tpPanel.updateState({
      ...snap,
      onAdjustZoom: (d) => this.adjustTpZoom(d),
      onAdjustOrbit: (d) => this.adjustTpOrbit(d),
      onExitTp: () => this.tpContext?.requestExit?.()
    });
  }

  detachTpContext() {
    if (this.tpContext) {
      this.tpContext.setHoveredEntry?.(null);
      this.tpContext.resetInteractionState?.();
    }
    this._lastTpHoverLabel = '';
    this.tpCurrentPose = null;
    this.tpCamOffsetYaw = 0;
    this.tpZoomScale = 1;
    for (const s of [this.slots.left, this.slots.right]) {
      s.hoveredKey = null;
      s.prevTrigger = false;
      s.prevActionBtn = false;
      s.xrSelectQueued = false;
      s.panelDrag = null;
      s.tpPanelTouchPressed = false;
      this._clearSlotDrag(s);
    }
    if (this.tpPanel) {
      this.tpPanel.group.parent?.remove(this.tpPanel.group);
      this.tpPanel.dispose();
      this.tpPanel = null;
    }
    this.tpContext = null;

    if (this.active && this.sceneMgr?.scene) {
      this.sceneMgr.scene.add(this.vrRig);
      if (this.savedExplorePose) {
        this.vrRig.position.copy(this.savedExplorePose.pos);
        this.vrRig.rotation.set(0, this.savedExplorePose.rotY, 0);
      } else {
        this._mountVrRigForWorld(this.simMode);
      }
      this.vrRig.updateMatrixWorld(true);
    }
    this.savedExplorePose = null;
  }

  _readXrHandTracking(slot) {
    const xrHand = slot?.inputSource?.hand;
    if (!xrHand || !this.renderer?.xr) return null;
    const frame = this.renderer.xr.getFrame?.();
    const refSpace = this.renderer.xr.getReferenceSpace?.();
    if (!frame || !refSpace || typeof frame.getJointPose !== 'function') return null;

    const wristSpace = xrHand.get?.('wrist');
    if (wristSpace) {
      const wristPose = frame.getJointPose(wristSpace, refSpace);
      if (wristPose?.transform) {
        const p = wristPose.transform.position;
        const o = wristPose.transform.orientation;
        slot.visualParent.position.set(p.x, p.y, p.z);
        slot.visualParent.quaternion.set(o.x, o.y, o.z, o.w);
      }
    }

    const fingerCurls = {};
    for (const [fKey, jointNames] of Object.entries(XR_FINGER_CHAINS)) {
      const j0 = xrHand.get?.(jointNames[0]);
      const j1 = xrHand.get?.(jointNames[1]);
      const j2 = xrHand.get?.(jointNames[2]);
      const j3 = xrHand.get?.(jointNames[3]);
      const p0 = j0 ? frame.getJointPose(j0, refSpace) : null;
      const p1 = j1 ? frame.getJointPose(j1, refSpace) : null;
      const p2 = j2 ? frame.getJointPose(j2, refSpace) : null;
      const p3 = j3 ? frame.getJointPose(j3, refSpace) : null;
      if (p0 && p1 && p2 && p3) {
        this.tempVecA.set(
          p1.transform.position.x - p0.transform.position.x,
          p1.transform.position.y - p0.transform.position.y,
          p1.transform.position.z - p0.transform.position.z
        ).normalize();
        this.tempVecB.set(
          p3.transform.position.x - p2.transform.position.x,
          p3.transform.position.y - p2.transform.position.y,
          p3.transform.position.z - p2.transform.position.z
        ).normalize();
        const dot = Math.max(-1, Math.min(1, this.tempVecA.dot(this.tempVecB)));
        fingerCurls[fKey] = clamp01((1 - dot) / 1.45);
      } else {
        fingerCurls[fKey] = 0;
      }
    }

    let pinchVal = 0;
    const thumbTipSpace = xrHand.get?.('thumb-tip');
    const indexTipSpace = xrHand.get?.('index-finger-tip');
    if (thumbTipSpace && indexTipSpace) {
      const tPose = frame.getJointPose(thumbTipSpace, refSpace);
      const iPose = frame.getJointPose(indexTipSpace, refSpace);
      if (tPose && iPose) {
        const dist = Math.hypot(
          tPose.transform.position.x - iPose.transform.position.x,
          tPose.transform.position.y - iPose.transform.position.y,
          tPose.transform.position.z - iPose.transform.position.z
        );
        pinchVal = dist <= 0.024 ? 1 : dist >= 0.055 ? 0 : clamp01(1 - (dist - 0.024) / 0.031);
      }
    }

    const gripAvg = (fingerCurls.middle + fingerCurls.ring + fingerCurls.pinky) / 3;
    return {
      triggerVal: Math.max(pinchVal, fingerCurls.index),
      triggerPressed: pinchVal > 0.78,
      gripVal: gripAvg,
      thumbVal: fingerCurls.thumb,
      actionBtn: false,
      sprintPressed: false,
      axes: [0, 0, 0, 0],
      fingers: fingerCurls
    };
  }

  _readControllerButtons(slot) {
    if (this.simMode) {
      const triggerVal = slot.handedness === 'right'
        ? this.simMouseTrigger
          ? 1
          : this.simGestureState.trigger
        : this.simGestureState.trigger;
      const gripVal = this.simGestureState.grip;
      const thumbVal = this.simGestureState.thumb;
      const fingers = {
        thumb: clamp01(thumbVal),
        index: clamp01(triggerVal),
        middle: clamp01(gripVal),
        ring: clamp01(gripVal),
        pinky: clamp01(gripVal)
      };
      slot.fingerPose = fingers;
      return {
        triggerVal,
        triggerPressed: slot.handedness === 'right' && (this.simMouseTrigger || triggerVal > 0.65),
        gripVal,
        thumbVal,
        actionBtn: false,
        sprintPressed: this.simStickState.sprint,
        axes:
          slot.handedness === 'left'
            ? [0, 0, this.simStickState.lx, this.simStickState.ly]
            : [0, 0, this.simStickState.rx, 0],
        fingers
      };
    }

    if (slot.inputSource?.hand) {
      const handData = this._readXrHandTracking(slot);
      if (handData) {
        if (slot.xrSelectPressed || slot.xrSelectQueued) {
          handData.triggerPressed = true;
          handData.triggerVal = Math.max(handData.triggerVal || 0, 1);
        }
        slot.xrSelectQueued = false;
        slot.fingerPose = handData.fingers;
        return handData;
      }
      if (slot.xrSelectPressed || slot.xrSelectQueued) {
        slot.xrSelectQueued = false;
        slot.fingerPose = { thumb: 0.9, index: 0.9, middle: 0, ring: 0, pinky: 0 };
        return {
          triggerVal: 1,
          triggerPressed: true,
          gripVal: 0,
          thumbVal: 0.9,
          actionBtn: false,
          sprintPressed: false,
          axes: [0, 0, 0, 0],
          fingers: slot.fingerPose
        };
      }
    }

    const gp = slot.inputSource?.gamepad;
    if (!gp) {
      const selPressed = Boolean(slot.xrSelectPressed || slot.xrSelectQueued);
      slot.xrSelectQueued = false;
      slot.fingerPose = { thumb: selPressed ? 0.5 : 0, index: selPressed ? 1 : 0, middle: 0, ring: 0, pinky: 0 };
      return {
        triggerVal: selPressed ? 1 : 0,
        triggerPressed: selPressed,
        gripVal: 0,
        thumbVal: 0,
        actionBtn: false,
        sprintPressed: false,
        axes: [0, 0, 0, 0],
        fingers: slot.fingerPose
      };
    }
    const btns = gp.buttons || [];
    const rawTrigger = btns[0]?.value ?? (btns[0]?.pressed ? 1 : 0);
    const triggerVal = Math.max(rawTrigger > 0.02 ? rawTrigger : btns[0]?.touched ? 0.16 : 0, slot.xrSelectPressed ? 1 : 0);
    const triggerPressed = Boolean(btns[0]?.pressed || rawTrigger > 0.68 || slot.xrSelectPressed || slot.xrSelectQueued);
    slot.xrSelectQueued = false;
    const gripVal = btns[1]?.value ?? (btns[1]?.pressed ? 1 : 0);
    const thumbPressed = Boolean(btns[3]?.pressed || btns[4]?.pressed || btns[5]?.pressed);
    const thumbTouched = Boolean(
      btns[3]?.touched || btns[4]?.touched || btns[5]?.touched
    );
    const thumbVal = thumbPressed ? 1 : thumbTouched ? 0.45 : 0;
    const actionBtn = Boolean(btns[4]?.pressed);
    const sprintPressed = Boolean(btns[3]?.pressed);

    const fingers = {
      thumb: clamp01(thumbVal),
      index: clamp01(triggerVal),
      middle: clamp01(gripVal),
      ring: clamp01(gripVal),
      pinky: clamp01(gripVal)
    };
    slot.fingerPose = fingers;

    return {
      triggerVal,
      triggerPressed,
      gripVal,
      thumbVal,
      actionBtn,
      sprintPressed,
      axes: gp.axes || [],
      fingers
    };
  }

  _readThumbstick(axes = []) {
    if (!Array.isArray(axes) || axes.length === 0) return { x: 0, y: 0 };
    const x2 = Number(axes[2]) || 0;
    const y2 = Number(axes[3]) || 0;
    const x0 = Number(axes[0]) || 0;
    const y0 = Number(axes[1]) || 0;
    if (axes.length >= 4 && (Math.hypot(x2, y2) >= Math.hypot(x0, y0) || Math.hypot(x2, y2) > 0.01)) {
      return { x: x2, y: y2 };
    }
    return { x: x0, y: y0 };
  }

  _pulseHaptic(slot, intensity = 0.4, durationMs = 40) {
    if (this.simMode) return;
    const act = slot?.inputSource?.gamepad?.hapticActuators?.[0];
    if (act && typeof act.pulse === 'function') {
      act.pulse(intensity, durationMs).catch(() => {});
    }
  }

  _clearSlotDrag(slot) {
    if (!slot?.dragState) return;
    const { entry, lastPlanePt, dragDist } = slot.dragState;
    slot.dragState = null;
    if (entry) {
      entry.onDragEnd?.({ planePoint: lastPlanePt, dragDist });
    }
  }

  _updateSlotRayAndInteract(slot, state, dt, elapsed) {
    slot.rayParent.getWorldPosition(this.tempOrigin);
    this.tempMatrix.extractRotation(slot.rayParent.matrixWorld);
    this.tempDir.set(0, 0, -1).applyMatrix4(this.tempMatrix).normalize();

    if (this.camera) {
      this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
      this.raycaster.camera = this.camera;
    }
    this.raycaster.set(this.tempOrigin, this.tempDir);
    this.raycaster.far = 5.5;

    let hitKey = null;
    let hitDist = 3.5;
    let hitAction = null;
    let hitHoverLabel = '';
    let hitInteractiveEntry = null;
    let hitIntersection = null;

    if (this.wristPanel.group.visible && slot.handedness === 'right') {
      const wristHits = this.raycaster.intersectObject(this.wristPanel.screenMesh, false);
      if (wristHits.length > 0 && wristHits[0].uv) {
        const btn = this.wristPanel.hitTestUv(wristHits[0].uv);
        this.wristPanel.setHovered(btn ? btn.id : null);
        if (btn) {
          hitKey = `wrist:${btn.id}`;
          hitDist = wristHits[0].distance;
          hitAction = () => {
            if (btn.id === 'btn_mic') this.options.onToggleMic?.();
            if (btn.id === 'btn_shop') this.options.onOpenShop?.();
            if (btn.id === 'btn_vr_exit') this.exitVr();
          };
        }
      } else if (!this.wristDirectTouchHovered) {
        this.wristPanel.setHovered(null);
      }
    }

    const activePanel = this.tpContext && this.tpPanel ? this.tpPanel : !this.tpContext && this.worldPanel ? this.worldPanel : null;

    if (activePanel && slot.panelDrag && state.triggerPressed) {
      const dragHits = this.raycaster.intersectObject(activePanel.screenMesh, false);
      if (dragHits.length > 0 && dragHits[0].uv) {
        hitKey = `panel:${slot.panelDrag.id}`;
        hitDist = dragHits[0].distance;
        activePanel.setHovered(slot.panelDrag.id);
        slot.panelDrag.onDragUv?.(dragHits[0].uv);
        if (this.tpContext) this.syncTpPanelFromContext();
      }
    }

    if (!hitKey && activePanel) {
      const tpHits = this.raycaster.intersectObject(activePanel.screenMesh, false);
      if (tpHits.length > 0 && tpHits[0].uv) {
        const btn = activePanel.hitTestUv(tpHits[0].uv);
        activePanel.setHovered(btn ? btn.id : null);
        if (btn) {
          const hitUv = tpHits[0].uv;
          hitKey = `tpbtn:${btn.id}`;
          hitDist = tpHits[0].distance;
          hitAction = () => {
            if (btn.kind === 'slider') {
              slot.panelDrag = btn;
              btn.onDragUv?.(hitUv);
            } else {
              btn.onClick?.(hitUv);
            }
            if (this.tpContext) this.syncTpPanelFromContext();
          };
        }
      } else if (!slot.panelDrag) {
        activePanel.setHovered(null);
      }
    }

    if (!hitKey && this.tpContext?.interactiveMeshes?.length) {
      const benchHits = this.raycaster.intersectObjects(this.tpContext.interactiveMeshes, false);
      for (const h of benchHits) {
        const entry = h.object?.userData?.__tpInteract;
        if (entry && entry.enabled()) {
          hitKey = `tp3d:${entry.object3d?.uuid || h.object.uuid}`;
          hitDist = h.distance;
          hitInteractiveEntry = entry;
          hitIntersection = h;
          hitHoverLabel = typeof entry.label === 'function' ? entry.label() : entry.label || '';
          break;
        }
      }
    }

    let hoveredLabItem = null;
    if (!hitKey && !this.tpContext && !this.worldPanel && typeof this.options.getWorldInteractiveSurfaces === 'function') {
      const surfaces = this.options.getWorldInteractiveSurfaces() || [];
      for (const surf of surfaces) {
        if (!surf?.mesh || surf.mesh.visible === false) continue;
        surf.mesh.updateWorldMatrix?.(true, false);
        const sHits = this.raycaster.intersectObject(surf.mesh, false);
        if (sHits.length > 0 && sHits[0].uv) {
          const btn = surf.hitTestUv?.(sHits[0].uv);
          if (btn) {
            this._worldSurfHoverThisFrame?.set(surf, btn.id);
            hitKey = `surf:${surf.id}:${btn.id}`;
            hitDist = sHits[0].distance;
            hitAction = () => btn.onClick?.(sHits[0].uv);
            break;
          }
        }
      }
    }

    if (!hitKey && !this.tpContext && this.options.getInteractables) {
      const list = this.options.getInteractables() || [];
      const occluders = this.options.getOccluders ? this.options.getOccluders() : [];
      const picked = pickLabInteractable(this.raycaster, list, occluders, 4.8);
      if (picked?.item) {
        hoveredLabItem = picked.item;
        hitKey = `lab:${picked.item.id}`;
        hitDist = picked.distance;
        hitAction = () => this.options.onInteract?.(picked.item);
      }
    }

    if (this.tpContext && slot.handedness === 'right' && !slot.dragState) {
      this.tpContext.setHoveredEntry?.(hitInteractiveEntry);
    } else if (!this.tpContext && slot.handedness === 'right') {
      this.options.onHoverInteractable?.(hoveredLabItem);
      this.wristPanel.updateState({
        targetHint: hoveredLabItem ? `🎯 ${hoveredLabItem.label || hoveredLabItem.id}` : ''
      });
    }

    if (hitKey && hitKey !== slot.hoveredKey) {
      this._pulseHaptic(slot, 0.35, 35);
    }
    slot.hoveredKey = hitKey;

    if (this.tpContext && slot.handedness === 'right' && hitHoverLabel !== this._lastTpHoverLabel) {
      this._lastTpHoverLabel = hitHoverLabel;
      this.tpPanel?.updateState({ hoverLabel: hitHoverLabel });
    }

    const posAttr = slot.rayLine.geometry.getAttribute('position');
    if (posAttr) {
      posAttr.setXYZ(1, 0, 0, -Math.max(0.08, Math.min(3.5, hitDist)));
      posAttr.needsUpdate = true;
    }
    if (hitKey) {
      slot.rayMat.color.setHex(0x10b981);
      slot.dotMesh.visible = true;
      slot.dotMesh.position.set(0, 0, -Math.max(0.08, hitDist - 0.01));
    } else {
      slot.rayMat.color.setHex(0x38bdf8);
      slot.dotMesh.visible = false;
    }

    if (this.tpContext && (slot.handedness === 'right' || Boolean(slot.dragState))) {
      if (this.raycaster.ray.intersectPlane(this.workPlane, this.tempWorkPt)) {
        this.tpContext.emitPointerRay?.(this.raycaster, this.tempWorkPt);
      }
    }

    const justPressed = state.triggerPressed && !slot.prevTrigger;
    const justReleased = !state.triggerPressed && slot.prevTrigger;
    const justAction = state.actionBtn && !slot.prevActionBtn;

    slot.prevTrigger = state.triggerPressed;
    slot.prevActionBtn = state.actionBtn;

    if (justReleased && slot.panelDrag) {
      slot.panelDrag = null;
    }

    if (justPressed) {
      if (hitAction) {
        this._pulseHaptic(slot, 0.55, 35);
        hitAction();
      } else if (hitInteractiveEntry && this.tpContext) {
        const isPureClick = !hitInteractiveEntry.onDragMove && !hitInteractiveEntry.onHoldTick;
        if (isPureClick && hitInteractiveEntry.onClick) {
          this._pulseHaptic(slot, 0.55, 35);
          this.tpContext.setHoveredEntry?.(null);
          const dragPlane = hitInteractiveEntry.dragPlane || this.defaultPlane;
          const planePt = new THREE.Vector3();
          this.raycaster.ray.intersectPlane(dragPlane, planePt);
          const fakePt = this._projectWorldToFakeScreen(planePt);
          hitInteractiveEntry.onClick(hitIntersection, {
            clientX: fakePt.x,
            clientY: fakePt.y,
            planePoint: planePt
          });
        } else {
          const dragPlane = hitInteractiveEntry.dragPlane || this.defaultPlane;
          const planePt = new THREE.Vector3();
          this.raycaster.ray.intersectPlane(dragPlane, planePt);
          this.tpContext.setHoveredEntry?.(null);
          slot.dragState = {
            entry: hitInteractiveEntry,
            hit: hitIntersection,
            startPt: planePt.clone(),
            lastPt: planePt.clone(),
            lastScreen: this._projectWorldToFakeScreen(planePt),
            dragDist: 0
          };
          hitInteractiveEntry.onDragStart?.(hitIntersection, {
            clientX: slot.dragState.lastScreen.x,
            clientY: slot.dragState.lastScreen.y,
            planePoint: planePt
          });
        }
      }
    } else if (state.triggerPressed && slot.dragState) {
      const ds = slot.dragState;
      const dragPlane = ds.entry.dragPlane || this.defaultPlane;
      const planePt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(dragPlane, planePt)) {
        const curScreen = this._projectWorldToFakeScreen(planePt);
        const dx = curScreen.x - ds.lastScreen.x;
        const dy = curScreen.y - ds.lastScreen.y;
        ds.dragDist += Math.hypot(dx, dy);
        ds.lastPt.copy(planePt);
        ds.lastScreen = curScreen;
        ds.entry.onDragMove?.(planePt, dx, dy, ds.hit, {
          clientX: curScreen.x,
          clientY: curScreen.y
        });
      }
      if (ds.entry.onHoldTick) {
        ds.entry.onHoldTick(dt, ds.hit, { planePoint: ds.lastPt, elapsed });
      }
    } else if (justReleased && slot.dragState) {
      const ds = slot.dragState;
      slot.dragState = null;
      if (ds.dragDist < 28 && ds.entry.onClick) {
        ds.entry.onClick(ds.hit, {
          clientX: ds.lastScreen.x,
          clientY: ds.lastScreen.y,
          planePoint: ds.lastPt
        });
      }
      ds.entry.onDragEnd?.({
        clientX: ds.lastScreen.x,
        clientY: ds.lastScreen.y,
        planePoint: ds.lastPt,
        dragDist: ds.dragDist
      });
    }

    if (justAction && !this.tpContext) {
      if (this.hidingInRack && this.worldPanel?.getState?.()?.survivalHidden?.onExitRack) {
        this.worldPanel.getState().survivalHidden.onExitRack();
      } else if (hitAction) {
        hitAction();
      } else {
        const nearest = this.options.getNearestInteractable?.();
        if (nearest) this.options.onInteract?.(nearest);
      }
    }
  }

  _projectWorldToFakeScreen(worldPt) {
    if (!this.camera) return { x: 0, y: 0 };
    const p = this.tempProjVec.copy(worldPt).project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * 1280,
      y: (-p.y * 0.5 + 0.5) * 720
    };
  }

  _stabilizeFloor() {
    if (!this.player || !this.camera || !this.vrRig) return;
    const floorY = this.worldFloorY;
    if (this.seatedMode && this.seatedPose) {
      if (this.simMode) {
        this.vrRig.position.y = floorY;
        this.camera.position.y = this.seatedPose.y;
        this.simHandsGroup.position.y = this.seatedPose.y;
      } else {
        this.lastXrLocalXZ.set(this.camera.position.x, this.camera.position.z);
        const localY = Number(this.camera.position.y) || 0;
        if (!this.seatedAnchorCaptured) {
          if (this.xrReferenceSpaceType === 'local') {
            this.seatedAnchorLocalY = 0;
            this.seatedAnchorCaptured = true;
          } else if (Math.abs(localY) > 0.15) {
            this.seatedAnchorLocalY = localY;
            this.seatedAnchorCaptured = true;
          }
        }
        this.vrRig.position.y = this.seatedAnchorCaptured
          ? this.seatedPose.y - this.seatedAnchorLocalY
          : this.seatedPose.y - 1.55;
      }
      this.player.position.y = Number.isFinite(Number(this.player.groundY)) ? this.player.groundY : floorY;
      return;
    }

    let rigY = floorY + this.xrFloorFallbackOffset;

    if (!this.simMode) {
      this.lastXrLocalXZ.set(this.camera.position.x, this.camera.position.z);
      if (this.xrFloorFallbackOffset === 0) {
        const localY = Number(this.camera.position.y) || 0;
        if (localY < -0.05) {
          rigY = floorY + (0.35 - localY);
        }
      }
    }

    this.vrRig.position.y = rigY;
    this.player.position.y = Number.isFinite(Number(this.player.groundY)) ? this.player.groundY : floorY;
  }

  _updateLocomotion(dt, nowMs, leftState, rightState) {
    if (!this.player || !this.camera) return;

    if (this.tpContext) {
      if (this.simMode) {
        const targetLeftPos = this.simWatchInspect
          ? this.tempVecC.set(-0.14, -0.14, -0.34)
          : this.tempVecC.set(-0.26, -0.32, -0.42);
        const targetLeftRot = this.simWatchInspect
          ? this.tempVecD.set(-0.052, -1.187, -0.808)
          : this.tempVecD.set(0.22, -0.22, 0.18);
        const sm = Math.min(1, dt * 14);
        this.simLeftPivot.position.lerp(targetLeftPos, sm);
        this.simLeftPivot.rotation.x += (targetLeftRot.x - this.simLeftPivot.rotation.x) * sm;
        this.simLeftPivot.rotation.y += (targetLeftRot.y - this.simLeftPivot.rotation.y) * sm;
        this.simLeftPivot.rotation.z += (targetLeftRot.z - this.simLeftPivot.rotation.z) * sm;
        this.camera.rotation.set(this.simLookPitch, this.simLookYaw, 0, 'YXZ');
        this.simHandsGroup.position.set(0, 1.65, 0);
        this.simHandsGroup.rotation.set(this.simLookPitch * 0.65, this.simLookYaw, 0, 'YXZ');
      } else {
        const lStick = this._readThumbstick(leftState.axes);
        const rStick = this._readThumbstick(rightState.axes);
        if (Math.abs(lStick.y) > 0.35) {
          this.adjustTpZoom(lStick.y * dt * 0.7);
        }
        if (Math.abs(rStick.x) > 0.35) {
          this.adjustTpOrbit(-rStick.x * dt * 1.15);
        }
      }
      return;
    }

    this._stabilizeFloor();
    this.vrRig.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.tempVecA);
    this.camera.getWorldDirection(this.tempVecB);

    const flatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
    if (flatLen > 0.08) {
      this.lastForwardDir.set(this.tempVecB.x / flatLen, 0, this.tempVecB.z / flatLen);
    }
    const fwdX = this.lastForwardDir.x;
    const fwdZ = this.lastForwardDir.z;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    let moveX = 0;
    let moveZ = 0;
    const lockedMove = Boolean(this.seatedMode || this.hidingInRack || this.player?.movementLocked || this.activePcStation);

    if (this.activePcStation?.desktop) {
      if (this.simMode) {
        const sx = this.simStickState.lx || (this.simKeys.has('ArrowRight') ? 1 : this.simKeys.has('ArrowLeft') ? -1 : 0);
        const sy = this.simStickState.ly || (this.simKeys.has('ArrowDown') ? 1 : this.simKeys.has('ArrowUp') ? -1 : 0);
        if (sx || sy) {
          this.activePcStation.desktop.handleThumbstick(sx, sy, dt);
        }
      } else {
        const lStick = this._readThumbstick(leftState.axes);
        const rStick = this._readThumbstick(rightState.axes);
        const sx = Math.abs(lStick.x) >= Math.abs(rStick.x) ? lStick.x : rStick.x;
        const sy = Math.abs(lStick.y) >= Math.abs(rStick.y) ? lStick.y : rStick.y;
        if (Math.hypot(sx, sy) > 0.15) {
          this.activePcStation.desktop.handleThumbstick(sx, sy, dt);
        }
      }
    }

    if (this.simMode) {
      const targetLeftPos = this.simWatchInspect
        ? this.tempVecC.set(-0.14, -0.14, -0.34)
        : this.tempVecC.set(-0.26, -0.32, -0.42);
      const targetLeftRot = this.simWatchInspect
        ? this.tempVecD.set(-0.052, -1.187, -0.808)
        : this.tempVecD.set(0.22, -0.22, 0.18);
      const sm = Math.min(1, dt * 14);
      this.simLeftPivot.position.lerp(targetLeftPos, sm);
      this.simLeftPivot.rotation.x += (targetLeftRot.x - this.simLeftPivot.rotation.x) * sm;
      this.simLeftPivot.rotation.y += (targetLeftRot.y - this.simLeftPivot.rotation.y) * sm;
      this.simLeftPivot.rotation.z += (targetLeftRot.z - this.simLeftPivot.rotation.z) * sm;

      const hasKey = (code) => this.simKeys.has(code) || this.player.keys.has(code);
      if (!lockedMove) {
        let forward = -this.simStickState.ly;
        let right = this.simStickState.lx;
        if (hasKey('KeyW') || hasKey('ArrowUp')) forward += 1;
        if (hasKey('KeyS') || hasKey('ArrowDown')) forward -= 1;
        if (hasKey('KeyD') || hasKey('ArrowRight')) right += 1;
        if (hasKey('KeyA') || hasKey('ArrowLeft')) right -= 1;

        const len = Math.hypot(forward, right);
        if (len > 0.01) {
          const clamped = Math.min(1, len);
          const sprint =
            hasKey('ShiftLeft') || hasKey('ShiftRight') || this.simStickState.sprint ? 1.4 : 1;
          const speed = this.player.speed * (this.player.speedMultiplier || 1) * sprint * clamped * dt;
          moveX = ((fwdX * forward + rightX * right) / len) * speed;
          moveZ = ((fwdZ * forward + rightZ * right) / len) * speed;
        }
      } else if (this.hidingInRack) {
        const lookSpeed = 1.65;
        if (hasKey('ArrowLeft')) this.simLookYaw += lookSpeed * dt;
        if (hasKey('ArrowRight')) this.simLookYaw -= lookSpeed * dt;
        if (hasKey('ArrowUp')) this.simLookPitch += lookSpeed * 0.75 * dt;
        if (hasKey('ArrowDown')) this.simLookPitch -= lookSpeed * 0.75 * dt;
        const maxY = Math.PI / 4;
        const maxP = (20 * Math.PI) / 180;
        this.simLookYaw = Math.max(-maxY, Math.min(maxY, this.simLookYaw));
        this.simLookPitch = Math.max(-maxP, Math.min(maxP, this.simLookPitch));
      } else if (this.seatedMode) {
        const lookSpeed = 1.85;
        if (hasKey('ArrowLeft')) this.simLookYaw += lookSpeed * dt;
        if (hasKey('ArrowRight')) this.simLookYaw -= lookSpeed * dt;
        if (hasKey('ArrowUp')) this.simLookPitch = Math.min(1.15, this.simLookPitch + lookSpeed * 0.85 * dt);
        if (hasKey('ArrowDown')) this.simLookPitch = Math.max(-1.15, this.simLookPitch - lookSpeed * 0.85 * dt);
      }

      if (!this.hidingInRack && Math.abs(this.simStickState.rx) > 0.62) {
        if (!this.snapNeedsRelease || nowMs >= this.snapCooldownUntil) {
          this.snapTurn(Math.sign(this.simStickState.rx));
          this.snapCooldownUntil = nowMs + 280;
          this.snapNeedsRelease = true;
        }
      } else if (Math.abs(this.simStickState.rx) < 0.35) {
        this.snapNeedsRelease = false;
      }

      const simHeadY =
        this.hidingInRack && this.hidingPose
          ? this.hidingPose.y
          : this.seatedMode && this.seatedPose
            ? this.seatedPose.y
            : 1.65;
      this.camera.position.y = simHeadY;
      this.camera.rotation.set(this.simLookPitch, this.simLookYaw, 0, 'YXZ');
      this.simHandsGroup.position.set(0, simHeadY, 0);
      this.simHandsGroup.rotation.set(this.simLookPitch * 0.65, this.simLookYaw, 0, 'YXZ');
    } else {
      if (!lockedMove) {
        const lStick = this._readThumbstick(leftState.axes);
        const mag = Math.hypot(lStick.x, lStick.y);
        const dead = 0.15;
        if (mag > dead) {
          const normMag = Math.min(1, (mag - dead) / (1 - dead));
          const nx = lStick.x / mag;
          const ny = -lStick.y / mag;
          const sprint = leftState.sprintPressed ? 1.35 : 1;
          const speed = this.player.speed * (this.player.speedMultiplier || 1) * sprint * normMag * dt;
          moveX = (fwdX * ny + rightX * nx) * speed;
          moveZ = (fwdZ * ny + rightZ * nx) * speed;
        }
      }

      const rStick = this._readThumbstick(rightState.axes);
      if (Math.abs(rStick.x) > 0.62) {
        if (!this.snapNeedsRelease || nowMs >= this.snapCooldownUntil) {
          this.snapTurn(Math.sign(rStick.x));
          this.snapCooldownUntil = nowMs + 280;
          this.snapNeedsRelease = true;
        }
      } else if (Math.abs(rStick.x) < 0.35) {
        this.snapNeedsRelease = false;
      }
    }

    if ((moveX || moveZ) && !lockedMove) {
      this.camera.getWorldPosition(this.tempVecA);
      const curX = this.tempVecA.x;
      const curZ = this.tempVecA.z;
      if (typeof this.player.moveHorizontally === 'function') {
        const step = this.player.moveHorizontally(moveX, moveZ, curX, curZ);
        this.vrRig.position.x += step.actualDx;
        this.vrRig.position.z += step.actualDz;
      } else {
        if (!this.player._collides(curX + moveX, curZ)) {
          this.vrRig.position.x += moveX;
        }
        this.camera.getWorldPosition(this.tempVecA);
        if (!this.player._collides(this.tempVecA.x, this.tempVecA.z + moveZ)) {
          this.vrRig.position.z += moveZ;
        }
      }
    }

    this._stabilizeFloor();
    this.vrRig.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.tempVecA);
    this.camera.getWorldDirection(this.tempVecB);
    const endFlatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
    if (endFlatLen > 0.08) {
      this.lastForwardDir.set(this.tempVecB.x / endFlatLen, 0, this.tempVecB.z / endFlatLen);
    }
    const nextYaw = Math.atan2(-this.lastForwardDir.x, -this.lastForwardDir.z);

    if (typeof this.player.setVrPose === 'function') {
      this.player.setVrPose({ x: this.tempVecA.x, z: this.tempVecA.z, yaw: nextYaw });
    } else {
      this.player.position.set(this.tempVecA.x, this.player.groundY || 0, this.tempVecA.z);
      this.player.yaw = nextYaw;
    }
  }

  getVrSyncPayload() {
    if (!this.active || !this.camera || !this.player) return { active: false };
    const basePos = this.player.position;
    const baseY = this.worldFloorY;
    const q = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 1000) / 1000 : 0);

    const extractRel = (obj, extra = null) => {
      obj.getWorldPosition(this.tempVecA);
      obj.getWorldQuaternion(this.tempQuat);
      const data = {
        px: q(this.tempVecA.x - basePos.x),
        py: q(this.tempVecA.y - baseY),
        pz: q(this.tempVecA.z - basePos.z),
        qx: q(this.tempQuat.x),
        qy: q(this.tempQuat.y),
        qz: q(this.tempQuat.z),
        qw: q(this.tempQuat.w)
      };
      if (extra) Object.assign(data, extra);
      return data;
    };

    const leftBtn = this._readControllerButtons(this.slots.left);
    const rightBtn = this._readControllerButtons(this.slots.right);
    const mapFingers = (f) => ({
      thumb: q(f?.thumb || 0),
      index: q(f?.index || 0),
      middle: q(f?.middle || 0),
      ring: q(f?.ring || 0),
      pinky: q(f?.pinky || 0)
    });

    return {
      active: true,
      head: extractRel(this.camera),
      leftHand: extractRel(this.slots.left.hand.root, {
        grip: q(leftBtn.gripVal),
        trigger: q(leftBtn.triggerVal),
        thumb: q(leftBtn.thumbVal),
        fingers: mapFingers(leftBtn.fingers)
      }),
      rightHand: extractRel(this.slots.right.hand.root, {
        grip: q(rightBtn.gripVal),
        trigger: q(rightBtn.triggerVal),
        thumb: q(rightBtn.thumbVal),
        fingers: mapFingers(rightBtn.fingers)
      })
    };
  }

  _syncDebugPanel(force = false, nowMs = Date.now()) {
    if (!this.debugPanel) return;
    this.debugPanel.updateState(
      {
        xrPresenting: Boolean(this.renderer?.xr?.isPresenting || this.xrSession),
        simMode: this.simMode,
        referenceSpace: this.simMode ? 'sim' : this.xrReferenceSpaceType,
        rigPos: {
          x: this.vrRig.position.x,
          y: this.vrRig.position.y,
          z: this.vrRig.position.z
        },
        headY: this.camera?.position?.y || 0,
        fps: this.sceneMgr?.getFps?.() ?? 60,
        frameCount: this.frameCount,
        errors: this.getCapturedErrors()
      },
      nowMs,
      force
    );
  }

  _updateSpatialPanelDirectTouch(panel, slot, pressKey) {
    const indexTip = slot?.hand?.fingers?.index?.tip;
    if (!panel?.group?.visible || !indexTip || !panel.screenMesh) {
      if (slot) slot[pressKey] = false;
      return;
    }
    panel.screenMesh.updateWorldMatrix(true, false);
    indexTip.getWorldPosition(this.tempVecC);
    panel.screenMesh.worldToLocal(this.tempVecC);
    const w = panel.screenWidth || 1.38;
    const h = panel.screenHeight || 0.86;
    const u = this.tempVecC.x / w + 0.5;
    const v = this.tempVecC.y / h + 0.5;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && this.tempVecC.z >= -0.025 && this.tempVecC.z <= 0.055) {
      const uv = { x: u, y: v };
      const btn = panel.hitTestUv(uv);
      if (btn) {
        panel.setHovered(btn.id);
        if (btn.kind === 'slider' && this.tempVecC.z <= 0.028) {
          btn.onDragUv?.(uv);
          if (this.tpContext && panel === this.tpPanel) this.syncTpPanelFromContext();
          return;
        }
        if (this.tempVecC.z <= 0.022 && !slot[pressKey]) {
          slot[pressKey] = true;
          this._pulseHaptic(slot, 0.55, 35);
          btn.onClick?.(uv);
          if (this.tpContext && panel === this.tpPanel) this.syncTpPanelFromContext();
        } else if (this.tempVecC.z > 0.032) {
          slot[pressKey] = false;
        }
        return;
      }
    }
    if (this.tempVecC.z > 0.032) {
      slot[pressKey] = false;
    }
  }

  _updateWorldSurfacesDirectTouch(slot) {
    const indexTip = slot?.hand?.fingers?.index?.tip;
    if (!indexTip || typeof this.options.getWorldInteractiveSurfaces !== 'function') {
      if (slot) slot.worldSurfTouchPressed = false;
      return;
    }
    const surfaces = this.options.getWorldInteractiveSurfaces() || [];
    let touchedAny = false;
    for (const surf of surfaces) {
      if (!surf?.mesh || surf.mesh.visible === false) continue;
      surf.mesh.updateWorldMatrix(true, false);
      indexTip.getWorldPosition(this.tempVecC);
      surf.mesh.worldToLocal(this.tempVecC);
      const w = surf.width || 0.8;
      const h = surf.height || 0.6;
      const u = this.tempVecC.x / w + 0.5;
      const v = this.tempVecC.y / h + 0.5;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && this.tempVecC.z >= -0.03 && this.tempVecC.z <= 0.055) {
        const uv = { x: u, y: v };
        const btn = surf.hitTestUv?.(uv);
        if (btn) {
          touchedAny = true;
          this._worldSurfHoverThisFrame?.set(surf, btn.id);
          if (this.tempVecC.z <= 0.024 && !slot.worldSurfTouchPressed) {
            slot.worldSurfTouchPressed = true;
            this._pulseHaptic(slot, 0.55, 35);
            btn.onClick?.(uv);
          } else if (this.tempVecC.z > 0.034) {
            slot.worldSurfTouchPressed = false;
          }
          break;
        }
      }
    }
    if (!touchedAny && this.tempVecC.z > 0.034) {
      slot.worldSurfTouchPressed = false;
    }
  }

  _updateWristDirectTouch() {
    this.wristDirectTouchHovered = false;
    const indexTip = this.slots.right?.hand?.fingers?.index?.tip;
    if (!this.wristPanel.group.visible || !indexTip) {
      this.wristTouchPressed = false;
      return;
    }
    this.wristPanel.screenMesh.updateWorldMatrix(true, false);
    indexTip.getWorldPosition(this.tempVecC);
    this.wristPanel.screenMesh.worldToLocal(this.tempVecC);
    const w = this.wristPanel.screenWidth || 0.136;
    const h = this.wristPanel.screenHeight || 0.128;
    const u = this.tempVecC.x / w + 0.5;
    const v = this.tempVecC.y / h + 0.5;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && this.tempVecC.z >= -0.015 && this.tempVecC.z <= 0.036) {
      const btn = this.wristPanel.hitTestUv({ x: u, y: v });
      if (btn) {
        this.wristDirectTouchHovered = true;
        this.wristPanel.setHovered(btn.id);
        if (this.tempVecC.z <= 0.018 && !this.wristTouchPressed) {
          this.wristTouchPressed = true;
          this._pulseHaptic(this.slots.right, 0.55, 35);
          if (btn.id === 'btn_mic') this.options.onToggleMic?.();
          if (btn.id === 'btn_shop') this.options.onOpenShop?.();
          if (btn.id === 'btn_vr_exit') this.exitVr();
        } else if (this.tempVecC.z > 0.024) {
          this.wristTouchPressed = false;
        }
        return;
      }
    }
    if (this.tempVecC.z > 0.024) {
      this.wristTouchPressed = false;
    }
  }

  update(dt = 0.016, elapsed = 0, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    if (!this.active) return;
    this.frameCount += 1;

    const leftState = this._readControllerButtons(this.slots.left);
    const rightState = this._readControllerButtons(this.slots.right);

    this._updateLocomotion(dt, nowMs, leftState, rightState);

    this.slots.left.hand.setPose({
      trigger: leftState.triggerVal,
      grip: leftState.gripVal,
      thumb: leftState.thumbVal,
      fingers: leftState.fingers,
      dt,
      elapsed
    });
    this.slots.right.hand.setPose({
      trigger: rightState.triggerVal,
      grip: rightState.gripVal,
      thumb: rightState.thumbVal,
      fingers: rightState.fingers,
      dt,
      elapsed
    });

    if (this.camera) {
      this.camera.getWorldPosition(this.tempVecA);
      this.camera.getWorldDirection(this.tempVecB);
      this.wristPanel.updateVisibility(this.tempVecA, dt, nowMs, this.tempVecB);
      if (this.debugPanel.group.visible) {
        this.debugPanel.updateTransform(this.vrRig, this.camera, dt);
      }
    }
    if (this.debugPanel.group.visible) {
      this._syncDebugPanel(false, nowMs);
    }
    if (this.activePcStation?.desktop) {
      this.activePcStation.desktop.update(dt, elapsed);
    }
    if (this.shopPreviewGroup && this.shopPreviewObject) {
      this.shopPreviewGroup.rotation.y += dt * 0.75;
      if (this.shopPreviewKind === 'pets') {
        this.shopPreviewObject.animateParts?.(elapsed, 0.85);
      } else {
        this.shopPreviewObject.updateEffects?.(elapsed);
      }
    }

    this._updateWristDirectTouch();
    this._worldSurfHoverThisFrame.clear();
    if (this.tpContext && this.tpPanel) {
      this._updateSpatialPanelDirectTouch(this.tpPanel, this.slots.right, 'tpPanelTouchPressed');
      this._updateSpatialPanelDirectTouch(this.tpPanel, this.slots.left, 'tpPanelTouchPressed');
    } else if (this.worldPanel) {
      this._updateSpatialPanelDirectTouch(this.worldPanel, this.slots.right, 'worldPanelTouchPressed');
      this._updateSpatialPanelDirectTouch(this.worldPanel, this.slots.left, 'worldPanelTouchPressed');
    } else if (typeof this.options.getWorldInteractiveSurfaces === 'function') {
      this._updateWorldSurfacesDirectTouch(this.slots.right);
      this._updateWorldSurfacesDirectTouch(this.slots.left);
    }
    this._updateSlotRayAndInteract(this.slots.left, leftState, dt, elapsed);
    this._updateSlotRayAndInteract(this.slots.right, rightState, dt, elapsed);
    this._updateCombatVr(dt, nowMs, leftState, rightState, elapsed);
    if (typeof this.options.getWorldInteractiveSurfaces === 'function') {
      const surfaces = this.options.getWorldInteractiveSurfaces() || [];
      for (const surf of surfaces) {
        surf.setHovered?.(this._worldSurfHoverThisFrame.get(surf) || null);
      }
    }
  }

  dispose() {
    this.renderer?.xr?.removeEventListener?.('sessionend', this._onXrSessionEnd);
    if (this.active) {
      this._teardownSession();
    }
    this._clearVrShopPreview();
    this.setCombatMode(false);
    this.wristPanel?.dispose?.();
    this.debugPanel?.dispose?.();
    this.tpPanel?.dispose?.();
    this.worldPanel?.dispose?.();
    for (const slot of [this.slots.left, this.slots.right]) {
      slot.hand?.dispose?.();
      slot.rayGeom?.dispose?.();
      slot.rayMat?.dispose?.();
      slot.dotMesh?.geometry?.dispose?.();
      slot.dotMat?.dispose?.();
    }
  }
}
