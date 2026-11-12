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

  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) return [];
      const data = await res.json();
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }

  async fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return [];
      const data = await res.json();
      return data.rooms || [];
    } catch {
      return [];
    }
  }

  connect(name, room = 'salle-e204', skin = null, spawn = { x: 0, y: 0, z: 6.2, yaw: 0 }) {
    this.pendingJoin = { name, room, skin, spawn };
    this._openSocket();
  }

  disconnect() {
    this.pendingJoin = null;
    this.lastSentMove = null;
    this.pendingMove = null;
    if (this.moveFlushTimer) {
      clearTimeout(this.moveFlushTimer);
      this.moveFlushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  _openSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      this.connected = true;
      this.emit('status', { connected: true });
      if (this.pendingJoin) {
        const sp = this.pendingJoin.spawn || {};
        this.send({
          type: 'join',
          name: this.pendingJoin.name,
          room: this.pendingJoin.room,
          skin: this.pendingJoin.skin,
          x: qNum(sp.x ?? 0),
          y: qNum(sp.y ?? 0),
          z: qNum(sp.z ?? 6.2),
          yaw: qNum(sp.yaw ?? 0)
        });
      }
    });

    this.ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        this.clientId = msg.id;
      }
      this.emit(msg.type, msg);
    });

    this.ws.addEventListener('close', () => {
      this.connected = false;
      this.emit('status', { connected: false });
      this._scheduleReconnect();
    });

    this.ws.addEventListener('error', () => {
      this.connected = false;
    });
  }

  _scheduleReconnect() {
    if (this.reconnectTimer || !this.pendingJoin) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._openSocket();
    }, 2500);
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

  sendEmote(emoteId, label) {
    return this.send({ type: 'emote', emoteId, label });
  }

  sendChat(text) {
    return this.send({ type: 'chat', text });
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
        const res = await fetch('/api/score', {
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
}
