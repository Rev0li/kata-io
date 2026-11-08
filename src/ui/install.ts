// Invitation à ajouter le jeu à l'écran d'accueil, pour jouer sans les barres du navigateur.
// Sur téléphone ou tablette, à chaque ouverture tant que le jeu tourne dans un navigateur ; jamais une fois lancé depuis l'icône.
//   Android : bouton « Installer » (fenêtre du système) si le navigateur le propose, sinon le chemin dans le menu.
//   iPhone et iPad : aucune fenêtre possible, on montre le chemin par « Partager ».
import { installed } from './controls';
import { $, toast } from './dom';
import { inviteCode } from './lobby';

const IOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const PARTAGE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.5 12 4l4 3.5M7 11H5v9h14v-9h-2"/></svg>';
const ETAPES = IOS
  ? [
      `Touche ${PARTAGE}<b>Partager</b> (ou <b>•••</b> puis Partager)`,
      'Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>',
    ]
  : [
      'Ouvre le menu <b>⋮</b> du navigateur',
      'Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>',
    ];

let demande: any = null; // événement beforeinstallprompt, gardé pour le bouton « Installer »

function afficherChoix() {
  $('#installOui').hidden = !demande;
  $('#installEtapes').hidden = !!demande;
}
const fermer = () => ($('#install').hidden = true);

// À écouter dès le démarrage : le navigateur peut l'envoyer avant que la pop-up ne soit ouverte.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // pas de bandeau du navigateur : c'est la pop-up qui propose
  demande = e;
  afficherChoix();
});
window.addEventListener('appinstalled', () => {
  fermer();
  toast('Kata.io est installé : ouvre-le depuis ton écran d’accueil');
});

export function ouvrirInstall() {
  if (installed || !matchMedia('(pointer: coarse)').matches || inviteCode) return;
  $('#installEtapes').innerHTML =
    ETAPES.map(e => `<li>${e}</li>`).join('') + '<li>Ouvre Kata.io depuis son <b>icône</b></li>';
  afficherChoix();
  $('#install').hidden = false;
  $('#installNon').addEventListener('click', fermer);
  $('#installOui').addEventListener('click', async () => {
    const d = demande;
    demande = null; // l'événement ne sert qu'une fois
    fermer();
    await d?.prompt();
  });
}
