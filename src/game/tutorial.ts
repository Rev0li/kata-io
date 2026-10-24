// Étapes du mini-tutoriel et exercices courts proposés à chaque nouvelle technique.
// Un exercice se joue contre le mannequin, sur le petit dojo, sans manches ni défaite.
export type StepKind = 'move' | 'hit' | 'avoid' | 'parry' | 'red' | 'chain2' | 'chain3' | 'elan' | 'dragon' | 'ko';
export interface TutoStep {
  kind: StepKind; goal: number; text: string; touch?: string;
  dummy: 'idle' | 'white'; dummyPct?: number; marker?: { x: number; y: number; r: number };
  me?: [number, number]; foe?: [number, number]; qi?: number;
}

export const MINI_TUTO: TutoStep[] = [
  { kind: 'move', goal: 1, dummy: 'idle', text: 'Déplace-toi jusqu’au cercle : ZQSD ou flèches', touch: 'Déplace-toi jusqu’au cercle avec le joystick', marker: { x: -30, y: 130, r: 34 }, me: [-140, -40], foe: [90, 0] },
  { kind: 'hit', goal: 3, dummy: 'idle', text: 'Frappe le mannequin : clic gauche ou J', touch: 'Frappe le mannequin : bouton Frapper' },
  { kind: 'avoid', goal: 2, dummy: 'white', text: 'Il attaque ! Esquive au moment du coup : Espace', touch: 'Il attaque ! Esquive au moment du coup : bouton Esquive' },
  { kind: 'ko', goal: 1, dummy: 'idle', dummyPct: 130, text: 'Il est à 130 %. Pousse-le vers le bord et envoie-le à l’eau !', me: [40, 0], foe: [140, 0] },
];

export const DRILLS: Record<string, TutoStep[]> = {
  chain2: [{ kind: 'chain2', goal: 2, dummy: 'idle', text: 'Enchaîne deux coups : appuie deux fois sur Frapper' }],
  parry: [{ kind: 'parry', goal: 2, dummy: 'white', text: 'Il frappe en blanc : pare juste avant l’impact (clic droit ou K)', touch: 'Il frappe en blanc : bouton Parer juste avant l’impact' }],
  charge: [{ kind: 'red', goal: 2, dummy: 'idle', text: 'Maintiens Frapper pour charger, puis relâche sur le mannequin' }],
  chain3: [{ kind: 'chain3', goal: 1, dummy: 'idle', text: 'Place le finisseur : trois coups de suite' }],
  elan: [{ kind: 'elan', goal: 1, dummy: 'white', text: 'Esquive au tout dernier moment, quand le coup arrive' }],
  dragon: [{ kind: 'dragon', goal: 1, dummy: 'idle', qi: 100, dummyPct: 60, text: 'Ton qi est plein : un coup chargé lance la paume du dragon' }],
};
