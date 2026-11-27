import * as THREE from 'three';
import { buildLabWorld } from '../world/LabBuilder.js';
import { MODEL_ACCEPT, buildModelEntryFromFiles } from '../world/ModelImporter.js';
import {
  CAMPUS_SIZE_PRESETS,
  DEFAULT_CAMPUS_SIZE,
  DEFAULT_FLOOR_HEIGHT,
  MAP_ITEM_CATEGORIES,
  MAP_ITEM_CATALOG,
  MAX_FLOOR,
  MAX_IMPORTED_MODELS,
  MAX_MODELS_TOTAL_CHARS,
  MAX_MAP_SIZE,
  MIN_FLOOR,
  WALL_MOUNT_SNAP_RADIUS,
  clampFloor,
  computeEffectiveFloorOpenings,
  computePolygonArea,
  computePolygonCentroid,
  computeWallSnap,
  createCampusMap,
  createDefaultMap,
  createEmptyMap,
  duplicateFloorStructure,
  formatFloorLabel,
  formatFloorShortLabel,
  getCatalogItem,
  getFloorBaseY,
  getFloorContentCount,
  getFloorEntityRefs,
  getZonePolygonPoints,
  isPointInPolygon,
  moveFloorContents,
  normalizeMapData
} from '../world/mapSchema.js';

export const MIN_ZOOM_2D = 0.22;
export const MAX_ZOOM_2D = 220;

export function isBoxInViewport2D(minX, maxX, minZ, maxZ, viewMinX, viewMaxX, viewMinZ, viewMaxZ) {
  return maxX >= viewMinX && minX <= viewMaxX && maxZ >= viewMinZ && minZ <= viewMaxZ;
}

function cloneMap(data) {
  if (data && Array.isArray(data.models)) {
    const { models, ...rest } = data;
    const copy = JSON.parse(JSON.stringify(rest));
    copy.models = models;
    return copy;
  }
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
  const w = obj.w || cat?.defaultW || 1;
  const d = obj.d || cat?.defaultD || 1;
  const hw = Math.max(0.32, w / 2);
  const hd = Math.max(0.32, d / 2);
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const dx = px - obj.x;
  const dz = pz - obj.z;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  if (cat?.wallMount) {
    return Math.abs(lx) <= hw && lz >= -0.18 && lz <= Math.max(0.45, d + 0.16);
  }
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
    this.activeModelId = null;
    this.snap = 0.5;
    this.selected = null;
    this.multiSelected = [];
    this.activeFloor = 0;
    this.onionSkinMode = 'below';
    this.floor3dMode = 'upTo';
    this.wallChainLastPt = null;
    this.minimapDragging = false;
    this.dirty = false;
    this.loaded = false;
    this.isActive = false;

    this.cam2d = { x: 0, z: 0, zoom: 22 };
    this.dragState = null;
    this.polyDraft = null;
    this.hoverWorld = null;
    this.rawHoverWorld = null;
    this.activeWallSnap = null;
    this.altPressed = false;
    this.spacePressed = false;
    this.shiftPressed = false;
    this.panKeys = new Set();
    this._panRafId = 0;
    this._panLastTime = 0;
    this.clipboard = null;
    this.roomOpts = {
      wallKind: 'solid',
      includeFloorSlab: false,
      includeCeiling: true,
      includeDoor: true
    };
    this._mapRev = 1;
    this._cachedOpeningsRev = -1;
    this._cachedOpenings = [];
    this.lastDrawStats = {
      drawnWalls: 0,
      drawnZones: 0,
      drawnObjects: 0,
      totalWalls: 0,
      totalZones: 0,
      totalObjects: 0
    };
    this.underlay = { img: null, opacity: 0.38, scale: 1, name: '' };

    this.three = {
      renderer: null,
      scene: null,
      camera: null,
      lab: null,
      rafId: 0,
      orbit: { yaw: 0.72, pitch: 0.78, dist: 24, tx: 0, ty: 1.2, tz: 0 },
      drag: null,
      rebuildTimer: null,
      clock: new THREE.Clock()
    };

    this._pendingConfirm = null;
    this._renderShell();
    this._bindEvents();
    this._renderFloorBar();
    this._renderBookmarksBar();
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
            <label class="me-tb-label">Dimensions Campus (m)</label>
            <div class="me-dims">
              <input type="number" id="me-bounds-w" class="me-input me-input-num" min="10" max="${MAX_MAP_SIZE}" step="1" value="${this.mapData.bounds.width}" title="Largeur X (m) — jusqu'à ${MAX_MAP_SIZE} m" />
              <span>×</span>
              <input type="number" id="me-bounds-d" class="me-input me-input-num" min="10" max="${MAX_MAP_SIZE}" step="1" value="${this.mapData.bounds.depth}" title="Profondeur Z (m) — jusqu'à ${MAX_MAP_SIZE} m" />
              <div class="me-size-presets" id="me-size-presets" title="Redimensionner le campus en direct sans rien effacer">
                ${CAMPUS_SIZE_PRESETS.map((sz) => `<button type="button" class="me-btn me-btn-xs" data-size="${sz}">${sz}m</button>`).join('')}
              </div>
            </div>
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">H. Étage (m)</label>
            <input type="number" id="me-floor-height" class="me-input me-input-num" min="2.8" max="6" step="0.1" value="${this.mapData.floorHeight || DEFAULT_FLOOR_HEIGHT}" title="Hauteur par étage (m)" />
          </div>

          <div class="me-tb-group">
            <label class="me-tb-label">Aimant Grille</label>
            <select id="me-snap-select" class="me-select">
              <option value="2">2 m</option>
              <option value="1">1 m</option>
              <option value="0.5" selected>0.5 m</option>
              <option value="0.25">0.25 m</option>
              <option value="0.1">0.1 m</option>
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

        <div class="me-floor-bar" id="me-floor-bar">
          <span class="me-floor-bar-label">🏢 Étages (${MIN_FLOOR}..+${MAX_FLOOR}) :</span>
          <div class="me-floor-pills" id="me-floor-pills"></div>
          <button type="button" id="me-btn-add-floor" class="me-btn" title="Ajouter un étage supérieur (+1 jusqu'à +${MAX_FLOOR})">+ Ajouter un étage</button>
          <button type="button" id="me-btn-add-basement" class="me-btn" title="Ajouter un Sous-sol (-1 / -2)">+ Sous-sol</button>
          <label class="me-check-pill" title="Dalle complète sur cet étage (décocher pour mezzanine partielle)">
            <input type="checkbox" id="me-chk-full-slab" checked /> Dalle complète
          </label>
          <button type="button" id="me-btn-onion" class="me-btn active" title="Calque Fantôme (Onion Skinning) pour aligner murs et escaliers">👻 Fantôme : Dessous</button>
          <button type="button" id="me-btn-dup-floor" class="me-btn" title="Copier les murs porteurs et zones vers l'étage supérieur">📋 Dupliquer structure → +1</button>
          <span class="me-floor-bar-label">Étage entier :</span>
          <button type="button" id="me-btn-sel-floor" class="me-btn" title="Sélectionner tout le contenu de l'étage actif (murs, zones, objets) puis glisser pour le déplacer en bloc">🎯 Sélectionner l'étage</button>
          <select id="me-floor-move-target" class="me-select me-select-compact" title="Étage de destination"></select>
          <button type="button" id="me-btn-move-floor" class="me-btn" title="Déplacer tout le contenu de l'étage actif vers l'étage de destination (fusion si la destination contient déjà des éléments)">➡️ Déplacer l'étage</button>
          <button type="button" id="me-btn-swap-floor" class="me-btn" title="Échanger le contenu de l'étage actif avec celui de l'étage de destination">🔁 Échanger</button>
          <select id="me-3d-floor-mode" class="me-select me-select-compact" title="Filtre d'affichage des étages dans l'aperçu 3D">
            <option value="upTo" selected>3D : Jusqu'à l'étage</option>
            <option value="only">3D : Étage actif seul</option>
            <option value="all">3D : Tous les étages</option>
          </select>
        </div>

        <div class="me-bookmarks-bar" id="me-bookmarks-bar">
          <span class="me-floor-bar-label">📍 Repères Campus :</span>
          <div class="me-bookmark-pills" id="me-bookmark-pills"></div>
          <div class="me-bookmark-add">
            <input type="text" id="me-bm-name" class="me-input me-input-bm" maxlength="32" placeholder="Ex: Bâtiment A, Gymnase, Cour..." />
            <button type="button" id="me-btn-add-bm" class="me-btn" title="Enregistrer la position actuelle comme repère">+ Repère ici</button>
          </div>
          <select id="me-zone-jump" class="me-select me-select-compact" title="Aller directement à une salle / zone existante">
            <option value="">🧭 Aller à une zone...</option>
          </select>
        </div>

        <div class="me-workspace">
          <aside class="me-sidebar">
            <div class="me-tools-row me-tools-row-3">
              <button type="button" id="me-tool-select" class="me-tool-btn active" title="Sélectionner / Sélection multiple par rectangle">🖱️ Sélection</button>
              <button type="button" id="me-tool-pan" class="me-tool-btn" title="Déplacer la vue (ou Espace + glisser / ZQSD)">✋ Vue</button>
              <button type="button" id="me-tool-room" class="me-tool-btn" title="Tracer une salle ou un bâtiment complet en 1 clic-glisser">🏗️ Salle</button>
            </div>
            <div class="me-room-opts hidden" id="me-room-opts">
              <div class="me-room-opts-row">
                <select id="me-room-wall-kind" class="me-select me-select-compact" title="Type de murs générés">
                  <option value="solid" selected>🧱 Murs pleins</option>
                  <option value="exterior">🏢 Façades ext.</option>
                  <option value="glazed">🪟 Cloisons vitrées</option>
                </select>
              </div>
              <div class="me-room-opts-checks">
                <label class="me-check-mini"><input type="checkbox" id="me-room-door" checked /> Porte auto</label>
                <label class="me-check-mini"><input type="checkbox" id="me-room-slab" /> Dalle sol</label>
                <label class="me-check-mini"><input type="checkbox" id="me-room-ceil" checked /> Plafond</label>
              </div>
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
                  <button type="button" id="me-zoom-fit" class="me-icon-btn" title="Recentrer sur le campus entier (Vue satellite)">🛰️</button>
                  <button type="button" id="me-zoom-center" class="me-icon-btn" title="Aller au centre (0, 0)">⌖</button>
                </div>
              </div>
              <div class="me-minimap-wrap" id="me-minimap-wrap" title="Mini-plan de repérage — cliquez ou glissez pour naviguer">
                <canvas id="me-minimap-canvas" width="184" height="160"></canvas>
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
      sizePresets: this.container.querySelector('#me-size-presets'),
      floorHeightInput: this.container.querySelector('#me-floor-height'),
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
      floorPills: this.container.querySelector('#me-floor-pills'),
      btnAddFloor: this.container.querySelector('#me-btn-add-floor'),
      btnAddBasement: this.container.querySelector('#me-btn-add-basement'),
      chkFullSlab: this.container.querySelector('#me-chk-full-slab'),
      btnOnion: this.container.querySelector('#me-btn-onion'),
      btnDupFloor: this.container.querySelector('#me-btn-dup-floor'),
      btnSelFloor: this.container.querySelector('#me-btn-sel-floor'),
      floorMoveTarget: this.container.querySelector('#me-floor-move-target'),
      btnMoveFloor: this.container.querySelector('#me-btn-move-floor'),
      btnSwapFloor: this.container.querySelector('#me-btn-swap-floor'),
      mode3dFloor: this.container.querySelector('#me-3d-floor-mode'),
      bookmarkPills: this.container.querySelector('#me-bookmark-pills'),
      bmNameInput: this.container.querySelector('#me-bm-name'),
      btnAddBm: this.container.querySelector('#me-btn-add-bm'),
      zoneJump: this.container.querySelector('#me-zone-jump'),
      toolSelect: this.container.querySelector('#me-tool-select'),
      toolPan: this.container.querySelector('#me-tool-pan'),
      toolRoom: this.container.querySelector('#me-tool-room'),
      roomOptsWrap: this.container.querySelector('#me-room-opts'),
      roomWallKind: this.container.querySelector('#me-room-wall-kind'),
      roomDoorChk: this.container.querySelector('#me-room-door'),
      roomSlabChk: this.container.querySelector('#me-room-slab'),
      roomCeilChk: this.container.querySelector('#me-room-ceil'),
      catTabs: this.container.querySelector('#me-cat-tabs'),
      catalogList: this.container.querySelector('#me-catalog-list'),
      stage: this.container.querySelector('#me-stage'),
      pane2d: this.container.querySelector('#me-pane-2d'),
      canvas2d: this.container.querySelector('#me-canvas-2d'),
      minimapCanvas: this.container.querySelector('#me-minimap-canvas'),
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

    const applyBoundsSize = (wRaw, dRaw, refit = false) => {
      const w = Math.max(10, Math.min(MAX_MAP_SIZE, Number(wRaw) || 26));
      const d = Math.max(10, Math.min(MAX_MAP_SIZE, Number(dRaw) || 24.4));
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
      if (refit) this.fitCamera2D();
      this._sync3DEnvironment();
      this.draw2D();
      this._schedule3DRebuild();
      this._markDirty();
    };
    const onBoundsChange = () => {
      applyBoundsSize(this.els.boundsW.value, this.els.boundsD.value, true);
    };
    this.els.boundsW.addEventListener('change', onBoundsChange);
    this.els.boundsD.addEventListener('change', onBoundsChange);
    this.els.sizePresets?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-size]');
      if (!btn) return;
      const sz = Number(btn.dataset.size) || DEFAULT_CAMPUS_SIZE;
      applyBoundsSize(sz, sz, false);
      this.showToast(`Zone de travail redimensionnée à ${sz}m × ${sz}m (contenu préservé)`, 'success');
    });

    this.els.floorHeightInput.addEventListener('change', () => {
      const fh = Math.max(2.8, Math.min(6.0, Number(this.els.floorHeightInput.value) || DEFAULT_FLOOR_HEIGHT));
      this._pushUndo();
      this.mapData.floorHeight = Number(fh.toFixed(2));
      this.mapData.bounds = { ...this.mapData.bounds, height: this.mapData.floorHeight };
      for (const w of this.mapData.walls || []) {
        if (w.kind !== 'railing') w.height = this.mapData.floorHeight;
      }
      this.mapData = normalizeMapData(this.mapData);
      this._syncTopInputs();
      this.three.orbit.ty = getFloorBaseY(this.mapData, this.activeFloor) + 1.2;
      this._updateCamera3D();
      this._schedule3DRebuild(true);
      this.draw2D();
      this._markDirty();
    });

    this.els.btnAddFloor.addEventListener('click', () => {
      const floors = this.mapData.floors || [{ index: 0, name: 'RDC (0)', hasFullSlab: true }];
      const maxExisting = floors.reduce((m, f) => Math.max(m, f.index), 0);
      if (maxExisting >= MAX_FLOOR) {
        this.showToast(`Plafond maximal (+${MAX_FLOOR}) atteint`, 'info');
        return;
      }
      const nextFl = maxExisting + 1;
      this._pushUndo();
      this._ensureFloorExists(nextFl);
      this._setActiveFloor(nextFl);
      this._schedule3DRebuild(true);
      this._markDirty();
      this.showToast(`${formatFloorLabel(nextFl)} ajouté`, 'success');
    });

    this.els.btnAddBasement.addEventListener('click', () => {
      const floors = this.mapData.floors || [];
      const minExisting = floors.reduce((m, f) => Math.min(m, f.index), 0);
      if (minExisting <= MIN_FLOOR) {
        this._setActiveFloor(MIN_FLOOR);
        this.showToast(`Sous-sol minimal (${MIN_FLOOR}) atteint`, 'info');
        return;
      }
      const nextBase = minExisting - 1;
      this._pushUndo();
      this._ensureFloorExists(nextBase);
      this._setActiveFloor(nextBase);
      this._schedule3DRebuild(true);
      this._markDirty();
      this.showToast(`${formatFloorLabel(nextBase)} ajouté`, 'success');
    });

    this.els.btnAddBm?.addEventListener('click', () => {
      this._addBookmarkAtCamera(this.els.bmNameInput?.value || '');
      if (this.els.bmNameInput) this.els.bmNameInput.value = '';
    });
    this.els.bmNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._addBookmarkAtCamera(this.els.bmNameInput.value || '');
        this.els.bmNameInput.value = '';
      }
    });
    this.els.zoneJump?.addEventListener('change', () => {
      const zId = this.els.zoneJump.value;
      if (!zId) return;
      const z = (this.mapData.zones || []).find((item) => item.id === zId);
      if (z) {
        const zFl = clampFloor(z.floor ?? 0);
        if (zFl !== this.activeFloor) this._setActiveFloor(zFl);
        const span = Math.max(8, z.w || 8, z.d || 8);
        const rect = this.els.pane2d.getBoundingClientRect();
        const targetZoom = rect.width > 40 ? Math.max(2, Math.min(48, (Math.min(rect.width, rect.height) * 0.55) / span)) : 18;
        this.jumpToWorld(z.x, z.z, zFl, targetZoom);
      }
      this.els.zoneJump.value = '';
    });

    this.els.chkFullSlab.addEventListener('change', () => {
      this._pushUndo();
      this._ensureFloorExists(this.activeFloor);
      const flMeta = (this.mapData.floors || []).find((f) => f.index === this.activeFloor);
      if (flMeta) {
        flMeta.hasFullSlab = Boolean(this.els.chkFullSlab.checked);
      }
      this._markDirty();
      this.draw2D();
      this._schedule3DRebuild(true);
    });

    this.els.btnOnion.addEventListener('click', () => this._cycleOnionSkin());
    this.els.btnDupFloor.addEventListener('click', () => this._duplicateActiveFloor());
    this.els.btnSelFloor.addEventListener('click', () => this._selectActiveFloorContents());
    this.els.btnMoveFloor.addEventListener('click', () => this._moveActiveFloor('move'));
    this.els.btnSwapFloor.addEventListener('click', () => this._moveActiveFloor('swap'));
    this.els.mode3dFloor.addEventListener('change', () => {
      this.floor3dMode = this.els.mode3dFloor.value || 'upTo';
      this._apply3DFloorCutoff();
    });

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
    this.els.toolRoom?.addEventListener('click', () => this.setTool('place', 'room_builder'));
    this.els.roomWallKind?.addEventListener('change', () => {
      this.roomOpts.wallKind = this.els.roomWallKind.value || 'solid';
    });
    this.els.roomDoorChk?.addEventListener('change', () => {
      this.roomOpts.includeDoor = Boolean(this.els.roomDoorChk.checked);
    });
    this.els.roomSlabChk?.addEventListener('change', () => {
      this.roomOpts.includeFloorSlab = Boolean(this.els.roomSlabChk.checked);
    });
    this.els.roomCeilChk?.addEventListener('change', () => {
      this.roomOpts.includeCeiling = Boolean(this.els.roomCeilChk.checked);
    });

    this.container.querySelector('#me-zoom-in').addEventListener('click', () => {
      this.cam2d.zoom = Math.min(MAX_ZOOM_2D, this.cam2d.zoom * 1.28);
      this.draw2D();
    });
    this.container.querySelector('#me-zoom-out').addEventListener('click', () => {
      this.cam2d.zoom = Math.max(MIN_ZOOM_2D, this.cam2d.zoom / 1.28);
      this.draw2D();
    });
    this.container.querySelector('#me-zoom-fit').addEventListener('click', () => {
      this.fitCamera2D();
      this.draw2D();
    });
    this.container.querySelector('#me-zoom-center')?.addEventListener('click', () => {
      this.jumpToWorld(0, 0, this.activeFloor, Math.max(12, Math.min(28, this.cam2d.zoom < 4 ? 18 : this.cam2d.zoom)));
    });
    this.container.querySelector('#me-3d-reset').addEventListener('click', () => {
      const b = this.mapData.bounds;
      const diag = Math.hypot(b.width, b.depth);
      this.three.orbit = {
        yaw: 0.72,
        pitch: 0.78,
        dist: Math.max(24, Math.min(420, diag * 0.62)),
        tx: this.cam2d.x || 0,
        ty: getFloorBaseY(this.mapData, this.activeFloor) + 1.2,
        tz: this.cam2d.z || 0
      };
      this._updateCamera3D();
    });

    this._bindCanvas2DEvents();
    this._bindCanvas3DEvents();
    this._bindMiniMapEvents();

    const PAN_KEY_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    this._keyHandler = (e) => {
      if (!this.isActive) return;
      if (e.key === 'Alt' || e.altKey !== this.altPressed) {
        this.altPressed = Boolean(e.altKey);
        this._refreshAltSnapPreview();
      }
      this.shiftPressed = Boolean(e.shiftKey);
      const typing = e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.spacePressed = true;
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        this.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        if (this.multiSelected.length > 0 || this.selected) {
          e.preventDefault();
          this.copySelection();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        if (this.clipboard) {
          e.preventDefault();
          this.pasteClipboard();
        }
      } else if (e.code === 'Enter' && this.polyDraft) {
        e.preventDefault();
        this._finishPolygonDraft();
      } else if (e.code === 'Backspace' && this.polyDraft) {
        e.preventDefault();
        this.polyDraft.points.pop();
        if (this.polyDraft.points.length === 0) this.polyDraft = null;
        this.draw2D();
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && (this.multiSelected.length > 1 || this.selected)) {
        e.preventDefault();
        if (this.multiSelected.length > 1) this._deleteMultiSelected();
        else this.deleteSelected();
      } else if (e.code === 'Escape') {
        if (this.polyDraft) {
          this.polyDraft = null;
          this.draw2D();
          this.showToast('Tracé polygonal annulé', 'info');
        } else if (this.wallChainLastPt) {
          this.wallChainLastPt = null;
          this.draw2D();
        } else if (this.toolMode !== 'select') {
          this.setTool('select', null);
        } else {
          this.selected = null;
          this.multiSelected = [];
          this._renderInspector();
          this.draw2D();
        }
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && (this.multiSelected.length > 1 || this.selected?.kind === 'object')) {
        e.preventDefault();
        if (this.multiSelected.length > 1) this._rotateGroup90();
        else this._rotateSelected(15);
      } else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey) && (this.multiSelected.length > 1 || this.selected)) {
        e.preventDefault();
        if (this.multiSelected.length > 1) this._duplicateMultiSelected();
        else this.duplicateSelected();
      } else if (!e.ctrlKey && !e.metaKey && PAN_KEY_CODES.has(e.code)) {
        e.preventDefault();
        this.panKeys.add(e.code);
        this._startKeyboardPanLoop();
      }
    };
    this._keyUpHandler = (e) => {
      if (!this.isActive) return;
      if (e.key === 'Alt' || e.altKey !== this.altPressed) {
        this.altPressed = Boolean(e.altKey);
        this._refreshAltSnapPreview();
      }
      this.shiftPressed = Boolean(e.shiftKey);
      if (e.code === 'Space') {
        this.spacePressed = false;
      }
      if (this.panKeys.has(e.code)) {
        this.panKeys.delete(e.code);
        if (this.panKeys.size === 0) this._stopKeyboardPanLoop();
      }
    };
    this._blurHandler = () => {
      this.spacePressed = false;
      this.shiftPressed = false;
      this.panKeys.clear();
      this._stopKeyboardPanLoop();
      if (this.altPressed) {
        this.altPressed = false;
        this._refreshAltSnapPreview();
      }
    };
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('keyup', this._keyUpHandler);
    window.addEventListener('blur', this._blurHandler);

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
    if (this.els.floorHeightInput) {
      this.els.floorHeightInput.value = this.mapData.floorHeight || this.mapData.bounds.height || DEFAULT_FLOOR_HEIGHT;
    }
    this._renderFloorBar();
    this._renderBookmarksBar();
  }

  _startKeyboardPanLoop() {
    if (this._panRafId) return;
    this._panLastTime = performance.now();
    const step = (now) => {
      if (!this.isActive || this.panKeys.size === 0) {
        this._panRafId = 0;
        return;
      }
      const dt = Math.min(0.08, Math.max(0.004, (now - this._panLastTime) / 1000));
      this._panLastTime = now;
      let vx = 0;
      let vz = 0;
      if (this.panKeys.has('KeyW') || this.panKeys.has('ArrowUp')) vz -= 1;
      if (this.panKeys.has('KeyS') || this.panKeys.has('ArrowDown')) vz += 1;
      if (this.panKeys.has('KeyA') || this.panKeys.has('ArrowLeft')) vx -= 1;
      if (this.panKeys.has('KeyD') || this.panKeys.has('ArrowRight')) vx += 1;
      if (vx !== 0 || vz !== 0) {
        const len = Math.hypot(vx, vz) || 1;
        const speedPx = this.shiftPressed ? 1150 : 420;
        const speedWorld = speedPx / Math.max(MIN_ZOOM_2D, this.cam2d.zoom);
        const b = this.mapData.bounds;
        this.cam2d.x = Math.max(b.minX - 40, Math.min(b.maxX + 40, this.cam2d.x + (vx / len) * speedWorld * dt));
        this.cam2d.z = Math.max(b.minZ - 40, Math.min(b.maxZ + 40, this.cam2d.z + (vz / len) * speedWorld * dt));
        this.draw2D();
      }
      this._panRafId = requestAnimationFrame(step);
    };
    this._panRafId = requestAnimationFrame(step);
  }

  _stopKeyboardPanLoop() {
    if (this._panRafId) {
      cancelAnimationFrame(this._panRafId);
      this._panRafId = 0;
    }
  }

  jumpToWorld(x, z, floor = this.activeFloor, zoom = null) {
    const fl = clampFloor(floor);
    if (fl !== this.activeFloor) {
      this._setActiveFloor(fl);
    }
    const b = this.mapData.bounds;
    this.cam2d.x = Math.max(b.minX, Math.min(b.maxX, Number(x) || 0));
    this.cam2d.z = Math.max(b.minZ, Math.min(b.maxZ, Number(z) || 0));
    if (Number.isFinite(Number(zoom))) {
      this.cam2d.zoom = Math.max(MIN_ZOOM_2D, Math.min(MAX_ZOOM_2D, Number(zoom)));
    }
    this.three.orbit.tx = this.cam2d.x;
    this.three.orbit.tz = this.cam2d.z;
    this.three.orbit.ty = getFloorBaseY(this.mapData, fl) + 1.2;
    this._updateCamera3D();
    this.draw2D();
  }

  _addBookmarkAtCamera(rawLabel = '') {
    const clean = String(rawLabel || '').trim().slice(0, 32) || `Repère ${(this.mapData.bookmarks?.length || 0) + 1}`;
    this._pushUndo();
    if (!Array.isArray(this.mapData.bookmarks)) {
      this.mapData.bookmarks = [];
    }
    this.mapData.bookmarks.push({
      id: `bm-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      label: clean,
      x: Number(this.cam2d.x.toFixed(2)),
      z: Number(this.cam2d.z.toFixed(2)),
      floor: this.activeFloor,
      zoom: Number(this.cam2d.zoom.toFixed(2))
    });
    this._markDirty();
    this._renderBookmarksBar();
    this.draw2D();
    this.showToast(`📍 Repère "${clean}" enregistré`, 'success');
  }

  _removeBookmark(bmId) {
    if (!Array.isArray(this.mapData.bookmarks)) return;
    this._pushUndo();
    this.mapData.bookmarks = this.mapData.bookmarks.filter((b) => b.id !== bmId);
    this._markDirty();
    this._renderBookmarksBar();
    this.draw2D();
  }

  _renderBookmarksBar() {
    if (!this.els?.bookmarkPills) return;
    const list = Array.isArray(this.mapData.bookmarks) ? this.mapData.bookmarks : [];
    const defaultQuick = list.length === 0
      ? `<button type="button" class="me-bm-chip me-bm-default" data-jump-origin="1" title="Centrer sur l'Atelier CIEL (0, 0)">🏛️ Centre (0,0)</button>`
      : '';
    this.els.bookmarkPills.innerHTML =
      defaultQuick +
      list
        .map(
          (bm) => `
      <span class="me-bm-chip-wrap">
        <button type="button" class="me-bm-chip" data-bm-id="${escapeHtml(bm.id)}" title="${escapeHtml(bm.label)} — (${bm.x}m, ${bm.z}m, ${escapeHtml(formatFloorShortLabel(bm.floor))})">
          📍 ${escapeHtml(bm.label)} <small>${escapeHtml(formatFloorShortLabel(bm.floor))}</small>
        </button>
        <button type="button" class="me-bm-del" data-bm-del="${escapeHtml(bm.id)}" title="Supprimer ce repère">×</button>
      </span>`
        )
        .join('');
    this.els.bookmarkPills.onclick = (e) => {
      const delBtn = e.target.closest('button[data-bm-del]');
      if (delBtn) {
        this._removeBookmark(delBtn.dataset.bmDel);
        return;
      }
      const originBtn = e.target.closest('button[data-jump-origin]');
      if (originBtn) {
        this.jumpToWorld(0, 0, 0, 16);
        return;
      }
      const jumpBtn = e.target.closest('button[data-bm-id]');
      if (!jumpBtn) return;
      const bm = (this.mapData.bookmarks || []).find((item) => item.id === jumpBtn.dataset.bmId);
      if (bm) {
        this.jumpToWorld(bm.x, bm.z, bm.floor, bm.zoom);
      }
    };
    if (this.els.zoneJump) {
      const zones = Array.isArray(this.mapData.zones) ? this.mapData.zones : [];
      this.els.zoneJump.innerHTML =
        `<option value="">🧭 Aller à une zone (${zones.length})...</option>` +
        zones
          .slice(0, 120)
          .map(
            (z) =>
              `<option value="${escapeHtml(z.id)}">${escapeHtml(formatFloorShortLabel(z.floor ?? 0))} • ${escapeHtml(z.code || '')} ${escapeHtml(z.shortName || '')}</option>`
          )
          .join('');
    }
  }

  _getEffectiveOpeningsCached() {
    if (this._cachedOpeningsRev !== this._mapRev) {
      this._cachedOpenings = computeEffectiveFloorOpenings(this.mapData);
      this._cachedOpeningsRev = this._mapRev;
    }
    return this._cachedOpenings;
  }

  _ensureFloorExists(fl) {
    const idx = clampFloor(fl);
    if (!Array.isArray(this.mapData.floors)) {
      this.mapData.floors = [{ index: 0, label: 'RDC (0)', hasFullSlab: true }];
    }
    if (!this.mapData.floors.some((f) => f.index === idx)) {
      this.mapData.floors.push({ index: idx, label: formatFloorLabel(idx), hasFullSlab: true });
      this.mapData.floors.sort((a, b) => a.index - b.index);
    }
    return this.mapData.floors.find((f) => f.index === idx);
  }

  _renderFloorBar() {
    if (!this.els?.floorPills) return;
    const floors = Array.isArray(this.mapData.floors) && this.mapData.floors.length > 0
      ? [...this.mapData.floors].sort((a, b) => a.index - b.index)
      : [{ index: 0, label: 'RDC (0)', hasFullSlab: true }];
    if (!floors.some((f) => f.index === this.activeFloor)) {
      this.activeFloor = floors[0].index;
    }
    this.els.floorPills.innerHTML = floors
      .map(
        (fl) => `
      <button type="button" class="me-floor-pill ${fl.index === this.activeFloor ? 'active' : ''}" data-floor="${fl.index}" title="${escapeHtml(fl.label || fl.name || formatFloorLabel(fl.index))}">
        ${escapeHtml(formatFloorShortLabel(fl.index))}
      </button>`
      )
      .join('');
    this.els.floorPills.onclick = (e) => {
      const btn = e.target.closest('button[data-floor]');
      if (!btn) return;
      this._setActiveFloor(Number(btn.dataset.floor));
    };
    this._renderFloorMoveTargets();
    const activeMeta = floors.find((f) => f.index === this.activeFloor);
    if (this.els.chkFullSlab) {
      this.els.chkFullSlab.checked = activeMeta ? activeMeta.hasFullSlab !== false : true;
    }
    if (this.els.btnOnion) {
      const labels = {
        off: '👻 Fantôme : Off',
        below: '👻 Fantôme : Dessous',
        above: '👻 Fantôme : Dessus',
        both: '👻 Fantôme : D+H'
      };
      this.els.btnOnion.textContent = labels[this.onionSkinMode] || labels.below;
      this.els.btnOnion.classList.toggle('active', this.onionSkinMode !== 'off');
    }
  }

  _renderFloorMoveTargets() {
    const sel = this.els.floorMoveTarget;
    if (!sel) return;
    const prev = Number(sel.value);
    const fallback = this.activeFloor < MAX_FLOOR ? this.activeFloor + 1 : this.activeFloor - 1;
    let html = '';
    const candidates = [];
    for (let fl = MIN_FLOOR; fl <= MAX_FLOOR; fl++) {
      if (fl !== this.activeFloor) candidates.push(fl);
    }
    const wanted = candidates.includes(prev) && sel.dataset.touched === '1' ? prev : fallback;
    for (const fl of candidates) {
      const count = getFloorContentCount(this.mapData, fl);
      html += `<option value="${fl}" ${fl === wanted ? 'selected' : ''}>→ ${escapeHtml(formatFloorShortLabel(fl))}${count > 0 ? ` (${count})` : ''}</option>`;
    }
    sel.innerHTML = html;
    sel.onchange = () => {
      sel.dataset.touched = '1';
    };
  }

  _selectActiveFloorContents() {
    const refs = getFloorEntityRefs(this.mapData, this.activeFloor);
    if (refs.length === 0) {
      this.showToast(`${formatFloorShortLabel(this.activeFloor)} est vide`, 'info');
      return;
    }
    this.setTool('select', null);
    if (refs.length === 1) {
      this.selected = refs[0];
      this.multiSelected = [];
    } else {
      this.selected = null;
      this.multiSelected = refs;
    }
    this._renderInspector();
    this.draw2D();
    this.showToast(`🎯 ${refs.length} élément(s) de ${formatFloorShortLabel(this.activeFloor)} sélectionné(s) — glissez-en un pour tout déplacer`, 'info');
  }

  _moveActiveFloor(mode) {
    const src = this.activeFloor;
    const dst = clampFloor(Number(this.els.floorMoveTarget?.value));
    if (dst === src) {
      this.showToast('Choisissez un étage de destination différent', 'info');
      return;
    }
    const srcCount = getFloorContentCount(this.mapData, src);
    const dstCount = getFloorContentCount(this.mapData, dst);
    if (srcCount === 0 && !(mode === 'swap' && dstCount > 0)) {
      this.showToast(`${formatFloorShortLabel(src)} est vide, rien à déplacer`, 'info');
      return;
    }
    const btn = mode === 'swap' ? this.els.btnSwapFloor : this.els.btnMoveFloor;
    const resetLabel = mode === 'swap' ? '🔁 Échanger' : "➡️ Déplacer l'étage";
    const key = `floor-${mode}-${src}-${dst}`;
    if (mode === 'move' && dstCount > 0 && this._pendingConfirm !== key) {
      this._armConfirm(key, btn, `⚠️ ${formatFloorShortLabel(dst)} contient ${dstCount} élément(s) : fusionner ? (re-cliquer)`, resetLabel);
      return;
    }
    this._pendingConfirm = null;
    btn.textContent = resetLabel;
    this._pushUndo();
    const res = moveFloorContents(this.mapData, src, dst, mode);
    this.mapData = res.mapData;
    this._ensureFloorExists(dst);
    this._markDirty();
    this.selected = null;
    this.multiSelected = [];
    if (mode === 'move') {
      this._setActiveFloor(dst);
    } else {
      this._renderFloorBar();
      this._renderInspector();
      this.draw2D();
    }
    this._schedule3DRebuild(true);
    this.showToast(
      mode === 'swap'
        ? `🔁 ${formatFloorShortLabel(src)} ⇄ ${formatFloorShortLabel(dst)} échangés (${res.moved} élément(s))`
        : `➡️ ${res.moved} élément(s) déplacé(s) de ${formatFloorShortLabel(src)} vers ${formatFloorShortLabel(dst)}`,
      'success'
    );
  }

  async _importModelFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if ((this.mapData.models || []).length >= MAX_IMPORTED_MODELS) {
      this.showToast(`Maximum ${MAX_IMPORTED_MODELS} modèles importés par carte`, 'error');
      return;
    }
    this.showToast('Import du modèle 3D en cours...', 'info');
    try {
      const entry = await buildModelEntryFromFiles(files);
      const used = (this.mapData.models || []).reduce(
        (acc, m) => acc + Object.values(m.files || {}).reduce((a, d) => a + d.length, 0),
        0
      );
      const added = Object.values(entry.files).reduce((a, d) => a + d.length, 0);
      if (used + added > MAX_MODELS_TOTAL_CHARS) {
        this.showToast('Volume total de modèles importés trop élevé pour cette carte', 'error');
        return;
      }
      this._pushUndo();
      this.mapData.models = [...(this.mapData.models || []), entry];
      this._markDirty();
      this.activeCategory = 'models';
      this.activeModelId = entry.id;
      this._renderCatalog();
      this.setTool('place', 'custom_model');
      this.showToast(`🧊 « ${entry.name} » importé — cliquez sur la carte pour le placer sur ${formatFloorShortLabel(this.activeFloor)}`, 'success');
    } catch (err) {
      this.showToast(`Import impossible : ${err?.message || err}`, 'error');
    }
  }

  _deleteImportedModel(modelId, btn) {
    const key = `del-model-${modelId}`;
    if (this._pendingConfirm !== key) {
      this._armConfirm(key, btn, '⚠️ Confirmer ?', '🗑️');
      return;
    }
    this._pendingConfirm = null;
    this._pushUndo();
    this.mapData.models = (this.mapData.models || []).filter((m) => m.id !== modelId);
    this.mapData.objects = this.mapData.objects.filter((o) => o.modelId !== modelId);
    if (this.activeModelId === modelId) {
      this.activeModelId = null;
      this.setTool('select', null);
    }
    this.selected = null;
    this.multiSelected = [];
    this._markDirty();
    this._renderCatalog();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  _renderModelsPanel() {
    const models = this.mapData.models || [];
    let html = `
      <div class="me-cat-subgroup">Importer</div>
      <label class="me-btn me-file-btn" style="display:block;text-align:center;margin-bottom:6px;" title="Importer un modèle 3D depuis votre ordinateur">
        📥 Importer un modèle 3D
        <input type="file" id="me-model-file" accept="${MODEL_ACCEPT}" multiple class="hidden" />
      </label>
      <div class="me-shortcuts-box">
        Formats : <strong>.glb .gltf .obj .fbx .json</strong>.<br />
        Sélectionnez en même temps les fichiers associés (.mtl, .bin, textures .png/.jpg) pour conserver matériaux et textures.
      </div>
      <div class="me-cat-subgroup">Modèles de la carte (${models.length})</div>`;
    if (models.length === 0) {
      html += '<div class="me-insp-empty"><p>Aucun modèle importé pour le moment.</p></div>';
    }
    for (const m of models) {
      const isActive = this.toolMode === 'place' && this.activeCatalogType === 'custom_model' && this.activeModelId === m.id;
      html += `
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <button type="button" class="me-cat-item ${isActive ? 'active' : ''}" data-type="custom_model" data-model-id="${escapeHtml(m.id)}" style="flex:1;" title="Placer ${escapeHtml(m.name)} sur ${escapeHtml(formatFloorShortLabel(this.activeFloor))}">
            <span class="me-cat-icon">🧊</span>
            <span class="me-cat-name">${escapeHtml(m.name)} (.${escapeHtml(m.format)})</span>
          </button>
          <button type="button" class="me-btn me-btn-danger" data-del-model="${escapeHtml(m.id)}" title="Supprimer ce modèle et ses instances">🗑️</button>
        </div>`;
    }
    this.els.catalogList.innerHTML = html;
    this.els.catalogList.querySelector('#me-model-file').onchange = (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      this._importModelFiles(files);
    };
    this.els.catalogList.onclick = (e) => {
      const del = e.target.closest('button[data-del-model]');
      if (del) {
        this._deleteImportedModel(del.dataset.delModel, del);
        return;
      }
      const btn = e.target.closest('button[data-model-id]');
      if (!btn) return;
      const id = btn.dataset.modelId;
      if (this.toolMode === 'place' && this.activeCatalogType === 'custom_model' && this.activeModelId === id) {
        this.setTool('select', null);
      } else {
        this.activeModelId = id;
        this.setTool('place', 'custom_model');
      }
      this._renderCatalog();
    };
  }

  _setActiveFloor(fl) {
    const next = clampFloor(fl);
    this._ensureFloorExists(next);
    this.activeFloor = next;
    this.selected = null;
    this.multiSelected = [];
    this.wallChainLastPt = null;
    this.polyDraft = null;
    this.three.orbit.ty = getFloorBaseY(this.mapData, next) + 1.2;
    this._renderFloorBar();
    this._apply3DFloorCutoff();
    this._updateCamera3D();
    this._renderInspector();
    this.draw2D();
  }

  _cycleOnionSkin() {
    const order = ['below', 'both', 'above', 'off'];
    const i = order.indexOf(this.onionSkinMode);
    this.onionSkinMode = order[(i + 1) % order.length];
    this._renderFloorBar();
    this.draw2D();
  }

  _duplicateActiveFloor() {
    const targetFloor = this.activeFloor + 1;
    if (targetFloor > MAX_FLOOR) {
      this.showToast(`Impossible de dupliquer au-delà de +${MAX_FLOOR}`, 'info');
      return;
    }
    this._pushUndo();
    this.mapData = duplicateFloorStructure(this.mapData, this.activeFloor, targetFloor);
    this._setActiveFloor(targetFloor);
    this._schedule3DRebuild(true);
    this._markDirty();
    this.showToast(`Structure copiée vers ${formatFloorLabel(targetFloor)}`, 'success');
  }

  _apply3DFloorCutoff() {
    if (!this.three?.lab?.setEditorFloorCutoff) return;
    if (this.floor3dMode === 'all') {
      this.three.lab.setEditorFloorCutoff(null, 'all');
    } else {
      this.three.lab.setEditorFloorCutoff(this.activeFloor, this.floor3dMode);
    }
  }

  _bindMiniMapEvents() {
    const mc = this.els.minimapCanvas;
    if (!mc) return;
    const panToEvent = (e) => {
      const rect = mc.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const my = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const b = this.mapData.bounds;
      const pad = 6;
      const scale = Math.min((rect.width - pad * 2) / Math.max(1, b.width), (rect.height - pad * 2) / Math.max(1, b.depth));
      const offX = pad + (rect.width - pad * 2 - b.width * scale) / 2;
      const offY = pad + (rect.height - pad * 2 - b.depth * scale) / 2;
      this.cam2d.x = Math.max(b.minX, Math.min(b.maxX, b.minX + (mx - offX) / scale));
      this.cam2d.z = Math.max(b.minZ, Math.min(b.maxZ, b.minZ + (my - offY) / scale));
      this.draw2D();
    };
    mc.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      mc.setPointerCapture?.(e.pointerId);
      this.minimapDragging = true;
      panToEvent(e);
    });
    mc.addEventListener('pointermove', (e) => {
      if (!this.minimapDragging) return;
      e.stopPropagation();
      panToEvent(e);
    });
    mc.addEventListener('pointerup', (e) => {
      this.minimapDragging = false;
      mc.releasePointerCapture?.(e.pointerId);
    });
  }

  _markDirty() {
    this.dirty = true;
    this._mapRev++;
    this.els.saveBadge.textContent = 'Modifié (non publié)';
    this.els.saveBadge.classList.add('dirty');
    this._renderBookmarksBar();
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
    this.wallChainLastPt = null;
    this.activeWallSnap = null;
    const isRoomTool = mode === 'place' && catalogType === 'room_builder';
    this.els.toolSelect.classList.toggle('active', mode === 'select');
    this.els.toolPan.classList.toggle('active', mode === 'pan');
    this.els.toolRoom?.classList.toggle('active', isRoomTool);
    this.els.roomOptsWrap?.classList.toggle('hidden', !isRoomTool);
    for (const card of this.els.catalogList.querySelectorAll('.me-cat-item')) {
      card.classList.toggle(
        'active',
        mode === 'place' &&
          card.dataset.type === catalogType &&
          (!card.dataset.modelId || card.dataset.modelId === this.activeModelId)
      );
    }
    if (mode === 'place' && catalogType) {
      const cat = getCatalogItem(catalogType);
      const hint = cat?.isRoomBuilder
        ? 'Glissez un rectangle pour générer 4 murs + sol + plafond en 1 geste'
        : cat?.isWall
          ? 'Glissez ou cliquez en continu pour chaîner les murs (Échap : finir)'
          : cat?.isZonePolygon
            ? 'Cliquez pour poser les sommets • 1er point / Double-clic / Entrée : Fermer • Échap : Annuler'
            : cat?.isZone
              ? 'Glissez un rectangle sur la carte (dimensions en m affichées en direct)'
              : cat?.isStair
                ? 'Cliquez pour placer l’escalier + trémie auto N+1'
                : cat?.wallMount
                  ? 'Approchez d’un mur pour aimanter (Alt : libre)'
                  : 'Cliquez sur la carte pour placer';
      this.els.modePill.textContent = `${cat?.icon || ''} ${cat?.shortLabel || catalogType} • ${hint} (Clic droit : Sélection)`;
    } else if (mode === 'pan') {
      this.els.modePill.textContent = 'Mode : Déplacement vue 2D (Pan • ou Espace+glisser / ZQSD+Shift)';
    } else {
      this.els.modePill.textContent = 'Mode : Sélection • Glissez pour sélection multiple • Ctrl+C/V • ZQSD pour naviguer';
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

    if (this.activeCategory === 'models') {
      this._renderModelsPanel();
      return;
    }

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

  _resolveWallSnap(wx, wz, cat, altDown = false, fallbackRotation = null) {
    if (!cat?.wallMount || altDown) return null;
    const floorWalls = (this.mapData.walls || []).filter((w) => clampFloor(w.floor ?? 0) === this.activeFloor);
    const snap = computeWallSnap({
      px: wx,
      pz: wz,
      walls: floorWalls,
      maxRadius: WALL_MOUNT_SNAP_RADIUS,
      fallbackRotation
    });
    if (!snap) return null;
    const [cx, cz] = this._clampToBounds(snap.x, snap.z);
    return { ...snap, x: cx, z: cz };
  }

  _snapToWallEndpoint(wx, wz, altDown = false) {
    if (!altDown) {
      const tol = Math.max(0.45, 12 / this.cam2d.zoom);
      let bestDist = tol;
      let bestPt = null;
      for (const w of this.mapData.walls || []) {
        if (clampFloor(w.floor ?? 0) !== this.activeFloor) continue;
        for (const [ex, ez] of [
          [w.x1, w.z1],
          [w.x2, w.z2]
        ]) {
          const d = Math.hypot(wx - ex, wz - ez);
          if (d <= bestDist) {
            bestDist = d;
            bestPt = [Number(ex.toFixed(2)), Number(ez.toFixed(2))];
          }
        }
      }
      if (bestPt) return bestPt;
    }
    return this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
  }

  _refreshAltSnapPreview() {
    if (this.toolMode === 'place' && this.activeCatalogType && this.rawHoverWorld) {
      const cat = getCatalogItem(this.activeCatalogType);
      const [wx, wz] = this.rawHoverWorld;
      const snap = this._resolveWallSnap(wx, wz, cat, this.altPressed);
      this.activeWallSnap = snap;
      this.hoverWorld = snap ? [snap.x, snap.z] : [this._snapVal(wx), this._snapVal(wz)];
      this.draw2D();
      return;
    }
    if (this.dragState?.mode === 'move_entity' && this.dragState.kind === 'object' && this.rawHoverWorld) {
      const d = this.dragState;
      const cat = getCatalogItem(d.entity.type);
      if (cat?.wallMount) {
        const [wx, wz] = this.rawHoverWorld;
        const dx = wx - d.startWx;
        const dz = wz - d.startWz;
        const snap = this._resolveWallSnap(wx, wz, cat, this.altPressed, d.origRot);
        if (snap) {
          d.entity.x = snap.x;
          d.entity.z = snap.z;
          d.entity.rotation = snap.rotation;
          this.activeWallSnap = snap;
        } else {
          const [nx, nz] = this._clampToBounds(this._snapVal(d.ox + dx), this._snapVal(d.oz + dz));
          d.entity.x = nx;
          d.entity.z = nz;
          this.activeWallSnap = null;
        }
        d.moved = true;
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        return;
      }
    }
    if (this.selected?.kind === 'object') {
      this.draw2D();
    }
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
      this.cam2d.zoom = Math.max(MIN_ZOOM_2D, Math.min(48, Math.min(zx, zz)));
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
    const fl = clampFloor(obj.floor ?? 0);
    this.mapData.spawn = {
      x: obj.x,
      y: getFloorBaseY(this.mapData, fl) + 1.68,
      z: obj.z,
      floor: fl,
      yaw: Number((rad + Math.PI).toFixed(3))
    };
  }

  _isMultiSelected(kind, id) {
    return this.multiSelected.some((m) => m.kind === kind && m.id === id);
  }

  _findEntityByRef(ref) {
    if (!ref) return null;
    if (ref.kind === 'object') return this.mapData.objects.find((o) => o.id === ref.id) || null;
    if (ref.kind === 'wall') return this.mapData.walls.find((w) => w.id === ref.id) || null;
    if (ref.kind === 'zone') return this.mapData.zones.find((z) => z.id === ref.id) || null;
    return null;
  }

  _hitTest2D(wx, wz) {
    const sel = this._getSelectedEntity();
    const curFloor = this.activeFloor;
    if (sel && clampFloor(sel.floor ?? 0) === curFloor && this.selected.kind === 'object') {
      const cat = getCatalogItem(sel.type);
      const rad = ((sel.rotation || 0) * Math.PI) / 180;
      const baseDepth = cat?.wallMount ? Math.max(sel.d, 0.4) : Math.max(sel.d / 2, 0.5);
      const distFront = baseDepth + 18 / this.cam2d.zoom;
      const hx = sel.x + Math.sin(rad) * distFront;
      const hz = sel.z + Math.cos(rad) * distFront;
      if (Math.hypot(wx - hx, wz - hz) <= 14 / this.cam2d.zoom) {
        return { kind: 'handle_rotate', entity: sel };
      }
    } else if (sel && clampFloor(sel.floor ?? 0) === curFloor && this.selected.kind === 'wall') {
      const tol = 14 / this.cam2d.zoom;
      if (Math.hypot(wx - sel.x1, wz - sel.z1) <= tol) return { kind: 'handle_wall_p1', entity: sel };
      if (Math.hypot(wx - sel.x2, wz - sel.z2) <= tol) return { kind: 'handle_wall_p2', entity: sel };
    } else if (sel && clampFloor(sel.floor ?? 0) === curFloor && this.selected.kind === 'zone') {
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
      if (clampFloor(o.floor ?? 0) !== curFloor) continue;
      if (hitTestRotatedBox(wx, wz, o)) {
        return { kind: 'object', id: o.id, entity: o };
      }
    }

    const wallTol = Math.max(0.26, 10 / this.cam2d.zoom);
    for (let i = this.mapData.walls.length - 1; i >= 0; i--) {
      const w = this.mapData.walls[i];
      if (clampFloor(w.floor ?? 0) !== curFloor) continue;
      if (pointToSegDist(wx, wz, w.x1, w.z1, w.x2, w.z2) <= wallTol) {
        return { kind: 'wall', id: w.id, entity: w };
      }
    }

    for (let i = this.mapData.zones.length - 1; i >= 0; i--) {
      const z = this.mapData.zones[i];
      if (clampFloor(z.floor ?? 0) !== curFloor) continue;
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
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        this.cam2d.zoom = Math.max(MIN_ZOOM_2D, Math.min(MAX_ZOOM_2D, this.cam2d.zoom * factor));
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

      if (e.button === 1 || e.button === 2 || this.toolMode === 'pan' || this.spacePressed) {
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
        const altDown = Boolean(e.altKey || this.altPressed);
        const snap = this._resolveWallSnap(wx, wz, cat, altDown);
        const [cx, cz] = snap
          ? [snap.x, snap.z]
          : this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        const initRotation = snap ? snap.rotation : 0;
        if (cat?.isRoomBuilder) {
          this.dragState = {
            mode: 'draw_room',
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
        if (cat?.isWall) {
          const [wpx, wpz] = this._snapToWallEndpoint(wx, wz, altDown);
          this.dragState = {
            mode: 'draw_wall',
            type: this.activeCatalogType,
            x1: wpx,
            z1: wpz,
            x2: wpx,
            z2: wpz,
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
        this._placeObjectAt(this.activeCatalogType, cx, cz, initRotation);
        return;
      }

      const hit = this._hitTest2D(wx, wz);
      if (!hit) {
        this.selected = null;
        this.multiSelected = [];
        this.dragState = {
          mode: 'marquee',
          startSx: sx,
          startSy: sy,
          startWx: wx,
          startWz: wz,
          curWx: wx,
          curWz: wz,
          moved: false
        };
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

      if (this.multiSelected.length > 1 && this._isMultiSelected(hit.kind, hit.id)) {
        this._pushUndo();
        const snapshots = [];
        for (const ref of this.multiSelected) {
          const item = this._findEntityByRef(ref);
          if (!item) continue;
          if (ref.kind === 'wall') {
            snapshots.push({ kind: 'wall', entity: item, ox1: item.x1, oz1: item.z1, ox2: item.x2, oz2: item.z2 });
          } else {
            snapshots.push({
              kind: ref.kind,
              entity: item,
              ox: item.x,
              oz: item.z,
              origPoints: Array.isArray(item.points) ? item.points.map((p) => ({ x: p.x, z: p.z })) : null
            });
          }
        }
        this.dragState = {
          mode: 'move_group',
          startWx: wx,
          startWz: wz,
          snapshots,
          moved: false
        };
        this.draw2D();
        return;
      }

      this.multiSelected = [];
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
          origRot: hit.entity.rotation || 0,
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
      const altDown = Boolean(e.altKey || this.altPressed);
      this.altPressed = altDown;
      this.rawHoverWorld = [wx, wz];

      const activePlaceCat =
        this.toolMode === 'place' && this.activeCatalogType
          ? getCatalogItem(this.activeCatalogType)
          : null;
      const hoverSnap =
        !this.dragState && activePlaceCat?.wallMount
          ? this._resolveWallSnap(wx, wz, activePlaceCat, altDown)
          : null;
      if (!this.dragState) {
        this.activeWallSnap = hoverSnap;
      }
      this.hoverWorld = hoverSnap
        ? [hoverSnap.x, hoverSnap.z]
        : [this._snapVal(wx), this._snapVal(wz)];
      const zoomTxt = this.cam2d.zoom >= 10 ? `${this.cam2d.zoom.toFixed(0)} px/m` : `${this.cam2d.zoom.toFixed(2)} px/m`;
      this.els.coordsReadout.textContent = hoverSnap
        ? `X: ${hoverSnap.x.toFixed(2)}m • Z: ${hoverSnap.z.toFixed(2)}m • 🧲 Mur (${Math.round(hoverSnap.rotation)}°) • ${zoomTxt}`
        : `X: ${this.hoverWorld[0].toFixed(2)}m • Z: ${this.hoverWorld[1].toFixed(2)}m • ${zoomTxt}`;

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

      if (d.mode === 'marquee') {
        d.curWx = wx;
        d.curWz = wz;
        if (Math.hypot(sx - d.startSx, sy - d.startSy) > 5) d.moved = true;
        this.draw2D();
        return;
      }

      if (d.mode === 'move_group') {
        const dx = wx - d.startWx;
        const dz = wz - d.startWz;
        if (Math.hypot(dx, dz) > 0.05) d.moved = true;
        const sdx = this._snapVal(dx);
        const sdz = this._snapVal(dz);
        for (const s of d.snapshots) {
          if (s.kind === 'wall') {
            s.entity.x1 = Number((s.ox1 + sdx).toFixed(2));
            s.entity.z1 = Number((s.oz1 + sdz).toFixed(2));
            s.entity.x2 = Number((s.ox2 + sdx).toFixed(2));
            s.entity.z2 = Number((s.oz2 + sdz).toFixed(2));
          } else {
            const [nx, nz] = this._clampToBounds(s.ox + sdx, s.oz + sdz);
            s.entity.x = Number(nx.toFixed(2));
            s.entity.z = Number(nz.toFixed(2));
            if (Array.isArray(s.origPoints) && s.origPoints.length >= 3) {
              s.entity.points = s.origPoints.map((p) => ({
                x: Number((p.x + sdx).toFixed(2)),
                z: Number((p.z + sdz).toFixed(2))
              }));
              this._syncPolygonZoneMetrics(s.entity);
            }
            if (s.kind === 'object') this._syncSpawnFromObject(s.entity);
          }
        }
        this._markDirty();
        this.draw2D();
        return;
      }

      if (d.mode === 'draw_wall' || d.mode === 'draw_zone' || d.mode === 'draw_room') {
        const [ex, ez] =
          d.mode === 'draw_wall'
            ? this._snapToWallEndpoint(wx, wz, altDown)
            : this._clampToBounds(this._snapVal(wx), this._snapVal(wz));
        d.x2 = ex;
        d.z2 = ez;
        if (d.mode === 'draw_wall') {
          const dist = Math.hypot(d.x2 - d.x1, d.z2 - d.z1);
          this.els.coordsReadout.textContent = `X: ${ex.toFixed(2)}m • Z: ${ez.toFixed(2)}m • Longueur : ${dist.toFixed(2)} m`;
        } else {
          const rw = Math.abs(d.x2 - d.x1);
          const rd = Math.abs(d.z2 - d.z1);
          this.els.coordsReadout.textContent = `X: ${ex.toFixed(2)}m • Z: ${ez.toFixed(2)}m • ${rw.toFixed(1)}m × ${rd.toFixed(1)}m (${(rw * rd).toFixed(0)} m²)`;
        }
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
        } else if (d.kind === 'object') {
          const objCat = getCatalogItem(d.entity.type);
          if (objCat?.wallMount) {
            if (!d.moved) return;
            const snap = this._resolveWallSnap(wx, wz, objCat, altDown, d.origRot);
            if (snap) {
              d.entity.x = snap.x;
              d.entity.z = snap.z;
              d.entity.rotation = snap.rotation;
              this.activeWallSnap = snap;
              this.els.coordsReadout.textContent = `X: ${snap.x.toFixed(2)}m • Z: ${snap.z.toFixed(2)}m • 🧲 Mur (${Math.round(snap.rotation)}°)`;
            } else {
              const [nx, nz] = this._clampToBounds(this._snapVal(d.ox + dx), this._snapVal(d.oz + dz));
              d.entity.x = nx;
              d.entity.z = nz;
              this.activeWallSnap = null;
            }
          } else {
            const [nx, nz] = this._clampToBounds(this._snapVal(d.ox + dx), this._snapVal(d.oz + dz));
            d.entity.x = nx;
            d.entity.z = nz;
            this._syncSpawnFromObject(d.entity);
          }
        } else {
          const [nx, nz] = this._clampToBounds(this._snapVal(d.ox + dx), this._snapVal(d.oz + dz));
          d.entity.x = nx;
          d.entity.z = nz;
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
      this.activeWallSnap = null;
      if (!d) return;

      if (d.mode === 'pan') {
        if (d.rightClick && !d.moved && this.toolMode === 'place') {
          this.setTool('select', null);
          this.draw2D();
        }
        return;
      }

      if (d.mode === 'marquee') {
        if (d.moved) {
          const minX = Math.min(d.startWx, d.curWx);
          const maxX = Math.max(d.startWx, d.curWx);
          const minZ = Math.min(d.startWz, d.curWz);
          const maxZ = Math.max(d.startWz, d.curWz);
          const picks = [];
          const curFl = this.activeFloor;
          for (const o of this.mapData.objects) {
            if (clampFloor(o.floor ?? 0) !== curFl) continue;
            if (o.x >= minX && o.x <= maxX && o.z >= minZ && o.z <= maxZ) {
              picks.push({ kind: 'object', id: o.id });
            }
          }
          for (const w of this.mapData.walls) {
            if (clampFloor(w.floor ?? 0) !== curFl) continue;
            const mx = (w.x1 + w.x2) * 0.5;
            const mz = (w.z1 + w.z2) * 0.5;
            if ((mx >= minX && mx <= maxX && mz >= minZ && mz <= maxZ) || (w.x1 >= minX && w.x1 <= maxX && w.z1 >= minZ && w.z1 <= maxZ)) {
              picks.push({ kind: 'wall', id: w.id });
            }
          }
          for (const z of this.mapData.zones) {
            if (clampFloor(z.floor ?? 0) !== curFl) continue;
            if (z.x >= minX && z.x <= maxX && z.z >= minZ && z.z <= maxZ) {
              picks.push({ kind: 'zone', id: z.id });
            }
          }
          if (picks.length === 1) {
            this.selected = picks[0];
            this.multiSelected = [];
          } else if (picks.length > 1) {
            this.selected = null;
            this.multiSelected = picks;
          }
          this._renderInspector();
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
          if (this.wallChainLastPt && Math.hypot(d.x1 - this.wallChainLastPt.x, d.z1 - this.wallChainLastPt.z) >= 0.45) {
            x1 = this.wallChainLastPt.x;
            z1 = this.wallChainLastPt.z;
            x2 = d.x1;
            z2 = d.z1;
          } else {
            const half = (cat?.defaultW || 2.0) / 2;
            x1 = Number((d.x1 - half).toFixed(2));
            x2 = Number((d.x1 + half).toFixed(2));
            z2 = d.z1;
          }
        }
        const defaultH = this.mapData.floorHeight || this.mapData.bounds.height || DEFAULT_FLOOR_HEIGHT;
        this._pushUndo();
        const wallObj = {
          id: `w-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          kind: cat.wallKind || 'solid',
          floor: this.activeFloor,
          x1,
          z1,
          x2,
          z2,
          thickness: cat.defaultD || 0.18,
          height: cat.wallKind === 'railing' ? 1.05 : defaultH,
          color: cat.defaultColor || '#1e293b',
          doorLabel: cat.wallKind?.startsWith('door') ? 'SALLE' : ''
        };
        this.mapData.walls.push(wallObj);
        this.wallChainLastPt = { x: x2, z: z2 };
        this.selected = { kind: 'wall', id: wallObj.id };
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
        return;
      }

      if (d.mode === 'draw_room') {
        let minX = Math.min(d.x1, d.x2);
        let maxX = Math.max(d.x1, d.x2);
        let minZ = Math.min(d.z1, d.z2);
        let maxZ = Math.max(d.z1, d.z2);
        if (maxX - minX < 2.0 || maxZ - minZ < 2.0) {
          minX = Number((d.x1 - 5).toFixed(2));
          maxX = Number((d.x1 + 5).toFixed(2));
          minZ = Number((d.z1 - 4).toFixed(2));
          maxZ = Number((d.z1 + 4).toFixed(2));
        }
        const [cMinX, cMinZ] = this._clampToBounds(minX, minZ);
        const [cMaxX, cMaxZ] = this._clampToBounds(maxX, maxZ);
        const rw = Number(Math.max(2.0, cMaxX - cMinX).toFixed(2));
        const rd = Number(Math.max(2.0, cMaxZ - cMinZ).toFixed(2));
        const cx = Number(((cMinX + cMaxX) * 0.5).toFixed(2));
        const cz = Number(((cMinZ + cMaxZ) * 0.5).toFixed(2));
        const defaultH = this.mapData.floorHeight || this.mapData.bounds.height || DEFAULT_FLOOR_HEIGHT;
        const wk = this.roomOpts?.wallKind || 'solid';
        const thick = wk === 'exterior' ? 0.3 : 0.2;
        const wColor = wk === 'glazed' ? '#38bdf8' : wk === 'exterior' ? '#334155' : '#1e293b';
        const stamp = Date.now();
        this._pushUndo();
        const createdRefs = [];
        const wallSpecs = [
          { suf: 'n', x1: cMinX, z1: cMinZ, x2: cMaxX, z2: cMinZ },
          { suf: 's', x1: cMinX, z1: cMaxZ, x2: cMaxX, z2: cMaxZ },
          { suf: 'w', x1: cMinX, z1: cMinZ, x2: cMinX, z2: cMaxZ },
          { suf: 'e', x1: cMaxX, z1: cMinZ, x2: cMaxX, z2: cMaxZ }
        ];
        for (const ws of wallSpecs) {
          const wid = `w-room-${stamp}-${ws.suf}`;
          this.mapData.walls.push({
            id: wid,
            kind: wk,
            floor: this.activeFloor,
            x1: ws.x1,
            z1: ws.z1,
            x2: ws.x2,
            z2: ws.z2,
            thickness: thick,
            height: defaultH,
            color: wColor,
            doorLabel: ''
          });
          createdRefs.push({ kind: 'wall', id: wid });
        }
        if (this.roomOpts?.includeDoor && rw >= 3.2) {
          const doorHalf = rw >= 5.5 ? 1.0 : 0.65;
          const doorKind = rw >= 5.5 ? 'door_double' : 'door_single';
          const did = `w-room-${stamp}-door`;
          this.mapData.walls.push({
            id: did,
            kind: doorKind,
            floor: this.activeFloor,
            x1: Number((cx - doorHalf).toFixed(2)),
            z1: cMaxZ,
            x2: Number((cx + doorHalf).toFixed(2)),
            z2: cMaxZ,
            thickness: thick,
            height: defaultH,
            color: '#0ea5e9',
            doorLabel: `SALLE ${this.mapData.zones.length + 1}`
          });
          createdRefs.push({ kind: 'wall', id: did });
        }
        const zIdx = this.mapData.zones.length + 1;
        const zCode = `B${zIdx < 10 ? '0' : ''}${zIdx}`;
        const zid = `Z-room-${stamp}`;
        this.mapData.zones.push({
          id: zid,
          code: zCode,
          shortName: `Salle ${rw.toFixed(0)}×${rd.toFixed(0)}m`,
          fullLabel: `${zCode} - Salle (${rw.toFixed(1)}m × ${rd.toFixed(1)}m)`,
          badgeText: `📍 ${zCode} - Salle`,
          color: '#38bdf8',
          floor: this.activeFloor,
          outdoor: false,
          x: cx,
          z: cz,
          w: rw,
          d: rd
        });
        createdRefs.push({ kind: 'zone', id: zid });
        if (this.roomOpts?.includeFloorSlab) {
          const sid = `obj-slab-${stamp}`;
          this.mapData.objects.push({
            id: sid,
            type: 'floor_slab',
            floor: this.activeFloor,
            x: cx,
            z: cz,
            rotation: 0,
            w: rw,
            d: rd,
            color: '#94a3b8',
            label: `Dalle ${zCode}`,
            dialogue: ''
          });
          createdRefs.push({ kind: 'object', id: sid });
        }
        if (this.roomOpts?.includeCeiling && this.activeFloor < MAX_FLOOR) {
          const ceilFloor = this.activeFloor + 1;
          this._ensureFloorExists(ceilFloor);
          const cid = `obj-ceil-${stamp}`;
          this.mapData.objects.push({
            id: cid,
            type: 'floor_slab',
            floor: ceilFloor,
            x: cx,
            z: cz,
            rotation: 0,
            w: rw,
            d: rd,
            color: '#cbd5e1',
            label: `Plafond / Toit ${zCode}`,
            dialogue: ''
          });
        }
        this.selected = null;
        this.multiSelected = createdRefs;
        this._markDirty();
        this._renderFloorBar();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
        this.showToast(`🏗️ Salle ${rw.toFixed(1)}m × ${rd.toFixed(1)}m générée (${(rw * rd).toFixed(0)} m²)`, 'success');
        return;
      }

      if (d.mode === 'draw_zone') {
        const zCat = d.type ? getCatalogItem(d.type) : null;
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
        const isCour = Boolean(zCat?.isOutdoor || d.type === 'courtyard_zone');
        const surfaceKind = zCat?.surfaceKind || '';
        const surfaceLabels = {
          asphalt: { code: 'PARK', name: 'Bitume / Parking', icon: '🛣️' },
          concrete: { code: 'COUR', name: 'Cour Béton', icon: '⬜' },
          grass: { code: 'PARC', name: 'Pelouse / Vert', icon: '🌿' },
          path: { code: 'ALLEE', name: 'Allée Piétonne', icon: '🚶' },
          sport: { code: 'SPORT', name: 'Terrain Sport', icon: '🏀' }
        };
        const sm = surfaceLabels[surfaceKind] || null;
        const code = sm ? sm.code : isCour ? 'COUR' : `S${idx < 10 ? '0' : ''}${idx}`;
        const shortName = sm ? sm.name : isCour ? 'Cour extérieure' : 'Nouvelle Salle';
        const zone = {
          id: `Z-${Date.now()}`,
          code,
          shortName,
          fullLabel: sm ? `${sm.name} du campus` : isCour ? 'Cour extérieure du lycée' : `Salle ${code} - Lycée CIEL`,
          badgeText: sm ? `${sm.icon} ${sm.name}` : isCour ? '🌳 Cour extérieure' : `📍 ${code} - Nouvelle Salle`,
          color: zCat?.defaultColor || '#38bdf8',
          floor: this.activeFloor,
          outdoor: isCour,
          x: Number(((minX + maxX) / 2).toFixed(2)),
          z: Number(((minZ + maxZ) / 2).toFixed(2)),
          w: Number(Math.max(1.5, maxX - minX).toFixed(2)),
          d: Number(Math.max(1.5, maxZ - minZ).toFixed(2))
        };
        if (surfaceKind) {
          zone.surfaceKind = surfaceKind;
        }
        this.mapData.zones.push(zone);
        this.selected = { kind: 'zone', id: zone.id };
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
        return;
      }

      if (d.moved === false && (d.mode === 'move_entity' || d.mode === 'move_wall' || d.mode === 'move_group')) {
        this.undoStack.pop();
      } else {
        this._schedule3DRebuild(true);
      }
      this.draw2D();
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
      floor: this.activeFloor,
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

  _placeObjectAt(type, x, z, rotation = 0) {
    const cat = getCatalogItem(type);
    if (!cat) return;
    const modelEntry = cat.isCustomModel
      ? (this.mapData.models || []).find((m) => m.id === this.activeModelId)
      : null;
    if (cat.isCustomModel && !modelEntry) {
      this.showToast('Choisissez d’abord un modèle dans l’onglet Modèles 3D', 'info');
      return;
    }
    this._pushUndo();

    if (type === 'spawn_point') {
      let existing = this.mapData.objects.find((o) => o.type === 'spawn_point');
      if (existing) {
        existing.x = x;
        existing.z = z;
        existing.floor = this.activeFloor;
      } else {
        existing = {
          id: 'obj-spawn',
          type: 'spawn_point',
          floor: this.activeFloor,
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
        floor: this.activeFloor,
        x,
        z,
        rotation,
        w: cat.defaultW,
        d: cat.defaultD,
        color: cat.defaultColor,
        label: cat.shortLabel,
        dialogue: ''
      };
      if (cat.isCustomModel) {
        const nat = modelEntry.size || [1, 1, 1];
        const maxDim = Math.max(nat[0], nat[1], nat[2]);
        const s0 = maxDim > 10 || maxDim < 0.2 ? 2 / maxDim : 1;
        obj.modelId = modelEntry.id;
        obj.w = Number(Math.max(0.2, nat[0] * s0).toFixed(3));
        obj.d = Number(Math.max(0.2, nat[2] * s0).toFixed(3));
        obj.scaleY = Number((s0).toFixed(4));
        obj.elevation = 0;
        obj.label = String(modelEntry.name).slice(0, 48);
      }
      if (cat.isStair) {
        const targetFl = this.activeFloor < MAX_FLOOR ? this.activeFloor + 1 : this.activeFloor - 1;
        obj.targetFloor = targetFl;
        obj.stairStyle = cat.stairStyle || 'straight';
        obj.steps = cat.defaultSteps || 16;
        obj.hasRailings = true;
        obj.autoOpening = true;
        obj.turnDir = 1;
        this._ensureFloorExists(targetFl);
        this._renderFloorBar();
      }
      this.mapData.objects.push(obj);
      this.selected = { kind: 'object', id: obj.id };
      this.multiSelected = [];
    }

    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  _rotateGroup90() {
    if (this.multiSelected.length < 2) return;
    const entities = this.multiSelected.map((r) => ({ ref: r, ent: this._findEntityByRef(r) })).filter((x) => x.ent);
    if (entities.length === 0) return;
    this._pushUndo();
    let sumX = 0;
    let sumZ = 0;
    for (const { ref, ent } of entities) {
      if (ref.kind === 'wall') {
        sumX += (ent.x1 + ent.x2) * 0.5;
        sumZ += (ent.z1 + ent.z2) * 0.5;
      } else {
        sumX += ent.x;
        sumZ += ent.z;
      }
    }
    const cx = sumX / entities.length;
    const cz = sumZ / entities.length;
    const rotPt = (px, pz) => [
      Number((cx - (pz - cz)).toFixed(2)),
      Number((cz + (px - cx)).toFixed(2))
    ];
    for (const { ref, ent } of entities) {
      if (ref.kind === 'wall') {
        const [rx1, rz1] = rotPt(ent.x1, ent.z1);
        const [rx2, rz2] = rotPt(ent.x2, ent.z2);
        ent.x1 = rx1;
        ent.z1 = rz1;
        ent.x2 = rx2;
        ent.z2 = rz2;
      } else {
        const [rx, rz] = rotPt(ent.x, ent.z);
        ent.x = rx;
        ent.z = rz;
        if (ref.kind === 'object') {
          ent.rotation = (((ent.rotation || 0) - 90) % 360 + 360) % 360;
          this._syncSpawnFromObject(ent);
        } else if (ref.kind === 'zone') {
          if (Array.isArray(ent.points) && ent.points.length >= 3) {
            ent.points = ent.points.map((p) => {
              const [px, pz] = rotPt(p.x, p.z);
              return { x: px, z: pz };
            });
            this._syncPolygonZoneMetrics(ent);
          } else {
            const oldW = ent.w;
            ent.w = ent.d;
            ent.d = oldW;
          }
        }
      }
    }
    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  _duplicateMultiSelected() {
    if (this.multiSelected.length < 2) return;
    this._pushUndo();
    const newRefs = [];
    for (const ref of this.multiSelected) {
      const ent = this._findEntityByRef(ref);
      if (!ent) continue;
      if (ref.kind === 'object' && ent.type === 'spawn_point') continue;
      const cloned = cloneMap(ent);
      const id = `${ref.kind[0]}-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
      if (ref.kind === 'wall') {
        Object.assign(cloned, {
          id,
          x1: Number((ent.x1 + 1.5).toFixed(2)),
          z1: Number((ent.z1 + 1.5).toFixed(2)),
          x2: Number((ent.x2 + 1.5).toFixed(2)),
          z2: Number((ent.z2 + 1.5).toFixed(2))
        });
        this.mapData.walls.push(cloned);
      } else if (ref.kind === 'object') {
        Object.assign(cloned, {
          id,
          x: Number((ent.x + 1.5).toFixed(2)),
          z: Number((ent.z + 1.5).toFixed(2))
        });
        this.mapData.objects.push(cloned);
      } else if (ref.kind === 'zone') {
        Object.assign(cloned, {
          id,
          x: Number((ent.x + 1.5).toFixed(2)),
          z: Number((ent.z + 1.5).toFixed(2)),
          points: Array.isArray(cloned.points)
            ? cloned.points.map((p) => ({ x: Number((p.x + 1.5).toFixed(2)), z: Number((p.z + 1.5).toFixed(2)) }))
            : undefined
        });
        this.mapData.zones.push(cloned);
      }
      newRefs.push({ kind: ref.kind, id });
    }
    this.multiSelected = newRefs;
    this._markDirty();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
  }

  _deleteMultiSelected() {
    if (this.multiSelected.length < 2) return;
    this._pushUndo();
    const objIds = new Set(this.multiSelected.filter((r) => r.kind === 'object').map((r) => r.id));
    const wallIds = new Set(this.multiSelected.filter((r) => r.kind === 'wall').map((r) => r.id));
    const zoneIds = new Set(this.multiSelected.filter((r) => r.kind === 'zone').map((r) => r.id));
    this.mapData.objects = this.mapData.objects.filter((o) => o.type === 'spawn_point' || !objIds.has(o.id));
    this.mapData.walls = this.mapData.walls.filter((w) => !wallIds.has(w.id));
    this.mapData.zones = this.mapData.zones.filter((z) => !zoneIds.has(z.id));
    this.multiSelected = [];
    this.selected = null;
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

  _floorOptionsHtml(selectedFl) {
    const cur = clampFloor(selectedFl ?? 0);
    let html = '';
    for (let fl = MIN_FLOOR; fl <= MAX_FLOOR; fl++) {
      html += `<option value="${fl}" ${fl === cur ? 'selected' : ''}>${escapeHtml(formatFloorLabel(fl))}</option>`;
    }
    return html;
  }

  copySelection() {
    const refs =
      this.multiSelected.length > 0
        ? [...this.multiSelected]
        : this.selected
          ? [this.selected]
          : [];
    if (refs.length === 0) return false;
    const items = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const ref of refs) {
      const ent = this._findEntityByRef(ref);
      if (!ent) continue;
      if (ref.kind === 'object' && ent.type === 'spawn_point') continue;
      items.push({ kind: ref.kind, data: cloneMap(ent) });
      if (ref.kind === 'wall') {
        minX = Math.min(minX, ent.x1, ent.x2);
        maxX = Math.max(maxX, ent.x1, ent.x2);
        minZ = Math.min(minZ, ent.z1, ent.z2);
        maxZ = Math.max(maxZ, ent.z1, ent.z2);
      } else {
        minX = Math.min(minX, ent.x);
        maxX = Math.max(maxX, ent.x);
        minZ = Math.min(minZ, ent.z);
        maxZ = Math.max(maxZ, ent.z);
      }
    }
    if (items.length === 0) {
      this.showToast('Aucun élément copiable sélectionné', 'info');
      return false;
    }
    const cx = Number(((minX + maxX) * 0.5).toFixed(2));
    const cz = Number(((minZ + maxZ) * 0.5).toFixed(2));
    this.clipboard = { cx, cz, sourceFloor: this.activeFloor, items };
    this._renderInspector();
    this.showToast(`📄 ${items.length} élément(s) copié(s) — Ctrl+V pour coller sur l'étage actif`, 'info');
    return true;
  }

  pasteClipboard(targetFloorOverride = null, exactAnchor = null) {
    if (!this.clipboard || !Array.isArray(this.clipboard.items) || this.clipboard.items.length === 0) {
      return false;
    }
    const dstFloor = targetFloorOverride !== null ? clampFloor(targetFloorOverride) : this.activeFloor;
    this._ensureFloorExists(dstFloor);
    let anchorX;
    let anchorZ;
    if (exactAnchor && Number.isFinite(exactAnchor.x) && Number.isFinite(exactAnchor.z)) {
      anchorX = exactAnchor.x;
      anchorZ = exactAnchor.z;
    } else if (Array.isArray(this.hoverWorld)) {
      anchorX = this.hoverWorld[0];
      anchorZ = this.hoverWorld[1];
    } else if (dstFloor !== this.clipboard.sourceFloor) {
      anchorX = this.clipboard.cx;
      anchorZ = this.clipboard.cz;
    } else {
      anchorX = this.clipboard.cx + 2.0;
      anchorZ = this.clipboard.cz + 2.0;
    }
    const dx = Number((anchorX - this.clipboard.cx).toFixed(2));
    const dz = Number((anchorZ - this.clipboard.cz).toFixed(2));
    const stamp = Date.now();
    let seq = 1;
    this._pushUndo();
    const pastedRefs = [];
    for (const item of this.clipboard.items) {
      const cloned = cloneMap(item.data);
      const id = `${item.kind[0]}-cp-${stamp}-${seq++}`;
      cloned.id = id;
      cloned.floor = dstFloor;
      if (item.kind === 'wall') {
        const [nx1, nz1] = this._clampToBounds(cloned.x1 + dx, cloned.z1 + dz);
        const [nx2, nz2] = this._clampToBounds(cloned.x2 + dx, cloned.z2 + dz);
        cloned.x1 = Number(nx1.toFixed(2));
        cloned.z1 = Number(nz1.toFixed(2));
        cloned.x2 = Number(nx2.toFixed(2));
        cloned.z2 = Number(nz2.toFixed(2));
        this.mapData.walls.push(cloned);
      } else if (item.kind === 'object') {
        const [nx, nz] = this._clampToBounds(cloned.x + dx, cloned.z + dz);
        cloned.x = Number(nx.toFixed(2));
        cloned.z = Number(nz.toFixed(2));
        if (cloned.targetFloor !== undefined) {
          const deltaFl = cloned.targetFloor - (item.data.floor ?? 0);
          cloned.targetFloor = clampFloor(dstFloor + deltaFl);
        }
        this.mapData.objects.push(cloned);
      } else if (item.kind === 'zone') {
        const [nx, nz] = this._clampToBounds(cloned.x + dx, cloned.z + dz);
        cloned.x = Number(nx.toFixed(2));
        cloned.z = Number(nz.toFixed(2));
        if (Array.isArray(cloned.points) && cloned.points.length >= 3) {
          cloned.points = cloned.points.map((p) => {
            const [px, pz] = this._clampToBounds(p.x + dx, p.z + dz);
            return { x: Number(px.toFixed(2)), z: Number(pz.toFixed(2)) };
          });
          this._syncPolygonZoneMetrics(cloned);
        }
        this.mapData.zones.push(cloned);
      }
      pastedRefs.push({ kind: item.kind, id });
    }
    if (dstFloor !== this.activeFloor) {
      this._setActiveFloor(dstFloor);
    }
    if (pastedRefs.length === 1) {
      this.selected = pastedRefs[0];
      this.multiSelected = [];
    } else {
      this.selected = null;
      this.multiSelected = pastedRefs;
    }
    this._markDirty();
    this._renderFloorBar();
    this._renderInspector();
    this.draw2D();
    this._schedule3DRebuild(true);
    this.showToast(`📥 ${pastedRefs.length} élément(s) collé(s) sur ${formatFloorShortLabel(dstFloor)}`, 'success');
    return true;
  }

  _copySelectionToNextFloor() {
    const nextFl = this.activeFloor + 1;
    if (nextFl > MAX_FLOOR) {
      this.showToast(`Impossible de coller au-delà de +${MAX_FLOOR}`, 'info');
      return false;
    }
    if (!this.copySelection()) return false;
    return this.pasteClipboard(nextFl, { x: this.clipboard.cx, z: this.clipboard.cz });
  }

  _renderInspector() {
    if (this.multiSelected.length > 1) {
      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">📦 Sélection multiple (${this.multiSelected.length} éléments)</div>
        <div class="me-shortcuts-box">
          Glissez un élément sélectionné pour déplacer tout le groupe ensemble sur l'étage actif (${escapeHtml(formatFloorShortLabel(this.activeFloor))}).
        </div>
        <div class="me-insp-actions">
          <button type="button" id="me-grp-copy" class="me-btn">📄 Copier (Ctrl+C)</button>
          <button type="button" id="me-grp-paste-up" class="me-btn">⬆️ Coller → Étage +1</button>
          <button type="button" id="me-grp-rot90" class="me-btn">↻ Pivoter 90° (R)</button>
          <button type="button" id="me-grp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-grp-del" class="me-btn me-btn-danger">🗑️ Supprimer tout</button>
        </div>`;
      this.els.inspBody.querySelector('#me-grp-copy').onclick = () => this.copySelection();
      this.els.inspBody.querySelector('#me-grp-paste-up').onclick = () => this._copySelectionToNextFloor();
      this.els.inspBody.querySelector('#me-grp-rot90').onclick = () => this._rotateGroup90();
      this.els.inspBody.querySelector('#me-grp-dup').onclick = () => this._duplicateMultiSelected();
      this.els.inspBody.querySelector('#me-grp-del').onclick = () => this._deleteMultiSelected();
      return;
    }

    const ent = this._getSelectedEntity();
    if (!ent) {
      this.els.inspBody.innerHTML = `
        <div class="me-insp-empty">
          <p>Étage actif : <strong>${escapeHtml(formatFloorLabel(this.activeFloor))}</strong>. Sélectionnez un élément ou glissez dans le vide pour tracer une sélection multiple.</p>
          ${
            this.clipboard
              ? `<button type="button" id="me-insp-paste-now" class="me-btn" style="width:100%;margin-bottom:8px;">📥 Coller (${this.clipboard.items.length} élém.) sur ${escapeHtml(formatFloorShortLabel(this.activeFloor))} (Ctrl+V)</button>`
              : ''
          }
          <div class="me-shortcuts-box">
            <div><strong>Molette</strong> : Zoom Satellite ↔ Décimètre</div>
            <div><strong>ZQSD / Flèches (+ Shift)</strong> : Navigation rapide</div>
            <div><strong>Espace + Glisser / Clic milieu</strong> : Panoramique</div>
            <div><strong>Clic sur mini-plan / Repères</strong> : Saut immédiat</div>
            <div><strong>Ctrl+C / Ctrl+V / Ctrl+D</strong> : Copier / Coller / Dupliquer</div>
            <div><strong>R</strong> : Tourner (+15° ou +90° groupe)</div>
            <div><strong>Alt (maintenu)</strong> : Placer librement sans aimantation</div>
            <div><strong>Ctrl+Z / Ctrl+Y</strong> : Annuler / Rétablir</div>
            <div><strong>Échap</strong> : Finir chaîne de murs / Désélectionner</div>
            <div><strong>Suppr</strong> : Supprimer la sélection</div>
          </div>
        </div>`;
      this.els.inspBody.querySelector('#me-insp-paste-now')?.addEventListener('click', () => this.pasteClipboard());
      return;
    }

    if (this.selected.kind === 'object') {
      const cat = getCatalogItem(ent.type);
      const isTeacher = ent.type === 'npc_teacher';
      const isSurvivalDoor = ent.type === 'survival_door';
      const isHidingRack = ent.type === 'hiding_rack';
      const isStair = Boolean(cat?.isStair);
      const isModel = Boolean(cat?.isCustomModel);
      const modelEntry = isModel ? (this.mapData.models || []).find((m) => m.id === ent.modelId) : null;
      const modelNat = modelEntry?.size || [1, 1, 1];
      const b = this.mapData.bounds;
      const maxDim = Math.max(120, b.width, b.depth);
      const objFloor = clampFloor(ent.floor ?? 0);
      const targetFl = clampFloor(ent.targetFloor ?? (objFloor < MAX_FLOOR ? objFloor + 1 : objFloor - 1));
      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">${cat?.icon || ''} ${escapeHtml(cat?.label || ent.type)}</div>
        ${
          isSurvivalDoor
            ? `<div class="me-shortcuts-box">🚪 <strong>Porte de Mini-Jeu Survie</strong> : téléporte les élèves dans le Salon d’Attente Survie (lancement auto dès 2 joueurs prêts).</div>`
            : isHidingRack
              ? `<div class="me-shortcuts-box">🗄️ <strong>Baie de Brassage (Cachette)</strong> : permet aux élèves de se cacher du Professeur CIEL s’ils restent silencieux au micro.</div>`
              : isStair
                ? `<div class="me-shortcuts-box">🪜 <strong>Escalier 3D</strong> : relie ${escapeHtml(formatFloorShortLabel(objFloor))} → ${escapeHtml(formatFloorShortLabel(targetFl))} avec rampe fluide et trémie automatique à l’étage supérieur.</div>`
                : ''
        }
        <label class="me-field"><span>Libellé</span><input type="text" id="me-f-label" class="me-input" maxlength="80" value="${escapeHtml(ent.label || '')}" /></label>
        <label class="me-field">
          <span>Étage d’implantation</span>
          <select id="me-f-floor" class="me-select">${this._floorOptionsHtml(objFloor)}</select>
        </label>
        ${
          isStair
            ? `
          <div class="me-grid-2">
            <label class="me-field">
              <span>Étage d’arrivée</span>
              <select id="me-st-target" class="me-select">${this._floorOptionsHtml(targetFl)}</select>
            </label>
            <label class="me-field"><span>Nb marches</span><input type="number" step="1" min="6" max="32" id="me-st-steps" class="me-input" value="${Number(ent.steps) || 16}" /></label>
            <label class="me-field">
              <span>Sens tournant</span>
              <select id="me-st-turn" class="me-select">
                <option value="1" ${(Number(ent.turnDir) || 1) === 1 ? 'selected' : ''}>Droite (+1)</option>
                <option value="-1" ${Number(ent.turnDir) === -1 ? 'selected' : ''}>Gauche (-1)</option>
              </select>
            </label>
            <label class="me-field">
              <span>Trémie auto</span>
              <select id="me-st-open" class="me-select">
                <option value="1" ${ent.autoOpening !== false ? 'selected' : ''}>Activée (Auto N+1)</option>
                <option value="0" ${ent.autoOpening === false ? 'selected' : ''}>Désactivée</option>
              </select>
            </label>
          </div>
          <label class="me-check-pill"><input type="checkbox" id="me-st-rail" ${ent.hasRailings !== false ? 'checked' : ''} /> Rampes & garde-corps latéraux</label>`
            : ''
        }
        ${
          isModel
            ? `<div class="me-shortcuts-box">🧊 <strong>${escapeHtml(modelEntry?.name || 'Modèle introuvable')}</strong>${modelEntry ? ` (.${escapeHtml(modelEntry.format)})` : ' : supprimé de la carte'}</div>
        <label class="me-field"><span>Étage</span><select id="me-cm-floor" class="me-select">${this._floorOptionsHtml(objFloor)}</select></label>
        <div class="me-grid-2">
          <label class="me-field"><span>Échelle (%)</span><input type="number" step="5" min="1" max="100000" id="me-cm-scale" class="me-input" value="${Math.round((ent.w / Math.max(0.001, modelNat[0])) * 100)}" /></label>
          <label class="me-field"><span>Hauteur (×)</span><input type="number" step="0.1" min="0.001" id="me-cm-sy" class="me-input" value="${ent.scaleY ?? 1}" /></label>
          <label class="me-field"><span>Élévation (m)</span><input type="number" step="0.1" id="me-cm-elev" class="me-input" value="${ent.elevation ?? 0}" /></label>
        </div>`
            : ''
        }
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
        ${
          isStair
            ? `<div class="me-rot-presets">
                <button type="button" class="me-btn" data-abs-rot="0">0°</button>
                <button type="button" class="me-btn" data-abs-rot="90">90°</button>
                <button type="button" class="me-btn" data-abs-rot="180">180°</button>
                <button type="button" class="me-btn" data-abs-rot="270">270°</button>
              </div>`
            : ''
        }
        ${
          cat?.wallMount
            ? `<button type="button" id="me-snap-wall" class="me-btn">🧲 Plaquer sur le mur le plus proche</button>`
            : ''
        }
        <label class="me-field"><span>Couleur d’accent</span><input type="color" id="me-f-color" class="me-color" value="${escapeHtml(ent.color || '#38bdf8')}" /></label>
        ${
          isTeacher
            ? `<label class="me-field"><span>Dialogue d’accueil du Professeur</span><textarea id="me-f-dialogue" class="me-textarea" rows="4" maxlength="320" placeholder="Message personnalisé affiché aux joueurs...">${escapeHtml(ent.dialogue || '')}</textarea></label>`
            : ''
        }
        <div class="me-insp-actions">
          <button type="button" id="me-insp-copy" class="me-btn">📄 Copier</button>
          <button type="button" id="me-insp-up" class="me-btn">⬆️ → Étage +1</button>
          <button type="button" id="me-insp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-insp-del" class="me-btn me-btn-danger">🗑️ Supprimer</button>
        </div>`;

      this.els.inspBody.querySelector('#me-f-label').oninput = (e) => {
        ent.label = e.target.value.slice(0, 80);
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild();
      };
      this.els.inspBody.querySelector('#me-f-floor').onchange = (e) => {
        this._pushUndo();
        const nf = clampFloor(e.target.value);
        ent.floor = nf;
        this._ensureFloorExists(nf);
        this._syncSpawnFromObject(ent);
        this._setActiveFloor(nf);
        this._markDirty();
        this._schedule3DRebuild(true);
      };
      if (isStair) {
        this.els.inspBody.querySelector('#me-st-target').onchange = (e) => {
          this._pushUndo();
          const tf = clampFloor(e.target.value);
          ent.targetFloor = tf;
          this._ensureFloorExists(tf);
          this._renderFloorBar();
          this._markDirty();
          this._renderInspector();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
        this.els.inspBody.querySelector('#me-st-steps').onchange = (e) => {
          this._pushUndo();
          ent.steps = Math.max(6, Math.min(32, Math.round(Number(e.target.value) || 16)));
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
        this.els.inspBody.querySelector('#me-st-turn').onchange = (e) => {
          this._pushUndo();
          ent.turnDir = Number(e.target.value) === -1 ? -1 : 1;
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
        this.els.inspBody.querySelector('#me-st-open').onchange = (e) => {
          this._pushUndo();
          ent.autoOpening = e.target.value === '1';
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
        this.els.inspBody.querySelector('#me-st-rail').onchange = (e) => {
          this._pushUndo();
          ent.hasRailings = Boolean(e.target.checked);
          this._markDirty();
          this._schedule3DRebuild(true);
        };
      }
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

      if (isModel) {
        const applyModel = (fn, full = false) => {
          this._pushUndo();
          fn();
          this._markDirty();
          if (full) this._renderInspector();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
        this.els.inspBody.querySelector('#me-cm-scale').onchange = (e) => {
          const pct = Math.max(1, Number(e.target.value) || 100);
          applyModel(() => {
            const k = pct / 100;
            ent.w = Number(Math.max(0.2, modelNat[0] * k).toFixed(3));
            ent.d = Number(Math.max(0.2, modelNat[2] * k).toFixed(3));
            ent.scaleY = Number(k.toFixed(4));
          }, true);
        };
        this.els.inspBody.querySelector('#me-cm-sy').onchange = (e) => {
          applyModel(() => {
            ent.scaleY = Math.max(0.001, Number(e.target.value) || 1);
          });
        };
        this.els.inspBody.querySelector('#me-cm-elev').onchange = (e) => {
          applyModel(() => {
            ent.elevation = Math.max(-50, Math.min(500, Number(e.target.value) || 0));
          });
        };
        this.els.inspBody.querySelector('#me-cm-floor').onchange = (e) => {
          const nextFl = clampFloor(Number(e.target.value));
          this._pushUndo();
          ent.floor = nextFl;
          this._markDirty();
          const ref = { kind: 'object', id: ent.id };
          this._setActiveFloor(nextFl);
          this.selected = ref;
          this._renderInspector();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
      }

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
      for (const b of this.els.inspBody.querySelectorAll('button[data-abs-rot]')) {
        b.onclick = () => {
          this._pushUndo();
          const deg = ((Number(b.dataset.absRot) || 0) % 360 + 360) % 360;
          ent.rotation = deg;
          rotRange.value = String(deg);
          rotLabel.textContent = `${deg}°`;
          this._syncSpawnFromObject(ent);
          this._markDirty();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
      }
      const snapWallBtn = this.els.inspBody.querySelector('#me-snap-wall');
      if (snapWallBtn) {
        snapWallBtn.onclick = () => {
          const snap = this._resolveWallSnap(ent.x, ent.z, cat, false, ent.rotation);
          if (!snap) {
            this.showToast(`Aucun mur détecté dans un rayon de ${WALL_MOUNT_SNAP_RADIUS} m`, 'info');
            return;
          }
          this._pushUndo();
          ent.x = snap.x;
          ent.z = snap.z;
          ent.rotation = snap.rotation;
          this._markDirty();
          this._renderInspector();
          this.draw2D();
          this._schedule3DRebuild(true);
        };
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
      const wallFl = clampFloor(ent.floor ?? 0);
      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">🧱 Segment Architecture (${len} m)</div>
        <div class="me-grid-2">
          <label class="me-field">
            <span>Type</span>
            <select id="me-w-kind" class="me-select">
              <option value="solid" ${ent.kind === 'solid' ? 'selected' : ''}>Mur plein</option>
              <option value="exterior" ${ent.kind === 'exterior' ? 'selected' : ''}>Mur extérieur / Façade</option>
              <option value="glazed" ${ent.kind === 'glazed' ? 'selected' : ''}>Cloison vitrée</option>
              <option value="window_bay" ${ent.kind === 'window_bay' ? 'selected' : ''}>Grande baie vitrée</option>
              <option value="railing" ${ent.kind === 'railing' ? 'selected' : ''}>Garde-corps / Mezzanine</option>
              <option value="door_single" ${ent.kind === 'door_single' ? 'selected' : ''}>Porte simple</option>
              <option value="door_double" ${ent.kind === 'door_double' ? 'selected' : ''}>Porte double</option>
            </select>
          </label>
          <label class="me-field">
            <span>Étage</span>
            <select id="me-w-floor" class="me-select">${this._floorOptionsHtml(wallFl)}</select>
          </label>
        </div>
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
            ? `<label class="me-field"><span>Panneau au-dessus de la porte</span><input type="text" id="me-w-doorlabel" class="me-input" maxlength="26" value="${escapeHtml(ent.doorLabel || '')}" placeholder="Ex: SALLE 102 • RÉSEAUX" /></label>`
            : ''
        }
        <div class="me-insp-actions">
          <button type="button" id="me-insp-copy" class="me-btn">📄 Copier</button>
          <button type="button" id="me-insp-up" class="me-btn">⬆️ → Étage +1</button>
          <button type="button" id="me-insp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-insp-del" class="me-btn me-btn-danger">🗑️ Supprimer</button>
        </div>`;

      this.els.inspBody.querySelector('#me-w-kind').onchange = (e) => {
        this._pushUndo();
        ent.kind = e.target.value;
        if (ent.kind === 'railing') ent.height = 1.05;
        this._markDirty();
        this._renderInspector();
        this.draw2D();
        this._schedule3DRebuild(true);
      };
      this.els.inspBody.querySelector('#me-w-floor').onchange = (e) => {
        this._pushUndo();
        const nf = clampFloor(e.target.value);
        ent.floor = nf;
        this._ensureFloorExists(nf);
        this._setActiveFloor(nf);
        this._markDirty();
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

      const zFl = clampFloor(ent.floor ?? 0);
      this.els.inspBody.innerHTML = `
        <div class="me-insp-badge">Zone de Salle${isPoly ? ' Polygonale' : ''}</div>
        <div class="me-grid-2">
          <label class="me-field"><span>Code salle</span><input type="text" id="me-z-code" class="me-input" maxlength="16" value="${escapeHtml(ent.code || '')}" /></label>
          <label class="me-field"><span>Couleur</span><input type="color" id="me-z-color" class="me-color" value="${escapeHtml(ent.color || '#38bdf8')}" /></label>
        </div>
        <div class="me-grid-2">
          <label class="me-field"><span>Nom court</span><input type="text" id="me-z-short" class="me-input" maxlength="40" value="${escapeHtml(ent.shortName || '')}" /></label>
          <label class="me-field"><span>Étage</span><select id="me-z-floor" class="me-select">${this._floorOptionsHtml(zFl)}</select></label>
        </div>
        <label class="me-check-pill"><input type="checkbox" id="me-z-outdoor" ${ent.outdoor ? 'checked' : ''} /> Extérieur / Cour (sans plafond ni occlusion)</label>
        ${polyVertsHtml}
        <div class="me-insp-actions">
          <button type="button" id="me-insp-copy" class="me-btn">📄 Copier</button>
          <button type="button" id="me-insp-up" class="me-btn">⬆️ → Étage +1</button>
          <button type="button" id="me-insp-dup" class="me-btn">📋 Dupliquer</button>
          <button type="button" id="me-insp-del" class="me-btn me-btn-danger">🗑️ Supprimer</button>
        </div>`;

      this.els.inspBody.querySelector('#me-z-floor').onchange = (e) => {
        this._pushUndo();
        const nf = clampFloor(e.target.value);
        ent.floor = nf;
        this._ensureFloorExists(nf);
        this._setActiveFloor(nf);
        this._markDirty();
        this._schedule3DRebuild(true);
      };
      this.els.inspBody.querySelector('#me-z-outdoor').onchange = (e) => {
        this._pushUndo();
        ent.outdoor = Boolean(e.target.checked);
        this._markDirty();
        this.draw2D();
        this._schedule3DRebuild(true);
      };

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

    this.els.inspBody.querySelector('#me-insp-copy')?.addEventListener('click', () => this.copySelection());
    this.els.inspBody.querySelector('#me-insp-up')?.addEventListener('click', () => this._copySelectionToNextFloor());
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
    let majorStep = 10;
    if (this.cam2d.zoom < 0.45) {
      step = 100;
      majorStep = 500;
    } else if (this.cam2d.zoom < 1.0) {
      step = 50;
      majorStep = 100;
    } else if (this.cam2d.zoom < 2.2) {
      step = 25;
      majorStep = 100;
    } else if (this.cam2d.zoom < 4.5) {
      step = 10;
      majorStep = 50;
    } else if (this.cam2d.zoom < 9) {
      step = 5;
      majorStep = 25;
    } else if (this.cam2d.zoom < 16) {
      step = 2;
      majorStep = 10;
    } else if (this.cam2d.zoom >= 85 && this.snap === 0.1) {
      step = 0.1;
      majorStep = 1;
    } else if (this.cam2d.zoom >= 36 && (this.snap === 0.25 || this.snap === 0.1)) {
      step = 0.25;
      majorStep = 1;
    } else if (this.cam2d.zoom >= 24 && (this.snap === 0.5 || this.snap === 0.25 || this.snap === 0.1)) {
      step = 0.5;
      majorStep = 5;
    }

    const [visMinX, visMinZ] = this._screenToWorld(0, 0);
    const [visMaxX, visMaxZ] = this._screenToWorld(w, h);
    const padWorld = Math.max(4, 48 / Math.max(MIN_ZOOM_2D, this.cam2d.zoom));
    const cullMinX = visMinX - padWorld;
    const cullMaxX = visMaxX + padWorld;
    const cullMinZ = visMinZ - padWorld;
    const cullMaxZ = visMaxZ + padWorld;

    const startGx = Math.max(Math.ceil(b.minX / step) * step, Math.floor(visMinX / step) * step);
    const endGx = Math.min(Math.floor(b.maxX / step) * step, Math.ceil(visMaxX / step) * step);
    const startGz = Math.max(Math.ceil(b.minZ / step) * step, Math.floor(visMinZ / step) * step);
    const endGz = Math.min(Math.floor(b.maxZ / step) * step, Math.ceil(visMaxZ / step) * step);
    const clampBx1 = Math.max(0, bx1);
    const clampBx2 = Math.min(w, bx2);
    const clampBz1 = Math.max(0, bz1);
    const clampBz2 = Math.min(h, bz2);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.beginPath();
    for (let gx = startGx; gx <= endGx + 1e-6; gx += step) {
      const rx = Math.round(gx * 100) / 100;
      if (rx === 0 || Math.abs(rx % majorStep) < 1e-4) continue;
      const [px] = this._worldToScreen(rx, 0);
      ctx.moveTo(px, clampBz1);
      ctx.lineTo(px, clampBz2);
    }
    for (let gz = startGz; gz <= endGz + 1e-6; gz += step) {
      const rz = Math.round(gz * 100) / 100;
      if (rz === 0 || Math.abs(rz % majorStep) < 1e-4) continue;
      const [, py] = this._worldToScreen(0, rz);
      ctx.moveTo(clampBx1, py);
      ctx.lineTo(clampBx2, py);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.beginPath();
    for (let gx = startGx; gx <= endGx + 1e-6; gx += step) {
      const rx = Math.round(gx * 100) / 100;
      if (rx === 0 || Math.abs(rx % majorStep) >= 1e-4) continue;
      const [px] = this._worldToScreen(rx, 0);
      ctx.moveTo(px, clampBz1);
      ctx.lineTo(px, clampBz2);
    }
    for (let gz = startGz; gz <= endGz + 1e-6; gz += step) {
      const rz = Math.round(gz * 100) / 100;
      if (rz === 0 || Math.abs(rz % majorStep) >= 1e-4) continue;
      const [, py] = this._worldToScreen(0, rz);
      ctx.moveTo(clampBx1, py);
      ctx.lineTo(clampBx2, py);
    }
    ctx.stroke();

    if (0 >= b.minX && 0 <= b.maxX && 0 >= visMinX && 0 <= visMaxX) {
      const [ox] = this._worldToScreen(0, 0);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
      ctx.beginPath();
      ctx.moveTo(ox, clampBz1);
      ctx.lineTo(ox, clampBz2);
      ctx.stroke();
    }
    if (0 >= b.minZ && 0 <= b.maxZ && 0 >= visMinZ && 0 <= visMaxZ) {
      const [, oz] = this._worldToScreen(0, 0);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
      ctx.beginPath();
      ctx.moveTo(clampBx1, oz);
      ctx.lineTo(clampBx2, oz);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx1, bz1, bx2 - bx1, bz2 - bz1);

    const curFl = this.activeFloor;
    if (this.onionSkinMode === 'below' || this.onionSkinMode === 'both') {
      this._drawGhostFloor(ctx, curFl - 1, 'rgba(56, 189, 248, 0.26)', cullMinX, cullMaxX, cullMinZ, cullMaxZ);
    }
    if (this.onionSkinMode === 'above' || this.onionSkinMode === 'both') {
      this._drawGhostFloor(ctx, curFl + 1, 'rgba(167, 139, 250, 0.24)', cullMinX, cullMaxX, cullMinZ, cullMaxZ);
    }

    let drawnZones = 0;
    let drawnWalls = 0;
    let drawnObjects = 0;

    const surfaceFillMap = {
      asphalt: 'rgba(51, 65, 85, 0.55)',
      concrete: 'rgba(148, 163, 184, 0.34)',
      grass: 'rgba(34, 197, 94, 0.28)',
      path: 'rgba(203, 213, 225, 0.34)',
      sport: 'rgba(234, 88, 12, 0.34)'
    };

    for (const z of this.mapData.zones) {
      if (clampFloor(z.floor ?? 0) !== curFl) continue;
      const zhw = (z.w || 4) * 0.5;
      const zhd = (z.d || 4) * 0.5;
      if (!isBoxInViewport2D(z.x - zhw, z.x + zhw, z.z - zhd, z.z + zhd, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      drawnZones++;
      const pts = getZonePolygonPoints(z);
      if (pts.length < 3) continue;
      const rw = z.w * this.cam2d.zoom;
      const rd = z.d * this.cam2d.zoom;
      const isSel = (this.selected?.kind === 'zone' && this.selected.id === z.id) || this._isMultiSelected('zone', z.id);
      const screenPts = pts.map((p) => this._worldToScreen(p.x, p.z));

      ctx.beginPath();
      screenPts.forEach(([sx, sy], idx) => {
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = z.surfaceKind && surfaceFillMap[z.surfaceKind]
        ? surfaceFillMap[z.surfaceKind]
        : z.outdoor
          ? `rgba(16, 185, 129, ${isSel ? '0.24' : '0.14'})`
          : `${z.color || '#38bdf8'}${isSel ? '34' : '1c'}`;
      ctx.fill();
      ctx.strokeStyle = isSel ? '#facc15' : z.outdoor ? (z.color || '#34d399') : z.color || '#38bdf8';
      ctx.lineWidth = isSel ? 2.5 : 1.2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isSel || (rw >= 26 && rd >= 14)) {
        const [lx, ly] = this._worldToScreen(z.x, z.z);
        ctx.fillStyle = '#e2e8f0';
        const zFont = Math.max(8, Math.min(14, Math.min(rw, rd) * 0.22, this.cam2d.zoom * 0.5 + 7));
        ctx.font = `bold ${zFont.toFixed(1)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${z.outdoor ? '☀️ ' : ''}${z.code || ''} ${z.shortName || ''}`.trim(), lx, ly);
      }

      if (isSel && this.selected?.kind === 'zone') {
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

    const openings = this._getEffectiveOpeningsCached();
    for (const op of openings) {
      if (clampFloor(op.floor) !== curFl) continue;
      if (!isBoxInViewport2D(op.minX, op.maxX, op.minZ, op.maxZ, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      const [ox1, oz1] = this._worldToScreen(op.minX, op.minZ);
      const [ox2, oz2] = this._worldToScreen(op.maxX, op.maxZ);
      ctx.save();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.fillRect(ox1, oz1, ox2 - ox1, oz2 - oz1);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(ox1, oz1, ox2 - ox1, oz2 - oz1);
      ctx.beginPath();
      ctx.moveTo(ox1, oz1);
      ctx.lineTo(ox2, oz2);
      ctx.moveTo(ox2, oz1);
      ctx.lineTo(ox1, oz2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (ox2 - ox1 >= 34 && oz2 - oz1 >= 16) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TRÉMIE', (ox1 + ox2) * 0.5, (oz1 + oz2) * 0.5);
      }
      ctx.restore();
    }

    for (const wall of this.mapData.walls) {
      if (clampFloor(wall.floor ?? 0) !== curFl) continue;
      const wMinX = wall.x1 < wall.x2 ? wall.x1 : wall.x2;
      const wMaxX = wall.x1 > wall.x2 ? wall.x1 : wall.x2;
      const wMinZ = wall.z1 < wall.z2 ? wall.z1 : wall.z2;
      const wMaxZ = wall.z1 > wall.z2 ? wall.z1 : wall.z2;
      if (!isBoxInViewport2D(wMinX, wMaxX, wMinZ, wMaxZ, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      drawnWalls++;
      const [wx1, wz1] = this._worldToScreen(wall.x1, wall.z1);
      const [wx2, wz2] = this._worldToScreen(wall.x2, wall.z2);
      const isSel = (this.selected?.kind === 'wall' && this.selected.id === wall.id) || this._isMultiSelected('wall', wall.id);
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
      } else if (wall.kind === 'railing') {
        ctx.strokeStyle = isSel ? '#facc15' : '#fbbf24';
        ctx.lineWidth = Math.max(2, thickPx);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(wx1, wz1);
        ctx.lineTo(wx2, wz2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = isSel
          ? '#facc15'
          : wall.kind === 'glazed'
            ? '#38bdf8'
            : wall.kind === 'window_bay'
              ? '#67e8f9'
              : wall.kind === 'exterior'
                ? '#e2e8f0'
                : '#cbd5e1';
        ctx.lineWidth = wall.kind === 'exterior' ? Math.max(2.5, thickPx * 1.25) : thickPx;
        ctx.beginPath();
        ctx.moveTo(wx1, wz1);
        ctx.lineTo(wx2, wz2);
        ctx.stroke();
      }
      if (isSel && this.selected?.kind === 'wall') {
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
      if (clampFloor(obj.floor ?? 0) !== curFl) continue;
      const cat = getCatalogItem(obj.type);
      const ow = obj.w || cat?.defaultW || 1;
      const od = obj.d || cat?.defaultD || 1;
      const ext = Math.max(ow, od) * 0.75 + 0.5;
      if (!isBoxInViewport2D(obj.x - ext, obj.x + ext, obj.z - ext, obj.z + ext, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      drawnObjects++;
      const isWallMount = Boolean(cat?.wallMount);
      const [px, py] = this._worldToScreen(obj.x, obj.z);
      const pw = Math.max(3, ow * this.cam2d.zoom);
      const pd = Math.max(3, od * this.cam2d.zoom);
      const rad = ((obj.rotation || 0) * Math.PI) / 180;
      const isSel = (this.selected?.kind === 'object' && this.selected.id === obj.id) || this._isMultiSelected('object', obj.id);
      const accent = obj.color || cat?.defaultColor || '#38bdf8';

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-rad);

      ctx.fillStyle = isSel ? 'rgba(250, 204, 21, 0.25)' : `${accent}44`;
      ctx.strokeStyle = isSel ? '#facc15' : accent;
      ctx.lineWidth = isSel ? 2.5 : Math.min(1.5, Math.max(0.8, this.cam2d.zoom * 0.12));
      const boxY = isWallMount ? 0 : -pd / 2;
      ctx.fillRect(-pw / 2, boxY, pw, pd);
      ctx.strokeRect(-pw / 2, boxY, pw, pd);

      if (cat?.isStair && Math.min(pw, pd) >= 12) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        for (let s = 1; s < 6; s++) {
          const sy = -pd / 2 + (pd * s) / 6;
          ctx.beginPath();
          ctx.moveTo(-pw / 2 + 2, sy);
          ctx.lineTo(pw / 2 - 2, sy);
          ctx.stroke();
        }
      }

      if (Math.min(pw, pd) >= 8) {
        const triBaseY = isWallMount ? pd : pd / 2;
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(0, triBaseY + 4);
        ctx.lineTo(-3.5, triBaseY - 2);
        ctx.lineTo(3.5, triBaseY - 2);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      const iconX = isWallMount ? px + Math.sin(rad) * (pd / 2) : px;
      const iconY = isWallMount ? py + Math.cos(rad) * (pd / 2) : py;

      if (Math.min(pw, pd) >= 9) {
        ctx.font = `${Math.max(9, Math.min(18, Math.min(pw, pd) * 0.55))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat?.icon || '📦', iconX, iconY);
      }

      if (this.cam2d.zoom >= 18 && obj.label) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(obj.label).slice(0, 18), iconX, iconY - pd / 2 - 8);
      }

      if (isSel && this.selected?.kind === 'object') {
        const distFront = (isWallMount ? Math.max(obj.d, 0.4) : Math.max(obj.d / 2, 0.5)) * this.cam2d.zoom + 18;
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

    if (this.dragState?.mode === 'marquee' && this.dragState.moved) {
      const mx1 = Math.min(this.dragState.startWx, this.dragState.curWx);
      const mx2 = Math.max(this.dragState.startWx, this.dragState.curWx);
      const mz1 = Math.min(this.dragState.startWz, this.dragState.curWz);
      const mz2 = Math.max(this.dragState.startWz, this.dragState.curWz);
      const [sx1, sz1] = this._worldToScreen(mx1, mz1);
      const [sx2, sz2] = this._worldToScreen(mx2, mz2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.fillRect(sx1, sz1, sx2 - sx1, sz2 - sz1);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx1, sz1, sx2 - sx1, sz2 - sz1);
      ctx.setLineDash([]);
    } else if (this.wallChainLastPt && this.toolMode === 'place' && getCatalogItem(this.activeCatalogType)?.isWall && !this.dragState) {
      const [cxp, czp] = this._worldToScreen(this.wallChainLastPt.x, this.wallChainLastPt.z);
      if (Array.isArray(this.rawHoverWorld)) {
        const [tx, tz] = this._snapToWallEndpoint(this.rawHoverWorld[0], this.rawHoverWorld[1], Boolean(this.altPressed));
        const [tsx, tsz] = this._worldToScreen(tx, tz);
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(cxp, czp);
        ctx.lineTo(tsx, tsz);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cxp, czp, 6, 0, Math.PI * 2);
      ctx.fill();
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
    } else if (this.dragState?.mode === 'draw_zone' || this.dragState?.mode === 'draw_room') {
      const minX = Math.min(this.dragState.x1, this.dragState.x2);
      const maxX = Math.max(this.dragState.x1, this.dragState.x2);
      const minZ = Math.min(this.dragState.z1, this.dragState.z2);
      const maxZ = Math.max(this.dragState.z1, this.dragState.z2);
      const [rx1, rz1] = this._worldToScreen(minX, minZ);
      const [rx2, rz2] = this._worldToScreen(maxX, maxZ);
      const isRoom = this.dragState.mode === 'draw_room';
      ctx.fillStyle = isRoom ? 'rgba(250, 204, 21, 0.16)' : 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(rx1, rz1, rx2 - rx1, rz2 - rz1);
      ctx.strokeStyle = isRoom ? '#facc15' : '#38bdf8';
      ctx.lineWidth = isRoom ? 3.5 : 2;
      ctx.strokeRect(rx1, rz1, rx2 - rx1, rz2 - rz1);
      const rw = Math.abs(maxX - minX);
      const rd = Math.abs(maxZ - minZ);
      const midX = (rx1 + rx2) * 0.5;
      const midY = (rz1 + rz2) * 0.5;
      const dimLabel = `${rw.toFixed(1)}m × ${rd.toFixed(1)}m (${(rw * rd).toFixed(0)} m²)`;
      ctx.font = 'bold 12px monospace';
      const tw = ctx.measureText(dimLabel).width + 16;
      ctx.fillStyle = 'rgba(7, 13, 25, 0.88)';
      ctx.fillRect(midX - tw * 0.5, midY - 12, tw, 24);
      ctx.strokeStyle = isRoom ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(midX - tw * 0.5, midY - 12, tw, 24);
      ctx.fillStyle = isRoom ? '#fde047' : '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dimLabel, midX, midY);
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
      if (cat && !cat.isWall && !cat.isZone && !cat.isRoomBuilder) {
        const snap = cat.wallMount ? this.activeWallSnap : null;
        if (snap) {
          this._drawWallSnapGuide(ctx, snap, cat.defaultW || 1.6);
        }
        const [gx, gy] = this._worldToScreen(this.hoverWorld[0], this.hoverWorld[1]);
        const gw = cat.defaultW * this.cam2d.zoom;
        const gd = cat.defaultD * this.cam2d.zoom;
        const rad = snap ? (snap.rotation * Math.PI) / 180 : 0;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(-rad);
        ctx.strokeStyle = snap ? '#10b981' : '#22d3ee';
        ctx.fillStyle = snap ? 'rgba(16, 185, 129, 0.22)' : 'transparent';
        ctx.lineWidth = snap ? 2 : 1.5;
        ctx.setLineDash([4, 3]);
        const boxY = cat.wallMount ? 0 : -gd / 2;
        if (snap) {
          ctx.fillRect(-gw / 2, boxY, gw, gd);
        }
        ctx.strokeRect(-gw / 2, boxY, gw, gd);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    if (this.dragState?.mode === 'move_entity' && this.activeWallSnap) {
      this._drawWallSnapGuide(ctx, this.activeWallSnap, this.dragState.entity?.w || 1.6, this.dragState.entity);
    } else if (!this.dragState && this.selected?.kind === 'object' && !this.altPressed) {
      const selObj = this.mapData.objects.find((o) => o.id === this.selected.id);
      const selCat = selObj ? getCatalogItem(selObj.type) : null;
      if (selObj && selCat?.wallMount) {
        const selSnap = this._resolveWallSnap(selObj.x, selObj.z, selCat, false, selObj.rotation);
        if (selSnap) {
          this._drawWallSnapGuide(ctx, selSnap, selObj.w || selCat.defaultW || 1.6, selObj);
        }
      }
    }

    this.lastDrawStats.drawnWalls = drawnWalls;
    this.lastDrawStats.drawnZones = drawnZones;
    this.lastDrawStats.drawnObjects = drawnObjects;
    this.lastDrawStats.totalWalls = this.mapData.walls.length;
    this.lastDrawStats.totalZones = this.mapData.zones.length;
    this.lastDrawStats.totalObjects = this.mapData.objects.length;

    for (const bm of this.mapData.bookmarks || []) {
      if (clampFloor(bm.floor ?? 0) !== curFl) continue;
      if (!isBoxInViewport2D(bm.x - 2, bm.x + 2, bm.z - 2, bm.z + 2, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      const [bmx, bmy] = this._worldToScreen(bm.x, bm.z);
      ctx.save();
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bmx, bmy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`📍 ${bm.label}`, bmx, bmy - 10);
      ctx.restore();
    }

    this.els.countsReadout.textContent = `${formatFloorShortLabel(this.activeFloor)} : ${drawnWalls}/${this.mapData.walls.length} murs • ${drawnZones}/${this.mapData.zones.length} zones • ${drawnObjects}/${this.mapData.objects.length} objets • ${b.width}×${b.depth}m`;
    this._drawMiniMap2D(visMinX, visMaxX, visMinZ, visMaxZ);
  }

  _drawGhostFloor(ctx, ghostFloor, strokeColor, cullMinX = -Infinity, cullMaxX = Infinity, cullMinZ = -Infinity, cullMaxZ = Infinity) {
    const fl = clampFloor(ghostFloor);
    if (fl !== ghostFloor) return;
    const hasFloor = (this.mapData.floors || []).some((f) => f.index === fl) ||
      (this.mapData.walls || []).some((w) => clampFloor(w.floor ?? 0) === fl);
    if (!hasFloor) return;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (const wall of this.mapData.walls || []) {
      if (clampFloor(wall.floor ?? 0) !== fl) continue;
      const wMinX = wall.x1 < wall.x2 ? wall.x1 : wall.x2;
      const wMaxX = wall.x1 > wall.x2 ? wall.x1 : wall.x2;
      const wMinZ = wall.z1 < wall.z2 ? wall.z1 : wall.z2;
      const wMaxZ = wall.z1 > wall.z2 ? wall.z1 : wall.z2;
      if (!isBoxInViewport2D(wMinX, wMaxX, wMinZ, wMaxZ, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      const [x1, z1] = this._worldToScreen(wall.x1, wall.z1);
      const [x2, z2] = this._worldToScreen(wall.x2, wall.z2);
      ctx.moveTo(x1, z1);
      ctx.lineTo(x2, z2);
    }
    ctx.stroke();
    for (const obj of this.mapData.objects || []) {
      if (clampFloor(obj.floor ?? 0) !== fl) continue;
      const cat = getCatalogItem(obj.type);
      if (!cat?.isStair) continue;
      const ext = Math.max(obj.w || cat.defaultW || 1, obj.d || cat.defaultD || 1);
      if (!isBoxInViewport2D(obj.x - ext, obj.x + ext, obj.z - ext, obj.z + ext, cullMinX, cullMaxX, cullMinZ, cullMaxZ)) {
        continue;
      }
      const [px, py] = this._worldToScreen(obj.x, obj.z);
      const pw = Math.max(4, (obj.w || cat.defaultW || 1) * this.cam2d.zoom);
      const pd = Math.max(4, (obj.d || cat.defaultD || 1) * this.cam2d.zoom);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-((obj.rotation || 0) * Math.PI) / 180);
      ctx.strokeRect(-pw / 2, -pd / 2, pw, pd);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawMiniMap2D(visMinX, visMaxX, visMinZ, visMaxZ) {
    const mc = this.els?.minimapCanvas;
    if (!mc) return;
    const mctx = mc.getContext?.('2d');
    if (!mctx) return;
    const mw = mc.width;
    const mh = mc.height;
    const pad = 6;
    const b = this.mapData.bounds;
    const scale = Math.min((mw - pad * 2) / Math.max(1, b.width), (mh - pad * 2) / Math.max(1, b.depth));
    const offX = pad + (mw - pad * 2 - b.width * scale) / 2;
    const offY = pad + (mh - pad * 2 - b.depth * scale) / 2;
    const toMini = (wx, wz) => [offX + (wx - b.minX) * scale, offY + (wz - b.minZ) * scale];

    mctx.fillStyle = 'rgba(5, 11, 24, 0.94)';
    mctx.fillRect(0, 0, mw, mh);

    const [bx1, by1] = toMini(b.minX, b.minZ);
    const [bx2, by2] = toMini(b.maxX, b.maxZ);
    mctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    mctx.lineWidth = 1;
    mctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);

    const curFl = this.activeFloor;
    for (const z of this.mapData.zones || []) {
      if (clampFloor(z.floor ?? 0) !== curFl) continue;
      const [zx1, zy1] = toMini(z.x - (z.w || 4) * 0.5, z.z - (z.d || 4) * 0.5);
      const [zx2, zy2] = toMini(z.x + (z.w || 4) * 0.5, z.z + (z.d || 4) * 0.5);
      mctx.fillStyle = `${z.color || '#38bdf8'}44`;
      mctx.fillRect(zx1, zy1, Math.max(1.5, zx2 - zx1), Math.max(1.5, zy2 - zy1));
    }

    mctx.strokeStyle = '#cbd5e1';
    mctx.lineWidth = 1.2;
    mctx.beginPath();
    for (const wall of this.mapData.walls || []) {
      if (clampFloor(wall.floor ?? 0) !== curFl) continue;
      const [x1, y1] = toMini(wall.x1, wall.z1);
      const [x2, y2] = toMini(wall.x2, wall.z2);
      mctx.moveTo(x1, y1);
      mctx.lineTo(x2, y2);
    }
    mctx.stroke();

    for (const obj of this.mapData.objects || []) {
      if (clampFloor(obj.floor ?? 0) !== curFl) continue;
      const cat = getCatalogItem(obj.type);
      if (!cat?.isStair) continue;
      const [sx, sy] = toMini(obj.x, obj.z);
      mctx.fillStyle = '#f59e0b';
      mctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    for (const bm of this.mapData.bookmarks || []) {
      const [bmx, bmy] = toMini(bm.x, bm.z);
      mctx.fillStyle = '#facc15';
      mctx.beginPath();
      mctx.arc(bmx, bmy, 2.6, 0, Math.PI * 2);
      mctx.fill();
    }

    const [vx1, vy1] = toMini(Math.max(b.minX, visMinX), Math.max(b.minZ, visMinZ));
    const [vx2, vy2] = toMini(Math.min(b.maxX, visMaxX), Math.min(b.maxZ, visMaxZ));
    mctx.strokeStyle = '#22d3ee';
    mctx.lineWidth = 1.4;
    mctx.strokeRect(vx1, vy1, Math.max(4, vx2 - vx1), Math.max(4, vy2 - vy1));
  }

  _drawWallSnapGuide(ctx, snap, width = 1.6, attachedEntity = null) {
    if (!snap || !snap.wall) return;
    const { wall, x, z, nx, nz, rotation, wallThickness } = snap;
    const [wx1, wy1] = this._worldToScreen(wall.x1, wall.z1);
    const [wx2, wy2] = this._worldToScreen(wall.x2, wall.z2);
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len;
    const tz = dz / len;
    const halfSpan = Math.min(len * 0.5, Math.max(0.45, width * 0.5 + 0.15));
    const faceOffset = (wallThickness || 0.18) / 2;
    const cx = x;
    const cz = z;
    const [fx1, fy1] = this._worldToScreen(cx - tx * halfSpan, cz - tz * halfSpan);
    const [fx2, fy2] = this._worldToScreen(cx + tx * halfSpan, cz + tz * halfSpan);
    const [ax, ay] = this._worldToScreen(x, z);

    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = Math.max(4, (wallThickness || 0.18) * this.cam2d.zoom + 4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(wx1, wy1);
    ctx.lineTo(wx2, wy2);
    ctx.stroke();

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx1, fy1);
    ctx.lineTo(fx2, fy2);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ecfeff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ax, ay, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const arrowOriginX = attachedEntity ? attachedEntity.x : x;
    const arrowOriginZ = attachedEntity ? attachedEntity.z : z;
    const arrowRad = ((attachedEntity?.rotation ?? rotation) * Math.PI) / 180;
    const dirX = Math.sin(arrowRad);
    const dirZ = Math.cos(arrowRad);
    const arrowLen = Math.max(0.55, faceOffset + 0.45);
    const [ox, oy] = this._worldToScreen(arrowOriginX, arrowOriginZ);
    const [txEnd, tyEnd] = this._worldToScreen(arrowOriginX + dirX * arrowLen, arrowOriginZ + dirZ * arrowLen);
    const angle = Math.atan2(tyEnd - oy, txEnd - ox);

    ctx.strokeStyle = '#34d399';
    ctx.fillStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(txEnd, tyEnd);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(txEnd, tyEnd);
    ctx.lineTo(txEnd - Math.cos(angle - Math.PI / 6) * 10, tyEnd - Math.sin(angle - Math.PI / 6) * 10);
    ctx.lineTo(txEnd - Math.cos(angle + Math.PI / 6) * 10, tyEnd - Math.sin(angle + Math.PI / 6) * 10);
    ctx.closePath();
    ctx.fill();

    if (this.cam2d.zoom >= 14) {
      const [lx, ly] = this._worldToScreen(arrowOriginX + dirX * (arrowLen + 0.25), arrowOriginZ + dirZ * (arrowLen + 0.25));
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`🧲 ${Math.round(rotation)}°`, lx, ly);
    }
    ctx.restore();
  }

  _ensure3D() {
    if (this.three.renderer) {
      this._resize3D();
      return;
    }
    const canvas = this.els.canvas3d;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    const lab = buildLabWorld(scene, this.mapData, { skipCombatFallback: false });

    this.three.renderer = renderer;
    this.three.scene = scene;
    this.three.camera = camera;
    this.three.lab = lab;

    const b = this.mapData.bounds;
    const diag = Math.hypot(b.width, b.depth);
    this.three.orbit.dist = Math.max(24, Math.min(420, diag * 0.62));
    this.three.orbit.tx = (b.minX + b.maxX) / 2;
    this.three.orbit.ty = getFloorBaseY(this.mapData, this.activeFloor) + 1.2;
    this.three.orbit.tz = (b.minZ + b.maxZ) / 2;

    this._apply3DFloorCutoff();
    this._sync3DEnvironment();
    this._resize3D();
    this._updateCamera3D();
    this._start3DLoop();
  }

  _sync3DEnvironment() {
    if (!this.three.scene || !this.three.camera) return;
    const b = this.mapData.bounds;
    const diag = Math.hypot(b.width, b.depth);
    this.three.camera.far = Math.max(600, Math.min(3600, diag * 1.8));
    this.three.camera.updateProjectionMatrix();
    if (this.three.scene.fog) {
      this.three.scene.fog.near = Math.max(45, Math.min(900, diag * 0.45));
      this.three.scene.fog.far = Math.max(160, Math.min(2400, diag * 1.2));
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
    const ty = Number.isFinite(this.three.orbit.ty) ? this.three.orbit.ty : getFloorBaseY(this.mapData, this.activeFloor) + 1.2;
    const hDist = Math.cos(pitch) * dist;
    const cy = Math.max(ty + 0.4, ty + Math.sin(pitch) * dist);
    const cx = tx + Math.sin(yaw) * hDist;
    const cz = tz + Math.cos(yaw) * hDist;
    this.three.camera.position.set(cx, cy, cz);
    this.three.camera.lookAt(tx, ty - 0.2, tz);
  }

  _start3DLoop() {
    if (this.three.rafId) return;
    const tick = () => {
      if (!this.isActive || this.viewMode === '2d' || !this.three.renderer) {
        this.three.rafId = 0;
        return;
      }
      const elapsed = this.three.clock.getElapsedTime();
      this.three.lab?.updateCulling?.(this.three.camera, null, {
        enableOcclusion: false,
        enableFloorCulling: false,
        currentFloor: this.activeFloor
      });
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
      this._apply3DFloorCutoff();
      return;
    }
    clearTimeout(this.three.rebuildTimer);
    this.three.rebuildTimer = setTimeout(() => {
      this.three.lab?.rebuildWorld(this.mapData);
      this._apply3DFloorCutoff();
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
    this.panKeys.clear();
    this._stopKeyboardPanLoop();
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
      this.multiSelected = [];
      this.wallChainLastPt = null;
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
