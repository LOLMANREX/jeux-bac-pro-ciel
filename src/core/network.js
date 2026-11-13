export const DEFAULT_ROOM = 'plateau-u300';

export function buildWebSocketUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc || !loc.host) return '';
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}/ws`;
}

function qNum(v) {
  return Math.round((Number(v) || 0) * 1000) / 1000;
}

export class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.handlers = new Map();
    this.lastMoveSent = 0;
    this.lastSentMove = null;
    this.pendingMove = null;
    this.moveFlushTimer = null;
    this.pendingJoin = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.reconnectAttempts = 0;
    this.manualClose = false;
    this.lastError = null;
    this.wsUrl = '';
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }

  emit(event, data) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) fn(data);
  }

  async _fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async checkHealth(timeoutMs = 3000) {
    try {
      const res = await this._fetchWithTimeout('/api/health', { cache: 'no-store' }, timeoutMs);
      if (!res.ok) return { ok: false, timeout: false, error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      const isTimeout = err?.name === 'AbortError';
      return {
        ok: false,
        timeout: isTimeout,
        error: isTimeout ? 'Délai dépassé (3s)' : err?.message || 'Serveur inaccessible'
      };
    }
  }

  async fetchLeaderboard(timeoutMs = 4000) {
    try {
      const res = await this._fetchWithTimeout('/api/leaderboard', { cache: 'no-store' }, timeoutMs);
      if (!res.ok) return [];
      const data = await res.json();
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }

  async fetchRooms(timeoutMs = 3000) {
    try {
      const res = await this._fetchWithTimeout('/api/rooms', { cache: 'no-store' }, timeoutMs);
      if (!res.ok) return [];
      const data = await res.json();
      return data.rooms || [];
    } catch {
      return [];
    }
  }

  connect(name, room = DEFAULT_ROOM, skin = null, spawn = { x: -3.95, y: 0, z: 0.65, yaw: -1.35 }) {
    this._teardownSocket();
    this.manualClose = false;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.pendingJoin = { name, room: room || DEFAULT_ROOM, skin, spawn };
    this._openSocket();
  }

  disconnect() {
    this.manualClose = true;
    this.pendingJoin = null;
    this.lastSentMove = null;
    this.pendingMove = null;
    this.reconnectAttempts = 0;
    this._teardownSocket();
    this.emit('status', { state: 'disconnected', connected: false, manual: true });
  }

  reconnectNow() {
    if (!this.pendingJoin || this.connected) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._openSocket();
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _teardownSocket() {
    this._stopHeartbeat();
    if (this.moveFlushTimer) {
      clearTimeout(this.moveFlushTimer);
      this.moveFlushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        oldWs.close();
      } catch {
        this.connected = false;
      }
    }
    this.connected = false;
  }

  _openSocket() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = buildWebSocketUrl();
    this.wsUrl = url;
    this.emit('status', { state: 'connecting', connected: false, url });

    let socket;
    try {
      socket = new WebSocket(url);
      this.ws = socket;
    } catch (err) {
      this.lastError = err?.message || `Impossible d'ouvrir ${url}`;
      this._handleDisconnect(0, this.lastError, socket);
      return;
    }

    socket.addEventListener('open', () => {
      if (this.ws !== socket) return;
      this.connected = true;
      this.reconnectAttempts = 0;
      this.lastError = null;
      this.emit('status', { state: 'connected', connected: true, url });

      if (this.pendingJoin) {
        const sp = this.pendingJoin.spawn || {};
        this.send({
          type: 'join',
          name: this.pendingJoin.name,
          room: this.pendingJoin.room,
          skin: this.pendingJoin.skin,
          zoneId: this.pendingJoin.zoneId || 'U300',
          zoneLabel: this.pendingJoin.zoneLabel || 'U300 - Couloir Central',
          x: qNum(sp.x ?? -3.95),
          y: qNum(sp.y ?? 0),
          z: qNum(sp.z ?? 0.65),
          yaw: qNum(sp.yaw ?? -1.35)
        });
      }

      this._stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.connected) {
          this.send({ type: 'ping' });
        }
      }, 20000);
    });

    socket.addEventListener('message', (ev) => {
      if (this.ws !== socket) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        this.clientId = msg.id;
        if (this.pendingJoin && msg.profile?.name) {
          this.pendingJoin.name = msg.profile.name;
        }
      }
      if (msg.type === 'account_deleted') {
        this.manualClose = true;
      }
      this.emit(msg.type, msg);
    });

    socket.addEventListener('error', () => {
      if (this.ws !== socket) return;
      this.connected = false;
      this.lastError = `Échec WebSocket (${url})`;
      this.emit('network_error', { url, message: this.lastError });
    });

    socket.addEventListener('close', (ev) => {
      if (this.ws !== socket) return;
      this.ws = null;
      this._handleDisconnect(ev.code, ev.reason, socket);
    });
  }

  _handleDisconnect(code, reason) {
    this._stopHeartbeat();
    this.connected = false;
    if (this.manualClose || !this.pendingJoin) {
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(
      10000,
      Math.round(1500 * Math.pow(1.4, Math.min(this.reconnectAttempts - 1, 5)))
    );
    const errorMsg =
      reason ||
      this.lastError ||
      `Connexion WebSocket fermée (code ${code || 1006}) sur ${this.wsUrl}`;

    this.emit('status', {
      state: 'reconnecting',
      connected: false,
      attempt: this.reconnectAttempts,
      delayMs,
      code,
      url: this.wsUrl,
      error: errorMsg
    });

    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manualClose && this.pendingJoin) {
        this._openSocket();
      }
    }, delayMs);
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  sendMove(x, y, z, yaw, force = false) {
    const next = { x: qNum(x), y: qNum(y), z: qNum(z), yaw: qNum(yaw) };
    if (this.pendingJoin) {
      this.pendingJoin.spawn = next;
    }
    if (!force && this.lastSentMove) {
      const samePos =
        Math.abs(next.x - this.lastSentMove.x) < 0.002 &&
        Math.abs(next.y - this.lastSentMove.y) < 0.002 &&
        Math.abs(next.z - this.lastSentMove.z) < 0.002 &&
        Math.abs(next.yaw - this.lastSentMove.yaw) < 0.004;
      if (samePos) return;
    }

    const now = performance.now();
    const elapsed = now - this.lastMoveSent;
    if (force || elapsed >= 45) {
      if (this.moveFlushTimer) {
        clearTimeout(this.moveFlushTimer);
        this.moveFlushTimer = null;
      }
      this.pendingMove = null;
      this.lastMoveSent = now;
      this.lastSentMove = next;
      this.send({ type: 'move', ...next });
      return;
    }

    this.pendingMove = next;
    if (!this.moveFlushTimer) {
      this.moveFlushTimer = setTimeout(() => {
        this.moveFlushTimer = null;
        if (!this.pendingMove) return;
        const flush = this.pendingMove;
        this.pendingMove = null;
        this.lastMoveSent = performance.now();
        this.lastSentMove = flush;
        this.send({ type: 'move', ...flush });
      }, Math.max(10, 48 - elapsed));
    }
  }

  async sendSkinUpdate(skin) {
    if (this.pendingJoin) {
      this.pendingJoin.skin = { ...skin };
    }
    const sent = this.send({ type: 'update_skin', skin });
    if (!sent && this.pendingJoin?.name) {
      try {
        const res = await fetch('/api/profile/skin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.pendingJoin.name, skin })
        });
        if (res.ok) {
          const data = await res.json();
          this.emit('profile_updated', { profile: data.profile });
        }
      } catch {
        return;
      }
    }
  }

  sendActivity(activity) {
    this.send({ type: 'activity', activity });
  }

  sendZone(zoneId, zoneLabel) {
    if (this.pendingJoin) {
      this.pendingJoin.zoneId = zoneId;
      this.pendingJoin.zoneLabel = zoneLabel;
    }
    return this.send({ type: 'zone', zoneId, zoneLabel });
  }

  sendEmote(emoteId, label) {
    return this.send({ type: 'emote', emoteId, label });
  }

  sendChat(text) {
    return this.send({ type: 'chat', text });
  }

  sendVoiceState(micEnabled, isSpeaking = false) {
    return this.send({
      type: 'voice_state',
      micEnabled: Boolean(micEnabled),
      isSpeaking: Boolean(micEnabled && isSpeaking)
    });
  }

  sendRtcOffer(targetId, sdp) {
    if (!targetId || !sdp) return false;
    return this.send({ type: 'rtc_offer', targetId, sdp });
  }

  sendRtcAnswer(targetId, sdp) {
    if (!targetId || !sdp) return false;
    return this.send({ type: 'rtc_answer', targetId, sdp });
  }

  sendRtcIceCandidate(targetId, candidate) {
    if (!targetId || !candidate) return false;
    return this.send({ type: 'rtc_ice_candidate', targetId, candidate });
  }

  async acceptQuest(name) {
    const sent = this.send({ type: 'accept_quest' });
    if (!sent) {
      try {
        const res = await fetch('/api/quest/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (res.ok) {
          const data = await res.json();
          this.emit('profile_updated', { profile: data.profile });
        }
      } catch {
        return;
      }
    }
  }

  async submitScore(name, tpId, score, durationSec, skin = null) {
    const sent = this.send({ type: 'submit_score', tpId, score, durationSec });
    if (!sent) {
      try {
        const res = await fetch('/api/tp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, tpId, score, durationSec, skin })
        });
        if (res.ok) {
          const data = await res.json();
          this.emit('score_recorded', { tpId, ...data });
          return data;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  async fetchMap(timeoutMs = 3500) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch('/api/map', {
        signal: controller ? controller.signal : undefined
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.map && typeof data.map === 'object') return data.map;
      if (data && Array.isArray(data.walls) && Array.isArray(data.objects)) return data;
      return null;
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
