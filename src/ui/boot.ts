// Voile de démarrage : l'écran reste couvert tant que l'accueil n'est pas à sa place (image de fond, polices, top 10).
// Il est dans index.html, avec son style, pour couvrir la page dès le premier affichage.
//
// L'accueil est en HTML : le voile se lève sans attendre le jeu Phaser, chargé à part (src/jeu.ts). Si le joueur
// lance une partie avant la fin de ce chargement, le voile revient jusqu'à la première image du jeu (attendreJeu).
const ATTENTE_MAX = 2500; // ms d'attente du fond et des polices : un réseau lent ne bloque pas l'accueil
const ATTENTE_TOP = 1200; // ms d'attente du top 10 (et du reste de bootAttendre)
const FILET = 12000; // ms : le voile revenu pour attendre le jeu se lève quoi qu'il arrive (WebGL absent, erreur)

const delai = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let sceneOk!: () => void;
let jeuPret = false;
const scenePrete = new Promise<void>(r => (sceneOk = r)).then(() => {
  jeuPret = true;
});
let leve!: () => void;
// Résolue quand le voile commence à se lever : ce qui change la mise en page attend ce moment, encore couvert.
export const voileLeve = new Promise<void>(r => (leve = r));

const polices = [
  '900 40px "Big Shoulders Display"',
  '800 18px "Big Shoulders Display"',
  '500 15px Barlow',
  '700 15px Barlow',
];
const fond = new Image();
fond.src = '/assets/accueil/tour.webp';
const attendus: Promise<unknown>[] = [...polices.map(p => document.fonts.load(p)), fond.decode()].map(p =>
  p.catch(() => {}),
);

const secondaires: Promise<unknown>[] = [];
export const bootAttendre = (p: Promise<unknown>) => secondaires.push(p.catch(() => {}));
// Appelée par la scène de combat à sa première image affichée, caméra en place.
export const bootScenePrete = () => sceneOk();
// L'ensō se trace au fil du chargement des images du jeu.
export function bootProgres(p: number) {
  document.querySelector<SVGElement>('#boot path')?.style.setProperty('stroke-dashoffset', String(100 * (1 - p)));
}
const voile = () => document.getElementById('boot');

export async function lancerBoot() {
  await Promise.all([
    Promise.race([Promise.all(attendus), delai(ATTENTE_MAX)]),
    Promise.race([Promise.all(secondaires), delai(ATTENTE_TOP)]),
  ]);
  leve();
  voile()?.classList.add('off');
}
// Une partie ou la vitrine du vestiaire démarre : si le jeu n'est pas encore chargé, le voile couvre l'écran
// jusqu'à sa première image. La simulation n'avance pas pendant ce temps (c'est la scène qui la fait tourner).
export async function attendreJeu() {
  if (jeuPret) return;
  voile()?.classList.remove('off');
  await Promise.race([scenePrete, delai(FILET)]);
  voile()?.classList.add('off');
}
