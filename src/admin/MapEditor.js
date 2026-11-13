import * as THREE from 'three';
import { buildLabWorld } from '../world/LabBuilder.js';
import {
  MAP_ITEM_CATEGORIES,
  MAP_ITEM_CATALOG,
  computePolygonArea,
  computePolygonCentroid,
  createDefaultMap,
  createEmptyMap,
  getCatalogItem,
  getZonePolygonPoints,
  isPointInPolygon,
  normalizeMapData
} from '../world/mapSchema.js';

function cloneMap(data) {
  return JSON.parse(JSON.stringify(data));
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pointToSegDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

function hitTestRotatedBox(px, pz, obj) {
  const cat = getCatalogItem(obj.type);
  const hw = Math.max(0.32, (obj.w || cat?.defaultW || 1) / 2);
  const hd = Math.max(0.32, (obj.d || cat?.defaultD || 1) / 2);
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const dx = px - obj.x;
  const dz = pz - obj.z;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= hw && Math.abs(lz) <= hd;
}

export class MapEditor {
  constructor(container, { apiFetch, showToast }) {
    this.container = container;
    this.apiFetch = apiFetch;
    this.showToast = showToast;

    this.mapData = createDefaultMap();
    this.undoStack = [];
    this.redoStack = [];
    this.viewMode = typeof window !== 'undefined' && window.innerWidth < 1180 ? '2d' : 'split';
    this.activeCategory = 'arch';
    this.toolMode = 'select';
    this.activeCatalogType = null;
    this.snap = 0.5;
    this.selected = null;
    this.dirty = false;
    this.loaded = false;
    this.isActive = false;

    this.cam2d = { x: 0, z: 0, zoom: 22 };
    this.dragState = null;
    this.polyDraft = null;
    this.hoverWorld = null;
    this.underlay = { img: null, opacity: 0.38, scale: 1, name: '' };

    this.three = {
      renderer: null,
      scene: null,
      camera: null,
      lab: null,
      rafId: 0,
      orbit: { yaw: 0.72, pitch: 0.78, dist: 24, tx: 0, tz: 0 },
      drag: null,
      rebuildTimer: null,
      clock: new THREE.Clock()
    };

    this._pendingConfirm = null;
    this._renderShell();
    this._bindEvents();
    this._renderCatalog();
    this._renderInspector();
    this.fitCamera2D();
    this.draw2D();
  }

  _renderShell() {
    this.container.innerHTML = `
      <div class="me-shell">
        <div class="me-toolbar">
          <div class="me-tb-group">
            <label class="me-tb-label">Nom de la carte</label>
            <input type="text" id="me-map-name" class="me-input me-input-wide" maxlength="70" value="${escapeHtml(this.mapData.name)}" />
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">Dimensions (m)</label>
            <div class="me-dims">
              <input type="number" id="me-bounds-w" class="me-input me-input-num" min="10" max="200" step="1" value="${this.mapData.bounds.width}" title="Largeur X (m) — jusqu'à 200 m" />
              <span>×</span>
              <input type="number" id="me-bounds-d" class="me-input me-input-num" min="10" max="200" step="1" value="${this.mapData.bounds.depth}" title="Profondeur Z (m) — jusqu'à 200 m" />
            </div>
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">Aimant Grille</label>
            <select id="me-snap-select" class="me-select">
              <option value="1">1 m</option>
              <option value="0.5" selected>0.5 m</option>
              <option value="0.25">0.25 m</option>
              <option value="0">Libre</option>
            </select>
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">Vue</label>
            <div class="me-segmented" id="me-view-modes">
              <button type="button" data-view="2d" class="me-seg-btn ${this.viewMode === '2d' ? 'active' : ''}">🗺️ 2D</button>
              <button type="button" data-view="split" class="me-seg-btn ${this.viewMode === 'split' ? 'active' : ''}">⚡ 2D + 3D</button>
              <button type="button" data-view="3d" class="me-seg-btn ${this.viewMode === '3d' ? 'active' : ''}">🧊 3D</button>
            </div>
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">Historique</label>
            <div class="me-btn-row">
              <button type="button" id="me-btn-undo" class="me-btn" title="Annuler (Ctrl+Z)">↶ Annuler</button>
              <button type="button" id="me-btn-redo" class="me-btn" title="Rétablir (Ctrl+Y)">↷ Rétablir</button>
            </div>
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">Calque Plan (PNG/JPG)</label>
            <div class="me-btn-row">
              <label class="me-btn me-file-btn" title="Charger une image de plan sous la grille">
                📐 Importer plan
                <input type="file" id="me-underlay-file" accept="image/png,image/jpeg,image/webp" class="hidden" />
              </label>
              <input type="range" id="me-underlay-opacity" min="0.05" max="0.85" step="0.05" value="0.38" title="Opacité du plan" class="me-slider-mini hidden" />
              <input type="range" id="me-underlay-scale" min="0.1" max="5" step="0.05" value="1" title="Échelle du plan" class="me-slider-mini hidden" />
              <button type="button" id="me-underlay-clear" class="me-btn me-btn-danger hidden" title="Retirer l'image de fond">✕</button>
            </div>
          </div>

          <div class="me-tb-spacer"></div>

          <div class="me-tb-group me-tb-actions">
            <button type="button" id="me-btn-preset-u300" class="me-btn" title="Réinitialiser sur le plan officiel Plateau U300">🏛️ U300</button>
            <button type="button" id="me-btn-clear-all" class="me-btn me-btn-danger" title="Vider la carte pour repartir de zéro">🧹 Vider</button>
            <button type="button" id="me-btn-export" class="me-btn" title="Télécharger la carte au format JSON">⬇️ JSON</button>
            <label class="me-btn me-file-btn" title="Importer un fichier JSON">
              ⬆️ JSON
              <input type="file" id="me-import-file" accept=".json,application/json" class="hidden" />
            </label>
            <button type="button" id="me-btn-save" class="me-btn-save">💾 Sauvegarder & Publier en direct</button>
          </div>
        </div>

        <div class="me-workspace">
          <aside class="me-sidebar">
            <div class="me-tools-row">
              <button type="button" id="me-tool-select" class="me-tool-btn active">🖱️ Sélection</button>
              <button type="button" id="me-tool-pan" class="me-tool-btn">✋ Déplacer vue</button>
            </div>
            <div class="me-cat-tabs" id="me-cat-tabs"></div>
            <div class="me-catalog-list" id="me-catalog-list"></div>
          </aside>

          <main class="me-stage view-${this.viewMode}" id="me-stage">
            <section class="me-pane-2d" id="me-pane-2d">
              <canvas id="me-canvas-2d"></canvas>
              <div class="me-hud-2d-top">
                <span id="me-mode-pill" class="me-pill">Mode : Sélection • Glissez pour déplacer</span>
                <div class="me-zoom-btns">
                  <button type="button" id="me-zoom-in" class="me-icon-btn" title="Zoom +">＋</button>
                  <button type="button" id="me-zoom-out" class="me-icon-btn" title="Zoom -">－</button>
                  <button type="button" id="me-zoom-fit" class="me-icon-btn" title="Recentrer la vue">⌖</button>
                </div>
              </div>
              <div class="me-hud-2d-bottom">
                <span id="me-coords-readout">X: 0.00m • Z: 0.00m</span>
                <span id="me-counts-readout">0 murs • 0 zones • 0 objets</span>
              </div>
            </section>

            <section class="me-pane-3d" id="me-pane-3d">
              <canvas id="me-canvas-3d"></canvas>
              <div class="me-hud-3d-top">
                <span class="me-pill">🧊 Aperçu 3D Temps Réel (Clic gauche : Orbiter • Molette : Zoom • Clic droit : Pan)</span>
                <button type="button" id="me-3d-reset" class="me-icon-btn" title="Recentrer caméra 3D">🎯</button>
              </div>
            </section>
          </main>

          <aside class="me-inspector">
            <div class="me-insp-header">
              <span>🎛️ Inspecteur</span>
              <span id="me-save-badge" class="me-status-dot">Prêt</span>
            </div>
            <div class="me-insp-body" id="me-insp-body"></div>
          </aside>
        </div>
      </div>
    `;

    this.els = {
      nameInput: this.container.querySelector('#me-map-name'),
      boundsW: this.container.querySelector('#me-bounds-w'),
      boundsD: this.container.querySelector('#me-bounds-d'),
      snapSelect: this.container.querySelector('#me-snap-select'),
      viewModes: this.container.querySelector('#me-view-modes'),
      btnUndo: this.container.querySelector('#me-btn-undo'),
      btnRedo: this.container.querySelector('#me-btn-redo'),
      underlayFile: this.container.querySelector('#me-underlay-file'),
      underlayOpacity: this.container.querySelector('#me-underlay-opacity'),
      underlayScale: this.container.querySelector('#me-underlay-scale'),
      underlayClear: this.container.querySelector('#me-underlay-clear'),
      btnPresetU300: this.container.querySelector('#me-btn-preset-u300'),
      btnClearAll: this.container.querySelector('#me-btn-clear-all'),
      btnExport: this.container.querySelector('#me-btn-export'),
      importFile: this.container.querySelector('#me-import-file'),
      btnSave: this.container.querySelector('#me-btn-save'),
      toolSelect: this.container.querySelector('#me-tool-select'),
      toolPan: this.container.querySelector('#me-tool-pan'),
      catTabs: this.container.querySelector('#me-cat-tabs'),
      catalogList: this.container.querySelector('#me-catalog-list'),
      stage: this.container.querySelector('#me-stage'),
      pane2d: this.container.querySelector('#me-pane-2d'),
      canvas2d: this.container.querySelector('#me-canvas-2d'),
      pane3d: this.container.querySelector('#me-pane-3d'),
      canvas3d: this.container.querySelector('#me-canvas-3d'),
      modePill: this.container.querySelector('#me-mode-pill'),
      coordsReadout: this.container.querySelector('#me-coords-readout'),
      countsReadout: this.container.querySelector('#me-counts-readout'),
      saveBadge: this.container.querySelector('#me-save-badge'),
      inspBody: this.container.querySelector('#me-insp-body')
    };
  }

  _bindEvents() {
    this.els.nameInput.addEventListener('input', () => {
      this.mapData.name = this.els.nameInput.value.slice(0, 70) || 'Atelier CIEL 3D';
      this._markDirty();
    });

    const onBoundsChange = () => {
      const w = Math.max(10, Math.min(200, Number(this.els.boundsW.value) || 26));
      const d = Math.max(10, Math.min(200, Number(this.els.boundsD.value) || 24.4));
      this._pushUndo();
      this.mapData.bounds = {
        minX: Number((-w / 2).toFixed(2)),
        maxX: Number((w / 2).toFixed(2)),
        minZ: Number((-d / 2).toFixed(2)),
        maxZ: Number((d / 2).toFixed(2)),
        width: Number(w.toFixed(2)),
        depth: Number(d.toFixed(2)),
        height: this.mapData.bounds.height || 4.6
      };
      this.mapData = normalizeMapData(this.mapData);
      this._syncTopInputs();
      this.fitCamera2D();
      this._sync3DEnvironment();
      this.draw2D();
      this._schedule3DRebuild();
      this._markDirty();
    };
    this.els.boundsW.addEventListener('change', onBoundsChange);
    this.els.boundsD.addEventListener('change', onBoundsChange);

    this.els.snapSelect.addEventListener('change', () => {
      this.snap = Number(this.els.snapSelect.value) || 0;
    });

    this.els.viewModes.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      this.setViewMode(btn.dataset.view);
    });

    this.els.btnUndo.addEventListener('click', () => this.undo());
    this.els.btnRedo.addEventListener('click', () => this.redo());

    this.els.underlayFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          this.underlay.img = img;
          this.underlay.name = file.name;
          this.els.underlayOpacity.classList.remove('hidden');
          this.els.underlayScale.classList.remove('hidden');
          this.els.underlayClear.classList.remove('hidden');
          this.draw2D();
          this.showToast(`📐 Plan de référence "${file.name}" chargé sous la grille`, 'info');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    this.els.underlayOpacity.addEventListener('input', () => {
      this.underlay.opacity = Number(this.els.underlayOpacity.value) || 0.35;
      this.draw2D();
    });
    this.els.underlayScale.addEventListener('input', () => {
      this.underlay.scale = Number(this.els.underlayScale.value) || 1;
      this.draw2D();
    });
    this.els.underlayClear.addEventListener('click', () => {
      this.underlay.img = null;
      this.underlay.name = '';
      this.els.underlayOpacity.classList.add('hidden');
      this.els.underlayScale.classList.add('hidden');
      this.els.underlayClear.classList.add('hidden');
      this.draw2D();
    });

    this.els.btnPresetU300.addEventListener('click', () => {
      if (this._pendingConfirm === 'preset') {
        this._pendingConfirm = null;
        this.els.btnPresetU300.textContent = '🏛️ U300';
        this._pushUndo();
        this.mapData = createDefaultMap();
        this.selected = null;
        this._syncTopInputs();
        this.fitCamera2D();
        this._sync3DEnvironment();
        this.draw2D();
        this._renderInspector();
        this._schedule3DRebuild(true);
        this._markDirty();
        this.showToast('Plateau U300 d’origine chargé dans l’éditeur', 'info');
        return;
      }
      this._armConfirm('preset', this.els.btnPresetU300, '⚠️ Confirmer U300 ?', '🏛️ U300');
    });

    this.els.btnClearAll.addEventListener('click', () => {
      if (this._pendingConfirm === 'clear') {
        this._pendingConfirm = null;
        this.els.btnClearAll.textContent = '🧹 Vider';
        this._pushUndo();
        const bounds = { ...this.mapData.bounds };
        this.mapData = createEmptyMap();
        this.mapData.bounds = bounds;
        this.mapData = normalizeMapData(this.mapData);
        this.selected = null;
        this._syncTopInputs();
        this.fitCamera2D();
        this._sync3DEnvironment();
        this.draw2D();
        this._renderInspector();
        this._schedule3DRebuild(true);
        this._markDirty();
        this.showToast('Carte vidée (cadre extérieur & spawn conservés)', 'info');
        return;
      }
      this._armConfirm('clear', this.els.btnClearAll, '⚠️ Confirmer Vider ?', '🧹 Vider');
    });

    this.els.btnExport.addEventListener('click', () => {
      const payload = JSON.stringify(this.mapData, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carte-ciel-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Carte exportée au format JSON', 'success');
    });

    this.els.importFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.walls) || !Array.isArray(parsed.objects)) {
            throw new Error('JSON invalide (walls/objects requis)');
          }
          this._pushUndo();
          this.mapData = normalizeMapData(parsed);
          this.selected = null;
          this._syncTopInputs();
          this.fitCamera2D();
          this._sync3DEnvironment();
          this.draw2D();
          this._renderInspector();
          this._schedule3DRebuild(true);
          this._markDirty();
          this.showToast(`Carte "${this.mapData.name}" importée`, 'success');
        } catch (err) {
          this.showToast(err.message || 'Impossible de lire ce fichier JSON', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    this.els.btnSave.addEventListener('click', () => this.saveAndPublish());

    this.els.toolSelect.addEventListener('click', () => this.setTool('select', null));
    this.els.toolPan.addEventListener('click', () => this.setTool('pan', null));

    this.container.querySelector('#me-zoom-in').addEventListener('click', () => {
      this.cam2d.zoom = Math.min(140, this.cam2d.zoom * 1.2);
      this.draw2D();
    });
    this.container.querySelector('#me-zoom-out').addEventListener('click', () => {
      this.cam2d.zoom = Math.max(1.5, this.cam2d.zoom / 1.2);
      this.draw2D();
    });
    this.container.querySelector('#me-zoom-fit').addEventListener('click', () => {
      this.fitCamera2D();
      this.draw2D();
    });
    this.container.querySelector('#me-3d-reset').addEventListener('click', () => {
      const b = this.mapData.bounds;
      const diag = Math.hypot(b.width, b.depth);
      this.three.orbit = {
        yaw: 0.72,
        pitch: 0.78,
        dist: Math.max(24, diag * 0.72),
        tx: (b.minX + b.maxX) / 2,
        tz: (b.minZ + b.maxZ) / 2
      };
      this._updateCamera3D();
    });

    this._bindCanvas2DEvents();
    this._bindCanvas3DEvents();

    this._keyHandler = (e) => {
      if (!this.isActive) return;
      const typing = e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        this.redo();
      } else if (e.code === 'Enter' && this.polyDraft) {
        e.preventDefault();
        this._finishPolygonDraft();
      } else if (e.code === 'Backspace' && this.polyDraft) {
        e.preventDefault();
        this.polyDraft.points.pop();
        if (this.polyDraft.points.length === 0) this.polyDraft = null;
        this.draw2D();
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && this.selected) {
        e.preventDefault();
        this.deleteSelected();
      } else if (e.code === 'Escape') {
        if (this.polyDraft) {
          this.polyDraft = null;
          this.draw2D();
          this.showToast('Tracé polygonal annulé', 'info');
        } else if (this.toolMode !== 'select') this.setTool('select', null);
        else {
          this.selected = null;
          this._renderInspector();
          this.draw2D();
        }
      } else if (e.code === 'KeyR' && this.selected?.kind === 'object') {
        e.preventDefault();
        this._rotateSelected(15);
      } else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey) && this.selected) {
        e.preventDefault();
        this.duplicateSelected();
      }
    };
    window.addEventListener('keydown', this._keyHandler);

    this._resizeObserver = new ResizeObserver(() => {
      if (this.isActive) this.handleResize();
    });
    this._resizeObserver.observe(this.els.stage);
  }

  _armConfirm(key, btn, armLabel, resetLabel) {
    this._pendingConfirm = key;
    btn.textContent = armLabel;
    setTimeout(() => {
      if (this._pendingConfirm === key) {
        this._pendingConfirm = null;
        btn.textContent = resetLabel;
      }
    }, 3500);
  }

  _syncTopInputs() {
    this.els.nameInput.value = this.mapData.name || '';
    this.els.boundsW.value = this.mapData.bounds.width;
    this.els.boundsD.value = this.mapData.bounds.depth;
  }

  _markDirty() {
    this.dirty = true;
    this.els.saveBadge.textContent = 'Modifié (non publié)';
    this.els.saveBadge.classList.add('dirty');
  }

  _markClean() {
    this.dirty = false;
    this.els.saveBadge.textContent = 'En ligne & synchro';
    this.els.saveBadge.classList.remove('dirty');
  }

  _pushUndo() {
    this.undoStack.push(cloneMap(this.mapData));
    if (this.undoStack.length > 45) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(cloneMap(this.mapData));
    this.mapData = normalizeMapData(this.undoStack.pop());
    this.selected = null;
    this._syncTopInputs();
    this._sync3DEnvironment();
    this.draw2D();
    this._renderInspector();
    this._schedule3DRebuild(true);
    this._markDirty();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(cloneMap(this.mapData));
    this.mapData = normalizeMapData(this.redoStack.pop());
    this.selected = null;
    this._syncTopInputs();
    this._sync3DEnvironment();
    this.draw2D();
    this._renderInspector();
    this._schedule3DRebuild(true);
    this._markDirty();
  }

  setViewMode(mode) {
    this.viewMode = ['2d', '3d', 'split'].includes(mode) ? mode : 'split';
    this.els.stage.className = `me-stage view-${this.viewMode}`;
    for (const btn of this.els.viewModes.querySelectorAll('button[data-view]')) {
      btn.classList.toggle('active', btn.dataset.view === this.viewMode);
    }
    this.handleResize();
    if (this.viewMode === '3d' || this.viewMode === 'split') {
      this._ensure3D();
    }
  }

  setTool(mode, catalogType = null) {
    this.toolMode = mode;
    this.activeCatalogType = catalogType;
    this.polyDraft = null;
    this.els.toolSelect.classList.toggle('active', mode === 'select');
    this.els.toolPan.classList.toggle('active', mode === 'pan');
    for (const card of this.els.catalogList.querySelectorAll('.me-cat-item')) {
      card.classList.toggle('active', mode === 'place' && card.dataset.type === catalogType);
    }
    if (mode === 'place' && catalogType) {
      const cat = getCatalogItem(catalogType);
      const hint = cat?.isWall
        ? 'Glissez sur la carte pour tracer'
        : cat?.isZonePolygon
          ? 'Cliquez pour poser les sommets • 1er point / Double-clic / Entrée : Fermer • Échap : Annuler'
          : cat?.isZone
            ? 'Glissez un rectangle sur la carte'
            : 'Cliquez sur la carte pour placer';
      this.els.modePill.textContent = `${cat?.icon || ''} ${cat?.shortLabel || catalogType} • ${hint} (Clic droit : Sélection)`;
    } else if (mode === 'pan') {
      this.els.modePill.textContent = 'Mode : Déplacement vue 2D (Pan)';
    } else {
      this.els.modePill.textContent = 'Mode : Sélection • Cliquez ou glissez un élément';
    }
  }

  _renderCatalog() {
    this.els.catTabs.innerHTML = MAP_ITEM_CATEGORIES.map(
      (cat) => `
      <button type="button" class="me-cat-tab ${cat.id === this.activeCategory ? 'active' : ''}" data-cat="${cat.id}">
        ${escapeHtml(cat.label)}
      </button>`
    ).join('');

    this.els.catTabs.onclick = (e) => {
      const btn = e.target.closest('button[data-cat]');
      if (!btn) return;
      this.activeCategory = btn.dataset.cat;
      this._renderCatalog();
    };

    const items = MAP_ITEM_CATALOG.filter((item) => item.category === this.activeCategory);
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.subGroup)) groups.set(item.subGroup, []);
      groups.get(item.subGroup).push(item);
    }

    let html = '';
    for (const [subName, list] of groups.entries()) {
      html += `<div class="me-cat-subgroup">${escapeHtml(subName)}</div><div class="me-cat-grid">`;
      for (const item of list) {
        const isActive = this.toolMode === 'place' && this.activeCatalogType === item.type;
        html += `
          <button type="button" class="me-cat-item ${isActive ? 'active' : ''}" data-type="${escapeHtml(item.type)}" title="${escapeHtml(item.label)}">
            <span class="me-cat-icon">${item.icon}</span>
            <span class="me-cat-name">${escapeHtml(item.shortLabel)}</span>
          </button>`;
      }
      html += '</div>';
    }
    this.els.catalogList.innerHTML = html;

    this.els.catalogList.onclick = (e) => {
      const btn = e.target.closest('button[data-type]');
      if (!btn) return;
      const type = btn.dataset.type;
      if (this.toolMode === 'place' && this.activeCatalogType === type) {
        this.setTool('select', null);
      } else {
        this.setTool('place', type);
      }
    };
  }

  _snapVal(v) {
    if (!this.snap || this.snap <= 0) return Number(v.toFixed(2));
    return Number((Math.round(v / this.snap) * this.snap).toFixed(2));
  }

  _clampToBounds(wx, wz) {
    const b = this.mapData.bounds;
    return [
      Math.max(b.minX, Math.min(b.maxX, wx)),
      Math.max(b.minZ, Math.min(b.maxZ, wz))
    ];
  }

  _worldToScreen(wx, wz) {
    const w = this.els.canvas2d.width / (window.devicePixelRatio || 1);
    const h = this.els.canvas2d.height / (window.devicePixelRatio || 1);
    return [
      w / 2 + (wx - this.cam2d.x) * this.cam2d.zoom,
      h / 2 + (wz - this.cam2d.z) * this.cam2d.zoom
    ];
  }

  _screenToWorld(sx, sy) {
    const w = this.els.canvas2d.width / (window.devicePixelRatio || 1);
    const h = this.els.canvas2d.height / (window.devicePixelRatio || 1);
    return [
      this.cam2d.x + (sx - w / 2) / this.cam2d.zoom,
      this.cam2d.z + (sy - h / 2) / this.cam2d.zoom
    ];
  }

  fitCamera2D() {
    const rect = this.els.pane2d.getBoundingClientRect();
    const b = this.mapData.bounds;
    this.cam2d.x = (b.minX + b.maxX) / 2;
    this.cam2d.z = (b.minZ + b.maxZ) / 2;
    if (rect.width > 40 && rect.height > 40) {
      const zx = (rect.width - 48) / Math.max(4, b.width);
      const zz = (rect.height - 48) / Math.max(4, b.depth);
      this.cam2d.zoom = Math.max(1.5, Math.min(48, Math.min(zx, zz)));
    }
  }

  _getSelectedEntity() {
    if (!this.selected) return null;
    if (this.selected.kind === 'object') {
      return this.mapData.objects.find((o) => o.id === this.selected.id) || null;
    }
    if (this.selected.kind === 'wall') {
      return this.mapData.walls.find((w) => w.id === this.selected.id) || null;
    }
    if (this.selected.kind === 'zone') {
      return this.mapData.zones.find((z) => z.id === this.selected.id) || null;
    }
    return null;
  }

  _syncSpawnFromObject(obj) {
    if (!obj || obj.type !== 'spawn_point') return;
    const rad = ((obj.rotation || 0) * Math.PI) / 180;
    this.mapData.spawn = {
      x: obj.x,
      y: 1.68,
      z: obj.z,
      yaw: Number((rad + Math.PI).toFixed(3))
    };
  }

  _hitTest2D(wx, wz) {
    const sel = this._getSelectedEntity();
    if (sel && this.selected.kind === 'object') {
      const rad = ((sel.rotation || 0) * Math.PI) / 180;
      const distFront = Math.max(sel.d / 2, 0.5) + 18 / this.cam2d.zoom;
      const hx = sel.x + Math.sin(rad) * distFront;
      const hz = sel.z + Math.cos(rad) * distFront;
      if (Math.hypot(wx - hx, wz - hz) <= 14 / this.cam2d.zoom) {
        return { kind: 'handle_rotate', entity: sel };
      }
    } else if (sel && this.selected.kind === 'wall') {
      const tol = 14 / this.cam2d.zoom;
      if (Math.hypot(wx - sel.x1, wz - sel.z1) <= tol) return { kind: 'handle_wall_p1', entity: sel };
      if (Math.hypot(wx - sel.x2, wz - sel.z2) <= tol) return { kind: 'handle_wall_p2', entity: sel };
    } else if (sel && this.selected.kind === 'zone') {
      const tol = 14 / this.cam2d.zoom;
      if (Array.isArray(sel.points) && sel.points.length >= 3) {
        for (let i = 0; i < sel.points.length; i++) {
          const p = sel.points[i];
          if (Math.hypot(wx - p.x, wz - p.z) <= tol) {
            return { kind: 'handle_zone_vertex', entity: sel, index: i };
          }
        }
      } else {
        const cx = sel.x + sel.w / 2;
        const cz = sel.z + sel.d / 2;
        if (Math.hypot(wx - cx, wz - cz) <= tol) return { kind: 'handle_zone_br', entity: sel };
      }
    }

    for (let i = this.mapData.objects.length - 1; i >= 0; i--) {
      const o = this.mapData.objects[i];
      if (hitTestRotatedBox(wx, wz, o)) {
        return { kind: 'object', id: o.id, entity: o };
      }
    }

    const wallTol = Math.max(0.26, 10 / this.cam2d.zoom);
    for (let i = this.mapData.walls.length - 1; i >= 0; i--) {
      const w = this.mapData.walls[i];
      if (pointToSegDist(wx, wz, w.x1, w.z1, w.x2, w.z2) <= wallTol) {
        return { kind: 'wall', id: w.id, entity: w };
      }
    }

    for (let i = this.mapData.zones.length - 1; i >= 0; i--) {
      const z = this.mapData.zones[i];
      const pts = getZonePolygonPoints(z);
      if (isPointInPolygon(wx, wz, pts)) {
        return { kind: 'zone', id: z.id, entity: z };
      }
    }

    return null;
  }

  _bindCanvas2DEvents() {
    const c = this.els.canvas2d;
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = c.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const [wx, wz] = this._screenToWorld(sx, sy);
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        this.cam2d.zoom = Math.max(1.5, Math.min(140, this.cam2d.zoom * factor));
        const w = c.width / (window.devicePixelRatio || 1);
        const h = c.height / (window.devicePixelRatio || 1);
        this.cam2d.x = wx - (sx - w / 2) / this.cam2d.zoom;
        this.cam2d.z = wz - (sy - h / 2) / this.cam2d.zoom;
        this.draw2D();
      },
      { passive: false }
    );

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wz] = this._screenToWorld(sx, sy);

      if (e.button === 1 || e.button === 2 || this.toolMode === 'pan') {
        this.dragState = {
          mode: 'pan',
          startSx: sx,
          startSy: sy,
          origCamX: this.cam2d.x,
          origCamZ: this.cam2d.z,
          moved: false,
          rightClick: e.button === 2
        };
        return;
      }

      if (e.button !== 0) return;

      if (this.toolMode === 'place' && this.activeCatalogType) {
        const cat = getCatalogItem(this.activeCatalogType);
        const [cx, cz] = this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        if (cat?.isWall) {
          this.dragState = {
            mode: 'draw_wall',
            type: this.activeCatalogType,
            x1: cx,
            z1: cz,
            x2: cx,
            z2: cz,
            startSx: sx,
            startSy: sy
          };
          this.draw2D();
          return;
        }
        if (cat?.isZonePolygon) {
          if (!this.polyDraft) {
            this.polyDraft = { points: [{ x: cx, z: cz }] };
            this.draw2D();
            return;
          }
          const pts = this.polyDraft.points;
          const closeTol = Math.max(0.35, 16 / this.cam2d.zoom);
          if (pts.length >= 3 && Math.hypot(wx - pts[0].x, wz - pts[0].z) <= closeTol) {
            this._finishPolygonDraft();
            return;
          }
          const last = pts[pts.length - 1];
          if (!last || Math.hypot(cx - last.x, cz - last.z) >= 0.05) {
            pts.push({ x: cx, z: cz });
          }
          this.draw2D();
          return;
        }
        if (cat?.isZone) {
          this.dragState = {
            mode: 'draw_zone',
            x1: cx,
            z1: cz,
            x2: cx,
            z2: cz,
            startSx: sx,
            startSy: sy
          };
          this.draw2D();
          return;
        }
        this._placeObjectAt(this.activeCatalogType, cx, cz);
        return;
      }

      const hit = this._hitTest2D(wx, wz);
      if (!hit) {
        this.selected = null;
        this._renderInspector();
        this.draw2D();
        return;
      }

      if (hit.kind === 'handle_rotate') {
        this._pushUndo();
        this.dragState = { mode: 'rotate_obj', entity: hit.entity };
        return;
      }
      if (hit.kind === 'handle_wall_p1' || hit.kind === 'handle_wall_p2') {
        this._pushUndo();
        this.dragState = { mode: hit.kind, entity: hit.entity };
        return;
      }
      if (hit.kind === 'handle_zone_br') {
        this._pushUndo();
        this.dragState = { mode: 'resize_zone', entity: hit.entity };
        return;
      }
      if (hit.kind === 'handle_zone_vertex') {
        this._pushUndo();
        this.dragState = { mode: 'move_zone_vertex', entity: hit.entity, index: hit.index };
        return;
      }

      this.selected = { kind: hit.kind, id: hit.id };
      this._renderInspector();
      this._pushUndo();
      if (hit.kind === 'wall') {
        this.dragState = {
          mode: 'move_wall',
          entity: hit.entity,
          startWx: wx,
          startWz: wz,
          ox1: hit.entity.x1,
          oz1: hit.entity.z1,
          ox2: hit.entity.x2,
          oz2: hit.entity.z2,
          moved: false
        };
      } else {
        this.dragState = {
          mode: 'move_entity',
          kind: hit.kind,
          entity: hit.entity,
          startWx: wx,
          startWz: wz,
          ox: hit.entity.x,
          oz: hit.entity.z,
          origPoints: Array.isArray(hit.entity.points)
            ? hit.entity.points.map((p) => ({ x: p.x, z: p.z }))
            : null,
          moved: false
        };
      }
      this.draw2D();
    });

    c.addEventListener('pointermove', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wz] = this._screenToWorld(sx, sy);
      this.hoverWorld = [this._snapVal(wx), this._snapVal(wz)];
      this.els.coordsReadout.textContent = `X: ${this.hoverWorld[0].toFixed(2)}m • Z: ${this.hoverWorld[1].toFixed(2)}m`;

      if (!this.dragState) {
        if (this.toolMode === 'place') this.draw2D();
        return;
      }

      const d = this.dragState;
      if (d.mode === 'pan') {
        const distPx = Math.hypot(sx - d.startSx, sy - d.startSy);
        if (distPx > 4) d.moved = true;
        this.cam2d.x = d.origCamX - (sx - d.startSx) / this.cam2d.zoom;
        this.cam2d.z = d.origCamZ - (sy - d.startSy) / this.cam2d.zoom;
        this.draw2D();
        return;
      }

      if (d.mode === 'draw_wall' || d.mode === 'draw_zone') {
        const [ex, ez] = this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        d.x2 = ex;
        d.z2 = ez;
        this.draw2D();
        return;
      }

      if (d.mode === 'move_entity') {
        const dx = wx - d.startWx;
        const dz = wz - d.startWz;
        if (Math.hypot(dx, dz) > 0.05) d.moved = true;
        if (d.kind === 'zone' && Array.isArray(d.origPoints) && d.origPoints.length >= 3) {
          const b = this.mapData.bounds;
          let minDx = -Infinity;
          let maxDx = Infinity;
          let minDz = -Infinity;
          let maxDz = Infinity;
          for (const p of d.origPoints) {
            minDx = Math.max(minDx, b.minX - p.x);
            maxDx = Math.min(maxDx, b.maxX - p.x);
            minDz = Math.max(minDz, b.minZ - p.z);
            maxDz = Math.min(maxDz, b.maxZ - p.z);
          }
          const rawSdx = this._snapVal(d.ox + dx) - d.ox;
          const rawSdz = this._snapVal(d.oz + dz) - d.oz;
          const sdx = Math.max(minDx, Math.min(maxDx, rawSdx));
          const sdz = Math.max(minDz, Math.min(maxDz, rawSdz));
          d.entity.points = d.origPoints.map((p) => ({
            x: Number((p.x + sdx).toFixed(2)),
            z: Number((p.z + sdz).toFixed(2))
          }));
          this._syncPolygonZoneMetrics(d.entity);
        } else {
          const [nx, nz] = this._clampToBounds(this._snapVal(d.ox + dx), this._snapVal(d.oz + dz));
          d.entity.x = nx;
          d.entity.z = nz;
          if (d.kind === 'object') this._syncSpawnFromObject(d.entity);
        }
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        return;
      }

      if (d.mode === 'move_wall') {
        const dx = wx - d.startWx;
        const dz = wz - d.startWz;
        if (Math.hypot(dx, dz) > 0.05) d.moved = true;
        const sx1 = this._snapVal(d.ox1 + dx);
        const sz1 = this._snapVal(d.oz1 + dz);
        const sdx = sx1 - d.ox1;
        const sdz = sz1 - d.oz1;
        d.entity.x1 = Number((d.ox1 + sdx).toFixed(2));
        d.entity.z1 = Number((d.oz1 + sdz).toFixed(2));
        d.entity.x2 = Number((d.ox2 + sdx).toFixed(2));
        d.entity.z2 = Number((d.oz2 + sdz).toFixed(2));
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        return;
      }

      if (d.mode === 'handle_wall_p1' || d.mode === 'handle_wall_p2') {
        const [px, pz] = this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        if (d.mode === 'handle_wall_p1') {
          d.entity.x1 = px;
          d.entity.z1 = pz;
        } else {
          d.entity.x2 = px;
          d.entity.z2 = pz;
        }
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        return;
      }

      if (d.mode === 'resize_zone') {
        const [px, pz] = this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        const nw = Math.max(1.5, Number(((px - d.entity.x) * 2).toFixed(2)));
        const nd = Math.max(1.5, Number(((pz - d.entity.z) * 2).toFixed(2)));
        d.entity.w = nw;
        d.entity.d = nd;
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        return;
      }

      if (d.mode === 'move_zone_vertex') {
        const [px, pz] = this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        if (Array.isArray(d.entity.points) && d.entity.points[d.index]) {
          d.entity.points[d.index] = { x: px, z: pz };
          this._syncPolygonZoneMetrics(d.entity);
          this._markDirty();
          this._renderInspector();
          this.draw2D();
        }
        return;
      }

      if (d.mode === 'rotate_obj') {
        const angle = (Math.atan2(wx - d.entity.x, wz - d.entity.z) * 180) / Math.PI;
        const snappedDeg = ((Math.round(angle / 15) * 15) % 360 + 360) % 360;
        d.entity.rotation = snappedDeg;
        this._syncSpawnFromObject(d.entity);
        this._markDirty();
        this._renderInspector();
        this.draw2D();
      }
    });

    c.addEventListener('pointerup', (e) => {
      c.releasePointerCapture?.(e.pointerId);
      const d = this.dragState;
      this.dragState = null;
      if (!d) return;

      if (d.mode === 'pan') {
        if (d.rightClick && !d.moved && this.toolMode === 'place') {
          this.setTool('select', null);
          this.draw2D();
        }
        return;
      }

      if (d.mode === 'draw_wall') {
        const cat = getCatalogItem(d.type);
        let x1 = d.x1;
        let z1 = d.z1;
        let x2 = d.x2;
        let z2 = d.z2;
        if (Math.hypot(x2 - x1, z2 - z1) < 0.35) {
          const half = (cat?.defaultW || 2.0) / 2;
          x1 = Number((d.x1 - half).toFixed(2));
          x2 = Number((d.x1 + half).toFixed(2));
          z2 = d.z1;
        }
        this._pushUndo();
        const wallObj = {
          id: `w-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          kind: cat.wallKind || 'solid',
          x1,
          z1,
          x2,
          z2,
          thickness: cat.defaultD || 0.18,
          height: this.mapData.bounds.height || 4.6,
          color: cat.defaultColor || '#1e293b',
          doorLabel: cat.wallKind?.startsWith('door') ? 'SALLE' : ''
        };
        this.mapData.walls.push(wallObj);
        this.selected = { kind: 'wall', id: wallObj.id };
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
        return;
      }

      if (d.mode === 'draw_zone') {
        let minX = Math.min(d.x1, d.x2);
        let maxX = Math.max(d.x1, d.x2);
        let minZ = Math.min(d.z1, d.z2);
        let maxZ = Math.max(d.z1, d.z2);
        if (maxX - minX < 1.2 || maxZ - minZ < 1.2) {
          minX = d.x1 - 3;
          maxX = d.x1 + 3;
          minZ = d.z1 - 2.5;
          maxZ = d.z1 + 2.5;
        }
        this._pushUndo();
        const idx = this.mapData.zones.length + 1;
        const zone = {
          id: `Z-${Date.now()}`,
          code: `U3${idx < 10 ? '0' : ''}${idx}`,
          shortName: 'Nouvelle Salle',
          fullLabel: `Salle U3${idx < 10 ? '0' : ''}${idx} - Atelier CIEL`,
          badgeText: `📍 U3${idx < 10 ? '0' : ''}${idx} - Nouvelle Salle`,
          color: '#38bdf8',
          x: Number(((minX + maxX) / 2).toFixed(2)),
          z: Number(((minZ + maxZ) / 2).toFixed(2)),
          w: Number(Math.max(1.5, maxX - minX).toFixed(2)),
          d: Number(Math.max(1.5, maxZ - minZ).toFixed(2))
        };
        this.mapData.zones.push(zone);
        this.selected = { kind: 'zone', id: zone.id };
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
        return;
      }

      if (d.moved === false && (d.mode === 'move_entity' || d.mode === 'move_wall')) {
        this.undoStack.pop();
      } else {
        this._schedule3DRebuild(true);
      }
    });

    c.addEventListener('dblclick', (e) => {
      if (e.button !== 0 || !this.polyDraft) return;
      if (this.polyDraft.points.length >= 3) {
        this._finishPolygonDraft();
      }
    });
  }

  _syncPolygonZoneMetrics(zone) {
    if (!Array.isArray(zone?.points) || zone.points.length < 3) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of zone.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const centroid = computePolygonCentroid(zone.points);
    zone.x = Number(centroid.x.toFixed(2));
    zone.z = Number(centroid.z.toFixed(2));
    zone.w = Number(Math.max(0.8, maxX - minX).toFixed(2));
    zone.d = Number(Math.max(0.8, maxZ - minZ).toFixed(2));
  }

  _finishPolygonDraft() {
    if (!this.polyDraft) return;
    const pts = this.polyDraft.points.map((p) => ({
      x: Number(p.x.toFixed(2)),
      z: Number(p.z.toFixed(2))
    }));
    if (pts.length < 3 || computePolygonArea(pts) < 0.25) {
      this.polyDraft = null;
      this.draw2D();
      this.showToast('Placez au moins 3 sommets non alignés pour créer une zone polygonale', 'error');
      return;
    }
    this._pushUndo();
    const idx = this.mapData.zones.length + 1;
    const code = `U3${idx < 10 ? '0' : ''}${idx}`;
    const zone = {
      id: `Z-${Date.now()}`,
      code,
      shortName: 'Zone Polygonale',
      fullLabel: `Salle ${code} - Atelier CIEL`,
      badgeText: `📍 ${code} - Zone Polygonale`,
      color: '#38bdf8',
      points: pts
    };
    this._syncPolygonZoneMetrics(zone);
    this.mapData.zones.push(zone);
    this.polyDraft = null;
    this.selected = { kind: 'zone', id: zone.id };
    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
    const codeInput = this.els.inspBody.querySelector('#me-z-code');
    codeInput?.focus();
    codeInput?.select();
  }

  _placeObjectAt(type, x, z) {
    const cat = getCatalogItem(type);
    if (!cat) return;
    this._pushUndo();

    if (type === 'spawn_point') {
      let existing = this.mapData.objects.find((o) => o.type === 'spawn_point');
      if (existing) {
        existing.x = x;
        existing.z = z;
      } else {
        existing = {
          id: 'obj-spawn',
          type: 'spawn_point',
          x,
          z,
          rotation: 0,
          w: cat.defaultW,
          d: cat.defaultD,
          color: cat.defaultColor,
          label: 'Spawn Joueurs'
        };
        this.mapData.objects.push(existing);
      }
      this._syncSpawnFromObject(existing);
      this.selected = { kind: 'object', id: existing.id };
      this.setTool('select', null);
    } else {
      const obj = {
        id: `obj-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        type,
        x,
        z,
        rotation: 0,
        w: cat.defaultW,
        d: cat.defaultD,
        color: cat.defaultColor,
        label: cat.shortLabel,
        dialogue: ''
      };
      this.mapData.objects.push(obj);
      this.selected = { kind: 'object', id: obj.id };
    }

    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  _rotateSelected(deltaDeg) {
    if (!this.selected || this.selected.kind !== 'object') return;
    const obj = this._getSelectedEntity();
    if (!obj) return;
    this._pushUndo();
    obj.rotation = (((obj.rotation || 0) + deltaDeg) % 360 + 360) % 360;
    this._syncSpawnFromObject(obj);
    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  duplicateSelected() {
    const ent = this._getSelectedEntity();
    if (!ent) return;
    this._pushUndo();
    if (this.selected.kind === 'object') {
      if (ent.type === 'spawn_point') {
        this.showToast('Un seul point de Spawn est autorisé par carte', 'error');
        this.undoStack.pop();
        return;
      }
      const copy = {
        ...cloneMap(ent),
        id: `obj-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        x: Number((ent.x + 1).toFixed(2)),
        z: Number((ent.z + 1).toFixed(2))
      };
      this.mapData.objects.push(copy);
      this.selected = { kind: 'object', id: copy.id };
    } else if (this.selected.kind === 'wall') {
      const copy = {
        ...cloneMap(ent),
        id: `w-${Date.now()}-${Math.floor(Math.random() * 999)}`,
        x1: Number((ent.x1 + 1).toFixed(2)),
        z1: Number((ent.z1 + 1).toFixed(2)),
        x2: Number((ent.x2 + 1).toFixed(2)),
        z2: Number((ent.z2 + 1).toFixed(2))
      };
      this.mapData.walls.push(copy);
      this.selected = { kind: 'wall', id: copy.id };
    } else if (this.selected.kind === 'zone') {
      const cloned = cloneMap(ent);
      const copy = {
        ...cloned,
        id: `Z-${Date.now()}`,
        x: Number((ent.x + 1.5).toFixed(2)),
        z: Number((ent.z + 1.5).toFixed(2)),
        points: Array.isArray(cloned.points)
          ? cloned.points.map((p) => ({
              x: Number((p.x + 1.5).toFixed(2)),
              z: Number((p.z + 1.5).toFixed(2))
            }))
          : undefined
      };
      this.mapData.zones.push(copy);
      this.selected = { kind: 'zone', id: copy.id };
    }
    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  deleteSelected() {
    if (!this.selected) return;
    this._pushUndo();
    if (this.selected.kind === 'object') {
      const obj = this._getSelectedEntity();
      if (obj?.type === 'spawn_point') {
        this.showToast('Impossible de supprimer le point de Spawn', 'error');
        this.undoStack.pop();
        return;
      }
      this.mapData.objects = this.mapData.objects.filter((o) => o.id !== this.selected.id);
    } else if (this.selected.kind === 'wall') {
      this.mapData.walls = this.mapData.walls.filter((w) => w.id !== this.selected.id);
    } else if (this.selected.kind === 'zone') {
      this.mapData.zones = this.mapData.zones.filter((z) => z.id !== this.selected.id);
    }
    this.selected = null;
    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  _renderInspector() {
    const ent = this._getSelectedEntity();
    if (!ent) {
      this.els.inspBody.innerHTML = `
        <div class="me-insp-empty">
          <p>Sélectionnez un élément sur le plan 2D pour modifier ses propriétés (position, rotation, dimensions, couleur, texte).</p>
          <div class="me-shortcuts-box">
            <div><strong>Molette</strong> : Zoomer</div>
            <div><strong>Clic droit / Molette</strong> : Déplacer vue</div>
            <div><strong>R</strong> : Tourner (+15°)</div>
            <div><strong>Ctrl+Z / Ctrl+Y</strong> : Annuler / Rétablir</div>
            <div><strong>Suppr</strong> : Supprimer la sélection</div>
          </div>
        </div>`;
      return;
    }

    if (this.selected.kind === 'object') {
      const cat = getCatalogItem(ent.type);
      const isTeacher = ent.type === 'npc_teacher';
      const b = this.mapData.bounds;
      const maxDim = Math.max(120, b.width, b.depth);
      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">${cat?.icon || ''} ${escapeHtml(cat?.label || ent.type)}</div>
        <label class="me-field"><span>Libellé</span><input type="text" id="me-f-label" class="me-input" maxlength="80" value="${escapeHtml(ent.label || '')}" /></label>
        <div class="me-grid-2">
          <label class="me-field"><span>X (m)</span><input type="number" step="0.1" id="me-f-x" class="me-input" value="${ent.x}" /></label>
          <label class="me-field"><span>Z (m)</span><input type="number" step="0.1" id="me-f-z" class="me-input" value="${ent.z}" /></label>
          <label class="me-field"><span>Largeur (m)</span><input type="number" step="0.1" min="0.2" max="${maxDim}" id="me-f-w" class="me-input" value="${ent.w}" /></label>
          <label class="me-field"><span>Profondeur (m)</span><input type="number" step="0.1" min="0.2" max="${maxDim}" id="me-f-d" class="me-input" value="${ent.d}" /></label>
        </div>
        <label class="me-field">
          <span>Orientation : <strong id="me-f-rot-val">${Math.round(ent.rotation || 0)}°</strong></span>
          <input type="range" id="me-f-rot" min="0" max="359" step="1" value="${Math.round(ent.rotation || 0)}" />
        </label>
        <div class="me-rot-presets">
          <button type="button" class="me-btn" data-rot="-90">-90°</button>
          <button type="button" class="me-btn" data-rot="-15">-15°</button>
          <button type="button" class="me-btn" data-rot="15">+15°</button>
          <button type="button" class="me-btn" data-rot="90">+90°</button>
        </div>
        <label class="me-field"><span>Couleur d’accent</span><input type="color" id="me-f-color" class="me-color" value="${escapeHtml(ent.color || '#38bdf8')}" /></label>
        ${
          isTeacher
            ? `<label class="me-field"><span>Dialogue d’accueil du Professeur</span><textarea id="me-f-dialogue" class="me-textarea" rows="4" maxlength="320" placeholder="Message personnalisé affiché aux joueurs...">${escapeHtml(ent.dialogue || '')}</textarea></label>`
            : ''
        }
        <div class="me-insp-actions">
          <button type="button" id="me-insp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-insp-del" class="me-btn me-btn-danger">🗑️ Supprimer</button>
        </div>`;

      this.els.inspBody.querySelector('#me-f-label').oninput = (e) => {
        ent.label = e.target.value.slice(0, 80);
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild();
      };
      const bindNum = (selId, key, min = b.minX, max = b.maxX) => {
        this.els.inspBody.querySelector(selId).onchange = (e) => {
          this._pushUndo();
          ent[key] = Math.max(min, Math.min(max, Number(e.target.value) || 0));
          this._syncSpawnFromObject(ent);
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
      };
      bindNum('#me-f-x', 'x', b.minX, b.maxX);
      bindNum('#me-f-z', 'z', b.minZ, b.maxZ);
      bindNum('#me-f-w', 'w', 0.2, maxDim);
      bindNum('#me-f-d', 'd', 0.2, maxDim);

      const rotRange = this.els.inspBody.querySelector('#me-f-rot');
      const rotLabel = this.els.inspBody.querySelector('#me-f-rot-val');
      rotRange.oninput = () => {
        ent.rotation = Number(rotRange.value) || 0;
        rotLabel.textContent = `${Math.round(ent.rotation)}°`;
        this._syncSpawnFromObject(ent);
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild();
      };
      for (const b of this.els.inspBody.querySelectorAll('button[data-rot]')) {
        b.onclick = () => this._rotateSelected(Number(b.dataset.rot));
      }
      this.els.inspBody.querySelector('#me-f-color').oninput = (e) => {
        ent.color = e.target.value;
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild();
      };
      const diagEl = this.els.inspBody.querySelector('#me-f-dialogue');
      if (diagEl) {
        diagEl.oninput = () => {
          ent.dialogue = diagEl.value.slice(0, 320);
          this._markDirty();
        };
      }
    } else if (this.selected.kind === 'wall') {
      const len = Math.hypot(ent.x2 - ent.x1, ent.z2 - ent.z1).toFixed(2);
      const isDoor = ent.kind === 'door_single' || ent.kind === 'door_double';
      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">🧱 Segment Mur / Cloison / Porte (${len} m)</div>
        <label class="me-field">
          <span>Type</span>
          <select id="me-w-kind" class="me-select">
            <option value="solid" ${ent.kind === 'solid' ? 'selected' : ''}>Mur plein</option>
            <option value="glazed" ${ent.kind === 'glazed' ? 'selected' : ''}>Cloison vitrée</option>
            <option value="door_single" ${ent.kind === 'door_single' ? 'selected' : ''}>Porte simple (passage ouvert)</option>
            <option value="door_double" ${ent.kind === 'door_double' ? 'selected' : ''}>Porte double (passage ouvert)</option>
          </select>
        </label>
        <div class="me-grid-2">
          <label class="me-field"><span>X1 (m)</span><input type="number" step="0.1" id="me-w-x1" class="me-input" value="${ent.x1}" /></label>
          <label class="me-field"><span>Z1 (m)</span><input type="number" step="0.1" id="me-w-z1" class="me-input" value="${ent.z1}" /></label>
          <label class="me-field"><span>X2 (m)</span><input type="number" step="0.1" id="me-w-x2" class="me-input" value="${ent.x2}" /></label>
          <label class="me-field"><span>Z2 (m)</span><input type="number" step="0.1" id="me-w-z2" class="me-input" value="${ent.z2}" /></label>
        </div>
        <div class="me-grid-2">
          <label class="me-field"><span>Épaisseur</span><input type="number" step="0.02" min="0.08" max="0.8" id="me-w-thick" class="me-input" value="${ent.thickness || 0.18}" /></label>
          <label class="me-field"><span>Couleur</span><input type="color" id="me-w-color" class="me-color" value="${escapeHtml(ent.color || '#1e293b')}" /></label>
        </div>
        ${
          isDoor
            ? `<label class="me-field"><span>Panneau au-dessus de la porte</span><input type="text" id="me-w-doorlabel" class="me-input" maxlength="26" value="${escapeHtml(ent.doorLabel || '')}" placeholder="Ex: U301 • BRASURE" /></label>`
            : ''
        }
        <div class="me-insp-actions">
          <button type="button" id="me-insp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-insp-del" class="me-btn me-btn-danger">🗑️ Supprimer</button>
        </div>`;

      this.els.inspBody.querySelector('#me-w-kind').onchange = (e) => {
        this._pushUndo();
        ent.kind = e.target.value;
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
      };
      for (const [id, key] of [
        ['#me-w-x1', 'x1'],
        ['#me-w-z1', 'z1'],
        ['#me-w-x2', 'x2'],
        ['#me-w-z2', 'z2'],
        ['#me-w-thick', 'thickness']
      ]) {
        this.els.inspBody.querySelector(id).onchange = (e) => {
          this._pushUndo();
          ent[key] = Number(e.target.value) || 0;
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
      }
      this.els.inspBody.querySelector('#me-w-color').oninput = (e) => {
        ent.color = e.target.value;
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild();
      };
      const dlEl = this.els.inspBody.querySelector('#me-w-doorlabel');
      if (dlEl) {
        dlEl.oninput = () => {
          ent.doorLabel = dlEl.value.slice(0, 26);
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild();
        };
      }
    } else if (this.selected.kind === 'zone') {
      const b = this.mapData.bounds;
      const isPoly = Array.isArray(ent.points) && ent.points.length >= 3;
      const polyArea = isPoly ? computePolygonArea(ent.points) : ent.w * ent.d;
      const polyVertsHtml = isPoly
        ? `
          <div class="me-insp-badge">Polygone • ${ent.points.length} sommets • ${polyArea.toFixed(1)} m²</div>
          <div style="display:flex;flex-direction:column;gap:4px;max-height:175px;overflow-y:auto;padding-right:2px;">
            ${ent.points
              .map(
                (p, idx) => `
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:11px;color:#94a3b8;width:24px;">S${idx + 1}</span>
                <input type="number" step="0.25" data-vidx="${idx}" data-axis="x" class="me-input me-z-vinput" value="${p.x}" />
                <input type="number" step="0.25" data-vidx="${idx}" data-axis="z" class="me-input me-z-vinput" value="${p.z}" />
                ${
                  ent.points.length > 3
                    ? `<button type="button" data-vdel="${idx}" class="me-btn" style="padding:3px 6px;" title="Supprimer sommet">✕</button>`
                    : ''
                }
              </div>`
              )
              .join('')}
          </div>
          <button type="button" id="me-z-add-vertex" class="me-btn">➕ Ajouter un sommet</button>`
        : `
          <div class="me-grid-2">
            <label class="me-field"><span>Centre X</span><input type="number" step="0.25" id="me-z-x" class="me-input" value="${ent.x}" /></label>
            <label class="me-field"><span>Centre Z</span><input type="number" step="0.25" id="me-z-z" class="me-input" value="${ent.z}" /></label>
            <label class="me-field"><span>Largeur (m)</span><input type="number" step="0.25" min="0.8" max="${b.width}" id="me-z-w" class="me-input" value="${ent.w}" /></label>
            <label class="me-field"><span>Profondeur (m)</span><input type="number" step="0.25" min="0.8" max="${b.depth}" id="me-z-d" class="me-input" value="${ent.d}" /></label>
          </div>
          <button type="button" id="me-z-to-poly" class="me-btn">📐 Convertir en polygone libre</button>`;

      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">Zone de Salle${isPoly ? ' Polygonale' : ''}</div>
        <div class="me-grid-2">
          <label class="me-field"><span>Code salle</span><input type="text" id="me-z-code" class="me-input" maxlength="16" value="${escapeHtml(ent.code || '')}" /></label>
          <label class="me-field"><span>Couleur</span><input type="color" id="me-z-color" class="me-color" value="${escapeHtml(ent.color || '#38bdf8')}" /></label>
        </div>
        <label class="me-field"><span>Nom court</span><input type="text" id="me-z-short" class="me-input" maxlength="40" value="${escapeHtml(ent.shortName || '')}" /></label>
        ${polyVertsHtml}
        <div class="me-insp-actions">
          <button type="button" id="me-insp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-insp-del" class="me-btn me-btn-danger">🗑️ Supprimer</button>
        </div>`;

      this.els.inspBody.querySelector('#me-z-code').oninput = (e) => {
        ent.code = e.target.value.slice(0, 16);
        ent.fullLabel = `${ent.code} - ${ent.shortName}`;
        ent.badgeText = `📍 ${ent.code} - ${ent.shortName}`;
        this._markDirty();
        this.draw2D();
      };
      this.els.inspBody.querySelector('#me-z-short').oninput = (e) => {
        ent.shortName = e.target.value.slice(0, 40);
        ent.fullLabel = `${ent.code} - ${ent.shortName}`;
        ent.badgeText = `📍 ${ent.code} - ${ent.shortName}`;
        this._markDirty();
        this.draw2D();
      };
      this.els.inspBody.querySelector('#me-z-color').oninput = (e) => {
        ent.color = e.target.value;
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild();
      };

      if (isPoly) {
        for (const inp of this.els.inspBody.querySelectorAll('.me-z-vinput')) {
          inp.onchange = (e) => {
            const idx = Number(e.target.dataset.vidx);
            const axis = e.target.dataset.axis;
            if (!ent.points[idx]) return;
            this._pushUndo();
            const raw = Number(e.target.value);
            const clamped =
              axis === 'x'
                ? Math.max(b.minX, Math.min(b.maxX, Number.isFinite(raw) ? raw : ent.points[idx].x))
                : Math.max(b.minZ, Math.min(b.maxZ, Number.isFinite(raw) ? raw : ent.points[idx].z));
            ent.points[idx][axis] = Number(clamped.toFixed(2));
            this._syncPolygonZoneMetrics(ent);
            this._markDirty();
            this._renderInspector();
            this.draw2D();
            this._schedule3DRebuild(true);
          };
        }
        for (const btn of this.els.inspBody.querySelectorAll('[data-vdel]')) {
          btn.onclick = () => {
            if (ent.points.length <= 3) return;
            const idx = Number(btn.dataset.vdel);
            this._pushUndo();
            ent.points.splice(idx, 1);
            this._syncPolygonZoneMetrics(ent);
            this._markDirty();
            this._renderInspector();
            this.draw2D();
            this._schedule3DRebuild(true);
          };
        }
        this.els.inspBody.querySelector('#me-z-add-vertex').onclick = () => {
          this._pushUndo();
          let bestIdx = 0;
          let bestLen = -1;
          for (let i = 0; i < ent.points.length; i++) {
            const p1 = ent.points[i];
            const p2 = ent.points[(i + 1) % ent.points.length];
            const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
            if (len > bestLen) {
              bestLen = len;
              bestIdx = i;
            }
          }
          const a = ent.points[bestIdx];
          const next = ent.points[(bestIdx + 1) % ent.points.length];
          const mid = {
            x: Number(((a.x + next.x) / 2).toFixed(2)),
            z: Number(((a.z + next.z) / 2).toFixed(2))
          };
          ent.points.splice(bestIdx + 1, 0, mid);
          this._syncPolygonZoneMetrics(ent);
          this._markDirty();
          this._renderInspector();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
      } else {
        const zoneLimits = {
          x: [b.minX, b.maxX],
          z: [b.minZ, b.maxZ],
          w: [0.8, b.width],
          d: [0.8, b.depth]
        };
        for (const [id, key] of [
          ['#me-z-x', 'x'],
          ['#me-z-z', 'z'],
          ['#me-z-w', 'w'],
          ['#me-z-d', 'd']
        ]) {
          this.els.inspBody.querySelector(id).onchange = (e) => {
            this._pushUndo();
            const [zMin, zMax] = zoneLimits[key];
            const val = Number(e.target.value);
            ent[key] = Math.max(zMin, Math.min(zMax, Number.isFinite(val) ? val : 2));
            this._markDirty();
            this.draw2D();
            this._schedule3DRebuild(true);
          };
        }
        this.els.inspBody.querySelector('#me-z-to-poly').onclick = () => {
          this._pushUndo();
          ent.points = getZonePolygonPoints(ent);
          this._syncPolygonZoneMetrics(ent);
          this._markDirty();
          this._renderInspector();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
      }
    }

    this.els.inspBody.querySelector('#me-insp-dup')?.addEventListener('click', () => this.duplicateSelected());
    this.els.inspBody.querySelector('#me-insp-del')?.addEventListener('click', () => this.deleteSelected());
  }

  draw2D() {
    const c = this.els.canvas2d;
    const rect = this.els.pane2d.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(100, Math.floor(rect.width));
    const h = Math.max(100, Math.floor(rect.height));
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }

    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#060c18';
    ctx.fillRect(0, 0, w, h);

    const b = this.mapData.bounds;
    const [bx1, bz1] = this._worldToScreen(b.minX, b.minZ);
    const [bx2, bz2] = this._worldToScreen(b.maxX, b.maxZ);

    ctx.fillStyle = '#0b1529';
    ctx.fillRect(bx1, bz1, bx2 - bx1, bz2 - bz1);

    if (this.underlay.img) {
      const iw = Math.max(1, this.underlay.img.width);
      const ih = Math.max(1, this.underlay.img.height);
      const mapPxW = bx2 - bx1;
      const mapPxH = bz2 - bz1;
      const fitRatio = Math.min(mapPxW / iw, mapPxH / ih) * this.underlay.scale;
      const targetW = iw * fitRatio;
      const targetH = ih * fitRatio;
      const cx = (bx1 + bx2) / 2;
      const cz = (bz1 + bz2) / 2;
      ctx.save();
      ctx.globalAlpha = this.underlay.opacity;
      ctx.drawImage(this.underlay.img, cx - targetW / 2, cz - targetH / 2, targetW, targetH);
      ctx.restore();
    }

    let step = 1;
    if (this.cam2d.zoom < 4) step = 10;
    else if (this.cam2d.zoom < 8) step = 5;
    else if (this.cam2d.zoom < 16) step = 2;
    else if (this.cam2d.zoom >= 36 && this.snap === 0.25) step = 0.25;
    else if (this.cam2d.zoom >= 24 && (this.snap === 0.5 || this.snap === 0.25)) step = 0.5;

    const [visMinX, visMinZ] = this._screenToWorld(0, 0);
    const [visMaxX, visMaxZ] = this._screenToWorld(w, h);
    const startGx = Math.max(Math.ceil(b.minX / step) * step, Math.floor(visMinX / step) * step);
    const endGx = Math.min(Math.floor(b.maxX / step) * step, Math.ceil(visMaxX / step) * step);
    const startGz = Math.max(Math.ceil(b.minZ / step) * step, Math.floor(visMinZ / step) * step);
    const endGz = Math.min(Math.floor(b.maxZ / step) * step, Math.ceil(visMaxZ / step) * step);

    ctx.lineWidth = 1;
    for (let gx = startGx; gx <= endGx + 1e-6; gx += step) {
      const rx = Math.round(gx * 100) / 100;
      const [px] = this._worldToScreen(rx, 0);
      ctx.strokeStyle =
        rx === 0
          ? 'rgba(56, 189, 248, 0.35)'
          : Math.abs(rx % 10) < 1e-4
            ? 'rgba(148, 163, 184, 0.2)'
            : 'rgba(148, 163, 184, 0.09)';
      ctx.beginPath();
      ctx.moveTo(px, bz1);
      ctx.lineTo(px, bz2);
      ctx.stroke();
    }
    for (let gz = startGz; gz <= endGz + 1e-6; gz += step) {
      const rz = Math.round(gz * 100) / 100;
      const [, py] = this._worldToScreen(0, rz);
      ctx.strokeStyle =
        rz === 0
          ? 'rgba(56, 189, 248, 0.35)'
          : Math.abs(rz % 10) < 1e-4
            ? 'rgba(148, 163, 184, 0.2)'
            : 'rgba(148, 163, 184, 0.09)';
      ctx.beginPath();
      ctx.moveTo(bx1, py);
      ctx.lineTo(bx2, py);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx1, bz1, bx2 - bx1, bz2 - bz1);

    for (const z of this.mapData.zones) {
      const pts = getZonePolygonPoints(z);
      if (pts.length < 3) continue;
      const rw = z.w * this.cam2d.zoom;
      const rd = z.d * this.cam2d.zoom;
      const isSel = this.selected?.kind === 'zone' && this.selected.id === z.id;
      const screenPts = pts.map((p) => this._worldToScreen(p.x, p.z));

      ctx.beginPath();
      screenPts.forEach(([sx, sy], idx) => {
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = `${z.color || '#38bdf8'}${isSel ? '34' : '1c'}`;
      ctx.fill();
      ctx.strokeStyle = isSel ? '#facc15' : z.color || '#38bdf8';
      ctx.lineWidth = isSel ? 2.5 : 1.2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isSel || (rw >= 18 && rd >= 12)) {
        const [lx, ly] = this._worldToScreen(z.x, z.z);
        ctx.fillStyle = '#e2e8f0';
        const zFont = Math.max(8, Math.min(14, Math.min(rw, rd) * 0.22, this.cam2d.zoom * 0.5));
        ctx.font = `bold ${zFont.toFixed(1)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${z.code || ''} ${z.shortName || ''}`.trim(), lx, ly);
      }

      if (isSel) {
        if (Array.isArray(z.points) && z.points.length >= 3) {
          for (const [hx, hz] of screenPts) {
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(hx, hz, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else {
          const [hx, hz] = this._worldToScreen(z.x + z.w / 2, z.z + z.d / 2);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(hx, hz, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const wall of this.mapData.walls) {
      const [wx1, wz1] = this._worldToScreen(wall.x1, wall.z1);
      const [wx2, wz2] = this._worldToScreen(wall.x2, wall.z2);
      const isSel = this.selected?.kind === 'wall' && this.selected.id === wall.id;
      const isDoor = wall.kind === 'door_single' || wall.kind === 'door_double';
      const thickPx = Math.max(1.5, (wall.thickness || 0.18) * this.cam2d.zoom);
      ctx.lineCap = 'round';
      if (isDoor) {
        ctx.strokeStyle = isSel ? '#facc15' : '#22d3ee';
        ctx.lineWidth = Math.max(2.5, thickPx);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(wx1, wz1);
        ctx.lineTo(wx2, wz2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (this.cam2d.zoom >= 8) {
          const mx = (wx1 + wx2) / 2;
          const mz = (wz1 + wz2) / 2;
          ctx.fillStyle = '#22d3ee';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(wall.doorLabel || '🚪', mx, mz - 9);
        }
      } else {
        ctx.strokeStyle = isSel ? '#facc15' : wall.kind === 'glazed' ? '#38bdf8' : '#cbd5e1';
        ctx.lineWidth = thickPx;
        ctx.beginPath();
        ctx.moveTo(wx1, wz1);
        ctx.lineTo(wx2, wz2);
        ctx.stroke();
      }
      if (isSel) {
        for (const [hx, hz] of [
          [wx1, wz1],
          [wx2, wz2]
        ]) {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(hx, hz, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    for (const obj of this.mapData.objects) {
      const cat = getCatalogItem(obj.type);
      const [px, py] = this._worldToScreen(obj.x, obj.z);
      const pw = Math.max(4, (obj.w || cat?.defaultW || 1) * this.cam2d.zoom);
      const pd = Math.max(4, (obj.d || cat?.defaultD || 1) * this.cam2d.zoom);
      const rad = ((obj.rotation || 0) * Math.PI) / 180;
      const isSel = this.selected?.kind === 'object' && this.selected.id === obj.id;
      const accent = obj.color || cat?.defaultColor || '#38bdf8';

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-rad);

      ctx.fillStyle = isSel ? 'rgba(250, 204, 21, 0.25)' : `${accent}44`;
      ctx.strokeStyle = isSel ? '#facc15' : accent;
      ctx.lineWidth = isSel ? 2.5 : Math.min(1.5, Math.max(0.8, this.cam2d.zoom * 0.12));
      ctx.fillRect(-pw / 2, -pd / 2, pw, pd);
      ctx.strokeRect(-pw / 2, -pd / 2, pw, pd);

      if (Math.min(pw, pd) >= 8) {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(0, pd / 2 + 4);
        ctx.lineTo(-3.5, pd / 2 - 2);
        ctx.lineTo(3.5, pd / 2 - 2);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      if (Math.min(pw, pd) >= 9) {
        ctx.font = `${Math.max(9, Math.min(18, Math.min(pw, pd) * 0.55))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat?.icon || '📦', px, py);
      }

      if (this.cam2d.zoom >= 18 && obj.label) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(obj.label).slice(0, 18), px, py - pd / 2 - 8);
      }

      if (isSel) {
        const distFront = Math.max(obj.d / 2, 0.5) * this.cam2d.zoom + 18;
        const rx = px + Math.sin(rad) * distFront;
        const ry = py + Math.cos(rad) * distFront;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.dragState?.mode === 'draw_wall') {
      const [sx1, sz1] = this._worldToScreen(this.dragState.x1, this.dragState.z1);
      const [sx2, sz2] = this._worldToScreen(this.dragState.x2, this.dragState.z2);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sx1, sz1);
      ctx.lineTo(sx2, sz2);
      ctx.stroke();
      ctx.setLineDash([]);
      const dist = Math.hypot(this.dragState.x2 - this.dragState.x1, this.dragState.z2 - this.dragState.z1);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist.toFixed(2)} m`, (sx1 + sx2) / 2, (sz1 + sz2) / 2 - 12);
    } else if (this.dragState?.mode === 'draw_zone') {
      const minX = Math.min(this.dragState.x1, this.dragState.x2);
      const maxX = Math.max(this.dragState.x1, this.dragState.x2);
      const minZ = Math.min(this.dragState.z1, this.dragState.z2);
      const maxZ = Math.max(this.dragState.z1, this.dragState.z2);
      const [rx1, rz1] = this._worldToScreen(minX, minZ);
      const [rx2, rz2] = this._worldToScreen(maxX, maxZ);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(rx1, rz1, rx2 - rx1, rz2 - rz1);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx1, rz1, rx2 - rx1, rz2 - rz1);
    } else if (this.polyDraft?.points?.length > 0) {
      const pts = this.polyDraft.points;
      const screenPts = pts.map((p) => this._worldToScreen(p.x, p.z));
      const hover = this.hoverWorld
        ? this._clampToBounds(this.hoverWorld[0], this.hoverWorld[1])
        : null;
      const closeTol = Math.max(0.35, 16 / this.cam2d.zoom);
      const canClose = pts.length >= 3;
      const snapToFirst =
        canClose && hover && Math.hypot(hover[0] - pts[0].x, hover[1] - pts[0].z) <= closeTol;
      const previewWorld = snapToFirst ? [pts[0].x, pts[0].z] : hover;

      if (pts.length >= 2) {
        ctx.beginPath();
        screenPts.forEach(([sx, sy], idx) => {
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        if (previewWorld) {
          const [hx, hy] = this._worldToScreen(previewWorld[0], previewWorld[1]);
          ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.fill();
      }

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      screenPts.forEach(([sx, sy], idx) => {
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      if (previewWorld) {
        const [hx, hy] = this._worldToScreen(previewWorld[0], previewWorld[1]);
        ctx.lineTo(hx, hy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (previewWorld && pts.length >= 1) {
        const last = pts[pts.length - 1];
        const segDist = Math.hypot(previewWorld[0] - last.x, previewWorld[1] - last.z);
        if (segDist >= 0.05) {
          const [lsx, lsy] = screenPts[screenPts.length - 1];
          const [hsx, hsy] = this._worldToScreen(previewWorld[0], previewWorld[1]);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${segDist.toFixed(2)} m`, (lsx + hsx) / 2, (lsy + hsy) / 2 - 12);
        }
      }

      screenPts.forEach(([sx, sy], idx) => {
        const isFirst = idx === 0;
        ctx.fillStyle = isFirst && canClose ? (snapToFirst ? '#22c55e' : '#facc15') : '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx, sy, isFirst && canClose ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    } else if (this.toolMode === 'place' && this.activeCatalogType && this.hoverWorld) {
      const cat = getCatalogItem(this.activeCatalogType);
      if (cat && !cat.isWall && !cat.isZone) {
        const [gx, gy] = this._worldToScreen(this.hoverWorld[0], this.hoverWorld[1]);
        const gw = cat.defaultW * this.cam2d.zoom;
        const gd = cat.defaultD * this.cam2d.zoom;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(gx - gw / 2, gy - gd / 2, gw, gd);
        ctx.setLineDash([]);
      }
    }

    this.els.countsReadout.textContent = `${this.mapData.walls.length} murs • ${this.mapData.zones.length} zones • ${this.mapData.objects.length} objets`;
  }

  _ensure3D() {
    if (this.three.renderer) {
      this._resize3D();
      return;
    }
    const canvas = this.els.canvas3d;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071022');
    scene.fog = new THREE.Fog('#071022', 26, 68);

    const hemi = new THREE.HemisphereLight('#c7d2fe', '#0f172a', 1.15);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight('#f8fafc', 1.25);
    dir.position.set(12, 20, 14);
    scene.add(dir);

    const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 320);
    const lab = buildLabWorld(scene, this.mapData);

    this.three.renderer = renderer;
    this.three.scene = scene;
    this.three.camera = camera;
    this.three.lab = lab;

    const b = this.mapData.bounds;
    const diag = Math.hypot(b.width, b.depth);
    this.three.orbit.dist = Math.max(24, diag * 0.72);
    this.three.orbit.tx = (b.minX + b.maxX) / 2;
    this.three.orbit.tz = (b.minZ + b.maxZ) / 2;

    this._sync3DEnvironment();
    this._resize3D();
    this._updateCamera3D();
    this._start3DLoop();
  }

  _sync3DEnvironment() {
    if (!this.three.scene || !this.three.camera) return;
    const b = this.mapData.bounds;
    const diag = Math.hypot(b.width, b.depth);
    this.three.camera.far = Math.max(180, diag * 2.2);
    this.three.camera.updateProjectionMatrix();
    if (this.three.scene.fog) {
      this.three.scene.fog.near = Math.max(26, diag * 0.65);
      this.three.scene.fog.far = Math.max(68, diag * 1.55);
    }
  }

  _resize3D() {
    if (!this.three.renderer || !this.three.camera) return;
    const rect = this.els.pane3d.getBoundingClientRect();
    const w = Math.max(100, Math.floor(rect.width));
    const h = Math.max(100, Math.floor(rect.height));
    this.three.renderer.setSize(w, h, false);
    this.three.camera.aspect = w / h;
    this.three.camera.updateProjectionMatrix();
  }

  _updateCamera3D() {
    if (!this.three.camera) return;
    const { yaw, pitch, dist, tx, tz } = this.three.orbit;
    const hDist = Math.cos(pitch) * dist;
    const cy = Math.max(1.2, 1.2 + Math.sin(pitch) * dist);
    const cx = tx + Math.sin(yaw) * hDist;
    const cz = tz + Math.cos(yaw) * hDist;
    this.three.camera.position.set(cx, cy, cz);
    this.three.camera.lookAt(tx, 1.0, tz);
  }

  _start3DLoop() {
    if (this.three.rafId) return;
    const tick = () => {
      if (!this.isActive || this.viewMode === '2d' || !this.three.renderer) {
        this.three.rafId = 0;
        return;
      }
      const elapsed = this.three.clock.getElapsedTime();
      this.three.lab?.update(elapsed, null, false);
      this.three.renderer.render(this.three.scene, this.three.camera);
      this.three.rafId = requestAnimationFrame(tick);
    };
    this.three.rafId = requestAnimationFrame(tick);
  }

  _schedule3DRebuild(immediate = false) {
    if (!this.three.lab) return;
    if (immediate) {
      clearTimeout(this.three.rebuildTimer);
      this.three.lab.rebuildWorld(this.mapData);
      return;
    }
    clearTimeout(this.three.rebuildTimer);
    this.three.rebuildTimer = setTimeout(() => {
      this.three.lab?.rebuildWorld(this.mapData);
    }, 110);
  }

  _bindCanvas3DEvents() {
    const c = this.els.canvas3d;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 0.9 : 1.11;
        const b = this.mapData.bounds;
        const maxDist = Math.max(60, Math.hypot(b.width, b.depth) * 1.4);
        this.three.orbit.dist = Math.max(3.5, Math.min(maxDist, this.three.orbit.dist * factor));
        this._updateCamera3D();
      },
      { passive: false }
    );
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      this.three.drag = {
        mode: e.button === 2 || e.button === 1 ? 'pan' : 'orbit',
        lx: e.clientX,
        ly: e.clientY
      };
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.three.drag;
      if (!d) return;
      const dx = e.clientX - d.lx;
      const dy = e.clientY - d.ly;
      d.lx = e.clientX;
      d.ly = e.clientY;
      if (d.mode === 'orbit') {
        this.three.orbit.yaw -= dx * 0.007;
        this.three.orbit.pitch = Math.max(0.18, Math.min(1.48, this.three.orbit.pitch + dy * 0.007));
      } else {
        const s = this.three.orbit.dist * 0.0022;
        const cy = Math.cos(this.three.orbit.yaw);
        const sy = Math.sin(this.three.orbit.yaw);
        this.three.orbit.tx -= (cy * dx + sy * dy) * s;
        this.three.orbit.tz -= (-sy * dx + cy * dy) * s;
      }
      this._updateCamera3D();
    });
    c.addEventListener('pointerup', (e) => {
      c.releasePointerCapture?.(e.pointerId);
      this.three.drag = null;
    });
  }

  handleResize() {
    this.draw2D();
    if (this.viewMode === '3d' || this.viewMode === 'split') {
      this._resize3D();
    }
  }

  async activate() {
    this.isActive = true;
    if (!this.loaded) {
      await this.loadFromServer();
    }
    this.handleResize();
    if (this.viewMode === '3d' || this.viewMode === 'split') {
      this._ensure3D();
      this._start3DLoop();
    }
  }

  deactivate() {
    this.isActive = false;
    if (this.three.rafId) {
      cancelAnimationFrame(this.three.rafId);
      this.three.rafId = 0;
    }
  }

  async loadFromServer() {
    try {
      const res = await fetch('/api/map', { cache: 'no-store' });
      const data = await res.json();
      const rawMap = data?.map || (data && Array.isArray(data.walls) ? data : null);
      if (rawMap) {
        this.mapData = normalizeMapData(rawMap);
      } else {
        this.mapData = createDefaultMap();
      }
      this.loaded = true;
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.selected = null;
      this._syncTopInputs();
      this.fitCamera2D();
      this._sync3DEnvironment();
      this.draw2D();
      this._renderInspector();
      this._schedule3DRebuild(true);
      this._markClean();
    } catch {
      this.showToast('Impossible de charger la carte serveur, carte par défaut active', 'error');
    }
  }

  async saveAndPublish() {
    const btn = this.els.btnSave;
    const oldLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Publication en direct...';
    try {
      this.mapData = normalizeMapData(this.mapData);
      const data = await this.apiFetch('/api/admin/map', {
        method: 'PUT',
        body: JSON.stringify({ map: this.mapData })
      });
      if (data?.map) {
        this.mapData = normalizeMapData(data.map);
      }
      this._syncTopInputs();
      this.draw2D();
      this._schedule3DRebuild(true);
      this._markClean();
      this.showToast('🗺️ Carte sauvegardée et publiée en direct à tous les joueurs !', 'success');
    } catch (err) {
      this.showToast(err.message || 'Erreur lors de la sauvegarde de la carte', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }
}
