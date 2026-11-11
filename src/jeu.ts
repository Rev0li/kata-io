// Le jeu Phaser (scènes, rendu, images des combattants). Chargé à part par main.ts : l'accueil est en HTML et
// s'affiche sans attendre ce fichier, qui pèse l'essentiel du téléchargement.
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { setupResize } from './ui/resize';

export function lancerJeu() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0d2a30',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true },
    scene: [GameScene, HudScene],
  });
  setupResize(game);
  return game;
}
