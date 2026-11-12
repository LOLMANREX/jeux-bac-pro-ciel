import { sfx } from '../core/audio.js';
import { getMention, TP_CATALOG } from '../core/gameState.js';

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
    this.onlineCountEl = document.getElementById('online-count');

    this.questProgressEl = document.getElementById('quest-progress-text');
    this.questHintEl = document.getElementById('quest-objective-hint');
    this.questListEl = document.getElementById('quest-list');
    this.quickNavEl = document.getElementById('quick-nav-buttons');

    this.interactPromptEl = document.getElementById('interact-prompt');
    this.interactLabelEl = document.getElementById('interact-label');

    this.chatDrawer = document.getElementById('chat-drawer');
    this.chatMessagesEl = document.getElementById('chat-messages');
    this.chatRoomNameEl = document.getElementById('chat-room-name');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');

    this.leaderboardModal = document.getElementById('leaderboard-modal');
    this.leaderboardBody = document.getElementById('leaderboard-body');

    this.toastContainer = document.getElementById('toast-container');

    this._bindControls();
    this._renderQuickNav();
    this.gameState.subscribe(() => this.refresh());
  }

  _bindControls() {
    const qualityBtn = document.getElementById('btn-quality');
    const qualityOrder = ['high', 'balanced', 'eco'];
    const qualityLabels = { high: 'Élevée', balanced: 'Équilibrée', eco: 'Éco (PC Lycée)' };
    const updateQualityLabel = () => {
      qualityBtn.textContent = `⚙️ Qualité: ${qualityLabels[this.gameState.quality] || 'Élevée'}`;
    };
    updateQualityLabel();

    qualityBtn.addEventListener('click', () => {
      sfx.click();
      const idx = qualityOrder.indexOf(this.gameState.quality);
      const next = qualityOrder[(idx + 1) % qualityOrder.length];
      this.gameState.setQuality(next);
      this.handlers.onQualityChange?.(next);
      updateQualityLabel();
      this.toast(`Qualité 3D : ${qualityLabels[next]}`);
    });

    const muteBtn = document.getElementById('btn-mute');
    muteBtn.addEventListener('click', () => {
      const muted = sfx.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    document.getElementById('btn-chat-toggle').addEventListener('click', () => {
      sfx.click();
      this.chatDrawer.classList.toggle('hidden');
    });
    document.getElementById('btn-chat-close').addEventListener('click', () => {
      sfx.click();
      this.chatDrawer.classList.add('hidden');
    });

    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = this.chatInput.value.trim();
      if (!txt) return;
      this.network.sendChat(txt);
      this.chatInput.value = '';
    });

    document.getElementById('btn-leaderboard').addEventListener('click', async () => {
      sfx.click();
      this.leaderboardModal.classList.remove('hidden');
      this.handlers.onModalOpen?.(true);
      this.leaderboardBody.innerHTML = '<p>Chargement du classement...</p>';
      const list = await this.network.fetchLeaderboard();
      this.renderLeaderboard(list);
    });

    document.getElementById('leaderboard-close').addEventListener('click', () => {
      sfx.click();
      this.leaderboardModal.classList.add('hidden');
      this.handlers.onModalOpen?.(false);
    });
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
      });
      this.quickNavEl.appendChild(btn);
    });
  }

  show() {
    this.hudEl.classList.remove('hidden');
    this.chatRoomNameEl.textContent = this.gameState.room;
    this.refresh();
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

  setNetworkStatus(connected, onlineCount) {
    this.netPill.classList.toggle('online', connected);
    this.netText.textContent = connected ? 'Serveur OK' : 'Reconnexion...';
    if (typeof onlineCount === 'number') {
      this.onlineCountEl.textContent = String(onlineCount);
    }
  }

  setInteractPrompt(target) {
    if (!target) {
      this.interactPromptEl.classList.add('hidden');
      return;
    }
    this.interactPromptEl.classList.remove('hidden');
    this.interactLabelEl.textContent = target.label;
  }

  appendChatMessage(msg) {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.system ? 'system' : ''}`;
    if (msg.system) {
      div.innerHTML = `<strong>👨‍🏫 ${msg.author} :</strong> ${this._escape(msg.text)}`;
    } else {
      div.innerHTML = `<strong style="color:${msg.color || '#22d3ee'}">${this._escape(msg.author)} :</strong> ${this._escape(msg.text)}`;
    }
    this.chatMessagesEl.appendChild(div);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }

  renderLeaderboard(list) {
    if (!list || list.length === 0) {
      this.leaderboardBody.innerHTML = '<p>Aucun résultat enregistré pour le moment.</p>';
      return;
    }
    this.leaderboardBody.innerHTML = `
      <table class="os-table">
        <thead>
          <tr><th>#</th><th>Élève</th><th>TPs validés</th><th>Moyenne</th><th>XP</th></tr>
        </thead>
        <tbody>
          ${list
            .map(
              (row, i) => `
            <tr>
              <td><strong>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</strong></td>
              <td><span style="color:${row.color || '#22d3ee'}">●</span> <strong>${this._escape(row.name)}</strong> ${row.diplomaEarned ? '🎓' : ''}</td>
              <td>${row.completedCount} / 5</td>
              <td><strong>${row.average !== null ? `${row.average.toFixed(1)}/20` : '--'}</strong></td>
              <td>${row.xp} XP</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
}
