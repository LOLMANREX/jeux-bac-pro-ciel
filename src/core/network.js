export const DEFAULT_ROOM = 'plateau-u300';
export const AUTH_TOKEN_STORAGE_KEY = 'ciel_auth_token';

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
    this.lastPingMs = null;
    this.lastPingSentAt = 0;
    this.authToken =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ''
        : '';
  }

  getAuthToken() {
    if (this.authToken) return this.authToken;
    if (typeof localStorage !== 'undefined') {
      this.authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
    }
    return this.authToken;
  }

  setAuthToken(token) {
    this.authToken = String(token || '').trim();
    if (typeof localStorage !== 'undefined') {
      if (this.authToken) {
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, this.authToken);
      } else {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    }
  }

  clearAuthToken() {
    this.setAuthToken('');
  }

  _buildAuthHeaders() {
    const token = this.getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }
    return headers;
  }

  async registerAccount(payload = {}, timeoutMs = 4500) {
    try {
      const res = await this._fetchWithTimeout(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Impossible de créer le compte élève.'
        };
      }
      if (data.token) {
        this.setAuthToken(data.token);
      }
      this.emit('auth_changed', data);
      return { ok: true, ...data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible pour créer le compte.'
      };
    }
  }

  async loginAccount(payload = {}, timeoutMs = 4500) {
    try {
      const res = await this._fetchWithTimeout(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Identifiant ou mot de passe incorrect.'
        };
      }
      if (data.token) {
        this.setAuthToken(data.token);
      }
      this.emit('auth_changed', data);
      return { ok: true, ...data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible pour la connexion.'
      };
    }
  }

  async fetchCurrentAccount(tokenOverride = null, timeoutMs = 3500) {
    const token = String(tokenOverride ?? this.getAuthToken() ?? '').trim();
    if (!token) {
      return { ok: false, status: 401, error: 'Aucun jeton de session' };
    }
    try {
      const res = await this._fetchWithTimeout(
        '/api/auth/me',
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-auth-token': token
          }
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          this.clearAuthToken();
        }
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Session expirée'
        };
      }
      this.setAuthToken(token);
      this.emit('auth_changed', { ...data, token });
      return { ok: true, token, ...data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Impossible de vérifier la session'
      };
    }
  }

  async saveAccount(payload = {}, timeoutMs = 4000) {
    const token = String(payload.token || this.getAuthToken() || '').trim();
    if (!token && !payload.password) {
      return { ok: false, status: 401, error: 'Non connecté' };
    }
    try {
      const res = await this._fetchWithTimeout(
        '/api/account/save',
        {
          method: 'POST',
          headers: {
            ...this._buildAuthHeaders(),
            ...(token ? { Authorization: `Bearer ${token}`, 'x-auth-token': token } : {})
          },
          body: JSON.stringify({
            token: token || undefined,
            ...payload
          })
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Échec de sauvegarde du compte'
        };
      }
      if (data.profile) {
        this.emit('profile_updated', { profile: data.profile });
      }
      this.emit('account_saved', data);
      return { ok: true, ...data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Erreur réseau lors de la sauvegarde'
      };
    }
  }

  logoutAccount() {
    this.clearAuthToken();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ciel_player_name');
      localStorage.removeItem('ciel_skin');
    }
    if (this.connected || this.ws) {
      this.disconnect();
    }
    this.emit('auth_logout', {});
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
          yaw: qNum(sp.yaw ?? -1.35),
          floor: Math.round(Number(sp.floor) || 0)
        });
      }

      this._stopHeartbeat();
      this.sendPing();
      this.heartbeatTimer = setInterval(() => {
        if (this.connected) {
          this.sendPing();
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
      if (msg.type === 'room_switched' && msg.room && this.pendingJoin) {
        this.pendingJoin.room = msg.room;
      }
      if (msg.type === 'pong') {
        if (this.lastPingSentAt > 0) {
          this.lastPingMs = Math.max(1, Math.round(performance.now() - this.lastPingSentAt));
        }
        msg.pingMs = this.lastPingMs;
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

  sendMove(x, y, z, yaw, force = false, vrData = undefined, floor = undefined) {
    const fl = floor !== undefined && floor !== null ? Math.round(Number(floor) || 0) : (this.lastSentMove?.floor ?? 0);
    const next = { x: qNum(x), y: qNum(y), z: qNum(z), yaw: qNum(yaw), floor: fl };
    const hasVrPayload = vrData !== undefined;
    const isVrActive = Boolean(vrData?.active);
    if (this.pendingJoin) {
      this.pendingJoin.spawn = next;
    }
    if (!force && this.lastSentMove) {
      const samePos =
        Math.abs(next.x - this.lastSentMove.x) < 0.002 &&
        Math.abs(next.y - this.lastSentMove.y) < 0.002 &&
        Math.abs(next.z - this.lastSentMove.z) < 0.002 &&
        Math.abs(next.yaw - this.lastSentMove.yaw) < 0.004 &&
        next.floor === (this.lastSentMove.floor ?? 0);
      const sameVr = !hasVrPayload && !this.lastVrActive;
      if (samePos && sameVr) return;
      if (samePos && isVrActive && this.lastVrActive) {
        const vrSig = JSON.stringify(vrData);
        if (vrSig === this._lastVrSig) return;
        this._lastVrSig = vrSig;
      } else if (isVrActive) {
        this._lastVrSig = JSON.stringify(vrData);
      } else {
        this._lastVrSig = '';
      }
    }

    const packetNext = hasVrPayload ? { ...next, vrData } : next;
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
      this.lastVrActive = isVrActive;
      this.send({ type: 'move', ...packetNext });
      return;
    }

    this.pendingMove = packetNext;
    if (!this.moveFlushTimer) {
      this.moveFlushTimer = setTimeout(() => {
        this.moveFlushTimer = null;
        if (!this.pendingMove) return;
        const flush = this.pendingMove;
        this.pendingMove = null;
        this.lastMoveSent = performance.now();
        this.lastSentMove = { x: flush.x, y: flush.y, z: flush.z, yaw: flush.yaw };
        this.lastVrActive = Boolean(flush.vrData?.active);
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

  sendPing() {
    this.lastPingSentAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return this.send({ type: 'ping' });
  }

  sendCreatorCelebration(tpId = 'oscilloscope', tpLabel = '', debug = false) {
    return this.send({
      type: 'trigger_celebration',
      tpId,
      tpLabel,
      debug: Boolean(debug)
    });
  }

  sendAscensionChoice(specialty = 'cyber', celebrationId = '') {
    return this.send({
      type: 'ascension_choice',
      specialty,
      celebrationId
    });
  }

  sendCreatorAura(enabled) {
    return this.send({
      type: 'creator_aura',
      enabled: Boolean(enabled)
    });
  }

  sendDebugAction(action, extra = {}) {
    return this.send({
      type: 'debug_action',
      action,
      ...extra
    });
  }

  getSocketDebugState() {
    const stateMap = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED'
    };
    const rs = this.ws ? this.ws.readyState : 3;
    return {
      connected: Boolean(this.connected),
      readyState: rs,
      stateLabel: stateMap[rs] || 'CLOSED',
      clientId: this.clientId || '--',
      room: this.pendingJoin?.room || DEFAULT_ROOM,
      pingMs: this.lastPingMs
    };
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

  sendSurvivalJoin() {
    return this.send({ type: 'survival_join' });
  }

  sendSurvivalLeave() {
    return this.send({ type: 'survival_leave' });
  }

  sendSurvivalReady(ready = true) {
    return this.send({ type: 'survival_ready', ready: Boolean(ready) });
  }

  sendSurvivalHide(rackId = null) {
    return this.send({ type: 'survival_hide', rackId: rackId || null });
  }

  sendSurvivalMic({ micEnabled = false, level = 0, rms = 0 } = {}) {
    return this.send({
      type: 'survival_mic',
      micEnabled: Boolean(micEnabled),
      level: Number(level) || 0,
      rms: Number(rms) || 0
    });
  }

  sendSurvivalTpDone(tpId, score = 20) {
    return this.send({ type: 'survival_tp_done', tpId, score });
  }

  sendSurvivalDetentionSolved() {
    return this.send({ type: 'survival_detention_solved' });
  }

  sendSurvivalReturn() {
    return this.send({ type: 'survival_return' });
  }

  sendSurvivalRestart() {
    return this.send({ type: 'survival_restart' });
  }

  sendCombatJoin() {
    return this.send({ type: 'combat_join' });
  }

  sendCombatLeave() {
    return this.send({ type: 'combat_leave' });
  }

  sendCombatMode(mode = 'guns') {
    return this.send({ type: 'combat_mode', mode: mode === 'melee' ? 'melee' : 'guns' });
  }

  sendCombatFillBots(botsEnabled = true) {
    const enabled = Boolean(botsEnabled);
    return this.send({ type: 'combat_fill_bots', botsEnabled: enabled, fillBots: enabled });
  }

  sendCombatGuard(guarding = false) {
    return this.send({ type: 'combat_guard', guarding: Boolean(guarding) });
  }

  sendCombatWeapon(weaponId) {
    return this.send({ type: 'combat_weapon', weaponId });
  }

  sendCombatReady(ready = true) {
    return this.send({ type: 'combat_ready', ready: Boolean(ready) });
  }

  sendCombatAttack({ weaponId, origin, dir, isVrSwing = false, isVrShot = false, ads = false, twoHanded = false } = {}) {
    return this.send({
      type: 'combat_attack',
      weaponId,
      origin,
      dir,
      isVrSwing: Boolean(isVrSwing),
      isVrShot: Boolean(isVrShot),
      ads: Boolean(ads),
      twoHanded: Boolean(twoHanded)
    });
  }

  sendCombatReload() {
    return this.send({ type: 'combat_reload' });
  }

  sendCombatRestart() {
    return this.send({ type: 'combat_restart' });
  }

  sendCombatReturn() {
    return this.send({ type: 'combat_return' });
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

  async fetchShopCatalog(timeoutMs = 3500) {
    try {
      const res = await this._fetchWithTimeout('/api/shop/catalog', { cache: 'no-store' }, timeoutMs);
      if (!res.ok) return { ok: false, catalog: [], categories: [], rarities: {} };
      return await res.json();
    } catch {
      return { ok: false, catalog: [], categories: [], rarities: {} };
    }
  }

  _requestViaWs(sendType, resultType, payload = {}, timeoutMs = 4000) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      let done = false;
      const off = this.on(resultType, (msg) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        off();
        resolve(msg);
      });
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        off();
        resolve(null);
      }, timeoutMs);
      const sent = this.send({ type: sendType, ...payload });
      if (!sent) {
        done = true;
        clearTimeout(timer);
        off();
        resolve(null);
      }
    });
  }

  async buyShopItem(itemId, playerName = '', timeoutMs = 4500) {
    const cleanName = String(playerName || this.pendingJoin?.name || '').trim();
    try {
      const res = await this._fetchWithTimeout(
        '/api/shop/buy',
        {
          method: 'POST',
          headers: this._buildAuthHeaders(),
          body: JSON.stringify({
            itemId,
            name: cleanName
          })
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.profile) {
          this.emit('profile_updated', { profile: data.profile });
        }
        return data;
      }
      if ((res.status === 401 || res.status === 403 || res.status >= 500) && this.connected) {
        const wsRes = await this._requestViaWs('shop_buy', 'shop_buy_result', { itemId }, timeoutMs);
        if (wsRes) {
          if (wsRes.ok && wsRes.profile) {
            this.emit('profile_updated', { profile: wsRes.profile });
          }
          return wsRes;
        }
      }
      return {
        ok: false,
        status: res.status,
        error: data.error || 'Achat impossible.'
      };
    } catch (err) {
      if (this.connected) {
        const wsRes = await this._requestViaWs('shop_buy', 'shop_buy_result', { itemId }, timeoutMs);
        if (wsRes) {
          if (wsRes.ok && wsRes.profile) {
            this.emit('profile_updated', { profile: wsRes.profile });
          }
          return wsRes;
        }
      }
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible pour l’achat.'
      };
    }
  }

  async equipShopItem({ itemId = null, category = null, equip = true, name = '' } = {}, timeoutMs = 4500) {
    const cleanName = String(name || this.pendingJoin?.name || '').trim();
    try {
      const res = await this._fetchWithTimeout(
        '/api/shop/equip',
        {
          method: 'POST',
          headers: this._buildAuthHeaders(),
          body: JSON.stringify({
            itemId,
            category,
            equip,
            name: cleanName
          })
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.profile) {
          if (this.pendingJoin) {
            this.pendingJoin.skin = { ...data.profile.skin };
          }
          this.emit('profile_updated', { profile: data.profile });
        }
        return data;
      }
      if ((res.status === 401 || res.status === 403 || res.status >= 500) && this.connected) {
        const wsRes = await this._requestViaWs(
          'shop_equip',
          'shop_equip_result',
          { itemId, category, equip },
          timeoutMs
        );
        if (wsRes) {
          if (wsRes.ok && wsRes.profile) {
            if (this.pendingJoin) {
              this.pendingJoin.skin = { ...wsRes.profile.skin };
            }
            this.emit('profile_updated', { profile: wsRes.profile });
          }
          return wsRes;
        }
      }
      return {
        ok: false,
        status: res.status,
        error: data.error || 'Équipement impossible.'
      };
    } catch (err) {
      if (this.connected) {
        const wsRes = await this._requestViaWs(
          'shop_equip',
          'shop_equip_result',
          { itemId, category, equip },
          timeoutMs
        );
        if (wsRes) {
          if (wsRes.ok && wsRes.profile) {
            if (this.pendingJoin) {
              this.pendingJoin.skin = { ...wsRes.profile.skin };
            }
            this.emit('profile_updated', { profile: wsRes.profile });
          }
          return wsRes;
        }
      }
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible pour équiper l’article.'
      };
    }
  }

  async submitArcadeScore(gameId, score, playerName = '', metaOrTimeout = 4000, maybeTimeoutMs = 4000) {
    const isMetaObj = metaOrTimeout && typeof metaOrTimeout === 'object';
    const extra = isMetaObj ? metaOrTimeout : {};
    const timeoutMs = isMetaObj ? maybeTimeoutMs : Number(metaOrTimeout) || 4000;
    try {
      const res = await this._fetchWithTimeout(
        '/api/economy/arcade',
        {
          method: 'POST',
          headers: this._buildAuthHeaders(),
          body: JSON.stringify({
            gameId,
            score,
            difficulty: extra.difficulty || null,
            won: Boolean(extra.won),
            elapsedSec: extra.elapsedSec ?? null,
            name: playerName || this.pendingJoin?.name || ''
          })
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Score mini-jeu refusé.'
        };
      }
      if (data.profile) {
        this.emit('profile_updated', { profile: data.profile });
      }
      return data;
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible.'
      };
    }
  }

  async submitSurvivalReward({ outcome = 'defeat', solvedTables = 0, matchId = null, name = '' } = {}, timeoutMs = 4000) {
    try {
      const res = await this._fetchWithTimeout(
        '/api/economy/survival',
        {
          method: 'POST',
          headers: this._buildAuthHeaders(),
          body: JSON.stringify({
            outcome,
            solvedTables,
            matchId,
            name: name || this.pendingJoin?.name || ''
          })
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Récompense Survie refusée.'
        };
      }
      if (data.profile) {
        this.emit('profile_updated', { profile: data.profile });
      }
      return data;
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible.'
      };
    }
  }

  sendShopBuyWs(itemId) {
    return this.send({ type: 'shop_buy', itemId });
  }

  sendShopEquipWs(payload = {}) {
    return this.send({ type: 'shop_equip', ...payload });
  }

  sendArcadeScoreWs(gameId, score) {
    return this.send({ type: 'arcade_score', gameId, score });
  }

  async submitFormativeProgress(tpId, answers = {}, playerName = '', timeoutMs = 4500) {
    const cleanName = String(playerName || this.pendingJoin?.name || '').trim();
    const fallbackViaWs = async () => {
      if (!this.connected) return null;
      const wsRes = await this._requestViaWs(
        'formative_submit',
        'formative_submit_result',
        { tpId, answers },
        timeoutMs
      );
      if (wsRes?.ok && wsRes.profile) {
        this.emit('profile_updated', { profile: wsRes.profile });
      }
      return wsRes;
    };
    try {
      const res = await this._fetchWithTimeout(
        '/api/formative/submit',
        {
          method: 'POST',
          headers: this._buildAuthHeaders(),
          body: JSON.stringify({
            tpId,
            answers,
            name: cleanName
          })
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.profile) {
          this.emit('profile_updated', { profile: data.profile });
        }
        return data;
      }
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        const wsRes = await fallbackViaWs();
        if (wsRes) return wsRes;
      }
      return {
        ok: false,
        status: res.status,
        error: data.error || 'Enregistrement Formative impossible.'
      };
    } catch (err) {
      const wsRes = await fallbackViaWs();
      if (wsRes) return wsRes;
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible pour la progression Formative.'
      };
    }
  }

  async fetchFormativeProgress(playerName = '', timeoutMs = 3500) {
    const cleanName = String(playerName || this.pendingJoin?.name || '').trim();
    const qs = cleanName ? `?name=${encodeURIComponent(cleanName)}` : '';
    try {
      const res = await this._fetchWithTimeout(
        `/api/formative/progress${qs}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: this._buildAuthHeaders()
        },
        timeoutMs
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || 'Impossible de charger la progression Formative.',
          formativeProgress: {},
          formativeRewardedTps: []
        };
      }
      return data;
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Serveur inaccessible pour la progression Formative.',
        formativeProgress: {},
        formativeRewardedTps: []
      };
    }
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
