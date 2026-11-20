import { computeFormativeStats } from '../../core/formativeCatalog.js';
import { TP_CATALOG, getMention } from '../../core/gameState.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildGradesSummary(gameState = {}) {
  const formativeProgress =
    gameState.formativeProgress || gameState.profile?.formativeProgress || {};
  const formativeRewardedTps =
    gameState.formativeRewardedTps || gameState.profile?.formativeRewardedTps || [];
  const formative = computeFormativeStats(formativeProgress, formativeRewardedTps);

  const grades3d = gameState.profile?.grades || {};
  const core3dVals = TP_CATALOG.map((tp) => grades3d[tp.id])
    .filter((v) => typeof v === 'number' && Number.isFinite(v))
    .map((v) => Math.max(0, Math.min(20, v)));
  const workshopAverage =
    core3dVals.length > 0
      ? Math.round((core3dVals.reduce((a, b) => a + b, 0) / core3dVals.length) * 10) / 10
      : null;

  const combinedParts = [];
  if (formative.averageScore !== null) combinedParts.push(formative.averageScore);
  if (workshopAverage !== null) combinedParts.push(workshopAverage);
  const globalAverage =
    combinedParts.length > 0
      ? Math.round((combinedParts.reduce((a, b) => a + b, 0) / combinedParts.length) * 10) / 10
      : null;

  const unlockedBadgesCount = formative.badges.filter((b) => b.unlocked).length;

  return {
    formative,
    workshopAverage,
    workshopCompletedCount: core3dVals.filter((v) => v >= 10).length,
    workshopTotalCount: TP_CATALOG.length,
    globalAverage,
    mention: getMention(globalAverage ?? formative.averageScore),
    unlockedBadgesCount,
    totalBadgesCount: formative.badges.length
  };
}

export class GradesApp {
  constructor(options = {}) {
    this.gameState = options.gameState;
    this.onOpenFormativeTp = options.onOpenFormativeTp || null;
    this.containerEl = null;
  }

  mount(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  unmount() {
    this.containerEl = null;
  }

  render() {
    if (!this.containerEl) return;
    const summary = buildGradesSummary(this.gameState);
    const { formative, workshopAverage, globalAverage, mention, unlockedBadgesCount, totalBadgesCount } = summary;

    const avgFormativeText =
      formative.averageScore !== null ? `${formative.averageScore.toFixed(1)} / 20` : '-- / 20';
    const avgWorkshopText =
      workshopAverage !== null ? `${workshopAverage.toFixed(1)} / 20` : '-- / 20';
    const avgGlobalText =
      globalAverage !== null ? `${globalAverage.toFixed(1)} / 20` : '-- / 20';

    const poleBarsHtml = formative.byPole
      .map(
        (pole) => `
        <div class="grd-pole-card" style="--pole-color: ${pole.color}">
          <div class="grd-pole-head">
            <span>${pole.icon} ${escapeHtml(pole.label)}</span>
            <strong>${pole.validated}/${pole.total} validés (${pole.pct}%)</strong>
          </div>
          <div class="grd-pole-track">
            <div class="grd-pole-fill" style="width: ${pole.pct}%; background: ${pole.color}"></div>
          </div>
          <div class="grd-pole-sub">
            Moyenne pôle : ${pole.averageScore !== null ? `${pole.averageScore.toFixed(1)}/20` : 'En attente'}
          </div>
        </div>`
      )
      .join('');

    const rowsHtml = formative.items
      .map((it) => {
        const stLbl =
          it.status === 'validated' ? 'Validé' : it.status === 'in_progress' ? 'En cours' : 'À faire';
        const noteTxt =
          it.answeredCount > 0 || it.validated ? `${it.scoreOutOf20.toFixed(1)} / 20` : '-- / 20';
        return `
          <tr class="grd-row status-${it.status}" data-open-fmt-tp="${escapeHtml(it.tp.id)}">
            <td><span class="grd-tp-ico">${it.tp.icon}</span> ${escapeHtml(it.tp.shortTitle)}</td>
            <td><span class="fmt-status-badge status-${it.status}">${stLbl}</span></td>
            <td><strong>${it.completionPct}%</strong></td>
            <td><strong>${noteTxt}</strong></td>
            <td>${it.rewarded ? `✅ +${it.tp.rewardCoins} CC` : `🪙 ${it.tp.rewardCoins} CC`}</td>
            <td><button type="button" class="grd-go-btn" data-open-fmt-tp="${escapeHtml(it.tp.id)}">Ouvrir ▶</button></td>
          </tr>`;
      })
      .join('');

    const badgesHtml = formative.badges
      .map(
        (b) => `
        <div class="grd-badge-card ${b.unlocked ? 'unlocked' : 'locked'}">
          <div class="grd-badge-ico">${b.icon}</div>
          <div class="grd-badge-info">
            <strong>${escapeHtml(b.title)}</strong>
            <span>${escapeHtml(b.desc)}</span>
          </div>
          <span class="grd-badge-state">${b.unlocked ? '🏆 Débloqué' : '🔒 Verrouillé'}</span>
        </div>`
      )
      .join('');

    this.containerEl.innerHTML = `
      <div class="grd-app">
        <div class="grd-header">
          <div>
            <div class="fmt-kicker">BULLETIN &amp; COMPÉTENCES BAC PRO CIEL</div>
            <h2>📊 Notes &amp; Suivi Pédagogique</h2>
          </div>
          <div class="grd-mention-pill">${escapeHtml(mention)}</div>
        </div>

        <div class="grd-kpi-grid">
          <div class="grd-kpi-card">
            <span>Moyenne Formative</span>
            <strong>${avgFormativeText}</strong>
          </div>
          <div class="grd-kpi-card">
            <span>Moyenne Atelier 3D</span>
            <strong>${avgWorkshopText}</strong>
          </div>
          <div class="grd-kpi-card highlight">
            <span>Moyenne Générale</span>
            <strong>${avgGlobalText}</strong>
          </div>
          <div class="grd-kpi-card">
            <span>TP Formative</span>
            <strong>${formative.validatedCount} / ${formative.totalTps}</strong>
          </div>
          <div class="grd-kpi-card">
            <span>Badges CIEL</span>
            <strong>${unlockedBadgesCount} / ${totalBadgesCount}</strong>
          </div>
        </div>

        <section class="grd-section">
          <h3>Progression par Pôle CIEL</h3>
          <div class="grd-poles-grid">${poleBarsHtml}</div>
        </section>

        <section class="grd-section">
          <h3>Tableau récapitulatif des TP Formative</h3>
          <div class="grd-table-wrap">
            <table class="grd-table">
              <thead>
                <tr>
                  <th>Travail Pratique</th>
                  <th>Statut</th>
                  <th>Complétion</th>
                  <th>Note</th>
                  <th>Récompense</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </section>

        <section class="grd-section">
          <h3>Badges de Compétence CIEL</h3>
          <div class="grd-badges-grid">${badgesHtml}</div>
        </section>
      </div>
    `;

    this.containerEl.querySelectorAll('[data-open-fmt-tp]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tpId = el.dataset.openFmtTp;
        if (tpId) this.onOpenFormativeTp?.(tpId);
      });
    });
  }
}
