import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { BATTLE_PASS_TIERS, PIGEON_TROLL_COPY } from '../src/ui/BattlePassModal.js';
import { buildStudentAvatarMesh, DEFAULT_SKIN } from '../src/world/AvatarBuilder.js';

test('Passe de Combat Saison 1 contient exactement 10 paliers avec modèles 3D et raretés', () => {
  assert.equal(BATTLE_PASS_TIERS.length, 10);
  assert.equal(BATTLE_PASS_TIERS[0].tier, 1);
  assert.equal(BATTLE_PASS_TIERS[0].rarity, 'rare');
  assert.ok(BATTLE_PASS_TIERS[0].name.includes('Hackeur Matrix'));
  assert.equal(BATTLE_PASS_TIERS[1].rarity, 'epic');
  assert.ok(BATTLE_PASS_TIERS[1].name.includes('Casque VR Or 24 Carats'));
  assert.ok(BATTLE_PASS_TIERS[2].name.includes('Mini-Drone Switch Cisco'));
  assert.equal(BATTLE_PASS_TIERS[3].rarity, 'legendary');
  assert.ok(BATTLE_PASS_TIERS[3].name.includes('Ingénieur Réseau RGB'));
  assert.ok(BATTLE_PASS_TIERS[4].name.includes('Roi de la Brasure U301'));
  assert.ok(BATTLE_PASS_TIERS[5].name.includes('Cyborg RTX 5090 Ti'));
  assert.ok(BATTLE_PASS_TIERS[6].name.includes('Clé Maîtresse Baie Serveur'));
  assert.equal(BATTLE_PASS_TIERS[7].rarity, 'mythic');
  assert.ok(BATTLE_PASS_TIERS[7].name.includes('Moyenne 20/20 Automatique'));
  assert.ok(BATTLE_PASS_TIERS[8].name.includes('Boss Final CIEL — Armure Diamant'));
  assert.equal(BATTLE_PASS_TIERS[9].tier, 10);
  assert.equal(BATTLE_PASS_TIERS[9].rarity, 'ultimate');
  assert.equal(BATTLE_PASS_TIERS[9].ultimate, true);
  assert.ok(BATTLE_PASS_TIERS[9].name.includes('PERM ADMIN COMPLÈTE'));
  assert.ok(BATTLE_PASS_TIERS[9].name.includes('Couronne Royale 3D'));
});

test('Tous les paliers du Passe de Combat génèrent un avatar 3D Three.js valide avec updateEffects', () => {
  for (const tier of BATTLE_PASS_TIERS) {
    assert.ok(tier.showcase, `Showcase 3D manquant sur palier ${tier.tier}`);
    const avatar = buildStudentAvatarMesh({ ...DEFAULT_SKIN, showcase: tier.showcase });
    assert.ok(avatar.group, `Groupe 3D manquant sur palier ${tier.tier}`);
    assert.ok(avatar.group.children.length >= 6, `Meshes insuffisants sur palier ${tier.tier}`);
    assert.equal(typeof avatar.updateEffects, 'function');
    avatar.updateEffects(0.5);
    avatar.updateEffects(2.5);
  }
});

test('La modale parodique Passe de Combat affiche le message exact du pigeon', () => {
  assert.equal(PIGEON_TROLL_COPY.icon, '🐦');
  assert.equal(PIGEON_TROLL_COPY.title, "T'est un pigeon");
  assert.ok(PIGEON_TROLL_COPY.subtitle.includes('10 €'));
  assert.ok(PIGEON_TROLL_COPY.subtitle.includes('salle U300'));
  assert.equal(PIGEON_TROLL_COPY.closeLabel, 'Rouuu-rouuu, j’ai compris');
});

test('index.html expose la structure AAA complète du Menu Principal et de la Vitrine 3D', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const requiredIds = [
    'start-screen',
    'nav-btn-play',
    'nav-btn-battlepass',
    'nav-btn-skin',
    'menu-btn-faq',
    'menu-btn-changelog',
    'menu-btn-platform',
    'menu-btn-settings',
    'menu-badge-name',
    'menu-badge-level',
    'menu-badge-xp-bar',
    'menu-badge-avg',
    'player-name-input',
    'menu-btn-quickplay',
    'menu-btn-battlepass',
    'start-server-status',
    'room-select',
    'rooms-list',
    'skin-preview-canvas',
    'preview-player-tag',
    'preview-player-rank',
    'battlepass-modal',
    'bp-preview-canvas',
    'bp-preview-details',
    'bp-stage-rarity',
    'bp-track-list',
    'pigeon-troll-modal',
    'pigeon-troll-title'
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `ID manquant dans index.html: ${id}`);
  }
  assert.ok(html.includes("T'est un pigeon"));
});
