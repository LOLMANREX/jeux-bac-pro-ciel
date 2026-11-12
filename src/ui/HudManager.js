import { sfx } from '../core/audio.js';
import { getMention, QUICK_EMOTES, TP_CATALOG } from '../core/gameState.js';
import { renderSkinPreviewSvg } from '../world/AvatarBuilder.js';
import { pickRandomSkin, renderSkinControls, SkinPreview3D } from './SkinCustomizer.js';

export class HudManager {
  constructor(gameState, network, handlers) {
    this.gameState = gameState;
    this.network = network;
    this.handlers = handlers;

    this.hudEl = document.getElementById('hud');
    this.nameEl = document.getElementById('hud-player-name');
    this.xpEl = document.getElementById('hud-player-xp');
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
    this.unreadChat = 0;
    this.lastEmoteAt = 0;

    this.leaderboardModal = document.getElementById('leaderboard-modal');
    this.leaderboardSummary = document.getElementById('leaderboard-summary');
    this.leaderboardPodium = document.getElementById('leaderboard-podium');
    this.leaderboardBody = document.getElementById('leaderboard-body');
    this.settingsModal = document.getElementById('settings-modal');
    this.skinModal = document.getElementById('skin-modal');

    this.skinIds = {
      style: 'hud-skin-style-list',
      color: 'hud-skin-color-list',
      hat: 'hud-skin-hat-list',
      tone: 'hud-skin-tone-list',
      pants: 'hud-skin-pants-list'
    };
    this.skinPreview = new SkinPreview3D(
      document.getElementById('hud-skin-preview-canvas'),
      () => this.gameState.skin,
      240,
      290
    );

    this.toastContainer = document.getElementById('toast-container');

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
    };

    muteBtn?.addEventListener('click', () => {
      sfx.toggleMute();
      syncMuteUi();
    });

    const fovSlider = document.getElementById('set-fov');
    const fovVal = document.getElementById('set-fov-val');
    const cameraSelect = document.getElementById('set-camera-mode');
    const viewModeBtn = document.getElementById('btn-view-mode');
    const qualitySelect = document.getElementById('set-quality');
    const sensSlider = document.getElementById('set-sens');
    const sensVal = document.getElementById('set-sens-val');

    const syncSettingsUi = () => {
      if (fovSlider) fovSlider.value = String(this.gameState.fov);
      if (fovVal) fovVal.textContent = `${this.gameState.fov}°`;
      if (cameraSelect) cameraSelect.value = this.gameState.cameraMode;
      if (viewModeBtn) {
        viewModeBtn.textContent =
          this.gameState.cameraMode === 'third' ? '🎥 Vue: 3ème' : '🎥 Vue: 1ère';
      }
      if (qualitySelect) qualitySelect.value = this.gameState.quality;
      if (sensSlider) sensSlider.value = String(this.gameState.mouseSens);
      if (sensVal) sensVal.textContent = `${this.gameState.mouseSens.toFixed(1)}×`;
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

    document.getElementById('btn-orientation-dismiss')?.addEventListener('click', () => {
      sfx.click();
      this.orientationDismissed = true;
      this.orientationHintEl?.classList.add('hidden');
    });

    window.addEventListener('resize', () => this.updateOrientationHint());
    window.addEventListener('orientationchange', () => this.updateOrientationHint());

    cameraSelect?.addEventListener('change', () => {
      sfx.click();
      const mode = cameraSelect.value;
      this.gameState.setCameraMode(mode);
      this.handlers.onCameraModeChange?.(mode);
      syncSettingsUi();
    });

    const openSettings = () => {
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

    sensSlider?.addEventListener('input', () => {
      const s = Number(sensSlider.value);
      this.gameState.setMouseSens(s);
      this.handlers.onSensitivityChange?.(s);
      syncSettingsUi();
    });

    soundCheck?.addEventListener('change', () => {
      sfx.setMuted(!soundCheck.checked);
      syncMuteUi();
    });

    document.getElementById('set-reset-btn')?.addEventListener('click', () => {
      sfx.click();
      this.gameState.setFov(70);
      this.gameState.setCameraMode('first');
      this.gameState.setQuality('high');
      this.gameState.setMouseSens(1.0);
      sfx.setMuted(false);
      this.handlers.onFovChange?.(70);
      this.handlers.onCameraModeChange?.('first');
      this.handlers.onQualityChange?.('high');
      this.handlers.onSensitivityChange?.(1.0);
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

    document.getElementById('btn-skin-ingame')?.addEventListener('click', () => {
      sfx.click();
      this.openSkinModal();
    });

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

  _refreshInGameSkinUi() {
    renderSkinControls(this.skinIds, this.gameState, (updatedSkin) => {
      this.skinPreview.rebuild();
      this.handlers.onSkinChange?.(updatedSkin);
    });
    this.skinPreview.rebuild();
  }

  openSkinModal() {
    this._refreshInGameSkinUi();
    this.skinModal.classList.remove('hidden');
    this.skinPreview.setActive(true);
    this.handlers.onModalOpen?.(true);
  }

  closeSkinModal() {
    if (this.skinModal.classList.contains('hidden')) return false;
    this.skinPreview.setActive(false);
    this.skinModal.classList.add('hidden');
    this.handlers.onModalOpen?.(false);
    return true;
  }

  closeSettings() {
    if (this.settingsModal.classList.contains('hidden')) return false;
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
    this.closeLeaderboard();
    this.closeSkinModal();
    this.closeSettings();
    this.rosterPopover.classList.add('hidden');
  }

  toggleChat(forceOpen = null, focusInput = false) {
    const isClosed = this.chatDrawer.classList.contains('hidden');
    const shouldOpen = forceOpen === null ? isClosed : Boolean(forceOpen);
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
      this.chatInput.blur();
    }
  }

  _renderQuickNav() {
    this.quickNavEl.innerHTML = '';
    const fortinBtn = document.createElement('button');
    fortinBtn.type = 'button';
    fortinBtn.className = 'btn-quick fortin';
    fortinBtn.textContent = '👨‍🏫 M. Fortin';
    fortinBtn.addEventListener('click', () => {
      sfx.click();
      this.handlers.onQuickNav?.('fortin');
      if (window.innerWidth <= 900 || window.innerHeight <= 560) {
        this.setQuestCollapsed?.(true);
      }
    });
    this.quickNavEl.appendChild(fortinBtn);

    TP_CATALOG.forEach((tp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-quick';
      btn.textContent = `${tp.icon} ${tp.shortTitle}`;
      btn.addEventListener('click', () => {
        sfx.click();
        this.handlers.onQuickNav?.(tp.id);
        if (window.innerWidth <= 900 || window.innerHeight <= 560) {
          this.setQuestCollapsed?.(true);
        }
      });
      this.quickNavEl.appendChild(btn);
    });
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

  updateOrientationHint() {
    if (!this.orientationHintEl) return;
    const hudVisible = !this.hudEl.classList.contains('hidden');
    const isPortraitNarrow = window.innerWidth < 680 && window.innerHeight > window.innerWidth;
    const show = hudVisible && !this.orientationDismissed && isPortraitNarrow;
    this.orientationHintEl.classList.toggle('hidden', !show);
  }

  show() {
    this.hudEl.classList.remove('hidden');
    this.chatRoomNameEl.textContent = this.gameState.room;
    if (this.netRoomTag) this.netRoomTag.textContent = this.gameState.room;
    this.syncTouchUi?.();
    if (window.innerWidth <= 900 || window.innerHeight <= 560) {
      this.setQuestCollapsed?.(true);
    } else {
      this.setQuestCollapsed?.(false);
    }
    this.updateOrientationHint();
    this.refresh();
  }

  hide() {
    this.closeAllModals();
    this.netErrorBanner?.classList.add('hidden');
    this.orientationHintEl?.classList.add('hidden');
    this.hudEl.classList.add('hidden');
    this.chatDrawer.classList.add('hidden');
    this.interactPromptEl.classList.add('hidden');
  }

  refresh() {
    const p = this.gameState.profile;
    this.nameEl.textContent = p.name;
    this.xpEl.textContent = `${p.xp} XP`;
    this.avgEl.textContent = p.average !== null ? `${p.average.toFixed(1)} / 20` : '-- / 20';

    const completed = p.completedCount || 0;
    this.questProgressEl.textContent = `${completed} / 5`;

    if (!p.questAccepted) {
      this.questHintEl.innerHTML = 'Allez parler à <strong>M. Fortin</strong> (👨‍🏫) au centre de la salle.';
    } else if (p.diplomaEarned) {
      this.questHintEl.innerHTML = `🎓 <strong>BAC PRO CIEL validé !</strong> (${getMention(p.average)}) — Retournez voir M. Fortin !`;
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
      if (this.netErrorBanner && this.netErrorText && status.state === 'reconnecting') {
        const sec = Math.max(1, Math.round((status.delayMs || 2000) / 1000));
        this.netErrorText.textContent = `⚠️ ${errDetail} — Nouvelle tentative dans ${sec}s...`;
        this.netErrorBanner.classList.remove('hidden');
      }
    }

    if (this.netRoomTag) this.netRoomTag.textContent = this.gameState.room;
    if (typeof onlineCount === 'number') {
      const label = onlineCount > 1 ? `${onlineCount} élèves` : `${onlineCount} élève`;
      this.onlineCountEl.textContent = label;
      if (this.chatRoomCountEl) this.chatRoomCountEl.textContent = String(onlineCount);
    }
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
    if (!target) {
      this.interactPromptEl.classList.add('hidden');
      return;
    }
    this.interactPromptEl.classList.remove('hidden');
    this.interactLabelEl.textContent = target.label;
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
        return `
          <div class="podium-card place-${place} ${isSelf ? 'self' : ''}">
            <div class="podium-rank">${medalByRank[place] || `#${place}`}</div>
            <div class="podium-avatar">${renderSkinPreviewSvg(row.skin, 54)}</div>
            <div class="podium-name">${this._escape(row.name)} ${row.diplomaEarned ? '🎓' : ''}</div>
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
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
}
