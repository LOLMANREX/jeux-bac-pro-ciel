import { sfx } from '../core/audio.js';
import { CIEL_OS_GAMES_CATALOG, createCielOsGame } from './CielOsGames.js';

export const CIEL_OS_THEMES = [
  {
    id: 'cyber_blue',
    label: 'Cyber Bleu',
    bgTop: '#030b1c',
    bgBot: '#0a2548',
    primary: '#0284c7',
    accent: '#38bdf8',
    gridColor: 'rgba(56, 189, 248, 0.14)'
  },
  {
    id: 'matrix_green',
    label: 'Matrix Vert',
    bgTop: '#020b05',
    bgBot: '#052212',
    primary: '#059669',
    accent: '#10b981',
    gridColor: 'rgba(16, 185, 129, 0.18)'
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    bgTop: '#16052a',
    bgBot: '#3d0944',
    primary: '#db2777',
    accent: '#f472b6',
    gridColor: 'rgba(244, 114, 182, 0.18)'
  },
  {
    id: 'dark_mode',
    label: 'Mode Sombre',
    bgTop: '#090d16',
    bgBot: '#111827',
    primary: '#334155',
    accent: '#94a3b8',
    gridColor: 'rgba(148, 163, 184, 0.08)'
  }
];

export const CIEL_OS_APPS = [
  ...CIEL_OS_GAMES_CATALOG.map((g) => ({
    ...g,
    kind: 'game'
  })),
  {
    id: 'terminal',
    kind: 'app',
    title: 'Terminal CIEL',
    shortTitle: 'Terminal',
    icon: '💻',
    color: '#34d399',
    desc: 'Console système interactive (help, ping, matrix, whoami, hack, cowsay).'
  },
  {
    id: 'notepad',
    kind: 'app',
    title: 'Bloc-Notes CIEL',
    shortTitle: 'Bloc-Notes',
    icon: '📝',
    color: '#fde047',
    desc: 'Éditeur de notes et fiches mémos techniques Bac Pro CIEL.'
  },
  {
    id: 'scores',
    kind: 'app',
    title: 'Explorateur de Scores',
    shortTitle: 'Scores Arcade',
    icon: '🏆',
    color: '#fbbf24',
    desc: 'Meilleurs scores locaux et statistiques des 6 mini-jeux CIEL OS.'
  }
];

const NOTEPAD_TEMPLATES = [
  {
    id: 'vlan',
    label: '🌐 Mémo VLAN',
    text: '=== MÉMO CISCO VLAN 802.1Q ===\nenable\nconfigure terminal\nvlan 10\nname ADMIN_CIEL\ninterface gi0/1\nswitchport mode trunk\nswitchport trunk allowed vlan 10,20,30'
  },
  {
    id: 'elec',
    label: '⚡ Loi d’Ohm',
    text: '=== MÉMO ÉLECTRONIQUE & MESURES ===\nLoi d’Ohm : U = R × I\nPuissance : P = U × I\nFréquence : f = 1 / T\nSoudure sans plomb : 350°C - 370°C (ESD obligatoire)'
  },
  {
    id: 'rj45',
    label: '🔌 RJ45 T568B',
    text: '=== BROCHAGE RJ45 NORME T568B ===\n1: Blanc-Orange | 2: Orange\n3: Blanc-Vert   | 4: Bleu\n5: Blanc-Bleu   | 6: Vert\n7: Blanc-Marron | 8: Marron'
  },
  {
    id: 'cyber',
    label: '🛡️ Audit SOC',
    text: '=== CHECKLIST CYBERSÉCURITÉ SOC U305 ===\n1. Vérifier règles pare-feu IDS/IPS\n2. Isoler postes suspects en quarantaine\n3. Contrôler les journaux du Professeur CIEL'
  }
];

function createStubContext2D() {
  const noop = () => {};
  return {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '14px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    save: noop,
    restore: noop,
    clip: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    rect: noop,
    roundRect: noop,
    fill: noop,
    stroke: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: (txt) => ({ width: String(txt || '').length * 8 }),
    drawImage: noop
  };
}

function roundRect(ctx, x, y, w, h, r = 8) {
  if (!ctx) return;
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function readStorageJson(key, fallback) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return fallback;
}

function writeStorageJson(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

export class CielOsDesktop {
  constructor(options = {}) {
    this.width = Number(options.width) || 1024;
    this.height = Number(options.height) || 640;
    this.stationId = options.stationId || 'pc-default';
    this.stationLabel = options.stationLabel || 'Poste PC CIEL';
    this.playerName = options.playerName || 'Eleve_CIEL';
    this.onRequestExit = options.onRequestExit || null;
    this.onToggleComfort = options.onToggleComfort || null;
    this.onChange = options.onChange || null;

    this.canvas = null;
    this.ctx = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const c = document.createElement('canvas');
      if (c && typeof c.getContext === 'function') {
        c.width = this.width;
        c.height = this.height;
        this.canvas = c;
        this.ctx = c.getContext('2d');
      }
    }
    if (!this.ctx) {
      this.ctx = createStubContext2D();
      this.canvas = { width: this.width, height: this.height, getContext: () => this.ctx };
    }

    this.themeId = options.themeId || 'cyber_blue';
    this.sessionLocked = Boolean(options.startLocked ?? false);
    this.startMenuOpen = false;
    this.virtualKeyboardOpen = false;
    this.keyboardShift = false;
    this.hoveredId = null;
    this.cursorPos = { x: this.width / 2, y: this.height / 2, visible: false };
    this.elapsed = 0;
    this.lastIdleDrawAt = -10;
    this.lastActiveDrawAt = -10;
    this.dirty = true;
    this.sleepMode = false;
    this.inView = true;
    this.isFocusedStation = false;
    this.textureUploadCount = 0;

    const savedScores = readStorageJson('ciel_os_high_scores', {});
    this.highScores = {
      snake: Number(savedScores?.snake) || 0,
      minesweeper: Number(savedScores?.minesweeper) || 0,
      tetris: Number(savedScores?.tetris) || 0,
      breakout: Number(savedScores?.breakout) || 0,
      flappy: Number(savedScores?.flappy) || 0,
      game2048: Number(savedScores?.game2048) || 0
    };
    this.gamesPlayed = {
      snake: 0,
      minesweeper: 0,
      tetris: 0,
      breakout: 0,
      flappy: 0,
      game2048: 0
    };

    this.windows = new Map();
    this.windowOrder = [];
    this.activeAppId = null;
    this.gameInstances = new Map();

    this.terminalHistory = [
      '╔══════════════════════════════════════════════════════════════╗',
      '║  CIEL OS v4.23 LTS — Noyau Cyber & Réseau Plateau U300       ║',
      '║  Tapez "help" ou cliquez sur une commande rapide ci-dessous. ║',
      '╚══════════════════════════════════════════════════════════════╝'
    ];
    this.terminalInput = '';
    this.matrixRainActive = false;

    const savedNote = readStorageJson('ciel_os_notepad_text', null);
    this.notepadText =
      typeof savedNote === 'string' && savedNote.length > 0
        ? savedNote
        : NOTEPAD_TEMPLATES[0].text;

    this.hitBoxes = [];
    this.activeGameRect = null;

    if (options.initialAppId) {
      this.openApp(options.initialAppId, { silent: true });
    }
    this.redraw();
  }

  getTheme() {
    return CIEL_OS_THEMES.find((t) => t.id === this.themeId) || CIEL_OS_THEMES[0];
  }

  setTheme(themeId) {
    const found = CIEL_OS_THEMES.find((t) => t.id === themeId);
    if (!found) return false;
    this.themeId = found.id;
    this.dirty = true;
    sfx.osClick?.();
    this.redraw();
    return true;
  }

  cycleTheme() {
    const idx = CIEL_OS_THEMES.findIndex((t) => t.id === this.themeId);
    const next = CIEL_OS_THEMES[(idx + 1) % CIEL_OS_THEMES.length];
    return this.setTheme(next.id);
  }

  setPlayerName(name) {
    const clean = String(name || '').trim() || 'Eleve_CIEL';
    if (clean !== this.playerName) {
      this.playerName = clean;
      this.dirty = true;
    }
  }

  lockSession() {
    this.sessionLocked = true;
    this.startMenuOpen = false;
    this.dirty = true;
    sfx.osWindowClose?.();
    this.redraw();
  }

  unlockSession() {
    if (!this.sessionLocked) return false;
    this.sessionLocked = false;
    this.dirty = true;
    sfx.osBoot?.();
    this.redraw();
    return true;
  }

  toggleStartMenu() {
    if (this.sessionLocked) {
      this.unlockSession();
      return true;
    }
    this.startMenuOpen = !this.startMenuOpen;
    this.dirty = true;
    sfx.osClick?.();
    this.redraw();
    return this.startMenuOpen;
  }

  _getOrCreateGame(gameId) {
    if (!this.gameInstances.has(gameId)) {
      const inst = createCielOsGame(gameId, {
        initialHighScore: this.highScores[gameId] || 0,
        onScoreChange: (id, score, high) => {
          const prevHigh = this.highScores[id] || 0;
          if (high > prevHigh || score > prevHigh) {
            this.highScores[id] = Math.max(high, score);
            writeStorageJson('ciel_os_high_scores', this.highScores);
          }
          this.dirty = true;
        }
      });
      this.gameInstances.set(gameId, inst);
    }
    return this.gameInstances.get(gameId);
  }

  getGameInstance(gameId) {
    return this._getOrCreateGame(gameId);
  }

  openApp(appId, opts = {}) {
    const appDef = CIEL_OS_APPS.find((a) => a.id === appId);
    if (!appDef) return false;
    if (this.sessionLocked) {
      this.sessionLocked = false;
    }
    this.startMenuOpen = false;
    if (appDef.kind === 'game') {
      this._getOrCreateGame(appDef.id);
      this.gamesPlayed[appDef.id] = (this.gamesPlayed[appDef.id] || 0) + 1;
    }
    const existing = this.windows.get(appId);
    if (existing) {
      existing.minimized = false;
    } else {
      this.windows.set(appId, {
        appId: appDef.id,
        title: appDef.title,
        shortTitle: appDef.shortTitle,
        icon: appDef.icon,
        color: appDef.color,
        kind: appDef.kind,
        minimized: false,
        maximized: false
      });
    }
    this.windowOrder = this.windowOrder.filter((id) => id !== appId);
    this.windowOrder.push(appId);
    this.activeAppId = appId;
    this.dirty = true;
    if (!opts.silent) {
      sfx.osWindowOpen?.();
    }
    this.redraw();
    return true;
  }

  minimizeWindow(appId = this.activeAppId) {
    const win = this.windows.get(appId);
    if (!win) return false;
    win.minimized = true;
    this._recomputeActiveWindow();
    this.dirty = true;
    sfx.osWindowClose?.();
    this.redraw();
    return true;
  }

  toggleMaximizeWindow(appId = this.activeAppId) {
    const win = this.windows.get(appId);
    if (!win) return false;
    win.maximized = !win.maximized;
    this.dirty = true;
    sfx.osClick?.();
    this.redraw();
    return win.maximized;
  }

  closeWindow(appId = this.activeAppId) {
    if (!this.windows.has(appId)) return false;
    this.windows.delete(appId);
    this.windowOrder = this.windowOrder.filter((id) => id !== appId);
    this._recomputeActiveWindow();
    this.dirty = true;
    sfx.osWindowClose?.();
    this.redraw();
    return true;
  }

  _recomputeActiveWindow() {
    for (let i = this.windowOrder.length - 1; i >= 0; i--) {
      const id = this.windowOrder[i];
      const w = this.windows.get(id);
      if (w && !w.minimized) {
        this.activeAppId = id;
        return;
      }
    }
    this.activeAppId = null;
  }

  hasRunningGame() {
    if (!this.activeAppId) return false;
    const win = this.windows.get(this.activeAppId);
    return Boolean(win && !win.minimized && win.kind === 'game');
  }

  resetHighScores() {
    for (const k of Object.keys(this.highScores)) {
      this.highScores[k] = 0;
    }
    for (const game of this.gameInstances.values()) {
      game.highScore = 0;
    }
    writeStorageJson('ciel_os_high_scores', this.highScores);
    this.dirty = true;
    sfx.osClick?.();
    this.redraw();
  }

  getTotalArcadeScore() {
    return Object.values(this.highScores).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  executeTerminalCommand(rawCmd = this.terminalInput) {
    const clean = String(rawCmd ?? '').trim();
    this.terminalInput = '';
    this.terminalHistory.push(`${this.playerName}@ciel-os:~$ ${clean}`);

    if (!clean) {
      this._trimTerminal();
      this.dirty = true;
      this.redraw();
      return '';
    }

    const parts = clean.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const argStr = parts.slice(1).join(' ');
    let responseLines = [];

    if (cmd === 'help') {
      responseLines = [
        'Commandes CIEL OS disponibles :',
        '  help              : Afficher cette aide système',
        '  ping [hôte]       : Tester la connectivité ICMP (ex: ping 192.168.10.254)',
        '  whoami            : Afficher la session élève et les habilitations CIEL',
        '  matrix            : Activer le flux binaire Matrix sur le terminal',
        '  hack              : Lancer l’audit cyber éthique sur le serveur pédagogique',
        '  cowsay [texte]    : Faire parler la mascotte ASCII du plateau U300',
        '  ipconfig / ip     : Afficher la configuration VLAN du poste',
        '  scores            : Afficher les records des 6 mini-jeux d’arcade',
        '  clear             : Effacer l’écran du terminal'
      ];
    } else if (cmd === 'clear' || cmd === 'cls') {
      this.terminalHistory = [];
      this.dirty = true;
      this.redraw();
      return 'CLEAR';
    } else if (cmd === 'whoami') {
      responseLines = [
        `Utilisateur actif : ${this.playerName}`,
        `Poste de travail  : ${this.stationLabel} (${this.stationId})`,
        'Groupe            : BAC-PRO-CIEL / Cyber-Opérateur U300',
        'Superviseur       : Professeur CIEL (Droits TP & Arcade activés)'
      ];
    } else if (cmd === 'ping') {
      const target = argStr || '192.168.10.254';
      responseLines = [
        `PING ${target} (${target}) 56(84) bytes of data :`,
        `64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.74 ms`,
        `64 bytes from ${target}: icmp_seq=2 ttl=64 time=0.68 ms`,
        `64 bytes from ${target}: icmp_seq=3 ttl=64 time=0.71 ms`,
        `--- ${target} ping statistics : 3 transmitted, 3 received, 0% packet loss ---`
      ];
    } else if (cmd === 'matrix') {
      this.matrixRainActive = !this.matrixRainActive;
      this.themeId = 'matrix_green';
      responseLines = [
        '01000011 01001001 01000101 01001100  [FLUX MATRIX ACTIVÉ]',
        `Wake up, ${this.playerName}... Follow the white network packet.`,
        'Thème Matrix Vert appliqué au bureau CIEL OS.'
      ];
    } else if (cmd === 'hack') {
      responseLines = [
        '[AUDIT] Connexion SSH vers srv-pedago-u300.ciel.local:22...',
        '[SCAN] Pare-feu VLAN 10/20/30 analysé : 0 vulnérabilité critique.',
        '[EXPLOIT] Déchiffrement du coffre d’évaluation du Professeur CIEL... [██████████] 100%',
        '[SUCCÈS] Félicitations du Professeur CIEL : Bonus Cyber-Opérateur validé !'
      ];
      sfx.arcadePowerup?.();
    } else if (cmd === 'cowsay') {
      const msg = argStr || 'Vive le Bac Pro CIEL 3D !';
      const border = '─'.repeat(Math.min(44, msg.length + 2));
      responseLines = [
        ` ╭${border}╮`,
        ` │ ${msg.slice(0, 42)} │`,
        ` ╰${border}╯`,
        '        \\   ^__^',
        '         \\  (oo)\\_______',
        '            (__)\\       )\\/\\',
        '                ||----w |',
        '                ||     ||'
      ];
    } else if (cmd === 'ipconfig' || cmd === 'ifconfig' || cmd === 'ip') {
      responseLines = [
        'Interface eth0 (VLAN 10 - Atelier CIEL U300) :',
        '  Adresse IPv4 : 192.168.10.42 / 255.255.255.0',
        '  Passerelle   : 192.168.10.254 (Switch L3 Core)',
        '  Serveur DNS  : 192.168.10.1 (ciel-u300.local)'
      ];
    } else if (cmd === 'scores') {
      responseLines = [
        `=== RECORDS ARCADE CIEL OS (Total: ${this.getTotalArcadeScore()} pts) ===`,
        ...CIEL_OS_GAMES_CATALOG.map((g) => `  ${g.icon} ${g.title.padEnd(22, ' ')} : ${this.highScores[g.id] || 0} pts`)
      ];
    } else if (cmd === 'date') {
      responseLines = [`Date système CIEL OS : ${new Date().toLocaleString('fr-FR')}`];
    } else if (cmd === 'theme') {
      this.cycleTheme();
      responseLines = [`Thème changé vers : ${this.getTheme().label}`];
    } else {
      responseLines = [
        `ciel-sh: commande introuvable : "${cmd}". Tapez "help" pour la liste des commandes.`
      ];
    }

    this.terminalHistory.push(...responseLines);
    this._trimTerminal();
    sfx.arcadeBeep?.(620, 0.03, 'square');
    this.dirty = true;
    this.redraw();
    return responseLines.join('\n');
  }

  _trimTerminal() {
    if (this.terminalHistory.length > 48) {
      this.terminalHistory = this.terminalHistory.slice(-48);
    }
  }

  setNotepadText(text) {
    this.notepadText = String(text ?? '');
    writeStorageJson('ciel_os_notepad_text', this.notepadText);
    this.dirty = true;
    this.redraw();
  }

  appendTextToActiveApp(str) {
    if (this.activeAppId === 'terminal') {
      this.terminalInput = (this.terminalInput + str).slice(0, 64);
      this.dirty = true;
      this.redraw();
      return true;
    }
    if (this.activeAppId === 'notepad') {
      this.setNotepadText((this.notepadText + str).slice(0, 1200));
      return true;
    }
    return false;
  }

  backspaceActiveApp() {
    if (this.activeAppId === 'terminal') {
      this.terminalInput = this.terminalInput.slice(0, -1);
      this.dirty = true;
      this.redraw();
      return true;
    }
    if (this.activeAppId === 'notepad') {
      this.setNotepadText(this.notepadText.slice(0, -1));
      return true;
    }
    return false;
  }

  handleKeyDown(code, key = '') {
    if (this.sessionLocked) {
      if (code === 'Enter' || code === 'Space') {
        return this.unlockSession();
      }
      return false;
    }

    if (this.activeAppId && this.windows.get(this.activeAppId) && !this.windows.get(this.activeAppId).minimized) {
      const win = this.windows.get(this.activeAppId);
      if (win.kind === 'game') {
        const game = this._getOrCreateGame(win.appId);
        const handled = game.handleKeyDown(code, key);
        if (handled) {
          this.dirty = true;
          this.redraw();
        }
        return handled;
      }

      if (this.activeAppId === 'terminal') {
        if (code === 'Enter' || code === 'NumpadEnter') {
          this.executeTerminalCommand(this.terminalInput);
          return true;
        }
        if (code === 'Backspace') {
          return this.backspaceActiveApp();
        }
        if (key && key.length === 1 && !['\r', '\n'].includes(key)) {
          return this.appendTextToActiveApp(key);
        }
      }

      if (this.activeAppId === 'notepad') {
        if (code === 'Enter' || code === 'NumpadEnter') {
          return this.appendTextToActiveApp('\n');
        }
        if (code === 'Backspace') {
          return this.backspaceActiveApp();
        }
        if (key && key.length === 1) {
          return this.appendTextToActiveApp(key);
        }
      }
    }
    return false;
  }

  handleThumbstick(lx, ly, dt = 0.016) {
    if (!this.activeAppId) return false;
    const win = this.windows.get(this.activeAppId);
    if (!win || win.minimized || win.kind !== 'game') return false;
    const game = this._getOrCreateGame(win.appId);
    const changed = game.handleThumbstick(lx, ly, dt);
    if (changed) {
      this.dirty = true;
      this.redraw();
    }
    return changed;
  }

  uvToCanvas(uv) {
    if (!uv) return null;
    const cx = Math.max(0, Math.min(this.width, Number(uv.x) * this.width));
    const cy = Math.max(0, Math.min(this.height, (1 - Number(uv.y)) * this.height));
    return { x: cx, y: cy };
  }

  hitTestCanvasPoint(px, py) {
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const b = this.hitBoxes[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  hitTestUv(uv) {
    const pt = this.uvToCanvas(uv);
    if (!pt) return null;
    this.cursorPos = { x: pt.x, y: pt.y, visible: true };
    const hit = this.hitTestCanvasPoint(pt.x, pt.y);
    if (hit) return hit;
    return {
      id: 'os_surface_canvas',
      kind: 'surface',
      x: 0,
      y: 0,
      w: this.width,
      h: this.height,
      onClick: (clickUv) => this.handlePointerDownUv(clickUv || uv, 0)
    };
  }

  setHovered(id) {
    const next = id || null;
    if (this.hoveredId !== next) {
      this.hoveredId = next;
      this.dirty = true;
      this.redraw();
    }
  }

  handlePointerMoveUv(uv) {
    const pt = this.uvToCanvas(uv);
    if (!pt) return false;
    this.cursorPos = { x: pt.x, y: pt.y, visible: true };
    const hit = this.hitTestCanvasPoint(pt.x, pt.y);
    const nextHover = hit ? hit.id : null;
    if (nextHover !== this.hoveredId) {
      this.hoveredId = nextHover;
      this.dirty = true;
    }
    if (this.activeAppId && this.activeGameRect) {
      const win = this.windows.get(this.activeAppId);
      if (win && !win.minimized && win.kind === 'game') {
        const g = this._getOrCreateGame(win.appId);
        g.handlePointerMove?.(pt.x, pt.y, this.activeGameRect);
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.redraw();
    }
    return Boolean(hit);
  }

  handlePointerDownUv(uv, button = 0) {
    const pt = this.uvToCanvas(uv);
    if (!pt) return false;
    this.cursorPos = { x: pt.x, y: pt.y, visible: true };

    if (this.sessionLocked) {
      return this.unlockSession();
    }

    if (button === 2 && this.activeAppId && this.activeGameRect) {
      const win = this.windows.get(this.activeAppId);
      if (win && !win.minimized && win.kind === 'game') {
        const g = this._getOrCreateGame(win.appId);
        const ok = g.handlePointerDown?.(pt.x, pt.y, this.activeGameRect, 2);
        this.dirty = true;
        this.redraw();
        return Boolean(ok);
      }
    }

    const hit = this.hitTestCanvasPoint(pt.x, pt.y);
    if (hit && typeof hit.onClick === 'function') {
      hit.onClick(uv);
      this.dirty = true;
      this.redraw();
      return true;
    }

    if (this.activeAppId && this.activeGameRect) {
      const r = this.activeGameRect;
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        const win = this.windows.get(this.activeAppId);
        if (win && !win.minimized && win.kind === 'game') {
          const g = this._getOrCreateGame(win.appId);
          const ok = g.handlePointerDown?.(pt.x, pt.y, r, button);
          this.dirty = true;
          this.redraw();
          return Boolean(ok);
        }
      }
    }

    if (this.startMenuOpen) {
      this.startMenuOpen = false;
      this.dirty = true;
      this.redraw();
    }
    return false;
  }

  handlePointerUpUv(uv, button = 0) {
    const pt = this.uvToCanvas(uv);
    if (!pt) return false;
    if (this.activeAppId && this.activeGameRect) {
      const win = this.windows.get(this.activeAppId);
      if (win && !win.minimized && win.kind === 'game') {
        const g = this._getOrCreateGame(win.appId);
        const ok = g.handlePointerUp?.(pt.x, pt.y, this.activeGameRect, button);
        if (ok) {
          this.dirty = true;
          this.redraw();
        }
        return Boolean(ok);
      }
    }
    return false;
  }

  clickAtUv(uv, button = 0) {
    return this.handlePointerDownUv(uv, button);
  }

  update(dt = 0.016, elapsed = null) {
    const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0.016));
    if (typeof elapsed === 'number') {
      this.elapsed = elapsed;
    } else {
      this.elapsed += safeDt;
    }

    let needsRedraw = this.dirty;
    if (this.activeAppId) {
      const win = this.windows.get(this.activeAppId);
      if (win && !win.minimized && win.kind === 'game') {
        const game = this._getOrCreateGame(win.appId);
        game.update(safeDt);
        needsRedraw = true;
      }
    }

    if (this.matrixRainActive || this.themeId === 'matrix_green' || this.themeId === 'synthwave') {
      if (this.elapsed - this.lastIdleDrawAt >= 0.12) {
        needsRedraw = true;
      }
    } else if (this.elapsed - this.lastIdleDrawAt >= 0.9) {
      needsRedraw = true;
    }

    if (needsRedraw) {
      this.lastIdleDrawAt = this.elapsed;
      this.redraw();
      return true;
    }
    return false;
  }

  setSleepMode(sleeping, inView = true, focused = false) {
    this.sleepMode = Boolean(sleeping);
    this.inView = Boolean(inView);
    this.isFocusedStation = Boolean(focused);
  }

  updateIdle(elapsed = 0, opts = {}) {
    this.elapsed = elapsed;
    const inView = opts.inView !== undefined ? Boolean(opts.inView) : this.inView;
    const focused = opts.focused !== undefined ? Boolean(opts.focused) : this.isFocusedStation;
    const near = opts.near !== undefined ? Boolean(opts.near) : !this.sleepMode;
    this.inView = inView;
    this.isFocusedStation = focused;
    this.sleepMode = !focused && !near;

    if (!focused && !inView && !this.dirty) {
      return false;
    }

    if (this.sleepMode) {
      if (this.dirty || elapsed - this.lastIdleDrawAt >= 2.0) {
        this.lastIdleDrawAt = elapsed;
        this.redraw();
        return true;
      }
      return false;
    }

    if (this.hasRunningGame()) {
      const minStep = focused ? 0.016 : 0.032;
      if (this.dirty || elapsed - this.lastActiveDrawAt >= minStep) {
        const dt =
          this.lastActiveDrawAt >= 0
            ? Math.min(0.08, Math.max(0.016, elapsed - this.lastActiveDrawAt))
            : 0.032;
        this.lastActiveDrawAt = elapsed;
        return this.update(dt, elapsed);
      }
      return false;
    }

    if (this.dirty || elapsed - this.lastIdleDrawAt >= 1.0) {
      this.lastIdleDrawAt = elapsed;
      this.redraw();
      return true;
    }
    return false;
  }

  _addHitBox(box) {
    this.hitBoxes.push(box);
  }

  _drawBtn(id, x, y, w, h, label, opts = {}) {
    const ctx = this.ctx;
    const isHov = this.hoveredId === id;
    const active = Boolean(opts.active);
    const primary = Boolean(opts.primary);
    const danger = Boolean(opts.danger);
    const theme = this.getTheme();
    const borderCol = opts.borderColor || (danger ? '#f43f5e' : primary ? '#10b981' : active ? theme.accent : '#475569');

    if (ctx) {
      roundRect(ctx, x, y, w, h, opts.radius ?? 8);
      ctx.fillStyle = isHov
        ? borderCol
        : danger
          ? 'rgba(159, 18, 57, 0.72)'
          : primary
            ? 'rgba(5, 150, 105, 0.72)'
            : active
              ? 'rgba(2, 132, 199, 0.65)'
              : opts.bgColor || 'rgba(15, 23, 42, 0.88)';
      ctx.fill();
      ctx.lineWidth = isHov || active ? 2.2 : 1.3;
      ctx.strokeStyle = borderCol;
      ctx.stroke();

      ctx.fillStyle = isHov ? '#04101f' : opts.textColor || '#f8fafc';
      ctx.font = `${opts.bold === false ? '' : 'bold '}${opts.fontSize || 14}px system-ui, sans-serif`;
      ctx.textAlign = opts.align || 'center';
      ctx.textBaseline = 'middle';
      const tx = opts.align === 'left' ? x + 12 : x + w / 2;
      ctx.fillText(String(label || ''), tx, y + h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (opts.onClick) {
      this._addHitBox({
        id,
        kind: 'button',
        x,
        y,
        w,
        h,
        label,
        onClick: opts.onClick
      });
    }
  }

  _drawWallpaper(ctx, W, H, theme) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (theme.id === 'synthwave') {
      const sunGrad = ctx.createLinearGradient(0, 120, 0, 340);
      sunGrad.addColorStop(0, '#fde047');
      sunGrad.addColorStop(0.5, '#f97316');
      sunGrad.addColorStop(1, '#db2777');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(W / 2, 240, 105, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.bgBot;
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(W / 2 - 115, 245 + i * 16, 230, 5 + i);
      }

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.28)';
      ctx.lineWidth = 1.5;
      for (let y = 310; y < H - 46; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let x = -200; x <= W + 200; x += 80) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + (x - W / 2) * 0.25, 310);
        ctx.lineTo(x, H - 46);
        ctx.stroke();
      }
    } else if (theme.id === 'matrix_green' || this.matrixRainActive) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.font = 'bold 14px monospace';
      const cols = Math.floor(W / 32);
      for (let c = 0; c < cols; c++) {
        const headY = ((Math.floor(this.elapsed * 90) + c * 73) % (H - 60));
        const bit = (c + Math.floor(this.elapsed * 4)) % 2 === 0 ? '10' : '01';
        ctx.fillText(bit, c * 32 + 8, headY);
        ctx.fillText('CIEL', c * 32 + 8, (headY + 180) % (H - 60));
      }
    } else {
      ctx.strokeStyle = theme.gridColor;
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H - 46);
        ctx.stroke();
      }
      for (let gy = 0; gy < H - 46; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.font = 'bold 68px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('CIEL OS 4.22', W - 32, H - 96);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.fillText(`PLATEAU U300 • ${this.stationLabel.toUpperCase()}`, W - 34, H - 66);
    ctx.textAlign = 'left';
  }

  _drawVirtualKeyboard(x, y, w, h) {
    const ctx = this.ctx;
    if (ctx) {
      roundRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = 'rgba(7, 13, 28, 0.96)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const rows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '-'],
      ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
      ['w', 'x', 'c', 'v', 'b', 'n', ' ', '⌫', '↵']
    ];
    const pad = 6;
    const rowH = Math.floor((h - pad * (rows.length + 1)) / rows.length);

    rows.forEach((keys, rIdx) => {
      const ry = y + pad + rIdx * (rowH + pad);
      const kw = Math.floor((w - pad * (keys.length + 1)) / keys.length);
      keys.forEach((k, cIdx) => {
        const kx = x + pad + cIdx * (kw + pad);
        const label = k === ' ' ? 'ESPACE' : k === '↵' ? 'ENTRÉE' : this.keyboardShift ? k.toUpperCase() : k;
        this._drawBtn(`os_vk_${rIdx}_${cIdx}`, kx, ry, kw, rowH, label, {
          fontSize: 13,
          primary: k === '↵',
          danger: k === '⌫',
          onClick: () => {
            sfx.osClick?.();
            if (k === '⌫') {
              this.backspaceActiveApp();
            } else if (k === '↵') {
              if (this.activeAppId === 'terminal') this.executeTerminalCommand(this.terminalInput);
              else this.appendTextToActiveApp('\n');
            } else {
              this.appendTextToActiveApp(this.keyboardShift ? k.toUpperCase() : k);
            }
          }
        });
      });
    });
  }

  _drawActiveWindow(W, H, theme) {
    if (!this.activeAppId) return;
    const win = this.windows.get(this.activeAppId);
    if (!win || win.minimized) return;

    const ctx = this.ctx;
    const wx = win.maximized ? 12 : 210;
    const wy = win.maximized ? 38 : 42;
    const ww = win.maximized ? W - 24 : W - 226;
    const wh = win.maximized ? H - 90 : H - 98;

    if (ctx) {
      roundRect(ctx, wx, wy, ww, wh, 12);
      ctx.fillStyle = 'rgba(8, 15, 30, 0.96)';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = win.color || theme.accent;
      ctx.stroke();

      roundRect(ctx, wx + 2, wy + 2, ww - 4, 38, 10);
      ctx.fillStyle = 'rgba(15, 29, 54, 0.96)';
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`${win.icon}  ${win.title}`, wx + 16, wy + 26);
    }

    this._drawBtn(`win_min_${win.appId}`, wx + ww - 118, wy + 6, 32, 28, '—', {
      fontSize: 14,
      onClick: () => this.minimizeWindow(win.appId)
    });
    this._drawBtn(`win_max_${win.appId}`, wx + ww - 80, wy + 6, 32, 28, win.maximized ? '❐' : '□', {
      fontSize: 14,
      onClick: () => this.toggleMaximizeWindow(win.appId)
    });
    this._drawBtn(`win_close_${win.appId}`, wx + ww - 42, wy + 6, 34, 28, '✕', {
      danger: true,
      fontSize: 14,
      onClick: () => this.closeWindow(win.appId)
    });

    const bodyRect = { x: wx + 10, y: wy + 44, w: ww - 20, h: wh - 52 };

    if (win.kind === 'game') {
      this.activeGameRect = bodyRect;
      const game = this._getOrCreateGame(win.appId);
      game.render(ctx, bodyRect, (hb) => this._addHitBox(hb), this.hoveredId);
      return;
    }

    this.activeGameRect = null;

    if (win.appId === 'terminal') {
      const kbdH = this.virtualKeyboardOpen ? 148 : 0;
      const logH = bodyRect.h - 94 - kbdH;
      if (ctx) {
        roundRect(ctx, bodyRect.x, bodyRect.y, bodyRect.w, logH, 8);
        ctx.fillStyle = '#020611';
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const maxLines = Math.max(5, Math.floor((logH - 18) / 19));
        const visibleLines = this.terminalHistory.slice(-maxLines);
        ctx.font = '14px monospace';
        visibleLines.forEach((ln, idx) => {
          ctx.fillStyle = ln.includes('@ciel-os') ? '#38bdf8' : ln.startsWith('[SUCCÈS]') ? '#fbbf24' : '#34d399';
          ctx.fillText(String(ln).slice(0, 88), bodyRect.x + 12, bodyRect.y + 22 + idx * 19);
        });
      }

      const presetY = bodyRect.y + logH + 8;
      const presets = ['help', 'ping', 'whoami', 'matrix', 'hack', 'cowsay', 'clear'];
      const pw = Math.floor((bodyRect.w - (presets.length - 1) * 6) / presets.length);
      presets.forEach((cmd, idx) => {
        this._drawBtn(`term_cmd_${cmd}`, bodyRect.x + idx * (pw + 6), presetY, pw, 32, cmd, {
          fontSize: 13,
          active: cmd === 'matrix' && this.matrixRainActive,
          onClick: () => this.executeTerminalCommand(cmd)
        });
      });

      const inputY = presetY + 38;
      if (ctx) {
        roundRect(ctx, bodyRect.x, inputY, bodyRect.w - 220, 38, 8);
        ctx.fillStyle = '#071224';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(`$ ${this.terminalInput}_`, bodyRect.x + 12, inputY + 24);
      }

      this._drawBtn('term_kbd_toggle', bodyRect.x + bodyRect.w - 212, inputY, 102, 38, '⌨️ Clavier', {
        active: this.virtualKeyboardOpen,
        fontSize: 13,
        onClick: () => {
          this.virtualKeyboardOpen = !this.virtualKeyboardOpen;
          sfx.osClick?.();
        }
      });
      this._drawBtn('term_exec', bodyRect.x + bodyRect.w - 104, inputY, 104, 38, 'Exécuter ↵', {
        primary: true,
        fontSize: 13,
        onClick: () => this.executeTerminalCommand(this.terminalInput)
      });

      if (this.virtualKeyboardOpen) {
        this._drawVirtualKeyboard(bodyRect.x, inputY + 44, bodyRect.w, kbdH - 4);
      }
      return;
    }

    if (win.appId === 'notepad') {
      const topBarY = bodyRect.y;
      const tplW = Math.floor((bodyRect.w - 210 - 18) / NOTEPAD_TEMPLATES.length);
      NOTEPAD_TEMPLATES.forEach((tpl, idx) => {
        this._drawBtn(`note_tpl_${tpl.id}`, bodyRect.x + idx * (tplW + 6), topBarY, tplW, 34, tpl.label, {
          fontSize: 12,
          onClick: () => {
            sfx.osClick?.();
            this.setNotepadText(tpl.text);
          }
        });
      });

      this._drawBtn('note_kbd_toggle', bodyRect.x + bodyRect.w - 200, topBarY, 96, 34, '⌨️ Clavier', {
        active: this.virtualKeyboardOpen,
        fontSize: 12,
        onClick: () => {
          this.virtualKeyboardOpen = !this.virtualKeyboardOpen;
          sfx.osClick?.();
        }
      });
      this._drawBtn('note_clear', bodyRect.x + bodyRect.w - 98, topBarY, 98, 34, '🗑️ Effacer', {
        danger: true,
        fontSize: 12,
        onClick: () => {
          sfx.osClick?.();
          this.setNotepadText('');
        }
      });

      const kbdH = this.virtualKeyboardOpen ? 148 : 0;
      const areaY = topBarY + 42;
      const areaH = bodyRect.h - 46 - kbdH;
      if (ctx) {
        roundRect(ctx, bodyRect.x, areaY, bodyRect.w, areaH, 8);
        ctx.fillStyle = '#0b1324';
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '15px monospace';
        const lines = String(this.notepadText || '').split('\n');
        const maxRows = Math.max(4, Math.floor((areaH - 24) / 22));
        lines.slice(0, maxRows).forEach((ln, idx) => {
          ctx.fillText(ln.slice(0, 82), bodyRect.x + 14, areaY + 26 + idx * 22);
        });
      }

      if (this.virtualKeyboardOpen) {
        this._drawVirtualKeyboard(bodyRect.x, areaY + areaH + 6, bodyRect.w, kbdH - 6);
      }
      return;
    }

    if (win.appId === 'scores') {
      const totalPts = this.getTotalArcadeScore();
      if (ctx) {
        roundRect(ctx, bodyRect.x, bodyRect.y, bodyRect.w, 54, 10);
        ctx.fillStyle = 'rgba(15, 32, 58, 0.92)';
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText(`🏆 PALMARÈS ARCADE LOCAL — ${this.playerName}`, bodyRect.x + 16, bodyRect.y + 24);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText(`Score Cumulé : ${totalPts} pts • 6 Mini-Jeux Intégrés`, bodyRect.x + 16, bodyRect.y + 44);
      }

      this._drawBtn('scores_reset_all', bodyRect.x + bodyRect.w - 154, bodyRect.y + 10, 142, 34, '🔄 Réinitialiser', {
        danger: true,
        fontSize: 12,
        onClick: () => this.resetHighScores()
      });

      const startY = bodyRect.y + 66;
      const rowH = Math.floor((bodyRect.h - 70) / CIEL_OS_GAMES_CATALOG.length) - 4;
      CIEL_OS_GAMES_CATALOG.forEach((g, idx) => {
        const ry = startY + idx * (rowH + 4);
        const hi = this.highScores[g.id] || 0;
        const badge = hi >= 500 ? '🥇 Cyber-Maître' : hi >= 200 ? '🥈 Opérateur Or' : hi > 0 ? '🥉 Qualifié' : '⏳ Non joué';
        if (ctx) {
          roundRect(ctx, bodyRect.x, ry, bodyRect.w, rowH, 8);
          ctx.fillStyle = idx % 2 === 0 ? 'rgba(15, 23, 42, 0.88)' : 'rgba(22, 34, 58, 0.78)';
          ctx.fill();
          ctx.strokeStyle = g.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.fillText(`${g.icon}  ${g.title}`, bodyRect.x + 14, ry + rowH / 2 + 5);

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 16px monospace';
          ctx.fillText(`${hi} pts`, bodyRect.x + 280, ry + rowH / 2 + 5);

          ctx.fillStyle = '#6ee7b7';
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.fillText(badge, bodyRect.x + 410, ry + rowH / 2 + 5);
        }

        this._drawBtn(`scores_play_${g.id}`, bodyRect.x + bodyRect.w - 126, ry + 6, 114, rowH - 12, '▶ Jouer', {
          primary: true,
          fontSize: 13,
          onClick: () => this.openApp(g.id)
        });
      });
    }
  }

  _drawStartMenu(W, H, theme) {
    if (!this.startMenuOpen) return;
    const ctx = this.ctx;
    const mx = 12;
    const mw = 350;
    const mh = 456;
    const my = H - 52 - mh;

    if (ctx) {
      roundRect(ctx, mx, my, mw, mh, 14);
      ctx.fillStyle = 'rgba(7, 15, 32, 0.97)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.accent;
      ctx.stroke();

      roundRect(ctx, mx + 10, my + 10, mw - 20, 48, 10);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`👤 Session : ${this.playerName}`, mx + 22, my + 32);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`Poste : ${this.stationLabel}`, mx + 22, my + 49);
    }

    CIEL_OS_APPS.forEach((app, idx) => {
      const ry = my + 66 + idx * 36;
      this._drawBtn(`start_app_${app.id}`, mx + 12, ry, mw - 24, 32, `${app.icon}  ${app.title}`, {
        align: 'left',
        fontSize: 14,
        onClick: () => this.openApp(app.id)
      });
    });

    const botY = my + mh - 46;
    this._drawBtn('start_lock', mx + 12, botY, 156, 34, '🔒 Verrouiller', {
      fontSize: 13,
      onClick: () => this.lockSession()
    });
    this._drawBtn('start_exit_pc', mx + 178, botY, 160, 34, '🚪 Quitter le PC', {
      danger: true,
      fontSize: 13,
      onClick: () => this.onRequestExit?.()
    });
  }

  redraw() {
    this.dirty = false;
    this.hitBoxes = [];
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const theme = this.getTheme();

    if (ctx) {
      this._drawWallpaper(ctx, W, H, theme);
    }

    if (this.sessionLocked) {
      if (ctx) {
        roundRect(ctx, W / 2 - 230, H / 2 - 140, 460, 280, 18);
        ctx.fillStyle = 'rgba(7, 15, 32, 0.94)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = theme.accent;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText('🖥️ CIEL OS v4.22', W / 2, H / 2 - 82);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(`👤 Session Élève : ${this.playerName}`, W / 2, H / 2 - 34);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`${this.stationLabel} • 6 Mini-Jeux & Utilitaires CIEL`, W / 2, H / 2 + 2);
        ctx.textAlign = 'left';
      }

      this._drawBtn('session_unlock_btn', W / 2 - 160, H / 2 + 36, 320, 56, `🚀 Ouvrir Session ${this.playerName}`, {
        primary: true,
        fontSize: 18,
        onClick: () => this.unlockSession()
      });
      this.onChange?.();
      return;
    }

    if (ctx) {
      roundRect(ctx, 12, 6, W - 24, 28, 8);
      ctx.fillStyle = 'rgba(7, 14, 28, 0.82)';
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`🖥️ CIEL OS • ${this.stationLabel}`, 24, 24);
      ctx.fillStyle = '#6ee7b7';
      ctx.textAlign = 'right';
      ctx.fillText(`👤 Connecté : ${this.playerName}  •  🏆 Arcade : ${this.getTotalArcadeScore()} pts`, W - 24, 24);
      ctx.textAlign = 'left';
    }

    const iconCols = 2;
    const iconW = 90;
    const iconH = 68;
    const startX = 14;
    const startY = 42;
    const gapX = 8;
    const gapY = 8;

    CIEL_OS_APPS.forEach((app, idx) => {
      const col = idx % iconCols;
      const row = Math.floor(idx / iconCols);
      const ix = startX + col * (iconW + gapX);
      const iy = startY + row * (iconH + gapY);
      const btnId = `desk_icon_${app.id}`;
      const isHov = this.hoveredId === btnId;
      const isActive = this.activeAppId === app.id;

      if (ctx) {
        roundRect(ctx, ix, iy, iconW, iconH, 10);
        ctx.fillStyle = isHov
          ? 'rgba(56, 189, 248, 0.32)'
          : isActive
            ? 'rgba(16, 185, 129, 0.24)'
            : 'rgba(15, 23, 42, 0.76)';
        ctx.fill();
        ctx.lineWidth = isHov || isActive ? 2 : 1;
        ctx.strokeStyle = isHov ? '#38bdf8' : app.color;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = '24px system-ui, sans-serif';
        ctx.fillText(app.icon, ix + iconW / 2, iy + 30);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(app.shortTitle.slice(0, 13), ix + iconW / 2, iy + 54);
        ctx.textAlign = 'left';
      }

      this._addHitBox({
        id: btnId,
        kind: 'icon',
        x: ix,
        y: iy,
        w: iconW,
        h: iconH,
        label: app.title,
        onClick: () => this.openApp(app.id)
      });
    });

    this._drawActiveWindow(W, H, theme);

    const tbY = H - 46;
    if (ctx) {
      ctx.fillStyle = 'rgba(6, 12, 24, 0.96)';
      ctx.fillRect(0, tbY, W, 46);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, tbY);
      ctx.lineTo(W, tbY);
      ctx.stroke();
    }

    this._drawBtn('taskbar_start', 8, tbY + 6, 106, 34, '❖ CIEL', {
      active: this.startMenuOpen,
      primary: !this.startMenuOpen,
      fontSize: 15,
      onClick: () => this.toggleStartMenu()
    });

    let tabX = 122;
    const openWins = Array.from(this.windows.values());
    const maxTabW = Math.min(136, Math.floor((420 / Math.max(1, openWins.length)) - 6));
    openWins.slice(0, 4).forEach((w) => {
      const isFocused = this.activeAppId === w.appId && !w.minimized;
      this._drawBtn(`taskbar_win_${w.appId}`, tabX, tbY + 6, maxTabW, 34, `${w.icon} ${w.shortTitle}`, {
        active: isFocused,
        fontSize: 12,
        onClick: () => {
          if (isFocused) {
            this.minimizeWindow(w.appId);
          } else {
            this.openApp(w.appId);
          }
        }
      });
      tabX += maxTabW + 6;
    });

    this._drawBtn('taskbar_theme', W - 472, tbY + 6, 98, 34, `🎨 ${theme.label.split(' ')[0]}`, {
      fontSize: 12,
      onClick: () => this.cycleTheme()
    });

    const volPct = Math.round(sfx.getVolume() * 100);
    this._drawBtn('taskbar_mute', W - 368, tbY + 6, 62, 34, sfx.muted ? '🔇 0%' : `🔊${volPct}%`, {
      active: !sfx.muted,
      fontSize: 11,
      onClick: () => {
        sfx.toggleMute();
        this.dirty = true;
        this.redraw();
      }
    });
    this._drawBtn('taskbar_vol_down', W - 302, tbY + 6, 28, 34, '−', {
      fontSize: 15,
      onClick: () => {
        sfx.setVolume(Math.max(0, (sfx.volume || 0.8) - 0.2));
        sfx.osClick?.();
        this.dirty = true;
        this.redraw();
      }
    });
    this._drawBtn('taskbar_vol_up', W - 270, tbY + 6, 28, 34, '+', {
      fontSize: 15,
      onClick: () => {
        sfx.setVolume(Math.min(1, (sfx.volume || 0.8) + 0.2));
        sfx.osClick?.();
        this.dirty = true;
        this.redraw();
      }
    });

    if (this.onToggleComfort) {
      this._drawBtn('taskbar_comfort', W - 236, tbY + 6, 86, 34, '⛶ Confort', {
        active: true,
        fontSize: 12,
        onClick: () => this.onToggleComfort?.()
      });
    }

    if (ctx) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hh}:${mm}:${ss}`, W - 112, tbY + 28);
      ctx.textAlign = 'left';
    }

    this._drawBtn('taskbar_exit_pc', W - 74, tbY + 6, 66, 34, '🚪 Quitter', {
      danger: true,
      fontSize: 12,
      onClick: () => this.onRequestExit?.()
    });

    this._drawStartMenu(W, H, theme);

    if (ctx && this.cursorPos?.visible) {
      ctx.save();
      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.cursorPos.x, this.cursorPos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    this.textureUploadCount = (this.textureUploadCount || 0) + 1;
    this.onChange?.();
  }

  getHitBoxes() {
    return this.hitBoxes.slice();
  }
}
