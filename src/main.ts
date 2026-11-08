import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { setupControls } from './ui/controls';
import { setupUI } from './ui/ui';
import { setupActionBar } from './ui/actionbar';
import { lancerBoot, voileLeve } from './ui/boot';
import { ouvrirInstall } from './ui/install';
import { session } from './net/session';
import { initAnalytics, stats } from './analytics';
import './style.css';

initAnalytics();
setupControls();
setupActionBar();
setupUI();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d2a30',
  // resizeInterval : la taille définitive arrive parfois après l'événement de rotation, on la revérifie vite
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight, resizeInterval: 100 },
  render: { antialias: true },
  scene: [GameScene, HudScene],
});

lancerBoot();
voileLeve.then(ouvrirInstall);

// Accès de débogage : en développement, ou avec ?debug dans l'adresse.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug'))
  (window as any).__kata = { game, session, stats };
