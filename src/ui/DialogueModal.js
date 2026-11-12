import { sfx } from '../core/audio.js';
import { getMention, TP_CATALOG } from '../core/gameState.js';

export class DialogueModal {
  constructor() {
    this.backdrop = document.getElementById('dialogue-modal');
    this.bodyEl = document.getElementById('dialogue-body');
    this.choicesEl = document.getElementById('dialogue-choices');
    this.closeBtn = document.getElementById('dialogue-close');
    this.onCloseCb = null;

    this.closeBtn.addEventListener('click', () => {
      sfx.click();
      this.close();
    });
  }

  open(gameState, handlers) {
    this.onCloseCb = handlers.onClose;
    this.backdrop.classList.remove('hidden');
    this._renderMain(gameState, handlers);
  }

  _renderMain(gameState, handlers) {
    const p = gameState.profile;
    const nextTp = gameState.getNextSuggestedTp();
    const completed = p.completedCount || 0;

    let speech = '';
    if (!p.questAccepted) {
      speech = `
        <p>« Bonjour <strong>${p.name}</strong> et bienvenue en salle <strong>E204</strong> ! »</p>
        <p>« Pour préparer l'épreuve pratique du <strong>BAC PRO CIEL</strong>, je te confie <strong>5 Travaux Pratiques</strong> indispensables :
        métrologie à l'<strong>oscilloscope</strong>, <strong>brasure sans plomb</strong>, montage d'<strong>électronique</strong>,
        désinfection d'un <strong>PC envahi de virus</strong>, et déploiement complet d'un <strong>hyperviseur VM &amp; VLAN 802.1Q</strong>. »</p>
        <p>« Obtiens au moins <strong>10/20</strong> sur chaque poste pour décrocher ton diplôme. Tu es prêt ? »</p>
      `;
    } else if (p.diplomaEarned) {
      const mention = getMention(p.average);
      speech = `
        <div class="diploma-banner">
          <div class="diploma-seal">🎓 DIPLÔME BAC PRO CIEL VALIDÉ</div>
          <div class="diploma-grade">Moyenne Générale : <strong>${p.average}/20</strong> — ${mention}</div>
          <div class="diploma-student">Décerné à <strong>${p.name}</strong> par M. Fortin</div>
        </div>
        <p>« Bravo ${p.name} ! Tu maîtrises autant le fer à souder et l'oscilloscope que la cybersécurité et le routage VLAN. Tu peux rejouer n'importe quel TP pour viser le 20/20 au classement ! »</p>
      `;
    } else {
      speech = `
        <p>« Alors <strong>${p.name}</strong>, où en es-tu dans tes TPs ? Tu as déjà validé <strong>${completed} / 5</strong> postes. »</p>
        ${
          nextTp
            ? `<p>« Je te conseille d'aller au poste <strong>${nextTp.icon} ${nextTp.title}</strong> : <em>${nextTp.brief}</em> »</p>`
            : ''
        }
      `;
    }

    this.bodyEl.innerHTML = `
      ${speech}
      <div class="fortin-tp-grid">
        ${TP_CATALOG.map((tp) => {
          const grade = p.grades?.[tp.id];
          const ok = typeof grade === 'number' && grade >= 10;
          return `
            <div class="fortin-tp-item ${ok ? 'done' : ''}">
              <span>${tp.icon} ${tp.shortTitle}</span>
              <span class="tp-grade-pill">${typeof grade === 'number' ? `${grade.toFixed(1)}/20` : 'À faire'}</span>
            </div>`;
        }).join('')}
      </div>
    `;

    this.choicesEl.innerHTML = '';

    if (!p.questAccepted) {
      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.className = 'btn-primary';
      acceptBtn.textContent = '✅ Accepter les quêtes de M. Fortin !';
      acceptBtn.addEventListener('click', () => {
        sfx.success();
        handlers.onAcceptQuest?.();
        this.close();
      });
      this.choicesEl.appendChild(acceptBtn);
    } else if (nextTp) {
      const goBtn = document.createElement('button');
      goBtn.type = 'button';
      goBtn.className = 'btn-primary';
      goBtn.textContent = `${nextTp.icon} Aller directement au ${nextTp.shortTitle}`;
      goBtn.addEventListener('click', () => {
        sfx.interact();
        this.close();
        handlers.onTeleportTp?.(nextTp.id);
      });
      this.choicesEl.appendChild(goBtn);

      const hintBtn = document.createElement('button');
      hintBtn.type = 'button';
      hintBtn.className = 'btn-hud';
      hintBtn.textContent = `💡 Demander un conseil sur ${nextTp.shortTitle}`;
      hintBtn.addEventListener('click', () => {
        sfx.interact();
        this.bodyEl.innerHTML += `<div class="fortin-tip"><strong>Conseil de M. Fortin :</strong> ${nextTp.fortinHint}</div>`;
      });
      this.choicesEl.appendChild(hintBtn);
    }

    const closeChoice = document.createElement('button');
    closeChoice.type = 'button';
    closeChoice.className = 'btn-hud';
    closeChoice.textContent = 'Retourner dans l’atelier';
    closeChoice.addEventListener('click', () => {
      sfx.click();
      this.close();
    });
    this.choicesEl.appendChild(closeChoice);
  }

  close() {
    this.backdrop.classList.add('hidden');
    this.onCloseCb?.();
  }
}
