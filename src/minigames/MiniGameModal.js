import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { getStationById } from '../core/gameState.js';

export class MiniGameModal {
  constructor() {
    this.backdrop = document.getElementById('minigame-modal');
    this.iconEl = document.getElementById('mg-icon');
    this.subtitleEl = document.getElementById('mg-subtitle');
    this.titleEl = document.getElementById('mg-title');
    this.stagePillsEl = document.getElementById('mg-stage-pills');
    this.timerEl = document.getElementById('mg-timer');
    this.contentEl = document.getElementById('mg-content');
    this.exitBtn = document.getElementById('mg-exit-btn');

    this.activeGame = null;
    this.activeTpId = null;
    this.currentTp = null;
    this.timerInterval = null;
    this.startTimeMs = 0;
    this.onCloseCallback = null;
    this.onFinishCallback = null;
    this.vrManager = null;
    this.vrResultScene = null;
    this.vrResultActive = false;
    this.stageSnapshot = { stages: [], activeStageIdx: 0, onSelectStage: null };

    this.exitBtn.addEventListener('click', () => {
      sfx.click();
      this.close();
    });
  }

  open(tpId, createGameFn, { vrManager = null, onComplete, onClose }) {
    const tp = getStationById(tpId);
    if (!tp) return;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.vrResultActive = false;
    this._cleanupVrResultScene();
    this.vrManager = vrManager || this.vrManager || null;
    if (this.vrManager?.isVrActive()) {
      this.vrManager.detachTpContext();
      this.vrManager.sceneMgr?.setCustomRenderTarget?.(null, null);
    }
    this.cleanupActive();

    this.activeTpId = tpId;
    this.currentTp = tp;
    this.onFinishCallback = onComplete;
    this.onCloseCallback = onClose;
    this.stageSnapshot = { stages: [], activeStageIdx: 0, onSelectStage: null };

    const vrActive = Boolean(this.vrManager?.isVrActive());
    this.backdrop.classList.toggle('vr-passthrough', vrActive);

    this.contentEl.__vrBridge = {
      isActive: () => Boolean(this.vrManager?.isVrActive()),
      renderer: this.vrManager?.sceneMgr?.renderer || null,
      envTexture: this.vrManager?.sceneMgr?.envRenderTarget?.texture || null,
      attachWorkbench: (ctx) => {
        this.vrManager?.attachTpContext?.(ctx);
        this.vrManager?.sceneMgr?.setCustomRenderTarget?.(ctx.scene, ctx.vrStep);
      },
      detachWorkbench: () => {
        if (this.vrResultActive) return;
        this.vrManager?.detachTpContext?.();
        this.vrManager?.sceneMgr?.setCustomRenderTarget?.(null, null);
      },
      syncPanel: () => this.vrManager?.syncTpPanelFromContext?.(),
      getModalSnapshot: () => ({
        tpTitle: this.currentTp ? `${this.currentTp.icon} ${this.currentTp.title}` : 'TP Atelier 3D',
        timer: this.timerEl?.textContent || '00:00',
        stages: this.stageSnapshot.stages,
        activeStageIdx: this.stageSnapshot.activeStageIdx,
        onSelectStage: (idx) => this.stageSnapshot.onSelectStage?.(idx),
        result: null
      }),
      requestExit: () => this.close()
    };

    this.iconEl.textContent = tp.icon;
    this.subtitleEl.textContent = `BAC PRO CIEL • ATELIER 3D • ${tp.pole.toUpperCase()}`;
    this.titleEl.textContent = tp.title;
    this.stagePillsEl.innerHTML = '';
    this.backdrop.classList.add('tp3d-mode');
    this.backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.backdrop.classList.add('tp3d-visible');
      window.dispatchEvent(new Event('resize'));
    });

    this.startTimeMs = Date.now();
    this._updateTimer();
    this.timerInterval = setInterval(() => this._updateTimer(), 1000);

    const api = {
      container: this.contentEl,
      setStages: (stages, activeIdx, onSelect) => {
        this.stageSnapshot = {
          stages: stages || [],
          activeStageIdx: activeIdx || 0,
          onSelectStage: (idx) => onSelect?.(idx)
        };
        this.stagePillsEl.innerHTML = '';
        stages.forEach((item, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `stage-pill ${idx === activeIdx ? 'active' : ''}`;
          const label =
            typeof item === 'string'
              ? item
              : item?.score != null
                ? `${item.name} (${item.score}/20)`
                : item?.name || '';
          btn.textContent = label;
          btn.addEventListener('click', () => {
            sfx.click();
            onSelect?.(idx);
          });
          this.stagePillsEl.appendChild(btn);
        });
        this.vrManager?.syncTpPanelFromContext?.();
      },
      finishTp: (scoreOutOf20, summaryHtml) => {
        const durationSec = Math.max(1, Math.round((Date.now() - this.startTimeMs) / 1000));
        const finalScore = Math.max(0, Math.min(20, Math.round(scoreOutOf20 * 10) / 10));
        if (finalScore >= 10) sfx.success();
        else sfx.error();

        this.onFinishCallback?.({
          tpId: this.activeTpId,
          score: finalScore,
          durationSec
        });

        this._showResultScreen(tp, finalScore, durationSec, summaryHtml);
      }
    };

    this.activeGame = createGameFn(api);
  }

  _createVrResultScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d6e4f2');
    scene.fog = new THREE.Fog('#d6e4f2', 8, 22);
    if (this.vrManager?.sceneMgr?.envRenderTarget?.texture) {
      scene.environment = this.vrManager.sceneMgr.envRenderTarget.texture;
      scene.environmentIntensity = 0.65;
    }
    const hemi = new THREE.HemisphereLight('#f0f7ff', '#cbd5e1', 0.95);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight('#fff6e8', 1.25);
    dir.position.set(2.5, 4.2, 2.8);
    scene.add(dir);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshStandardMaterial({ color: '#c4d0dd', roughness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.82;
    scene.add(floor);
    return scene;
  }

  _cleanupVrResultScene() {
    if (!this.vrResultScene) return;
    this.vrResultScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose?.();
      }
    });
    this.vrResultScene = null;
  }

  _showResultScreen(tp, score, durationSec, summaryHtml) {
    const passed = score >= 10;
    const estXp = Math.round(score * 15) + 30;
    const mention =
      score >= 18
        ? 'Félicitations du Professeur CIEL !'
        : score >= 15
          ? 'Très solide maîtrise CIEL !'
          : score >= 10
            ? 'TP Validé — Continuez ainsi !'
            : 'TP non validé (< 10/20) — Recommencez pour améliorer votre note.';

    if (this.vrManager?.isVrActive()) {
      const resultScene = this._createVrResultScene();
      this.vrResultActive = true;
      this.vrResultScene = resultScene;
      this.vrManager.attachTpContext({
        scene: resultScene,
        interactiveMeshes: [],
        requestExit: () => this.close(),
        getSnapshot: () => ({
          tpTitle: `${tp.icon} ${tp.title}`,
          timer: this._formatSec(durationSec),
          accuracy: `${score.toFixed(1)} / 20`,
          badge: 'TERMINÉ',
          briefTitle: tp.title,
          briefSub: mention,
          result: {
            score,
            xp: estXp,
            duration: this._formatSec(durationSec),
            mention,
            onReplay: () => {
              sfx.click();
              this.close({ replayTpId: tp.id });
            },
            onExit: () => {
              sfx.click();
              this.close();
            }
          }
        })
      });
      this.vrManager.sceneMgr?.setCustomRenderTarget?.(resultScene, null);
    }

    this.cleanupActive();

    this.contentEl.innerHTML = `
      <div class="mg-result-backdrop">
        <div class="mg-result-card">
          <div class="mg-result-badge ${passed ? 'pass' : 'fail'}">
            <div class="mg-result-score">${score.toFixed(1)}<span>/20</span></div>
            <div class="mg-result-xp">+${estXp} XP</div>
            <div class="mg-result-status">${passed ? '✅ COMPÉTENCE VALIDÉE' : '⚠️ À RETRAVAILLER'}</div>
          </div>
          <h3>${tp.icon} ${tp.title}</h3>
          <p class="mg-result-prof">👨‍🏫 <strong>Professeur CIEL :</strong> « ${mention} »</p>
          <div class="mg-result-meta">⏱️ Temps réalisé : <strong>${this._formatSec(durationSec)}</strong></div>
          <div class="mg-result-summary">${summaryHtml || ''}</div>
          <div class="mg-result-actions">
            <button id="mg-replay-btn" class="btn-hud">🔄 Refaire le TP</button>
            <button id="mg-back-3d-btn" class="btn-primary">Retour à l'atelier 3D ▶</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('mg-back-3d-btn')?.addEventListener('click', () => {
      sfx.click();
      this.close();
    });
    document.getElementById('mg-replay-btn')?.addEventListener('click', () => {
      sfx.click();
      this.close({ replayTpId: tp.id });
    });
  }

  _updateTimer() {
    const sec = Math.floor((Date.now() - this.startTimeMs) / 1000);
    this.timerEl.textContent = this._formatSec(sec);
    if (this.vrManager?.isVrActive() && !this.vrResultActive) {
      this.vrManager.syncTpPanelFromContext();
    }
  }

  _formatSec(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  cleanupActive() {
    if (this.activeGame && typeof this.activeGame.destroy === 'function') {
      this.activeGame.destroy();
    }
    this.activeGame = null;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  close(payload = {}) {
    this.vrResultActive = false;
    this.vrManager?.detachTpContext?.();
    this.vrManager?.sceneMgr?.setCustomRenderTarget?.(null, null);
    this.cleanupActive();
    this._cleanupVrResultScene();
    this.contentEl.__vrBridge = null;
    this.backdrop.classList.remove('tp3d-visible', 'tp3d-mode', 'vr-passthrough');
    this.backdrop.classList.add('hidden');
    this.contentEl.innerHTML = '';
    this.stagePillsEl.innerHTML = '';
    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    cb?.(payload);
  }
}
