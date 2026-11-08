// Rotation du téléphone : l'image du jeu suit la taille réelle de l'écran, sans se montrer dans une taille périmée.
//
// On ne se fie pas au suivi de Phaser : selon l'ordre des événements de rotation, il enregistre la nouvelle taille
// sans redimensionner l'image, puis ne voit plus aucun changement. Le jeu restait alors bloqué en largeur portrait.
import Phaser from 'phaser';

const MASQUE_MAX = 800; // ms : l'image réapparaît quoi qu'il arrive

export function setupResize(game: Phaser.Game) {
  const parent = document.getElementById('game')!;
  const aLaTaille = () => {
    const r = parent.getBoundingClientRect();
    return Math.abs(game.scale.width - r.width) <= 1 && Math.abs(game.scale.height - r.height) <= 1;
  };
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    if (aLaTaille()) return;
    game.scale.getParentBounds();
    game.scale.refresh();
  });

  // Pendant la rotation, l'image du jeu reste masquée jusqu'à ce qu'elle soit à la bonne taille.
  matchMedia('(orientation: landscape)').addEventListener('change', () => {
    document.body.classList.add('rotation');
    const debut = performance.now();
    let stables = 0;
    const attendre = () => {
      stables = aLaTaille() ? stables + 1 : 0;
      if (stables >= 3 || performance.now() - debut > MASQUE_MAX) document.body.classList.remove('rotation');
      else requestAnimationFrame(attendre);
    };
    requestAnimationFrame(attendre);
  });
}
