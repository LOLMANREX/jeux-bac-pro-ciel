import './admin.css';
import { renderSkinPreviewSvg } from '../world/AvatarBuilder.js';
import { TP_CATALOG } from '../core/gameState.js';

const TOKEN_STORAGE_KEY = 'ciel_admin_token';

const loginScreen = document.getElementById('admin-login-screen');
const dashboardEl = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('admin-login-form');
const passwordInput = document.getElementById('admin-password-input');
const togglePwBtn = document.getElementById('btn-toggle-pw');
const loginErrorEl = document.getElementById('login-error');

const statTotalPlayers = document.getElementById('stat-total-players');
const statOnlineCount = document.getElementById('stat-online-count');
const statTotalPlaytime = document.getElementById('stat-total-playtime');
const lastSyncLabel = document.getElementById('last-sync-label');

const searchInput = document.getElementById('search-player-input');
const sortSelect = document.getElementById('sort-select');
const filterOnlineBtn = document.getElementById('btn-filter-online');
const refreshBtn = document.getElementById('btn-refresh');
const logoutBtn = document.getElementById('btn-logout');

const tbody = document.getElementById('players-tbody');
const emptyStateEl = document.getElementById('empty-state');
const suggestionsCountEl = document.getElementById('stat-suggestions-count');
const suggestionsListEl = document.getElementById('admin-suggestions-list');
const suggestionsEmptyEl = document.getElementById('admin-suggestions-empty');

const confirmModal = document.getElementById('admin-confirm-modal');
const confirmBadge = document.getElementById('confirm-badge');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('btn-confirm-cancel');
const confirmExecBtn = document.getElementById('btn-confirm-exec');
const toastContainer = document.getElementById('admin-toast-container');

let adminToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
let allPlayers = [];
let allSuggestions = [];
let onlineOnly = false;
let refreshTimer = null;
let pendingConfirmAction = null;

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(text, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function formatPlaytime(totalSeconds) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  if (mins > 0) return `${mins}m ${String(remSec).padStart(2, '0')}s`;
  return `${remSec}s`;
}

function formatDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function setAuthenticated(authenticated) {
  loginScreen.classList.toggle('hidden', authenticated);
  dashboardEl.classList.toggle('hidden', !authenticated);
  if (!authenticated) {
    stopAutoRefresh();
    passwordInput.value = '';
  } else {
    startAutoRefresh();
  }
}

function clearSession(msg = '') {
  adminToken = '';
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  setAuthenticated(false);
  if (msg) {
    loginErrorEl.textContent = msg;
    loginErrorEl.classList.remove('hidden');
  }
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearSession(data.error || 'Session expirée, veuillez vous reconnecter.');
    throw new Error(data.error || 'Non autorisé');
  }
  if (!res.ok) {
    throw new Error(data.error || `Erreur HTTP ${res.status}`);
  }
  return data;
}

async function loadPlayers(silent = false) {
  if (!adminToken) return;
  try {
    const [data, sugData] = await Promise.all([
      apiFetch('/api/admin/players'),
      fetch('/api/suggestions').then((r) => r.json()).catch(() => ({ suggestions: [] }))
    ]);
    allPlayers = Array.isArray(data.players) ? data.players : [];
    allSuggestions = Array.isArray(sugData.suggestions) ? sugData.suggestions : [];
    const summary = data.summary || {};
    statTotalPlayers.textContent = String(summary.totalPlayers ?? allPlayers.length);
    statOnlineCount.textContent = String(
      summary.onlineCount ?? allPlayers.filter((p) => p.online).length
    );
    const totalSec =
      summary.totalPlaytimeSeconds ??
      allPlayers.reduce((acc, p) => acc + (p.playtimeSeconds || 0), 0);
    statTotalPlaytime.textContent = formatPlaytime(totalSec);
    lastSyncLabel.textContent = `Sync : ${new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
    renderPlayersTable();
    renderSuggestionsList();
  } catch (err) {
    if (!silent) showToast(err.message || 'Impossible de charger les élèves', 'error');
  }
}

function renderSuggestionsList() {
  if (!suggestionsListEl || !suggestionsEmptyEl) return;
  if (suggestionsCountEl) {
    const n = allSuggestions.length;
    suggestionsCountEl.textContent = n > 1 ? `${n} idées` : `${n} idée`;
  }
  suggestionsEmptyEl.classList.toggle('hidden', allSuggestions.length > 0);
  suggestionsListEl.innerHTML = allSuggestions
    .map(
      (s) => `
      <article class="admin-suggestion-item">
        <div style="flex:1; min-width:220px;">
          <div class="admin-suggestion-meta">
            <span class="admin-suggestion-author">💡 ${escapeHtml(s.author)}</span>
            <span class="admin-suggestion-date">${formatDateTime(s.createdAt)}</span>
          </div>
          <p class="admin-suggestion-text">${escapeHtml(s.message)}</p>
        </div>
        <button
          type="button"
          class="btn-delete"
          data-delete-suggestion="${escapeHtml(s.id)}"
          data-author="${escapeHtml(s.author)}"
        >
          🗑️ Supprimer
        </button>
      </article>`
    )
    .join('');
}

function getFilteredSortedPlayers() {
  const q = searchInput.value.trim().toLowerCase();
  const sortBy = sortSelect.value;

  const filtered = allPlayers.filter((p) => {
    if (onlineOnly && !p.online) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'playtime') {
      return (b.playtimeSeconds || 0) - (a.playtimeSeconds || 0);
    }
    if (sortBy === 'average') {
      const avgA = typeof a.average === 'number' ? a.average : -1;
      const avgB = typeof b.average === 'number' ? b.average : -1;
      if (avgB !== avgA) return avgB - avgA;
      return (b.xp || 0) - (a.xp || 0);
    }
    if (sortBy === 'xp') {
      return (b.xp || 0) - (a.xp || 0);
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name, 'fr');
    }
    const tsA = Date.parse(a.lastSeen || a.lastLogin || a.updatedAt || 0) || 0;
    const tsB = Date.parse(b.lastSeen || b.lastLogin || b.updatedAt || 0) || 0;
    return tsB - tsA;
  });

  return filtered;
}

function renderPlayersTable() {
  const list = getFilteredSortedPlayers();
  emptyStateEl.classList.toggle('hidden', list.length > 0);

  tbody.innerHTML = list
    .map((p) => {
      const tpChips = TP_CATALOG.map((tp) => {
        const g = p.grades?.[tp.id];
        if (typeof g !== 'number') {
          return `<span class="tp-chip empty">${escapeHtml(tp.shortTitle)}: --</span>`;
        }
        const cls = g >= 10 ? 'ok' : 'low';
        return `<span class="tp-chip ${cls}">${escapeHtml(tp.shortTitle)}: ${g.toFixed(1)}</span>`;
      }).join('');

      const avgTxt = typeof p.average === 'number' ? `${p.average.toFixed(1)} / 20` : '-- / 20';
      const statusHtml = p.online
        ? `<span class="status-pill online"><span class="dot"></span>En ligne</span>
           <div class="activity-sub">${escapeHtml(p.onlineRoom || 'salle-e204')} • ${escapeHtml(p.onlineActivity || 'Atelier')}</div>`
        : `<span class="status-pill offline"><span class="dot"></span>Hors ligne</span>`;

      return `
        <tr>
          <td>
            <div class="player-cell">
              ${renderSkinPreviewSvg(p.skin, 44)}
              <div>
                <div class="player-name-row">
                  <span>${escapeHtml(p.name)}</span>
                  ${p.diplomaEarned ? '<span>🎓</span>' : ''}
                </div>
                <div class="player-sub">${escapeHtml(p.rankLabel || 'Apprenti CIEL')} • ${p.completedCount || 0}/5 TP</div>
                <div class="tp-chips">${tpChips}</div>
              </div>
            </div>
          </td>
          <td>${statusHtml}</td>
          <td><span class="playtime-val">${formatPlaytime(p.playtimeSeconds)}</span></td>
          <td>
            <div class="date-val">${formatDateTime(p.lastSeen || p.lastLogin)}</div>
            <div class="player-sub">Créé : ${formatDateTime(p.createdAt)}</div>
          </td>
          <td>
            <div class="avg-val">${avgTxt}</div>
            <div class="player-sub">${escapeHtml(p.mention || 'En cours')}</div>
          </td>
          <td><span class="xp-val">${p.xp || 0} XP</span></td>
          <td>
            <div class="actions-cell">
              <button
                type="button"
                class="btn-reset"
                data-action="reset"
                data-name="${escapeHtml(p.name)}"
              >
                🔄 Réinitialiser à 0
              </button>
              <button
                type="button"
                class="btn-delete"
                data-action="delete"
                data-name="${escapeHtml(p.name)}"
              >
                🗑️ Supprimer
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

function openConfirmModal(mode, targetValue, extraLabel = '') {
  const isDeleteSuggestion = mode === 'delete_suggestion';
  const isDelete = mode === 'delete';
  confirmBadge.textContent = isDelete || isDeleteSuggestion ? 'SUPPRESSION DÉFINITIVE' : 'RÉINITIALISATION';
  confirmBadge.className = `confirm-badge ${isDelete || isDeleteSuggestion ? 'danger' : 'warn'}`;
  confirmTitle.textContent = isDeleteSuggestion
    ? `Supprimer la suggestion de "${extraLabel}" ?`
    : isDelete
      ? `Supprimer le compte "${targetValue}" ?`
      : `Réinitialiser "${targetValue}" à 0 ?`;
  confirmMessage.textContent = isDeleteSuggestion
    ? `Cette suggestion sera définitivement supprimée de la boîte à idées.`
    : isDelete
      ? `Cette action supprimera définitivement le profil "${targetValue}" de db.json et déconnectera l'élève s'il est en ligne.`
      : `Toutes les notes de TP, l'XP, les diplômes et le temps de jeu de "${targetValue}" seront remis à zéro. Son compte et son skin seront conservés.`;

  confirmExecBtn.className = isDelete || isDeleteSuggestion ? 'btn-delete' : 'btn-reset';
  confirmExecBtn.textContent = isDelete || isDeleteSuggestion ? 'Oui, supprimer définitivement' : 'Oui, réinitialiser à 0';

  pendingConfirmAction = async () => {
    confirmExecBtn.disabled = true;
    try {
      const encoded = encodeURIComponent(targetValue);
      if (isDeleteSuggestion) {
        await apiFetch(`/api/admin/suggestions/${encoded}`, { method: 'DELETE' });
        showToast('Suggestion supprimée.', 'success');
      } else if (isDelete) {
        await apiFetch(`/api/admin/players/${encoded}`, { method: 'DELETE' });
        showToast(`Profil "${targetValue}" supprimé.`, 'success');
      } else {
        await apiFetch(`/api/admin/players/${encoded}/reset`, { method: 'POST' });
        showToast(`Progression de "${targetValue}" réinitialisée à 0.`, 'success');
      }
      closeConfirmModal();
      await loadPlayers(true);
    } catch (err) {
      showToast(err.message || 'Erreur lors de l’opération', 'error');
    } finally {
      confirmExecBtn.disabled = false;
    }
  };

  confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  confirmModal.classList.add('hidden');
  pendingConfirmAction = null;
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => loadPlayers(true), 15000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

togglePwBtn.addEventListener('click', () => {
  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErrorEl.classList.add('hidden');
  const password = passwordInput.value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      loginErrorEl.textContent = data.error || 'Mot de passe incorrect';
      loginErrorEl.classList.remove('hidden');
      return;
    }
    adminToken = data.token;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, adminToken);
    setAuthenticated(true);
    await loadPlayers();
    showToast('Connecté à la console administrateur', 'success');
  } catch {
    loginErrorEl.textContent = 'Impossible de joindre le serveur.';
    loginErrorEl.classList.remove('hidden');
  }
});

refreshBtn.addEventListener('click', () => loadPlayers());
logoutBtn.addEventListener('click', () => clearSession());

searchInput.addEventListener('input', renderPlayersTable);
sortSelect.addEventListener('change', renderPlayersTable);
filterOnlineBtn.addEventListener('click', () => {
  onlineOnly = !onlineOnly;
  filterOnlineBtn.classList.toggle('active', onlineOnly);
  renderPlayersTable();
});

tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const name = btn.dataset.name;
  if (!name) return;
  openConfirmModal(action, name);
});

suggestionsListEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-delete-suggestion]');
  if (!btn) return;
  const id = btn.dataset.deleteSuggestion;
  const author = btn.dataset.author || 'Anonyme';
  if (!id) return;
  openConfirmModal('delete_suggestion', id, author);
});

confirmCancelBtn.addEventListener('click', closeConfirmModal);
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) closeConfirmModal();
});
confirmExecBtn.addEventListener('click', () => {
  if (pendingConfirmAction) pendingConfirmAction();
});

if (adminToken) {
  setAuthenticated(true);
  loadPlayers();
}
