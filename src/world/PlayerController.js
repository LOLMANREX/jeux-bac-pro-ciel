import * as THREE from 'three';
import { animateAvatarLimbs } from './AvatarBuilder.js';

export class PlayerController {
  constructor(camera, canvas, colliders = [], options = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.colliders = colliders;
    this.onJump = options.onJump || null;

    this.groundY = 1.68;
    this.position = new THREE.Vector3(0, this.groundY, 7.2);
    this.velocityY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    this.yaw = 0;
    this.pitch = -0.05;
    this.speed = 5.4;
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

    this.camera.rotation.order = 'YXZ';
    this._applyCamera();
    this._bindEvents();
  }

  setAvatar(avatarObj) {
    this.avatar = avatarObj;
    this._syncAvatarVisibility();
    this._applyCamera();
  }

  setAvatarVisible(visible) {
    this.avatarVisible = Boolean(visible);
    this._syncAvatarVisibility();
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'third' ? 'third' : 'first';
    this._syncAvatarVisibility();
    this._applyCamera();
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
    this._applyCamera();
  }

  _collides(nx, nz) {
    if (nx < -13.1 || nx > 13.1 || nz < -10.1 || nz > 10.1) return true;
    for (const c of this.colliders) {
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
      this.virtualSprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.45 : 1;

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

      let dist = 3.25;
      for (let d = 0.5; d <= 3.25; d += 0.25) {
        const cx = targetX + dirX * d;
        const cz = targetZ + dirZ * d;
        const cy = targetY + dirY * d;
        if (cx < -13.3 || cx > 13.3 || cz < -10.3 || cz > 10.3 || cy < 0.45 || cy > 4.9) {
          dist = Math.max(0.65, d - 0.25);
          break;
        }
      }

      this.camera.position.set(
        targetX + dirX * dist,
        Math.max(0.45, Math.min(4.9, targetY + dirY * dist)),
        targetZ + dirZ * dist
      );
      this.camera.lookAt(targetX, targetY + 0.12, targetZ);
      return;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
