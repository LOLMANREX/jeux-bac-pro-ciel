export class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.handlers = new Map();
    this.lastMoveSent = 0;
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

  connect(name, room = 'salle-e204') {
    this.pendingJoin = { name, room };
    this._openSocket();
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
        this.send({
          type: 'join',
          name: this.pendingJoin.name,
          room: this.pendingJoin.room
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

  sendMove(x, y, z, yaw) {
    const now = performance.now();
    if (now - this.lastMoveSent < 60) return; // ~16 Hz cap
    this.lastMoveSent = now;
    this.send({ type: 'move', x, y, z, yaw });
  }

  sendActivity(activity) {
    this.send({ type: 'activity', activity });
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
        // Offline fallback handled locally
      }
    }
  }

  async submitScore(name, tpId, score, durationSec) {
    const sent = this.send({ type: 'submit_score', tpId, score, durationSec });
    if (!sent) {
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, tpId, score, durationSec })
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
