import './admin.css';
import { renderSkinPreviewSvg } from '../world/AvatarBuilder.js';
import { TP_CATALOG } from '../core/gameState.js';
import { MapEditor } from './MapEditor.js';

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
const statPostsTotal = document.getElementById('stat-posts-total');
const lastSyncLabel = document.getElementById('last-sync-label');

const tabUsersBtn = document.getElementById('admin-tab-users');
const tabPostsBtn = document.getElementById('admin-tab-posts');
const tabPigeonsBtn = document.getElementById('admin-tab-pigeons');
const tabMapBtn = document.getElementById('admin-tab-map');
const panelUsers = document.getElementById('admin-panel-users');
const panelPosts = document.getElementById('admin-panel-posts');
const panelPigeons = document.getElementById('admin-panel-pigeons');
const panelMap = document.getElementById('admin-panel-map');
const mapEditorRoot = document.getElementById('map-editor-root');
const tabBadgeUsers = document.getElementById('tab-badge-users');
const tabBadgePosts = document.getElementById('tab-badge-posts');
const tabBadgePigeons = document.getElementById('tab-badge-pigeons');

const pigeonsStatTotalEl = document.getElementById('pigeons-stat-total');
const pigeonsStatLatestEl = document.getElementById('pigeons-stat-latest');
const pigeonsStatLatestTimeEl = document.getElementById('pigeons-stat-latest-time');
const pigeonsTbody = document.getElementById('pigeons-tbody');
const pigeonsEmptyEl = document.getElementById('pigeons-empty-state');
const clearPigeonsBtn = document.getElementById('btn-clear-pigeons');

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
let allPigeons = [];
let onlineOnly = false;
let activeSection = 'users';
let refreshTimer = null;
let pendingConfirmAction = null;
let mapEditor = null;

function ensureMapEditor() {
  if (!mapEditor && mapEditorRoot) {
    mapEditor = new MapEditor(mapEditorRoot, { apiFetch, showToast });
  }
  return mapEditor;
}

function switchAdminSection(section) {
  activeSection =
    section === 'posts'
      ? 'posts'
      : section === 'pigeons'
        ? 'pigeons'
        : section === 'map'
          ? 'map'
          : 'users';
  tabUsersBtn?.classList.toggle('active', activeSection === 'users');
  tabPostsBtn?.classList.toggle('active', activeSection === 'posts');
  tabPigeonsBtn?.classList.toggle('active', activeSection === 'pigeons');
  tabMapBtn?.classList.toggle('active', activeSection === 'map');
  panelUsers?.classList.toggle('hidden', activeSection !== 'users');
  panelPosts?.classList.toggle('hidden', activeSection !== 'posts');
  panelPigeons?.classList.toggle('hidden', activeSection !== 'pigeons');
  panelMap?.classList.toggle('hidden', activeSection !== 'map');
  dashboardEl?.classList.toggle('dashboard-wide', activeSection === 'map');
  if (activeSection === 'map') {
    ensureMapEditor()?.activate();
  } else {
    mapEditor?.deactivate();
  }
}

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
  const hm = `${hours}h ${String(mins).padStart(2, '0')}min`;
  if (hours === 0 && mins === 0 && remSec > 0) {
    return `${hm} (${remSec}s)`;
  }
  return hm;
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

function formatDateTimeSeconds(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} à ${hh}:${min}:${ss}`;
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
    const [data, sugData, pigeonsData] = await Promise.all([
      apiFetch('/api/admin/players'),
      fetch('/api/suggestions', { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => ({ suggestions: [] })),
      apiFetch('/api/admin/pigeons').catch(() => ({ pigeons: [] }))
    ]);
    allPlayers = Array.isArray(data.players) ? data.players : [];
    const rawSuggestions = Array.isArray(sugData.suggestions) ? sugData.suggestions : [];
    allSuggestions = [...rawSuggestions].sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    );
    const rawPigeons = Array.isArray(pigeonsData.pigeons) ? pigeonsData.pigeons : [];
    allPigeons = [...rawPigeons].sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    );
    const summary = data.summary || {};
    const totalCount = summary.totalPlayers ?? allPlayers.length;
    statTotalPlayers.textContent = String(totalCount);
    if (tabBadgeUsers) tabBadgeUsers.textContent = String(totalCount);
    statOnlineCount.textContent = String(
      summary.onlineCount ?? allPlayers.filter((p) => p.online).length
    );
    const totalSec =
      summary.totalPlaytimeSeconds ??
      allPlayers.reduce((acc, p) => acc + (p.playtimeSeconds || 0), 0);
    statTotalPlaytime.textContent = formatPlaytime(totalSec);
    if (statPostsTotal) statPostsTotal.textContent = String(allSuggestions.length);
    if (tabBadgePosts) tabBadgePosts.textContent = String(allSuggestions.length);
    if (tabBadgePigeons) tabBadgePigeons.textContent = String(allPigeons.length);
    lastSyncLabel.textContent = `Sync : ${new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
    renderPlayersTable();
    renderSuggestionsList();
    renderPigeonsTable();
  } catch (err) {
    if (!silent) showToast(err.message || 'Impossible de charger les élèves', 'error');
  }
}

function renderPigeonsTable() {
  if (!pigeonsTbody || !pigeonsEmptyEl) return;
  const total = allPigeons.length;
  if (pigeonsStatTotalEl) pigeonsStatTotalEl.textContent = String(total);
  if (tabBadgePigeons) tabBadgePigeons.textContent = String(total);
  if (clearPigeonsBtn) clearPigeonsBtn.disabled = total === 0;

  if (total === 0) {
    if (pigeonsStatLatestEl) pigeonsStatLatestEl.textContent = '--';
    if (pigeonsStatLatestTimeEl) pigeonsStatLatestTimeEl.textContent = 'Aucune tentative enregistrée';
    pigeonsTbody.innerHTML = '';
    pigeonsEmptyEl.classList.remove('hidden');
    return;
  }

  pigeonsEmptyEl.classList.add('hidden');
  const latest = allPigeons[0];
  if (pigeonsStatLatestEl) pigeonsStatLatestEl.textContent = latest.playerName || 'Élève Anonyme';
  if (pigeonsStatLatestTimeEl) {
    pigeonsStatLatestTimeEl.textContent = `${latest.platform === 'Mobile' ? '📱 Mobile' : '💻 PC'} • ${formatDateTimeSeconds(latest.createdAt)}`;
  }

  pigeonsTbody.innerHTML = allPigeons
    .map((p, idx) => {
      const isMobile = p.platform === 'Mobile';
      return `
        <tr>
          <td><span class="pigeon-rank-num">${idx === 0 ? '🐦 #1' : `#${idx + 1}`}</span></td>
          <td><strong class="pigeon-player-name">${escapeHtml(p.playerName)}</strong></td>
          <td>
            <span class="platform-chip ${isMobile ? 'mobile' : 'pc'}">
              ${isMobile ? '📱 Mobile' : '💻 PC'}
            </span>
          </td>
          <td><span class="date-val">${formatDateTimeSeconds(p.createdAt)}</span></td>
          <td>
            <button
              type="button"
              class="btn-delete"
              data-delete-pigeon="${escapeHtml(p.id)}"
              data-name="${escapeHtml(p.playerName)}"
            >
              🗑️ Supprimer
            </button>
          </td>
        </tr>`;
    })
    .join('');
}

function renderSuggestionsList() {
  if (!suggestionsListEl || !suggestionsEmptyEl) return;
  if (suggestionsCountEl) {
    const n = allSuggestions.length;
    suggestionsCountEl.textContent = n > 1 ? `${n} posts` : `${n} post`;
  }
  suggestionsEmptyEl.classList.toggle('hidden', allSuggestions.length > 0);
  suggestionsListEl.innerHTML = allSuggestions
    .map(
      (s) => `
      <article class="admin-suggestion-item">
        <div style="flex:1; min-width:220px;">
          <div class="admin-suggestion-meta">
            <span class="admin-suggestion-author">📝 ${escapeHtml(s.author)}</span>
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
           <div class="activity-sub">${escapeHtml(p.onlineRoom || 'plateau-u300')} • ${escapeHtml(p.onlineActivity || 'Atelier')}</div>`
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
  const isDeletePigeon = mode === 'delete_pigeon';
  const isClearPigeons = mode === 'clear_pigeons';
  const isDelete = mode === 'delete';
  const dangerMode = isDelete || isDeleteSuggestion || isDeletePigeon || isClearPigeons;
  confirmBadge.textContent = dangerMode ? 'SUPPRESSION DÉFINITIVE' : 'RÉINITIALISATION';
  confirmBadge.className = `confirm-badge ${dangerMode ? 'danger' : 'warn'}`;
  confirmTitle.textContent = isClearPigeons
    ? 'Vider tout l’historique des Pigeons ?'
    : isDeletePigeon
      ? `Supprimer l’entrée de "${extraLabel}" ?`
      : isDeleteSuggestion
        ? `Supprimer le post de "${extraLabel}" ?`
        : isDelete
          ? `Supprimer le compte "${targetValue}" ?`
          : `Réinitialiser "${targetValue}" à 0 ?`;
  confirmMessage.textContent = isClearPigeons
    ? 'Tous les clics enregistrés sur le Passe de Combat 10 € seront définitivement effacés.'
    : isDeletePigeon
      ? `Cette tentative de "${extraLabel}" sera supprimée de l’historique.`
      : isDeleteSuggestion
        ? `Ce post / rapport sera définitivement supprimé de la base de données.`
        : isDelete
          ? `Cette action supprimera définitivement le profil "${targetValue}" de db.json et déconnectera l'élève s'il est en ligne.`
          : `Toutes les notes de TP, l'XP, les diplômes et le temps de jeu de "${targetValue}" seront remis à zéro. Son compte et son skin seront conservés.`;

  confirmExecBtn.className = dangerMode ? 'btn-delete' : 'btn-reset';
  confirmExecBtn.textContent = dangerMode ? 'Oui, supprimer définitivement' : 'Oui, réinitialiser à 0';

  pendingConfirmAction = async () => {
    confirmExecBtn.disabled = true;
    try {
      const encoded = encodeURIComponent(targetValue);
      if (isClearPigeons) {
        await apiFetch('/api/admin/pigeons', { method: 'DELETE' });
        showToast('Historique des pigeons vidé.', 'success');
      } else if (isDeletePigeon) {
        await apiFetch(`/api/admin/pigeons/${encoded}`, { method: 'DELETE' });
        showToast('Entrée supprimée.', 'success');
      } else if (isDeleteSuggestion) {
        await apiFetch(`/api/admin/suggestions/${encoded}`, { method: 'DELETE' });
        showToast('Post / rapport supprimé.', 'success');
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
logoutBtn.addEventListener('click', () => {
  switchAdminSection('users');
  clearSession();
});

tabUsersBtn?.addEventListener('click', () => switchAdminSection('users'));
tabPostsBtn?.addEventListener('click', () => switchAdminSection('posts'));
tabPigeonsBtn?.addEventListener('click', () => switchAdminSection('pigeons'));
tabMapBtn?.addEventListener('click', () => switchAdminSection('map'));

clearPigeonsBtn?.addEventListener('click', () => {
  if (allPigeons.length === 0) return;
  openConfirmModal('clear_pigeons', 'all');
});

pigeonsTbody?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-delete-pigeon]');
  if (!btn) return;
  const id = btn.dataset.deletePigeon;
  const name = btn.dataset.name || 'Élève Anonyme';
  if (!id) return;
  openConfirmModal('delete_pigeon', id, name);
});

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
