import * as THREE from 'three';
import { pickLabInteractable } from '../world/SceneManager.js';
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
    this.skin = options.skin || {};

    this.vrRig = new THREE.Group();
    this.vrRig.name = 'vr-rig';

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
    this.wristPanel.group.position.set(-0.01, 0.038, 0.036);
    this.wristPanel.group.rotation.set(-1.12, 0.22, 0.28);
    this.slots.left.hand.root.add(this.wristPanel.group);
    this.wristPanel.group.visible = false;

    this.debugPanel = createVrDebugPanel();
    this.debugPanel.group.visible = false;
    this.vrRig.add(this.debugPanel.group);
    this.xrErrors = [];
    this.frameCount = 0;

    this.tpPanel = null;
    this.tpContext = null;
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
      hoveredKey: null,
      dragState: null,
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
        const side =
          src?.handedness === 'left'
            ? 'left'
            : src?.handedness === 'right'
              ? 'right'
              : i === 0
                ? 'left'
                : 'right';
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

      ctrl.addEventListener('disconnected', () => {
        const side = this.ctrlAssignments[i];
        this.ctrlAssignments[i] = null;
        if (side && this.slots[side]) {
          const slot = this.slots[side];
          slot.inputSource = null;
          slot.trackingMode = 'controller';
          slot.hoveredKey = null;
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
    this.debugPanel.group.visible = true;
    this._syncDebugPanel(true);
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
      this.debugPanel.group.visible = true;
      this._syncDebugPanel(true);
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
    this.debugPanel.group.visible = true;
    this._syncDebugPanel(true);
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
    this.debugPanel.updateTransform(this.vrRig, this.camera, 1, true);
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
    if (this.tpContext) {
      this.detachTpContext();
    }
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
    this.wristPanel.setForceVisible(false);
    this.wristPanel.group.visible = false;
    this.debugPanel.group.visible = false;
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

  attachTpContext(ctx) {
    if (!this.active || !ctx?.scene) return;
    this.options.onHoverInteractable?.(null);
    this._lastTpHoverLabel = '';
    this.slots.left.hoveredKey = null;
    this.slots.right.hoveredKey = null;
    this.slots.left.prevTrigger = false;
    this.slots.right.prevTrigger = false;
    this.tpContext = ctx;
    if (!this.savedExplorePose) {
      this.savedExplorePose = {
        pos: this.vrRig.position.clone(),
        rotY: this.vrRig.rotation.y
      };
    }

    if (this.tpPanel) {
      this.tpPanel.dispose();
    }
    this.tpPanel = createTpSpatialPanel();
    ctx.scene.add(this.tpPanel.group);
    ctx.scene.add(this.vrRig);

    this.vrRig.position.set(0, -0.82, 0.96);
    this.vrRig.rotation.set(0, 0, 0);
    if (this.simMode) {
      this.simLookYaw = 0;
      this.simLookPitch = -0.28;
    }
    this.vrRig.updateMatrixWorld(true);
    this.syncTpPanelFromContext();
  }

  syncTpPanelFromContext() {
    if (!this.tpPanel || !this.tpContext) return;
    const snap = this.tpContext.getSnapshot?.() || {};
    this.tpPanel.updateState({
      ...snap,
      onExitTp: () => this.tpContext?.requestExit?.()
    });
  }

  detachTpContext() {
    if (this.tpContext) {
      this.tpContext.setHoveredEntry?.(null);
      this.tpContext.resetInteractionState?.();
    }
    this._lastTpHoverLabel = '';
    this.slots.left.hoveredKey = null;
    this.slots.right.hoveredKey = null;
    this.slots.left.prevTrigger = false;
    this.slots.right.prevTrigger = false;
    this.slots.left.prevActionBtn = false;
    this.slots.right.prevActionBtn = false;
    if (this.tpPanel) {
      this.tpPanel.group.parent?.remove(this.tpPanel.group);
      this.tpPanel.dispose();
      this.tpPanel = null;
    }
    this._clearSlotDrag(this.slots.left);
    this._clearSlotDrag(this.slots.right);
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
        slot.fingerPose = handData.fingers;
        return handData;
      }
    }

    const gp = slot.inputSource?.gamepad;
    if (!gp) {
      slot.fingerPose = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
      return {
        triggerVal: 0,
        triggerPressed: false,
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
    const triggerVal = rawTrigger > 0.02 ? rawTrigger : btns[0]?.touched ? 0.16 : 0;
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
      triggerPressed: Boolean(btns[0]?.pressed || rawTrigger > 0.68),
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
            if (btn.id === 'btn_vr_exit') this.exitVr();
          };
        }
      } else {
        this.wristPanel.setHovered(null);
      }
    }

    if (!hitKey && this.tpContext && this.tpPanel) {
      const tpHits = this.raycaster.intersectObject(this.tpPanel.screenMesh, false);
      if (tpHits.length > 0 && tpHits[0].uv) {
        const btn = this.tpPanel.hitTestUv(tpHits[0].uv);
        this.tpPanel.setHovered(btn ? btn.id : null);
        if (btn) {
          hitKey = `tpbtn:${btn.id}`;
          hitDist = tpHits[0].distance;
          hitAction = () => {
            btn.onClick?.();
            this.syncTpPanelFromContext();
          };
        }
      } else {
        this.tpPanel.setHovered(null);
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

    if (this.tpContext && slot.handedness === 'right') {
      const workPt = new THREE.Vector3();
      const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
      if (this.raycaster.ray.intersectPlane(workPlane, workPt)) {
        this.tpContext.emitPointerRay?.(this.raycaster, workPt);
      }
    }

    const justPressed = state.triggerPressed && !slot.prevTrigger;
    const justReleased = !state.triggerPressed && slot.prevTrigger;
    const justAction = state.actionBtn && !slot.prevActionBtn;

    slot.prevTrigger = state.triggerPressed;
    slot.prevActionBtn = state.actionBtn;

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
      if (hitAction) {
        hitAction();
      } else {
        const nearest = this.options.getNearestInteractable?.();
        if (nearest) this.options.onInteract?.(nearest);
      }
    }
  }

  _projectWorldToFakeScreen(worldPt) {
    if (!this.camera) return { x: 0, y: 0 };
    const p = worldPt.clone().project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * 1280,
      y: (-p.y * 0.5 + 0.5) * 720
    };
  }

  _stabilizeFloor() {
    if (!this.player || !this.camera || !this.vrRig) return;
    const floorY = this.worldFloorY;
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
        this.camera.rotation.set(this.simLookPitch, this.simLookYaw, 0, 'YXZ');
        this.simHandsGroup.position.set(0, 1.65, 0);
        this.simHandsGroup.rotation.set(this.simLookPitch * 0.65, this.simLookYaw, 0, 'YXZ');
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

    if (this.simMode) {
      const targetLeftPos = this.simWatchInspect
        ? this.tempVecC.set(-0.15, -0.17, -0.31)
        : this.tempVecC.set(-0.26, -0.32, -0.42);
      const targetLeftRot = this.simWatchInspect
        ? this.tempVecD.set(0.58, 0.45, -0.38)
        : this.tempVecD.set(0.22, -0.22, 0.18);
      const sm = Math.min(1, dt * 14);
      this.simLeftPivot.position.lerp(targetLeftPos, sm);
      this.simLeftPivot.rotation.x += (targetLeftRot.x - this.simLeftPivot.rotation.x) * sm;
      this.simLeftPivot.rotation.y += (targetLeftRot.y - this.simLeftPivot.rotation.y) * sm;
      this.simLeftPivot.rotation.z += (targetLeftRot.z - this.simLeftPivot.rotation.z) * sm;

      let forward = -this.simStickState.ly;
      let right = this.simStickState.lx;
      const hasKey = (code) => this.simKeys.has(code) || this.player.keys.has(code);
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

      if (Math.abs(this.simStickState.rx) > 0.62) {
        if (!this.snapNeedsRelease || nowMs >= this.snapCooldownUntil) {
          this.snapTurn(Math.sign(this.simStickState.rx));
          this.snapCooldownUntil = nowMs + 280;
          this.snapNeedsRelease = true;
        }
      } else if (Math.abs(this.simStickState.rx) < 0.35) {
        this.snapNeedsRelease = false;
      }

      this.camera.rotation.set(this.simLookPitch, this.simLookYaw, 0, 'YXZ');
      this.simHandsGroup.position.set(0, 1.65, 0);
      this.simHandsGroup.rotation.set(this.simLookPitch * 0.65, this.simLookYaw, 0, 'YXZ');
    } else {
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

    if (moveX || moveZ) {
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
      this.wristPanel.updateVisibility(this.tempVecA, dt, nowMs);
      this.debugPanel.updateTransform(this.vrRig, this.camera, dt);
    }
    this._syncDebugPanel(false, nowMs);

    this._updateSlotRayAndInteract(this.slots.left, leftState, dt, elapsed);
    this._updateSlotRayAndInteract(this.slots.right, rightState, dt, elapsed);
  }

  dispose() {
    this.renderer?.xr?.removeEventListener?.('sessionend', this._onXrSessionEnd);
    if (this.active) {
      this._teardownSession();
    }
    this.wristPanel?.dispose?.();
    this.debugPanel?.dispose?.();
    this.tpPanel?.dispose?.();
    for (const slot of [this.slots.left, this.slots.right]) {
      slot.hand?.dispose?.();
      slot.rayGeom?.dispose?.();
      slot.rayMat?.dispose?.();
      slot.dotMesh?.geometry?.dispose?.();
      slot.dotMat?.dispose?.();
    }
  }
}
