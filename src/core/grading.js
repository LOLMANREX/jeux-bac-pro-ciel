export function toSafeNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function roundHalfUp(val) {
  const safe = toSafeNumber(val, 0);
  if (safe <= 0) return 0;
  return Math.ceil(safe * 2 - 1e-9) / 2;
}

export function finalizeGrade20(rawScore, { hasCriticalError = false, perfectThreshold = 19.25 } = {}) {
  const safeRaw = Math.max(0, Math.min(20, toSafeNumber(rawScore, 0)));
  if (!hasCriticalError && safeRaw >= perfectThreshold) {
    return 20;
  }
  let rounded = Math.max(0, Math.min(20, roundHalfUp(safeRaw)));
  if (hasCriticalError && rounded >= 20) {
    rounded = 19.5;
  }
  return rounded;
}

export function formatPoints(val) {
  const n = Math.round(toSafeNumber(val, 0) * 100) / 100;
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createGradeBreakdown({
  items = [],
  penalties = [],
  bonuses = [],
  rawScore = 0,
  finalScore = 0,
  hasCriticalError = false,
  tip = ''
} = {}) {
  const normItems = (Array.isArray(items) ? items : []).map((it) => {
    const max = Math.max(0, toSafeNumber(it?.max, 0));
    const earned = Math.max(0, Math.min(max > 0 ? max : 20, toSafeNumber(it?.earned, 0)));
    const status =
      it?.status || (earned >= max - 0.01 ? 'ok' : earned > 0 ? 'warn' : 'fail');
    return {
      label: String(it?.label || ''),
      earned: Math.round(earned * 100) / 100,
      max: Math.round(max * 100) / 100,
      status,
      detail: it?.detail ? String(it.detail) : ''
    };
  });

  const normPenalties = (Array.isArray(penalties) ? penalties : []).map((pen) => ({
    label: String(pen?.label || ''),
    points: Math.max(0, Math.round(toSafeNumber(pen?.points, 0) * 100) / 100),
    forgivenCount: Math.max(0, Math.floor(toSafeNumber(pen?.forgivenCount, 0))),
    detail: pen?.detail ? String(pen.detail) : ''
  }));

  const normBonuses = (Array.isArray(bonuses) ? bonuses : []).map((bon) => ({
    label: String(bon?.label || ''),
    points: Math.max(0, Math.round(toSafeNumber(bon?.points, 0) * 100) / 100),
    detail: bon?.detail ? String(bon.detail) : ''
  }));

  const totalMax =
    Math.round(normItems.reduce((acc, it) => acc + it.max, 0) * 100) / 100;
  const safeRaw = Math.max(0, Math.min(20, Math.round(toSafeNumber(rawScore, 0) * 100) / 100));
  const safeFinal = Math.max(0, Math.min(20, Math.round(toSafeNumber(finalScore, 0) * 10) / 10));
  const roundedTo20 = safeFinal === 20 && safeRaw < 20 && !hasCriticalError;

  return {
    items: normItems,
    penalties: normPenalties,
    bonuses: normBonuses,
    rawScore: safeRaw,
    finalScore: safeFinal,
    totalMax,
    hasCriticalError: Boolean(hasCriticalError),
    roundedTo20,
    isPerfect: safeFinal === 20,
    tip: String(tip || '')
  };
}

export function renderBreakdownHtml(breakdown) {
  if (!breakdown || !Array.isArray(breakdown.items) || breakdown.items.length === 0) {
    return '';
  }
  const rows = breakdown.items
    .map((it) => {
      const icon = it.status === 'ok' ? '✅' : it.status === 'warn' ? '🟡' : '❌';
      const cls = it.status === 'ok' ? 'mg-bd-ok' : it.status === 'warn' ? 'mg-bd-warn' : 'mg-bd-fail';
      const detailHtml = it.detail
        ? `<span class="mg-bd-detail">${escapeHtml(it.detail)}</span>`
        : '';
      return `
        <div class="mg-bd-row ${cls}">
          <span class="mg-bd-label">${icon} ${escapeHtml(it.label)}${detailHtml}</span>
          <strong class="mg-bd-pts">${formatPoints(it.earned)} / ${formatPoints(it.max)} pts</strong>
        </div>
      `;
    })
    .join('');

  const bonusRows = (breakdown.bonuses || [])
    .map((b) => {
      const detailHtml = b.detail ? `<span class="mg-bd-detail">${escapeHtml(b.detail)}</span>` : '';
      return `
        <div class="mg-bd-row mg-bd-bonus">
          <span class="mg-bd-label">✨ ${escapeHtml(b.label)}${detailHtml}</span>
          <strong class="mg-bd-pts">+${formatPoints(b.points)} pt</strong>
        </div>
      `;
    })
    .join('');

  const penaltyRows = (breakdown.penalties || [])
    .map((p) => {
      const forgiven = p.points <= 0 && p.forgivenCount > 0;
      const cls = forgiven ? 'mg-bd-forgiven' : 'mg-bd-penalty';
      const icon = forgiven ? '🎁' : '⚠️';
      const ptsLabel = forgiven ? '0 pt (droit à l’erreur)' : `-${formatPoints(p.points)} pt`;
      const detailHtml = p.detail ? `<span class="mg-bd-detail">${escapeHtml(p.detail)}</span>` : '';
      return `
        <div class="mg-bd-row ${cls}">
          <span class="mg-bd-label">${icon} ${escapeHtml(p.label)}${detailHtml}</span>
          <strong class="mg-bd-pts">${ptsLabel}</strong>
        </div>
      `;
    })
    .join('');

  const roundingRow = breakdown.roundedTo20
    ? `
      <div class="mg-bd-row mg-bd-bonus">
        <span class="mg-bd-label">🎓 Arrondi généreux Professeur CIEL (score brut ${formatPoints(breakdown.rawScore)} ≥ 19.25)</span>
        <strong class="mg-bd-pts">→ 20 / 20</strong>
      </div>
    `
    : '';

  const tipHtml =
    breakdown.finalScore < 20 && breakdown.tip
      ? `<div class="mg-bd-tip">💡 <strong>Pour décrocher 20/20 :</strong> ${escapeHtml(breakdown.tip)}</div>`
      : '';

  return `
    <div class="mg-breakdown">
      <div class="mg-bd-header">
        <span>📊 Détail du Barème Transparent</span>
        <strong>${formatPoints(breakdown.finalScore)} / ${formatPoints(breakdown.totalMax || 20)}</strong>
      </div>
      <div class="mg-bd-list">
        ${rows}
        ${bonusRows}
        ${penaltyRows}
        ${roundingRow}
      </div>
      <div class="mg-bd-total">
        <span>Note finale retenue (arrondi au 0.5 supérieur)</span>
        <strong>${formatPoints(breakdown.finalScore)} / 20</strong>
      </div>
      ${tipHtml}
    </div>
  `;
}

export function buildBreakdownLines(breakdown) {
  if (!breakdown || !Array.isArray(breakdown.items) || breakdown.items.length === 0) {
    return [];
  }
  const lines = breakdown.items.map((it) => {
    const icon = it.status === 'ok' ? '✅' : it.status === 'warn' ? '🟡' : '❌';
    return `${icon} ${it.label} : ${formatPoints(it.earned)}/${formatPoints(it.max)} pts`;
  });
  for (const b of breakdown.bonuses || []) {
    lines.push(`✨ ${b.label} : +${formatPoints(b.points)} pt`);
  }
  for (const p of breakdown.penalties || []) {
    if (p.points <= 0 && p.forgivenCount > 0) {
      lines.push(`🎁 ${p.label} : 0 pt (pardonné)`);
    } else if (p.points > 0) {
      lines.push(`⚠️ ${p.label} : -${formatPoints(p.points)} pt`);
    }
  }
  if (breakdown.roundedTo20) {
    lines.push(`🎓 Arrondi généreux (${formatPoints(breakdown.rawScore)}) → 20/20`);
  }
  if (breakdown.finalScore < 20 && breakdown.tip) {
    lines.push(`💡 Conseil : ${breakdown.tip}`);
  }
  return lines;
}
