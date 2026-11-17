function formatSignedTerm(coeff, varPart, isFirst = false) {
  if (coeff === 0) return '';
  const abs = Math.abs(coeff);
  const sign = coeff < 0 ? (isFirst ? '-' : ' - ') : (isFirst ? '' : ' + ');
  const numStr = varPart && abs === 1 ? '' : `${abs}`;
  return `${sign}${numStr}${varPart}`;
}

function formatQuad(a, b, c) {
  let out = formatSignedTerm(a, 'x²', true);
  if (b !== 0) out += formatSignedTerm(b, 'x', out.length === 0);
  if (c !== 0) out += formatSignedTerm(c, '', out.length === 0);
  return out || '0';
}

function formatLinear(m, p) {
  let out = formatSignedTerm(m, 'x', true);
  if (p !== 0) out += formatSignedTerm(p, '', out.length === 0);
  return out || '0';
}

function formatCubic(a, b, c, d) {
  let out = formatSignedTerm(a, 'x³', true);
  if (b !== 0) out += formatSignedTerm(b, 'x²', out.length === 0);
  if (c !== 0) out += formatSignedTerm(c, 'x', out.length === 0);
  if (d !== 0) out += formatSignedTerm(d, '', out.length === 0);
  return out || '0';
}

function buildQuadParams(index) {
  const presets = [
    { a: 1, r: 3, c: 4 },
    { a: -1, r: 2, c: 1 },
    { a: 2, r: 2, c: -1 },
    { a: -2, r: -1, c: 5 },
    { a: 3, r: -2, c: 0 },
    { a: 1, r: -4, c: 7 },
    { a: -1, r: -3, c: 2 },
    { a: 2, r: 1, c: 3 },
    { a: -3, r: 2, c: 4 },
    { a: 1, r: 5, c: -3 }
  ];
  const p = presets[Math.abs(index) % presets.length];
  const b = -2 * p.a * p.r;
  const d = p.a;
  const m = 2 * d;
  const k = b;
  const extremumY = d * p.r * p.r + b * p.r + p.c;
  return {
    a: d,
    b,
    c: p.c,
    r: p.r,
    m,
    k,
    extremumY,
    fxLabel: `f(x) = ${formatQuad(d, b, p.c)}`,
    fPrimeLabel: `f'(x) = ${formatLinear(m, k)}`
  };
}

function rotateOptions(correct, distractors, seed) {
  const unique = [correct];
  for (const d of distractors) {
    if (!unique.includes(d)) unique.push(d);
    if (unique.length === 4) break;
  }
  while (unique.length < 4) {
    unique.push(`Valeur ${unique.length + 1}`);
  }
  const shift = Math.abs(seed) % 4;
  const options = [];
  for (let i = 0; i < 4; i++) {
    options.push(unique[(i + shift) % 4]);
  }
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex };
}

export function generateVariationExercise(index = 0) {
  const idx = Math.max(0, Math.floor(Number(index) || 0));
  const kind = idx % 5;

  if (kind === 0) {
    const q = buildQuadParams(idx);
    const correct = `f'(x) = ${formatLinear(q.m, q.k)}`;
    const distractors = [
      `f'(x) = ${formatLinear(q.a, q.k)}`,
      `f'(x) = ${formatLinear(q.m, -q.k || 2)}`,
      `f'(x) = ${formatLinear(q.m, q.c)}`
    ];
    const { options, correctIndex } = rotateOptions(correct, distractors, idx + 1);
    return {
      index: idx,
      type: 'derivative',
      fxLabel: q.fxLabel,
      fPrimeLabel: "f'(x) = ?",
      question: `Calculez la dérivée de ${q.fxLabel} sur ℝ :`,
      table: {
        xs: ['-∞', `${q.r}`, '+∞'],
        signs: [q.a > 0 ? '-' : '+', '0', q.a > 0 ? '+' : '-'],
        arrows: [q.a > 0 ? '↘' : '↗', `${q.extremumY}`, q.a > 0 ? '↗' : '↘']
      },
      options,
      correctIndex,
      explanation: `La dérivée de ${formatQuad(q.a, q.b, q.c)} est ${correct}.`
    };
  }

  if (kind === 1) {
    const q = buildQuadParams(idx + 3);
    const correct = `x₀ = ${q.r}`;
    const distractors = [
      `x₀ = ${-q.r === q.r ? q.r + 2 : -q.r}`,
      `x₀ = ${q.r + 1}`,
      `x₀ = ${q.r - 2}`
    ];
    const { options, correctIndex } = rotateOptions(correct, distractors, idx + 2);
    return {
      index: idx,
      type: 'root',
      fxLabel: q.fxLabel,
      fPrimeLabel: q.fPrimeLabel,
      question: `Pour quelle valeur x₀ a-t-on ${q.fPrimeLabel} = 0 ?`,
      table: {
        xs: ['-∞', '?', '+∞'],
        signs: [q.a > 0 ? '-' : '+', '0', q.a > 0 ? '+' : '-'],
        arrows: [q.a > 0 ? '↘' : '↗', `${q.extremumY}`, q.a > 0 ? '↗' : '↘']
      },
      options,
      correctIndex,
      explanation: `${formatLinear(q.m, q.k)} = 0 donne x₀ = ${q.r}.`
    };
  }

  if (kind === 2) {
    const q = buildQuadParams(idx + 5);
    const askRight = idx % 2 === 0;
    const interval = askRight ? `[${q.r} ; +∞[` : `]-∞ ; ${q.r}]`;
    const correctSign = askRight ? (q.a > 0 ? 'Positif (+)' : 'Négatif (-)') : (q.a > 0 ? 'Négatif (-)' : 'Positif (+)');
    const distractors = [
      correctSign === 'Positif (+)' ? 'Négatif (-)' : 'Positif (+)',
      'Toujours nul (0)',
      'Change de signe deux fois'
    ];
    const { options, correctIndex } = rotateOptions(correctSign, distractors, idx + 3);
    return {
      index: idx,
      type: 'sign',
      fxLabel: q.fxLabel,
      fPrimeLabel: q.fPrimeLabel,
      question: `Quel est le signe de ${q.fPrimeLabel} sur ${interval} ?`,
      table: {
        xs: ['-∞', `${q.r}`, '+∞'],
        signs: [askRight ? (q.a > 0 ? '-' : '+') : '?', '0', askRight ? '?' : (q.a > 0 ? '+' : '-')],
        arrows: [q.a > 0 ? '↘' : '↗', `${q.extremumY}`, q.a > 0 ? '↗' : '↘']
      },
      options,
      correctIndex,
      explanation: `Sur ${interval}, le signe de ${q.fPrimeLabel} est ${correctSign}.`
    };
  }

  if (kind === 3) {
    const q = buildQuadParams(idx + 7);
    const askLeft = idx % 2 === 1;
    const interval = askLeft ? `]-∞ ; ${q.r}]` : `[${q.r} ; +∞[`;
    const isInc = askLeft ? q.a < 0 : q.a > 0;
    const correct = isInc ? 'Croissante (↗)' : 'Décroissante (↘)';
    const distractors = [
      isInc ? 'Décroissante (↘)' : 'Croissante (↗)',
      'Constante (→)',
      'Non définie'
    ];
    const { options, correctIndex } = rotateOptions(correct, distractors, idx + 1);
    return {
      index: idx,
      type: 'variation',
      fxLabel: q.fxLabel,
      fPrimeLabel: q.fPrimeLabel,
      question: `Sens de variation de f sur ${interval} sachant ${q.fPrimeLabel} :`,
      table: {
        xs: ['-∞', `${q.r}`, '+∞'],
        signs: [q.a > 0 ? '-' : '+', '0', q.a > 0 ? '+' : '-'],
        arrows: [askLeft ? '?' : (q.a > 0 ? '↘' : '↗'), `${q.extremumY}`, askLeft ? (q.a > 0 ? '↗' : '↘') : '?']
      },
      options,
      correctIndex,
      explanation: `f'(x) est ${isInc ? 'positive' : 'négative'} sur ${interval}, donc f est ${correct}.`
    };
  }

  const cubicPresets = [
    { a: 1, c: -3, d: 2, r: 1, fp: "f'(x) = 3x² - 3", extLabel: 'Minimum f(1) = 0 et Maximum f(-1) = 4', signs: ['+', '0', '-', '0', '+'], arrows: ['↗', '4', '↘', '0', '↗'], xs: ['-∞', '-1', '1', '+∞'] },
    { a: 1, c: -12, d: 1, r: 2, fp: "f'(x) = 3x² - 12", extLabel: 'Minimum f(2) = -15 et Maximum f(-2) = 17', signs: ['+', '0', '-', '0', '+'], arrows: ['↗', '17', '↘', '-15', '↗'], xs: ['-∞', '-2', '2', '+∞'] },
    { a: -1, c: 3, d: 1, r: 1, fp: "f'(x) = -3x² + 3", extLabel: 'Minimum f(-1) = -1 et Maximum f(1) = 3', signs: ['-', '0', '+', '0', '-'], arrows: ['↘', '-1', '↗', '3', '↘'], xs: ['-∞', '-1', '1', '+∞'] }
  ];
  const cp = cubicPresets[idx % cubicPresets.length];
  const fxStr = `f(x) = ${formatCubic(cp.a, 0, cp.c, cp.d)}`;
  const correct = cp.a > 0 ? 'Croissante (↗) puis Décroissante (↘) puis Croissante (↗)' : 'Décroissante (↘) puis Croissante (↗) puis Décroissante (↘)';
  const distractors = [
    cp.a > 0 ? 'Décroissante (↘) puis Croissante (↗) puis Décroissante (↘)' : 'Croissante (↗) puis Décroissante (↘) puis Croissante (↗)',
    'Toujours croissante (↗) sur ℝ',
    'Croissante (↗) puis Décroissante (↘) uniquement'
  ];
  const { options, correctIndex } = rotateOptions(correct, distractors, idx);
  return {
    index: idx,
    type: 'cubic_table',
    fxLabel: fxStr,
    fPrimeLabel: cp.fp,
    question: `Complétez l’allure globale du tableau de variations de ${fxStr} :`,
    table: {
      xs: cp.xs,
      signs: cp.signs,
      arrows: cp.arrows
    },
    options,
    correctIndex,
    explanation: `Avec ${cp.fp}, les racines sont -${cp.r} et ${cp.r} (${cp.extLabel}).`
  };
}

export function checkVariationAnswer(exercise, optionIndex) {
  if (!exercise || typeof optionIndex !== 'number') {
    return { correct: false, explanation: '' };
  }
  const ok = optionIndex === exercise.correctIndex;
  return {
    correct: ok,
    correctIndex: exercise.correctIndex,
    explanation: exercise.explanation || ''
  };
}

export class VariationTableSession {
  constructor(options = {}) {
    this.onSolved = options.onSolved || null;
    this.onAnswer = options.onAnswer || null;
    this.index = Math.max(0, Number(options.startIndex) || 0);
    this.solvedCount = 0;
    this.streak = 0;
    this.lastFeedback = '';
    this.lastCorrect = null;
    this.current = generateVariationExercise(this.index);
  }

  submit(optionIndex) {
    const res = checkVariationAnswer(this.current, optionIndex);
    this.lastCorrect = res.correct;
    if (res.correct) {
      this.solvedCount += 1;
      this.streak += 1;
      this.lastFeedback = `✅ Correct ! ${res.explanation} (Signal radar activé !)`;
      this.index += 1;
      this.current = generateVariationExercise(this.index);
      this.onSolved?.({ solvedCount: this.solvedCount, streak: this.streak, exercise: this.current });
    } else {
      this.streak = 0;
      this.lastFeedback = `❌ Erreur ! ${res.explanation} — Réessayez la suite.`;
    }
    this.onAnswer?.({ ...res, solvedCount: this.solvedCount, streak: this.streak });
    return { ...res, solvedCount: this.solvedCount, streak: this.streak, nextExercise: this.current };
  }

  getVrSnapshot(extra = {}) {
    return {
      solvedCount: this.solvedCount,
      streak: this.streak,
      feedback: this.lastFeedback,
      lastCorrect: this.lastCorrect,
      exercise: this.current,
      ...extra
    };
  }
}

export function renderVariationTableMarkup(exercise) {
  if (!exercise) return '';
  const xs = exercise.table?.xs || ['-∞', '0', '+∞'];
  const signs = exercise.table?.signs || ['-', '0', '+'];
  const arrows = exercise.table?.arrows || ['↘', '0', '↗'];
  return `
    <div class="vt-box">
      <div class="vt-func-row">
        <span class="vt-func-pill">${exercise.fxLabel}</span>
        <span class="vt-deriv-pill">${exercise.fPrimeLabel}</span>
      </div>
      <table class="vt-table" aria-label="Tableau de variations">
        <thead>
          <tr>
            <th>x</th>
            ${xs.map((x) => `<th>${x}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>f'(x)</th>
            ${signs.map((s) => `<td class="vt-sign">${s}</td>`).join('')}
          </tr>
          <tr>
            <th>f(x)</th>
            ${arrows.map((a) => `<td class="vt-arrow">${a}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function wrapSheetLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

export function getVariationSheetHitBoxes(width = 1024, height = 768) {
  const padX = Math.round(width * 0.088);
  const gapX = Math.round(width * 0.022);
  const gapY = Math.round(height * 0.02);
  const boxW = Math.floor((width - padX - Math.round(width * 0.045) - gapX) / 2);
  const boxH = Math.round(height * 0.118);
  const startY = Math.round(height * 0.705);
  const boxes = [];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    boxes.push({
      id: `sheet_opt_${i}`,
      optionIndex: i,
      x: padX + col * (boxW + gapX),
      y: startY + row * (boxH + gapY),
      w: boxW,
      h: boxH
    });
  }
  return boxes;
}

export function drawVariationWorksheetCanvas(
  ctx,
  width = 1024,
  height = 768,
  detentionSnapshot = {},
  hoveredId = null
) {
  const hitBoxes = getVariationSheetHitBoxes(width, height);
  if (!ctx) {
    return { hitBoxes };
  }

  const ex = detentionSnapshot.exercise || generateVariationExercise(0);
  const tbl = ex.table || {};
  const xs = Array.isArray(tbl.xs) ? tbl.xs : ['-∞', '0', '+∞'];
  const signs = Array.isArray(tbl.signs) ? tbl.signs : ['-', '0', '+'];
  const arrows = Array.isArray(tbl.arrows) ? tbl.arrows : ['↘', '0', '↗'];
  const opts = Array.isArray(ex.options) ? ex.options : [];

  ctx.fillStyle = '#fbf7ec';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
  ctx.lineWidth = 1.5;
  for (let ly = 72; ly < height - 24; ly += 32) {
    ctx.beginPath();
    ctx.moveTo(20, ly);
    ctx.lineTo(width - 20, ly);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(76, 18);
  ctx.lineTo(76, height - 18);
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  ctx.fillStyle = '#991b1b';
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(92, 24, 340, 48, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef2f2';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('📝 HEURE DE COLLE — MATHS', 108, 48);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    `Résolus: ${detentionSnapshot.solvedCount || 0}  •  Série: ${detentionSnapshot.streak || 0}  •  TPs: ${detentionSnapshot.completedTps || 0}/${detentionSnapshot.totalTps || 5}`,
    width - 36,
    48
  );
  ctx.textAlign = 'left';

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(String(ex.fxLabel || 'f(x)'), 96, 108);

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(ex.fPrimeLabel || "f'(x)"), width - 42, 108);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  const qLines = wrapSheetLines(ctx, ex.question || 'Complétez le tableau de variations :', width - 140, 2);
  qLines.forEach((ln, idx) => {
    ctx.fillText(ln, 96, 152 + idx * 30);
  });

  const tx = 96;
  const ty = 216;
  const tw = width - 142;
  const rowH = 72;
  const labelW = 138;
  const colAreaW = tw - labelW;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fillRect(tx, ty, tw, rowH * 3);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.strokeRect(tx, ty, tw, rowH * 3);
  ctx.beginPath();
  ctx.moveTo(tx + labelW, ty);
  ctx.lineTo(tx + labelW, ty + rowH * 3);
  ctx.moveTo(tx, ty + rowH);
  ctx.lineTo(tx + tw, ty + rowH);
  ctx.moveTo(tx, ty + rowH * 2);
  ctx.lineTo(tx + tw, ty + rowH * 2);
  ctx.stroke();

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('x', tx + labelW / 2, ty + rowH * 0.5);
  ctx.fillText("f'(x)", tx + labelW / 2, ty + rowH * 1.5);
  ctx.fillText('f(x)', tx + labelW / 2, ty + rowH * 2.5);

  const xStep = colAreaW / Math.max(1, xs.length);
  xs.forEach((xv, i) => {
    const cx = tx + labelW + xStep * (i + 0.5);
    ctx.fillStyle = xv === '?' ? '#b45309' : '#0f172a';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(String(xv).slice(0, 8), cx, ty + rowH * 0.5);
  });

  const sStep = colAreaW / Math.max(1, signs.length);
  signs.forEach((sv, i) => {
    const cx = tx + labelW + sStep * (i + 0.5);
    ctx.fillStyle =
      sv === '?' ? '#d97706' : sv === '+' ? '#047857' : sv === '-' ? '#b91c1c' : '#334155';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(String(sv).slice(0, 6), cx, ty + rowH * 1.5);
  });

  const aStep = colAreaW / Math.max(1, arrows.length);
  arrows.forEach((av, i) => {
    const cx = tx + labelW + aStep * (i + 0.5);
    ctx.fillStyle = av === '?' ? '#d97706' : '#0369a1';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(String(av).slice(0, 8), cx, ty + rowH * 2.5);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle =
    detentionSnapshot.lastCorrect === false
      ? '#b91c1c'
      : detentionSnapshot.lastCorrect === true
        ? '#047857'
        : '#475569';
  ctx.font = 'bold 20px system-ui, sans-serif';
  const fbText =
    detentionSnapshot.feedback ||
    'Cliquez sur la bonne réponse (A, B, C ou D) directement sur la feuille !';
  ctx.fillText(String(fbText).slice(0, 82), 96, 480);

  const letters = ['A', 'B', 'C', 'D'];
  hitBoxes.forEach((box, idx) => {
    const optText = String(opts[idx] || '');
    const isHover = hoveredId === box.id;
    ctx.fillStyle = isHover ? '#dbeafe' : '#ffffff';
    ctx.strokeStyle = isHover ? '#2563eb' : '#475569';
    ctx.lineWidth = isHover ? 4 : 2.5;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHover ? '#1d4ed8' : '#0f172a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const fullOpt = `${letters[idx]}) ${optText}`;
    const optLines = wrapSheetLines(ctx, fullOpt, box.w - 28, 2);
    if (optLines.length <= 1) {
      ctx.fillText(optLines[0] || '', box.x + 14, box.y + box.h / 2);
    } else {
      ctx.fillText(optLines[0], box.x + 14, box.y + box.h * 0.34);
      ctx.fillText(optLines[1], box.x + 14, box.y + box.h * 0.7);
    }
  });
  ctx.textBaseline = 'alphabetic';

  return { hitBoxes };
}
