import './admin.css';
import {
  BATTLE_PASS_SKIN_CATALOG,
  getBattlePassTierSpec,
  isYanfufuUsername,
  normalizeBattlePassTierList
} from '../core/battlePassSkins.js';
import { renderSkinPreviewSvg, resolveAscensionSpecialty } from '../world/AvatarBuilder.js';
import { TP_CATALOG } from '../core/gameState.js';
import { MapEditor } from './MapEditor.js';
import { METAL_PIPE } from '../core/metalPipe.js';
import { PRIVATE_DEBUG_STORAGE_KEY, requestPrivateDebugSession } from '../admin.js';
import {
  JPO_ROOMS,
  getJpoRoomConfig,
  isJpoRoomActive,
  readJpoConfig,
  saveJpoConfig
} from '../core/jpoConfig.js';

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

const tabAccountsBtn = document.getElementById('admin-tab-accounts');
const tabUsersBtn = document.getElementById('admin-tab-users');
const tabPostsBtn = document.getElementById('admin-tab-posts');
const tabPigeonsBtn = document.getElementById('admin-tab-pigeons');
const tabMapBtn = document.getElementById('admin-tab-map');
const tabMetalPipeBtn = document.getElementById('admin-tab-metalpipe');
const tabJpoBtn = document.getElementById('admin-tab-jpo');
const panelMetalPipe = document.getElementById('admin-panel-metalpipe');
const panelJpo = document.getElementById('admin-panel-jpo');
const tabBadgeJpo = document.getElementById('tab-badge-jpo');
const jpoStatusCard = document.getElementById('jpo-active-status-card');
const jpoActiveRoomBadge = document.getElementById('jpo-active-room-badge');
const jpoActiveRoomTitle = document.getElementById('jpo-active-room-title');
const jpoActiveRoomDesc = document.getElementById('jpo-active-room-desc');
const jpoActiveKioskPill = document.getElementById('jpo-active-kiosk-pill');
const jpoRoomSelector = document.getElementById('jpo-room-selector');
const jpoKioskToggle = document.getElementById('jpo-kiosk-toggle');
const jpoKioskStateLabel = document.getElementById('jpo-kiosk-state-label');
const jpoLaunchBtn = document.getElementById('btn-jpo-launch');
const jpoResetStandardBtn = document.getElementById('btn-jpo-reset-standard');
const metalPipeStatusLabel = document.getElementById('metalpipe-status-label');
const metalPipeClaimBtn = document.getElementById('btn-metalpipe-claim');
const metalPipeEquipBtn = document.getElementById('btn-metalpipe-equip');
const metalPipeReleaseBtn = document.getElementById('btn-metalpipe-release');
const panelAccounts = document.getElementById('admin-panel-accounts');
const panelUsers = document.getElementById('admin-panel-users');
const panelPosts = document.getElementById('admin-panel-posts');
const panelPigeons = document.getElementById('admin-panel-pigeons');
const panelMap = document.getElementById('admin-panel-map');
const mapEditorRoot = document.getElementById('map-editor-root');
const tabBadgeAccounts = document.getElementById('tab-badge-accounts');
const tabBadgeUsers = document.getElementById('tab-badge-users');
const tabBadgePosts = document.getElementById('tab-badge-posts');
const tabBadgePigeons = document.getElementById('tab-badge-pigeons');

const searchAccountInput = document.getElementById('search-account-input');
const accountsCountPill = document.getElementById('accounts-count-pill');
const accountsTbody = document.getElementById('accounts-tbody');
const accountsEmptyEl = document.getElementById('accounts-empty-state');
const toggleAllAccPwBtn = document.getElementById('btn-toggle-all-acc-pw');

const pwModal = document.getElementById('admin-password-modal');
const pwForm = document.getElementById('admin-password-form');
const pwModalTitle = document.getElementById('pw-modal-title');
const pwModalSubtitle = document.getElementById('pw-modal-subtitle');
const editPwInput = document.getElementById('admin-edit-pw-input');
const pwModalCancelBtn = document.getElementById('btn-pw-modal-cancel');
const pwModalSaveBtn = document.getElementById('btn-pw-modal-save');

const specialSkinsModal = document.getElementById('admin-special-skins-modal');
const specialSkinsTitleEl = document.getElementById('special-skins-modal-title');
const specialSkinsSubtitleEl = document.getElementById('special-skins-modal-subtitle');
const specialSkinsListEl = document.getElementById('admin-special-skins-list');
const specialSkinsStdBtn = document.getElementById('btn-special-skins-standard');
const specialSkinsCloseBtn = document.getElementById('btn-special-skins-close');
let editingSpecialSkinsUsername = null;

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
const launchPrivateDebugBtn = document.getElementById('btn-launch-private-debug');
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
let allAccounts = [];
let allPlayers = [];
let allSuggestions = [];
let allPigeons = [];
let onlineOnly = false;
let activeSection = 'accounts';
let refreshTimer = null;
let pendingConfirmAction = null;
let mapEditor = null;
let allPasswordsRevealed = false;
const revealedPasswords = new Set();
let editingPasswordUsername = null;

function ensureMapEditor() {
  if (!mapEditor && mapEditorRoot) {
    mapEditor = new MapEditor(mapEditorRoot, { apiFetch, showToast });
  }
  return mapEditor;
}

function readMetalPipeLocal() {
  try {
    return {
      pass: localStorage.getItem(METAL_PIPE.passStorageKey) || '',
      equipped: localStorage.getItem(METAL_PIPE.equipStorageKey) === '1'
    };
  } catch {
    return { pass: '', equipped: false };
  }
}

function clearMetalPipeStorage() {
  try {
    localStorage.removeItem(METAL_PIPE.passStorageKey);
    localStorage.removeItem(METAL_PIPE.equipStorageKey);
  } catch {}
}

function renderMetalPipeState() {
  const st = readMetalPipeLocal();
  const owned = Boolean(st.pass);
  if (metalPipeStatusLabel) {
    metalPipeStatusLabel.textContent = !owned ? 'Non récupéré' : st.equipped ? 'Équipé' : 'Récupéré (non équipé)';
  }
  if (metalPipeClaimBtn) metalPipeClaimBtn.disabled = owned;
  if (metalPipeEquipBtn) {
    metalPipeEquipBtn.disabled = !owned;
    metalPipeEquipBtn.textContent = st.equipped ? 'Déséquiper' : 'Équiper';
  }
  if (metalPipeReleaseBtn) metalPipeReleaseBtn.disabled = !owned;
}

metalPipeClaimBtn?.addEventListener('click', async () => {
  metalPipeClaimBtn.disabled = true;
  try {
    const data = await apiFetch('/api/admin/metal-pipe/pass', { method: 'POST', body: '{}' });
    localStorage.setItem(METAL_PIPE.passStorageKey, data.pass);
    localStorage.setItem(METAL_PIPE.equipStorageKey, '1');
    showToast('Metal Pipe Bat récupéré et équipé', 'success');
  } catch (err) {
    showToast(err.message || 'Impossible de récupérer le bâton', 'error');
  }
  renderMetalPipeState();
});

metalPipeEquipBtn?.addEventListener('click', () => {
  const st = readMetalPipeLocal();
  if (!st.pass) return;
  localStorage.setItem(METAL_PIPE.equipStorageKey, st.equipped ? '0' : '1');
  renderMetalPipeState();
});

metalPipeReleaseBtn?.addEventListener('click', async () => {
  const st = readMetalPipeLocal();
  clearMetalPipeStorage();
  renderMetalPipeState();
  if (st.pass) {
    try {
      await apiFetch('/api/admin/metal-pipe/pass', {
        method: 'DELETE',
        body: JSON.stringify({ pass: st.pass })
      });
    } catch {}
  }
});

window.addEventListener('storage', () => {
  renderMetalPipeState();
  renderJpoState();
});
renderMetalPipeState();

function renderJpoState() {
  const cfg = readJpoConfig();
  const roomCfg = getJpoRoomConfig(cfg.room) || JPO_ROOMS.standard;
  const activeJpo = isJpoRoomActive(roomCfg.id);

  if (tabBadgeJpo) {
    tabBadgeJpo.textContent = roomCfg.badgeCode;
  }
  if (jpoStatusCard) {
    jpoStatusCard.style.setProperty('--jpo-accent', roomCfg.accent);
  }
  if (jpoActiveRoomBadge) {
    jpoActiveRoomBadge.textContent = activeJpo
      ? `SALLE ACTIVE SUR CE POSTE • ${roomCfg.roomCode}`
      : 'MODE STANDARD ACTIF SUR CE POSTE';
  }
  if (jpoActiveRoomTitle) {
    jpoActiveRoomTitle.textContent = `${roomCfg.icon} ${roomCfg.label}`;
  }
  if (jpoActiveRoomDesc) {
    jpoActiveRoomDesc.textContent = roomCfg.description;
  }
  if (jpoActiveKioskPill) {
    jpoActiveKioskPill.textContent = cfg.kiosk
      ? 'Mode Kiosque : Actif (60s)'
      : 'Mode Kiosque : Désactivé';
    jpoActiveKioskPill.classList.toggle('active', cfg.kiosk);
  }
  if (jpoRoomSelector) {
    jpoRoomSelector.querySelectorAll('[data-jpo-room]').forEach((btn) => {
      const isSelected = btn.dataset.jpoRoom === roomCfg.id;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });
  }
  if (jpoKioskToggle) {
    jpoKioskToggle.checked = Boolean(cfg.kiosk);
  }
  if (jpoKioskStateLabel) {
    jpoKioskStateLabel.textContent = cfg.kiosk
      ? 'Actif — Reset auto après 60s d’inactivité + bouton « Nouvelle visite »'
      : 'Désactivé';
    jpoKioskStateLabel.classList.toggle('active', cfg.kiosk);
  }
}

jpoRoomSelector?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-jpo-room]');
  if (!btn) return;
  const saved = saveJpoConfig({ room: btn.dataset.jpoRoom });
  const roomCfg = getJpoRoomConfig(saved.room);
  renderJpoState();
  showToast(`Salle active définie : ${roomCfg.icon} ${roomCfg.label}`, 'success');
});

jpoKioskToggle?.addEventListener('change', () => {
  const saved = saveJpoConfig({ kiosk: Boolean(jpoKioskToggle.checked) });
  renderJpoState();
  showToast(
    saved.kiosk
      ? 'Mode Kiosque activé (reset automatique après 60s d’inactivité)'
      : 'Mode Kiosque désactivé',
    saved.kiosk ? 'success' : 'info'
  );
});

jpoResetStandardBtn?.addEventListener('click', () => {
  saveJpoConfig({ room: 'standard', kiosk: false });
  renderJpoState();
  showToast('Configuration réinitialisée en Mode normal', 'info');
});

jpoLaunchBtn?.addEventListener('click', () => {
  const current = readJpoConfig();
  saveJpoConfig(current);
  window.location.href = '/';
});

renderJpoState();

function switchAdminSection(section) {
  activeSection =
    section === 'users'
      ? 'users'
      : section === 'posts'
        ? 'posts'
        : section === 'pigeons'
          ? 'pigeons'
          : section === 'map'
            ? 'map'
            : section === 'metalpipe'
              ? 'metalpipe'
              : section === 'jpo'
                ? 'jpo'
                : 'accounts';
  tabAccountsBtn?.classList.toggle('active', activeSection === 'accounts');
  tabUsersBtn?.classList.toggle('active', activeSection === 'users');
  tabPostsBtn?.classList.toggle('active', activeSection === 'posts');
  tabPigeonsBtn?.classList.toggle('active', activeSection === 'pigeons');
  tabMapBtn?.classList.toggle('active', activeSection === 'map');
  tabMetalPipeBtn?.classList.toggle('active', activeSection === 'metalpipe');
  tabJpoBtn?.classList.toggle('active', activeSection === 'jpo');
  panelMetalPipe?.classList.toggle('hidden', activeSection !== 'metalpipe');
  panelJpo?.classList.toggle('hidden', activeSection !== 'jpo');
  panelAccounts?.classList.toggle('hidden', activeSection !== 'accounts');
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
  clearMetalPipeStorage();
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
    const [data, accData, sugData, pigeonsData] = await Promise.all([
      apiFetch('/api/admin/players'),
      apiFetch('/api/admin/accounts').catch(() => ({ accounts: [] })),
      fetch('/api/suggestions', { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => ({ suggestions: [] })),
      apiFetch('/api/admin/pigeons').catch(() => ({ pigeons: [] }))
    ]);
    allPlayers = Array.isArray(data.players) ? data.players : [];
    const rawAccounts = Array.isArray(accData.accounts)
      ? accData.accounts
      : Array.isArray(data.accounts)
        ? data.accounts
        : [];
    allAccounts = rawAccounts;
    const rawSuggestions = Array.isArray(sugData.suggestions) ? sugData.suggestions : [];
    allSuggestions = [...rawSuggestions].sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    );
    const rawPigeons = Array.isArray(pigeonsData.pigeons) ? pigeonsData.pigeons : [];
    allPigeons = [...rawPigeons].sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    );
    const summary = data.summary || {};
    const totalCount = Math.max(
      allAccounts.length,
      summary.totalPlayers ?? allPlayers.length
    );
    statTotalPlayers.textContent = String(totalCount);
    if (tabBadgeAccounts) tabBadgeAccounts.textContent = String(allAccounts.length);
    if (tabBadgeUsers) tabBadgeUsers.textContent = String(allPlayers.length);
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
    renderAccountsTable();
    renderPlayersTable();
    renderSuggestionsList();
    renderPigeonsTable();
  } catch (err) {
    if (!silent) showToast(err.message || 'Impossible de charger les données', 'error');
  }
}

function renderAccountsTable() {
  if (!accountsTbody || !accountsEmptyEl) return;
  const q = (searchAccountInput?.value || '').trim().toLowerCase();
  const filtered = allAccounts.filter((acc) => {
    if (!q) return true;
    return (
      acc.username.toLowerCase().includes(q) ||
      String(acc.id || '').toLowerCase().includes(q)
    );
  });

  if (accountsCountPill) {
    const n = filtered.length;
    accountsCountPill.textContent = n > 1 ? `${n} comptes inscrits` : `${n} compte inscrit`;
  }
  accountsEmptyEl.classList.toggle('hidden', filtered.length > 0);

  accountsTbody.innerHTML = filtered
    .map((acc) => {
      const lowerKey = acc.username.toLowerCase();
      const isPwVisible = allPasswordsRevealed || revealedPasswords.has(lowerKey);
      const pwDisplay = isPwVisible ? escapeHtml(acc.password) : '••••••••';
      const allTpTotal = Math.max(1, Number(acc.allTpsTotal) || 9);
      const tps20 =
        typeof acc.tpsAt20Count === 'number'
          ? acc.tpsAt20Count
          : Object.values(acc.tpScores || {}).filter((v) => Number(v) === 20).length;
      const avgTxt = typeof acc.average === 'number' ? `${acc.average.toFixed(1)}/20` : '--/20';

      const divineList = Array.isArray(acc.unlockedDivineSkins) ? acc.unlockedDivineSkins : [];
      const vipTiers = normalizeBattlePassTierList(acc.unlockedBattlePassTiers);
      const selectedBpSpec = getBattlePassTierSpec(
        acc.avatarCustomization?.battlePassTier ?? acc.selectedSkin
      );
      const hasVipChambre =
        Boolean(acc.vipChambreAccess) || isYanfufuUsername(acc.username) || vipTiers.includes(7);
      const vipBadges = vipTiers
        .map((tierNum) => {
          const bpSpec = getBattlePassTierSpec(tierNum);
          if (!bpSpec) return '';
          const isEquipped = selectedBpSpec?.tier === tierNum;
          return `<span class="vip-admin-badge ${isEquipped ? 'equipped' : ''}" title="${escapeHtml(bpSpec.name)} — ${escapeHtml(bpSpec.stat)}">${bpSpec.icon} Passe P.${tierNum} (${escapeHtml(bpSpec.shortName)})${isEquipped ? ' ★' : ''}</span>`;
        })
        .filter(Boolean)
        .join('');
      const chambrePill = hasVipChambre
        ? '<span class="vip-admin-badge chambre" title="Accès illimité Chambre Baie Serveur">🔐 Chambre VIP</span>'
        : '';
      const divineItems = divineList
        .map((specId) => {
          const spec = resolveAscensionSpecialty(specId);
          const isEquipped = acc.selectedSkin === spec.id;
          return `<span class="divine-admin-badge ${isEquipped ? 'equipped' : ''}" title="${escapeHtml(spec.label)}">${spec.icon} ${escapeHtml(spec.shortLabel)}${isEquipped ? ' ★' : ''}</span>`;
        })
        .join('');
      const badgesHtml =
        vipBadges +
        chambrePill +
        (divineItems || (vipTiers.length === 0 ? '<span class="divine-admin-badge empty">Aucun Skin Spécial</span>' : ''));

      const onlineBadge = acc.online
        ? '<span class="status-pill online"><span class="dot"></span>En ligne</span>'
        : '<span class="status-pill offline"><span class="dot"></span>Hors ligne</span>';

      return `
        <tr>
          <td>
            <div class="player-cell">
              ${renderSkinPreviewSvg(acc.avatarCustomization, 42)}
              <div>
                <div class="player-name-row">
                  <strong class="acc-username">${escapeHtml(acc.username)}</strong>
                  ${onlineBadge}
                </div>
                <div class="player-sub">ID : ${escapeHtml(acc.id)}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="acc-pw-cell">
              <code class="acc-pw-code ${isPwVisible ? 'revealed' : 'masked'}">${pwDisplay}</code>
              <div class="acc-pw-actions">
                <button
                  type="button"
                  class="btn-secondary btn-xs"
                  data-acc-action="toggle-pw"
                  data-username="${escapeHtml(acc.username)}"
                  title="Afficher / Masquer le mot de passe"
                >
                  ${isPwVisible ? '🙈 Masquer' : '👁️ Afficher'}
                </button>
                <button
                  type="button"
                  class="btn-secondary btn-xs"
                  data-acc-action="copy-pw"
                  data-username="${escapeHtml(acc.username)}"
                  data-password="${escapeHtml(acc.password)}"
                  title="Copier le mot de passe en un clic"
                >
                  📋 Copier
                </button>
              </div>
            </div>
          </td>
          <td>
            <div class="acc-prog-cell">
              <div class="acc-prog-top">
                <span class="tps20-pill ${tps20 >= allTpTotal ? 'full' : ''}">🏆 ${tps20} / ${allTpTotal} TPs à 20/20</span>
                <span class="player-sub">Moy. ${avgTxt}</span>
              </div>
              <div class="divine-badges-row">${badgesHtml}</div>
            </div>
          </td>
          <td>
            <div class="date-val">${formatDateTime(acc.createdAt)}</div>
            <div class="player-sub">Vu : ${formatDateTime(acc.lastSeen || acc.lastLogin)}</div>
          </td>
          <td>
            <div class="actions-cell">
              <button
                type="button"
                class="btn-secondary btn-xs"
                data-acc-action="special-skins"
                data-username="${escapeHtml(acc.username)}"
              >
                🎁 Skins VIP
              </button>
              <button
                type="button"
                class="btn-secondary btn-xs"
                data-acc-action="edit-password"
                data-username="${escapeHtml(acc.username)}"
                data-password="${escapeHtml(acc.password)}"
              >
                🔑 Modifier MDP
              </button>
              <button
                type="button"
                class="btn-reset"
                data-acc-action="reset-account"
                data-username="${escapeHtml(acc.username)}"
              >
                🔄 Réinitialiser
              </button>
              <button
                type="button"
                class="btn-delete"
                data-acc-action="delete-account"
                data-username="${escapeHtml(acc.username)}"
              >
                🗑️ Supprimer
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    return true;
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

function openPasswordEditModal(username, currentPassword = '') {
  editingPasswordUsername = username;
  if (pwModalTitle) {
    pwModalTitle.textContent = `Modifier le MDP de "${username}"`;
  }
  if (pwModalSubtitle) {
    pwModalSubtitle.textContent = `Définissez un nouveau mot de passe pour le compte élève "${username}".`;
  }
  if (editPwInput) {
    editPwInput.value = currentPassword;
  }
  pwModal?.classList.remove('hidden');
  setTimeout(() => editPwInput?.focus(), 20);
}

function closePasswordEditModal() {
  pwModal?.classList.add('hidden');
  editingPasswordUsername = null;
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
                  ${p.vipChambreAccess || p.skin?.battlePassTier ? '<span class="vip-admin-badge equipped">🔑 VIP</span>' : ''}
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
  const isDelete = mode === 'delete' || mode === 'delete_account';
  const isAccountReset = mode === 'reset_account';
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
        ? 'Ce post / rapport sera définitivement supprimé de la base de données.'
        : isDelete
          ? `Cette action supprimera définitivement le compte "${targetValue}" de accounts.json et déconnectera l'élève s'il est en ligne.`
          : `Toutes les notes de TP, les Skins Divins débloqués, l'XP et le temps de jeu de "${targetValue}" seront remis à zéro. Ses identifiants de connexion seront conservés.`;

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
      } else if (mode === 'delete_account') {
        await apiFetch(`/api/admin/accounts/${encoded}`, { method: 'DELETE' });
        showToast(`Compte "${targetValue}" supprimé.`, 'success');
      } else if (isDelete) {
        await apiFetch(`/api/admin/players/${encoded}`, { method: 'DELETE' });
        showToast(`Profil "${targetValue}" supprimé.`, 'success');
      } else if (isAccountReset) {
        await apiFetch(`/api/admin/accounts/${encoded}/reset`, { method: 'POST' });
        showToast(`Progression du compte "${targetValue}" réinitialisée à 0.`, 'success');
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
launchPrivateDebugBtn?.addEventListener('click', async () => {
  launchPrivateDebugBtn.disabled = true;
  try {
    const session = await requestPrivateDebugSession(apiFetch);
    sessionStorage.setItem(PRIVATE_DEBUG_STORAGE_KEY, JSON.stringify(session));
    showToast(`Ouverture du Serveur Privé Debug (${session.room})...`, 'success');
    window.location.href = session.debugUrl;
  } finally {
    launchPrivateDebugBtn.disabled = false;
  }
});
logoutBtn.addEventListener('click', () => {
  switchAdminSection('accounts');
  clearSession();
});

tabAccountsBtn?.addEventListener('click', () => switchAdminSection('accounts'));
tabUsersBtn?.addEventListener('click', () => switchAdminSection('users'));
tabPostsBtn?.addEventListener('click', () => switchAdminSection('posts'));
tabPigeonsBtn?.addEventListener('click', () => switchAdminSection('pigeons'));
tabMapBtn?.addEventListener('click', () => switchAdminSection('map'));
tabMetalPipeBtn?.addEventListener('click', () => {
  renderMetalPipeState();
  switchAdminSection('metalpipe');
});
tabJpoBtn?.addEventListener('click', () => {
  renderJpoState();
  switchAdminSection('jpo');
});

searchAccountInput?.addEventListener('input', renderAccountsTable);

toggleAllAccPwBtn?.addEventListener('click', () => {
  allPasswordsRevealed = !allPasswordsRevealed;
  if (!allPasswordsRevealed) {
    revealedPasswords.clear();
  }
  toggleAllAccPwBtn.classList.toggle('active', allPasswordsRevealed);
  renderAccountsTable();
});

accountsTbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-acc-action]');
  if (!btn) return;
  const action = btn.dataset.accAction;
  const username = btn.dataset.username || '';
  if (!username) return;

  if (action === 'toggle-pw') {
    const key = username.toLowerCase();
    if (allPasswordsRevealed) {
      allPasswordsRevealed = false;
      toggleAllAccPwBtn?.classList.remove('active');
      allAccounts.forEach((a) => {
        if (a.username.toLowerCase() !== key) {
          revealedPasswords.add(a.username.toLowerCase());
        }
      });
    } else if (revealedPasswords.has(key)) {
      revealedPasswords.delete(key);
    } else {
      revealedPasswords.add(key);
    }
    renderAccountsTable();
    return;
  }

  if (action === 'copy-pw') {
    const pw = btn.dataset.password || '';
    const ok = await copyTextToClipboard(pw);
    showToast(
      ok
        ? `📋 Mot de passe de "${username}" copié dans le presse-papiers !`
        : `Mot de passe de "${username}" : ${pw}`,
      'success'
    );
    return;
  }

  if (action === 'edit-password') {
    openPasswordEditModal(username, btn.dataset.password || '');
    return;
  }

  if (action === 'special-skins') {
    openSpecialSkinsModal(username);
    return;
  }

  if (action === 'reset-account') {
    openConfirmModal('reset_account', username);
    return;
  }

  if (action === 'delete-account') {
    openConfirmModal('delete_account', username);
  }
});

pwModalCancelBtn?.addEventListener('click', closePasswordEditModal);
pwModal?.addEventListener('click', (e) => {
  if (e.target === pwModal) closePasswordEditModal();
});
pwForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingPasswordUsername) return;
  const newPassword = (editPwInput?.value || '').trim();
  if (newPassword.length < 3) {
    showToast('Le nouveau mot de passe doit contenir au moins 3 caractères.', 'error');
    return;
  }
  if (pwModalSaveBtn) pwModalSaveBtn.disabled = true;
  try {
    const encoded = encodeURIComponent(editingPasswordUsername);
    await apiFetch(`/api/admin/accounts/${encoded}/password`, {
      method: 'POST',
      body: JSON.stringify({ password: newPassword })
    });
    showToast(`🔑 Mot de passe de "${editingPasswordUsername}" mis à jour !`, 'success');
    closePasswordEditModal();
    await loadPlayers(true);
  } catch (err) {
    showToast(err.message || 'Impossible de modifier le mot de passe', 'error');
  } finally {
    if (pwModalSaveBtn) pwModalSaveBtn.disabled = false;
  }
});

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

function renderSpecialSkinsList() {
  if (!specialSkinsListEl || !editingSpecialSkinsUsername) return;
  const key = editingSpecialSkinsUsername.toLowerCase();
  const acc = allAccounts.find((a) => a.username.toLowerCase() === key);
  if (!acc) return;
  const unlockedSet = new Set(normalizeBattlePassTierList(acc.unlockedBattlePassTiers));
  const selectedBp = getBattlePassTierSpec(
    acc.avatarCustomization?.battlePassTier ?? acc.selectedSkin
  );
  const isYanfufu = isYanfufuUsername(acc.username);
  specialSkinsListEl.innerHTML = BATTLE_PASS_SKIN_CATALOG.map((item) => {
    const unlocked = unlockedSet.has(item.tier);
    const equipped = unlocked && selectedBp?.tier === item.tier;
    const lockedPermanent = isYanfufu && item.tier === 7;
    return `
      <div class="admin-vip-row ${unlocked ? 'unlocked' : ''} ${equipped ? 'equipped' : ''}">
        <div class="admin-vip-info">
          <div class="admin-vip-title">${item.icon} Palier ${item.tier} — ${escapeHtml(item.name)}</div>
          <div class="player-sub">${escapeHtml(item.stat)}</div>
        </div>
        <div class="admin-vip-actions">
          ${
            unlocked
              ? `<button type="button" class="btn-secondary btn-xs" data-bp-action="equip" data-tier="${item.tier}" ${
                  equipped ? 'disabled' : ''
                }>${equipped ? '★ Équipé' : '✨ Équiper'}</button>${
                  lockedPermanent
                    ? '<span class="vip-admin-badge equipped">VIP Permanent</span>'
                    : `<button type="button" class="btn-delete btn-xs" data-bp-action="revoke" data-tier="${item.tier}">Retirer</button>`
                }`
              : `<button type="button" class="btn-primary btn-xs" data-bp-action="grant" data-tier="${item.tier}">🎁 Attribuer &amp; Équiper</button>`
          }
        </div>
      </div>`;
  }).join('');
}

function openSpecialSkinsModal(username) {
  editingSpecialSkinsUsername = username;
  if (specialSkinsTitleEl) {
    specialSkinsTitleEl.textContent = `🎁 Skins Passe VIP — ${username}`;
  }
  if (specialSkinsSubtitleEl) {
    specialSkinsSubtitleEl.textContent =
      'Attribuez, équipez ou gérez les paliers spéciaux du Passe VIP pour cet élève.';
  }
  renderSpecialSkinsList();
  specialSkinsModal?.classList.remove('hidden');
}

function closeSpecialSkinsModal() {
  editingSpecialSkinsUsername = null;
  specialSkinsModal?.classList.add('hidden');
}

async function sendAdminBattlePassUpdate(payload, feedbackMsg) {
  if (!editingSpecialSkinsUsername) return;
  try {
    const encoded = encodeURIComponent(editingSpecialSkinsUsername);
    await apiFetch(`/api/admin/accounts/${encoded}/battlepass`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast(feedbackMsg, 'success');
    await loadPlayers(true);
    renderSpecialSkinsList();
  } catch (err) {
    showToast(err.message || 'Action impossible sur le Passe VIP', 'error');
  }
}

specialSkinsCloseBtn?.addEventListener('click', closeSpecialSkinsModal);
specialSkinsModal?.addEventListener('click', (e) => {
  if (e.target === specialSkinsModal) closeSpecialSkinsModal();
});
specialSkinsStdBtn?.addEventListener('click', () => {
  if (!editingSpecialSkinsUsername) return;
  sendAdminBattlePassUpdate(
    { selectedSkin: 'standard' },
    `👕 Tenue Standard équipée pour "${editingSpecialSkinsUsername}".`
  );
});
specialSkinsListEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-bp-action]');
  if (!btn || !editingSpecialSkinsUsername) return;
  const action = btn.dataset.bpAction;
  const tier = Number(btn.dataset.tier);
  if (!tier) return;
  if (action === 'grant') {
    sendAdminBattlePassUpdate(
      { grantTier: tier, equip: true },
      `🎁 Palier VIP ${tier} attribué et équipé à "${editingSpecialSkinsUsername}" !`
    );
  } else if (action === 'equip') {
    sendAdminBattlePassUpdate(
      { equipTier: tier },
      `✨ Palier VIP ${tier} équipé à "${editingSpecialSkinsUsername}" !`
    );
  } else if (action === 'revoke') {
    sendAdminBattlePassUpdate(
      { revokeTier: tier },
      `Palier VIP ${tier} retiré pour "${editingSpecialSkinsUsername}".`
    );
  }
});

if (adminToken) {
  setAuthenticated(true);
  loadPlayers();
}
