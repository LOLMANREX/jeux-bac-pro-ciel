export const METAL_PIPE = Object.freeze({
  launchHeight: 3,
  gravity: 18.5,
  durationMs: 1500,
  hardCapMs: 3200,
  hitRange: 3.4,
  serverRange: 6.5,
  cooldownMs: 900,
  swingMs: 320,
  passStorageKey: 'ciel_metal_pipe_pass',
  equipStorageKey: 'ciel_metal_pipe_equipped'
});

export function computeLaunchVelocity(height = METAL_PIPE.launchHeight, gravity = METAL_PIPE.gravity) {
  const h = Math.max(0.5, Math.min(METAL_PIPE.launchHeight, Number(height) || METAL_PIPE.launchHeight));
  return Math.sqrt(2 * gravity * h);
}

function easeOutCubic(u) {
  const c = 1 - u;
  return 1 - c * c * c;
}

export function computeTumble(elapsedMs, durationMs = METAL_PIPE.durationMs, seed = 0.5) {
  const dur = Math.max(200, Number(durationMs) || METAL_PIPE.durationMs);
  const u = Math.max(0, Math.min(1, (Number(elapsedMs) || 0) / dur));
  const s = Math.max(0, Math.min(0.9999, Number(seed) || 0));
  const turnsX = 3 + Math.floor(s * 3);
  const turnsZ = 2 + Math.floor((s * 7) % 3);
  const turnsY = 2 + Math.floor((s * 13) % 3);
  const dirX = s > 0.5 ? 1 : -1;
  const dirZ = (s * 10) % 1 > 0.5 ? 1 : -1;
  const e = easeOutCubic(u);
  return {
    x: dirX * Math.PI * 2 * turnsX * e,
    y: Math.PI * 2 * turnsY * e,
    z: dirZ * Math.PI * 2 * turnsZ * e,
    done: u >= 1
  };
}

export function validateMetalPipeHit({ attacker, target, now, range = METAL_PIPE.serverRange }) {
  if (!attacker || !target) return { ok: false, reason: 'missing' };
  if (attacker === target) return { ok: false, reason: 'self' };
  if (Number(target.pipeLaunchUntil) > now) return { ok: false, reason: 'busy' };
  if (now - Number(attacker.pipeLastHitAt || 0) < METAL_PIPE.cooldownMs) {
    return { ok: false, reason: 'cooldown' };
  }
  const dx = Number(target.x) - Number(attacker.x);
  const dz = Number(target.z) - Number(attacker.z);
  const dy = Number(target.y || 0) - Number(attacker.y || 0);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { ok: false, reason: 'invalid' };
  if (Math.hypot(dx, dz) > range || Math.abs(dy) > 4) return { ok: false, reason: 'range' };
  return { ok: true };
}
