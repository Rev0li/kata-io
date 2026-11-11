// Étapes du tutoriel et exercices courts proposés à chaque nouvelle technique.
// Un exercice se joue contre le mannequin, sur le petit dojo, sans manches ni défaite.
//   TUTO_COMPLET  version minimale (tout est débloqué) : toutes les techniques, une étape chacune
//   MINI_TUTO     ancienne progression : les bases, le reste vient avec les ceintures (DRILLS)
// dummy : ce que fait le mannequin ('idle' immobile, 'white' coups blancs, 'red' coups chargés).
export type StepKind =
  'move' | 'hit' | 'avoid' | 'parry' | 'red' | 'chain2' | 'chain3' | 'elan' | 'dragon' | 'souffle' | 'ko';
export interface TutoStep {
  kind: StepKind;
  goal: number;
  text: string;
  touch?: string;
  dummy: 'idle' | 'white' | 'red';
  dummyPct?: number;
  marker?: { x: number; y: number; r: number };
  me?: [number, number];
  foe?: [number, number];
  qi?: number;
}

export const MINI_TUTO: TutoStep[] = [
  {
    kind: 'move',
    goal: 1,
    dummy: 'idle',
    text: 'Déplace-toi jusqu’au cercle : ZQSD ou flèches',
    touch: 'Déplace-toi jusqu’au cercle avec le joystick',
    marker: { x: -30, y: 130, r: 34 },
    me: [-140, -40],
    foe: [90, 0],
  },
  {
    kind: 'hit',
    goal: 3,
    dummy: 'idle',
    text: 'Frappe le mannequin : clic gauche ou J',
    touch: 'Frappe le mannequin : bouton Frapper',
  },
  {
    kind: 'avoid',
    goal: 2,
    dummy: 'white',
    text: 'Il attaque ! Esquive au moment du coup : Espace',
    touch: 'Il attaque ! Esquive au moment du coup : bouton Esquive',
  },
  {
    kind: 'ko',
    goal: 1,
    dummy: 'idle',
    dummyPct: 130,
    text: 'Il fume et clignote en rouge : il est fragile. Pousse-le vers le bord et envoie-le à l’eau !',
    me: [40, 0],
    foe: [140, 0],
  },
];

export const TUTO_COMPLET: TutoStep[] = [
  MINI_TUTO[0],
  MINI_TUTO[1],
  {
    kind: 'chain3',
    goal: 1,
    dummy: 'idle',
    text: 'Enchaîne trois coups sans t’arrêter : le troisième projette plus loin',
    touch: 'Appuie trois fois sur Frapper : le troisième coup projette plus loin',
  },
  {
    kind: 'souffle',
    goal: 1,
    dummy: 'idle',
    text: 'Chaque action coûte du souffle, la barre sous toi. Vide-la (trois esquives : Espace), puis laisse-la remonter',
    touch: 'Chaque action coûte du souffle, la barre sous toi. Vide-la (trois esquives), puis laisse-la remonter',
  },
  {
    kind: 'parry',
    goal: 2,
    dummy: 'white',
    text: 'Il frappe en blanc : pare juste avant l’impact (clic droit ou K). Une parade rend du souffle',
    touch: 'Il frappe en blanc : bouton Parer juste avant l’impact. Une parade rend du souffle',
  },
  {
    kind: 'avoid',
    goal: 2,
    dummy: 'red',
    text: 'Il charge un coup rouge : la parade ne l’arrête pas. Esquive quand il frappe : Espace',
    touch: 'Il charge un coup rouge : la parade ne l’arrête pas. Esquive quand il frappe',
  },
  {
    kind: 'red',
    goal: 2,
    dummy: 'idle',
    text: 'À toi : maintiens Frapper pour charger un coup rouge, puis relâche sur le mannequin',
  },
  {
    kind: 'elan',
    goal: 1,
    dummy: 'white',
    text: 'Esquive au tout dernier moment : tu retrouves ton souffle et ton prochain coup projette plus loin',
  },
  {
    kind: 'dragon',
    goal: 1,
    dummy: 'idle',
    qi: 100,
    dummyPct: 60,
    text: 'Ton qi, la barre dorée, monte quand tu touches et quand tu pares. Il est plein : un coup chargé lance la paume du dragon',
  },
  MINI_TUTO[3],
];

export const DRILLS: Record<string, TutoStep[]> = {
  chain2: [{ kind: 'chain2', goal: 2, dummy: 'idle', text: 'Enchaîne deux coups : appuie deux fois sur Frapper' }],
  parry: [
    {
      kind: 'parry',
      goal: 2,
      dummy: 'white',
      text: 'Il frappe en blanc : pare juste avant l’impact (clic droit ou K)',
      touch: 'Il frappe en blanc : bouton Parer juste avant l’impact',
    },
  ],
  charge: [
    { kind: 'red', goal: 2, dummy: 'idle', text: 'Maintiens Frapper pour charger, puis relâche sur le mannequin' },
  ],
  chain3: [{ kind: 'chain3', goal: 1, dummy: 'idle', text: 'Place le finisseur : trois coups de suite' }],
  elan: [{ kind: 'elan', goal: 1, dummy: 'white', text: 'Esquive au tout dernier moment, quand le coup arrive' }],
  dragon: [
    {
      kind: 'dragon',
      goal: 1,
      dummy: 'idle',
      qi: 100,
      dummyPct: 60,
      text: 'Ton qi est plein : un coup chargé lance la paume du dragon',
    },
  ],
};
