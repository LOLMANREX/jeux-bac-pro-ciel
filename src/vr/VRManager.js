import * as THREE from 'three';
import { buildArticulatedVRHand } from './VRHandBuilder.js';
import { createTpSpatialPanel, createWristHudPanel } from './VRHudPanel.js';

export class VRManager {
  constructor(sceneMgr, player, options = {}) {
    this.sceneMgr = sceneMgr;
    this.player = player;
    this.options = options;

    this.xrSupported = false;
    this.xrSession = null;
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

    this.slots = {
      left: this._createHandSlot('left'),
      right: this._createHandSlot('right')
    };

    this.ctrlAssignments = [null, null];
    this.xrControllers = [];
    this.xrGrips = [];

    this.wristPanel = createWristHudPanel({
      name: options.playerName || 'Eleve_CIEL'
    });
    this.wristPanel.group.position.set(0.06, 0.055, 0.01);
    this.wristPanel.group.rotation.set(-0.65, 0.85, 0.25);
    this.slots.left.visualParent.add(this.wristPanel.group);
    this.wristPanel.group.visible = false;

    this.tpPanel = null;
    this.tpContext = null;
    this.savedExplorePose = null;

    this.snapCooldownUntil = 0;
    this.lastSentVrSyncAt = 0;
    this.simGestureState = { trigger: 0, grip: 0, thumb: 0 };
    this.simKeys = new Set();
    this.simMouseTrigger = false;
    this.simLookPitch = -0.08;
    this.simLookYaw = 0;

    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.tempOrigin = new THREE.Vector3();
    this.tempDir = new THREE.Vector3();
    this.tempVecA = new THREE.Vector3();
    this.tempVecB = new THREE.Vector3();
    this.tempQuat = new THREE.Quaternion();
    this.defaultPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);

    this._initXrControllers();
    this.checkSupport();
  }

  _createHandSlot(handedness) {
    const visualParent = new THREE.Group();
    const rayParent = new THREE.Group();
    const hand = buildArticulatedVRHand({ handedness, skin: this.skin });
    visualParent.add(hand.root);

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

    return {
      handedness,
      hand,
      visualParent,
      rayParent,
      rayLine,
      rayMat,
      dotMesh,
      dotMat,
      inputSource: null,
      prevTrigger: false,
      prevActionBtn: false,
      hoveredKey: null,
      dragState: null
    };
  }

  _initXrControllers() {
    if (!this.renderer?.xr || typeof this.renderer.xr.getController !== 'function') return;

    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      ctrl.visible = false;
      grip.visible = false;
      this.vrRig.add(ctrl);
      this.vrRig.add(grip);
      this.xrControllers.push(ctrl);
      this.xrGrips.push(grip);

      ctrl.addEventListener('connected', (ev) => {
        const src = ev.data || null;
        const side = src?.handedness === 'left' ? 'left' : 'right';
        this.ctrlAssignments[i] = side;
        const slot = this.slots[side];
        slot.inputSource = src;
        ctrl.visible = true;
        grip.visible = true;
        ctrl.add(slot.rayParent);
        grip.add(slot.visualParent);
      });

      ctrl.addEventListener('disconnected', () => {
        const side = this.ctrlAssignments[i];
        this.ctrlAssignments[i] = null;
        if (side && this.slots[side]) {
          this.slots[side].inputSource = null;
          this.slots[side].hoveredKey = null;
          this._clearSlotDrag(this.slots[side]);
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

  getPublicState() {
    return {
      xrSupported: this.xrSupported,
      active: this.active,
      xrPresenting: Boolean(this.xrSession),
      simMode: this.simMode
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
    const supported = this.xrSupported || (await this.checkSupport());
    if (supported && navigator.xr?.requestSession && this.renderer?.xr) {
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
        });
        await this._activateXrSession(session);
        return true;
      } catch (err) {
        this.options.onToast?.(
          'Casque WebXR non détecté : passage en Mode Simulation VR sur PC (Touche F9).',
          'info'
        );
      }
    } else {
      this.options.onToast?.(
        'WebXR indisponible sur ce navigateur : activation du Mode Simulation VR PC (F9).',
        'info'
      );
    }
    return this.enterSimulationMode();
  }

  async _activateXrSession(session) {
    this.xrSession = session;
    this.simMode = false;
    this.active = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    await this.renderer.xr.setSession(session);

    session.addEventListener('end', () => {
      this._teardownSession();
    });

    this._mountVrRigForWorld(false);
    this.wristPanel.setForceVisible(false);
    this.options.onEnterVr?.({ mode: 'xr' });
    this.options.onStateChange?.(this.getPublicState());
    this.options.onToast?.('🥽 Mode VR WebXR (Quest 3S) activé !', 'success');
  }

  enterSimulationMode() {
    if (this.xrSession) return false;
    this.simMode = true;
    this.active = true;

    this.simRightPivot.add(this.slots.right.rayParent);
    this.simRightPivot.add(this.slots.right.visualParent);
    this.simLeftPivot.add(this.slots.left.rayParent);
    this.simLeftPivot.add(this.slots.left.visualParent);

    this.simLeftPivot.position.set(-0.26, -0.32, -0.42);
    this.simLeftPivot.rotation.set(0.22, -0.22, 0.18);
    this.simRightPivot.position.set(0.26, -0.32, -0.44);
    this.simRightPivot.rotation.set(0.05, 0.04, -0.04);

    this._mountVrRigForWorld(true);
    this.wristPanel.setForceVisible(false);
    this.options.onEnterVr?.({ mode: 'sim' });
    this.options.onStateChange?.(this.getPublicState());
    this.options.onToast?.(
      '🥽 Simulation VR PC active (F9 quitter • H montrer montre • F grip • G pouce/signe • Clic gâchette)',
      'success'
    );
    return true;
  }

  _mountVrRigForWorld(isSim) {
    if (!this.sceneMgr?.scene || !this.camera) return;
    this.sceneMgr.scene.add(this.vrRig);
    const targetPos = this.player?.position || new THREE.Vector3(-3.95, 0, 0.65);
    const groundY = this.player?.groundY || 0;
    const yaw = this.player?.yaw || 0;

    if (isSim) {
      this.vrRig.position.set(targetPos.x, groundY, targetPos.z);
      this.vrRig.rotation.set(0, yaw, 0);
      this.simLookYaw = 0;
      this.simLookPitch = this.player?.pitch || -0.06;
      this.camera.position.set(0, 1.65, 0);
      this.camera.rotation.set(this.simLookPitch, 0, 0, 'YXZ');
      this.vrRig.add(this.camera);
      this.simHandsGroup.position.set(0, 1.65, 0);
    } else {
      this.vrRig.position.set(targetPos.x, groundY, targetPos.z);
      this.vrRig.rotation.set(0, yaw, 0);
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.vrRig.add(this.camera);
    }
    this.vrRig.updateMatrixWorld(true);
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
    this.active = false;
    this.simMode = false;
    this.simMouseTrigger = false;
    this.simKeys.clear();
    this.xrSession = null;

    if (this.sceneMgr?.scene && this.camera) {
      this.sceneMgr.scene.add(this.camera);
      this.sceneMgr.scene.remove(this.vrRig);
    }
    this.player?._applyCamera?.();
    this.options.onExitVr?.();
    this.options.onStateChange?.(this.getPublicState());
  }

  toggleWristWatchSim() {
    if (!this.active) return;
    const next = !this.wristPanel.group.visible;
    this.wristPanel.setForceVisible(next);
  }

  setSimKey(code, pressed) {
    if (!this.simMode) return;
    if (pressed) this.simKeys.add(code);
    else this.simKeys.delete(code);
  }

  setSimInput({ trigger, grip, thumb, lookDx = 0, lookDy = 0, mouseTrigger } = {}) {
    if (!this.simMode) return;
    if (typeof trigger === 'number') this.simGestureState.trigger = trigger;
    if (typeof grip === 'number') this.simGestureState.grip = grip;
    if (typeof thumb === 'number') this.simGestureState.thumb = thumb;
    if (typeof mouseTrigger === 'boolean') this.simMouseTrigger = mouseTrigger;
    if (lookDx || lookDy) {
      this.simLookYaw -= lookDx * 0.004;
      this.simLookPitch = Math.max(-1.1, Math.min(1.1, this.simLookPitch - lookDy * 0.004));
    }
  }

  attachTpContext(ctx) {
    if (!this.active || !ctx?.scene) return;
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

  _readControllerButtons(slot) {
    if (this.simMode) {
      if (slot.handedness === 'right') {
        return {
          triggerVal: this.simMouseTrigger ? 1 : this.simGestureState.trigger,
          triggerPressed: this.simMouseTrigger || this.simGestureState.trigger > 0.65,
          gripVal: this.simGestureState.grip,
          thumbVal: this.simGestureState.thumb,
          actionBtn: false,
          axes: [0, 0, 0, 0]
        };
      }
      return {
        triggerVal: this.simGestureState.trigger,
        triggerPressed: false,
        gripVal: this.simGestureState.grip,
        thumbVal: this.simGestureState.thumb,
        actionBtn: false,
        axes: [0, 0, 0, 0]
      };
    }

    const gp = slot.inputSource?.gamepad;
    if (!gp) {
      return {
        triggerVal: 0,
        triggerPressed: false,
        gripVal: 0,
        thumbVal: 0,
        actionBtn: false,
        axes: [0, 0, 0, 0]
      };
    }
    const btns = gp.buttons || [];
    const triggerVal = btns[0]?.value ?? (btns[0]?.pressed ? 1 : 0);
    const gripVal = btns[1]?.value ?? (btns[1]?.pressed ? 1 : 0);
    const thumbTouched = Boolean(
      btns[3]?.touched || btns[3]?.pressed || btns[4]?.touched || btns[4]?.pressed || btns[5]?.touched || btns[5]?.pressed
    );
    const actionBtn = Boolean(btns[4]?.pressed);

    return {
      triggerVal,
      triggerPressed: Boolean(btns[0]?.pressed || triggerVal > 0.68),
      gripVal,
      thumbVal: thumbTouched ? 1 : 0,
      actionBtn,
      axes: gp.axes || []
    };
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

    if (!hitKey && !this.tpContext && this.options.getInteractables) {
      const list = this.options.getInteractables() || [];
      for (const item of list) {
        if (!item?.mesh) continue;
        const hits = this.raycaster.intersectObject(item.mesh, true);
        if (hits.length > 0 && hits[0].distance < 4.8) {
          hitKey = `lab:${item.id}`;
          hitDist = hits[0].distance;
          hitAction = () => this.options.onInteract?.(item);
          break;
        }
      }
    }

    if (hitKey && hitKey !== slot.hoveredKey) {
      this._pulseHaptic(slot, 0.4, 40);
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
        const dragPlane = hitInteractiveEntry.dragPlane || this.defaultPlane;
        const planePt = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(dragPlane, planePt);
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
      if (ds.dragDist < 10 && ds.entry.onClick) {
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

    this.camera.getWorldPosition(this.tempVecA);
    this.camera.getWorldDirection(this.tempVecB);

    const flatLen = Math.hypot(this.tempVecB.x, this.tempVecB.z);
    const fwdX = flatLen > 0.001 ? this.tempVecB.x / flatLen : 0;
    const fwdZ = flatLen > 0.001 ? this.tempVecB.z / flatLen : -1;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    let moveX = 0;
    let moveZ = 0;

    if (this.simMode) {
      let forward = 0;
      let right = 0;
      const hasKey = (code) => this.simKeys.has(code) || this.player.keys.has(code);
      if (hasKey('KeyW') || hasKey('ArrowUp')) forward += 1;
      if (hasKey('KeyS') || hasKey('ArrowDown')) forward -= 1;
      if (hasKey('KeyD') || hasKey('ArrowRight')) right += 1;
      if (hasKey('KeyA') || hasKey('ArrowLeft')) right -= 1;
      const len = Math.hypot(forward, right);
      if (len > 0.01) {
        const sprint = hasKey('ShiftLeft') || hasKey('ShiftRight') ? 1.45 : 1;
        const speed = this.player.speed * sprint * dt;
        moveX = ((fwdX * forward + rightX * right) / len) * speed;
        moveZ = ((fwdZ * forward + rightZ * right) / len) * speed;
      }
      this.camera.rotation.set(this.simLookPitch, this.simLookYaw, 0, 'YXZ');
      this.simHandsGroup.position.set(0, 1.65, 0);
      this.simHandsGroup.rotation.set(this.simLookPitch * 0.65, this.simLookYaw, 0, 'YXZ');
    } else {
      const lAxes = leftState.axes || [];
      const lx = Math.abs(lAxes[2] || 0) > 0.01 ? lAxes[2] : lAxes[0] || 0;
      const ly = Math.abs(lAxes[3] || 0) > 0.01 ? lAxes[3] : lAxes[1] || 0;
      const dead = 0.16;
      const fx = Math.abs(lx) > dead ? lx : 0;
      const fy = Math.abs(ly) > dead ? -ly : 0;
      const len = Math.hypot(fx, fy);
      if (len > 0.01) {
        const clamped = Math.min(1, len);
        const speed = this.player.speed * clamped * dt;
        moveX = ((fwdX * fy + rightX * fx) / len) * speed;
        moveZ = ((fwdZ * fy + rightZ * fx) / len) * speed;
      }

      const rAxes = rightState.axes || [];
      const rx = Math.abs(rAxes[2] || 0) > 0.01 ? rAxes[2] : rAxes[0] || 0;
      if (Math.abs(rx) > 0.64 && nowMs >= this.snapCooldownUntil) {
        this.snapCooldownUntil = nowMs + 280;
        const beforeX = this.tempVecA.x;
        const beforeZ = this.tempVecA.z;
        this.vrRig.rotation.y -= Math.sign(rx) * THREE.MathUtils.degToRad(35);
        this.vrRig.updateMatrixWorld(true);
        this.camera.getWorldPosition(this.tempVecA);
        this.vrRig.position.x += beforeX - this.tempVecA.x;
        this.vrRig.position.z += beforeZ - this.tempVecA.z;
        this.vrRig.updateMatrixWorld(true);
      }
    }

    if (moveX || moveZ) {
      this.camera.getWorldPosition(this.tempVecA);
      const curX = this.tempVecA.x;
      const curZ = this.tempVecA.z;
      if (!this.player._collides(curX + moveX, curZ)) {
        this.vrRig.position.x += moveX;
      }
      this.camera.getWorldPosition(this.tempVecA);
      if (!this.player._collides(this.tempVecA.x, this.tempVecA.z + moveZ)) {
        this.vrRig.position.z += moveZ;
      }
    }

    this.vrRig.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.tempVecA);
    this.player.position.set(this.tempVecA.x, this.player.groundY, this.tempVecA.z);
    this.player.yaw = Math.atan2(-fwdX, -fwdZ);
  }

  getVrSyncPayload() {
    if (!this.active || !this.camera || !this.player) return { active: false };
    const basePos = this.player.position;
    const baseY = this.player.groundY || 0;
    const q = (v) => Math.round(v * 1000) / 1000;

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

    return {
      active: true,
      head: extractRel(this.camera),
      leftHand: extractRel(this.slots.left.hand.root, {
        grip: q(leftBtn.gripVal),
        trigger: q(leftBtn.triggerVal),
        thumb: q(leftBtn.thumbVal)
      }),
      rightHand: extractRel(this.slots.right.hand.root, {
        grip: q(rightBtn.gripVal),
        trigger: q(rightBtn.triggerVal),
        thumb: q(rightBtn.thumbVal)
      })
    };
  }

  update(dt, elapsed, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    if (!this.active) return;

    const leftState = this._readControllerButtons(this.slots.left);
    const rightState = this._readControllerButtons(this.slots.right);

    this._updateLocomotion(dt, nowMs, leftState, rightState);

    this.slots.left.hand.setPose({
      trigger: leftState.triggerVal,
      grip: leftState.gripVal,
      thumb: leftState.thumbVal,
      elapsed
    });
    this.slots.right.hand.setPose({
      trigger: rightState.triggerVal,
      grip: rightState.gripVal,
      thumb: rightState.thumbVal,
      elapsed
    });

    if (this.camera) {
      this.camera.getWorldPosition(this.tempVecA);
      this.wristPanel.updateVisibility(this.tempVecA, dt);
    }

    this._updateSlotRayAndInteract(this.slots.left, leftState, dt, elapsed);
    this._updateSlotRayAndInteract(this.slots.right, rightState, dt, elapsed);
  }
}
