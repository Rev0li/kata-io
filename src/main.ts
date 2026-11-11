// Démarrage : l'interface HTML d'abord (l'accueil s'affiche tout de suite), le jeu Phaser ensuite, chargé à part.
import { setupControls } from './ui/controls';
import { setupUI } from './ui/ui';
import { setupActionBar } from './ui/actionbar';
import { lancerBoot, voileLeve } from './ui/boot';
import { ouvrirInstall } from './ui/install';
import { session } from './net/session';
import { initAnalytics, stats, track } from './analytics';
import { toast } from './ui/dom';
import './style.css';

initAnalytics();
setupControls();
setupActionBar();
setupUI();

lancerBoot();
voileLeve.then(ouvrirInstall);

import('./jeu')
  .then(({ lancerJeu }) => {
    const game = lancerJeu();
    // Accès de débogage : en développement, ou avec ?debug dans l'adresse.
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug'))
      (window as any).__kata = { game, session, stats };
  })
  .catch(e => {
    track('error', { msg: 'jeu non chargé : ' + String(e && e.message).slice(0, 120) });
    toast('Le jeu ne s’est pas chargé : recharge la page');
  });
