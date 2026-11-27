import { sfx } from '../core/audio.js';
import { detectDeviceProfile, getMention, QUICK_EMOTES, TP_CATALOG, EXTRA_STATIONS } from '../core/gameState.js';
import { getJpoHudVisibility } from '../core/jpoConfig.js';
import { getCatalogItem, getStationTeleportInMap, getZoneAtPositionInMap } from '../world/mapSchema.js';
import {
  ASCENSION_SPECIALTIES,
  isCreatorLouis,
  renderSkinPreviewSvg,
  resolveAscensionSpecialty
} from '../world/AvatarBuilder.js';
import { pickRandomSkin, renderSkinControls, SkinPreview3D } from './SkinCustomizer.js';
import { PlateauMiniMap } from './PlateauMiniMap.js';
import { renderVariationTableMarkup } from '../minigames/VariationTableGame.js';
import { getCombatWeaponById, getWeaponsByMode } from '../world/CombatWeapons.js';

function escapeHtmlSafe(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatWorldCelebrationBanner(playerName, tpLabel = 'Oscilloscope & Diagnostic 3D') {
  const cleanName = String(playerName || 'Élève').trim() || 'Élève';
  const cleanTp = String(tpLabel || 'Oscilloscope & Diagnostic 3D').replace(/^TP\s+/i, '').trim() || 'Oscilloscope & Diagnostic 3D';
  return `🏆 EXPLOIT CIEL : ${cleanName} a décroché 20/20 au TP ${cleanTp} !`;
}

export function formatAscensionBanner(playerName, specialtyInput = 'cyber') {
  const cleanName = String(playerName || 'Élève').trim() || 'Élève';
  const spec = resolveAscensionSpecialty(specialtyInput);
  return `⚡ ASCENSION : ${cleanName} devient un DIEU DU BAC PRO CIEL (${spec.label}) ! ⚡`;
}

export function formatSecretSkinAnnouncement(playerName) {
  const cleanName = String(playerName || 'Élève').trim() || 'Élève';
  return `🌌 MYSTÈRE RÉVÉLÉ : ${cleanName} a réuni tous les pouvoirs divins et débloqué le SKIN SECRET ULTIME ! 🌌`;
}

export function formatSpectatorWaitMessage(playerName) {
  const cleanName = String(playerName || 'Élève').trim() || 'Élève';
  return `⏳ ${cleanName} choisit sa spécialité auprès du Professeur CIEL...`;
}

export function buildIntroCinematicSteps(playerName = 'Élève') {
  const cleanName = String(playerName || 'Élève').trim() || 'Élève';
  return [
    {
      title: `Bienvenue dans l'Atelier CIEL 3D, ${cleanName} !`,
      zoneLabel: '📍 Hall U300 • Accueil du Professeur CIEL',
      text: `« Bonjour ${cleanName} et bienvenue sur le Plateau U300 ! Je suis le Professeur CIEL. Tu évolues ici dans ton atelier grandeur nature du BAC PRO CIEL pour t'entraîner sur du matériel technique interactif en 3D et progresser avec ta classe. »`
    },
    {
      title: 'Explorer les 5 Pôles & Viser 20/20',
      zoneLabel: '📍 Salles U301, U302 & U303 • Électronique & Audiovisuel',
      text: '« Déplace-toi librement avec ZQSD (ou le joystick tactile) et appuie sur E devant chaque établi — ou clique sur un raccourci à gauche — pour réaliser les TPs d’Électronique & Brasure, d’Audiovisuel & DMX, de Systèmes, de Réseaux et de Cybersécurité. Chaque TP est noté sur /20 : donne le meilleur pour viser 20/20 ! »'
    },
    {
      title: 'Du Diplôme jusqu’à l’Excellence Intégrale',
      zoneLabel: '📍 Salles U305, U306 & U307 • Cyber, Systèmes & Réseaux',
      text: '« Valider les 5 TPs principaux à 10/20 débloque ton diplôme BAC PRO CIEL. Mais pour atteindre l’élite du classement et accéder au rituel suprême du plateau, il te faudra décrocher 20/20 sur 100 % des TPs de l’atelier (Cyber, Réseaux, Électronique, Systèmes et Audiovisuel) ! »'
    },
    {
      title: 'Skins Divins « Dieu du Bac Pro CIEL » & Cycle de Prestige',
      zoneLabel: '📍 Parvis U300 • Cérémonie d’Ascension',
      text: '« En obtenant 20/20 sur 100 % des TPs, tu déclenches la Cérémonie d’Ascension devant toute la classe : tu choisis ta spécialité préférée pour débloquer son Skin Divin exclusif dans ton casier, puis ton avancement des TPs est remis à zéro (Cycle de Prestige) pour te permettre de refaire tous les TPs à 20/20 et collectionner les autres Skins Divins ! »'
    },
    {
      title: 'Un Dernier Murmure de l’Atelier…',
      zoneLabel: '📍 Hall U300 • Mystère du Plateau',
      text: '« Et entre nous… Un vieux secret circule dans le laboratoire : une tenue légendaire secrète attend ceux qui auront la persévérance de réunir l’intégralité des Skins Divins du Bac Pro CIEL. Nul ne connaît son nom, son apparence ni ses pouvoirs… À toi de percer ce mystère ! »'
    }
  ];
}

export class HudManager {
  constructor(gameState, network, handlers) {
    this.gameState = gameState;
    this.network = network;
    this.handlers = handlers;

    this.hudEl = document.getElementById('hud');
    this.nameEl = document.getElementById('hud-player-name');
    this.xpEl = document.getElementById('hud-player-xp');
    this.coinsEl = document.getElementById('hud-player-coins');
    this.coinsPillEl = document.getElementById('hud-coins-pill');
    this.coinsGainLayerEl = document.getElementById('hud-coins-gain-layer');
    this.shopHudBtn = document.getElementById('btn-shop-ingame');
    this.avgEl = document.getElementById('hud-average');
    this.netPill = document.getElementById('net-pill');
    this.netText = document.getElementById('net-text');
    this.netRoomTag = document.getElementById('net-room-tag');
    this.onlineCountEl = document.getElementById('online-count');
    this.netErrorBanner = document.getElementById('net-error-banner');
    this.netErrorText = document.getElementById('net-error-text');
    this.rosterPopover = document.getElementById('room-roster-popover');

    this.questPanelEl = document.getElementById('quest-panel');
    this.questProgressEl = document.getElementById('quest-progress-text');
    this.questHintEl = document.getElementById('quest-objective-hint');
    this.questListEl = document.getElementById('quest-list');
    this.quickNavEl = document.getElementById('quick-nav-buttons');
    this.questToggleBtn = document.getElementById('btn-quest-toggle');
    this.zonePillEl = document.getElementById('hud-zone-pill');
    this.minimapPanelEl = document.getElementById('minimap-panel');
    this.minimapToggleBtn = document.getElementById('btn-minimap-toggle');
    this.miniMap = new PlateauMiniMap(document.getElementById('u300-minimap-canvas'));

    this.interactPromptEl = document.getElementById('interact-prompt');
    this.interactLabelEl = document.getElementById('interact-label');

    this.emoteBarEl = document.getElementById('emote-bar');
    this.chatEmoteStripEl = document.getElementById('chat-emote-strip');
    this.touchToggleBtn = document.getElementById('btn-touch-toggle');
    this.orientationHintEl = document.getElementById('orientation-hint');
    this.orientationDismissed = false;
    this.chatDrawer = document.getElementById('chat-drawer');
    this.chatMessagesEl = document.getElementById('chat-messages');
    this.chatRoomNameEl = document.getElementById('chat-room-name');
    this.chatRoomCountEl = document.getElementById('chat-room-count');
    this.chatUnreadEl = document.getElementById('chat-unread-badge');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');
    this.voiceToggleBtn = document.getElementById('btn-voice-toggle');
    this.voiceBtnIco = document.getElementById('voice-btn-ico');
    this.voiceBtnLabel = document.getElementById('voice-btn-label');
    this.voiceNearbyBar = document.getElementById('voice-nearby-bar');
    this.audioSettingsBtn = document.getElementById('btn-audio-settings');
    this.audioSettingsPopover = document.getElementById('audio-settings-popover');
    this.audioRefreshBtn = document.getElementById('btn-audio-refresh');
    this.audioCloseBtn = document.getElementById('btn-audio-close');
    this.audioInputSelect = document.getElementById('audio-input-select');
    this.audioOutputSelect = document.getElementById('audio-output-select');
    this.audioOutputStatusEl = document.getElementById('audio-output-status');
    this.audioMicTestBtn = document.getElementById('btn-audio-mic-test');
    this.audioMicMeterFillEl = document.getElementById('audio-mic-meter-fill');
    this.audioMicMeterLabelEl = document.getElementById('audio-mic-meter-label');
    this.audioHudSfxToggle = document.getElementById('audio-hud-sfx-toggle');
    this.audioMeterTimer = null;
    this.vrToggleBtn = document.getElementById('btn-vr-toggle');
    this.vrBtnLabel = document.getElementById('vr-btn-label');
    this.creatorPowerBtn = document.getElementById('btn-creator-power');
    this.creatorPowerPopover = document.getElementById('creator-power-popover');
    this.creatorCelebrateBtn = document.getElementById('btn-creator-celebrate');
    this.creatorAuraBtn = document.getElementById('btn-creator-aura');
    this.creatorAuraStateEl = document.getElementById('creator-aura-state');

    this.celebrationBannerEl = document.getElementById('world-celebration-banner');
    this.celebrationTextEl = document.getElementById('world-celebration-text');
    this.celebrationApplaudBtn = document.getElementById('btn-celebration-applaud');
    this.celebrationProgressEl = document.getElementById('world-celebration-progress');
    this.celebrationTimer = null;

    this.secretSkinBannerEl = document.getElementById('secret-skin-banner');
    this.secretSkinBannerTextEl = document.getElementById('secret-skin-banner-text');
    this.secretSkinBannerProgressEl = document.getElementById('secret-skin-banner-progress');
    this.secretBannerTimer = null;

    this.replayIntroBtn = document.getElementById('btn-replay-intro');
    this.introOverlayEl = document.getElementById('intro-cinematic-overlay');
    this.introStepPillEl = document.getElementById('intro-step-pill');
    this.introZonePillEl = document.getElementById('intro-zone-pill');
    this.introStepTitleEl = document.getElementById('intro-step-title');
    this.introTextEl = document.getElementById('intro-dialogue-text');
    this.introDotsEl = document.getElementById('intro-step-dots');
    this.introPrevBtn = document.getElementById('btn-intro-prev');
    this.introNextBtn = document.getElementById('btn-intro-next');
    this.introSkipBtn = document.getElementById('btn-intro-skip');
    this.introState = null;

    this.ascensionDialogueEl = document.getElementById('ascension-cinematic-dialogue');
    this.ascensionSpeechEl = document.getElementById('ascension-dialogue-speech');
    this.ascensionQuestionEl = document.getElementById('ascension-dialogue-question');
    this.ascensionCollectionEl = document.getElementById('ascension-collection-status');
    this.ascensionChoicesEl = document.getElementById('ascension-choices-grid');
    this.ascensionCountdownEl = document.getElementById('ascension-countdown-pill');
    this.ascensionSpectatorWaitEl = document.getElementById('ascension-spectator-wait');
    this.ascensionCountdownInterval = null;
    this.ascensionFallbackTimer = null;

    this.privateDebugBadgeEl = document.getElementById('hud-private-debug-badge');
    this.jpoBannerEl = document.getElementById('hud-jpo-banner');
    this.jpoPoleInfoEl = document.getElementById('hud-jpo-pole-info');
    this.jpoRoomLabelEl = document.getElementById('hud-jpo-room-label');
    this.jpoOpenTpBtn = document.getElementById('btn-jpo-open-tp');
    this.jpoIdlePillEl = document.getElementById('hud-jpo-idle-pill');
    this.jpoNewVisitBtn = document.getElementById('btn-jpo-new-visit');
    this.jpoState = { roomConfig: null, kiosk: false };
    this.debugPanelEl = document.getElementById('debug-tools-panel');
    this.debugCollapseBtn = document.getElementById('btn-debug-collapse');
    this.dbgFpsEl = document.getElementById('dbg-val-fps');
    this.dbgPingEl = document.getElementById('dbg-val-ping');
    this.dbgXyzEl = document.getElementById('dbg-val-xyz');
    this.dbgSocketEl = document.getElementById('dbg-val-socket');
    this.perfMonitorEl = document.getElementById('perf-monitor-hud');
    this.perfMonFpsEl = document.getElementById('perf-mon-fps');
    this.perfMonMsEl = document.getElementById('perf-mon-ms');
    this.perfMonCallsEl = document.getElementById('perf-mon-calls');
    this.perfMonTrisEl = document.getElementById('perf-mon-tris');
    this.perfMonChunksEl = document.getElementById('perf-mon-chunks');
    this.perfMonFloorEl = document.getElementById('perf-mon-floor');
    this._domCache = Object.create(null);
    this.domWriteCount = 0;
    this._combatCrosshairState = {
      active: false,
      weaponId: 'fiber_rifle',
      mode: 'guns',
      adsActive: false,
      hiddenForAds: false,
      inMeleeRange: false,
      guarding: false,
      spreadPx: 6
    };
    this.dbgCelebrateBtn = document.getElementById('btn-debug-celebrate');
    this.dbgValidateAllBtn = document.getElementById('btn-debug-validate-all');
    this.dbgResetBtn = document.getElementById('btn-debug-reset-progress');
    this.dbgVrPanelBtn = document.getElementById('btn-debug-vr-panel');
    this.dbgNoclipBtn = document.getElementById('btn-debug-noclip');
    this.dbgTeleportSelect = document.getElementById('debug-teleport-select');
    this.dbgTeleportGoBtn = document.getElementById('btn-debug-teleport-go');
    this.privateDebugActive = false;
    this.debugNoclipActive = false;
    this.detentionHudHidden = false;
    this.hudWasVisibleBeforeDetention = false;
    this.vrManager = null;
    this.lastConnectionState = 'solo';
    this.lastOnlineCount = 1;

    this.unreadChat = 0;
    this.lastEmoteAt = 0;

    this.leaderboardModal = document.getElementById('leaderboard-modal');
    this.leaderboardSummary = document.getElementById('leaderboard-summary');
    this.leaderboardPodium = document.getElementById('leaderboard-podium');
    this.leaderboardBody = document.getElementById('leaderboard-body');
    this.settingsModal = document.getElementById('settings-modal');
    this.skinModal = document.getElementById('skin-modal');

    this.skinIds = {
      divine: 'hud-skin-divine-list',
      style: 'hud-skin-style-list',
      color: 'hud-skin-color-list',
      hat: 'hud-skin-hat-list',
      tone: 'hud-skin-tone-list',
      pants: 'hud-skin-pants-list'
    };
    this.skinPreview = this.handlers.onOpenLocker
      ? null
      : new SkinPreview3D(
          document.getElementById('hud-skin-preview-canvas'),
          () => this.gameState.skin,
          240,
          290
        );

    this.toastContainer = document.getElementById('toast-container');

    this.survivalVignetteEl = document.getElementById('survival-horror-vignette');
    this.survivalHudBarEl = document.getElementById('survival-hud-bar');
    this.survivalHudTpsEl = document.getElementById('survival-hud-tps');
    this.survivalHudPlayersEl = document.getElementById('survival-hud-players');
    this.survivalHudAiEl = document.getElementById('survival-hud-ai');
    this.survivalHudNoiseFillEl = document.getElementById('survival-hud-noise-fill');
    this.survivalHudMicBtn = document.getElementById('survival-hud-mic-btn');
    this.survivalDetentionOpenBtn = document.getElementById('survival-detention-open-btn');

    this.survivalLobbyModalEl = document.getElementById('survival-lobby-modal');
    this.survivalLobbyStatusEl = document.getElementById('survival-lobby-status');
    this.survivalLobbyPlayersEl = document.getElementById('survival-lobby-players');
    this.survivalLobbyReadyBtn = document.getElementById('survival-lobby-ready-btn');
    this.survivalLobbyMicBtn = document.getElementById('survival-lobby-mic-btn');
    this.survivalLobbyLeaveBtn = document.getElementById('survival-lobby-leave-btn');
    this.survivalLobbyCloseBtn = document.getElementById('survival-lobby-close');

    this.survivalHideOverlayEl = document.getElementById('survival-hide-overlay');
    this.survivalHideStatusEl = document.getElementById('survival-hide-status');
    this.survivalHideNoiseFillEl = document.getElementById('survival-hide-noise-fill');
    this.survivalHideNoisePctEl = document.getElementById('survival-hide-noise-pct');
    this.survivalHideMicBtn = document.getElementById('survival-hide-mic-btn');
    this.survivalHideExitBtn = document.getElementById('survival-hide-exit-btn');

    this.survivalJumpscareEl = document.getElementById('survival-jumpscare-overlay');
    this.survivalJumpscareTitleEl = document.getElementById('jumpscare-title');
    this.survivalJumpscareSubEl = document.getElementById('jumpscare-sub');

    this.survivalDetentionModalEl = document.getElementById('survival-detention-modal');
    this.survivalDetentionMinBtn = document.getElementById('survival-detention-minimize');
    this.detentionSolvedEl = document.getElementById('detention-solved-badge');
    this.detentionStreakEl = document.getElementById('detention-streak-badge');
    this.detentionProgressEl = document.getElementById('detention-progress-badge');
    this.detentionQuestionEl = document.getElementById('detention-question');
    this.detentionTableEl = document.getElementById('detention-table-container');
    this.detentionOptionsEl = document.getElementById('detention-options');
    this.detentionFeedbackEl = document.getElementById('detention-feedback');
    this.detentionSurvCanvas = document.getElementById('detention-surveillance-canvas');

    this.survivalEndOverlayEl = document.getElementById('survival-end-overlay');
    this.survivalEndCardEl = document.getElementById('survival-end-card');
    this.survivalEndIconEl = document.getElementById('survival-end-icon');
    this.survivalEndTitleEl = document.getElementById('survival-end-title');
    this.survivalEndReasonEl = document.getElementById('survival-end-reason');
    this.survivalEndStatsEl = document.getElementById('survival-end-stats');
    this.survivalEndInspectBtn = document.getElementById('survival-end-inspect-btn');
    this.survivalEndBtn = document.getElementById('survival-end-btn');

    this.survivalIntroOverlayEl = document.getElementById('survival-intro-overlay');
    this.survivalIntroPhaseEl = document.getElementById('survival-intro-phase');
    this.survivalIntroTitleEl = document.getElementById('survival-intro-title');
    this.survivalIntroBriefingEl = document.getElementById('survival-intro-briefing');
    this.survivalIntroProgressEl = document.getElementById('survival-intro-progress-fill');
    this.survivalIntroSkipBtn = document.getElementById('survival-intro-skip-btn');

    this.survivalDetention3dHudEl = document.getElementById('survival-detention-3d-hud');
    this.detention3dCamPrevBtn = document.getElementById('detention-3d-cam-prev');
    this.detention3dCamLabelEl = document.getElementById('detention-3d-cam-label');
    this.detention3dCamNextBtn = document.getElementById('detention-3d-cam-next');

    this.combatLobbyModalEl = document.getElementById('combat-lobby-modal');
    this.combatModeGunsBtn = document.getElementById('combat-mode-guns-btn');
    this.combatModeMeleeBtn = document.getElementById('combat-mode-melee-btn');
    this.combatBotsToggleBtn = document.getElementById('combat-bots-toggle-btn');
    this.combatLobbyWeaponsEl = document.getElementById('combat-lobby-weapons');
    this.combatLobbyStatusEl = document.getElementById('combat-lobby-status');
    this.combatLobbyPlayersEl = document.getElementById('combat-lobby-players');
    this.combatLobbyReadyBtn = document.getElementById('combat-lobby-ready-btn');
    this.combatLobbyLeaveBtn = document.getElementById('combat-lobby-leave-btn');
    this.combatLobbyCloseBtn = document.getElementById('combat-lobby-close');

    this.combatHudEl = document.getElementById('combat-hud');
    this.combatDamageFlashEl = document.getElementById('combat-damage-flash');
    this.combatHudModeEl = document.getElementById('combat-hud-mode');
    this.combatHudTimerEl = document.getElementById('combat-hud-timer');
    this.combatHudScoreEl = document.getElementById('combat-hud-score');
    this.combatHudScoreboardBtn = document.getElementById('combat-hud-scoreboard-btn');
    this.combatHudLeaveBtn = document.getElementById('combat-hud-leave-btn');
    this.combatKillfeedEl = document.getElementById('combat-killfeed');
    this.combatCrosshairEl = document.getElementById('combat-crosshair');
    this.combatSniperScopeEl = document.getElementById('combat-sniper-scope');
    this.combatScopeWaveCanvas = document.getElementById('combat-scope-wave');
    this.combatScopeWaveCtx = this.combatScopeWaveCanvas?.getContext?.('2d') || null;
    this.combatScopeDistEl = document.getElementById('combat-scope-dist');
    this.combatHitmarkerEl = document.getElementById('combat-hitmarker');
    this.combatRespawnBannerEl = document.getElementById('combat-respawn-banner');
    this._combatScopeLastDrawMs = 0;
    this._combatCrosshairState = {
      active: false,
      weaponId: null,
      mode: 'guns',
      adsActive: false,
      inMeleeRange: false,
      guarding: false,
      spreadPx: 6
    };
    this.combatHpTextEl = document.getElementById('combat-hp-text');
    this.combatHpFillEl = document.getElementById('combat-hp-fill');
    this.combatWeaponNameEl = document.getElementById('combat-weapon-name');
    this.combatWeaponAmmoEl = document.getElementById('combat-weapon-ammo');
    this.combatWeaponSlotsEl = document.getElementById('combat-weapon-slots');

    this.combatScoreboardEl = document.getElementById('combat-scoreboard-overlay');
    this.combatScoreboardRowsEl = document.getElementById('combat-scoreboard-rows');

    this.combatEndOverlayEl = document.getElementById('combat-end-overlay');
    this.combatEndIconEl = document.getElementById('combat-end-icon');
    this.combatEndTitleEl = document.getElementById('combat-end-title');
    this.combatEndReasonEl = document.getElementById('combat-end-reason');
    this.combatEndCoinsEl = document.getElementById('combat-end-coins');
    this.combatEndTableEl = document.getElementById('combat-end-table');
    this.combatEndReplayBtn = document.getElementById('combat-end-replay-btn');
    this.combatEndExitBtn = document.getElementById('combat-end-exit-btn');
    this._combatHitmarkerTimer = null;
    this._combatDamageTimer = null;

    this.hudEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn && document.activeElement === btn) {
        btn.blur();
      }
    });

    this._bindControls();
    this._renderQuickNav();
    this._renderEmoteBar();
    this.gameState.subscribe(() => {
      this.refresh();
      if (this.isLeaderboardOpen()) {
        this.renderLeaderboard(this.gameState.leaderboard);
      }
      if (!this.rosterPopover.classList.contains('hidden')) {
        this.renderRoomRoster();
      }
    });
  }

  _bindControls() {
    const muteBtn = document.getElementById('btn-mute');
    const soundCheck = document.getElementById('set-sound');
    const syncMuteUi = () => {
      if (muteBtn) muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
      if (soundCheck) soundCheck.checked = !sfx.muted;
      if (this.audioHudSfxToggle) this.audioHudSfxToggle.checked = !sfx.muted;
    };
    this.syncMuteUi = syncMuteUi;

    muteBtn?.addEventListener('click', () => {
      sfx.toggleMute();
      syncMuteUi();
    });

    this.audioHudSfxToggle?.addEventListener('change', () => {
      sfx.setMuted(!this.audioHudSfxToggle.checked);
      syncMuteUi();
    });

    const fovSlider = document.getElementById('set-fov');
    const fovVal = document.getElementById('set-fov-val');
    const cameraSelect = document.getElementById('set-camera-mode');
    const viewModeBtn = document.getElementById('btn-view-mode');
    const qualitySelect = document.getElementById('set-quality');
    const fpsGuardCheck = document.getElementById('set-fps-guard');
    const perfMonitorCheck = document.getElementById('set-perf-monitor');
    const sensSlider = document.getElementById('set-sens');
    const sensVal = document.getElementById('set-sens-val');
    const touchSensSlider = document.getElementById('set-touch-sens');
    const touchSensVal = document.getElementById('set-touch-sens-val');
    const voiceModeSelect = document.getElementById('set-voice-mode');
    const voiceTpSelect = document.getElementById('set-voice-tp');
    const voiceVolSlider = document.getElementById('set-voice-vol');
    const voiceVolVal = document.getElementById('set-voice-vol-val');

    const syncSettingsUi = () => {
      if (fovSlider) fovSlider.value = String(this.gameState.fov);
      if (fovVal) fovVal.textContent = `${this.gameState.fov}°`;
      if (cameraSelect) cameraSelect.value = this.gameState.cameraMode;
      if (viewModeBtn) {
        viewModeBtn.textContent =
          this.gameState.cameraMode === 'third' ? '🎥 Vue: 3ème' : '🎥 Vue: 1ère';
      }
      if (qualitySelect) qualitySelect.value = this.gameState.quality;
      if (fpsGuardCheck) fpsGuardCheck.checked = this.gameState.autoFpsGuard !== false;
      if (perfMonitorCheck) perfMonitorCheck.checked = Boolean(this.gameState.perfMonitor);
      this.setPerfMonitorVisible(Boolean(this.gameState.perfMonitor));
      if (sensSlider) sensSlider.value = String(this.gameState.mouseSens);
      if (sensVal) sensVal.textContent = `${this.gameState.mouseSens.toFixed(1)}×`;
      if (touchSensSlider) touchSensSlider.value = String(this.gameState.touchSens ?? 1.0);
      if (touchSensVal) touchSensVal.textContent = `${Number(this.gameState.touchSens ?? 1.0).toFixed(1)}×`;
      if (voiceModeSelect) voiceModeSelect.value = this.gameState.voiceMode;
      if (voiceTpSelect) voiceTpSelect.value = this.gameState.voiceTpMode;
      if (voiceVolSlider) voiceVolSlider.value = String(this.gameState.voiceVolume);
      if (voiceVolVal) voiceVolVal.textContent = `${Math.round(this.gameState.voiceVolume * 100)}%`;
      document.querySelectorAll('.fov-preset').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.fov) === this.gameState.fov);
      });
      syncMuteUi();
    };
    this.syncCameraUi = syncSettingsUi;
    syncSettingsUi();

    viewModeBtn?.addEventListener('click', () => {
      sfx.click();
      const next = this.gameState.cameraMode === 'third' ? 'first' : 'third';
      this.gameState.setCameraMode(next);
      this.handlers.onCameraModeChange?.(next);
      syncSettingsUi();
      this.toast(next === 'third' ? '🎥 Caméra 3ème personne' : '🎥 Caméra 1ère personne');
    });

    const touchCheck = document.getElementById('set-touch-mode');
    const syncTouchUi = () => {
      const active = Boolean(this.gameState.touchMode);
      document.body.classList.toggle('touch-active', active);
      if (this.touchToggleBtn) {
        this.touchToggleBtn.classList.toggle('btn-active', active);
        this.touchToggleBtn.textContent = active ? '📱 Tactile: ON' : '📱 Tactile: OFF';
      }
      if (touchCheck) touchCheck.checked = active;
      this.handlers.onTouchModeChange?.(active);
    };
    this.syncTouchUi = syncTouchUi;
    syncTouchUi();

    touchCheck?.addEventListener('change', () => {
      sfx.click();
      this.gameState.setTouchMode(touchCheck.checked);
      syncTouchUi();
      this.toast(
        touchCheck.checked ? '📱 Interface tactile activée' : '🖱️ Interface PC (Clavier/Souris) activée'
      );
    });

    this.touchToggleBtn?.addEventListener('click', () => {
      sfx.click();
      const next = !this.gameState.touchMode;
      this.gameState.setTouchMode(next);
      syncTouchUi();
      this.toast(next ? '📱 Interface tactile activée' : '🖱️ Interface PC (Clavier/Souris) activée');
    });

    const setQuestCollapsed = (collapsed) => {
      this.questPanelEl?.classList.toggle('collapsed', collapsed);
      if (this.questToggleBtn) {
        this.questToggleBtn.textContent = collapsed ? '▸' : '▾';
      }
    };
    this.setQuestCollapsed = setQuestCollapsed;

    this.questToggleBtn?.addEventListener('click', () => {
      sfx.click();
      const isCollapsed = this.questPanelEl?.classList.contains('collapsed');
      setQuestCollapsed(!isCollapsed);
    });

    const setMinimapCollapsed = (collapsed) => {
      this.minimapPanelEl?.classList.toggle('collapsed', collapsed);
      if (this.minimapToggleBtn) {
        this.minimapToggleBtn.textContent = collapsed ? '▸' : '▾';
      }
    };
    this.setMinimapCollapsed = setMinimapCollapsed;
    this.toggleMinimap = () => {
      if (this.isJpoActive()) return;
      const isCollapsed = this.minimapPanelEl?.classList.contains('collapsed');
      setMinimapCollapsed(!isCollapsed);
    };

    this.minimapToggleBtn?.addEventListener('click', () => {
      sfx.click();
      this.toggleMinimap();
    });

    document.getElementById('btn-orientation-dismiss')?.addEventListener('click', () => {
      sfx.click();
      this.orientationDismissed = true;
      this.orientationHintEl?.classList.add('hidden');
    });

    window.addEventListener('resize', () => {
      this.syncViewportClasses();
      this.updateOrientationHint();
    });
    window.addEventListener('orientationchange', () => {
      this.syncViewportClasses();
      this.updateOrientationHint();
    });

    cameraSelect?.addEventListener('change', () => {
      sfx.click();
      const mode = cameraSelect.value;
      this.gameState.setCameraMode(mode);
      this.handlers.onCameraModeChange?.(mode);
      syncSettingsUi();
    });

    const openSettings = () => {
      if (this.detentionHudHidden) return;
      sfx.click();
      syncSettingsUi();
      this.settingsModal.classList.remove('hidden');
      this.handlers.onModalOpen?.(true);
    };
    this.openSettingsModal = openSettings;

    document.getElementById('btn-settings')?.addEventListener('click', openSettings);

    document.getElementById('btn-platform-hud')?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onOpenPlatform?.();
    });

    document.getElementById('btn-faq-hud')?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onOpenFaq?.();
    });

    document.getElementById('btn-main-menu')?.addEventListener('click', () => {
      sfx.click();
      this.closeAllModals();
      this.handlers.onReturnToMenu?.();
    });

    document.getElementById('btn-hud-logout')?.addEventListener('click', () => {
      sfx.click();
      this.closeAllModals();
      this.handlers.onLogout?.();
    });

    this.replayIntroBtn?.addEventListener('click', () => {
      sfx.click();
      this.closeAllModals();
      this.handlers.onReplayIntro?.();
    });

    this.introPrevBtn?.addEventListener('click', () => {
      sfx.click();
      this._stepIntro(-1);
    });

    this.introNextBtn?.addEventListener('click', () => {
      sfx.click();
      this._stepIntro(1);
    });

    this.introSkipBtn?.addEventListener('click', () => {
      sfx.click();
      this._finishIntro(true);
    });

    this.vrToggleBtn?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
      this.handlers.onToggleVr?.();
    });

    this.jpoOpenTpBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onJpoOpenTp?.();
    });

    this.jpoNewVisitBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onJpoNewVisit?.();
    });

    this.creatorPowerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.click();
      this.creatorPowerPopover?.classList.toggle('hidden');
    });

    this.creatorCelebrateBtn?.addEventListener('click', () => {
      sfx.click();
      this.creatorPowerPopover?.classList.add('hidden');
      this.handlers.onTriggerCreatorCelebration?.();
    });

    this.creatorAuraBtn?.addEventListener('click', () => {
      sfx.click();
      const next = !Boolean(this.gameState.skin?.creatorAura);
      this.handlers.onToggleCreatorAura?.(next);
      this.syncCreatorUi();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.creator-power-wrapper')) {
        this.creatorPowerPopover?.classList.add('hidden');
      }
    });

    this.celebrationApplaudBtn?.addEventListener('click', () => {
      sfx.applaud();
      this.celebrationApplaudBtn.classList.add('applauded');
      setTimeout(() => this.celebrationApplaudBtn?.classList.remove('applauded'), 350);
      this.handlers.onApplaud?.();
    });

    this.ascensionChoicesEl?.querySelectorAll('[data-specialty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        const spec = btn.dataset.specialty || 'cyber';
        this.hideAscensionDialogue();
        this.handlers.onSelectAscensionSpecialty?.(spec);
      });
    });

    this.debugCollapseBtn?.addEventListener('click', () => {
      sfx.click();
      const collapsed = this.debugPanelEl?.classList.toggle('collapsed');
      if (this.debugCollapseBtn) {
        this.debugCollapseBtn.textContent = collapsed ? '▸' : '▾';
      }
    });

    this.dbgCelebrateBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onDebugCelebrate?.();
    });

    this.dbgValidateAllBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onDebugValidateAll?.();
    });

    this.dbgResetBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onDebugResetProgress?.();
    });

    this.dbgVrPanelBtn?.addEventListener('click', () => {
      sfx.click();
      const next = this.handlers.onDebugToggleVrPanel?.();
      this.syncDebugVrPanelBtn(Boolean(next));
    });

    this.debugPanelEl?.querySelectorAll('[data-dbg-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        const mult = Number(btn.dataset.dbgSpeed) || 1;
        this.debugPanelEl.querySelectorAll('[data-dbg-speed]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.handlers.onDebugSpeedChange?.(mult);
      });
    });

    this.dbgNoclipBtn?.addEventListener('click', () => {
      sfx.click();
      this.debugNoclipActive = !this.debugNoclipActive;
      this.dbgNoclipBtn.classList.toggle('active', this.debugNoclipActive);
      this.dbgNoclipBtn.textContent = this.debugNoclipActive ? '👻 Noclip: ON' : '👻 Noclip: OFF';
      this.handlers.onDebugNoclipToggle?.(this.debugNoclipActive);
    });

    this.dbgTeleportGoBtn?.addEventListener('click', () => {
      sfx.click();
      const val = this.dbgTeleportSelect?.value || 'tp:teacher';
      this.handlers.onDebugTeleport?.(val);
    });

    this.dbgTeleportSelect?.addEventListener('change', () => {
      sfx.click();
      const val = this.dbgTeleportSelect.value;
      if (val) this.handlers.onDebugTeleport?.(val);
    });

    document.getElementById('settings-close')?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
    });

    fovSlider?.addEventListener('input', () => {
      const fov = Number(fovSlider.value);
      this.gameState.setFov(fov);
      this.handlers.onFovChange?.(fov);
      syncSettingsUi();
    });

    document.querySelectorAll('.fov-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        const fov = Number(btn.dataset.fov);
        this.gameState.setFov(fov);
        this.handlers.onFovChange?.(fov);
        syncSettingsUi();
      });
    });

    qualitySelect?.addEventListener('change', () => {
      sfx.click();
      const q = qualitySelect.value;
      this.gameState.setQuality(q);
      this.handlers.onQualityChange?.(q);
      this.toast(`Qualité 3D : ${qualitySelect.options[qualitySelect.selectedIndex].text}`);
    });

    fpsGuardCheck?.addEventListener('change', () => {
      sfx.click();
      const enabled = Boolean(fpsGuardCheck.checked);
      this.gameState.setAutoFpsGuard?.(enabled);
      this.handlers.onAutoFpsGuardChange?.(enabled);
      this.toast(enabled ? '🛡️ Garde-FPS Automatique activé' : '🛡️ Garde-FPS Automatique désactivé');
    });

    perfMonitorCheck?.addEventListener('change', () => {
      sfx.click();
      const enabled = Boolean(perfMonitorCheck.checked);
      this.gameState.setPerfMonitor?.(enabled);
      this.setPerfMonitorVisible(enabled);
      this.handlers.onPerfMonitorChange?.(enabled);
    });

    sensSlider?.addEventListener('input', () => {
      const s = Number(sensSlider.value);
      this.gameState.setMouseSens(s);
      this.handlers.onSensitivityChange?.(s);
      syncSettingsUi();
    });

    touchSensSlider?.addEventListener('input', () => {
      const s = Number(touchSensSlider.value);
      this.gameState.setTouchSens?.(s);
      this.handlers.onTouchSensitivityChange?.(s);
      syncSettingsUi();
    });

    soundCheck?.addEventListener('change', () => {
      sfx.setMuted(!soundCheck.checked);
      syncMuteUi();
    });

    voiceModeSelect?.addEventListener('change', () => {
      sfx.click();
      const mode = voiceModeSelect.value === 'ptt' ? 'ptt' : 'open';
      this.gameState.setVoiceMode(mode);
      this.handlers.onVoiceModeChange?.(mode);
      syncSettingsUi();
    });

    voiceTpSelect?.addEventListener('change', () => {
      sfx.click();
      const behavior = voiceTpSelect.value;
      this.gameState.setVoiceTpMode(behavior);
      this.handlers.onVoiceTpModeChange?.(behavior);
      syncSettingsUi();
    });

    voiceVolSlider?.addEventListener('input', () => {
      const vol = Number(voiceVolSlider.value);
      this.gameState.setVoiceVolume(vol);
      this.handlers.onVoiceVolumeChange?.(vol);
      syncSettingsUi();
    });

    this.voiceToggleBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onVoiceToggle?.();
    });

    const toggleAudioPopover = (forceOpen = null) => {
      if (!this.audioSettingsPopover) return;
      const isClosed = this.audioSettingsPopover.classList.contains('hidden');
      const shouldOpen = forceOpen === null ? isClosed : Boolean(forceOpen);
      if (shouldOpen) {
        this.audioSettingsPopover.classList.remove('hidden');
        this.audioSettingsBtn?.classList.add('open');
        this.syncMuteUi?.();
        this.handlers.onAudioPanelToggle?.(true);
        if (!this.audioMeterTimer) {
          this.audioMeterTimer = setInterval(() => {
            const level = this.handlers.onSampleMicLevel?.() ?? 0;
            this.updateMicMeter(level, true);
          }, 60);
        }
      } else {
        this.audioSettingsPopover.classList.add('hidden');
        this.audioSettingsBtn?.classList.remove('open');
        if (this.audioMeterTimer) {
          clearInterval(this.audioMeterTimer);
          this.audioMeterTimer = null;
        }
        this.updateMicMeter(0, false);
        this.handlers.onAudioPanelToggle?.(false);
      }
    };
    this.toggleAudioPopover = toggleAudioPopover;

    this.audioSettingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.click();
      toggleAudioPopover();
    });

    this.audioCloseBtn?.addEventListener('click', () => {
      sfx.click();
      toggleAudioPopover(false);
    });

    this.audioRefreshBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onAudioRefreshDevices?.();
    });

    this.audioInputSelect?.addEventListener('change', () => {
      const id = this.audioInputSelect.value;
      this.gameState.setAudioInputId(id);
      this.handlers.onAudioInputChange?.(id);
    });

    this.audioOutputSelect?.addEventListener('change', () => {
      const id = this.audioOutputSelect.value;
      this.gameState.setAudioOutputId(id);
      this.handlers.onAudioOutputChange?.(id);
    });

    this.audioMicTestBtn?.addEventListener('click', () => {
      sfx.click();
      this.handlers.onAudioMicTestToggle?.();
    });

    document.addEventListener('click', (e) => {
      if (
        this.audioSettingsPopover &&
        !this.audioSettingsPopover.classList.contains('hidden') &&
        !e.target.closest('#audio-settings-popover') &&
        !e.target.closest('#btn-audio-settings')
      ) {
        toggleAudioPopover(false);
      }
    });

    document.getElementById('set-reset-btn')?.addEventListener('click', () => {
      sfx.click();
      this.gameState.setFov(70);
      this.gameState.setCameraMode('first');
      this.gameState.setQuality('auto');
      this.gameState.setAutoFpsGuard?.(true);
      this.gameState.setPerfMonitor?.(false);
      this.gameState.setMouseSens(1.0);
      this.gameState.setTouchSens?.(1.0);
      this.gameState.setVoiceMode('open');
      this.gameState.setVoiceTpMode('duck');
      this.gameState.setVoiceVolume(1.0);
      sfx.setMuted(false);
      this.handlers.onFovChange?.(70);
      this.handlers.onCameraModeChange?.('first');
      this.handlers.onQualityChange?.('auto');
      this.handlers.onAutoFpsGuardChange?.(true);
      this.handlers.onPerfMonitorChange?.(false);
      this.handlers.onSensitivityChange?.(1.0);
      this.handlers.onTouchSensitivityChange?.(1.0);
      this.handlers.onVoiceModeChange?.('open');
      this.handlers.onVoiceTpModeChange?.('duck');
      this.handlers.onVoiceVolumeChange?.(1.0);
      syncSettingsUi();
      this.toast('Paramètres réinitialisés (FOV 70°)');
    });

    this.netPill.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.click();
      const willOpen = this.rosterPopover.classList.contains('hidden');
      if (willOpen) {
        this.renderRoomRoster();
        this.rosterPopover.classList.remove('hidden');
      } else {
        this.rosterPopover.classList.add('hidden');
      }
    });

    document.getElementById('btn-net-retry')?.addEventListener('click', () => {
      sfx.click();
      this.network.reconnectNow();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.net-wrapper')) {
        this.rosterPopover.classList.add('hidden');
      }
    });

    document.getElementById('btn-chat-toggle')?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
      this.toggleChat();
    });
    document.getElementById('btn-chat-close')?.addEventListener('click', () => {
      sfx.click();
      this.toggleChat(false);
    });

    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.chatInput.blur();
        this.toggleChat(false);
      }
    });

    this.chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = this.chatInput.value.trim();
      if (!txt) return;
      this.network.sendChat(txt);
      this.handlers.onLocalChatSent?.(txt);
      this.chatInput.value = '';
    });

    document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
      sfx.click();
      this.openLeaderboard();
    });

    document.getElementById('btn-leaderboard-refresh')?.addEventListener('click', async () => {
      sfx.click();
      const list = await this.network.fetchLeaderboard();
      this.gameState.setLeaderboard(list);
      this.renderLeaderboard(list);
    });

    document.getElementById('leaderboard-close')?.addEventListener('click', () => {
      sfx.click();
      this.closeLeaderboard();
    });

    document.getElementById('btn-tablet-settings')?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
      this.handlers.onOpenTablet?.();
    });

    document.getElementById('btn-leaderboard-settings')?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
      this.openLeaderboard();
    });

    document.getElementById('btn-changelog-settings')?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
      this.handlers.onOpenChangelog?.();
    });

    document.getElementById('btn-skin-ingame')?.addEventListener('click', () => {
      sfx.click();
      this.closeSettings();
      if (this.handlers.onOpenLocker) {
        this.handlers.onOpenLocker();
      } else {
        this.openSkinModal();
      }
    });

    this.shopHudBtn?.addEventListener('click', () => {
      if (this.isJpoActive()) return;
      sfx.click();
      this.closeSettings();
      this.handlers.onOpenShop?.();
    });

    this.coinsPillEl?.addEventListener('click', () => {
      if (this.isJpoActive()) return;
      sfx.click();
      this.handlers.onOpenShop?.();
    });

    if (!this.handlers.onOpenLocker) {
      document.getElementById('hud-skin-close')?.addEventListener('click', () => {
        sfx.click();
        this.closeSkinModal();
      });

      document.getElementById('btn-hud-skin-done')?.addEventListener('click', () => {
        sfx.click();
        this.closeSkinModal();
      });

      document.getElementById('btn-hud-skin-random')?.addEventListener('click', () => {
        sfx.click();
        this.gameState.setSkin(pickRandomSkin());
        this._refreshInGameSkinUi();
        this.handlers.onSkinChange?.(this.gameState.skin);
      });
    }
  }

  _refreshInGameSkinUi() {
    if (this.handlers.onRefreshLocker) {
      this.handlers.onRefreshLocker();
      return;
    }
    renderSkinControls(this.skinIds, this.gameState, (updatedSkin) => {
      this.skinPreview?.rebuild?.();
      this.handlers.onSkinChange?.(updatedSkin);
    });
    this.skinPreview?.rebuild?.();
  }

  openSkinModal() {
    if (this.detentionHudHidden) return;
    if (this.handlers.onOpenLocker) {
      this.handlers.onOpenLocker();
      return;
    }
    this._refreshInGameSkinUi();
    this.skinModal.classList.remove('hidden');
    this.skinPreview?.setActive?.(true);
    this.handlers.onModalOpen?.(true);
  }

  closeSkinModal() {
    if (this.handlers.onCloseLocker) {
      return this.handlers.onCloseLocker();
    }
    if (this.skinModal.classList.contains('hidden')) return false;
    this.skinPreview?.setActive?.(false);
    this.skinModal.classList.add('hidden');
    this.handlers.onModalOpen?.(false);
    return true;
  }

  closeSettings() {
    if (this.settingsModal.classList.contains('hidden')) return false;
    this.toggleAudioPopover?.(false);
    this.creatorPowerPopover?.classList.add('hidden');
    this.settingsModal.classList.add('hidden');
    this.handlers.onModalOpen?.(false);
    return true;
  }

  isLeaderboardOpen() {
    return !this.leaderboardModal.classList.contains('hidden');
  }

  isSettingsOpen() {
    return !this.settingsModal.classList.contains('hidden');
  }

  isSkinOpen() {
    return !this.skinModal.classList.contains('hidden');
  }

  async openLeaderboard() {
    if (this.detentionHudHidden) return;
    this.leaderboardModal.classList.remove('hidden');
    this.handlers.onModalOpen?.(true);
    if (this.gameState.leaderboard.length > 0) {
      this.renderLeaderboard(this.gameState.leaderboard);
    } else {
      this.leaderboardPodium.innerHTML = '';
      this.leaderboardBody.innerHTML = '<p class="hint-mini">Chargement du classement...</p>';
    }
    const fresh = await this.network.fetchLeaderboard();
    if (fresh.length > 0) {
      this.gameState.setLeaderboard(fresh);
      if (this.isLeaderboardOpen()) {
        this.renderLeaderboard(fresh);
      }
    } else if (this.gameState.leaderboard.length === 0) {
      this.renderLeaderboard([]);
    }
  }

  closeLeaderboard() {
    if (this.leaderboardModal.classList.contains('hidden')) return false;
    this.leaderboardModal.classList.add('hidden');
    this.handlers.onModalOpen?.(false);
    return true;
  }

  toggleLeaderboard() {
    if (this.isLeaderboardOpen()) {
      this.closeLeaderboard();
    } else {
      this.openLeaderboard();
    }
  }

  closeAllModals() {
    this.handlers.onCloseTablet?.({ restoreControls: false });
    this.closeLeaderboard();
    this.closeSkinModal();
    this.closeSettings();
    this.rosterPopover.classList.add('hidden');
    this.toggleAudioPopover?.(false);
  }

  toggleChat(forceOpen = null, focusInput = false) {
    const isClosed = this.chatDrawer.classList.contains('hidden');
    const shouldOpen = this.detentionHudHidden ? false : forceOpen === null ? isClosed : Boolean(forceOpen);
    if (shouldOpen) {
      this.chatDrawer.classList.remove('hidden');
      this.unreadChat = 0;
      this.chatUnreadEl.classList.add('hidden');
      this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
      if (focusInput) {
        if (document.pointerLockElement) document.exitPointerLock?.();
        setTimeout(() => this.chatInput.focus(), 10);
      }
    } else {
      this.chatDrawer.classList.add('hidden');
      this.chatInput?.blur?.();
    }
  }

  _renderQuickNav(mapData = null) {
    this.quickNavEl.innerHTML = '';
    const resolveRoomLabel = (targetId) => {
      if (!mapData) return '';
      const spot = getStationTeleportInMap(mapData, targetId);
      if (!spot?.pos) return '';
      const zone = getZoneAtPositionInMap(mapData, spot.pos.x, spot.pos.z);
      return zone?.code ? ` (${zone.code})` : '';
    };

    const teacherBtn = document.createElement('button');
    teacherBtn.type = 'button';
    teacherBtn.className = 'btn-quick teacher';
    teacherBtn.textContent = '👨‍🏫 Professeur CIEL';
    teacherBtn.addEventListener('click', () => {
      sfx.click();
      this.handlers.onQuickNav?.('teacher');
      if (window.innerWidth <= 900 || window.innerHeight <= 560) {
        this.setQuestCollapsed?.(true);
      }
    });
    this.quickNavEl.appendChild(teacherBtn);

    TP_CATALOG.forEach((tp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-quick';
      btn.dataset.quickId = tp.id;
      const baseLabel = `${tp.icon} ${tp.shortTitle}${resolveRoomLabel(tp.id)}`;
      btn.dataset.baseLabel = baseLabel;
      btn.textContent = baseLabel;
      btn.addEventListener('click', () => {
        sfx.click();
        this.handlers.onQuickNav?.(tp.id);
        if (window.innerWidth <= 900 || window.innerHeight <= 560) {
          this.setQuestCollapsed?.(true);
        }
      });
      this.quickNavEl.appendChild(btn);
    });

    EXTRA_STATIONS.forEach((st) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-quick';
      btn.dataset.quickId = st.id;
      btn.dataset.isExtra = '1';
      const baseLabel = `${st.icon} ${st.shortTitle}${resolveRoomLabel(st.id)}`;
      btn.dataset.baseLabel = baseLabel;
      btn.textContent = baseLabel;
      btn.addEventListener('click', () => {
        sfx.click();
        this.handlers.onQuickNav?.(st.id);
        if (window.innerWidth <= 900 || window.innerHeight <= 560) {
          this.setQuestCollapsed?.(true);
        }
      });
      this.quickNavEl.appendChild(btn);
    });

    this._syncQuickNavGrades();
  }

  _syncQuickNavGrades() {
    if (!this.quickNavEl) return;
    const grades = this.gameState?.profile?.grades || {};
    this.quickNavEl.querySelectorAll('[data-quick-id]').forEach((btn) => {
      const id = btn.dataset.quickId;
      const g = grades[id];
      const hasScore = typeof g === 'number' && Number.isFinite(g);
      const passed = hasScore && g >= 10;
      btn.classList.toggle('done', passed);
      const baseLabel = btn.dataset.baseLabel || btn.textContent;
      if (btn.dataset.isExtra === '1') {
        btn.textContent = hasScore ? `${baseLabel} • ${g.toFixed(1)}/20` : baseLabel;
      }
    });
  }

  setVrManager(vrManager) {
    this.vrManager = vrManager || null;
    this.vrManager?.updateHudInfo?.({
      connectionState: this.lastConnectionState,
      onlineCount: this.lastOnlineCount,
      pingMs: this.network?.lastPingMs ?? null
    });
  }

  setMapData(mapData) {
    this._renderQuickNav(mapData);
    this.vrManager?.setMapData?.(mapData);
  }

  _renderEmoteBar() {
    const buildButtons = (compact) =>
      QUICK_EMOTES.map(
        (em) =>
          `<button type="button" class="btn-emote ${compact ? 'compact' : ''}" data-emote="${em.id}" title="Touche ${em.key} : ${em.label}">
            ${compact ? em.label : `<span class="em-key">${em.key}</span> ${em.label}`}
          </button>`
      ).join('');

    const bindClicks = (container) => {
      container?.querySelectorAll('.btn-emote').forEach((btn) => {
        btn.addEventListener('click', () => {
          const em = QUICK_EMOTES.find((item) => item.id === btn.dataset.emote);
          if (em) this.triggerEmote(em);
        });
      });
    };

    if (this.emoteBarEl) {
      this.emoteBarEl.innerHTML = buildButtons(false);
      bindClicks(this.emoteBarEl);
    }
    if (this.chatEmoteStripEl) {
      this.chatEmoteStripEl.innerHTML = buildButtons(true);
      bindClicks(this.chatEmoteStripEl);
    }
  }

  triggerEmote(emoteOrIndex) {
    const emote =
      typeof emoteOrIndex === 'number' ? QUICK_EMOTES[emoteOrIndex] : emoteOrIndex;
    if (!emote) return;
    const now = Date.now();
    if (now - this.lastEmoteAt < 900) return;
    this.lastEmoteAt = now;
    sfx.click();
    this.network.sendEmote(emote.id, emote.label);
    this.handlers.onLocalEmote?.(emote);
  }

  syncViewportClasses() {
    if (typeof document === 'undefined' || !document.body?.classList) return;
    const prof = detectDeviceProfile();
    document.body.classList.toggle('device-mobile', prof.isMobile);
    document.body.classList.toggle('device-tablet', prof.isTablet);
    document.body.classList.toggle('orientation-portrait', prof.isPortrait);
    document.body.classList.toggle('orientation-landscape', prof.isLandscape);
  }

  updateOrientationHint() {
    if (!this.orientationHintEl) return;
    const hudVisible = !this.hudEl.classList.contains('hidden');
    const isPortraitNarrow = window.innerWidth < 680 && window.innerHeight > window.innerWidth;
    const show = hudVisible && !this.orientationDismissed && isPortraitNarrow;
    this.orientationHintEl.classList.toggle('hidden', !show);
  }

  show() {
    if (this.detentionHudHidden) {
      this.hudWasVisibleBeforeDetention = true;
      return;
    }
    this.hudEl.classList.remove('hidden');
    this.chatRoomNameEl.textContent = this.gameState.room;
    if (this.netRoomTag) this.netRoomTag.textContent = this.gameState.room;
    this.syncViewportClasses();
    this.syncTouchUi?.();
    if (this.gameState.touchMode || window.innerWidth <= 1024 || window.innerHeight <= 560) {
      this.setQuestCollapsed?.(true);
      this.setMinimapCollapsed?.(true);
    } else {
      this.setQuestCollapsed?.(false);
      this.setMinimapCollapsed?.(false);
    }
    this.updateOrientationHint();
    this.refresh();
  }

  setCurrentZone(zone) {
    if (!this.zonePillEl || !zone) return;
    this.zonePillEl.textContent = zone.badgeText || `📍 ${zone.code} - ${zone.shortName}`;
    this.zonePillEl.title = zone.fullLabel || zone.shortName;
    if (zone.color) {
      this.zonePillEl.style.borderColor = zone.color;
    }
  }

  updateMiniMap(data) {
    if (this.isJpoActive()) return;
    this.vrManager?.updateMiniMap?.(data);
    if (this.minimapPanelEl?.classList.contains('collapsed')) return;
    this.miniMap?.render(data);
  }

  hide() {
    this.closeAllModals();
    this.creatorPowerPopover?.classList.add('hidden');
    this.hideAscensionDialogue();
    this.hideWorldCelebration();
    this.hideSecretSkinAnnouncement();
    this.hideIntroCinematic();
    this.netErrorBanner?.classList.add('hidden');
    this.orientationHintEl?.classList.add('hidden');
    this.hudEl.classList.add('hidden');
    this.chatDrawer.classList.add('hidden');
    this.interactPromptEl.classList.add('hidden');
  }

  isIntroOpen() {
    return Boolean(this.introOverlayEl && !this.introOverlayEl.classList.contains('hidden'));
  }

  showIntroCinematic(options = {}) {
    if (!this.introOverlayEl) return;
    const playerName = options.playerName || this.gameState.profile?.name || 'Élève';
    const steps = Array.isArray(options.steps) && options.steps.length > 0
      ? options.steps
      : buildIntroCinematicSteps(playerName);
    this.introState = {
      steps,
      idx: 0,
      onStepChange: options.onStepChange || null,
      onFinish: options.onFinish || null
    };
    this.introOverlayEl.classList.remove('hidden');
    this._renderIntroStep();
  }

  _renderIntroStep() {
    if (!this.introState) return;
    const { steps, idx } = this.introState;
    const step = steps[idx] || steps[0];
    const isFirst = idx <= 0;
    const isLast = idx >= steps.length - 1;

    if (this.introStepPillEl) {
      this.introStepPillEl.textContent = `${idx + 1} / ${steps.length}`;
    }
    if (this.introZonePillEl) {
      this.introZonePillEl.textContent = step.zoneLabel || '📍 Plateau U300';
    }
    if (this.introStepTitleEl) {
      this.introStepTitleEl.textContent = step.title || '';
    }
    if (this.introTextEl) {
      this.introTextEl.textContent = step.text || '';
    }
    if (this.introPrevBtn) {
      this.introPrevBtn.disabled = isFirst;
      this.introPrevBtn.classList.toggle('hidden', isFirst);
    }
    if (this.introNextBtn) {
      this.introNextBtn.textContent = isLast ? '🚀 Commencer !' : 'Suivant ▶';
    }
    if (this.introDotsEl) {
      this.introDotsEl.innerHTML = steps
        .map((_, i) => `<span class="intro-dot ${i === idx ? 'active' : i < idx ? 'done' : ''}"></span>`)
        .join('');
    }
    this.introState.onStepChange?.(idx, step);
  }

  _stepIntro(delta) {
    if (!this.introState) return;
    const nextIdx = this.introState.idx + delta;
    if (nextIdx < 0) return;
    if (nextIdx >= this.introState.steps.length) {
      this._finishIntro(false);
      return;
    }
    this.introState.idx = nextIdx;
    this._renderIntroStep();
  }

  _finishIntro(skipped = false) {
    const finishCb = this.introState?.onFinish;
    this.hideIntroCinematic();
    finishCb?.({ skipped: Boolean(skipped) });
  }

  hideIntroCinematic() {
    this.introState = null;
    this.introOverlayEl?.classList.add('hidden');
  }

  showAscensionDialogue(payload = {}) {
    if (!this.ascensionDialogueEl) return;
    this.hideAscensionDialogue();

    const cleanName = String(payload.playerName || this.gameState.profile?.name || 'Élève').trim() || 'Élève';
    const isWinner = Boolean(payload.isWinner);
    const timeoutMs = Math.max(2000, Number(payload.choiceTimeoutMs) || 15000);
    const unlockedList = Array.isArray(payload.unlockedDivineSkins)
      ? payload.unlockedDivineSkins
      : isWinner && Array.isArray(this.gameState.unlockedDivineSkins)
        ? this.gameState.unlockedDivineSkins
        : [];
    const unlockedSet = new Set(unlockedList);
    const firstMissingSpec = ASCENSION_SPECIALTIES.find((s) => !unlockedSet.has(s.id));
    const defaultSpecialty = firstMissingSpec?.id || payload.defaultSpecialty || payload.tpId || 'cyber';
    let secLeft = Math.ceil(timeoutMs / 1000);

    if (this.ascensionSpeechEl) {
      const cycleNum = unlockedSet.size + 1;
      const prestigeHint =
        unlockedSet.size > 0
          ? ` (Cycle de Prestige #${cycleNum} — ${unlockedSet.size}/${ASCENSION_SPECIALTIES.length} Skins Divins déjà acquis)`
          : '';
      this.ascensionSpeechEl.textContent =
        payload.dialogueText ||
        `Silence dans l'atelier ! Félicitations solennelles à ${cleanName} devant toute la classe pour son 20/20 intégral au Bac Pro CIEL${prestigeHint} !`;
    }
    if (this.ascensionQuestionEl) {
      this.ascensionQuestionEl.textContent =
        payload.questionText || 'Quel a été ton TP préféré durant ton parcours ?';
    }
    if (this.ascensionCollectionEl) {
      this.ascensionCollectionEl.innerHTML = ASCENSION_SPECIALTIES.map((spec) => {
        const has = unlockedSet.has(spec.id);
        return `<span class="asc-col-chip ${has ? 'unlocked' : 'locked'}">${has ? '✅' : '🔒'} ${spec.icon} ${spec.shortLabel} (${has ? 'Débloqué' : 'À obtenir'})</span>`;
      }).join('');
    }
    if (this.ascensionCountdownEl) {
      this.ascensionCountdownEl.textContent = `⏱️ ${secLeft}s`;
    }
    if (this.ascensionChoicesEl) {
      this.ascensionChoicesEl.classList.toggle('hidden', !isWinner);
      this.ascensionChoicesEl.querySelectorAll('[data-specialty]').forEach((btn) => {
        const specId = btn.dataset.specialty;
        const has = unlockedSet.has(specId);
        btn.classList.toggle('already-unlocked', has);
        const stateEl = btn.querySelector('.asc-choice-state');
        if (stateEl) {
          stateEl.textContent = has ? '✅ Déjà débloqué' : '✨ À obtenir';
        }
      });
    }
    if (this.ascensionSpectatorWaitEl) {
      this.ascensionSpectatorWaitEl.classList.toggle('hidden', isWinner);
      this.ascensionSpectatorWaitEl.textContent =
        payload.spectatorWaitText || formatSpectatorWaitMessage(cleanName);
    }

    this.ascensionDialogueEl.classList.remove('hidden');

    this.ascensionCountdownInterval = setInterval(() => {
      secLeft = Math.max(0, secLeft - 1);
      if (this.ascensionCountdownEl) {
        this.ascensionCountdownEl.textContent = `⏱️ ${secLeft}s`;
      }
    }, 1000);

    this.ascensionFallbackTimer = setTimeout(() => {
      this.hideAscensionDialogue();
      if (typeof payload.onTimeout === 'function') {
        payload.onTimeout(defaultSpecialty);
      } else if (isWinner) {
        this.handlers.onSelectAscensionSpecialty?.(defaultSpecialty);
      }
    }, timeoutMs);
  }

  hideAscensionDialogue() {
    if (this.ascensionCountdownInterval) {
      clearInterval(this.ascensionCountdownInterval);
      this.ascensionCountdownInterval = null;
    }
    if (this.ascensionFallbackTimer) {
      clearTimeout(this.ascensionFallbackTimer);
      this.ascensionFallbackTimer = null;
    }
    this.ascensionDialogueEl?.classList.add('hidden');
  }

  showSecretSkinAnnouncement(payload = {}) {
    if (!this.secretSkinBannerEl) return;
    const bannerText =
      payload.bannerText ||
      formatSecretSkinAnnouncement(payload.playerName || this.gameState.profile?.name || 'Élève');
    if (this.secretSkinBannerTextEl) {
      this.secretSkinBannerTextEl.textContent = bannerText;
    }
    const durationMs = Math.max(2500, Number(payload.durationMs) || 9500);
    this.secretSkinBannerEl.classList.remove('hidden');
    if (this.secretSkinBannerProgressEl) {
      this.secretSkinBannerProgressEl.style.transition = 'none';
      this.secretSkinBannerProgressEl.style.width = '100%';
      void this.secretSkinBannerProgressEl.offsetWidth;
      this.secretSkinBannerProgressEl.style.transition = `width ${durationMs}ms linear`;
      this.secretSkinBannerProgressEl.style.width = '0%';
    }
    if (this.secretBannerTimer) {
      clearTimeout(this.secretBannerTimer);
    }
    this.secretBannerTimer = setTimeout(() => {
      this.secretBannerTimer = null;
      this.hideSecretSkinAnnouncement();
    }, durationMs);
  }

  hideSecretSkinAnnouncement() {
    if (this.secretBannerTimer) {
      clearTimeout(this.secretBannerTimer);
      this.secretBannerTimer = null;
    }
    this.secretSkinBannerEl?.classList.add('hidden');
  }

  syncCreatorUi() {
    const isLouis = isCreatorLouis(this.gameState.profile?.name);
    if (this.creatorPowerBtn) {
      this.creatorPowerBtn.classList.toggle('hidden', !isLouis);
    }
    if (!isLouis) {
      this.creatorPowerPopover?.classList.add('hidden');
    }
    const auraOn = Boolean(this.gameState.skin?.creatorAura);
    if (this.creatorAuraStateEl) {
      this.creatorAuraStateEl.textContent = auraOn ? 'ON' : 'OFF';
    }
    if (this.creatorAuraBtn) {
      this.creatorAuraBtn.classList.toggle('active', auraOn);
    }
  }

  showWorldCelebration(payload = {}) {
    if (!this.celebrationBannerEl) return;
    const bannerText =
      payload.bannerText ||
      formatWorldCelebrationBanner(
        payload.playerName || this.gameState.profile?.name || 'Élève',
        payload.tpName || payload.tpLabel || 'Oscilloscope & Diagnostic 3D'
      );
    if (this.celebrationTextEl) {
      this.celebrationTextEl.textContent = bannerText;
    }
    const durationMs = Math.max(1000, Number(payload.durationMs) || 8000);
    this.celebrationBannerEl.classList.remove('hidden');
    if (this.celebrationProgressEl) {
      this.celebrationProgressEl.style.transition = 'none';
      this.celebrationProgressEl.style.width = '100%';
      void this.celebrationProgressEl.offsetWidth;
      this.celebrationProgressEl.style.transition = `width ${durationMs}ms linear`;
      this.celebrationProgressEl.style.width = '0%';
    }
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
    this.celebrationTimer = setTimeout(() => {
      this.celebrationTimer = null;
      this.hideWorldCelebration();
    }, durationMs);
  }

  hideWorldCelebration() {
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = null;
    }
    this.celebrationBannerEl?.classList.add('hidden');
  }

  setPrivateDebugMode(active, roomCode = '') {
    this.privateDebugActive = Boolean(active);
    const showDbg = this.privateDebugActive && !this.detentionHudHidden;
    this.privateDebugBadgeEl?.classList.toggle('hidden', !showDbg);
    this.debugPanelEl?.classList.toggle('hidden', !showDbg);
    if (!this.privateDebugActive) {
      this.debugNoclipActive = false;
      if (this.dbgNoclipBtn) {
        this.dbgNoclipBtn.classList.remove('active');
        this.dbgNoclipBtn.textContent = '👻 Noclip: OFF';
      }
      this.debugPanelEl?.querySelectorAll('[data-dbg-speed]').forEach((b) => {
        b.classList.toggle('active', b.dataset.dbgSpeed === '1');
      });
    } else if (roomCode && this.netRoomTag) {
      this.netRoomTag.textContent = roomCode;
    }
  }

  isJpoActive() {
    return Boolean(this.jpoState?.roomConfig && this.jpoState.roomConfig.id && this.jpoState.roomConfig.id !== 'standard');
  }

  setJpoMode({ roomConfig = null, kiosk = false } = {}) {
    this.jpoState = { roomConfig, kiosk: Boolean(kiosk) };
    const vis = getJpoHudVisibility(roomConfig?.id, kiosk);
    const hasActiveRoom = vis.isJpo;
    const showBanner = vis.showBanner && !this.detentionHudHidden;
    this.hudEl?.classList.toggle('jpo-active', hasActiveRoom);
    if (typeof document !== 'undefined' && document.body?.classList) {
      document.body.classList.toggle('jpo-mode', hasActiveRoom);
    }
    this.coinsPillEl?.classList.toggle('hidden', !vis.showCoins);
    this.shopHudBtn?.classList.toggle('hidden', !vis.showShop);
    this.minimapPanelEl?.classList.toggle('hidden', !vis.showMinimap);
    this.questPanelEl?.classList.toggle('hidden', !vis.showQuestPanel);
    this.emoteBarEl?.classList.toggle('hidden', hasActiveRoom);
    if (!this.jpoBannerEl) return;
    this.jpoBannerEl.classList.toggle('hidden', !showBanner);
    this.jpoBannerEl.classList.toggle('kiosk-only', !hasActiveRoom && Boolean(kiosk));
    if (hasActiveRoom) {
      this.jpoBannerEl.style.setProperty('--jpo-accent', roomConfig.accent || '#38bdf8');
      if (this.jpoRoomLabelEl) {
        this.jpoRoomLabelEl.textContent = `${roomConfig.icon} ${roomConfig.label} • ${roomConfig.poleLabel}`;
      }
      if (this.jpoOpenTpBtn) {
        this.jpoOpenTpBtn.textContent = `▶ ${roomConfig.tpShortLabel || 'Lancer le TP'}`;
        this.jpoOpenTpBtn.classList.toggle('hidden', !roomConfig.tpId);
      }
      this.jpoPoleInfoEl?.classList.remove('hidden');
    } else {
      this.jpoPoleInfoEl?.classList.add('hidden');
      this.jpoOpenTpBtn?.classList.add('hidden');
    }
    this.jpoNewVisitBtn?.classList.toggle('hidden', !vis.showNewVisitBtn);
    if (!kiosk) {
      this.setJpoIdleCountdown(null);
    }
  }

  setJpoIdleCountdown(remainingSec = null) {
    if (!this.jpoIdlePillEl) return;
    const sec = Number(remainingSec);
    if (!Number.isFinite(sec) || sec <= 0 || sec > 15 || !this.jpoState?.kiosk || this.detentionHudHidden) {
      this.jpoIdlePillEl.classList.add('hidden');
      this.jpoIdlePillEl.textContent = '';
      return;
    }
    this.jpoIdlePillEl.textContent = `⏱️ Reset dans ${Math.ceil(sec)}s`;
    this.jpoIdlePillEl.classList.remove('hidden');
  }

  _setCachedText(el, key, value) {
    if (!el) return false;
    const str = String(value);
    if (this._domCache[key] === str) return false;
    this._domCache[key] = str;
    el.textContent = str;
    this.domWriteCount++;
    return true;
  }

  _setCachedHidden(el, key, hidden) {
    if (!el?.classList) return false;
    const h = Boolean(hidden);
    if (this._domCache[key] === h) return false;
    this._domCache[key] = h;
    el.classList.toggle('hidden', h);
    this.domWriteCount++;
    return true;
  }

  setPerfMonitorVisible(visible) {
    const show = Boolean(visible) && !this.detentionHudHidden;
    this._setCachedHidden(this.perfMonitorEl, 'perfMonHidden', !show);
  }

  updatePerfMonitor(metrics = null) {
    if (!this.perfMonitorEl || !metrics) return;
    if (this.perfMonitorEl.classList?.contains('hidden')) return;
    const fps = Math.max(0, Math.round(Number(metrics.fps) || 0));
    const ms = Number.isFinite(Number(metrics.frameTimeMs)) ? Number(metrics.frameTimeMs).toFixed(1) : '16.6';
    const dc = Math.max(0, Math.round(Number(metrics.drawCalls) || 0));
    const trisRaw = Math.max(0, Math.round(Number(metrics.triangles) || 0));
    const trisLabel = trisRaw >= 1000 ? `${(trisRaw / 1000).toFixed(1)}k` : String(trisRaw);
    const scaleTag = metrics.resolutionScale && metrics.resolutionScale < 0.99 ? ` (${Math.round(metrics.resolutionScale * 100)}%)` : '';

    this._setCachedText(this.perfMonFpsEl, 'pmFps', `${fps} FPS${scaleTag}`);
    this._setCachedText(this.perfMonMsEl, 'pmMs', `${ms} ms`);
    this._setCachedText(this.perfMonCallsEl, 'pmDc', `DC: ${dc}`);
    this._setCachedText(this.perfMonTrisEl, 'pmTri', `Tri: ${trisLabel}`);
    if (this.perfMonChunksEl) {
      const visC = Math.max(0, Math.round(Number(metrics.visibleChunks) || 0));
      const totC = Math.max(0, Math.round(Number(metrics.totalChunks) || 0));
      this._setCachedText(this.perfMonChunksEl, 'pmChunks', `Chunks: ${visC}/${totC}`);
    }
    if (this.perfMonFloorEl) {
      this._setCachedText(this.perfMonFloorEl, 'pmFloor', `Étage: ${metrics.floorLabel || 'RDC'}`);
    }

    if (this.perfMonFpsEl?.classList) {
      const tier = fps >= 50 ? 'perf-good' : fps >= 30 ? 'perf-warn' : 'perf-low';
      if (this._domCache.pmTier !== tier) {
        this._domCache.pmTier = tier;
        this.perfMonFpsEl.classList.remove('perf-good', 'perf-warn', 'perf-low');
        this.perfMonFpsEl.classList.add(tier);
        this.domWriteCount++;
      }
    }
  }

  updateDebugStats({ fps = 60, pingMs = null, pos = null, socketState = null } = {}) {
    if (!this.privateDebugActive) return;
    this._setCachedText(this.dbgFpsEl, 'dbgFps', `${Math.round(Number(fps) || 60)}`);
    this._setCachedText(
      this.dbgPingEl,
      'dbgPing',
      typeof pingMs === 'number' && Number.isFinite(pingMs) ? `${Math.round(pingMs)} ms` : '1 ms'
    );
    if (this.dbgXyzEl && pos) {
      const x = Number(pos.x || 0).toFixed(2);
      const y = Number(pos.y || 0).toFixed(2);
      const z = Number(pos.z || 0).toFixed(2);
      this._setCachedText(this.dbgXyzEl, 'dbgXyz', `X: ${x} | Y: ${y} | Z: ${z}`);
    }
    if (this.dbgSocketEl && socketState) {
      const st = socketState.stateLabel || (socketState.connected ? 'OPEN' : 'SOLO');
      const rm = socketState.room || this.gameState.room || 'priv-debug';
      this._setCachedText(this.dbgSocketEl, 'dbgSock', `${st} • ${rm} (id: ${socketState.clientId || '--'})`);
    }
  }

  refresh() {
    const p = this.gameState.profile;
    this.nameEl.textContent = p.name;
    this.xpEl.textContent = `${p.xp} XP`;
    if (this.coinsEl) {
      this.coinsEl.textContent = String(Math.max(0, Math.floor(Number(this.gameState.coins ?? p.coins) || 0)));
    }
    this.avgEl.textContent = p.average !== null ? `${p.average.toFixed(1)} / 20` : '-- / 20';
    this.syncCreatorUi();

    const completed = p.completedCount || 0;
    this.questProgressEl.textContent = `${completed} / 5`;

    if (!p.questAccepted) {
      this.questHintEl.innerHTML = 'Allez parler au <strong>Professeur CIEL</strong> (👨‍🏫) dans le Hall U300 (Escalier Central).';
    } else if (p.diplomaEarned) {
      this.questHintEl.innerHTML = `🎓 <strong>BAC PRO CIEL validé !</strong> (${getMention(p.average)}) — Retournez voir le Professeur CIEL !`;
    } else {
      const next = this.gameState.getNextSuggestedTp();
      this.questHintEl.innerHTML = next
        ? `Prochain TP conseillé : <strong>${next.icon} ${next.title}</strong>`
        : 'Tous les TPs sont validés !';
    }

    this.questListEl.innerHTML = TP_CATALOG.map((tp) => {
      const g = p.grades?.[tp.id];
      const ok = typeof g === 'number' && g >= 10;
      return `
        <li class="${ok ? 'done' : ''}" data-tpid="${tp.id}">
          <span>${ok ? '✅' : '⬜'} ${tp.icon} ${tp.shortTitle}</span>
          <span class="q-score">${typeof g === 'number' ? `${g.toFixed(1)}/20` : '--'}</span>
        </li>`;
    }).join('');
    this._syncQuickNavGrades();
  }

  setNetworkStatus(statusInput, onlineCount) {
    const status =
      typeof statusInput === 'object' && statusInput !== null
        ? statusInput
        : { state: statusInput ? 'connected' : 'reconnecting', connected: Boolean(statusInput) };

    const isConnected = Boolean(status.connected);
    const isConnecting = status.state === 'connecting';
    const isReconnecting = !isConnected && !isConnecting && status.state !== 'disconnected';

    this.netPill.classList.toggle('online', isConnected);
    this.netPill.classList.toggle('connecting', isConnecting);
    this.netPill.classList.toggle('error', isReconnecting);

    if (isConnected) {
      this.netText.textContent = 'Connecté';
      this.netPill.title = `Connecté en temps réel (${status.url || this.network.wsUrl || '/ws'})`;
      this.netErrorBanner?.classList.add('hidden');
    } else if (isConnecting) {
      this.netText.textContent = 'Connexion...';
      this.netPill.title = `Connexion WebSocket vers ${status.url || '/ws'}`;
    } else {
      const attemptTxt = status.attempt ? ` (#${status.attempt})` : '';
      this.netText.textContent = `Hors ligne${attemptTxt}`;
      const errDetail = status.error || 'Connexion WebSocket indisponible';
      this.netPill.title = errDetail;
      if (this.netErrorBanner && this.netErrorText && status.state === 'reconnecting' && !this.detentionHudHidden) {
        const sec = Math.max(1, Math.round((status.delayMs || 2000) / 1000));
        this.netErrorText.textContent = `⚠️ ${errDetail} — Nouvelle tentative dans ${sec}s...`;
        this.netErrorBanner.classList.remove('hidden');
      }
    }

    if (this.netRoomTag) this.netRoomTag.textContent = this.gameState.room;
    if (typeof onlineCount === 'number') {
      this.lastOnlineCount = onlineCount;
      const label = onlineCount > 1 ? `${onlineCount} élèves` : `${onlineCount} élève`;
      this.onlineCountEl.textContent = label;
      if (this.chatRoomCountEl) this.chatRoomCountEl.textContent = String(onlineCount);
    }
    this.lastConnectionState = isConnected
      ? 'connected'
      : isConnecting
        ? 'connecting'
        : isReconnecting
          ? 'reconnecting'
          : 'solo';
    this.vrManager?.updateHudInfo?.({
      connectionState: this.lastConnectionState,
      onlineCount: this.lastOnlineCount,
      pingMs: this.network?.lastPingMs ?? null
    });
  }

  renderRoomRoster() {
    const roster = this.gameState.roomRoster || [];
    if (roster.length === 0) {
      this.rosterPopover.innerHTML = `<div class="roster-empty">Aucun élève détecté en ${this._escape(this.gameState.room)}.</div>`;
      return;
    }
    const me = this.gameState.profile.name.toLowerCase();
    this.rosterPopover.innerHTML = `
      <div class="roster-title">👥 Présents en ${this._escape(this.gameState.room)} (${roster.length})</div>
      <ul class="roster-list">
        ${roster
          .map((r) => {
            const isSelf = r.name.toLowerCase() === me;
            const avgTxt = typeof r.average === 'number' ? `${r.average.toFixed(1)}/20` : '--';
            return `
              <li class="roster-item">
                <div class="roster-main">
                  <span class="dot online" style="background:${r.color || '#22d3ee'}"></span>
                  <strong>${this._escape(r.name)}</strong>
                  ${isSelf ? '<span class="self-tag">Vous</span>' : ''}
                  ${r.diplomaEarned ? '<span>🎓</span>' : ''}
                </div>
                <div class="roster-meta">
                  <span>${this._escape(r.activity || 'Dans l’atelier')}</span>
                  <strong>${avgTxt}</strong>
                </div>
              </li>`;
          })
          .join('')}
      </ul>`;
  }

  setInteractPrompt(target) {
    if (!target || this.detentionHudHidden) {
      this._setCachedHidden(this.interactPromptEl, 'interactHidden', true);
      return;
    }
    this._setCachedHidden(this.interactPromptEl, 'interactHidden', false);
    this._setCachedText(this.interactLabelEl, 'interactLabel', target.label);
  }

  clearChat() {
    this.chatMessagesEl.innerHTML = '';
    this.unreadChat = 0;
    this.chatUnreadEl.classList.add('hidden');
  }

  appendChatMessage(msg, notifyIfClosed = true) {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.system ? 'system' : ''}`;
    if (msg.system) {
      div.innerHTML = `<strong>👨‍🏫 ${this._escape(msg.author)} :</strong> ${this._escape(msg.text)}`;
    } else {
      div.innerHTML = `<strong style="color:${msg.color || '#22d3ee'}">${this._escape(msg.author)} :</strong> ${this._escape(msg.text)}`;
    }
    this.chatMessagesEl.appendChild(div);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;

    if (notifyIfClosed && this.chatDrawer.classList.contains('hidden')) {
      this.unreadChat++;
      this.chatUnreadEl.textContent = String(this.unreadChat);
      this.chatUnreadEl.classList.remove('hidden');
    }
  }

  renderLeaderboard(list) {
    const entries = Array.isArray(list) ? list : [];
    const onlineCount = entries.filter((e) => e.online).length;
    if (this.leaderboardSummary) {
      this.leaderboardSummary.textContent = `${onlineCount} en ligne • ${entries.length} élève(s)`;
    }

    if (entries.length === 0) {
      this.leaderboardPodium.innerHTML = '';
      this.leaderboardBody.innerHTML = '<p class="hint-mini">Aucun résultat enregistré pour le moment.</p>';
      return;
    }

    const me = this.gameState.profile.name.toLowerCase();
    const podiumOrder = [entries[1], entries[0], entries[2]].filter(Boolean);
    const medalByRank = { 1: '🥇', 2: '🥈', 3: '🥉' };

    this.leaderboardPodium.innerHTML = podiumOrder
      .map((row) => {
        const place = row.rank || entries.indexOf(row) + 1;
        const isSelf = row.name.toLowerCase() === me;
        const avgStr = typeof row.average === 'number' ? `${row.average.toFixed(1)}/20` : '--/20';
        const vipIcon =
          row.vipChambreAccess || row.skin?.battlePassTier
            ? ' <span title="Passe VIP Passe Baie Serveur">🔑</span>'
            : '';
        return `
          <div class="podium-card place-${place} ${isSelf ? 'self' : ''}">
            <div class="podium-rank">${medalByRank[place] || `#${place}`}</div>
            <div class="podium-avatar">${renderSkinPreviewSvg(row.skin, 54)}</div>
            <div class="podium-name">${this._escape(row.name)} ${row.diplomaEarned ? '🎓' : ''}${vipIcon}</div>
            <div class="podium-status ${row.online ? 'online' : 'offline'}">
              <span class="dot ${row.online ? 'online' : ''}"></span>
              ${row.online ? 'En ligne' : 'Hors ligne'}
            </div>
            <div class="podium-score">${avgStr}</div>
            <div class="podium-meta">${row.xp} XP • ${row.completedCount}/5 TPs</div>
          </div>`;
      })
      .join('');

    this.leaderboardBody.innerHTML = `
      <table class="os-table lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Élève &amp; Skin</th>
            <th>Statut</th>
            <th>Notes TP (/20)</th>
            <th>Moyenne</th>
            <th>XP</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map((row, i) => {
              const rank = row.rank || i + 1;
              const isSelf = row.name.toLowerCase() === me;
              const statusHtml = row.online
                ? `<span class="status-pill online"><span class="dot online"></span> En ligne</span>
                   <div class="lb-sub">${this._escape(row.onlineRoom || '')} • ${this._escape(row.onlineActivity || '')}</div>`
                : `<span class="status-pill offline"><span class="dot"></span> Hors ligne</span>`;

              const tpChips = TP_CATALOG.map((tp) => {
                const g = row.grades?.[tp.id];
                const has = typeof g === 'number';
                const cls = !has ? 'empty' : g >= 14 ? 'great' : g >= 10 ? 'pass' : 'low';
                return `<span class="tp-grade-chip ${cls}" title="${tp.title}">${tp.icon} ${has ? g.toFixed(1) : '--'}</span>`;
              }).join('');

              const diplomasTip = (row.diplomas || []).join(' | ');
              return `
                <tr class="${isSelf ? 'lb-row-self' : ''}">
                  <td><strong>${medalByRank[rank] || `#${rank}`}</strong></td>
                  <td>
                    <div class="lb-student-cell">
                      ${renderSkinPreviewSvg(row.skin, 40)}
                      <div>
                        <div class="lb-student-name">
                          <strong>${this._escape(row.name)}</strong>
                          ${isSelf ? '<span class="self-tag">Vous</span>' : ''}
                          ${row.vipChambreAccess || row.skin?.battlePassTier ? '<span title="Passe VIP Baie Serveur">🔑 VIP</span>' : ''}
                          ${row.diplomaEarned ? `<span title="${this._escape(diplomasTip || 'BAC PRO CIEL')}">🎓</span>` : ''}
                        </div>
                        <div class="lb-sub">${this._escape(row.rankLabel || '')} (${row.completedCount}/5 TPs)</div>
                      </div>
                    </div>
                  </td>
                  <td>${statusHtml}</td>
                  <td><div class="lb-tp-row">${tpChips}</div></td>
                  <td><strong class="lb-avg">${row.average !== null ? `${row.average.toFixed(1)}/20` : '--'}</strong></td>
                  <td><span class="xp-pill">${row.xp} XP</span></td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
  }

  toast(message, type = 'info') {
    if (this.detentionHudHidden) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  showCoinGain(amount, label = '') {
    if (this.isJpoActive()) return;
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) return;
    if (this.coinsEl) {
      const total = Math.max(0, Math.floor(Number(this.gameState.coins ?? this.gameState.profile?.coins) || 0));
      this.coinsEl.textContent = String(total);
    }
    if (this.coinsPillEl) {
      this.coinsPillEl.classList.remove('pulse-gain');
      void this.coinsPillEl.offsetWidth;
      this.coinsPillEl.classList.add('pulse-gain');
    }
    if (this.coinsGainLayerEl && typeof document !== 'undefined') {
      const pop = document.createElement('span');
      pop.className = 'coins-gain-float';
      pop.textContent = `+${n} 🪙${label ? ` (${label})` : ''}`;
      this.coinsGainLayerEl.appendChild(pop);
      setTimeout(() => pop.remove(), 1800);
    }
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  syncVoiceUi(voiceState = {}) {
    if (this.voiceToggleBtn) {
      const micOn = Boolean(voiceState.micEnabled);
      const transmitting = Boolean(voiceState.transmitting);
      const speaking = Boolean(voiceState.isSpeaking);
      const inTpMuted = Boolean(voiceState.inTp && voiceState.tpBehavior === 'mute');
      const hasErr = Boolean(voiceState.errorMessage && !micOn);

      this.voiceToggleBtn.classList.toggle('mic-on', micOn && !inTpMuted && !hasErr);
      this.voiceToggleBtn.classList.toggle('mic-ready', micOn && voiceState.mode === 'ptt' && !transmitting && !inTpMuted);
      this.voiceToggleBtn.classList.toggle('mic-speaking', speaking);
      this.voiceToggleBtn.classList.toggle('mic-error', hasErr);

      if (hasErr) {
        if (this.voiceBtnIco) this.voiceBtnIco.textContent = '⚠️';
        if (this.voiceBtnLabel) this.voiceBtnLabel.textContent = 'Micro bloqué';
        this.voiceToggleBtn.title = voiceState.errorMessage;
      } else if (inTpMuted) {
        if (this.voiceBtnIco) this.voiceBtnIco.textContent = '🔇';
        if (this.voiceBtnLabel) this.voiceBtnLabel.textContent = 'Coupé (TP)';
        this.voiceToggleBtn.title = 'Micro mis en pause automatiquement pendant le TP';
      } else if (speaking) {
        if (this.voiceBtnIco) this.voiceBtnIco.textContent = '🔴';
        if (this.voiceBtnLabel) this.voiceBtnLabel.textContent = 'En direct';
        this.voiceToggleBtn.title = 'Vous parlez en Voice Chat de proximité (V)';
      } else if (voiceState.mode === 'ptt' && micOn) {
        if (this.voiceBtnIco) this.voiceBtnIco.textContent = transmitting ? '🎙️' : '🎤';
        if (this.voiceBtnLabel) this.voiceBtnLabel.textContent = transmitting ? 'PTT actif' : 'Prêt (V)';
        this.voiceToggleBtn.title = 'Push-to-Talk : maintenez V pour parler, cliquez pour couper le micro';
      } else if (micOn) {
        if (this.voiceBtnIco) this.voiceBtnIco.textContent = '🎙️';
        if (this.voiceBtnLabel) this.voiceBtnLabel.textContent = 'Micro actif';
        this.voiceToggleBtn.title = 'Micro ouvert : appuyez sur V ou cliquez pour couper';
      } else {
        if (this.voiceBtnIco) this.voiceBtnIco.textContent = '🔇';
        if (this.voiceBtnLabel) {
          this.voiceBtnLabel.textContent = voiceState.mode === 'ptt' ? 'Activer PTT' : 'Micro coupé';
        }
        this.voiceToggleBtn.title =
          voiceState.mode === 'ptt'
            ? 'Push-to-Talk : maintenez V ou cliquez pour activer le micro'
            : 'Activer le micro (Touche V)';
      }
    }

    if (this.voiceNearbyBar) {
      const speakers = Array.isArray(voiceState.nearbySpeakers) ? voiceState.nearbySpeakers : [];
      if (speakers.length === 0) {
        this.voiceNearbyBar.classList.add('hidden');
        this.voiceNearbyBar.innerHTML = '';
      } else {
        this.voiceNearbyBar.classList.remove('hidden');
        this.voiceNearbyBar.innerHTML = speakers
          .slice(0, 4)
          .map(
            (sp) =>
              `<span class="voice-speaker-pill"><span class="voice-wave-dot" style="background:${this._escape(sp.color || '#34d399')}"></span>🔊 ${this._escape(sp.name)} <small>${sp.distance.toFixed(0)}m</small></span>`
          )
          .join('');
      }
    }

    this.syncAudioDevices(voiceState);
  }

  syncAudioDevices(voiceState = {}) {
    if (this.audioInputSelect && Array.isArray(voiceState.audioInputs)) {
      const currentVal = voiceState.inputDeviceId ?? this.gameState.audioInputId ?? '';
      const opts = ['<option value="">Microphone système par défaut</option>'];
      for (const dev of voiceState.audioInputs) {
        if (!dev.deviceId || dev.deviceId === 'default') continue;
        opts.push(`<option value="${this._escape(dev.deviceId)}">${this._escape(dev.label || 'Microphone')}</option>`);
      }
      const html = opts.join('');
      if (this.audioInputSelect.innerHTML !== html) {
        this.audioInputSelect.innerHTML = html;
      }
      this.audioInputSelect.value = currentVal;
    }

    if (this.audioOutputSelect && Array.isArray(voiceState.audioOutputs)) {
      const currentOut = voiceState.outputDeviceId ?? this.gameState.audioOutputId ?? '';
      const opts = ['<option value="">Sortie système par défaut</option>'];
      for (const dev of voiceState.audioOutputs) {
        if (!dev.deviceId || dev.deviceId === 'default') continue;
        opts.push(`<option value="${this._escape(dev.deviceId)}">${this._escape(dev.label || 'Sortie audio')}</option>`);
      }
      const html = opts.join('');
      if (this.audioOutputSelect.innerHTML !== html) {
        this.audioOutputSelect.innerHTML = html;
      }
      this.audioOutputSelect.value = currentOut;
    }

    if (this.audioOutputStatusEl) {
      if (voiceState.sinkStatusMessage) {
        this.audioOutputStatusEl.textContent = voiceState.sinkStatusMessage;
      } else if (voiceState.sinkSupported === false) {
        this.audioOutputStatusEl.textContent = 'Sélection de sortie gérée par le système (setSinkId indisponible).';
      } else {
        this.audioOutputStatusEl.textContent = '';
      }
    }

    if (this.audioMicTestBtn) {
      const testing = Boolean(voiceState.meterActive);
      this.audioMicTestBtn.textContent = testing ? '⏹️ Stopper' : '🎙️ Tester';
    }
  }

  updateMicMeter(level = 0, active = false) {
    const pct = Math.max(0, Math.min(100, Math.round((Number(level) || 0) * 100)));
    if (this.audioMicMeterFillEl) {
      this.audioMicMeterFillEl.style.width = `${pct}%`;
    }
    if (this.audioMicMeterLabelEl) {
      if (!active) {
        this.audioMicMeterLabelEl.textContent = 'Inactif';
      } else if (pct > 18) {
        this.audioMicMeterLabelEl.textContent = `Signal détecté (${pct}%)`;
      } else {
        this.audioMicMeterLabelEl.textContent = `À l’écoute (${pct}%)`;
      }
    }
  }

  syncDebugVrPanelBtn(enabled = false) {
    if (!this.dbgVrPanelBtn) return;
    const on = Boolean(enabled);
    this.dbgVrPanelBtn.textContent = on ? '🩺 Panneau Debug VR 3D : ON' : '🩺 Panneau Debug VR 3D : OFF';
    this.dbgVrPanelBtn.classList.toggle('is-off', !on);
  }

  syncVrUi(vrState = {}) {
    this.syncDebugVrPanelBtn(vrState.debugOverlayEnabled ?? vrState.debugPanelVisible);
    if (!this.vrToggleBtn) return;
    const active = Boolean(vrState.active);
    const simMode = Boolean(vrState.simMode);
    const supported = Boolean(vrState.xrSupported ?? vrState.supported);
    this.vrToggleBtn.classList.toggle('vr-active', active);
    this.vrToggleBtn.classList.toggle('vr-sim', simMode);
    document.body.classList.toggle('vr-sim-active', active && simMode);
    if (this.vrBtnLabel) {
      if (active) {
        this.vrBtnLabel.textContent = simMode ? 'Quitter VR Sim' : 'Quitter VR';
      } else if (supported) {
        this.vrBtnLabel.textContent = 'MODE VR (Quest)';
      } else {
        this.vrBtnLabel.textContent = 'Mode VR (F9)';
      }
    }
    this.vrToggleBtn.title = active
      ? 'Quitter le Mode Réalité Virtuelle (F9)'
      : supported
        ? 'Entrer en Réalité Virtuelle WebXR (Meta Quest)'
        : 'Activer la simulation VR PC (F9) : H Smartwatch • F Poing • Clic Laser';
  }

  bindSurvivalHandlers(callbacks = {}) {
    this.survivalCallbacks = callbacks;
    this.survivalLobbyReadyBtn?.addEventListener('click', () => this.survivalCallbacks?.onToggleReady?.());
    this.survivalLobbyMicBtn?.addEventListener('click', () => this.survivalCallbacks?.onToggleMic?.());
    this.survivalLobbyLeaveBtn?.addEventListener('click', () => this.survivalCallbacks?.onLeaveLobby?.());
    this.survivalLobbyCloseBtn?.addEventListener('click', () => this.survivalCallbacks?.onLeaveLobby?.());
    this.survivalHideMicBtn?.addEventListener('click', () => this.survivalCallbacks?.onToggleMic?.());
    this.survivalHideExitBtn?.addEventListener('click', () => this.survivalCallbacks?.onExitRack?.());
    this.survivalHudMicBtn?.addEventListener('click', () => this.survivalCallbacks?.onToggleMic?.());
    this.survivalDetentionOpenBtn?.addEventListener('click', () => this.survivalCallbacks?.onOpenDetention?.());
    this.survivalDetentionMinBtn?.addEventListener('click', () => this.survivalCallbacks?.onMinimizeDetention?.());
    this.survivalIntroSkipBtn?.addEventListener('click', () => this.survivalCallbacks?.onSkipSurvivalIntro?.());
    this.detention3dCamPrevBtn?.addEventListener('click', () => this.survivalCallbacks?.onPrevDetentionCamera?.());
    this.detention3dCamNextBtn?.addEventListener('click', () => this.survivalCallbacks?.onNextDetentionCamera?.());
    this.survivalEndInspectBtn?.addEventListener('click', () => {
      const nextCompact = !this.survivalEndOverlayEl?.classList.contains('is-compact');
      this.survivalEndOverlayEl?.classList.toggle('is-compact', nextCompact);
      if (this.survivalEndInspectBtn) {
        this.survivalEndInspectBtn.textContent = nextCompact
          ? '📋 Agrandir Bilan'
          : '👀 Observer Salle de Colle 3D';
      }
      this.survivalCallbacks?.onToggleEndInspect?.(nextCompact);
    });
    this.survivalEndBtn?.addEventListener('click', () => this.survivalCallbacks?.onCloseEnd?.());
  }

  showSurvivalLobby(snapshot = {}, localId = null, micEnabled = false) {
    if (!this.survivalLobbyModalEl) return;
    this.survivalLobbyModalEl.classList.remove('hidden');
    const players = Array.isArray(snapshot.lobbyPlayers)
      ? snapshot.lobbyPlayers
      : Array.isArray(snapshot.players)
        ? snapshot.players
        : [];
    const minP = Math.max(1, Number(snapshot.minPlayers) || 1);
    const readyCount = players.filter((p) => p.ready).length;
    const localPlayer = players.find((p) => p.id === localId);
    const localReady = Boolean(localPlayer?.ready);

    if (this.survivalLobbyStatusEl) {
      if (players.length < minP) {
        this.survivalLobbyStatusEl.textContent = `⏳ Joueurs dans l’instance : ${players.length}/${minP} minimum requis pour démarrer.`;
      } else {
        this.survivalLobbyStatusEl.textContent = `⚔️ ${readyCount}/${players.length} joueur(s) prêt(s) — la partie démarre dès que tout le monde est prêt (solo ou coop) !`;
      }
    }

    if (this.survivalLobbyPlayersEl) {
      this.survivalLobbyPlayersEl.innerHTML = players
        .map(
          (p) => `
          <div class="survival-player-chip ${p.ready ? 'ready' : ''}">
            <span>${escapeHtmlSafe(p.name || 'Élève')}${p.id === localId ? ' (Vous)' : ''}</span>
            <span>${p.ready ? '✅ Prêt' : '⏳ Attente'}</span>
          </div>`
        )
        .join('');
    }

    if (this.survivalLobbyReadyBtn) {
      this.survivalLobbyReadyBtn.textContent = localReady ? '⏳ Annuler Prêt' : '⚔️ Je suis prêt !';
    }
    if (this.survivalLobbyMicBtn) {
      this.survivalLobbyMicBtn.textContent = micEnabled ? '🎙️ Micro ON' : '🔇 Micro OFF';
    }
  }

  hideSurvivalLobby() {
    this.survivalLobbyModalEl?.classList.add('hidden');
  }

  updateSurvivalHud({
    completedTps = 0,
    totalTps = 5,
    survivorsCount = 0,
    detainedCount = 0,
    aiState = 'patrol',
    noiseLevel = 0,
    micEnabled = false,
    detained = false,
    detentionMinimized = false
  } = {}) {
    if (this.detentionHudHidden || detained) {
      this.hideSurvivalHud();
      return;
    }
    this.survivalHudBarEl?.classList.remove('hidden');
    this.survivalVignetteEl?.classList.remove('hidden');
    this.survivalVignetteEl?.classList.toggle('chase', aiState === 'chase');

    if (this.survivalHudTpsEl) {
      this.survivalHudTpsEl.textContent = `TPs : ${completedTps} / ${totalTps}`;
    }
    if (this.survivalHudPlayersEl) {
      this.survivalHudPlayersEl.textContent = `Survivants : ${survivorsCount} • Collés : ${detainedCount}`;
    }
    if (this.survivalHudAiEl) {
      const label =
        aiState === 'chase'
          ? 'IA : 🚨 POURSUITE !'
          : aiState === 'investigate'
            ? 'IA : 👂 Alerte Bruit / Recherche'
            : 'IA : 👣 Patrouille';
      this.survivalHudAiEl.textContent = label;
      this.survivalHudAiEl.classList.toggle('chase', aiState === 'chase');
    }
    const pct = Math.max(0, Math.min(100, Math.round((Number(noiseLevel) || 0) * 100)));
    if (this.survivalHudNoiseFillEl) {
      this.survivalHudNoiseFillEl.style.width = `${pct}%`;
    }
    if (this.survivalHudMicBtn) {
      this.survivalHudMicBtn.textContent = micEnabled ? '🎙️ Micro ON' : '🔇 Micro OFF';
    }
    if (this.survivalDetentionOpenBtn) {
      this.survivalDetentionOpenBtn.classList.toggle('hidden', !(detained && detentionMinimized));
    }
  }

  hideSurvivalHud() {
    this.survivalHudBarEl?.classList.add('hidden');
    this.survivalVignetteEl?.classList.add('hidden');
    this.survivalVignetteEl?.classList.remove('chase');
    this.survivalDetentionOpenBtn?.classList.add('hidden');
  }

  showHidingOverlay({ noiseLevel = 0, micEnabled = false, aiState = 'patrol', aiDist = null } = {}) {
    if (!this.survivalHideOverlayEl) return;
    this.survivalHideOverlayEl.classList.remove('hidden');
    const nearThreat = (Number.isFinite(Number(aiDist)) && Number(aiDist) < 9) || aiState === 'chase';
    this.survivalHideOverlayEl.classList.toggle('threat-near', nearThreat);
    if (this.survivalHideOverlayEl.style) {
      this.survivalHideOverlayEl.style.display = 'flex';
      this.survivalHideOverlayEl.style.opacity = '1';
    }
    const pct = Math.max(0, Math.min(100, Math.round((Number(noiseLevel) || 0) * 100)));
    if (this.survivalHideNoiseFillEl) {
      this.survivalHideNoiseFillEl.style.width = `${pct}%`;
    }
    if (this.survivalHideNoisePctEl) {
      this.survivalHideNoisePctEl.textContent = `${pct}%`;
    }
    if (this.survivalHideMicBtn) {
      this.survivalHideMicBtn.textContent = micEnabled ? '🎙️ Couper Micro (Silence)' : '🔇 Micro Coupé (Caché)';
    }
    if (this.survivalHideStatusEl) {
      if (noiseLevel >= 0.28) {
        this.survivalHideStatusEl.textContent =
          '⚠️ Votre micro dépasse 28% ! Le Professeur CIEL vous entend à travers les fentes de la baie !';
      } else if (nearThreat) {
        this.survivalHideStatusEl.textContent =
          '🚨 Chut ! Guettez à travers les trous (Souris/Glisser ±45°) : le Professeur CIEL approche.';
      } else {
        this.survivalHideStatusEl.textContent =
          '🤫 Caché dans la Baie perforée : guettez par les fentes (Souris ±45°) • [E] Sortir.';
      }
    }
  }

  hideHidingOverlay() {
    if (!this.survivalHideOverlayEl) return;
    this.survivalHideOverlayEl.classList.add('hidden');
    this.survivalHideOverlayEl.classList.remove('threat-near');
    if (this.survivalHideOverlayEl.style) {
      this.survivalHideOverlayEl.style.opacity = '0';
      this.survivalHideOverlayEl.style.display = 'none';
    }
  }

  triggerJumpscareOverlay(title = '☠️ ATTRAPÉ PAR LE PROFESSEUR CIEL !', sub = 'Téléportation immédiate en Salle d’Heure de Colle...') {
    if (!this.survivalJumpscareEl) return;
    if (this.survivalJumpscareTitleEl) this.survivalJumpscareTitleEl.textContent = title;
    if (this.survivalJumpscareSubEl) this.survivalJumpscareSubEl.textContent = sub;
    this.survivalJumpscareEl.classList.remove('hidden');
  }

  hideJumpscareOverlay() {
    this.survivalJumpscareEl?.classList.add('hidden');
  }

  showDetentionModal(detentionSnapshot = {}) {
    if (this.detentionHudHidden) {
      this.hideDetentionModal();
      return;
    }
    if (!this.survivalDetentionModalEl) return;
    this.survivalDetentionModalEl.classList.remove('hidden');
    const ex = detentionSnapshot.exercise;
    if (this.detentionSolvedEl) {
      this.detentionSolvedEl.textContent = `Résolus : ${detentionSnapshot.solvedCount || 0}`;
    }
    if (this.detentionStreakEl) {
      this.detentionStreakEl.textContent = `Série : ${detentionSnapshot.streak || 0}`;
    }
    if (this.detentionProgressEl) {
      this.detentionProgressEl.textContent = `TPs Survie : ${detentionSnapshot.completedTps || 0} / ${detentionSnapshot.totalTps || 5}`;
    }
    if (ex && this.detentionQuestionEl) {
      this.detentionQuestionEl.textContent = ex.question || '';
    }
    if (ex && this.detentionTableEl) {
      this.detentionTableEl.innerHTML = renderVariationTableMarkup(ex);
    }
    if (ex && this.detentionOptionsEl) {
      const letters = ['A', 'B', 'C', 'D'];
      this.detentionOptionsEl.innerHTML = (ex.options || [])
        .map(
          (opt, idx) =>
            `<button type="button" class="detention-opt-btn" data-opt-idx="${idx}">${letters[idx]}) ${escapeHtmlSafe(opt)}</button>`
        )
        .join('');
      this.detentionOptionsEl.querySelectorAll('.detention-opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-opt-idx'));
          this.survivalCallbacks?.onDetentionOption?.(idx);
        });
      });
    }
    if (this.detentionFeedbackEl) {
      this.detentionFeedbackEl.textContent =
        detentionSnapshot.feedback || 'Résolvez des tableaux pour aider l’atelier via le signal radar !';
      this.detentionFeedbackEl.classList.toggle('error', detentionSnapshot.lastCorrect === false);
    }
  }

  updateDetentionSurveillance(snapshot = {}, mapData = null) {
    const canvas = this.detentionSurvCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020817';
    ctx.fillRect(0, 0, w, h);

    const bounds = mapData?.bounds || { minX: -13, maxX: 13, minZ: -12.2, maxZ: 12.2 };
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
    const toX = (x) => 16 + ((x - bounds.minX) / spanX) * (w - 32);
    const toY = (z) => 16 + ((z - bounds.minZ) / spanZ) * (h - 32);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    for (const wall of mapData?.walls || []) {
      const wx = wall.cx ?? 0;
      const wz = wall.cz ?? 0;
      const ww = Math.max(2, ((wall.w || 0.3) / spanX) * (w - 32));
      const wd = Math.max(2, ((wall.d || 0.3) / spanZ) * (h - 32));
      ctx.fillStyle = 'rgba(148, 163, 184, 0.36)';
      ctx.fillRect(toX(wx) - ww / 2, toY(wz) - wd / 2, ww, wd);
    }

    const doneSet = new Set(snapshot.completedTps || []);
    for (const obj of mapData?.objects || []) {
      const cat = getCatalogItem(obj.type);
      if (cat?.tpId) {
        const px = toX(obj.x ?? 0);
        const py = toY(obj.z ?? 0);
        ctx.fillStyle = doneSet.has(cat.tpId) ? '#22c55e' : '#fbbf24';
        ctx.fillRect(px - 4, py - 4, 8, 8);
      } else if (obj.type === 'hiding_rack') {
        const px = toX(obj.x ?? 0);
        const py = toY(obj.z ?? 0);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(px - 3, py - 3, 6, 6);
      }
    }

    const parts = Array.isArray(snapshot.participants)
      ? snapshot.participants
      : Array.isArray(snapshot.players)
        ? snapshot.players
        : [];
    for (const p of parts) {
      if (p.status === 'detained' || p.detained) continue;
      const px = toX(p.x ?? 0);
      const py = toY(p.z ?? 0);
      ctx.fillStyle = p.hiddenRackId ? '#22d3ee' : '#34d399';
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(String(p.name || '').slice(0, 10), px + 7, py + 3);
    }

    if (snapshot.ai) {
      const ax = toX(snapshot.ai.x ?? 0);
      const ay = toY(snapshot.ai.z ?? 0);
      ctx.fillStyle = snapshot.ai.state === 'chase' ? '#ef4444' : '#fb923c';
      ctx.beginPath();
      ctx.arc(ax, ay, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  hideDetentionModal() {
    this.survivalDetentionModalEl?.classList.add('hidden');
  }

  showSurvivalIntroOverlay({
    phaseLabel = '⚡ COUPURE ÉLECTRIQUE — ALERTE INTRUSION',
    briefingText = '« Survivez, terminez tous les TPs et ne faites aucun bruit au micro... »',
    progress = 0
  } = {}) {
    if (!this.survivalIntroOverlayEl) return;
    this.survivalIntroOverlayEl.classList.remove('hidden');
    this.updateSurvivalIntroOverlay({ phaseLabel, briefingText, progress });
  }

  updateSurvivalIntroOverlay({ phaseLabel, briefingText, progress = 0 } = {}) {
    if (phaseLabel && this.survivalIntroPhaseEl) {
      this.survivalIntroPhaseEl.textContent = phaseLabel;
    }
    if (briefingText && this.survivalIntroBriefingEl) {
      this.survivalIntroBriefingEl.textContent = briefingText.startsWith('«')
        ? briefingText
        : `« ${briefingText} »`;
    }
    if (this.survivalIntroProgressEl) {
      const pct = Math.max(0, Math.min(100, Math.round((Number(progress) || 0) * 100)));
      this.survivalIntroProgressEl.style.width = `${pct}%`;
    }
  }

  hideSurvivalIntroOverlay() {
    this.survivalIntroOverlayEl?.classList.add('hidden');
  }

  showDetention3dHud(camInfo = {}) {
    if (this.detentionHudHidden) {
      this.hideDetention3dHud();
      return;
    }
    if (!this.survivalDetention3dHudEl) return;
    this.survivalDetention3dHudEl.classList.remove('hidden');
    if (this.detention3dCamLabelEl) {
      const idx = Math.max(1, (Number(camInfo.camIndex) || 0) + 1);
      const cnt = Math.max(1, Number(camInfo.camCount) || 1);
      this.detention3dCamLabelEl.textContent = `📹 [${idx}/${cnt}] ${camInfo.label || 'Caméra POV'}`;
    }
  }

  hideDetention3dHud() {
    this.survivalDetention3dHudEl?.classList.add('hidden');
  }

  showSurvivalEndOverlay({ victory = false, reason = '', completedTps = 0, totalTps = 5, survivorsCount = 0, detainedCount = 0, durationSec = 0 } = {}) {
    if (!this.survivalEndOverlayEl) return;
    this.survivalEndOverlayEl.classList.remove('hidden');
    this.survivalEndOverlayEl.classList.remove('is-compact');
    if (this.survivalEndCardEl) {
      this.survivalEndCardEl.classList.toggle('victory', Boolean(victory));
      this.survivalEndCardEl.classList.toggle('defeat', !victory);
    }
    if (this.survivalEndIconEl) this.survivalEndIconEl.textContent = victory ? '🏆' : '💀';
    if (this.survivalEndTitleEl) {
      this.survivalEndTitleEl.textContent = victory
        ? 'VICTOIRE COOPÉRATIVE !'
        : 'DÉFAITE — CLASSE EN HEURE DE COLLE';
    }
    if (this.survivalEndReasonEl) this.survivalEndReasonEl.textContent = reason || '';
    if (this.survivalEndStatsEl) {
      this.survivalEndStatsEl.textContent = `TPs terminés : ${completedTps}/${totalTps} • Survivants : ${survivorsCount} • Collés : ${detainedCount} • Durée : ${durationSec}s`;
    }
    if (this.survivalEndInspectBtn) {
      this.survivalEndInspectBtn.classList.toggle('hidden', Boolean(victory));
      this.survivalEndInspectBtn.textContent = '👀 Observer Salle de Colle 3D';
    }
  }

  hideSurvivalEndOverlay() {
    this.survivalEndOverlayEl?.classList.add('hidden');
    this.survivalEndOverlayEl?.classList.remove('is-compact');
  }

  setDetentionHudHidden(hidden, { restoreHud = true } = {}) {
    const next = Boolean(hidden);
    if (next && !this.detentionHudHidden) {
      this.hudWasVisibleBeforeDetention = Boolean(this.hudEl && !this.hudEl.classList.contains('hidden'));
    }
    this.detentionHudHidden = next;
    if (typeof document !== 'undefined' && document.body?.classList) {
      document.body.classList.toggle('survival-detention-active', next);
    }
    if (next) {
      this.closeAllModals();
      this.toggleChat(false);
      this.creatorPowerPopover?.classList.add('hidden');
      this.hideWorldCelebration();
      this.hideSecretSkinAnnouncement();
      this.hideSurvivalLobby();
      this.hideSurvivalIntroOverlay();
      this.hideSurvivalHud();
      this.hideHidingOverlay();
      this.hideDetentionModal();
      this.hideDetention3dHud();
      this.setInteractPrompt(null);
      this.hudEl?.classList.add('hidden');
      this.debugPanelEl?.classList.add('hidden');
      this.privateDebugBadgeEl?.classList.add('hidden');
      this.jpoBannerEl?.classList.add('hidden');
      this.voiceNearbyBar?.classList.add('hidden');
      this.orientationHintEl?.classList.add('hidden');
      return true;
    }
    if (restoreHud && this.hudWasVisibleBeforeDetention) {
      this.show();
    }
    this.hudWasVisibleBeforeDetention = false;
    this.setPrivateDebugMode(this.privateDebugActive, this.gameState?.room || '');
    this.setJpoMode(this.jpoState);
    return false;
  }

  hideAllSurvivalUi() {
    this.setDetentionHudHidden(false, { restoreHud: false });
    this.hideSurvivalLobby();
    this.hideSurvivalIntroOverlay();
    this.hideSurvivalHud();
    this.hideHidingOverlay();
    this.hideJumpscareOverlay();
    this.hideDetentionModal();
    this.hideDetention3dHud();
    this.hideSurvivalEndOverlay();
  }

  bindCombatHandlers(callbacks = {}) {
    this.combatCallbacks = callbacks;
    this.combatModeGunsBtn?.addEventListener('click', () => this.combatCallbacks?.onSelectMode?.('guns'));
    this.combatModeMeleeBtn?.addEventListener('click', () => this.combatCallbacks?.onSelectMode?.('melee'));
    this.combatBotsToggleBtn?.addEventListener('click', () => this.combatCallbacks?.onToggleBots?.());
    this.combatLobbyReadyBtn?.addEventListener('click', () => this.combatCallbacks?.onToggleReady?.());
    this.combatLobbyLeaveBtn?.addEventListener('click', () => this.combatCallbacks?.onLeaveLobby?.());
    this.combatLobbyCloseBtn?.addEventListener('click', () => this.combatCallbacks?.onLeaveLobby?.());
    this.combatHudLeaveBtn?.addEventListener('click', () => this.combatCallbacks?.onLeaveArena?.());
    this.combatHudScoreboardBtn?.addEventListener('click', () => this.combatCallbacks?.onToggleScoreboard?.());
    this.combatEndReplayBtn?.addEventListener('click', () => this.combatCallbacks?.onReplay?.());
    this.combatEndExitBtn?.addEventListener('click', () => this.combatCallbacks?.onExitArena?.());
  }

  showCombatLobby(snapshot = {}, localId = null) {
    if (!this.combatLobbyModalEl) return;
    this.combatLobbyModalEl.classList.remove('hidden');
    const mode = snapshot?.mode === 'melee' ? 'melee' : 'guns';
    const botsEnabled = snapshot?.botsEnabled !== undefined ? Boolean(snapshot.botsEnabled) : snapshot?.fillBots !== false;
    const players = Array.isArray(snapshot?.lobbyPlayers) ? snapshot.lobbyPlayers : [];
    const localPlayer = players.find((p) => p.id === localId);
    const localReady = Boolean(localPlayer?.ready);
    const weapons = getWeaponsByMode(mode);
    const selectedWeaponId = localPlayer?.weaponId || weapons[0]?.id;

    this.combatModeGunsBtn?.classList.toggle('active', mode === 'guns');
    this.combatModeMeleeBtn?.classList.toggle('active', mode === 'melee');
    if (this.combatBotsToggleBtn) {
      this.combatBotsToggleBtn.classList.toggle('active', botsEnabled);
      this.combatBotsToggleBtn.classList.toggle('off', !botsEnabled);
      this.combatBotsToggleBtn.textContent = botsEnabled ? '🤖 Bots IA : ACTIVÉS' : '🤖 Bots IA : DÉSACTIVÉS';
    }

    if (this.combatLobbyWeaponsEl) {
      this.combatLobbyWeaponsEl.innerHTML = weapons
        .map(
          (w) => `
          <button type="button" class="combat-weapon-choice ${w.id === selectedWeaponId ? 'selected' : ''}" data-weapon-id="${escapeHtmlSafe(w.id)}">
            <strong>${escapeHtmlSafe(w.icon)} ${escapeHtmlSafe(w.name)}</strong>
            <small>${escapeHtmlSafe(w.description)}</small>
            <small>Dégâts : ${w.damage} • Portée : ${w.range}m${w.magSize > 0 ? ` • Chargeur : ${w.magSize}` : ''}</small>
          </button>`
        )
        .join('');
      this.combatLobbyWeaponsEl.querySelectorAll('.combat-weapon-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          const wid = btn.getAttribute('data-weapon-id');
          if (wid) this.combatCallbacks?.onSelectWeapon?.(wid);
        });
      });
    }

    if (this.combatLobbyStatusEl) {
      const readyCount = players.filter((p) => p.ready).length;
      this.combatLobbyStatusEl.textContent =
        `Mode ${mode === 'melee' ? 'Mêlée ⚔️' : 'Fusils 🔫'} • ${readyCount}/${Math.max(1, players.length)} prêt(s) • ${botsEnabled ? 'Bots IA : ACTIVÉS (3+ bots)' : 'Bots IA : DÉSACTIVÉS (0 bot — Solo / PvP Pur)'}`;
    }

    if (this.combatLobbyPlayersEl) {
      this.combatLobbyPlayersEl.innerHTML = players
        .map((p) => {
          const wSpec = getCombatWeaponById(p.weaponId);
          return `
          <div class="survival-player-chip ${p.ready ? 'ready' : ''}">
            <span>${escapeHtmlSafe(p.name || 'Élève')}${p.id === localId ? ' (Vous)' : ''} • ${escapeHtmlSafe(wSpec?.shortName || '')}</span>
            <span>${p.ready ? '✅ Prêt' : '⏳ Attente'}</span>
          </div>`;
        })
        .join('');
    }

    if (this.combatLobbyReadyBtn) {
      this.combatLobbyReadyBtn.textContent = localReady ? '⏳ Annuler Prêt' : '⚔️ Prêt / Lancer l’Arène !';
    }
  }

  hideCombatLobby() {
    this.combatLobbyModalEl?.classList.add('hidden');
  }

  updateCombatHud(snapshot = {}, localId = null) {
    if (!this.combatHudEl) return;
    this._setCachedHidden(this.combatHudEl, 'combatHudHidden', false);
    const fighters = Array.isArray(snapshot?.fighters) ? snapshot.fighters : [];
    const me = fighters.find((f) => f.id === localId) || fighters[0] || null;
    const mode = snapshot?.mode === 'melee' ? 'melee' : 'guns';
    const timeSec = Math.max(0, Math.floor(Number(snapshot?.timeLeftSec) || 0));
    const mm = String(Math.floor(timeSec / 60)).padStart(2, '0');
    const ss = String(timeSec % 60).padStart(2, '0');

    this._setCachedText(this.combatHudModeEl, 'cMode', mode === 'melee' ? '⚔️ MODE MÊLÉE' : '🔫 MODE FUSILS');
    this._setCachedText(this.combatHudTimerEl, 'cTimer', `⏱️ ${mm}:${ss}`);
    if (me) {
      this._setCachedText(
        this.combatHudScoreEl,
        'cScore',
        `⚔️ ${me.kills || 0} / ${snapshot?.killLimit || 10} • 💀 ${me.deaths || 0} • 🔥 Série ${me.streak || 0}`
      );

      const hp = Math.max(0, Math.round(Number(me.hp) || 0));
      const maxHp = Math.max(1, Math.round(Number(me.maxHp) || 100));
      const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
      this._setCachedText(this.combatHpTextEl, 'cHpTxt', `${hp} / ${maxHp}`);
      if (this.combatHpFillEl) {
        const wStr = `${pct}%`;
        if (this._domCache.cHpW !== wStr) {
          this._domCache.cHpW = wStr;
          this.combatHpFillEl.style.width = wStr;
          this.domWriteCount++;
        }
        const bgStr =
          pct > 50
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : pct > 25
              ? 'linear-gradient(90deg, #d97706, #fbbf24)'
              : 'linear-gradient(90deg, #dc2626, #f87171)';
        if (this._domCache.cHpBg !== bgStr) {
          this._domCache.cHpBg = bgStr;
          this.combatHpFillEl.style.background = bgStr;
          this.domWriteCount++;
        }
      }

      if (this.combatRespawnBannerEl) {
        if (!me.alive) {
          const sec = Math.max(1, Math.ceil((me.respawnRemainingMs || 3000) / 1000));
          this._setCachedText(this.combatRespawnBannerEl, 'cRespTxt', `💥 Éliminé ! Réapparition dans ${sec}s...`);
          this._setCachedHidden(this.combatRespawnBannerEl, 'cRespHidden', false);
        } else {
          this._setCachedHidden(this.combatRespawnBannerEl, 'cRespHidden', true);
        }
      }

      const wSpec = getCombatWeaponById(me.weaponId) || getWeaponsByMode(mode)[0];
      if (wSpec) {
        this._setCachedText(this.combatWeaponNameEl, 'cWepName', `${wSpec.icon} ${wSpec.name}`);
        const ammoStr =
          mode === 'melee'
            ? '∞ Corps-à-corps'
            : me.reloading
              ? '🔄 Rechargement...'
              : `${me.ammo ?? wSpec.magSize} / ${wSpec.magSize}`;
        this._setCachedText(this.combatWeaponAmmoEl, 'cWepAmmo', ammoStr);
      }

      if (this.combatWeaponSlotsEl) {
        const slotsSig = `${mode}|${me.weaponId || ''}`;
        if (this._domCache.cSlotsSig !== slotsSig) {
          this._domCache.cSlotsSig = slotsSig;
          const modeWeapons = getWeaponsByMode(mode);
          this.combatWeaponSlotsEl.innerHTML = modeWeapons
            .map(
              (w) => `
            <button type="button" class="combat-slot-pill ${w.id === me.weaponId ? 'active' : ''}" data-slot-weapon="${escapeHtmlSafe(w.id)}">
              [${w.slot}] ${escapeHtmlSafe(w.shortName)}
            </button>`
            )
            .join('');
          this.combatWeaponSlotsEl.querySelectorAll('[data-slot-weapon]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const wid = btn.getAttribute('data-slot-weapon');
              if (wid) this.combatCallbacks?.onSelectWeapon?.(wid);
            });
          });
          this.domWriteCount++;
        }
      }
    }

    if (this.combatKillfeedEl) {
      const feed = Array.isArray(snapshot?.killfeed) ? snapshot.killfeed : [];
      let kfSig = '';
      const len = Math.min(4, feed.length);
      for (let i = 0; i < len; i++) {
        const kf = feed[i];
        kfSig += `${kf.killerName}|${kf.icon || ''}|${kf.victimName}|${kf.headshot ? 1 : 0};`;
      }
      if (this._domCache.cKfSig !== kfSig) {
        this._domCache.cKfSig = kfSig;
        this.combatKillfeedEl.innerHTML = feed
          .slice(0, 4)
          .map(
            (kf) => `
          <div class="combat-kf-item">
            ${escapeHtmlSafe(kf.killerName)} ${escapeHtmlSafe(kf.icon || '⚔️')} ${escapeHtmlSafe(kf.victimName)}${kf.headshot ? ' 🎯' : ''}
          </div>`
          )
          .join('');
        this.domWriteCount++;
      }
    }
  }

  updateCombatCrosshair({
    active = false,
    weaponId = 'fiber_rifle',
    mode = 'guns',
    spreadPx = 6,
    adsActive = false,
    inMeleeRange = false,
    guarding = false
  } = {}) {
    const cleanMode = mode === 'melee' ? 'melee' : 'guns';
    const cleanWeapon = weaponId || (cleanMode === 'melee' ? 'solder_iron_blade' : 'fiber_rifle');
    const hideForAds = Boolean(adsActive && cleanMode === 'guns');
    const clampedGap = Math.max(2, Math.min(44, Math.round(Number(spreadPx) || 6)));
    const st = this._combatCrosshairState;
    st.active = Boolean(active);
    st.weaponId = cleanWeapon;
    st.mode = cleanMode;
    st.adsActive = Boolean(adsActive);
    st.hiddenForAds = hideForAds;
    st.inMeleeRange = Boolean(inMeleeRange);
    st.guarding = Boolean(guarding);
    st.spreadPx = clampedGap;

    if (typeof document !== 'undefined' && document.body?.classList) {
      if (this._domCache.bodyCombat !== st.active) {
        this._domCache.bodyCombat = st.active;
        document.body.classList.toggle('combat-active', st.active);
        this.domWriteCount++;
      }
    }
    if (!this.combatCrosshairEl) return st;

    this._setCachedHidden(this.combatCrosshairEl, 'chHidden', !st.active);
    if (this._domCache.chAdsHidden !== hideForAds) {
      this._domCache.chAdsHidden = hideForAds;
      this.combatCrosshairEl.classList.toggle('ads-hidden', hideForAds);
      this.domWriteCount++;
    }
    const inRangeFlag = Boolean(inMeleeRange && cleanMode === 'melee');
    if (this._domCache.chInRange !== inRangeFlag) {
      this._domCache.chInRange = inRangeFlag;
      this.combatCrosshairEl.classList.toggle('in-range', inRangeFlag);
      this.domWriteCount++;
    }
    const guardFlag = Boolean(guarding && cleanMode === 'melee');
    if (this._domCache.chGuard !== guardFlag) {
      this._domCache.chGuard = guardFlag;
      this.combatCrosshairEl.classList.toggle('guarding', guardFlag);
      this.domWriteCount++;
    }
    const nextWepCls = cleanMode === 'melee' ? 'weapon-melee' : `weapon-${cleanWeapon}`;
    if (this._domCache.chWepCls !== nextWepCls) {
      if (this._domCache.chWepCls) {
        this.combatCrosshairEl.classList.remove(this._domCache.chWepCls);
      } else {
        this.combatCrosshairEl.classList.remove(
          'weapon-fiber_rifle',
          'weapon-udp_shotgun',
          'weapon-ping_sniper',
          'weapon-plasma_solder_pistol',
          'weapon-melee'
        );
      }
      this.combatCrosshairEl.classList.add(nextWepCls);
      this._domCache.chWepCls = nextWepCls;
      this.domWriteCount++;
    }
    if (this.combatCrosshairEl.style && this._domCache.chGap !== clampedGap) {
      this._domCache.chGap = clampedGap;
      if (typeof this.combatCrosshairEl.style.setProperty === 'function') {
        this.combatCrosshairEl.style.setProperty('--ch-gap', `${clampedGap}px`);
      } else {
        this.combatCrosshairEl.style['--ch-gap'] = `${clampedGap}px`;
      }
      this.domWriteCount++;
    }
    return st;
  }

  updateSniperScope({ active = false, elapsed = 0, targetDistance = null } = {}) {
    if (!this.combatSniperScopeEl) return Boolean(active);
    this._setCachedHidden(this.combatSniperScopeEl, 'scopeHidden', !active);
    if (!active) return false;
    if (this.combatScopeDistEl) {
      const distNum = Number(targetDistance);
      const distStr = Number.isFinite(distNum) && distNum > 0 ? `${distNum.toFixed(1)} m` : '--.- m';
      this._setCachedText(this.combatScopeDistEl, 'scopeDist', distStr);
    }
    const now = performance.now ? performance.now() : Date.now();
    if (this.combatScopeWaveCtx && now - this._combatScopeLastDrawMs >= 50) {
      this._combatScopeLastDrawMs = now;
      const ctx = this.combatScopeWaveCtx;
      const w = this.combatScopeWaveCanvas?.width || 220;
      const h = this.combatScopeWaveCanvas?.height || 54;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const t = x / w;
        const y = h / 2 + Math.sin(t * Math.PI * 6 + elapsed * 7.5) * (h * 0.32) * (0.65 + 0.35 * Math.sin(t * Math.PI));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return true;
  }

  hideCombatHud() {
    this._setCachedHidden(this.combatHudEl, 'combatHudHidden', true);
    this._setCachedHidden(this.combatCrosshairEl, 'chHidden', true);
    this._setCachedHidden(this.combatSniperScopeEl, 'scopeHidden', true);
    if (typeof document !== 'undefined' && document.body?.classList) {
      this._domCache.bodyCombat = false;
      document.body.classList.remove('combat-active');
    }
    this.combatHitmarkerEl?.classList.add('hidden');
    this._setCachedHidden(this.combatRespawnBannerEl, 'cRespHidden', true);
    this.combatDamageFlashEl?.classList.remove('active');
    this.combatScoreboardEl?.classList.add('hidden');
    if (this._combatHitmarkerTimer) {
      clearTimeout(this._combatHitmarkerTimer);
      this._combatHitmarkerTimer = null;
    }
    if (this._combatDamageTimer) {
      clearTimeout(this._combatDamageTimer);
      this._combatDamageTimer = null;
    }
  }

  triggerCombatHitmarker(isKill = false) {
    if (!this.combatHitmarkerEl) return;
    this.combatHitmarkerEl.classList.remove('hidden');
    this.combatHitmarkerEl.classList.toggle('kill', Boolean(isKill));
    if (this._combatHitmarkerTimer) clearTimeout(this._combatHitmarkerTimer);
    this._combatHitmarkerTimer = setTimeout(() => {
      this._combatHitmarkerTimer = null;
      this.combatHitmarkerEl?.classList.add('hidden');
    }, isKill ? 240 : 140);
  }

  triggerCombatDamageFlash() {
    if (!this.combatDamageFlashEl) return;
    this.combatDamageFlashEl.classList.add('active');
    if (this._combatDamageTimer) clearTimeout(this._combatDamageTimer);
    this._combatDamageTimer = setTimeout(() => {
      this._combatDamageTimer = null;
      this.combatDamageFlashEl?.classList.remove('active');
    }, 190);
  }

  toggleCombatScoreboard(show, snapshot = null, localId = null) {
    if (!this.combatScoreboardEl) return;
    const nextShow = typeof show === 'boolean' ? show : this.combatScoreboardEl.classList.contains('hidden');
    this.combatScoreboardEl.classList.toggle('hidden', !nextShow);
    if (nextShow && snapshot && this.combatScoreboardRowsEl) {
      const rows = Array.isArray(snapshot.scoreboard) ? snapshot.scoreboard : [];
      this.combatScoreboardRowsEl.innerHTML = rows
        .map(
          (r, i) => `
          <div class="combat-score-row ${r.id === localId ? 'me' : ''}">
            <span>#${i + 1}</span>
            <span>${escapeHtmlSafe(r.name)}${r.isBot ? ' 🤖' : ''}</span>
            <span>⚔️ ${r.kills} / 💀 ${r.deaths}</span>
          </div>`
        )
        .join('');
    }
  }

  showCombatEndOverlay({ won = false, reason = '', coinsEarned = 0, scoreboard = [], localId = null } = {}) {
    if (!this.combatEndOverlayEl) return;
    this.combatEndOverlayEl.classList.remove('hidden');
    if (this.combatEndIconEl) this.combatEndIconEl.textContent = won ? '🏆' : '⚔️';
    if (this.combatEndTitleEl) {
      this.combatEndTitleEl.textContent = won ? 'VICTOIRE DANS L’ARÈNE CIEL !' : 'FIN DE LA MANCHE DE COMBAT';
    }
    if (this.combatEndReasonEl) this.combatEndReasonEl.textContent = reason;
    if (this.combatEndCoinsEl) {
      this.combatEndCoinsEl.textContent = `🪙 Récompense : +${Math.max(0, Math.round(Number(coinsEarned) || 0))} CIEL Coins`;
    }
    if (this.combatEndTableEl) {
      this.combatEndTableEl.innerHTML = (Array.isArray(scoreboard) ? scoreboard : [])
        .map(
          (r, i) => `
          <div class="combat-score-row ${r.id === localId ? 'me' : ''}">
            <span>#${i + 1}</span>
            <span>${escapeHtmlSafe(r.name)}${r.isBot ? ' 🤖' : ''}</span>
            <span>⚔️ ${r.kills} Élim. • 💀 ${r.deaths} Morts</span>
          </div>`
        )
        .join('');
    }
  }

  hideCombatEndOverlay() {
    this.combatEndOverlayEl?.classList.add('hidden');
  }

  hideAllCombatUi() {
    this.hideCombatLobby();
    this.hideCombatHud();
    this.hideCombatEndOverlay();
  }
}
