// Voile de démarrage : l'écran reste couvert tant que l'accueil n'est pas à sa place (images, polices, caméra, top 10).
// Il est dans index.html, avec son style, pour couvrir la page dès le premier affichage.
const ATTENTE_MAX = 1200; // ms d'attente des polices et du top 10 une fois la scène prête : un réseau lent ne bloque pas le jeu
const FILET = 12000; // ms : le voile se lève quoi qu'il arrive (WebGL absent, erreur au chargement)

const delai = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let sceneOk!: () => void;
const scenePrete = new Promise<void>(r => (sceneOk = r));
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
fond.src = '/assets/accueil/tour.svg';
const attendus: Promise<unknown>[] = [...polices.map(p => document.fonts.load(p)), fond.decode()].map(p =>
  p.catch(() => {}),
);

export const bootAttendre = (p: Promise<unknown>) => attendus.push(p.catch(() => {}));
export const bootScenePrete = () => sceneOk();
// L'ensō se trace au fil du chargement.
export function bootProgres(p: number) {
  document.querySelector<SVGElement>('#boot path')?.style.setProperty('stroke-dashoffset', String(100 * (1 - p)));
}

export async function lancerBoot() {
  await Promise.race([scenePrete, delai(FILET)]);
  await Promise.race([Promise.all(attendus), delai(ATTENTE_MAX)]);
  leve();
  const voile = document.getElementById('boot');
  voile?.classList.add('off');
  setTimeout(() => voile?.remove(), 300);
}
