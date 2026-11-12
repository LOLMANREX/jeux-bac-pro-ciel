import * as THREE from 'three';

export class PlayerController {
  constructor(camera, canvas, colliders = []) {
    this.camera = camera;
    this.canvas = canvas;
    this.colliders = colliders;

    this.position = new THREE.Vector3(0, 1.68, 7.2);
    this.yaw = 0;
    this.pitch = -0.05;
    this.speed = 5.4;
    this.radius = 0.42;
    this.keys = new Set();
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.enabled = false;
    this.hasPointerLock = false;
    this.sensitivity = 1.0;

    this.camera.rotation.order = 'YXZ';
    this._applyCamera();
    this._bindEvents();
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.4, Math.min(2.2, Number(val) || 1.0));
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.keys.clear();
      this.dragging = false;
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
      this.keys.clear();
      this.dragging = false;
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
    if (!this.enabled) return;
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }

  teleportTo(targetPos, lookAtPos) {
    this.position.set(targetPos.x, 1.68, targetPos.z);
    if (lookAtPos) {
      const dx = lookAtPos.x - targetPos.x;
      const dz = lookAtPos.z - targetPos.z;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = -0.12;
    }
    this._applyCamera();
  }

  _collides(nx, nz) {
    // Room boundaries
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
    if (!this.enabled) return;

    let forward = 0;
    let right = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;

    if (forward !== 0 || right !== 0) {
      const len = Math.hypot(forward, right);
      forward /= len;
      right /= len;

      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.45 : 1;
      const moveDist = this.speed * sprint * dt;

      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      // Camera forward vector is (-sinY, -cosY), right vector is (cosY, -sinY)
      const dx = (-sinY * forward + cosY * right) * moveDist;
      const dz = (-cosY * forward - sinY * right) * moveDist;

      if (!this._collides(this.position.x + dx, this.position.z)) {
        this.position.x += dx;
      }
      if (!this._collides(this.position.x, this.position.z + dz)) {
        this.position.z += dz;
      }
    }

    this._applyCamera();
  }

  _applyCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
