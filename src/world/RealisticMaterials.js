import * as THREE from 'three';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(size, height = size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  return canvas;
}

function configureTexture(tex, anisotropy, repeatX = 1, repeatY = 1, isColor = true) {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function buildPbrCanvases(size, seed, drawFn, height = size) {
  const colorCanvas = makeCanvas(size, height);
  const roughCanvas = makeCanvas(size, height);
  const bumpCanvas = makeCanvas(size, height);
  const cCtx = colorCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rng = createRng(seed);
  drawFn(cCtx, rCtx, bCtx, size, height, rng);
  return { colorCanvas, roughCanvas, bumpCanvas };
}

function canvasesToTextures(canvases, anisotropy, repeatX, repeatY, registry) {
  const map = configureTexture(new THREE.CanvasTexture(canvases.colorCanvas), anisotropy, repeatX, repeatY, true);
  const roughnessMap = configureTexture(new THREE.CanvasTexture(canvases.roughCanvas), anisotropy, repeatX, repeatY, false);
  const bumpMap = configureTexture(new THREE.CanvasTexture(canvases.bumpCanvas), anisotropy, repeatX, repeatY, false);
  registry.push(map, roughnessMap, bumpMap);
  return { map, roughnessMap, bumpMap };
}

function drawFloorCanvases(cCtx, rCtx, bCtx, w, h, rng) {
  cCtx.fillStyle = '#d3d9e0';
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(228, 228, 228)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 420; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const rad = 14 + rng() * 36;
    const tone = rng() > 0.5 ? 'rgba(226, 232, 239, 0.08)' : 'rgba(182, 192, 204, 0.08)';
    cCtx.fillStyle = tone;
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();

    const rVal = Math.floor(210 + rng() * 42);
    rCtx.fillStyle = `rgba(${rVal}, ${rVal}, ${rVal}, 0.16)`;
    rCtx.beginPath();
    rCtx.arc(x, y, rad * 0.85, 0, Math.PI * 2);
    rCtx.fill();
  }

  const speckColors = ['#b4beca', '#e6ebf0', '#96a3b3', '#c5cdd7', '#aeb9c6'];
  for (let i = 0; i < 9500; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const sw = 1 + rng() * 2.8;
    const sh = 1 + rng() * 2.4;
    cCtx.fillStyle = speckColors[Math.floor(rng() * speckColors.length)];
    cCtx.globalAlpha = 0.28 + rng() * 0.45;
    cCtx.fillRect(x, y, sw, sh);

    const bVal = Math.floor(114 + rng() * 28);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(x, y, sw, sh);

    const rVal = Math.floor(204 + rng() * 48);
    rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rCtx.fillRect(x, y, sw, sh);
  }
  cCtx.globalAlpha = 1;

  const step = w / 2;
  cCtx.lineWidth = 3;
  rCtx.lineWidth = 3;
  bCtx.lineWidth = 3;
  for (let pos = 0; pos <= w; pos += step) {
    cCtx.strokeStyle = 'rgba(136, 146, 158, 0.42)';
    cCtx.beginPath();
    cCtx.moveTo(pos, 0);
    cCtx.lineTo(pos, h);
    cCtx.moveTo(0, pos);
    cCtx.lineTo(w, pos);
    cCtx.stroke();

    rCtx.strokeStyle = 'rgb(252, 252, 252)';
    rCtx.beginPath();
    rCtx.moveTo(pos, 0);
    rCtx.lineTo(pos, h);
    rCtx.moveTo(0, pos);
    rCtx.lineTo(w, pos);
    rCtx.stroke();

    bCtx.strokeStyle = 'rgb(88, 88, 88)';
    bCtx.beginPath();
    bCtx.moveTo(pos, 0);
    bCtx.lineTo(pos, h);
    bCtx.moveTo(0, pos);
    bCtx.lineTo(w, pos);
    bCtx.stroke();
  }
}

function drawPlasterCanvases(cCtx, rCtx, bCtx, w, h, rng, baseHex = '#f1f3f6', plinthBand = false) {
  cCtx.fillStyle = baseHex;
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(228, 228, 228)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 360; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 10 + rng() * 26;
    cCtx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.07)' : 'rgba(180, 190, 202, 0.07)';
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
  }

  for (let i = 0; i < 12000; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const sz = 1 + rng() * 2.2;
    const shade = rng() > 0.5 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(165, 175, 188, 0.14)';
    cCtx.fillStyle = shade;
    cCtx.fillRect(x, y, sz, sz);

    const bVal = Math.floor(108 + rng() * 42);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(x, y, sz, sz);

    const rVal = Math.floor(214 + rng() * 38);
    rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rCtx.fillRect(x, y, sz, sz);
  }

  if (plinthBand) {
    const plinthH = Math.round(h * 0.085);
    const py = h - plinthH;
    cCtx.fillStyle = '#6c7583';
    cCtx.fillRect(0, py, w, plinthH);
    cCtx.fillStyle = '#8590a0';
    cCtx.fillRect(0, py, w, 3);
    rCtx.fillStyle = 'rgb(165, 165, 165)';
    rCtx.fillRect(0, py, w, plinthH);
    bCtx.fillStyle = 'rgb(155, 155, 155)';
    bCtx.fillRect(0, py, w, plinthH);
    bCtx.fillStyle = 'rgb(95, 95, 95)';
    bCtx.fillRect(0, py, w, 3);
  }
}

function drawOakWoodCanvases(cCtx, rCtx, bCtx, w, h, rng) {
  cCtx.fillStyle = '#d7b98f';
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(214, 214, 214)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  const plankCount = 4;
  const plankH = h / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const y0 = p * plankH;
    const toneShift = (rng() - 0.5) * 14;
    cCtx.fillStyle = `rgb(${Math.round(215 + toneShift)}, ${Math.round(185 + toneShift * 0.85)}, ${Math.round(143 + toneShift * 0.7)})`;
    cCtx.fillRect(0, y0, w, plankH);

    for (let g = 0; g < 65; g++) {
      const gy = y0 + rng() * plankH;
      const amp = 1.5 + rng() * 4.5;
      const freq = 0.008 + rng() * 0.015;
      const phase = rng() * Math.PI * 2;
      const dark = rng() > 0.35;
      cCtx.strokeStyle = dark ? 'rgba(166, 126, 78, 0.22)' : 'rgba(236, 214, 180, 0.22)';
      cCtx.lineWidth = 0.8 + rng() * 1.8;
      bCtx.strokeStyle = dark ? 'rgb(112, 112, 112)' : 'rgb(138, 138, 138)';
      bCtx.lineWidth = cCtx.lineWidth;
      rCtx.strokeStyle = dark ? 'rgb(232, 232, 232)' : 'rgb(196, 196, 196)';
      rCtx.lineWidth = cCtx.lineWidth;

      cCtx.beginPath();
      bCtx.beginPath();
      rCtx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = gy + Math.sin(x * freq + phase) * amp;
        if (x === 0) {
          cCtx.moveTo(x, yy);
          bCtx.moveTo(x, yy);
          rCtx.moveTo(x, yy);
        } else {
          cCtx.lineTo(x, yy);
          bCtx.lineTo(x, yy);
          rCtx.lineTo(x, yy);
        }
      }
      cCtx.stroke();
      bCtx.stroke();
      rCtx.stroke();
    }

    for (let k = 0; k < 420; k++) {
      const px = rng() * w;
      const py = y0 + rng() * plankH;
      const pw = 6 + rng() * 18;
      cCtx.fillStyle = 'rgba(148, 110, 66, 0.14)';
      cCtx.fillRect(px, py, pw, 1);
      bCtx.fillStyle = 'rgb(110, 110, 110)';
      bCtx.fillRect(px, py, pw, 1);
    }

    cCtx.fillStyle = 'rgba(130, 96, 56, 0.28)';
    cCtx.fillRect(0, y0, w, 1.5);
    bCtx.fillStyle = 'rgb(92, 92, 92)';
    bCtx.fillRect(0, y0, w, 1.5);
  }
}

function drawTechLaminateCanvases(cCtx, rCtx, bCtx, w, h, rng) {
  cCtx.fillStyle = '#d8dee6';
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(216, 216, 216)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 6500; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const s = 1 + rng() * 1.8;
    cCtx.fillStyle = rng() > 0.45 ? 'rgba(248, 250, 252, 0.35)' : 'rgba(155, 165, 178, 0.3)';
    cCtx.fillRect(x, y, s, s);
    const bVal = Math.floor(120 + rng() * 16);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(x, y, s, s);
    const rVal = Math.floor(204 + rng() * 34);
    rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rCtx.fillRect(x, y, s, s);
  }
}

function drawCeilingTileCanvases(cCtx, rCtx, bCtx, w, h, rng) {
  cCtx.fillStyle = '#f3f5f8';
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(236, 236, 236)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(134, 134, 134)';
  bCtx.fillRect(0, 0, w, h);

  const tiles = 4;
  const tileSz = w / tiles;

  for (let tx = 0; tx < tiles; tx++) {
    for (let ty = 0; ty < tiles; ty++) {
      const x0 = tx * tileSz;
      const y0 = ty * tileSz;

      for (let i = 0; i < 420; i++) {
        const px = x0 + 10 + rng() * (tileSz - 20);
        const py = y0 + 10 + rng() * (tileSz - 20);
        const rad = 0.8 + rng() * 1.4;
        cCtx.fillStyle = rng() > 0.35 ? 'rgba(182, 191, 202, 0.55)' : 'rgba(152, 162, 174, 0.45)';
        cCtx.beginPath();
        cCtx.arc(px, py, rad, 0, Math.PI * 2);
        cCtx.fill();

        bCtx.fillStyle = 'rgb(88, 88, 88)';
        bCtx.beginPath();
        bCtx.arc(px, py, rad, 0, Math.PI * 2);
        bCtx.fill();
      }

      cCtx.strokeStyle = '#cfd5de';
      cCtx.lineWidth = 8;
      cCtx.strokeRect(x0 + 4, y0 + 4, tileSz - 8, tileSz - 8);

      cCtx.strokeStyle = '#b9c2ce';
      cCtx.lineWidth = 2;
      cCtx.strokeRect(x0 + 9, y0 + 9, tileSz - 18, tileSz - 18);

      rCtx.strokeStyle = 'rgb(155, 155, 155)';
      rCtx.lineWidth = 8;
      rCtx.strokeRect(x0 + 4, y0 + 4, tileSz - 8, tileSz - 8);

      bCtx.strokeStyle = 'rgb(162, 162, 162)';
      bCtx.lineWidth = 8;
      bCtx.strokeRect(x0 + 4, y0 + 4, tileSz - 8, tileSz - 8);
    }
  }
}

function drawBrushedMetalCanvases(cCtx, rCtx, bCtx, w, h, rng, baseRgb = [164, 174, 186]) {
  cCtx.fillStyle = `rgb(${baseRgb[0]}, ${baseRgb[1]}, ${baseRgb[2]})`;
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(210, 210, 210)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 2) {
    const delta = Math.round((rng() - 0.5) * 18);
    cCtx.fillStyle = `rgb(${Math.max(0, Math.min(255, baseRgb[0] + delta))}, ${Math.max(0, Math.min(255, baseRgb[1] + delta))}, ${Math.max(0, Math.min(255, baseRgb[2] + delta))})`;
    cCtx.fillRect(0, y, w, 2);

    const bVal = Math.floor(118 + rng() * 20);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(0, y, w, 1);

    const rVal = Math.floor(190 + rng() * 44);
    rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rCtx.fillRect(0, y, w, 2);
  }
}

function drawMattePlasticCanvases(cCtx, rCtx, bCtx, w, h, rng, baseHex = '#323a46') {
  cCtx.fillStyle = baseHex;
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(225, 225, 225)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 8000; i++) {
    const x = rng() * w;
    const y = rng() * h;
    cCtx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.045)';
    cCtx.fillRect(x, y, 2, 2);

    const bVal = Math.floor(114 + rng() * 28);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(x, y, 2, 2);

    const rVal = Math.floor(208 + rng() * 44);
    rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rCtx.fillRect(x, y, 2, 2);
  }
}

function drawConcreteCanvases(cCtx, rCtx, bCtx, w, h, rng, baseHex = '#c5ccd4') {
  cCtx.fillStyle = baseHex;
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(218, 218, 218)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 520; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const rad = 12 + rng() * 34;
    cCtx.fillStyle = rng() > 0.5 ? 'rgba(240, 244, 248, 0.08)' : 'rgba(130, 140, 152, 0.08)';
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();

    const rVal = Math.floor(195 + rng() * 52);
    rCtx.fillStyle = `rgba(${rVal}, ${rVal}, ${rVal}, 0.2)`;
    rCtx.beginPath();
    rCtx.arc(x, y, rad * 0.8, 0, Math.PI * 2);
    rCtx.fill();
  }

  for (let i = 0; i < 6500; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const s = 1 + rng() * 2.2;
    cCtx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(95, 105, 118, 0.14)';
    cCtx.fillRect(x, y, s, s);
    const bVal = Math.floor(104 + rng() * 44);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(x, y, s, s);
  }
}

function drawFabricCanvases(cCtx, rCtx, bCtx, w, h, rng, baseHex = '#3c4859') {
  cCtx.fillStyle = baseHex;
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(240, 240, 240)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 4) {
    cCtx.fillStyle = y % 8 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
    cCtx.fillRect(0, y, w, 2);
    bCtx.fillStyle = y % 8 === 0 ? 'rgb(142, 142, 142)' : 'rgb(112, 112, 112)';
    bCtx.fillRect(0, y, w, 2);
  }
  for (let x = 0; x < w; x += 4) {
    cCtx.fillStyle = x % 8 === 0 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.035)';
    cCtx.fillRect(x, 0, 2, h);
    bCtx.fillStyle = x % 8 === 0 ? 'rgb(138, 138, 138)' : 'rgb(116, 116, 116)';
    bCtx.fillRect(x, 0, 2, h);
  }
  for (let i = 0; i < 2000; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const bVal = Math.floor(110 + rng() * 36);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(x, y, 2, 2);
  }
}

function makeLedDiffuserTexture(anisotropy, registry) {
  const canvas = makeCanvas(512, 256);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(256, 128, 24, 256, 128, 280);
  grad.addColorStop(0, '#fffdf7');
  grad.addColorStop(0.7, '#fff9ec');
  grad.addColorStop(1, '#f3ecdd');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#e5dfd2';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 248);
  const tex = configureTexture(new THREE.CanvasTexture(canvas), anisotropy, 1, 1, true);
  registry.push(tex);
  return tex;
}

function normalizeCustomColor(hex, fallbackHex) {
  if (!hex || typeof hex !== 'string') return fallbackHex;
  const low = hex.trim().toLowerCase();
  if (low === '#1e293b' || low === '#0f172a' || low === '#38bdf8' || low === '#0ea5e9') {
    return fallbackHex;
  }
  return hex;
}

export function createRealisticMaterialPack(maxAnisotropy = 8) {
  const anisotropy = Math.max(1, Math.min(16, Number(maxAnisotropy) || 8));
  const textures = [];
  const materials = [];
  const wallMatCache = new Map();
  const chairMatCache = new Map();

  const registerMat = (mat) => {
    mat.userData = { ...(mat.userData || {}), managedByMaterialPack: true };
    materials.push(mat);
    return mat;
  };

  const floorCanvases = buildPbrCanvases(1024, 101, drawFloorCanvases);
  const floorTex = canvasesToTextures(floorCanvases, anisotropy, 12, 12, textures);
  const floorMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...floorTex,
      roughness: 0.45,
      metalness: 0.04,
      bumpScale: 0.004
    })
  );

  const ceilingCanvases = buildPbrCanvases(1024, 202, drawCeilingTileCanvases);
  const ceilingTex = canvasesToTextures(ceilingCanvases, anisotropy, 10, 10, textures);
  const ceilingMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...ceilingTex,
      roughness: 0.88,
      metalness: 0.04,
      bumpScale: 0.01
    })
  );

  const plasterCanvases = buildPbrCanvases(512, 303, (c, r, b, w, h, rng) =>
    drawPlasterCanvases(c, r, b, w, h, rng, '#f1f3f6', false)
  );
  const dadoCanvases = buildPbrCanvases(512, 404, (c, r, b, w, h, rng) =>
    drawPlasterCanvases(c, r, b, w, h, rng, '#e4e8ee', true)
  );
  const dadoTex = canvasesToTextures(dadoCanvases, anisotropy, 3, 1, textures);
  const dadoMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...dadoTex,
      roughness: 0.84,
      metalness: 0.0,
      bumpScale: 0.012
    })
  );

  const plinthCanvases = buildPbrCanvases(512, 455, (c, r, b, w, h, rng) =>
    drawBrushedMetalCanvases(c, r, b, w, h, rng, [108, 117, 131])
  );
  const plinthTex = canvasesToTextures(plinthCanvases, anisotropy, 6, 1, textures);
  const plinthMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...plinthTex,
      roughness: 0.52,
      metalness: 0.16,
      bumpScale: 0.004
    })
  );

  const oakCanvases = buildPbrCanvases(512, 505, drawOakWoodCanvases);
  const oakTex = canvasesToTextures(oakCanvases, anisotropy, 2, 1, textures);
  const oakDeskMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...oakTex,
      roughness: 0.48,
      metalness: 0.02,
      bumpScale: 0.008
    })
  );

  const doorFrameTex = canvasesToTextures(oakCanvases, anisotropy, 1, 2, textures);
  const doorFrameMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...doorFrameTex,
      roughness: 0.5,
      metalness: 0.02,
      bumpScale: 0.008
    })
  );

  const techBenchCanvases = buildPbrCanvases(512, 606, drawTechLaminateCanvases);
  const techBenchTex = canvasesToTextures(techBenchCanvases, anisotropy, 2, 1, textures);
  const techBenchMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...techBenchTex,
      roughness: 0.44,
      metalness: 0.04,
      bumpScale: 0.005
    })
  );

  const brushedCanvases = buildPbrCanvases(512, 707, (c, r, b, w, h, rng) =>
    drawBrushedMetalCanvases(c, r, b, w, h, rng, [164, 174, 186])
  );
  const brushedTex = canvasesToTextures(brushedCanvases, anisotropy, 2, 1, textures);
  const brushedMetalMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...brushedTex,
      roughness: 0.3,
      metalness: 0.78,
      bumpScale: 0.005
    })
  );

  const ledFrameTex = canvasesToTextures(brushedCanvases, anisotropy, 1, 1, textures);
  const ledFrameMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...ledFrameTex,
      color: '#e2e8f0',
      roughness: 0.34,
      metalness: 0.55,
      bumpScale: 0.004
    })
  );

  const ledTex = makeLedDiffuserTexture(anisotropy, textures);
  const ledPanelMat = registerMat(
    new THREE.MeshStandardMaterial({
      map: ledTex,
      color: '#fffcf5',
      emissive: '#fff6e4',
      emissiveMap: ledTex,
      emissiveIntensity: 1.25,
      roughness: 0.25,
      metalness: 0.04
    })
  );

  const darkMetalCanvases = buildPbrCanvases(512, 808, (c, r, b, w, h, rng) =>
    drawBrushedMetalCanvases(c, r, b, w, h, rng, [44, 52, 64])
  );
  const darkMetalTex = canvasesToTextures(darkMetalCanvases, anisotropy, 1, 1, textures);
  const darkMetalMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...darkMetalTex,
      roughness: 0.34,
      metalness: 0.65,
      bumpScale: 0.005
    })
  );

  const legCanvases = buildPbrCanvases(512, 909, (c, r, b, w, h, rng) =>
    drawMattePlasticCanvases(c, r, b, w, h, rng, '#667180')
  );
  const legTex = canvasesToTextures(legCanvases, anisotropy, 1, 2, textures);
  const legMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...legTex,
      roughness: 0.42,
      metalness: 0.52,
      bumpScale: 0.004
    })
  );

  const deskEdgeMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...legTex,
      color: '#9aa4b2',
      roughness: 0.46,
      metalness: 0.28,
      bumpScale: 0.003
    })
  );

  const cabinetCanvases = buildPbrCanvases(512, 1010, (c, r, b, w, h, rng) =>
    drawMattePlasticCanvases(c, r, b, w, h, rng, '#b8c1cc')
  );
  const cabinetTex = canvasesToTextures(cabinetCanvases, anisotropy, 1, 1, textures);
  const cabinetMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...cabinetTex,
      roughness: 0.46,
      metalness: 0.44,
      bumpScale: 0.004
    })
  );

  const plasticCanvases = buildPbrCanvases(512, 1111, (c, r, b, w, h, rng) =>
    drawMattePlasticCanvases(c, r, b, w, h, rng, '#2e3643')
  );
  const plasticTex = canvasesToTextures(plasticCanvases, anisotropy, 1, 1, textures);
  const plasticMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...plasticTex,
      roughness: 0.64,
      metalness: 0.04,
      bumpScale: 0.006
    })
  );

  const lightPlasticCanvases = buildPbrCanvases(512, 1212, (c, r, b, w, h, rng) =>
    drawMattePlasticCanvases(c, r, b, w, h, rng, '#d8dee6')
  );
  const lightPlasticTex = canvasesToTextures(lightPlasticCanvases, anisotropy, 1, 1, textures);
  const lightPlasticMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...lightPlasticTex,
      roughness: 0.58,
      metalness: 0.04,
      bumpScale: 0.005
    })
  );

  const esdCanvases = buildPbrCanvases(512, 1313, (c, r, b, w, h, rng) =>
    drawMattePlasticCanvases(c, r, b, w, h, rng, '#3b5c7a')
  );
  const esdTex = canvasesToTextures(esdCanvases, anisotropy, 1, 1, textures);
  const esdMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...esdTex,
      roughness: 0.78,
      metalness: 0.02,
      bumpScale: 0.007
    })
  );

  const acousticCanvases = buildPbrCanvases(512, 1414, (c, r, b, w, h, rng) =>
    drawFabricCanvases(c, r, b, w, h, rng, '#4a5565')
  );
  const acousticTex = canvasesToTextures(acousticCanvases, anisotropy, 2, 2, textures);
  const acousticMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...acousticTex,
      roughness: 0.92,
      metalness: 0.0,
      bumpScale: 0.016
    })
  );

  const greenScreenCanvases = buildPbrCanvases(512, 1515, (c, r, b, w, h, rng) =>
    drawFabricCanvases(c, r, b, w, h, rng, '#189c49')
  );
  const greenScreenTex = canvasesToTextures(greenScreenCanvases, anisotropy, 3, 2, textures);
  const greenScreenMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...greenScreenTex,
      roughness: 0.9,
      metalness: 0.0,
      bumpScale: 0.009
    })
  );

  const concreteCanvases = buildPbrCanvases(512, 1616, (c, r, b, w, h, rng) =>
    drawConcreteCanvases(c, r, b, w, h, rng, '#c1c8d1')
  );
  const concreteTex = canvasesToTextures(concreteCanvases, anisotropy, 2, 1, textures);
  const concreteMat = registerMat(
    new THREE.MeshStandardMaterial({
      ...concreteTex,
      roughness: 0.68,
      metalness: 0.04,
      bumpScale: 0.011
    })
  );

  const glassMat = registerMat(
    new THREE.MeshPhysicalMaterial({
      color: '#e6f3fa',
      transparent: true,
      opacity: 0.24,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.5,
      reflectivity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.35,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );

  const rackGlassMat = registerMat(
    new THREE.MeshPhysicalMaterial({
      color: '#cce2f0',
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      metalness: 0.0,
      ior: 1.5,
      reflectivity: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );

  const getWallMaterial = (lengthMeters = 4, colorHex = '') => {
    const rx = Math.max(1, Math.min(10, Math.round((Number(lengthMeters) || 4) / 2.6)));
    const tint = normalizeCustomColor(colorHex, '#ffffff');
    const key = `${rx}:${tint}`;
    if (wallMatCache.has(key)) return wallMatCache.get(key);
    const tex = canvasesToTextures(plasterCanvases, anisotropy, rx, 1, textures);
    const mat = registerMat(
      new THREE.MeshStandardMaterial({
        ...tex,
        color: tint,
        roughness: 0.88,
        metalness: 0.0,
        bumpScale: 0.014
      })
    );
    wallMatCache.set(key, mat);
    return mat;
  };

  const getChairSeatMaterial = (colorHex = '') => {
    const seatColor = normalizeCustomColor(colorHex, '#3b5575');
    if (chairMatCache.has(seatColor)) return chairMatCache.get(seatColor);
    const mat = registerMat(
      new THREE.MeshStandardMaterial({
        roughnessMap: plasticTex.roughnessMap,
        bumpMap: plasticTex.bumpMap,
        color: seatColor,
        roughness: 0.65,
        metalness: 0.04,
        bumpScale: 0.006
      })
    );
    chairMatCache.set(seatColor, mat);
    return mat;
  };

  const setFloorRepeat = (width, depth) => {
    const rx = Math.max(2, Math.round((Number(width) || 26) / 2));
    const ry = Math.max(2, Math.round((Number(depth) || 24.4) / 2));
    floorTex.map.repeat.set(rx, ry);
    floorTex.roughnessMap.repeat.set(rx, ry);
    floorTex.bumpMap.repeat.set(rx, ry);
  };

  const setCeilingRepeat = (width, depth) => {
    const rx = Math.max(2, (Number(width) || 26) / 2.4);
    const ry = Math.max(2, (Number(depth) || 24.4) / 2.4);
    ceilingTex.map.repeat.set(rx, ry);
    ceilingTex.roughnessMap.repeat.set(rx, ry);
    ceilingTex.bumpMap.repeat.set(rx, ry);
  };

  const dispose = () => {
    for (const tex of textures) {
      tex.dispose();
    }
    for (const mat of materials) {
      mat.dispose();
    }
    textures.length = 0;
    materials.length = 0;
    wallMatCache.clear();
    chairMatCache.clear();
  };

  return {
    floorMat,
    ceilingMat,
    dadoMat,
    plinthMat,
    oakDeskMat,
    doorFrameMat,
    techBenchMat,
    brushedMetalMat,
    ledFrameMat,
    ledPanelMat,
    darkMetalMat,
    legMat,
    deskEdgeMat,
    cabinetMat,
    plasticMat,
    lightPlasticMat,
    esdMat,
    acousticMat,
    greenScreenMat,
    concreteMat,
    glassMat,
    rackGlassMat,
    getWallMaterial,
    getChairSeatMaterial,
    setFloorRepeat,
    setCeilingRepeat,
    dispose
  };
}

export function createStudioPedestalMaterials(maxAnisotropy = 8) {
  const anisotropy = Math.max(1, Math.min(16, Number(maxAnisotropy) || 8));
  const textures = [];

  const concreteCanvases = buildPbrCanvases(512, 2121, (c, r, b, w, h, rng) =>
    drawConcreteCanvases(c, r, b, w, h, rng, '#cfd5dd')
  );
  const concreteTex = canvasesToTextures(concreteCanvases, anisotropy, 2, 1, textures);
  const concreteMat = new THREE.MeshStandardMaterial({
    ...concreteTex,
    roughness: 0.42,
    metalness: 0.04,
    bumpScale: 0.008
  });

  const oakCanvases = buildPbrCanvases(512, 2222, drawOakWoodCanvases);
  const oakTex = canvasesToTextures(oakCanvases, anisotropy, 1, 1, textures);
  const oakMat = new THREE.MeshStandardMaterial({
    ...oakTex,
    roughness: 0.46,
    metalness: 0.02,
    bumpScale: 0.007
  });

  const brushedCanvases = buildPbrCanvases(512, 2323, (c, r, b, w, h, rng) =>
    drawBrushedMetalCanvases(c, r, b, w, h, rng, [196, 204, 214])
  );
  const brushedTex = canvasesToTextures(brushedCanvases, anisotropy, 2, 1, textures);
  const trimMetalMat = new THREE.MeshStandardMaterial({
    ...brushedTex,
    roughness: 0.28,
    metalness: 0.78,
    bumpScale: 0.004
  });

  const dispose = () => {
    for (const tex of textures) tex.dispose();
    concreteMat.dispose();
    oakMat.dispose();
    trimMetalMat.dispose();
  };

  return { concreteMat, oakMat, trimMetalMat, dispose };
}
