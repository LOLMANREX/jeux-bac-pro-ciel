import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { sfx } from '../src/core/audio.js';
import {
  CIEL_OS_APPS,
  CIEL_OS_THEMES,
  CielOsDesktop
} from '../src/minigames/CielOsDesktop.js';
import {
  CIEL_OS_GAMES_CATALOG,
  Ciel2048Game,
  CielBlocksGame,
  CielMinesweeperGame,
  CyberSnakeGame,
  FlappyPacketGame,
  NetworkBreakoutGame,
  createCielOsGame
} from '../src/minigames/CielOsGames.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { SceneManager } from '../src/world/SceneManager.js';
import {
  createDefaultMap,
  getCatalogItem,
  isPcDeskObject
} from '../src/world/mapSchema.js';

test('CIEL OS Desktop : session élève, 4 thèmes, barre des tâches, volume, gestion de fenêtres et UV hit-test', () => {
  const os = new CielOsDesktop({
    stationId: 'pc-u305-1',
    stationLabel: 'Poste SOC 1',
    playerName: 'Lucas_CIEL',
    startLocked: true
  });

  assert.equal(os.sessionLocked, true);
  assert.equal(os.playerName, 'Lucas_CIEL');
  assert.ok(os.getHitBoxes().some((b) => b.id === 'session_unlock_btn'));

  os.unlockSession();
  assert.equal(os.sessionLocked, false);
  assert.ok(os.getHitBoxes().some((b) => b.id === 'desk_icon_snake'));
  assert.ok(os.getHitBoxes().some((b) => b.id === 'taskbar_start'));

  assert.equal(CIEL_OS_THEMES.length, 4);
  for (const th of CIEL_OS_THEMES) {
    assert.equal(os.setTheme(th.id), true);
    assert.equal(os.getTheme().id, th.id);
  }
  os.cycleTheme();
  assert.ok(os.getTheme().id);

  sfx.setVolume(0.5);
  assert.equal(sfx.getVolume(), 0.5);
  sfx.osBoot();
  sfx.osClick();
  sfx.osWindowOpen();
  sfx.osWindowClose();
  sfx.arcadeBeep();
  sfx.arcadePowerup();
  sfx.arcadeVictory();
  sfx.arcadeGameOver();

  assert.equal(os.toggleStartMenu(), true);
  assert.ok(os.getHitBoxes().some((b) => b.id === 'start_app_terminal'));

  for (const app of CIEL_OS_APPS) {
    assert.equal(os.openApp(app.id), true);
    assert.equal(os.activeAppId, app.id);
  }

  assert.equal(os.toggleMaximizeWindow('scores'), true);
  assert.equal(os.minimizeWindow('scores'), true);
  assert.notEqual(os.activeAppId, 'scores');
  assert.equal(os.closeWindow('scores'), true);

  const snakeIcon = os.getHitBoxes().find((b) => b.id === 'desk_icon_snake');
  assert.ok(snakeIcon);
  const uv = {
    x: (snakeIcon.x + snakeIcon.w / 2) / os.width,
    y: 1 - (snakeIcon.y + snakeIcon.h / 2) / os.height
  };
  const hit = os.hitTestUv(uv);
  assert.equal(hit.id, 'desk_icon_snake');
  os.handlePointerDownUv(uv, 0);
  os.handlePointerUpUv(uv, 0);
  assert.equal(os.activeAppId, 'snake');
  assert.equal(os.hasRunningGame(), true);

  os.lockSession();
  assert.equal(os.sessionLocked, true);
});

test('CIEL OS Applications : Terminal CIEL (help, ping, matrix, whoami, hack, cowsay, clear), Bloc-Notes et Explorateur de Scores', () => {
  const os = new CielOsDesktop({
    stationId: 'pc-u307-1',
    stationLabel: 'Îlot Réseau 1',
    playerName: 'Emma_CIEL'
  });

  os.openApp('terminal');
  assert.equal(os.activeAppId, 'terminal');

  const helpOut = os.executeTerminalCommand('help');
  assert.ok(helpOut.includes('ping'));
  assert.ok(helpOut.includes('cowsay'));

  const pingOut = os.executeTerminalCommand('ping 192.168.10.254');
  assert.ok(pingOut.includes('0% packet loss'));

  const whoOut = os.executeTerminalCommand('whoami');
  assert.ok(whoOut.includes('Emma_CIEL'));
  assert.ok(whoOut.includes('Professeur CIEL'));

  const matrixOut = os.executeTerminalCommand('matrix');
  assert.ok(matrixOut.includes('FLUX MATRIX'));
  assert.equal(os.themeId, 'matrix_green');

  const hackOut = os.executeTerminalCommand('hack');
  assert.ok(hackOut.includes('Professeur CIEL'));

  const cowOut = os.executeTerminalCommand('cowsay Bonjour U300');
  assert.ok(cowOut.includes('Bonjour U300'));
  assert.ok(cowOut.includes('^__^'));

  os.handleKeyDown('KeyH', 'h');
  os.handleKeyDown('KeyE', 'e');
  os.handleKeyDown('KeyL', 'l');
  os.handleKeyDown('KeyP', 'p');
  assert.equal(os.terminalInput, 'help');
  os.handleKeyDown('Enter', 'Enter');
  assert.equal(os.terminalInput, '');

  os.executeTerminalCommand('clear');
  assert.equal(os.terminalHistory.length, 0);

  os.openApp('notepad');
  assert.equal(os.activeAppId, 'notepad');
  os.setNotepadText('Note test CIEL');
  os.handleKeyDown('KeyA', '!');
  assert.equal(os.notepadText, 'Note test CIEL!');
  os.handleKeyDown('Backspace', 'Backspace');
  assert.equal(os.notepadText, 'Note test CIEL');

  os.openApp('scores');
  assert.equal(os.activeAppId, 'scores');
  const snakeGame = os.getGameInstance('snake');
  snakeGame.addScore(120);
  assert.equal(os.highScores.snake, 120);
  assert.equal(os.getTotalArcadeScore(), 120);
  os.resetHighScores();
  assert.equal(os.getTotalArcadeScore(), 0);
});

test('Mini-Jeu 1 — Cyber Snake : déplacement, nourriture, bonus turbo, portails vs murs, game over et reset', () => {
  assert.equal(CIEL_OS_GAMES_CATALOG.length, 6);
  let best = 0;
  const game = new CyberSnakeGame({
    onScoreChange: (_id, _score, hi) => {
      best = hi;
    }
  });

  const head0 = { ...game.snake[0] };
  game.food = { x: head0.x + 1, y: head0.y, kind: 'normal' };
  game.stepTick();
  assert.equal(game.score, 10);
  assert.equal(best, 10);
  assert.equal(game.snake.length, 4);

  const head1 = { ...game.snake[0] };
  game.bonusFood = { x: head1.x + 1, y: head1.y, ttl: 5 };
  game.stepTick();
  assert.ok(game.score >= 40);
  assert.ok(game.boostRemaining > 0);

  game.portalWalls = false;
  game.snake = [{ x: game.cols - 1, y: 5 }, { x: game.cols - 2, y: 5 }, { x: game.cols - 3, y: 5 }];
  game.dir = { x: 1, y: 0 };
  game.nextDir = { x: 1, y: 0 };
  game.stepTick();
  assert.equal(game.gameOver, true);

  game.reset();
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
  assert.equal(game.highScore, best);
});

test('Mini-Jeu 2 — Démineur CIEL Pro : 3 niveaux (Facile/Normal/Difficile), 1er clic sûr, sécurité anti-faux-clic, drapeaux et reprise de partie', () => {
  const game = new CielMinesweeperGame();
  assert.equal(game.cols, 9);
  assert.equal(game.rows, 9);
  assert.equal(game.mineCount, 10);
  assert.equal(game.safeMode, true);
  assert.equal(game.minesPlaced, false);

  assert.equal(game.handleCellClick(4, 4), 'pending');
  assert.equal(game.revealedCount, 0);
  assert.deepEqual(game.pendingCell, { r: 4, c: 4 });

  assert.equal(game.handleCellClick(4, 4), true);
  assert.equal(game.gameOver, false);
  assert.equal(game.minesPlaced, true);
  assert.equal(game.board[4][4].revealed, true);
  assert.equal(game.board[4][4].mine, false);

  let flagCell = null;
  for (let r = 0; r < game.rows && !flagCell; r++) {
    for (let c = 0; c < game.cols && !flagCell; c++) {
      if (!game.board[r][c].revealed) flagCell = [r, c];
    }
  }
  const [fr, fc] = flagCell;
  assert.equal(game.toggleFlag(fr, fc), true);
  assert.equal(game.flagCount, 1);
  assert.equal(game.handleCellClick(fr, fc), false);
  assert.equal(game.revealCell(fr, fc), false);
  assert.equal(game.toggleFlag(fr, fc), false);

  assert.equal(game.hasInProgressGame(), true);
  assert.equal(game.requestReset(), false);
  assert.ok(game.pendingResetConfirm);
  assert.equal(game.cancelReset(), true);
  assert.equal(game.pendingResetConfirm, null);

  const savedOk = game.saveInProgressSnapshot();
  assert.equal(savedOk, true);
  assert.equal(game.resumePromptActive, true);
  const snap = game.exportSnapshot();
  const resumed = new CielMinesweeperGame();
  assert.equal(resumed.restoreSnapshot(snap), true);
  assert.equal(resumed.revealedCount, game.revealedCount);
  assert.equal(resumed.difficulty, 'easy');

  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      if (!game.board[r][c].mine && !game.board[r][c].revealed) {
        game.revealCell(r, c);
      }
    }
  }
  assert.equal(game.won, true);
  assert.equal(game.lastCoinsEarned, 35);

  game.setDifficulty('medium');
  assert.equal(game.cols, 12);
  assert.equal(game.rows, 12);
  assert.equal(game.mineCount, 24);
  game.revealCell(0, 0);
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      if (!game.board[r][c].mine && !game.board[r][c].revealed) {
        game.revealCell(r, c);
      }
    }
  }
  assert.equal(game.won, true);
  assert.equal(game.lastCoinsEarned, 80);

  game.setDifficulty('hard');
  assert.equal(game.cols, 16);
  assert.equal(game.rows, 16);
  assert.equal(game.mineCount, 48);
  game.revealCell(8, 8);
  assert.equal(game.gameOver, false);
  assert.equal(game.board[8][8].mine, false);

  let mineCell = null;
  for (let r = 0; r < game.rows && !mineCell; r++) {
    for (let c = 0; c < game.cols && !mineCell; c++) {
      if (game.board[r][c].mine) mineCell = [r, c];
    }
  }
  assert.ok(mineCell);
  game.revealCell(mineCell[0], mineCell[1]);
  assert.equal(game.gameOver, true);
  assert.equal(game.won, false);

  game.reset('hard');
  assert.equal(game.gameOver, false);
  game.revealCell(0, 0);
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      if (!game.board[r][c].mine && !game.board[r][c].revealed) {
        game.revealCell(r, c);
      }
    }
  }
  assert.equal(game.won, true);
  assert.equal(game.lastCoinsEarned, 155);

  const os = new CielOsDesktop({ studentName: 'MineTester' });
  os.openApp('minesweeper', { silent: true });
  const deskMine = os.getGameInstance('minesweeper');
  deskMine.revealCell(2, 2);
  const revBeforeClose = deskMine.revealedCount;
  os.closeWindow('minesweeper');
  assert.equal(deskMine.resumePromptActive, true);
  os.openApp('minesweeper', { silent: true });
  assert.equal(os.getGameInstance('minesweeper').revealedCount, revBeforeClose);
});

test('Mini-Jeu 3 — CIEL-Blocks (Tetris) : rotation, déplacement, hardDrop, suppression de lignes, accélération et game over', () => {
  const game = new CielBlocksGame();
  const x0 = game.current.x;
  game.moveHorizontal(-1);
  assert.equal(game.current.x, x0 - 1);
  game.rotatePiece();

  for (let c = 0; c < game.cols; c++) {
    game.grid[game.rows - 1][c] = '#22d3ee';
  }
  game.current = {
    id: 'O',
    color: '#fbbf24',
    matrix: [
      [1, 1],
      [1, 1]
    ],
    x: 0,
    y: 0
  };
  game.hardDrop();
  assert.equal(game.lines, 1);
  assert.ok(game.score >= 100);

  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      game.grid[r][c] = '#f43f5e';
    }
  }
  game._spawnPiece();
  assert.equal(game.gameOver, true);

  game.reset();
  assert.equal(game.gameOver, false);
  assert.equal(game.lines, 0);
});

test('Mini-Jeu 4 — Casse-Briques Réseau (Breakout) : raquette, rebonds, briques multi-résistance, multi-balle et game over', () => {
  const game = new NetworkBreakoutGame();
  assert.equal(game.lives, 3);
  assert.ok(game.bricks.length > 20);

  game.setPaddleRatio(0.8);
  assert.ok(game.paddle.x > 200);

  assert.equal(game.spawnMultiBall(), true);
  assert.equal(game.balls.length, 3);

  const targetBrick = game.bricks[0];
  const initialHp = targetBrick.hp;
  game.balls[0].x = targetBrick.x + targetBrick.w / 2;
  game.balls[0].y = targetBrick.y + targetBrick.h / 2;
  game.update(0.016);
  assert.equal(targetBrick.hp, initialHp - 1);
  assert.ok(game.score >= 10);

  game.lives = 1;
  game.balls = [{ x: 100, y: game.worldH + 20, vx: 0, vy: 100, r: 6 }];
  game.update(0.016);
  assert.equal(game.gameOver, true);

  game.reset();
  assert.equal(game.gameOver, false);
  assert.equal(game.lives, 3);
});

test('Mini-Jeu 5 — Flappy Packet : impulsion IP, passage de pare-feux, score, crash et reset', () => {
  const game = new FlappyPacketGame();
  const y0 = game.packet.y;
  game.flap();
  assert.ok(game.packet.vy < 0);
  game.update(0.02);
  assert.ok(game.packet.y < y0);

  game.pipes[0].x = game.packet.x - game.pipes[0].w - 2;
  game.pipes[0].passed = false;
  game.update(0.016);
  assert.equal(game.packetsPassed, 1);
  assert.equal(game.score, 15);

  game.packet.y = game.worldH + 10;
  game.update(0.016);
  assert.equal(game.gameOver, true);

  game.reset();
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
});

test('Mini-Jeu 6 — 2048 CIEL : fusion de tuiles jusqu’à 2048, score, détection de blocage (game over) et reset', () => {
  const game = createCielOsGame('game2048');
  assert.ok(game instanceof Ciel2048Game);

  game.grid = [
    [2, 2, 0, 0],
    [4, 4, 0, 0],
    [1024, 1024, 0, 0],
    [0, 0, 0, 0]
  ];
  const moved = game.slide('left');
  assert.equal(moved, true);
  assert.equal(game.grid[0][0], 4);
  assert.equal(game.grid[1][0], 8);
  assert.equal(game.grid[2][0], 2048);
  assert.equal(game.won, true);
  assert.ok(game.score >= 2060);

  game.grid = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 8]
  ];
  assert.equal(game.canMove(), false);
  game.grid[3][2] = 4;
  game.grid[3][3] = 4;
  game.spawnTile = () => {
    game.grid[3][3] = 16;
    return true;
  };
  game.slide('left');
  assert.equal(game.gameOver, true);

  game.reset();
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
});

test('LabBuilder & mapSchema : détection universelle de tous les bureaux PC sur le Plateau U300 et l’éditeur de carte', () => {
  for (const pcType of [
    'desk_individual',
    'desk_teacher',
    'network_island',
    'pc_gamer_cyber',
    'pc_open_maint',
    'pc_ciel_os'
  ]) {
    assert.ok(getCatalogItem(pcType), `Catalogue manquant pour ${pcType}`);
    assert.equal(isPcDeskObject(pcType), true);
  }

  const scene = new THREE.Scene();
  const mapData = createDefaultMap();
  const lab = buildLabWorld(scene, mapData, { hideSprites: true });

  try {
    assert.ok(lab.pcStations.length >= 15);
    assert.ok(lab.pcInteractiveSurfaces.length >= 15);

    const pcInteractables = lab.interactables.filter((it) => it.type === 'ciel_os_pc');
    assert.equal(pcInteractables.length, lab.pcStations.length);

    for (const item of pcInteractables) {
      assert.ok(item.label.startsWith('[E] 🖥️ Utiliser le PC (CIEL OS)'));
      assert.ok(item.pcStation);
      assert.ok(item.pcStation.texture instanceof THREE.CanvasTexture);
      assert.ok(item.pcStation.desktop instanceof CielOsDesktop);
      assert.ok(item.pcStation.screenMeshes.length >= 1);

      const pose = item.pcStation.getCameraFocusPose({
        x: item.position.x,
        z: item.position.z + 1.5
      });
      assert.ok(pose.camPos instanceof THREE.Vector3);
      assert.ok(pose.lookAt instanceof THREE.Vector3);
      assert.ok(pose.camPos.distanceTo(pose.lookAt) > 0.3);
    }

    lab.updateLeaderboardBoard([], 'Alice_CIEL');
    assert.equal(lab.pcStations[0].desktop.playerName, 'Alice_CIEL');

    lab.pcStations[0].desktop.openApp('snake');
    lab.update(1.5, new THREE.Vector3(0, 0, 0), false);
    assert.equal(lab.pcStations[0].desktop.activeAppId, 'snake');
  } finally {
    lab.dispose();
  }
});

test('v4.23 — Throttling intelligent des écrans CIEL OS, matrixAutoUpdate=false & optimisations SceneManager', () => {
  const os = new CielOsDesktop({ stationId: 'pc-throttle-test' });
  os.openApp('snake');
  os.dirty = false;
  const startUploads = os.textureUploadCount;

  assert.equal(os.updateIdle(1.0, { focused: false, near: false, inView: false }), false);
  assert.equal(os.textureUploadCount, startUploads);

  assert.equal(os.updateIdle(2.1, { focused: false, near: false, inView: true }), true);
  assert.equal(os.sleepMode, true);
  assert.equal(os.textureUploadCount, startUploads + 1);

  for (let frame = 1; frame <= 30; frame++) {
    assert.equal(
      os.updateIdle(2.1 + frame * 0.016, { focused: false, near: false, inView: true }),
      false
    );
  }
  assert.equal(os.textureUploadCount, startUploads + 1);

  assert.equal(os.updateIdle(4.15, { focused: false, near: false, inView: true }), true);
  assert.equal(os.textureUploadCount, startUploads + 2);

  let nearUpdates = 0;
  for (let frame = 1; frame <= 20; frame++) {
    if (os.updateIdle(4.2 + frame * 0.035, { focused: false, near: true, inView: true })) {
      nearUpdates++;
    }
  }
  assert.equal(os.sleepMode, false);
  assert.ok(nearUpdates >= 15);

  const scene = new THREE.Scene();
  const mapData = createDefaultMap();
  const lab = buildLabWorld(scene, mapData, { hideSprites: true });
  try {
    assert.ok(lab.solidWallMeshes.length > 0);
    for (const wall of lab.solidWallMeshes) {
      assert.equal(wall.matrixAutoUpdate, false);
    }

    const activePc = lab.pcStations[0];
    const distantPc = lab.pcStations.find(
      (pc) => pc.id !== activePc.id && pc.position.distanceTo(activePc.position) > 6
    );
    assert.ok(distantPc);

    for (const sm of activePc.screenMeshes) {
      assert.equal(sm.matrixAutoUpdate, false);
      assert.equal(sm.castShadow, false);
    }

    activePc.desktop.openApp('snake');
    distantPc.desktop.openApp('snake');
    activePc.isActiveSession = true;
    distantPc.isActiveSession = false;
    activePc.desktop.dirty = false;
    distantPc.desktop.dirty = false;

    const cam = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 180);
    cam.position.set(activePc.position.x, 1.6, activePc.position.z + 1.2);
    cam.lookAt(activePc.position.x, 1.1, activePc.position.z);
    cam.updateMatrixWorld(true);

    const activeUploadsBefore = activePc.desktop.textureUploadCount;
    const distantUploadsBefore = distantPc.desktop.textureUploadCount;

    for (let f = 1; f <= 30; f++) {
      lab.update(10 + f * 0.016, new THREE.Vector3(activePc.position.x, 0, activePc.position.z + 1.2), false, cam);
    }

    assert.ok(activePc.desktop.textureUploadCount - activeUploadsBefore >= 25);
    assert.ok(distantPc.desktop.textureUploadCount - distantUploadsBefore <= 1);

    assert.ok(lab.pcStations.length > 0);
    for (const pc of lab.pcStations) {
      assert.ok(pc.screenMeshes.length > 0);
      for (const sm of pc.screenMeshes) {
        assert.ok(sm.name.endsWith('-front'));
        assert.equal(sm.name.includes('-back'), false);
        assert.equal(sm.material.side, THREE.FrontSide);
        assert.ok(sm.position.z > 0);
      }
    }
  } finally {
    lab.dispose();
  }

  let appliedPixelRatio = 0;
  const prevWin = globalThis.window;
  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 3.0,
    addEventListener() {},
    removeEventListener() {}
  };
  try {
    const fakeRenderer = {
      xr: { enabled: true, isPresenting: false, setReferenceSpaceType() {}, addEventListener() {} },
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
      setPixelRatio(r) {
        appliedPixelRatio = r;
      },
      setSize() {},
      setClearColor() {}
    };
    const mgr = new SceneManager(null, { renderer: fakeRenderer, skipEnvironment: true });
    mgr.setQuality('high');
    assert.equal(appliedPixelRatio, 1.5);
    mgr.updateWorldBounds({ width: 80, depth: 80, minX: -40, maxX: 40, minZ: -40, maxZ: 40 });
    assert.equal(mgr.sun.shadow.mapSize.x, 1024);
    assert.equal(mgr.sun.shadow.mapSize.y, 1024);
    fakeRenderer.toneMappingExposure = 0.2;
    mgr.restoreNormalExposure();
    assert.equal(fakeRenderer.toneMappingExposure, 0.96);
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
});
