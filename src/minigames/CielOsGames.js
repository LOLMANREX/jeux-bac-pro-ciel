import { sfx } from '../core/audio.js';
import { computeArcadeCoinReward } from '../world/ShopCatalog.js';

export const CIEL_OS_GAMES_CATALOG = [
  {
    id: 'snake',
    title: 'Cyber Snake',
    shortTitle: 'Cyber Snake',
    icon: '🐍',
    color: '#10b981',
    desc: 'Serpent néon avec bonus de vitesse, téléporteurs et compteur de paquets.'
  },
  {
    id: 'minesweeper',
    title: 'Démineur CIEL',
    shortTitle: 'Démineur',
    icon: '💣',
    color: '#f59e0b',
    desc: 'Désamorcez les bombes logiques avec drapeaux, chronomètre et niveaux Facile/Moyen.'
  },
  {
    id: 'tetris',
    title: 'CIEL-Blocks',
    shortTitle: 'CIEL-Blocks',
    icon: '🧱',
    color: '#a855f7',
    desc: 'Empilez les blocs réseau, faites pivoter les pièces et supprimez les lignes.'
  },
  {
    id: 'breakout',
    title: 'Casse-Briques Réseau',
    shortTitle: 'Casse-Briques',
    icon: '🛡️',
    color: '#f43f5e',
    desc: 'Détruisez les briques pare-feu multi-résistance avec rebonds physiques et multi-balle.'
  },
  {
    id: 'flappy',
    title: 'Flappy Packet',
    shortTitle: 'Flappy Packet',
    icon: '📡',
    color: '#38bdf8',
    desc: 'Dirigez un paquet IP à travers les ports ouverts des pare-feux sans crasher.'
  },
  {
    id: 'game2048',
    title: '2048 CIEL',
    shortTitle: '2048 CIEL',
    icon: '🔢',
    color: '#fb923c',
    desc: 'Fusionnez les puissances binaires (2, 4, 8... jusqu’à 2048) avec animations fluides.'
  }
];

function drawRoundRect(ctx, x, y, w, h, r = 8) {
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

function drawUiBtn(ctx, addHitBox, hoveredId, id, x, y, w, h, label, opts = {}) {
  const hovered = hoveredId === id;
  const active = Boolean(opts.active);
  const danger = Boolean(opts.danger);
  const primary = Boolean(opts.primary);
  const accent = opts.color || (danger ? '#f43f5e' : primary ? '#10b981' : active ? '#38bdf8' : '#64748b');

  if (ctx) {
    drawRoundRect(ctx, x, y, w, h, opts.radius ?? 8);
    ctx.fillStyle = hovered
      ? accent
      : active
        ? 'rgba(14, 165, 233, 0.32)'
        : primary
          ? 'rgba(16, 185, 129, 0.25)'
          : danger
            ? 'rgba(244, 63, 94, 0.25)'
            : 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.lineWidth = hovered || active ? 2.2 : 1.4;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.fillStyle = hovered ? '#04101f' : '#f8fafc';
    ctx.font = `bold ${opts.fontSize || 14}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || ''), x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  if (typeof addHitBox === 'function' && opts.onClick) {
    addHitBox({
      id,
      x,
      y,
      w,
      h,
      label,
      onClick: opts.onClick
    });
  }
}

export class CyberSnakeGame {
  constructor(options = {}) {
    this.id = 'snake';
    this.title = 'Cyber Snake';
    this.icon = '🐍';
    this.cols = 20;
    this.rows = 13;
    this.onScoreChange = options.onScoreChange || null;
    this.onGameEnd = options.onGameEnd || null;
    this.highScore = Number(options.initialHighScore) || 0;
    this.portalWalls = true;
    this.stickCooldown = 0;
    this.reset();
  }

  reset() {
    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);
    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY }
    ];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this._endReported = false;
    this.lastCoinsEarned = 0;
    this.stepAccum = 0;
    this.baseStepInterval = 0.135;
    this.boostRemaining = 0;
    this.teleporters = [
      { x: 3, y: 3, pairX: this.cols - 4, pairY: this.rows - 4 },
      { x: this.cols - 4, y: this.rows - 4, pairX: 3, pairY: 3 }
    ];
    this.food = { x: midX + 4, y: midY, kind: 'normal' };
    this.bonusFood = { x: 4, y: midY - 3, ttl: 8.0 };
    this._notifyScore();
  }

  _notifyScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.onScoreChange?.(this.id, this.score, this.highScore);
  }

  _emitGameEnd(won = false) {
    if (this._endReported) return;
    this._endReported = true;
    const reward = computeArcadeCoinReward({
      gameId: this.id,
      score: this.score,
      isNewRecord: this.score > 0 && this.score >= this.highScore
    });
    this.lastCoinsEarned = reward.totalCoins;
    this.onGameEnd?.(this.id, this.score, {
      won: Boolean(won),
      highScore: this.highScore,
      estimatedCoins: this.lastCoinsEarned
    });
  }

  addScore(points) {
    this.score = Math.max(0, this.score + Number(points || 0));
    this._notifyScore();
  }

  forceGameOver() {
    this.gameOver = true;
    sfx.arcadeGameOver?.();
    this._notifyScore();
    this._emitGameEnd(false);
  }

  setDirection(dx, dy) {
    const nx = Math.sign(Number(dx) || 0);
    const ny = Math.sign(Number(dy) || 0);
    if (nx === 0 && ny === 0) return false;
    if (nx !== 0 && ny !== 0) return false;
    if (this.dir.x === -nx && this.dir.y === -ny) return false;
    this.nextDir = { x: nx, y: ny };
    return true;
  }

  togglePortalMode() {
    this.portalWalls = !this.portalWalls;
    sfx.osClick?.();
    return this.portalWalls;
  }

  _spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    for (const tp of this.teleporters) {
      occupied.add(`${tp.x},${tp.y}`);
    }
    for (let tries = 0; tries < 80; tries++) {
      const rx = Math.floor(Math.random() * this.cols);
      const ry = Math.floor(Math.random() * this.rows);
      if (!occupied.has(`${rx},${ry}`)) {
        this.food = { x: rx, y: ry, kind: 'normal' };
        return;
      }
    }
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!occupied.has(`${x},${y}`)) {
          this.food = { x, y, kind: 'normal' };
          return;
        }
      }
    }
  }

  _spawnBonusFood() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    occupied.add(`${this.food.x},${this.food.y}`);
    for (let tries = 0; tries < 50; tries++) {
      const rx = Math.floor(Math.random() * this.cols);
      const ry = Math.floor(Math.random() * this.rows);
      if (!occupied.has(`${rx},${ry}`)) {
        this.bonusFood = { x: rx, y: ry, ttl: 9.0 };
        return;
      }
    }
  }

  stepTick() {
    if (this.gameOver || this.paused) return false;
    this.dir = { ...this.nextDir };
    const head = this.snake[0];
    let nx = head.x + this.dir.x;
    let ny = head.y + this.dir.y;

    if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) {
      if (this.portalWalls) {
        nx = (nx + this.cols) % this.cols;
        ny = (ny + this.rows) % this.rows;
        sfx.arcadeBeep?.(520, 0.03, 'sine');
      } else {
        this.forceGameOver();
        return false;
      }
    }

    for (const tp of this.teleporters) {
      if (nx === tp.x && ny === tp.y) {
        nx = tp.pairX;
        ny = tp.pairY;
        sfx.arcadeBeep?.(880, 0.04, 'sine');
        break;
      }
    }

    const hitsBody = this.snake.slice(0, -1).some((seg) => seg.x === nx && seg.y === ny);
    if (hitsBody) {
      this.forceGameOver();
      return false;
    }

    this.snake.unshift({ x: nx, y: ny });

    if (nx === this.food.x && ny === this.food.y) {
      const mult = this.boostRemaining > 0 ? 2 : 1;
      this.addScore(10 * mult);
      sfx.arcadeBeep?.(740, 0.05, 'square');
      this._spawnFood();
      if (!this.bonusFood && this.snake.length % 3 === 0) {
        this._spawnBonusFood();
      }
    } else if (this.bonusFood && nx === this.bonusFood.x && ny === this.bonusFood.y) {
      this.addScore(30);
      this.boostRemaining = 6.0;
      this.bonusFood = null;
      sfx.arcadePowerup?.();
    } else {
      this.snake.pop();
    }

    return true;
  }

  update(dt = 0.016) {
    if (this.gameOver || this.paused) return;
    const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0.016));
    if (this.stickCooldown > 0) {
      this.stickCooldown = Math.max(0, this.stickCooldown - safeDt);
    }
    if (this.boostRemaining > 0) {
      this.boostRemaining = Math.max(0, this.boostRemaining - safeDt);
    }
    if (this.bonusFood) {
      this.bonusFood.ttl -= safeDt;
      if (this.bonusFood.ttl <= 0) {
        this.bonusFood = null;
      }
    }
    const interval = this.boostRemaining > 0 ? 0.082 : Math.max(0.075, this.baseStepInterval - Math.min(0.045, this.score * 0.0002));
    this.stepAccum += safeDt;
    while (this.stepAccum >= interval && !this.gameOver) {
      this.stepAccum -= interval;
      this.stepTick();
    }
  }

  handleKeyDown(code) {
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') {
      return this.setDirection(0, -1);
    }
    if (code === 'ArrowDown' || code === 'KeyS') {
      return this.setDirection(0, 1);
    }
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') {
      return this.setDirection(-1, 0);
    }
    if (code === 'ArrowRight' || code === 'KeyD') {
      return this.setDirection(1, 0);
    }
    if (code === 'Space') {
      if (this.gameOver) this.reset();
      else this.paused = !this.paused;
      return true;
    }
    if (code === 'KeyR') {
      this.reset();
      return true;
    }
    return false;
  }

  handleThumbstick(lx, ly) {
    if (Math.hypot(lx, ly) < 0.45) return false;
    if (Math.abs(lx) > Math.abs(ly)) {
      return this.setDirection(lx > 0 ? 1 : -1, 0);
    }
    return this.setDirection(0, ly > 0 ? 1 : -1);
  }

  handlePointerDown() {
    if (this.gameOver) {
      this.reset();
      return true;
    }
    return false;
  }

  handlePointerMove() {}
  handlePointerUp() {}

  render(ctx, rect, addHitBox, hoveredId) {
    const { x, y, w, h } = rect;
    const ctrlW = 190;
    const boardAreaW = w - ctrlW - 18;
    const cellW = Math.floor((boardAreaW - 16) / this.cols);
    const cellH = Math.floor((h - 24) / this.rows);
    const cell = Math.max(14, Math.min(cellW, cellH));
    const gridW = cell * this.cols;
    const gridH = cell * this.rows;
    const gx = x + 10;
    const gy = y + Math.floor((h - gridH) / 2);

    if (ctx) {
      drawRoundRect(ctx, gx, gy, gridW, gridH, 8);
      ctx.fillStyle = '#040d1a';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.portalWalls ? '#22d3ee' : '#f43f5e';
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let c = 1; c < this.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(gx + c * cell, gy);
        ctx.lineTo(gx + c * cell, gy + gridH);
        ctx.stroke();
      }
      for (let r = 1; r < this.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(gx, gy + r * cell);
        ctx.lineTo(gx + gridW, gy + r * cell);
        ctx.stroke();
      }

      for (const tp of this.teleporters) {
        const tx = gx + tp.x * cell + cell / 2;
        const ty = gy + tp.y * cell + cell / 2;
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(tx, ty, cell * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }

      const fx = gx + this.food.x * cell + cell / 2;
      const fy = gy + this.food.y * cell + cell / 2;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(fx, fy, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();

      if (this.bonusFood) {
        const bx = gx + this.bonusFood.x * cell + cell / 2;
        const by = gy + this.bonusFood.y * cell + cell / 2;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      this.snake.forEach((seg, idx) => {
        const sx = gx + seg.x * cell + 2;
        const sy = gy + seg.y * cell + 2;
        drawRoundRect(ctx, sx, sy, cell - 4, cell - 4, idx === 0 ? 6 : 4);
        ctx.fillStyle =
          idx === 0
            ? this.boostRemaining > 0
              ? '#fbbf24'
              : '#34d399'
            : this.boostRemaining > 0
              ? '#f59e0b'
              : '#10b981';
        ctx.fill();
      });

      if (this.gameOver) {
        drawRoundRect(ctx, gx + 30, gy + gridH / 2 - 54, gridW - 60, 108, 12);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥 CONNEXION INTERROMPUE (GAME OVER)', gx + gridW / 2, gy + gridH / 2 - 14);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(`Score : ${this.score} pts • Record : ${this.highScore} pts`, gx + gridW / 2, gy + gridH / 2 + 12);
        if (this.lastCoinsEarned > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`+${this.lastCoinsEarned} 🪙 CC`, gx + gridW / 2, gy + gridH / 2 + 38);
        }
        ctx.textAlign = 'left';
      }
    }

    const px = x + w - ctrlW - 6;
    const py = y + 12;
    if (ctx) {
      drawRoundRect(ctx, px, py, ctrlW, h - 24, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`SCORE : ${this.score}`, px + 14, py + 28);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`RECORD : ${this.highScore}`, px + 14, py + 50);
      ctx.fillStyle = this.boostRemaining > 0 ? '#fde047' : '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(
        this.boostRemaining > 0
          ? `⚡ TURBO ACTIF (${this.boostRemaining.toFixed(1)}s)`
          : `Longueur : ${this.snake.length} paquets`,
        px + 14,
        py + 70
      );
    }

    const dpadCx = px + Math.floor(ctrlW / 2);
    const dpadCy = py + 150;
    const bSz = 44;
    drawUiBtn(ctx, addHitBox, hoveredId, 'snake_up', dpadCx - bSz / 2, dpadCy - bSz - 4, bSz, bSz, '▲', {
      primary: true,
      onClick: () => this.setDirection(0, -1)
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'snake_left', dpadCx - bSz - 26, dpadCy, bSz, bSz, '◀', {
      primary: true,
      onClick: () => this.setDirection(-1, 0)
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'snake_right', dpadCx + 26, dpadCy, bSz, bSz, '▶', {
      primary: true,
      onClick: () => this.setDirection(1, 0)
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'snake_down', dpadCx - bSz / 2, dpadCy + bSz + 4, bSz, bSz, '▼', {
      primary: true,
      onClick: () => this.setDirection(0, 1)
    });

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'snake_portal',
      px + 12,
      py + 256,
      ctrlW - 24,
      34,
      this.portalWalls ? '🌀 Bordures : Portails' : '🧱 Bordures : Murs',
      {
        active: this.portalWalls,
        fontSize: 12,
        onClick: () => this.togglePortalMode()
      }
    );

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'snake_pause',
      px + 12,
      py + 298,
      ctrlW - 24,
      34,
      this.paused ? '▶ Reprendre' : '⏸ Pause',
      {
        fontSize: 13,
        onClick: () => {
          this.paused = !this.paused;
          sfx.osClick?.();
        }
      }
    );

    drawUiBtn(ctx, addHitBox, hoveredId, 'snake_reset', px + 12, py + 340, ctrlW - 24, 36, '🔄 Nouvelle Partie', {
      primary: true,
      fontSize: 13,
      onClick: () => {
        sfx.osClick?.();
        this.reset();
      }
    });
  }
}

export class CielMinesweeperGame {
  constructor(options = {}) {
    this.id = 'minesweeper';
    this.title = 'Démineur CIEL';
    this.icon = '💣';
    this.onScoreChange = options.onScoreChange || null;
    this.onGameEnd = options.onGameEnd || null;
    this.highScore = Number(options.initialHighScore) || 0;
    this.difficulty = 'easy';
    this.flagMode = false;
    this.reset('easy');
  }

  setDifficulty(diff = 'easy') {
    this.difficulty = diff === 'medium' ? 'medium' : 'easy';
    this.reset(this.difficulty);
  }

  reset(diff = this.difficulty) {
    this.difficulty = diff === 'medium' ? 'medium' : 'easy';
    if (this.difficulty === 'medium') {
      this.cols = 12;
      this.rows = 10;
      this.mineCount = 20;
    } else {
      this.cols = 8;
      this.rows = 8;
      this.mineCount = 10;
    }
    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          r,
          c,
          mine: false,
          revealed: false,
          flagged: false,
          neighbors: 0
        });
      }
      this.board.push(row);
    }
    this.minesPlaced = false;
    this.revealedCount = 0;
    this.flagCount = 0;
    this.elapsedSec = 0;
    this.score = 0;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this._endReported = false;
    this.lastCoinsEarned = 0;
    this._placeInitialMines();
    this._notifyScore();
  }

  _placeInitialMines(excludeR = -1, excludeC = -1) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.board[r][c].mine = false;
        this.board[r][c].neighbors = 0;
      }
    }
    let placed = 0;
    let guard = 0;
    while (placed < this.mineCount && guard < 1000) {
      guard++;
      const rr = Math.floor(Math.random() * this.rows);
      const cc = Math.floor(Math.random() * this.cols);
      if (rr === excludeR && cc === excludeC) continue;
      if (this.board[rr][cc].mine) continue;
      this.board[rr][cc].mine = true;
      placed++;
    }
    this._recomputeNeighbors();
    this.minesPlaced = true;
  }

  _recomputeNeighbors() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].mine) {
          this.board[r][c].neighbors = -1;
          continue;
        }
        let cnt = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc].mine) {
              cnt++;
            }
          }
        }
        this.board[r][c].neighbors = cnt;
      }
    }
  }

  _notifyScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.onScoreChange?.(this.id, this.score, this.highScore);
  }

  _emitGameEnd(won = false) {
    if (this._endReported) return;
    this._endReported = true;
    const reward = computeArcadeCoinReward({
      gameId: this.id,
      score: this.score,
      isNewRecord: this.score > 0 && this.score >= this.highScore
    });
    this.lastCoinsEarned = reward.totalCoins;
    this.onGameEnd?.(this.id, this.score, {
      won: Boolean(won),
      highScore: this.highScore,
      estimatedCoins: this.lastCoinsEarned
    });
  }

  toggleFlag(r, c) {
    if (this.gameOver || this.won) return false;
    const cell = this.board[r]?.[c];
    if (!cell || cell.revealed) return false;
    cell.flagged = !cell.flagged;
    this.flagCount += cell.flagged ? 1 : -1;
    sfx.arcadeBeep?.(cell.flagged ? 820 : 540, 0.04, 'triangle');
    return cell.flagged;
  }

  revealCell(r, c) {
    if (this.gameOver || this.won) return false;
    const cell = this.board[r]?.[c];
    if (!cell || cell.revealed || cell.flagged) return false;

    if (this.revealedCount === 0 && cell.mine) {
      cell.mine = false;
      outer: for (let rr = 0; rr < this.rows; rr++) {
        for (let cc = 0; cc < this.cols; cc++) {
          if ((rr !== r || cc !== c) && !this.board[rr][cc].mine) {
            this.board[rr][cc].mine = true;
            break outer;
          }
        }
      }
      this._recomputeNeighbors();
    }

    if (cell.mine) {
      cell.revealed = true;
      for (let rr = 0; rr < this.rows; rr++) {
        for (let cc = 0; cc < this.cols; cc++) {
          if (this.board[rr][cc].mine) this.board[rr][cc].revealed = true;
        }
      }
      this.gameOver = true;
      sfx.arcadeGameOver?.();
      this._notifyScore();
      this._emitGameEnd(false);
      return false;
    }

    const stack = [[r, c]];
    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      const cur = this.board[cr]?.[cc];
      if (!cur || cur.revealed || cur.flagged || cur.mine) continue;
      cur.revealed = true;
      this.revealedCount++;
      this.score += 10;
      if (cur.neighbors === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !this.board[nr][nc].revealed) {
              stack.push([nr, nc]);
            }
          }
        }
      }
    }

    let actualMines = 0;
    for (let rr = 0; rr < this.rows; rr++) {
      for (let cc = 0; cc < this.cols; cc++) {
        if (this.board[rr][cc].mine) actualMines++;
      }
    }
    const totalSafe = this.rows * this.cols - actualMines;
    if (this.revealedCount >= totalSafe) {
      this.won = true;
      this.gameOver = true;
      const bonus = (this.difficulty === 'medium' ? 250 : 120) + Math.max(0, 120 - Math.floor(this.elapsedSec));
      this.score += bonus;
      sfx.arcadeVictory?.();
      this._notifyScore();
      this._emitGameEnd(true);
    } else {
      sfx.arcadeBeep?.(640, 0.035, 'sine');
      this._notifyScore();
    }

    return true;
  }

  update(dt = 0.016) {
    if (this.gameOver || this.won || this.revealedCount === 0) return;
    this.elapsedSec += Math.max(0, Math.min(0.25, Number(dt) || 0.016));
  }

  handleKeyDown(code) {
    if (code === 'KeyF') {
      this.flagMode = !this.flagMode;
      sfx.osClick?.();
      return true;
    }
    if (code === 'KeyR') {
      this.reset();
      return true;
    }
    return false;
  }

  handleThumbstick() {
    return false;
  }

  handlePointerDown(localX, localY, rect, button = 0) {
    if (!this._lastGridGeom) return false;
    const { gx, gy, cell, cols, rows } = this._lastGridGeom;
    if (localX >= gx && localX < gx + cols * cell && localY >= gy && localY < gy + rows * cell) {
      const c = Math.floor((localX - gx) / cell);
      const r = Math.floor((localY - gy) / cell);
      if (button === 2 || this.flagMode) {
        return this.toggleFlag(r, c);
      }
      return this.revealCell(r, c);
    }
    return false;
  }

  handlePointerMove() {}
  handlePointerUp() {}

  render(ctx, rect, addHitBox, hoveredId) {
    const { x, y, w, h } = rect;
    const ctrlW = 200;
    const boardW = w - ctrlW - 18;
    const cellW = Math.floor((boardW - 16) / this.cols);
    const cellH = Math.floor((h - 24) / this.rows);
    const cell = Math.max(22, Math.min(cellW, cellH));
    const gridW = cell * this.cols;
    const gridH = cell * this.rows;
    const gx = x + Math.floor((boardW - gridW) / 2) + 8;
    const gy = y + Math.floor((h - gridH) / 2);
    this._lastGridGeom = { gx, gy, cell, cols: this.cols, rows: this.rows };

    const numColors = ['#94a3b8', '#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#f59e0b', '#22d3ee', '#e2e8f0', '#fb7185'];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const item = this.board[r][c];
        const cx = gx + c * cell;
        const cy = gy + r * cell;
        const btnId = `mine_${r}_${c}`;
        const isHov = hoveredId === btnId;

        if (ctx) {
          drawRoundRect(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, 5);
          if (item.revealed) {
            ctx.fillStyle = item.mine ? '#7f1d1d' : '#0f172a';
            ctx.fill();
            ctx.strokeStyle = item.mine ? '#f43f5e' : '#1e293b';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (item.mine) {
              ctx.font = `${Math.floor(cell * 0.56)}px system-ui, sans-serif`;
              ctx.fillText('💣', cx + cell / 2, cy + cell / 2);
            } else if (item.neighbors > 0) {
              ctx.fillStyle = numColors[item.neighbors] || '#f8fafc';
              ctx.font = `bold ${Math.floor(cell * 0.52)}px monospace`;
              ctx.fillText(String(item.neighbors), cx + cell / 2, cy + cell / 2);
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          } else {
            ctx.fillStyle = isHov ? '#0284c7' : item.flagged ? '#1e3a5f' : '#1e293b';
            ctx.fill();
            ctx.strokeStyle = isHov ? '#38bdf8' : '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (item.flagged) {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = `${Math.floor(cell * 0.52)}px system-ui, sans-serif`;
              ctx.fillText('🚩', cx + cell / 2, cy + cell / 2);
              ctx.textAlign = 'left';
              ctx.textBaseline = 'alphabetic';
            }
          }
        }

        if (typeof addHitBox === 'function') {
          addHitBox({
            id: btnId,
            x: cx,
            y: cy,
            w: cell,
            h: cell,
            onClick: () => {
              if (this.flagMode) this.toggleFlag(r, c);
              else this.revealCell(r, c);
            }
          });
        }
      }
    }

    const px = x + w - ctrlW - 6;
    const py = y + 12;
    if (ctx) {
      drawRoundRect(ctx, px, py, ctrlW, h - 24, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`SCORE : ${this.score}`, px + 14, py + 28);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`⏱ TEMPS : ${Math.floor(this.elapsedSec)}s`, px + 14, py + 52);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`💣 MINES : ${Math.max(0, this.mineCount - this.flagCount)}`, px + 14, py + 74);

      if (this.won || this.gameOver) {
        ctx.fillStyle = this.won ? '#34d399' : '#fda4af';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText(this.won ? '🏆 SECTEUR SÉCURISÉ !' : '💥 INTRUSION DÉTECTÉE !', px + 14, py + 98);
        if (this.lastCoinsEarned > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`+${this.lastCoinsEarned} 🪙 CC`, px + 14, py + 112);
        }
      }
    }

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'mine_flag_toggle',
      px + 12,
      py + 114,
      ctrlW - 24,
      42,
      this.flagMode ? '🚩 Mode : DRAPEAU (ON)' : '⛏️ Mode : RÉVÉLER',
      {
        active: this.flagMode,
        primary: !this.flagMode,
        fontSize: 13,
        onClick: () => {
          this.flagMode = !this.flagMode;
          sfx.osClick?.();
        }
      }
    );

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'mine_diff_easy',
      px + 12,
      py + 168,
      ctrlW - 24,
      36,
      '🟢 Facile (8×8 • 10 mines)',
      {
        active: this.difficulty === 'easy',
        fontSize: 12,
        onClick: () => {
          sfx.osClick?.();
          this.setDifficulty('easy');
        }
      }
    );

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'mine_diff_medium',
      px + 12,
      py + 212,
      ctrlW - 24,
      36,
      '🟠 Moyen (12×10 • 20 mines)',
      {
        active: this.difficulty === 'medium',
        fontSize: 12,
        onClick: () => {
          sfx.osClick?.();
          this.setDifficulty('medium');
        }
      }
    );

    drawUiBtn(ctx, addHitBox, hoveredId, 'mine_reset', px + 12, py + 266, ctrlW - 24, 40, '🔄 Nouvelle Grille', {
      primary: true,
      fontSize: 13,
      onClick: () => {
        sfx.osClick?.();
        this.reset();
      }
    });
  }
}

const TETROMINO_DEFS = [
  { id: 'I', color: '#22d3ee', matrix: [[1, 1, 1, 1]] },
  { id: 'O', color: '#fbbf24', matrix: [[1, 1], [1, 1]] },
  { id: 'T', color: '#a855f7', matrix: [[0, 1, 0], [1, 1, 1]] },
  { id: 'S', color: '#34d399', matrix: [[0, 1, 1], [1, 1, 0]] },
  { id: 'Z', color: '#f43f5e', matrix: [[1, 1, 0], [0, 1, 1]] },
  { id: 'J', color: '#3b82f6', matrix: [[1, 0, 0], [1, 1, 1]] },
  { id: 'L', color: '#fb923c', matrix: [[0, 0, 1], [1, 1, 1]] }
];

function rotateMatrixCW(mat) {
  const rows = mat.length;
  const cols = mat[0].length;
  const out = [];
  for (let c = 0; c < cols; c++) {
    const newRow = [];
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(mat[r][c]);
    }
    out.push(newRow);
  }
  return out;
}

export class CielBlocksGame {
  constructor(options = {}) {
    this.id = 'tetris';
    this.title = 'CIEL-Blocks';
    this.icon = '🧱';
    this.cols = 10;
    this.rows = 18;
    this.onScoreChange = options.onScoreChange || null;
    this.onGameEnd = options.onGameEnd || null;
    this.highScore = Number(options.initialHighScore) || 0;
    this.stickCooldown = 0;
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this._endReported = false;
    this.lastCoinsEarned = 0;
    this.dropAccum = 0;
    this.nextPiece = this._randomDef();
    this._spawnPiece();
    this._notifyScore();
  }

  _randomDef() {
    const def = TETROMINO_DEFS[Math.floor(Math.random() * TETROMINO_DEFS.length)];
    return {
      id: def.id,
      color: def.color,
      matrix: def.matrix.map((r) => [...r])
    };
  }

  _notifyScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.onScoreChange?.(this.id, this.score, this.highScore);
  }

  _emitGameEnd(won = false) {
    if (this._endReported) return;
    this._endReported = true;
    const reward = computeArcadeCoinReward({
      gameId: this.id,
      score: this.score,
      isNewRecord: this.score > 0 && this.score >= this.highScore
    });
    this.lastCoinsEarned = reward.totalCoins;
    this.onGameEnd?.(this.id, this.score, {
      won: Boolean(won),
      highScore: this.highScore,
      estimatedCoins: this.lastCoinsEarned
    });
  }

  _spawnPiece() {
    const cur = this.nextPiece || this._randomDef();
    this.nextPiece = this._randomDef();
    this.current = {
      id: cur.id,
      color: cur.color,
      matrix: cur.matrix.map((r) => [...r]),
      x: Math.floor((this.cols - cur.matrix[0].length) / 2),
      y: 0
    };
    if (this._collides(this.current.matrix, this.current.x, this.current.y)) {
      this.gameOver = true;
      sfx.arcadeGameOver?.();
      this._notifyScore();
      this._emitGameEnd(false);
    }
  }

  _collides(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const gx = px + c;
        const gy = py + r;
        if (gx < 0 || gx >= this.cols || gy >= this.rows) return true;
        if (gy >= 0 && this.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  moveHorizontal(dx) {
    if (this.gameOver || this.paused || !this.current) return false;
    const nx = this.current.x + Math.sign(dx);
    if (!this._collides(this.current.matrix, nx, this.current.y)) {
      this.current.x = nx;
      sfx.arcadeBeep?.(480, 0.025, 'triangle');
      return true;
    }
    return false;
  }

  rotatePiece() {
    if (this.gameOver || this.paused || !this.current) return false;
    const rotated = rotateMatrixCW(this.current.matrix);
    for (const kickX of [0, -1, 1, -2, 2]) {
      if (!this._collides(rotated, this.current.x + kickX, this.current.y)) {
        this.current.matrix = rotated;
        this.current.x += kickX;
        sfx.arcadeBeep?.(690, 0.035, 'sine');
        return true;
      }
    }
    return false;
  }

  softDrop() {
    if (this.gameOver || this.paused || !this.current) return false;
    if (!this._collides(this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y += 1;
      return true;
    }
    this._lockPiece();
    return false;
  }

  hardDrop() {
    if (this.gameOver || this.paused || !this.current) return 0;
    let dropped = 0;
    while (!this._collides(this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y += 1;
      dropped++;
    }
    this.score += dropped * 2;
    this._lockPiece();
    this._notifyScore();
    return dropped;
  }

  _lockPiece() {
    const { matrix, x, y, color } = this.current;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const gy = y + r;
        const gx = x + c;
        if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols) {
          this.grid[gy][gx] = color;
        }
      }
    }
    let cleared = 0;
    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.grid[r].every((cell) => Boolean(cell))) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(this.cols).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      const lineScores = [0, 100, 300, 500, 800];
      this.lines += cleared;
      this.level = 1 + Math.floor(this.lines / 5);
      this.score += (lineScores[cleared] || 800) * this.level;
      sfx.arcadePowerup?.();
    } else {
      this.score += 10;
      sfx.arcadeBeep?.(340, 0.03, 'triangle');
    }
    this._notifyScore();
    this._spawnPiece();
  }

  getDropInterval() {
    return Math.max(0.14, 0.65 - (this.level - 1) * 0.06);
  }

  update(dt = 0.016) {
    if (this.gameOver || this.paused) return;
    const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0.016));
    if (this.stickCooldown > 0) {
      this.stickCooldown = Math.max(0, this.stickCooldown - safeDt);
    }
    this.dropAccum += safeDt;
    const interval = this.getDropInterval();
    while (this.dropAccum >= interval && !this.gameOver) {
      this.dropAccum -= interval;
      this.softDrop();
    }
  }

  handleKeyDown(code) {
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') return this.moveHorizontal(-1);
    if (code === 'ArrowRight' || code === 'KeyD') return this.moveHorizontal(1);
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') return this.rotatePiece();
    if (code === 'ArrowDown' || code === 'KeyS') {
      this.score += 1;
      this._notifyScore();
      return this.softDrop();
    }
    if (code === 'Space') {
      if (this.gameOver) this.reset();
      else this.hardDrop();
      return true;
    }
    if (code === 'KeyR') {
      this.reset();
      return true;
    }
    return false;
  }

  handleThumbstick(lx, ly) {
    if (this.stickCooldown > 0) return false;
    if (Math.abs(lx) > 0.55) {
      this.stickCooldown = 0.16;
      return this.moveHorizontal(lx > 0 ? 1 : -1);
    }
    if (ly < -0.65) {
      this.stickCooldown = 0.24;
      return this.rotatePiece();
    }
    if (ly > 0.65) {
      this.stickCooldown = 0.12;
      return this.softDrop();
    }
    return false;
  }

  handlePointerDown() {
    if (this.gameOver) {
      this.reset();
      return true;
    }
    return false;
  }

  handlePointerMove() {}
  handlePointerUp() {}

  render(ctx, rect, addHitBox, hoveredId) {
    const { x, y, w, h } = rect;
    const cell = Math.max(15, Math.floor((h - 20) / this.rows));
    const gridW = cell * this.cols;
    const gridH = cell * this.rows;
    const gx = x + 28;
    const gy = y + Math.floor((h - gridH) / 2);

    if (ctx) {
      drawRoundRect(ctx, gx - 2, gy - 2, gridW + 4, gridH + 4, 6);
      ctx.fillStyle = '#040a17';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cx = gx + c * cell;
          const cy = gy + r * cell;
          const fill = this.grid[r][c];
          if (fill) {
            drawRoundRect(ctx, cx + 1, cy + 1, cell - 2, cell - 2, 3);
            ctx.fillStyle = fill;
            ctx.fill();
          } else {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
            ctx.strokeRect(cx, cy, cell, cell);
          }
        }
      }

      if (this.current && !this.gameOver) {
        let ghostY = this.current.y;
        while (!this._collides(this.current.matrix, this.current.x, ghostY + 1)) {
          ghostY++;
        }
        const { matrix, x: px, y: py, color } = this.current;
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            if (!matrix[r][c]) continue;
            if (ghostY !== py) {
              ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
              ctx.strokeRect(gx + (px + c) * cell + 2, gy + (ghostY + r) * cell + 2, cell - 4, cell - 4);
            }
            drawRoundRect(ctx, gx + (px + c) * cell + 1, gy + (py + r) * cell + 1, cell - 2, cell - 2, 3);
            ctx.fillStyle = color;
            ctx.fill();
          }
        }
      }

      if (this.gameOver) {
        drawRoundRect(ctx, gx + 10, gy + gridH / 2 - 44, gridW - 20, 88, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.stroke();
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PILE SATURÉE !', gx + gridW / 2, gy + gridH / 2 - 8);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText(`Score : ${this.score}`, gx + gridW / 2, gy + gridH / 2 + 12);
        if (this.lastCoinsEarned > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`+${this.lastCoinsEarned} 🪙 CC`, gx + gridW / 2, gy + gridH / 2 + 34);
        }
        ctx.textAlign = 'left';
      }
    }

    const px = gx + gridW + 24;
    const pw = Math.max(210, x + w - px - 12);
    const py = y + 12;

    if (ctx) {
      drawRoundRect(ctx, px, py, pw, h - 24, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`SCORE : ${this.score}`, px + 16, py + 26);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`RECORD : ${this.highScore}`, px + 16, py + 48);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`LIGNES : ${this.lines}  •  NIV. ${this.level}`, px + 16, py + 70);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('SUIVANT :', px + 16, py + 94);
      if (this.nextPiece) {
        const nm = this.nextPiece.matrix;
        const pCell = 16;
        for (let r = 0; r < nm.length; r++) {
          for (let c = 0; c < nm[r].length; c++) {
            if (!nm[r][c]) continue;
            drawRoundRect(ctx, px + 96 + c * pCell, py + 80 + r * pCell, pCell - 2, pCell - 2, 3);
            ctx.fillStyle = this.nextPiece.color;
            ctx.fill();
          }
        }
      }
    }

    const btnW = Math.floor((pw - 36) / 3);
    drawUiBtn(ctx, addHitBox, hoveredId, 'tet_left', px + 12, py + 132, btnW, 42, '◀', {
      primary: true,
      fontSize: 18,
      onClick: () => this.moveHorizontal(-1)
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'tet_rot', px + 18 + btnW, py + 132, btnW, 42, '↻', {
      active: true,
      fontSize: 18,
      onClick: () => this.rotatePiece()
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'tet_right', px + 24 + btnW * 2, py + 132, btnW, 42, '▶', {
      primary: true,
      fontSize: 18,
      onClick: () => this.moveHorizontal(1)
    });

    const halfW = Math.floor((pw - 30) / 2);
    drawUiBtn(ctx, addHitBox, hoveredId, 'tet_soft', px + 12, py + 184, halfW, 40, '▼ Descendre', {
      fontSize: 13,
      onClick: () => this.softDrop()
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'tet_drop', px + 18 + halfW, py + 184, halfW, 40, '⏬ Chute Directe', {
      primary: true,
      fontSize: 13,
      onClick: () => this.hardDrop()
    });

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'tet_pause',
      px + 12,
      py + 236,
      pw - 24,
      36,
      this.paused ? '▶ Reprendre' : '⏸ Pause',
      {
        fontSize: 13,
        onClick: () => {
          this.paused = !this.paused;
          sfx.osClick?.();
        }
      }
    );

    drawUiBtn(ctx, addHitBox, hoveredId, 'tet_reset', px + 12, py + 282, pw - 24, 38, '🔄 Rejouer', {
      primary: true,
      fontSize: 13,
      onClick: () => {
        sfx.osClick?.();
        this.reset();
      }
    });
  }
}

export class NetworkBreakoutGame {
  constructor(options = {}) {
    this.id = 'breakout';
    this.title = 'Casse-Briques Réseau';
    this.icon = '🛡️';
    this.worldW = 540;
    this.worldH = 360;
    this.onScoreChange = options.onScoreChange || null;
    this.onGameEnd = options.onGameEnd || null;
    this.highScore = Number(options.initialHighScore) || 0;
    this.reset();
  }

  reset() {
    this.paddle = { x: this.worldW / 2 - 48, y: this.worldH - 26, w: 96, h: 12 };
    this.balls = [
      {
        x: this.worldW / 2,
        y: this.worldH - 42,
        vx: 165,
        vy: -215,
        r: 6
      }
    ];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this._endReported = false;
    this.lastCoinsEarned = 0;
    this._buildBricks();
    this._notifyScore();
  }

  _buildBricks() {
    this.bricks = [];
    const cols = 8;
    const rows = 5;
    const padX = 18;
    const padY = 24;
    const gap = 6;
    const bw = Math.floor((this.worldW - padX * 2 - gap * (cols - 1)) / cols);
    const bh = 20;

    for (let r = 0; r < rows; r++) {
      const maxHp = r === 0 ? 3 : r <= 2 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        this.bricks.push({
          x: padX + c * (bw + gap),
          y: padY + r * (bh + gap),
          w: bw,
          h: bh,
          hp: maxHp,
          maxHp,
          multiBallBonus: (r === 2 && (c === 2 || c === 5)) || (r === 4 && c === 4)
        });
      }
    }
  }

  _notifyScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.onScoreChange?.(this.id, this.score, this.highScore);
  }

  _emitGameEnd(won = false) {
    if (this._endReported) return;
    this._endReported = true;
    const reward = computeArcadeCoinReward({
      gameId: this.id,
      score: this.score,
      isNewRecord: this.score > 0 && this.score >= this.highScore
    });
    this.lastCoinsEarned = reward.totalCoins;
    this.onGameEnd?.(this.id, this.score, {
      won: Boolean(won),
      highScore: this.highScore,
      estimatedCoins: this.lastCoinsEarned
    });
  }

  setPaddleRatio(ratio) {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0.5));
    this.paddle.x = clamped * (this.worldW - this.paddle.w);
  }

  movePaddle(dx) {
    this.paddle.x = Math.max(0, Math.min(this.worldW - this.paddle.w, this.paddle.x + dx));
  }

  spawnMultiBall() {
    if (this.balls.length >= 6) return false;
    const ref = this.balls[0] || { x: this.paddle.x + this.paddle.w / 2, y: this.paddle.y - 14, r: 6 };
    this.balls.push(
      { x: ref.x, y: ref.y, vx: -185, vy: -210, r: 6 },
      { x: ref.x, y: ref.y, vx: 185, vy: -210, r: 6 }
    );
    sfx.arcadePowerup?.();
    return true;
  }

  update(dt = 0.016) {
    if (this.gameOver || this.paused) return;
    const safeDt = Math.max(0, Math.min(0.05, Number(dt) || 0.016));

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.x += b.vx * safeDt;
      b.y += b.vy * safeDt;

      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
      } else if (b.x + b.r > this.worldW) {
        b.x = this.worldW - b.r;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
      }

      if (
        b.vy > 0 &&
        b.y + b.r >= this.paddle.y &&
        b.y - b.r <= this.paddle.y + this.paddle.h &&
        b.x >= this.paddle.x - 4 &&
        b.x <= this.paddle.x + this.paddle.w + 4
      ) {
        const hitOffset = (b.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
        const speed = Math.min(360, Math.hypot(b.vx, b.vy) * 1.02);
        const angle = hitOffset * 1.05;
        b.vx = Math.sin(angle) * speed;
        b.vy = -Math.cos(angle) * speed;
        b.y = this.paddle.y - b.r - 1;
        sfx.arcadeBeep?.(540, 0.03, 'triangle');
      }

      for (const br of this.bricks) {
        if (br.hp <= 0) continue;
        if (
          b.x + b.r >= br.x &&
          b.x - b.r <= br.x + br.w &&
          b.y + b.r >= br.y &&
          b.y - b.r <= br.y + br.h
        ) {
          br.hp -= 1;
          b.vy = -b.vy;
          this.score += br.hp <= 0 ? 25 : 10;
          if (br.hp <= 0 && br.multiBallBonus) {
            this.spawnMultiBall();
          } else {
            sfx.arcadeBeep?.(br.hp <= 0 ? 840 : 620, 0.035, 'square');
          }
          this._notifyScore();
          break;
        }
      }

      if (b.y - b.r > this.worldH) {
        this.balls.splice(i, 1);
      }
    }

    if (this.bricks.every((br) => br.hp <= 0)) {
      this.wave += 1;
      this.score += 150;
      this.won = true;
      sfx.arcadeVictory?.();
      this._buildBricks();
      this._notifyScore();
    }

    if (this.balls.length === 0) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.gameOver = true;
        sfx.arcadeGameOver?.();
        this._notifyScore();
        this._emitGameEnd(false);
      } else {
        this.balls.push({
          x: this.paddle.x + this.paddle.w / 2,
          y: this.paddle.y - 14,
          vx: 165 * (Math.random() > 0.5 ? 1 : -1),
          vy: -215,
          r: 6
        });
      }
    }
  }

  handleKeyDown(code) {
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') {
      this.movePaddle(-34);
      return true;
    }
    if (code === 'ArrowRight' || code === 'KeyD') {
      this.movePaddle(34);
      return true;
    }
    if (code === 'Space') {
      if (this.gameOver) this.reset();
      else this.spawnMultiBall();
      return true;
    }
    if (code === 'KeyR') {
      this.reset();
      return true;
    }
    return false;
  }

  handleThumbstick(lx, _ly, dt = 0.016) {
    if (Math.abs(lx) > 0.15) {
      this.movePaddle(lx * 340 * dt);
      return true;
    }
    return false;
  }

  handlePointerDown(localX, _localY, rect) {
    if (this.gameOver) {
      this.reset();
      return true;
    }
    const arenaW = rect.w - 196;
    if (localX >= rect.x && localX <= rect.x + arenaW) {
      this.setPaddleRatio((localX - rect.x) / Math.max(1, arenaW));
      return true;
    }
    return false;
  }

  handlePointerMove(localX, _localY, rect) {
    const arenaW = rect.w - 196;
    if (localX >= rect.x && localX <= rect.x + arenaW) {
      this.setPaddleRatio((localX - rect.x) / Math.max(1, arenaW));
    }
  }

  handlePointerUp() {}

  render(ctx, rect, addHitBox, hoveredId) {
    const { x, y, w, h } = rect;
    const ctrlW = 186;
    const arenaW = w - ctrlW - 18;
    const arenaH = h - 20;
    const ax = x + 8;
    const ay = y + 10;
    const sx = arenaW / this.worldW;
    const sy = arenaH / this.worldH;

    if (ctx) {
      drawRoundRect(ctx, ax, ay, arenaW, arenaH, 8);
      ctx.fillStyle = '#040b18';
      ctx.fill();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (const br of this.bricks) {
        if (br.hp <= 0) continue;
        const bx = ax + br.x * sx;
        const by = ay + br.y * sy;
        const bw = br.w * sx;
        const bh = br.h * sy;
        drawRoundRect(ctx, bx, by, bw, bh, 4);
        ctx.fillStyle =
          br.hp === 3
            ? '#f43f5e'
            : br.hp === 2
              ? '#f59e0b'
              : br.multiBallBonus
                ? '#a855f7'
                : '#38bdf8';
        ctx.fill();
        if (br.multiBallBonus) {
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡×3', bx + bw / 2, by + bh / 2 + 3);
          ctx.textAlign = 'left';
        }
      }

      drawRoundRect(
        ctx,
        ax + this.paddle.x * sx,
        ay + this.paddle.y * sy,
        this.paddle.w * sx,
        this.paddle.h * sy,
        6
      );
      ctx.fillStyle = '#22d3ee';
      ctx.fill();

      for (const b of this.balls) {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(ax + b.x * sx, ay + b.y * sy, Math.max(5, b.r * sx), 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.gameOver) {
        drawRoundRect(ctx, ax + 36, ay + arenaH / 2 - 46, arenaW - 72, 92, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.stroke();
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PARE-FEU VERROUILLÉ (GAME OVER)', ax + arenaW / 2, ay + arenaH / 2 - 8);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(`Score : ${this.score} • Vague : ${this.wave}`, ax + arenaW / 2, ay + arenaH / 2 + 12);
        if (this.lastCoinsEarned > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`+${this.lastCoinsEarned} 🪙 CC`, ax + arenaW / 2, ay + arenaH / 2 + 36);
        }
        ctx.textAlign = 'left';
      }
    }

    const px = x + w - ctrlW - 6;
    const py = y + 10;
    if (ctx) {
      drawRoundRect(ctx, px, py, ctrlW, h - 20, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`SCORE : ${this.score}`, px + 14, py + 28);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`RECORD : ${this.highScore}`, px + 14, py + 50);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`❤️ VIES : ${this.lives}  •  VAGUE ${this.wave}`, px + 14, py + 74);
      ctx.fillStyle = '#a855f7';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`Balles actives : ${this.balls.length}`, px + 14, py + 94);
    }

    const halfW = Math.floor((ctrlW - 30) / 2);
    drawUiBtn(ctx, addHitBox, hoveredId, 'brk_left', px + 12, py + 114, halfW, 48, '◀ G', {
      primary: true,
      fontSize: 16,
      onClick: () => this.movePaddle(-46)
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'brk_right', px + 18 + halfW, py + 114, halfW, 48, 'D ▶', {
      primary: true,
      fontSize: 16,
      onClick: () => this.movePaddle(46)
    });

    drawUiBtn(ctx, addHitBox, hoveredId, 'brk_multiball', px + 12, py + 174, ctrlW - 24, 40, '⚡ Bonus Multi-Balle', {
      active: true,
      fontSize: 13,
      onClick: () => this.spawnMultiBall()
    });

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'brk_pause',
      px + 12,
      py + 224,
      ctrlW - 24,
      36,
      this.paused ? '▶ Reprendre' : '⏸ Pause',
      {
        fontSize: 13,
        onClick: () => {
          this.paused = !this.paused;
          sfx.osClick?.();
        }
      }
    );

    drawUiBtn(ctx, addHitBox, hoveredId, 'brk_reset', px + 12, py + 270, ctrlW - 24, 38, '🔄 Rejouer', {
      primary: true,
      fontSize: 13,
      onClick: () => {
        sfx.osClick?.();
        this.reset();
      }
    });
  }
}

export class FlappyPacketGame {
  constructor(options = {}) {
    this.id = 'flappy';
    this.title = 'Flappy Packet';
    this.icon = '📡';
    this.worldW = 540;
    this.worldH = 360;
    this.onScoreChange = options.onScoreChange || null;
    this.onGameEnd = options.onGameEnd || null;
    this.highScore = Number(options.initialHighScore) || 0;
    this.stickFlapReady = true;
    this.reset();
  }

  reset() {
    this.packet = { x: 110, y: this.worldH / 2, vy: 0, w: 34, h: 24 };
    this.gravity = 640;
    this.flapVelocity = -245;
    this.pipes = [
      { x: 320, gapY: 160, gapH: 108, w: 52, passed: false },
      { x: 540, gapY: 200, gapH: 108, w: 52, passed: false }
    ];
    this.score = 0;
    this.packetsPassed = 0;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this._endReported = false;
    this.lastCoinsEarned = 0;
    this._notifyScore();
  }

  _notifyScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.onScoreChange?.(this.id, this.score, this.highScore);
  }

  _emitGameEnd(won = false) {
    if (this._endReported) return;
    this._endReported = true;
    const reward = computeArcadeCoinReward({
      gameId: this.id,
      score: this.score,
      isNewRecord: this.score > 0 && this.score >= this.highScore
    });
    this.lastCoinsEarned = reward.totalCoins;
    this.onGameEnd?.(this.id, this.score, {
      won: Boolean(won),
      highScore: this.highScore,
      estimatedCoins: this.lastCoinsEarned
    });
  }

  flap() {
    if (this.gameOver) {
      this.reset();
      return true;
    }
    if (this.paused) return false;
    this.packet.vy = this.flapVelocity;
    sfx.arcadeBeep?.(680, 0.04, 'sine');
    return true;
  }

  update(dt = 0.016) {
    if (this.gameOver || this.paused) return;
    const safeDt = Math.max(0, Math.min(0.05, Number(dt) || 0.016));
    this.packet.vy += this.gravity * safeDt;
    this.packet.y += this.packet.vy * safeDt;

    if (this.packet.y - this.packet.h / 2 <= 0 || this.packet.y + this.packet.h / 2 >= this.worldH) {
      this.gameOver = true;
      sfx.arcadeGameOver?.();
      this._notifyScore();
      this._emitGameEnd(false);
      return;
    }

    const speed = 150 + Math.min(90, this.packetsPassed * 4);
    for (const p of this.pipes) {
      p.x -= speed * safeDt;
      const hitX =
        this.packet.x + this.packet.w / 2 > p.x && this.packet.x - this.packet.w / 2 < p.x + p.w;
      const inGap =
        this.packet.y - this.packet.h / 2 > p.gapY - p.gapH / 2 &&
        this.packet.y + this.packet.h / 2 < p.gapY + p.gapH / 2;
      if (hitX && !inGap) {
        this.gameOver = true;
        sfx.arcadeGameOver?.();
        this._notifyScore();
        this._emitGameEnd(false);
        return;
      }
      if (!p.passed && p.x + p.w < this.packet.x) {
        p.passed = true;
        this.packetsPassed += 1;
        this.score += 15;
        sfx.arcadeBeep?.(920, 0.05, 'triangle');
        this._notifyScore();
      }
    }

    if (this.pipes[0].x + this.pipes[0].w < -10) {
      this.pipes.shift();
      const lastX = this.pipes[this.pipes.length - 1]?.x || 340;
      const nextGapY = 85 + Math.floor(Math.random() * (this.worldH - 170));
      this.pipes.push({
        x: Math.max(this.worldW + 20, lastX + 220),
        gapY: nextGapY,
        gapH: Math.max(88, 108 - Math.floor(this.packetsPassed * 0.8)),
        w: 52,
        passed: false
      });
    }
  }

  handleKeyDown(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') {
      return this.flap();
    }
    if (code === 'KeyR') {
      this.reset();
      return true;
    }
    return false;
  }

  handleThumbstick(_lx, ly) {
    if (ly < -0.45 && this.stickFlapReady) {
      this.stickFlapReady = false;
      return this.flap();
    }
    if (ly > -0.2) {
      this.stickFlapReady = true;
    }
    return false;
  }

  handlePointerDown(localX, _localY, rect) {
    const arenaW = rect.w - 196;
    if (localX <= rect.x + arenaW) {
      return this.flap();
    }
    return false;
  }

  handlePointerMove() {}
  handlePointerUp() {}

  render(ctx, rect, addHitBox, hoveredId) {
    const { x, y, w, h } = rect;
    const ctrlW = 186;
    const arenaW = w - ctrlW - 18;
    const arenaH = h - 20;
    const ax = x + 8;
    const ay = y + 10;
    const sx = arenaW / this.worldW;
    const sy = arenaH / this.worldH;

    if (ctx) {
      drawRoundRect(ctx, ax, ay, arenaW, arenaH, 8);
      ctx.fillStyle = '#041022';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (const p of this.pipes) {
        const pxPipe = ax + p.x * sx;
        const pwPipe = p.w * sx;
        const topH = Math.max(0, (p.gapY - p.gapH / 2) * sy);
        const botY = ay + (p.gapY + p.gapH / 2) * sy;
        const botH = Math.max(0, arenaH - (p.gapY + p.gapH / 2) * sy);
        if (pxPipe + pwPipe >= ax && pxPipe <= ax + arenaW) {
          ctx.fillStyle = '#be123c';
          ctx.fillRect(pxPipe, ay, pwPipe, topH);
          ctx.fillRect(pxPipe, botY, pwPipe, botH);
          ctx.strokeStyle = '#fb7185';
          ctx.strokeRect(pxPipe, ay, pwPipe, topH);
          ctx.strokeRect(pxPipe, botY, pwPipe, botH);
        }
      }

      const pktX = ax + (this.packet.x - this.packet.w / 2) * sx;
      const pktY = ay + (this.packet.y - this.packet.h / 2) * sy;
      drawRoundRect(ctx, pktX, pktY, this.packet.w * sx, this.packet.h * sy, 6);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.stroke();
      ctx.fillStyle = '#04101f';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('IP', pktX + (this.packet.w * sx) / 2, pktY + (this.packet.h * sy) / 2 + 3);
      ctx.textAlign = 'left';

      if (this.gameOver) {
        drawRoundRect(ctx, ax + 36, ay + arenaH / 2 - 48, arenaW - 72, 96, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.stroke();
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAQUET DROPPÉ PAR LE PARE-FEU !', ax + arenaW / 2, ay + arenaH / 2 - 10);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(
          `Score : ${this.score} pts (${this.packetsPassed} pare-feux franchis)`,
          ax + arenaW / 2,
          ay + arenaH / 2 + 12
        );
        if (this.lastCoinsEarned > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`+${this.lastCoinsEarned} 🪙 CC`, ax + arenaW / 2, ay + arenaH / 2 + 36);
        }
        ctx.textAlign = 'left';
      }
    }

    if (typeof addHitBox === 'function') {
      addHitBox({
        id: 'flappy_arena_tap',
        x: ax,
        y: ay,
        w: arenaW,
        h: arenaH,
        onClick: () => this.flap()
      });
    }

    const px = x + w - ctrlW - 6;
    const py = y + 10;
    if (ctx) {
      drawRoundRect(ctx, px, py, ctrlW, h - 20, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`SCORE : ${this.score}`, px + 14, py + 28);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`RECORD : ${this.highScore}`, px + 14, py + 50);
      ctx.fillStyle = '#34d399';
      ctx.fillText(`PORTS : ${this.packetsPassed}`, px + 14, py + 74);
    }

    drawUiBtn(ctx, addHitBox, hoveredId, 'flappy_jump', px + 12, py + 104, ctrlW - 24, 76, '🚀 IMPULSION IP', {
      primary: true,
      fontSize: 15,
      onClick: () => this.flap()
    });

    drawUiBtn(
      ctx,
      addHitBox,
      hoveredId,
      'flappy_pause',
      px + 12,
      py + 196,
      ctrlW - 24,
      38,
      this.paused ? '▶ Reprendre' : '⏸ Pause',
      {
        fontSize: 13,
        onClick: () => {
          this.paused = !this.paused;
          sfx.osClick?.();
        }
      }
    );

    drawUiBtn(ctx, addHitBox, hoveredId, 'flappy_reset', px + 12, py + 246, ctrlW - 24, 40, '🔄 Rejouer', {
      primary: true,
      fontSize: 13,
      onClick: () => {
        sfx.osClick?.();
        this.reset();
      }
    });
  }
}

export class Ciel2048Game {
  constructor(options = {}) {
    this.id = 'game2048';
    this.title = '2048 CIEL';
    this.icon = '🔢';
    this.size = 4;
    this.onScoreChange = options.onScoreChange || null;
    this.onGameEnd = options.onGameEnd || null;
    this.highScore = Number(options.initialHighScore) || 0;
    this.stickReady = true;
    this.dragStart = null;
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.popAnim = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.score = 0;
    this.maxTile = 2;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this._endReported = false;
    this.lastCoinsEarned = 0;
    this.spawnTile();
    this.spawnTile();
    this._notifyScore();
  }

  _notifyScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.onScoreChange?.(this.id, this.score, this.highScore);
  }

  _emitGameEnd(won = false) {
    if (this._endReported) return;
    this._endReported = true;
    const reward = computeArcadeCoinReward({
      gameId: this.id,
      score: this.score,
      isNewRecord: this.score > 0 && this.score >= this.highScore
    });
    this.lastCoinsEarned = reward.totalCoins;
    this.onGameEnd?.(this.id, this.score, {
      won: Boolean(won),
      highScore: this.highScore,
      estimatedCoins: this.lastCoinsEarned
    });
  }

  spawnTile(forcedValue = null) {
    const empties = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) empties.push([r, c]);
      }
    }
    if (empties.length === 0) return false;
    const [rr, cc] = empties[Math.floor(Math.random() * empties.length)];
    const val = forcedValue || (Math.random() < 0.9 ? 2 : 4);
    this.grid[rr][cc] = val;
    this.popAnim[rr][cc] = 1.0;
    if (val > this.maxTile) this.maxTile = val;
    return true;
  }

  canMove() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c];
        if (v === 0) return true;
        if (r + 1 < this.size && this.grid[r + 1][c] === v) return true;
        if (c + 1 < this.size && this.grid[r][c + 1] === v) return true;
      }
    }
    return false;
  }

  slide(direction) {
    if (this.gameOver) return false;
    let moved = false;
    let gained = 0;

    const processLine = (vals) => {
      const nonZero = vals.filter((v) => v > 0);
      const out = [];
      const mergedFlags = [];
      for (let i = 0; i < nonZero.length; i++) {
        if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
          const mergedVal = nonZero[i] * 2;
          out.push(mergedVal);
          mergedFlags.push(true);
          gained += mergedVal;
          if (mergedVal > this.maxTile) this.maxTile = mergedVal;
          if (mergedVal >= 2048) this.won = true;
          i++;
        } else {
          out.push(nonZero[i]);
          mergedFlags.push(false);
        }
      }
      while (out.length < this.size) {
        out.push(0);
        mergedFlags.push(false);
      }
      return { out, mergedFlags };
    };

    for (let idx = 0; idx < this.size; idx++) {
      const coords = [];
      for (let step = 0; step < this.size; step++) {
        if (direction === 'left') coords.push([idx, step]);
        else if (direction === 'right') coords.push([idx, this.size - 1 - step]);
        else if (direction === 'up') coords.push([step, idx]);
        else if (direction === 'down') coords.push([this.size - 1 - step, idx]);
      }
      if (coords.length !== this.size) return false;
      const oldLine = coords.map(([r, c]) => this.grid[r][c]);
      const { out, mergedFlags } = processLine(oldLine);
      coords.forEach(([r, c], i) => {
        if (this.grid[r][c] !== out[i]) moved = true;
        this.grid[r][c] = out[i];
        if (mergedFlags[i]) this.popAnim[r][c] = 1.0;
      });
    }

    if (moved) {
      this.score += gained;
      this.spawnTile();
      if (gained >= 128) sfx.arcadePowerup?.();
      else sfx.arcadeBeep?.(580, 0.035, 'triangle');
      if (!this.canMove()) {
        this.gameOver = true;
        sfx.arcadeGameOver?.();
        this._notifyScore();
        this._emitGameEnd(this.won);
      } else {
        this._notifyScore();
      }
    }
    return moved;
  }

  update(dt = 0.016) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0.016));
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.popAnim[r][c] > 0) {
          this.popAnim[r][c] = Math.max(0, this.popAnim[r][c] - safeDt * 4.5);
        }
      }
    }
  }

  handleKeyDown(code) {
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') return this.slide('left');
    if (code === 'ArrowRight' || code === 'KeyD') return this.slide('right');
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') return this.slide('up');
    if (code === 'ArrowDown' || code === 'KeyS') return this.slide('down');
    if (code === 'KeyR') {
      this.reset();
      return true;
    }
    return false;
  }

  handleThumbstick(lx, ly) {
    const mag = Math.hypot(lx, ly);
    if (mag < 0.3) {
      this.stickReady = true;
      return false;
    }
    if (!this.stickReady || mag < 0.6) return false;
    this.stickReady = false;
    if (Math.abs(lx) > Math.abs(ly)) {
      return this.slide(lx > 0 ? 'right' : 'left');
    }
    return this.slide(ly > 0 ? 'down' : 'up');
  }

  handlePointerDown(localX, localY) {
    this.dragStart = { x: localX, y: localY };
    return false;
  }

  handlePointerMove() {}

  handlePointerUp(localX, localY) {
    if (!this.dragStart) return false;
    const dx = localX - this.dragStart.x;
    const dy = localY - this.dragStart.y;
    this.dragStart = null;
    if (Math.hypot(dx, dy) < 22) return false;
    if (Math.abs(dx) > Math.abs(dy)) {
      return this.slide(dx > 0 ? 'right' : 'left');
    }
    return this.slide(dy > 0 ? 'down' : 'up');
  }

  render(ctx, rect, addHitBox, hoveredId) {
    const { x, y, w, h } = rect;
    const ctrlW = 210;
    const boardAreaW = w - ctrlW - 18;
    const boardSize = Math.min(boardAreaW - 20, h - 24);
    const bx = x + Math.floor((boardAreaW - boardSize) / 2) + 8;
    const by = y + Math.floor((h - boardSize) / 2);
    const gap = 8;
    const cell = Math.floor((boardSize - gap * (this.size + 1)) / this.size);

    const tileColors = {
      0: '#0f172a',
      2: '#1e293b',
      4: '#0f3952',
      8: '#0284c7',
      16: '#059669',
      32: '#10b981',
      64: '#d97706',
      128: '#ea580c',
      256: '#e11d48',
      512: '#9333ea',
      1024: '#c026d3',
      2048: '#eab308'
    };

    if (ctx) {
      drawRoundRect(ctx, bx, by, boardSize, boardSize, 12);
      ctx.fillStyle = '#071020';
      ctx.fill();
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const val = this.grid[r][c];
          const anim = this.popAnim[r][c] || 0;
          const pad = anim * 3;
          const cx = bx + gap + c * (cell + gap) - pad;
          const cy = by + gap + r * (cell + gap) - pad;
          const cw = cell + pad * 2;
          drawRoundRect(ctx, cx, cy, cw, cw, 8);
          ctx.fillStyle = tileColors[val] || '#facc15';
          ctx.fill();
          ctx.strokeStyle = val >= 128 ? '#fef08a' : '#334155';
          ctx.lineWidth = val >= 128 ? 2 : 1;
          ctx.stroke();

          if (val > 0) {
            ctx.fillStyle = val >= 2048 ? '#0f172a' : '#f8fafc';
            ctx.font = `bold ${val >= 1024 ? 19 : val >= 128 ? 23 : 27}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(val), cx + cw / 2, cy + cw / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          }
        }
      }

      if (this.gameOver) {
        drawRoundRect(ctx, bx + 16, by + boardSize / 2 - 44, boardSize - 32, 88, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.stroke();
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 19px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GRILLE COMPLÈTE !', bx + boardSize / 2, by + boardSize / 2 - 8);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(`Score : ${this.score} • Max : ${this.maxTile}`, bx + boardSize / 2, by + boardSize / 2 + 12);
        if (this.lastCoinsEarned > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`+${this.lastCoinsEarned} 🪙 CC`, bx + boardSize / 2, by + boardSize / 2 + 34);
        }
        ctx.textAlign = 'left';
      }
    }

    const px = x + w - ctrlW - 6;
    const py = y + 12;
    if (ctx) {
      drawRoundRect(ctx, px, py, ctrlW, h - 24, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
      ctx.stroke();

      ctx.fillStyle = '#fb923c';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`SCORE : ${this.score}`, px + 14, py + 28);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`RECORD : ${this.highScore}`, px + 14, py + 50);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`TUILE MAX : ${this.maxTile}`, px + 14, py + 72);
      if (this.won) {
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('🏆 TUILE 2048 ATTEINTE !', px + 14, py + 94);
      }
    }

    const dpadCx = px + Math.floor(ctrlW / 2);
    const dpadCy = py + 154;
    const bSz = 46;
    drawUiBtn(ctx, addHitBox, hoveredId, 'g2048_up', dpadCx - bSz / 2, dpadCy - bSz - 4, bSz, bSz, '▲', {
      primary: true,
      onClick: () => this.slide('up')
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'g2048_left', dpadCx - bSz - 26, dpadCy, bSz, bSz, '◀', {
      primary: true,
      onClick: () => this.slide('left')
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'g2048_right', dpadCx + 26, dpadCy, bSz, bSz, '▶', {
      primary: true,
      onClick: () => this.slide('right')
    });
    drawUiBtn(ctx, addHitBox, hoveredId, 'g2048_down', dpadCx - bSz / 2, dpadCy + bSz + 4, bSz, bSz, '▼', {
      primary: true,
      onClick: () => this.slide('down')
    });

    drawUiBtn(ctx, addHitBox, hoveredId, 'g2048_reset', px + 12, py + 276, ctrlW - 24, 42, '🔄 Nouvelle Partie', {
      primary: true,
      fontSize: 13,
      onClick: () => {
        sfx.osClick?.();
        this.reset();
      }
    });
  }
}

export function createCielOsGame(gameId, options = {}) {
  switch (gameId) {
    case 'snake':
      return new CyberSnakeGame(options);
    case 'minesweeper':
      return new CielMinesweeperGame(options);
    case 'tetris':
      return new CielBlocksGame(options);
    case 'breakout':
      return new NetworkBreakoutGame(options);
    case 'flappy':
      return new FlappyPacketGame(options);
    case 'game2048':
      return new Ciel2048Game(options);
    default:
      return new CyberSnakeGame(options);
  }
}
