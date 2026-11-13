import { sfx } from '../core/audio.js';
import { getMention, getTpById, TP_CATALOG } from '../core/gameState.js';

const TP_DEEP_EXPLANATIONS = {
  oscilloscope: [
    '« L’oscilloscope, c’est nos yeux en électronique ! Sans lui, impossible de voir un signal rapide ou une micro-coupure. »',
    '« Pense toujours à régler d’abord le Trigger (déclenchement) dans la zone d’amplitude du signal : tant qu’il n’accroche pas, la courbe défile. »',
    '« Et méfie-toi du couplage AC sur un signal PWM 0–5V : il supprime la composante continue et centre le signal sur 0V ! »'
  ],
  soldering: [
    '« En BAC PRO CIEL, on travaille avec de la brasure sans plomb SAC305 : il faut régler la station entre 340°C et 365°C. »',
    '« N’oublie jamais l’extracteur de fumées avant de chauffer ! Puis chauffe la pastille ET la patte en même temps avant de relâcher dans la zone verte. »',
    '« Et si deux pattes d’un composant CMS se touchent par un pont d’étain, pas de panique : un coup de tresse à dessouder et c’est propre. »'
  ],
  electronics: [
    '« Avant de brancher une alimentation stabilisée, on sort toujours la calculatrice : Loi d’Ohm U = R × I ! »',
    '« Pour une LED rouge sous 12V, retire d’abord sa tension de seuil (~2V) puis divise par 20 mA : tu arrives autour de 470 à 510 Ω. »',
    '« Sur les relais ou moteurs, n’oublie jamais la diode de roue libre en inverse : sinon la surtension à la coupure grille le transistor ! »'
  ],
  antivirus: [
    '« Quand un poste est envahi de popups ou chiffre des fichiers, le pire réflexe serait de le laisser connecté au réseau du lycée ! »',
    '« Toujours isoler la carte réseau en premier. Ensuite, inspecte le Gestionnaire des tâches : cherche les faux noms comme svch0st.exe avec un zéro ! »',
    '« Enfin, installe ou mets à jour CielGuard EDR, bloque les ports backdoor au pare-feu et mets chaque menace en quarantaine. »'
  ],
  vmvlan: [
    '« Dans une vraie infra CIEL, un serveur physique héberge plusieurs VMs grâce à l’hyperviseur : attention à ne pas saturer la RAM ou le CPU ! »',
    '« Côté switch L2 : un port vers un PC ou une imprimante reste en mode ACCESS sur son VLAN. Mais entre switchs, vers l’hyperviseur ou vers le routeur, il faut un TRUNK 802.1Q ! »',
    '« Et n’oublie pas les passerelles sur le routeur inter-VLAN ainsi que les règles ACL si on te demande d’isoler le VLAN Élèves du VLAN Admin. »'
  ]
};

export class DialogueModal {
  constructor() {
    this.overlay = document.getElementById('dialogue-modal');
    this.textBoxEl = document.getElementById('dialogue-textbox');
    this.textEl = document.getElementById('dialogue-text');
    this.extraEl = document.getElementById('dialogue-extra');
    this.stepEl = document.getElementById('dialogue-step-indicator');
    this.nextBtn = document.getElementById('dialogue-next-btn');
    this.choicesEl = document.getElementById('dialogue-choices');
    this.closeBtn = document.getElementById('dialogue-close');

    this.onCloseCb = null;
    this.gameState = null;
    this.handlers = null;

    this.lines = [];
    this.lineIdx = 0;
    this.typingTimer = null;
    this.isTyping = false;
    this.fullLineText = '';
    this.pendingChoices = [];
    this.pendingExtraHtml = '';

    this.closeBtn.addEventListener('click', () => {
      sfx.click();
      this.close();
    });

    this.textBoxEl.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this._advanceOrFinishLine();
    });

    this.nextBtn.addEventListener('click', () => {
      sfx.click();
      this._advanceOrFinishLine();
    });

    this._onKeyDown = (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        if (document.activeElement?.closest('.vn-choices')) return;
        e.preventDefault();
        this._advanceOrFinishLine();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  open(gameState, handlers) {
    this.gameState = gameState;
    this.handlers = handlers;
    this.onCloseCb = handlers.onClose;
    this.overlay.classList.remove('hidden');
    this._startMainConversation();
  }

  _startMainConversation() {
    const p = this.gameState.profile;
    const nextTp = this.gameState.getNextSuggestedTp();
    const completed = p.completedCount || 0;
    const customText = String(this.handlers?.customDialogue || '').trim();

    if (customText) {
      const customLines = customText
        .split(/\r?\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (l.startsWith('«') ? l : `« ${l} »`));
      this._playNode({
        lines: customLines,
        choices: [
          ...(!p.questAccepted
            ? [
                {
                  label: '💬 « Compris ! Je lance les TPs ! »',
                  primary: true,
                  action: () => {
                    sfx.success();
                    this.handlers.onAcceptQuest?.();
                    this.close();
                  }
                }
              ]
            : nextTp
              ? [
                  {
                    label: `⚡ Aller vers ${nextTp.icon} ${nextTp.shortTitle}`,
                    primary: true,
                    action: () => {
                      this.close();
                      this.handlers.onTeleportTp?.(nextTp.id);
                    }
                  }
                ]
              : []),
          {
            label: '👍 « Merci Monsieur ! »',
            action: () => this.close()
          }
        ]
      });
      return;
    }

    if (!p.questAccepted) {
      this._playNode({
        lines: [
          `« Ah, bonjour ${p.name} ! Bienvenue dans les ateliers de la filière CIEL, tu as de vrais bancs techniques 3D devant toi. »`,
          '« Chaque borne de l’atelier — Brasure PCB, Oscilloscope & Élec, Assemblage PC, Baie 19" VLAN, Défense SOC Cyber et Régie Audiovisuelle — te plonge directement face au matériel réel en 3D ! »',
          '« Pour décrocher ton diplôme BAC PRO CIEL, valide mes 5 Travaux Pratiques principaux avec au moins 10/20 chacun — et entraîne-toi sur tous les ateliers du plateau pour grimper au classement ! »',
          '« Alors, prêt à prendre les outils en main ? »'
        ],
        choices: [
          {
            label: '💬 « Oui Monsieur, je prends les 5 missions ! »',
            primary: true,
            action: () => {
              sfx.success();
              this.handlers.onAcceptQuest?.();
              this._playNode({
                lines: [
                  `« C’est l’état d’esprit que j’aime voir, ${p.name} ! »`,
                  '« Tu peux te balader librement jusqu’aux établis ou utiliser l’accès rapide à gauche. Reviens me parler dès que tu veux un conseil ou ton bilan ! »'
                ],
                choices: [
                  {
                    label: '〰️ Aller vers le premier TP (Oscilloscope)',
                    primary: true,
                    action: () => {
                      this.close();
                      this.handlers.onTeleportTp?.('oscilloscope');
                    }
                  },
                  {
                    label: '👍 « Merci Monsieur, à tout à l’heure ! »',
                    action: () => this.close()
                  }
                ]
              });
            }
          },
          {
            label: '💬 « Pourquoi un PC infecté et des VLANs dans le même atelier ? »',
            action: () => {
              this._playNode({
                lines: [
                  '« Parce que c’est exactement ça le BAC PRO CIEL : Cybersécurité, Informatique et réseaux, Électronique ! »',
                  '« Un bon technicien sait autant lire une trame 802.1Q ou nettoyer un malware que sortir le fer à souder pour réparer une carte. »',
                  '« Allez, tu acceptes les 5 TPs ? »'
                ],
                choices: [
                  {
                    label: '💬 « Compris ! Je lance les 5 TPs ! »',
                    primary: true,
                    action: () => {
                      sfx.success();
                      this.handlers.onAcceptQuest?.();
                      this.close();
                    }
                  }
                ]
              });
            }
          },
          {
            label: '💬 « Je jette juste un œil à la salle avant. »',
            action: () => this.close()
          }
        ]
      });
      return;
    }

    if (p.diplomaEarned) {
      const mention = getMention(p.average);
      this._playNode({
        lines: [
          `« Félicitations ${p.name} ! J’ai compilé toutes tes notes de travaux pratiques… »`,
          `« Avec une moyenne générale de ${p.average}/20 (${mention}), tu viens officiellement de valider l’ensemble des pôles du BAC PRO CIEL ! »`,
          '« Tu peux être fier de toi : électro, métrologie, cyberdéfense et virtualisation VLAN n’ont plus de secret pour toi. »'
        ],
        extraHtml: `
          <div class="diploma-banner">
            <div class="diploma-seal">🎓 DIPLÔME BAC PRO CIEL VALIDÉ</div>
            <div class="diploma-grade">Moyenne Générale : <strong>${p.average}/20</strong> — ${mention}</div>
            <div class="diploma-student">Décerné à <strong>${p.name}</strong> par le Professeur CIEL</div>
          </div>
        `,
        choices: [
          {
            label: '💬 « Je veux voir toutes mes notes en détail. »',
            action: () => this._showReportCardNode()
          },
          {
            label: '💬 « Merci Professeur CIEL ! Je vais tenter d’améliorer encore mes scores ! »',
            primary: true,
            action: () => this.close()
          }
        ]
      });
      return;
    }

    // Ongoing progression
    const greeting =
      completed === 0
        ? `« Alors ${p.name}, prêt à attaquer ton premier poste ? Les établis n’attendent que toi ! »`
        : completed < 3
          ? `« Bon début ${p.name} ! Tu as déjà validé ${completed} TP sur 5. Continue sur cette lancée ! »`
          : `« Tu approches du but ${p.name} : ${completed}/5 TPs validés ! Il ne t’en reste plus que ${5 - completed}. »`;

    const nextAdvice = nextTp
      ? `« Si tu veux mon avis, passe maintenant au poste ${nextTp.icon} ${nextTp.title}. Qu’est-ce que tu veux qu’on voie ensemble ? »`
      : '« Qu’est-ce que je peux faire pour t’aider ? »';

    const choices = [];
    if (nextTp) {
      choices.push({
        label: `💬 « Parlez-moi du ${nextTp.shortTitle}, Monsieur. »`,
        primary: true,
        action: () => this._explainTpNode(nextTp.id)
      });
    }
    choices.push({
      label: '💬 « J’ai besoin d’un conseil technique sur un autre TP. »',
      action: () => this._askWhichTpNode()
    });
    choices.push({
      label: '💬 « Où en suis-je dans mon bulletin de notes ? »',
      action: () => this._showReportCardNode()
    });
    choices.push({
      label: '💬 « Merci Monsieur, je retourne travailler ! »',
      action: () => this.close()
    });

    this._playNode({
      lines: [greeting, nextAdvice],
      choices
    });
  }

  _askWhichTpNode() {
    this._playNode({
      lines: ['« Dis-moi sur quel TP tu veux un rappel de cours ou une astuce de pro ! »'],
      choices: [
        ...TP_CATALOG.map((tp) => ({
          label: `${tp.icon} ${tp.shortTitle}`,
          action: () => this._explainTpNode(tp.id)
        })),
        {
          label: '↩️ Revenir à la discussion',
          action: () => this._startMainConversation()
        }
      ]
    });
  }

  _explainTpNode(tpId) {
    const tp = getTpById(tpId);
    const lines = TP_DEEP_EXPLANATIONS[tpId] || [tp.teacherHint];
    this._playNode({
      lines,
      choices: [
        {
          label: `${tp.icon} « Merci ! Je vais directement au poste ${tp.shortTitle} ! »`,
          primary: true,
          action: () => {
            sfx.interact();
            this.close();
            this.handlers.onTeleportTp?.(tp.id);
          }
        },
        {
          label: '💬 « J’ai une question sur un autre TP. »',
          action: () => this._askWhichTpNode()
        },
        {
          label: '👍 « C’est noté, merci Monsieur ! »',
          action: () => this.close()
        }
      ]
    });
  }

  _showReportCardNode() {
    const p = this.gameState.profile;
    const avgTxt = p.average !== null ? `${p.average.toFixed(1)}/20` : 'pas encore de note';
    const extraHtml = `
      <div class="teacher-tp-grid">
        ${TP_CATALOG.map((tp) => {
          const grade = p.grades?.[tp.id];
          const ok = typeof grade === 'number' && grade >= 10;
          return `
            <div class="teacher-tp-item ${ok ? 'done' : ''}">
              <span>${tp.icon} ${tp.shortTitle}</span>
              <span class="tp-grade-pill">${typeof grade === 'number' ? `${grade.toFixed(1)}/20` : 'À faire'}</span>
            </div>`;
        }).join('')}
      </div>
    `;

    this._playNode({
      lines: [
        `« Voyons ton carnet de notes… Tu as validé ${p.completedCount || 0} TP(s) sur 5, avec une moyenne actuelle de ${avgTxt}. »`,
        '« N’oublie pas que tu peux refaire n’importe quel TP pour monter ta moyenne et viser la Mention Très Bien ! »'
      ],
      extraHtml,
      choices: [
        {
          label: '↩️ Continuer à discuter avec le Professeur CIEL',
          action: () => this._startMainConversation()
        },
        {
          label: '👍 « Compris, je m’y remets ! »',
          primary: true,
          action: () => this.close()
        }
      ]
    });
  }

  _playNode({ lines, choices = [], extraHtml = '' }) {
    this._stopTyping();
    this.lines = lines;
    this.lineIdx = 0;
    this.pendingChoices = choices;
    this.pendingExtraHtml = extraHtml;
    this.extraEl.innerHTML = '';
    this.extraEl.classList.add('hidden');
    this.choicesEl.innerHTML = '';
    this._typeLine(0);
  }

  _typeLine(idx) {
    this._stopTyping();
    this.lineIdx = idx;
    this.fullLineText = this.lines[idx] || '';
    this.textEl.textContent = '';
    this.isTyping = true;
    this.choicesEl.innerHTML = '';
    this.stepEl.textContent = `${idx + 1} / ${this.lines.length}`;

    const isLast = idx === this.lines.length - 1;
    this.nextBtn.classList.toggle('hidden', isLast);
    this.nextBtn.textContent = 'Suivant ▶';

    let charIdx = 0;
    this.typingTimer = setInterval(() => {
      charIdx += 2;
      if (charIdx >= this.fullLineText.length) {
        this._finishCurrentLine();
      } else {
        this.textEl.textContent = this.fullLineText.slice(0, charIdx);
      }
    }, 18);
  }

  _finishCurrentLine() {
    this._stopTyping();
    this.isTyping = false;
    this.textEl.textContent = this.fullLineText;

    const isLast = this.lineIdx === this.lines.length - 1;
    if (!isLast) {
      this.nextBtn.classList.remove('hidden');
    } else {
      this.nextBtn.classList.add('hidden');
      if (this.pendingExtraHtml) {
        this.extraEl.innerHTML = this.pendingExtraHtml;
        this.extraEl.classList.remove('hidden');
      }
      this._renderChoices();
    }
  }

  _advanceOrFinishLine() {
    if (this.isTyping) {
      this._finishCurrentLine();
      return;
    }
    if (this.lineIdx < this.lines.length - 1) {
      sfx.click();
      this._typeLine(this.lineIdx + 1);
    }
  }

  _renderChoices() {
    this.choicesEl.innerHTML = '';
    this.pendingChoices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = choice.primary ? 'btn-choice primary' : 'btn-choice';
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        sfx.click();
        choice.action?.();
      });
      this.choicesEl.appendChild(btn);
    });
  }

  _stopTyping() {
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
  }

  close() {
    this._stopTyping();
    this.overlay.classList.add('hidden');
    this.onCloseCb?.();
  }
}
