import * as THREE from 'three';
import { animateAvatarLimbs } from './AvatarBuilder.js';
import { evaluateSurfaceAt, getCeilingHeightAt, getFloorFromY } from './mapSchema.js';
import { PLATEAU_SPAWN, WORLD_BOUNDS } from './plateauLayout.js';

export class PlayerController {
  constructor(camera, canvas, colliders = [], options = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.colliders = colliders;
    this.onJump = options.onJump || null;

    this.bounds = { ...WORLD_BOUNDS };
    this.eyeHeight = PLATEAU_SPAWN.y;
    this.surfaceY = 0;
    this.currentFloor = 0;
    this.groundY = this.eyeHeight;
    this.position = new THREE.Vector3(PLATEAU_SPAWN.x, this.groundY, PLATEAU_SPAWN.z);
    this.walkableSurfaces = null;
    this.spatialHash = null;
    this._surfaceScratch = { found: false, y: 0, onRamp: false, stairId: null, floor: 0 };
    this._hashScratch = [];
    this._onRamp = false;
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    const dx = PLATEAU_SPAWN.lookAt.x - PLATEAU_SPAWN.x;
    const dz = PLATEAU_SPAWN.lookAt.z - PLATEAU_SPAWN.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.05;
    this.speed = 5.4;
    this.speedMultiplier = 1.0;
    this.noclip = false;
    this.radius = 0.42;
    this.keys = new Set();
    this.virtualMove = { right: 0, forward: 0 };
    this.virtualSprint = false;
    this.touchMode = false;
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.enabled = false;
    this.hasPointerLock = false;
    this.sensitivity = 1.0;
    this.touchSensitivity = 1.0;
    this.adsSensitivityMultiplier = 1.0;
    this._activePointerId = null;
    this._pointerActive = false;
    this.cameraMode = 'first';
    this.avatar = null;
    this.avatarVisible = false;
    this.vrModeActive = false;
    this.movementLocked = false;
    this.seated = false;
    this.seatedPose = null;
    this.hidingInRack = false;
    this.hidingPose = null;
    this._stepResultScratch = { isMoving: false, landed: false };
    this._colliderCellSize = 4;
    this._colliderGrid = null;
    this._colliderGridSource = null;
    this._colliderGridLen = -1;
    this._rebuildColliderGrid();

    this.camera.rotation.order = 'YXZ';
    this._applyCamera();
    this._bindEvents();
  }

  setVrMode(active) {
    this.vrModeActive = Boolean(active);
  }

  setAvatar(avatarObj) {
    this.avatar = avatarObj;
    this._syncAvatarVisibility();
    if (!this.vrModeActive) {
      this._applyCamera();
    }
  }

  setAvatarVisible(visible) {
    this.avatarVisible = Boolean(visible);
    this._syncAvatarVisibility();
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'third' ? 'third' : 'first';
    this._syncAvatarVisibility();
    if (!this.vrModeActive) {
      this._applyCamera();
    }
  }

  _syncAvatarVisibility() {
    if (this.avatar?.group) {
      this.avatar.group.visible = this.avatarVisible && this.cameraMode === 'third' && !this.hidingInRack;
    }
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.4, Math.min(2.2, Number(val) || 1.0));
  }

  setTouchSensitivity(val) {
    this.touchSensitivity = Math.max(0.4, Math.min(2.4, Number(val) || 1.0));
  }

  setAdsSensitivityMultiplier(mult = 1.0) {
    const n = Number(mult);
    this.adsSensitivityMultiplier = Number.isFinite(n) ? Math.max(0.18, Math.min(1.0, n)) : 1.0;
  }

  clearKeys() {
    this.keys.clear();
    this.virtualMove.right = 0;
    this.virtualMove.forward = 0;
    this.dragging = false;
    this._activePointerId = null;
    this._pointerActive = false;
  }

  setTouchMode(enabled) {
    this.touchMode = Boolean(enabled);
    if (this.touchMode && document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
    if (!this.touchMode) {
      this.virtualMove.right = 0;
      this.virtualMove.forward = 0;
      this.virtualSprint = false;
    }
  }

  setMoveVector(right, forward) {
    this.virtualMove.right = Math.max(-1, Math.min(1, Number(right) || 0));
    this.virtualMove.forward = Math.max(-1, Math.min(1, Number(forward) || 0));
  }

  setSprint(active) {
    this.virtualSprint = Boolean(active);
  }

  lookDelta(dx, dy) {
    if (!this.enabled) return;
    const maxPitch = this.seated ? 1.15 : 1.1;
    const sens = (this.touchMode ? this.touchSensitivity : this.sensitivity) * this.adsSensitivityMultiplier;
    this.yaw -= dx * 0.0052 * sens;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - dy * 0.0052 * sens));
    if (this.hidingInRack) {
      this._clampHidingAngles();
    }
  }

  triggerJump() {
    if (!this.enabled || this.movementLocked || this.seated || this.hidingInRack || !this.isGrounded) return false;
    this.velocityY = 6.2;
    this.isGrounded = false;
    this.onJump?.();
    return true;
  }

  _clampHidingAngles() {
    if (!this.hidingInRack || !this.hidingPose) return;
    const baseYaw = Number.isFinite(Number(this.hidingPose.baseYaw)) ? Number(this.hidingPose.baseYaw) : 0;
    const maxYaw = Number.isFinite(Number(this.hidingPose.maxYawDelta)) ? Number(this.hidingPose.maxYawDelta) : Math.PI / 4;
    const maxPitch = Number.isFinite(Number(this.hidingPose.maxPitchDelta))
      ? Number(this.hidingPose.maxPitchDelta)
      : (20 * Math.PI) / 180;
    const diff = Math.atan2(Math.sin(this.yaw - baseYaw), Math.cos(this.yaw - baseYaw));
    const clampedDiff = Math.max(-maxYaw, Math.min(maxYaw, diff));
    this.yaw = baseYaw + clampedDiff;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  setHidingInRack(active, pose = null) {
    this.hidingInRack = Boolean(active);
    if (this.hidingInRack) {
      this.seated = false;
      this.seatedPose = null;
      this.movementLocked = true;
      this.clearKeys();
      this.velocityY = 0;
      this.isGrounded = true;
      this.wasGrounded = true;
      const hx = Number.isFinite(Number(pose?.x)) ? Number(pose.x) : this.position.x;
      const hy = Number.isFinite(Number(pose?.y)) ? Number(pose.y) : 1.52;
      const hz = Number.isFinite(Number(pose?.z)) ? Number(pose.z) : this.position.z;
      const baseYaw = Number.isFinite(Number(pose?.baseYaw))
        ? Number(pose.baseYaw)
        : Number.isFinite(Number(pose?.yaw))
          ? Number(pose.yaw)
          : this.yaw;
      const maxYawDelta = Number.isFinite(Number(pose?.maxYawDelta)) ? Number(pose.maxYawDelta) : Math.PI / 4;
      const maxPitchDelta = Number.isFinite(Number(pose?.maxPitchDelta))
        ? Number(pose.maxPitchDelta)
        : (20 * Math.PI) / 180;
      this.hidingPose = { x: hx, y: hy, z: hz, baseYaw, maxYawDelta, maxPitchDelta };
      this.position.set(hx, hy, hz);
      this.yaw = baseYaw;
      this.pitch = 0;
      this._clampHidingAngles();
      this._syncAvatarVisibility();
      if (!this.vrModeActive) {
        this._applyCamera();
      }
      return;
    }
    this.hidingPose = null;
    this.movementLocked = false;
    this.clearKeys();
    this.position.y = this.groundY;
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    this._syncAvatarVisibility();
    if (!this.vrModeActive) {
      this._applyCamera();
    }
  }

  setMovementLocked(locked) {
    this.movementLocked = Boolean(locked);
    if (this.movementLocked) {
      this.clearKeys();
    }
  }

  setSeated(seated, pose = null) {
    this.seated = Boolean(seated);
    if (this.seated) {
      this.movementLocked = true;
      this.clearKeys();
      this.velocityY = 0;
      this.isGrounded = true;
      this.wasGrounded = true;
      const sx = Number.isFinite(Number(pose?.x)) ? Number(pose.x) : this.position.x;
      const sy = Number.isFinite(Number(pose?.y)) ? Number(pose.y) : 1.28;
      const sz = Number.isFinite(Number(pose?.z)) ? Number(pose.z) : this.position.z;
      this.seatedPose = { x: sx, y: sy, z: sz };
      this.position.set(sx, sy, sz);
      if (pose?.lookAt) {
        const dx = Number(pose.lookAt.x) - sx;
        const dy = (Number.isFinite(Number(pose.lookAt.y)) ? Number(pose.lookAt.y) : sy - 0.12) - sy;
        const dz = Number(pose.lookAt.z) - sz;
        const dist = Math.max(0.25, Math.hypot(dx, dz));
        this.yaw = Math.atan2(-dx, -dz);
        this.pitch = Math.max(-1.15, Math.min(1.15, Math.atan2(dy, dist)));
      } else {
        if (Number.isFinite(Number(pose?.yaw))) this.yaw = Number(pose.yaw);
        if (Number.isFinite(Number(pose?.pitch))) {
          this.pitch = Math.max(-1.15, Math.min(1.15, Number(pose.pitch)));
        }
      }
      if (!this.vrModeActive) {
        this._applyCamera();
      }
      return;
    }
    this.seatedPose = null;
    this.movementLocked = false;
    this.clearKeys();
    this.position.y = this.groundY;
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    if (!this.vrModeActive) {
      this._applyCamera();
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.clearKeys();
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock?.();
      }
    }
  }

  _bindEvents() {
    if (typeof window === 'undefined' || !this.canvas) return;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.clearKeys();
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch' && !this.seated && !this.hidingInRack) return;
      if (e.pointerType !== 'touch' && e.button !== 0 && !(this.seated && e.button === 2)) return;
      this._activePointerId = e.pointerId;
      this._pointerActive = true;
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this._pointerActive || e.pointerId !== this._activePointerId) return;
      if (document.pointerLockElement === this.canvas) return;
      const maxPitch = this.seated ? 1.15 : 1.1;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      const sens = (e.pointerType === 'touch' ? this.touchSensitivity : this.sensitivity) * this.adsSensitivityMultiplier;
      this.yaw -= dx * 0.004 * sens;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - dy * 0.004 * sens));
      if (this.hidingInRack) {
        this._clampHidingAngles();
      }
    });

    const endPointerDrag = (e) => {
      if (this._pointerActive && (e.pointerId === undefined || e.pointerId === this._activePointerId)) {
        this._activePointerId = null;
        this._pointerActive = false;
        this.dragging = false;
      }
    };
    window.addEventListener('pointerup', endPointerDrag);
    window.addEventListener('pointercancel', endPointerDrag);

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this._pointerActive || (e.button !== 0 && !(this.seated && e.button === 2))) return;
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      if (!this._pointerActive) {
        this.dragging = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      const maxPitch = this.seated ? 1.15 : 1.1;
      if (document.pointerLockElement === this.canvas) {
        const effSens = this.sensitivity * this.adsSensitivityMultiplier;
        this.yaw -= e.movementX * 0.0023 * effSens;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - e.movementY * 0.0023 * effSens));
      } else if (this.dragging && !this._pointerActive) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        const effSens = this.sensitivity * this.adsSensitivityMultiplier;
        this.yaw -= dx * 0.004 * effSens;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - dy * 0.004 * effSens));
      }
      if (this.hidingInRack) {
        this._clampHidingAngles();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.hasPointerLock = document.pointerLockElement === this.canvas;
    });
  }

  requestPointerLock() {
    if (!this.enabled || this.touchMode) return;
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }

  setWalkableSurfaces(surfaces) {
    this.walkableSurfaces = surfaces || null;
    if (this.walkableSurfaces) {
      const feetY = this.getFeetY();
      const surf = evaluateSurfaceAt(this.walkableSurfaces, this.position.x, this.position.z, feetY, {
        maxStepUp: 0.9,
        out: this._surfaceScratch
      });
      if (surf.found) {
        this.surfaceY = surf.y;
        this.groundY = this.surfaceY + this.eyeHeight;
        if (this.isGrounded) {
          this.position.y = this.groundY;
        }
        this.currentFloor = getFloorFromY(this.walkableSurfaces, this.surfaceY);
      }
    } else {
      this.surfaceY = 0;
      this.groundY = this.eyeHeight;
      this.currentFloor = 0;
    }
  }

  setSpatialHash(hash) {
    this.spatialHash = hash || null;
  }

  getFeetY() {
    return this.position.y - this.eyeHeight;
  }

  getCurrentFloor() {
    return this.currentFloor;
  }

  teleportTo(targetPos, lookAtPos) {
    const tx = Number.isFinite(Number(targetPos?.x))
      ? Number(targetPos.x)
      : Number.isFinite(Number(targetPos?.position?.x))
        ? Number(targetPos.position.x)
        : Number.isFinite(this.position.x)
          ? this.position.x
          : 0;
    const tz = Number.isFinite(Number(targetPos?.z))
      ? Number(targetPos.z)
      : Number.isFinite(Number(targetPos?.position?.z))
        ? Number(targetPos.position.z)
        : Number.isFinite(this.position.z)
          ? this.position.z
          : 0;
    const rawY = Number.isFinite(Number(targetPos?.surfaceY))
      ? Number(targetPos.surfaceY)
      : Number.isFinite(Number(targetPos?.floor))
        ? Number(targetPos.floor) * (this.walkableSurfaces?.floorHeight || 3.8)
        : Number.isFinite(Number(targetPos?.y))
          ? (Math.abs(Number(targetPos.y) - this.eyeHeight) < 0.05 && !targetPos?.isFeetY
            ? 0
            : Number(targetPos.y))
          : this.surfaceY;
    let landingFeetY = rawY;
    if (this.walkableSurfaces) {
      const surf = evaluateSurfaceAt(this.walkableSurfaces, tx, tz, rawY, {
        maxStepUp: 1.2,
        out: this._surfaceScratch
      });
      if (surf.found) {
        landingFeetY = surf.y;
      }
      this.currentFloor = getFloorFromY(this.walkableSurfaces, landingFeetY);
    } else {
      this.currentFloor = 0;
    }
    this.surfaceY = landingFeetY;
    this.groundY = landingFeetY + this.eyeHeight;
    this.position.set(tx, this.groundY, tz);
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    if (lookAtPos) {
      const lx = Number.isFinite(Number(lookAtPos?.x))
        ? Number(lookAtPos.x)
        : Number.isFinite(Number(lookAtPos?.position?.x))
          ? Number(lookAtPos.position.x)
          : NaN;
      const lz = Number.isFinite(Number(lookAtPos?.z))
        ? Number(lookAtPos.z)
        : Number.isFinite(Number(lookAtPos?.position?.z))
          ? Number(lookAtPos.position.z)
          : NaN;
      if (Number.isFinite(lx) && Number.isFinite(lz)) {
        const dx = lx - tx;
        const dz = lz - tz;
        if (Math.hypot(dx, dz) > 0.001) {
          this.yaw = Math.atan2(-dx, -dz);
        }
        this.pitch = -0.12;
      }
    }
    if (!this.vrModeActive) {
      this._applyCamera();
    }
  }

  resolveUnstuckPosition(desiredX, desiredZ, rotRad = 0, feetY = null) {
    const rx = Number.isFinite(Number(desiredX)) ? Number(desiredX) : 0;
    const rz = Number.isFinite(Number(desiredZ)) ? Number(desiredZ) : 0;
    const fy = Number.isFinite(Number(feetY)) ? Number(feetY) : this.getFeetY();
    if (!this._collides(rx, rz, fy)) {
      return { x: rx, z: rz };
    }
    const radii = [0.25, 0.5, 0.85, 1.15, 1.45];
    const angles = [0, 0.4, -0.4, 0.85, -0.85, Math.PI / 2, -Math.PI / 2, Math.PI];
    for (const r of radii) {
      for (const a of angles) {
        const cx = rx + Math.sin(rotRad + a) * r;
        const cz = rz + Math.cos(rotRad + a) * r;
        if (!this._collides(cx, cz, fy)) {
          return { x: cx, z: cz };
        }
      }
    }
    const clamped = this.clampToBounds(rx, rz);
    return { x: clamped.x, z: clamped.z };
  }

  setColliders(colliders) {
    this.colliders = Array.isArray(colliders) ? colliders : [];
    this._rebuildColliderGrid();
  }

  _rebuildColliderGrid() {
    const list = Array.isArray(this.colliders) ? this.colliders : [];
    this._colliderGridSource = list;
    this._colliderGridLen = list.length;
    if (list.length < 12) {
      this._colliderGrid = null;
      return;
    }
    const cs = this._colliderCellSize;
    const grid = new Map();
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      let minX;
      let maxX;
      let minZ;
      let maxZ;
      if (typeof c.cx === 'number') {
        const ext = Math.hypot(c.hw || 0, c.hd || 0);
        minX = c.cx - ext;
        maxX = c.cx + ext;
        minZ = c.cz - ext;
        maxZ = c.cz + ext;
      } else {
        minX = c.minX;
        maxX = c.maxX;
        minZ = c.minZ;
        maxZ = c.maxZ;
      }
      const x0 = Math.floor((minX - 0.6) / cs);
      const x1 = Math.floor((maxX + 0.6) / cs);
      const z0 = Math.floor((minZ - 0.6) / cs);
      const z1 = Math.floor((maxZ + 0.6) / cs);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = gx * 4096 + gz;
          let bucket = grid.get(key);
          if (!bucket) {
            bucket = [];
            grid.set(key, bucket);
          }
          bucket.push(c);
        }
      }
    }
    this._colliderGrid = grid;
  }

  setBounds(bounds) {
    if (bounds && typeof bounds === 'object') {
      this.bounds = { ...this.bounds, ...bounds };
    }
  }

  setSpeedMultiplier(mult) {
    const n = Number(mult);
    this.speedMultiplier = Number.isFinite(n) ? Math.max(0.5, Math.min(6, n)) : 1.0;
  }

  setNoclip(enabled) {
    this.noclip = Boolean(enabled);
  }

  clampToBounds(x, z) {
    const bnd = this.bounds || WORLD_BOUNDS;
    const pad = this.radius + 0.15;
    const safeX = Number.isFinite(Number(x)) ? Number(x) : this.position.x;
    const safeZ = Number.isFinite(Number(z)) ? Number(z) : this.position.z;
    if (this.noclip) {
      return { x: safeX, z: safeZ };
    }
    return {
      x: Math.max(bnd.minX + pad, Math.min(bnd.maxX - pad, safeX)),
      z: Math.max(bnd.minZ + pad, Math.min(bnd.maxZ - pad, safeZ))
    };
  }

  moveHorizontally(dx, dz, startX = this.position.x, startZ = this.position.z, dt = 0.016) {
    const stepX = Number.isFinite(Number(dx)) ? Number(dx) : 0;
    const stepZ = Number.isFinite(Number(dz)) ? Number(dz) : 0;
    let curX = Number.isFinite(Number(startX)) ? Number(startX) : this.position.x;
    let curZ = Number.isFinite(Number(startZ)) ? Number(startZ) : this.position.z;
    const fy = this.getFeetY();
    let movedX = false;
    let movedZ = false;

    if (stepX !== 0 && !this._collides(curX + stepX, curZ, fy)) {
      curX += stepX;
      movedX = true;
    }
    if (stepZ !== 0 && !this._collides(curX, curZ + stepZ, fy)) {
      curZ += stepZ;
      movedZ = true;
    }

    const clamped = this.clampToBounds(curX, curZ);
    const actualDx = clamped.x - (Number.isFinite(Number(startX)) ? Number(startX) : this.position.x);
    const actualDz = clamped.z - (Number.isFinite(Number(startZ)) ? Number(startZ) : this.position.z);

    this.position.x = clamped.x;
    this.position.z = clamped.z;
    this._updateVerticalPhysics(Math.max(0.004, Math.min(0.08, Number(dt) || 0.016)));

    return {
      x: clamped.x,
      z: clamped.z,
      y: this.surfaceY,
      floor: this.currentFloor,
      movedX,
      movedZ,
      actualDx,
      actualDz,
      collided: (stepX !== 0 && !movedX) || (stepZ !== 0 && !movedZ)
    };
  }

  setVrPose({ x, y, z, yaw, dt = 0.016, skipPhysics = false } = {}) {
    const targetX = Number.isFinite(Number(x)) ? Number(x) : this.position.x;
    const targetZ = Number.isFinite(Number(z)) ? Number(z) : this.position.z;
    const clamped = this.clampToBounds(targetX, targetZ);
    if (Number.isFinite(Number(y))) {
      this.position.set(clamped.x, Number(y), clamped.z);
    } else {
      this.position.set(clamped.x, this.position.y, clamped.z);
    }
    if (!skipPhysics) {
      this._updateVerticalPhysics(Math.max(0.004, Math.min(0.08, Number(dt) || 0.016)));
    }
    if (Number.isFinite(Number(yaw))) {
      this.yaw = Number(yaw);
    }
    if (this.avatar?.group) {
      this.avatar.group.position.set(this.position.x, this.getFeetY(), this.position.z);
      this.avatar.group.rotation.y = this.yaw + Math.PI;
    }
  }

  _collides(nx, nz, feetY = null) {
    if (this.noclip) {
      return false;
    }
    const bnd = this.bounds || WORLD_BOUNDS;
    if (
      nx - this.radius < bnd.minX + 0.14 ||
      nx + this.radius > bnd.maxX - 0.14 ||
      nz - this.radius < bnd.minZ + 0.14 ||
      nz + this.radius > bnd.maxZ - 0.14
    ) {
      return true;
    }
    const fy = Number.isFinite(Number(feetY)) ? Number(feetY) : this.getFeetY();
    let candidates;
    if (this.spatialHash) {
      const fl = this.walkableSurfaces ? getFloorFromY(this.walkableSurfaces, fy) : this.currentFloor;
      candidates = this.spatialHash.queryColliders(nx, nz, this.radius + 0.55, fl, this._hashScratch);
    } else {
      if (this._colliderGridSource !== this.colliders || this._colliderGridLen !== this.colliders.length) {
        this._rebuildColliderGrid();
      }
      candidates = this._colliderGrid
        ? this._colliderGrid.get(Math.floor(nx / this._colliderCellSize) * 4096 + Math.floor(nz / this._colliderCellSize))
        : this.colliders;
    }
    if (!candidates || candidates.length === 0) return false;
    const r = this.radius;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (Number.isFinite(c.minY) && Number.isFinite(c.maxY)) {
        if (c.maxY <= fy + 0.30 || c.minY >= fy + 1.65) {
          continue;
        }
      }
      if (typeof c.cx === 'number') {
        const dx = nx - c.cx;
        const dz = nz - c.cz;
        const along = dx * c.ux + dz * c.uz;
        const perp = -dx * c.uz + dz * c.ux;
        if (
          Math.abs(along) < c.hw + r &&
          Math.abs(perp) < c.hd + r
        ) {
          return true;
        }
        continue;
      }
      if (
        nx + r > c.minX &&
        nx - r < c.maxX &&
        nz + r > c.minZ &&
        nz - r < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  _updateVerticalPhysics(dt) {
    let feetY = this.position.y - this.eyeHeight;
    let landed = false;

    if (!this.walkableSurfaces) {
      this.surfaceY = 0;
      this.groundY = this.eyeHeight;
      this.currentFloor = 0;
      this._onRamp = false;
      if (!this.isGrounded) {
        this.velocityY -= 18.5 * dt;
        this.position.y += this.velocityY * dt;
        if (this.position.y <= this.groundY) {
          this.position.y = this.groundY;
          this.velocityY = 0;
          this.isGrounded = true;
          landed = true;
        }
      } else {
        this.position.y = this.groundY;
        this.velocityY = 0;
      }
      return landed;
    }

    const surf = evaluateSurfaceAt(this.walkableSurfaces, this.position.x, this.position.z, feetY, {
      maxStepUp: this.isGrounded ? 0.72 : 0.45,
      out: this._surfaceScratch
    });
    const targetFeetY = surf.found ? surf.y : this.walkableSurfaces.minSurfaceY;

    if (this.isGrounded) {
      const deltaY = targetFeetY - feetY;
      if (deltaY >= -0.65 && deltaY <= 0.72) {
        if (!surf.onRamp && Math.abs(deltaY) > 0.04) {
          feetY += deltaY * Math.min(1, dt * 22);
        } else {
          feetY = targetFeetY;
        }
        this.velocityY = 0;
        this.isGrounded = true;
      } else if (deltaY < -0.65) {
        this.isGrounded = false;
        this.velocityY = Math.min(0, this.velocityY);
      }
    }

    if (!this.isGrounded) {
      this.velocityY -= 18.5 * dt;
      feetY += this.velocityY * dt;
      if (this.velocityY > 0) {
        const ceilY = getCeilingHeightAt(this.walkableSurfaces, this.position.x, this.position.z, this.surfaceY);
        if (feetY + 1.78 > ceilY) {
          feetY = ceilY - 1.78;
          this.velocityY = 0;
        }
      }
      if (this.velocityY <= 0 && feetY <= targetFeetY) {
        feetY = targetFeetY;
        this.velocityY = 0;
        this.isGrounded = true;
        landed = true;
      } else if (feetY < this.walkableSurfaces.minSurfaceY - 2.0) {
        feetY = this.walkableSurfaces.minSurfaceY;
        this.velocityY = 0;
        this.isGrounded = true;
        landed = true;
      }
    }

    this.surfaceY = targetFeetY;
    this.groundY = this.surfaceY + this.eyeHeight;
    this.position.y = feetY + this.eyeHeight;
    this._onRamp = Boolean(surf.onRamp);
    this.currentFloor = getFloorFromY(this.walkableSurfaces, feetY);
    return landed;
  }

  update(dt) {
    const res = this._stepResultScratch;
    res.isMoving = false;
    res.landed = false;
    if (!this.enabled) return res;

    if (this.seated) {
      const lookSpeed = 1.9 * Math.max(0.6, this.sensitivity || 1);
      if (this.keys.has('ArrowLeft')) this.yaw += lookSpeed * dt;
      if (this.keys.has('ArrowRight')) this.yaw -= lookSpeed * dt;
      if (this.keys.has('ArrowUp')) this.pitch = Math.min(1.15, this.pitch + lookSpeed * 0.85 * dt);
      if (this.keys.has('ArrowDown')) this.pitch = Math.max(-1.15, this.pitch - lookSpeed * 0.85 * dt);
      if (this.seatedPose) {
        this.position.set(this.seatedPose.x, this.seatedPose.y, this.seatedPose.z);
      }
      this.velocityY = 0;
      this.isGrounded = true;
      animateAvatarLimbs(this.avatar, dt, {
        isMoving: false,
        isGrounded: true,
        speedRatio: 1
      });
      this._applyCamera();
      return res;
    }

    if (this.hidingInRack) {
      const lookSpeed = 1.65 * Math.max(0.6, this.sensitivity || 1);
      if (this.keys.has('ArrowLeft')) this.yaw += lookSpeed * dt;
      if (this.keys.has('ArrowRight')) this.yaw -= lookSpeed * dt;
      if (this.keys.has('ArrowUp')) this.pitch += lookSpeed * 0.75 * dt;
      if (this.keys.has('ArrowDown')) this.pitch -= lookSpeed * 0.75 * dt;
      this._clampHidingAngles();
      if (this.hidingPose) {
        this.position.set(this.hidingPose.x, this.hidingPose.y, this.hidingPose.z);
      }
      this.velocityY = 0;
      this.isGrounded = true;
      animateAvatarLimbs(this.avatar, dt, {
        isMoving: false,
        isGrounded: true,
        speedRatio: 1
      });
      this._applyCamera();
      return res;
    }

    let forward = this.virtualMove.forward;
    let right = this.virtualMove.right;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;

    let isMoving = false;
    const sprint =
      (this.virtualSprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.45 : 1) *
      (this.speedMultiplier || 1);

    const len = Math.hypot(forward, right);
    if (len > 0.001 && !this.movementLocked) {
      if (len > 1) {
        forward /= len;
        right /= len;
      }

      const moveDist = this.speed * sprint * dt;
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      const dx = (-sinY * forward + cosY * right) * moveDist;
      const dz = (-cosY * forward - sinY * right) * moveDist;

      const fy = this.getFeetY();
      let moved = false;
      if (!this._collides(this.position.x + dx, this.position.z, fy)) {
        this.position.x += dx;
        moved = true;
      }
      if (!this._collides(this.position.x, this.position.z + dz, fy)) {
        this.position.z += dz;
        moved = true;
      }
      isMoving = moved;
    }

    if (this.keys.has('Space') && !this.movementLocked) {
      this.triggerJump();
    }

    this.wasGrounded = this.isGrounded;
    const landed = this._updateVerticalPhysics(dt);

    animateAvatarLimbs(this.avatar, dt, {
      isMoving,
      isGrounded: this.isGrounded,
      speedRatio: sprint
    });

    this._applyCamera();
    res.isMoving = isMoving;
    res.landed = landed;
    return res;
  }

  _applyCamera() {
    if (this.hidingInRack) {
      if (this.avatar?.group) {
        this.avatar.group.visible = false;
      }
      this._clampHidingAngles();
      this.camera.position.copy(this.position);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    if (this.seated) {
      if (this.avatar?.group) {
        this.avatar.group.position.set(this.position.x, this.surfaceY, this.position.z);
        this.avatar.group.rotation.y = this.yaw + Math.PI;
      }
      this.camera.position.copy(this.position);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    const feetY = this.getFeetY();
    if (this.avatar?.group) {
      this.avatar.group.position.set(this.position.x, feetY, this.position.z);
      this.avatar.group.rotation.y = this.yaw + Math.PI;
    }

    if (this.cameraMode === 'third') {
      const targetX = this.position.x;
      const targetY = feetY + 1.48;
      const targetZ = this.position.z;

      const clampedPitch = Math.max(-0.55, Math.min(0.85, this.pitch));
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      const cosP = Math.cos(clampedPitch);
      const sinP = Math.sin(clampedPitch);

      const dirX = sinY * cosP;
      const dirY = -sinP + 0.14;
      const dirZ = cosY * cosP;

      const bnd = this.bounds || WORLD_BOUNDS;
      const ceilY = this.walkableSurfaces
        ? getCeilingHeightAt(this.walkableSurfaces, targetX, targetZ, this.surfaceY)
        : (bnd.height || 4.6);
      const minCamY = this.surfaceY + 0.45;
      const maxCamY = ceilY - 0.3;
      let dist = 3.25;
      for (let d = 0.5; d <= 3.25; d += 0.25) {
        const cx = targetX + dirX * d;
        const cz = targetZ + dirZ * d;
        const cy = targetY + dirY * d;
        if (
          cx < bnd.minX + 0.25 ||
          cx > bnd.maxX - 0.25 ||
          cz < bnd.minZ + 0.25 ||
          cz > bnd.maxZ - 0.25 ||
          cy < minCamY ||
          cy > maxCamY
        ) {
          dist = Math.max(0.65, d - 0.25);
          break;
        }
      }

      this.camera.position.set(
        targetX + dirX * dist,
        Math.max(minCamY, Math.min(maxCamY, targetY + dirY * dist)),
        targetZ + dirZ * dist
      );
      this.camera.lookAt(targetX, targetY + 0.12, targetZ);
      return;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
