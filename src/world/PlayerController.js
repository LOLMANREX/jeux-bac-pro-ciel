import * as THREE from 'three';
import { animateAvatarLimbs } from './AvatarBuilder.js';
import { PLATEAU_SPAWN, WORLD_BOUNDS } from './plateauLayout.js';

export class PlayerController {
  constructor(camera, canvas, colliders = [], options = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.colliders = colliders;
    this.onJump = options.onJump || null;

    this.bounds = { ...WORLD_BOUNDS };
    this.groundY = PLATEAU_SPAWN.y;
    this.position = new THREE.Vector3(PLATEAU_SPAWN.x, this.groundY, PLATEAU_SPAWN.z);
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
    this.cameraMode = 'first';
    this.avatar = null;
    this.avatarVisible = false;
    this.vrModeActive = false;

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
      this.avatar.group.visible = this.avatarVisible && this.cameraMode === 'third';
    }
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.4, Math.min(2.2, Number(val) || 1.0));
  }

  clearKeys() {
    this.keys.clear();
    this.virtualMove.right = 0;
    this.virtualMove.forward = 0;
    this.dragging = false;
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
    this.yaw -= dx * 0.0052 * this.sensitivity;
    this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - dy * 0.0052 * this.sensitivity));
  }

  triggerJump() {
    if (!this.enabled || !this.isGrounded) return false;
    this.velocityY = 6.2;
    this.isGrounded = false;
    this.onJump?.();
    return true;
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

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === this.canvas) {
        this.yaw -= e.movementX * 0.0023 * this.sensitivity;
        this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - e.movementY * 0.0023 * this.sensitivity));
      } else if (this.dragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.yaw -= dx * 0.004 * this.sensitivity;
        this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - dy * 0.004 * this.sensitivity));
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

  teleportTo(targetPos, lookAtPos) {
    this.position.set(targetPos.x, this.groundY, targetPos.z);
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    if (lookAtPos) {
      const dx = lookAtPos.x - targetPos.x;
      const dz = lookAtPos.z - targetPos.z;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = -0.12;
    }
    if (!this.vrModeActive) {
      this._applyCamera();
    }
  }

  setColliders(colliders) {
    this.colliders = Array.isArray(colliders) ? colliders : [];
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

  moveHorizontally(dx, dz, startX = this.position.x, startZ = this.position.z) {
    const stepX = Number.isFinite(Number(dx)) ? Number(dx) : 0;
    const stepZ = Number.isFinite(Number(dz)) ? Number(dz) : 0;
    let curX = Number.isFinite(Number(startX)) ? Number(startX) : this.position.x;
    let curZ = Number.isFinite(Number(startZ)) ? Number(startZ) : this.position.z;
    let movedX = false;
    let movedZ = false;

    if (stepX !== 0 && !this._collides(curX + stepX, curZ)) {
      curX += stepX;
      movedX = true;
    }
    if (stepZ !== 0 && !this._collides(curX, curZ + stepZ)) {
      curZ += stepZ;
      movedZ = true;
    }

    const clamped = this.clampToBounds(curX, curZ);
    const actualDx = clamped.x - (Number.isFinite(Number(startX)) ? Number(startX) : this.position.x);
    const actualDz = clamped.z - (Number.isFinite(Number(startZ)) ? Number(startZ) : this.position.z);

    this.position.set(clamped.x, this.groundY, clamped.z);
    this.velocityY = 0;
    this.isGrounded = true;

    return {
      x: clamped.x,
      z: clamped.z,
      movedX,
      movedZ,
      actualDx,
      actualDz,
      collided: (stepX !== 0 && !movedX) || (stepZ !== 0 && !movedZ)
    };
  }

  setVrPose({ x, z, yaw } = {}) {
    const targetX = Number.isFinite(Number(x)) ? Number(x) : this.position.x;
    const targetZ = Number.isFinite(Number(z)) ? Number(z) : this.position.z;
    const clamped = this.clampToBounds(targetX, targetZ);
    this.position.set(clamped.x, this.groundY, clamped.z);
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    if (Number.isFinite(Number(yaw))) {
      this.yaw = Number(yaw);
    }
    if (this.avatar?.group) {
      this.avatar.group.position.set(this.position.x, 0, this.position.z);
      this.avatar.group.rotation.y = this.yaw + Math.PI;
    }
  }

  _collides(nx, nz) {
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
    for (const c of this.colliders) {
      if (typeof c.cx === 'number') {
        const dx = nx - c.cx;
        const dz = nz - c.cz;
        const along = dx * c.ux + dz * c.uz;
        const perp = -dx * c.uz + dz * c.ux;
        if (
          Math.abs(along) < c.hw + this.radius &&
          Math.abs(perp) < c.hd + this.radius
        ) {
          return true;
        }
        continue;
      }
      if (
        nx + this.radius > c.minX &&
        nx - this.radius < c.maxX &&
        nz + this.radius > c.minZ &&
        nz - this.radius < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  update(dt) {
    if (!this.enabled) return { isMoving: false, landed: false };

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
    if (len > 0.001) {
      if (len > 1) {
        forward /= len;
        right /= len;
      }

      const moveDist = this.speed * sprint * dt;
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      const dx = (-sinY * forward + cosY * right) * moveDist;
      const dz = (-cosY * forward - sinY * right) * moveDist;

      let moved = false;
      if (!this._collides(this.position.x + dx, this.position.z)) {
        this.position.x += dx;
        moved = true;
      }
      if (!this._collides(this.position.x, this.position.z + dz)) {
        this.position.z += dz;
        moved = true;
      }
      isMoving = moved;
    }

    if (this.keys.has('Space')) {
      this.triggerJump();
    }

    this.wasGrounded = this.isGrounded;
    let landed = false;
    if (!this.isGrounded) {
      this.velocityY -= 18.5 * dt;
      this.position.y += this.velocityY * dt;
      if (this.position.y <= this.groundY) {
        this.position.y = this.groundY;
        this.velocityY = 0;
        this.isGrounded = true;
        landed = true;
      }
    }

    animateAvatarLimbs(this.avatar, dt, {
      isMoving,
      isGrounded: this.isGrounded,
      speedRatio: sprint
    });

    this._applyCamera();
    return { isMoving, landed };
  }

  _applyCamera() {
    const jumpOffset = Math.max(0, this.position.y - this.groundY);
    if (this.avatar?.group) {
      this.avatar.group.position.set(this.position.x, jumpOffset, this.position.z);
      this.avatar.group.rotation.y = this.yaw + Math.PI;
    }

    if (this.cameraMode === 'third') {
      const targetX = this.position.x;
      const targetY = jumpOffset + 1.48;
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
          cy < 0.45 ||
          cy > bnd.height - 0.3
        ) {
          dist = Math.max(0.65, d - 0.25);
          break;
        }
      }

      this.camera.position.set(
        targetX + dirX * dist,
        Math.max(0.45, Math.min(bnd.height - 0.3, targetY + dirY * dist)),
        targetZ + dirZ * dist
      );
      this.camera.lookAt(targetX, targetY + 0.12, targetZ);
      return;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
