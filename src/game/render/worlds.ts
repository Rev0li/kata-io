// Les quatre mondes de la Tour (docs/DIRECTION-ARTISTIQUE.md, section 5) : vue isométrique trois quarts,
// décor tout autour de la plateforme et premier plan en parallaxe. Les images sont provisoires : elles sont
// découpées dans les planches (art/decoupe, scripts/planches) et rangées dans public/assets/mondes/<monde>/.
//
// Les positions sont en pixels écran (zoom 1) par rapport au centre de la plateforme, ancrées au pied de l'image.
// La plateforme fait environ 680 × 400 px ; l'étang est une ellipse de demi-axes 600 × 280 px autour d'elle,
// décalée de 35 px vers le bas ; le décor est posé sur la rive (au fond vers y = -270, sur les côtés vers x = ±700, devant vers y = +330).

// [image « monde/nom », x, y, échelle, miroir]
export type Prop = [string, number, number, number, boolean?];
// Premier plan : [image, centre x, centre y (fractions de la demi-vue : -1 = bord gauche ou haut), hauteur (fraction de la vue), miroir]
// La taille suit la vue : le premier plan couvre la même part de l'écran sur téléphone et sur ordinateur.
export type Fore = [string, number, number, number, boolean?];

export interface WorldDef {
  name: string;
  matter: 'eau' | 'glace' | 'lave';
  ground: string; // sol de la rive
  ground2: string; // taches du sol (herbe, neige, roche)
  speck: number[]; // petites touches sur le sol : pétales, fleurs, braises
  pond: string; // eau, glace ou lave
  pond2: string; // reflets et coulées
  bank: string; // berge
  ax: number; // demi-axes de l'étang, en pixels écran
  ay: number;
  cy: number; // décalage vertical de l'étang : un peu plus d'eau devant, la rive du fond plus proche
  props: Prop[];
  decals: Prop[]; // posés à plat sur l'étang ou la glace (sous les combattants)
  fore: Fore[];
}

export const WORLDS: Record<string, WorldDef> = {
  cerisiers: {
    name: 'Le Jardin des cerisiers',
    matter: 'eau',
    ground: '#7ea35a',
    ground2: '#6b9049',
    speck: [0xf6b6cf, 0xffffff, 0xf2a0bd],
    pond: '#4fb3c2',
    pond2: '#7fd3dc',
    bank: '#c8b98c',
    ax: 600,
    ay: 280,
    cy: 35,
    props: [
      ['cerisiers/cerisier-blanc', -560, -175, 1.2],
      ['cerisiers/cerisier-rose', -330, -260, 1.2],
      ['cerisiers/lanterne-pierre', -150, -275, 0.75],
      ['cerisiers/torii-grand', 0, -290, 1.25],
      ['cerisiers/lanterne-pierre', 150, -275, 0.75, true],
      ['cerisiers/cerisier-rose-vif', 330, -265, 1.2],
      ['bambous/pagode-4-etages', 560, -190, 1.3],
      ['cerisiers/cerisier-mixte', 770, -120, 1.0],
      ['bambous/sanctuaire-b', -760, -150, 1.1],
      ['bambous/torii-moyen', -700, -10, 1.1],
      ['cerisiers/pont', 650, 25, 1.3],
      ['cerisiers/stele', 770, 120, 0.8],
      ['cerisiers/roseaux-a', -640, 95, 1.0],
      ['cerisiers/herbes-a', 610, 170, 1.1],
      ['cerisiers/lanterne-pierre', 560, 255, 0.95],
      ['cerisiers/cerisier-rose', -760, 300, 1.3],
      ['cerisiers/torii-petit', -470, 330, 1.3],
      ['cerisiers/cerisier-blanc', 760, 320, 1.3, true],
      ['cerisiers/buisson', -250, 345, 1.3],
      ['cerisiers/roseaux-b', 260, 345, 1.1],
    ],
    decals: [],
    fore: [
      ['cerisiers/cerisier-rose', -0.98, -0.95, 0.85],
      ['cerisiers/cerisier-blanc', 1.0, -0.98, 0.75, true],
      ['cerisiers/branche-moussue-b', -0.9, 0.98, 0.35],
    ],
  },
  bambous: {
    name: 'Le Jardin aux bambous',
    matter: 'eau',
    ground: '#5f7f44',
    ground2: '#4f6d38',
    speck: [0x86a85a, 0x3f5a2c],
    pond: '#3f9c94',
    pond2: '#6cc2b4',
    bank: '#8d8466',
    ax: 600,
    ay: 280,
    cy: 35,
    props: [
      ['bambous/bambous-groupe', -520, -160, 1.9],
      ['bambous/bambous-c', -380, -230, 1.9],
      ['bambous/torii-grand-a', -180, -280, 1.2],
      ['bambous/lanterne-pierre-c', -30, -285, 0.85],
      ['bambous/bambous-a', 110, -290, 1.9],
      ['bambous/pagode-3-etages', 250, -270, 1.35],
      ['bambous/bambous-groupe', 470, -190, 2.0, true],
      ['bambous/bambous-b', 620, -150, 1.9],
      ['bambous/sanctuaire-a', -740, -120, 1.2],
      ['bambous/pin-bonsai-b', -720, 40, 1.2],
      ['bambous/pont-rouge', 650, 25, 1.3],
      ['bambous/lanterne-pierre-a', -640, 150, 0.9],
      ['bambous/rochers-a', 720, 150, 1.0],
      ['bambous/bambous-c', -760, 300, 2.1],
      ['bambous/bambous-groupe', -560, 320, 2.0],
      ['bambous/lanterne-pierre-e', 560, 260, 0.95],
      ['bambous/bambous-a', 740, 320, 2.1, true],
      ['bambous/rocher-b', 300, 340, 1.1],
      ['bambous/rocher-c', -300, 345, 1.0],
    ],
    decals: [],
    fore: [
      ['bambous/bambous-groupe', -1.0, 0.45, 0.85],
      ['bambous/bambous-c', 1.0, 0.5, 0.8, true],
    ],
  },
  enneige: {
    name: 'Le Temple enneigé',
    matter: 'glace',
    ground: '#e9f1f5',
    ground2: '#d6e4ec',
    speck: [0xffffff, 0xc9dbe6],
    pond: '#9ed6dc',
    pond2: '#d6f1f3',
    bank: '#ffffff',
    ax: 600,
    ay: 280,
    cy: 35,
    props: [
      ['neige/pin-enneige-a', -380, -250, 0.95],
      ['neige/lanterne-a', -150, -275, 0.8],
      ['neige/torii-enneige-a', 0, -290, 0.8],
      ['neige/lanterne-b', 150, -275, 0.8],
      ['neige/prunier', 380, -250, 0.95],
      ['neige/bambous-enneiges', 640, -150, 0.85],
      ['neige/pin-enneige-b', -640, -130, 1.0],
      ['neige/torii-enneige-b', -700, 0, 0.8],
      ['neige/buisson-a', 680, 15, 1.1],
      ['neige/lanterne-c', 700, 150, 0.9],
      ['neige/buisson-b', -680, 150, 1.2],
      ['neige/pin-enneige-a', -760, 330, 1.1],
      ['neige/lanterne-d', -500, 300, 0.95],
      ['neige/prunier', 760, 330, 1.05, true],
      ['neige/buisson-a', 350, 345, 1.0, true],
    ],
    decals: [
      ['neige/lotus-gele', -460, -60, 1.0],
      ['neige/lotus-blanc', 450, 120, 0.9],
      ['neige/lotus-gele', 260, -175, 0.8, true],
    ],
    fore: [
      ['neige/pin-enneige-b', -0.95, -0.95, 0.7],
      ['neige/bambous-enneiges', 1.0, 0.6, 0.95],
      ['neige/flocons-a', 0.62, -0.85, 0.16],
    ],
  },
  forge: {
    name: 'La Forge des forteresses',
    matter: 'lave',
    ground: '#2b1713',
    ground2: '#3a201a',
    speck: [0xff7a2a, 0x5a3026],
    pond: '#e2561f',
    pond2: '#f6a33c',
    bank: '#150b09',
    ax: 600,
    ay: 280,
    cy: 35,
    props: [
      ['forge/tour-a', -600, -160, 1.35],
      ['forge/mur', -380, -220, 1.3],
      ['forge/banniere-noire', -250, -260, 1.2],
      ['forge/mur', -130, -280, 1.3, true],
      ['forge/banniere-rouge', 0, -295, 1.3],
      ['forge/mur', 130, -280, 1.3],
      ['forge/banniere-bleue', 250, -260, 1.2],
      ['forge/mur', 380, -220, 1.3, true],
      ['forge/tour-b', 600, -160, 1.35],
      ['forge/rochers-volcan', -720, -20, 0.9],
      ['forge/banniere-verte', -700, 130, 1.2],
      ['forge/rocher-arbre-mort', 700, 10, 1.0],
      ['forge/banniere-rose', 720, 150, 1.2],
      ['forge/arbre-mort', -600, 300, 1.3],
      ['forge/rocher-a', -330, 340, 1.2],
      ['forge/banniere-bleu-nuit', 480, 300, 1.3],
      ['forge/rochers-volcan', 760, 330, 0.85, true],
    ],
    decals: [
      ['forge/cone-volcan', -470, -90, 0.8],
      ['forge/rocher-b', 440, 170, 1.0],
      ['forge/bulle-lave', -420, 170, 0.7],
      ['forge/rocher-b', 430, -120, 0.8, true],
      ['forge/bulle-lave', 300, -175, 0.5],
    ],
    fore: [
      ['forge/tour-b', -1.06, -0.1, 0.8],
      ['forge/rochers-volcan', 1.02, 1.0, 0.7, true],
      ['forge/fumee-a', 0.92, -0.95, 0.42],
    ],
  },
};
export const WORLD_IDS = Object.keys(WORLDS); // ordre de la Tour

// Toutes les images utilisées (chargées par game/assets.ts), objets flottants compris.
export function worldImages(floats: string[]) {
  const s = new Set<string>(floats.filter(f => f.includes('/')));
  for (const w of Object.values(WORLDS)) for (const p of [...w.props, ...w.decals, ...w.fore]) s.add(p[0]);
  return [...s];
}
