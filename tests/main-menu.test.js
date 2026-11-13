import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { BATTLE_PASS_TIERS, PIGEON_TROLL_COPY } from '../src/ui/BattlePassModal.js';

test('Passe de Combat Saison 1 contient exactement 10 paliers légendaires dont le palier ultime Admin', () => {
  assert.equal(BATTLE_PASS_TIERS.length, 10);
  assert.equal(BATTLE_PASS_TIERS[0].tier, 1);
  assert.ok(BATTLE_PASS_TIERS[0].name.includes('Hackeur Matrix'));
  assert.ok(BATTLE_PASS_TIERS[1].name.includes('Casque VR Or Massif 24 Carats'));
  assert.ok(BATTLE_PASS_TIERS[2].name.includes('Roi de la Brasure U301'));
  assert.ok(BATTLE_PASS_TIERS[3].name.includes('Ingénieur Réseau RGB'));
  assert.ok(BATTLE_PASS_TIERS[4].name.includes('Fers à souder auto-guidés'));
  assert.ok(BATTLE_PASS_TIERS[5].name.includes('Cyborg RTX 5090 Ti'));
  assert.ok(BATTLE_PASS_TIERS[6].name.includes('Clé de la Baie Serveur (Chambre)'));
  assert.ok(BATTLE_PASS_TIERS[7].name.includes('20/20 garanti à tous les TPs'));
  assert.ok(BATTLE_PASS_TIERS[8].name.includes('Boss Final CIEL'));
  assert.equal(BATTLE_PASS_TIERS[9].tier, 10);
  assert.equal(BATTLE_PASS_TIERS[9].ultimate, true);
  assert.ok(BATTLE_PASS_TIERS[9].name.includes('PERM ADMIN COMPLÈTE'));
});

test('La modale parodique Passe de Combat affiche le message exact du pigeon', () => {
  assert.equal(PIGEON_TROLL_COPY.icon, '🐦');
  assert.equal(PIGEON_TROLL_COPY.title, "T'est un pigeon");
  assert.ok(PIGEON_TROLL_COPY.subtitle.includes('10 €'));
  assert.ok(PIGEON_TROLL_COPY.subtitle.includes('salle U300'));
  assert.equal(PIGEON_TROLL_COPY.closeLabel, 'Rouuu-rouuu, j’ai compris');
});

test('index.html expose la structure AAA complète du Menu Principal et du Passe de Combat', () => {
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
    'bp-track-list',
    'pigeon-troll-modal',
    'pigeon-troll-title'
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `ID manquant dans index.html: ${id}`);
  }
  assert.ok(html.includes("T'est un pigeon"));
});
