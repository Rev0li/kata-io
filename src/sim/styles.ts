// Styles de combat (D16, 2026-11-06) : chaque personnage a son style, et son arme en fait partie.
// Un style = un jeu de coups (enchaînements par garde et coup chargé) et un profil qui multiplie les valeurs des
// coups (D8 : des multiplicateurs, pas de nouvelles règles).
//   vitesse  durée du démarrage, de l'action et de la récupération (moins de 1 = plus rapide)
//   allonge  portée des coups
//   force    recul donné
//   poids    recul reçu (moins de 1 = plus lourd, plus dur à éjecter)
import { WA, HA, DEFAULT_DECK, ARMES } from './data';
import type { AttackDef, Deck, Look } from './data';

export interface Style {
  id: string;
  name: string;
  desc: string;
  vitesse: number;
  allonge: number;
  force: number;
  poids: number;
  deck: Deck;
}
export const STYLES: Record<string, Style> = {
  equilibre: {
    id: 'equilibre',
    name: 'Équilibré',
    desc: 'Poings et pieds, rien à redire : le style de base.',
    vitesse: 1,
    allonge: 1,
    force: 1,
    poids: 1,
    deck: DEFAULT_DECK,
  },
  rapide: {
    id: 'rapide',
    name: 'Rapide',
    desc: 'Enchaînements courts et vifs. Frappe vite, mais pousse moins.',
    vitesse: 0.8,
    allonge: 1,
    force: 0.9,
    poids: 1,
    deck: {
      chain: [
        ['direct', 'double', 'rafale'],
        ['direct', 'coude', 'revers'],
        ['revers', 'direct', 'double'],
        ['coude', 'crochet', 'rafale'],
      ],
      heavy: ['uppercut', 'belier', 'uppercut', 'belier'],
    },
  },
  puissant: {
    id: 'puissant',
    name: 'Puissant',
    desc: 'Coups lourds, lents à partir. Éjecte loin et encaisse mieux.',
    vitesse: 1.12,
    allonge: 1,
    force: 1.15,
    poids: 0.88,
    deck: {
      chain: [
        ['paume', 'crochet', 'fouette'],
        ['genou', 'coude', 'paume'],
        ['crochet', 'genou', 'paume'],
        ['coude', 'paume', 'fouette'],
      ],
      heavy: ['hache', 'belier', 'hache', 'belier'],
    },
  },
  allonge: {
    id: 'allonge',
    name: 'Allonge',
    desc: 'Coups de pied longs et balayages : frappe de loin, mais moins fort.',
    vitesse: 1,
    allonge: 1.15,
    force: 0.95,
    poids: 1,
    deck: {
      chain: [
        ['lowkick', 'pique', 'fouette'],
        ['pique', 'lowkick', 'balayage'],
        ['direct', 'pique', 'fouette'],
        ['lowkick', 'balayage', 'pique'],
      ],
      heavy: ['faucheur', 'retourne', 'tornade', 'faucheur'],
    },
  },
};
// Style et arme de chaque personnage.
export const PERSO_STYLE: Record<string, { style: string; arme: string }> = {
  'ninja-bleu': { style: 'equilibre', arme: 'katana' },
  moine: { style: 'equilibre', arme: 'mains' },
  ronin: { style: 'equilibre', arme: 'katana' },
  'ninja-pourpre': { style: 'rapide', arme: 'sai' },
  'ninja-vert': { style: 'rapide', arme: 'mains' },
  ombre: { style: 'rapide', arme: 'katana' },
  squelette: { style: 'rapide', arme: 'sai' },
  bandit: { style: 'puissant', arme: 'massue' },
  oni: { style: 'puissant', arme: 'hache' },
  sumo: { style: 'puissant', arme: 'mains' },
  samourai: { style: 'allonge', arme: 'yari' },
  ermite: { style: 'allonge', arme: 'trident' },
  loup: { style: 'allonge', arme: 'trident' },
  shogun: { style: 'allonge', arme: 'nodachi' },
};
export const styleOf = (perso?: string): Style => STYLES[(perso && PERSO_STYLE[perso]?.style) || 'equilibre'];
export const styleDeck = (perso?: string): Deck => styleOf(perso).deck;
// L'arme suit le personnage.
export function lookStyle(l: Look): Look {
  const a = PERSO_STYLE[l.perso]?.arme;
  return a && ARMES[a] ? { ...l, arme: a } : l;
}

// Coup tel que ce combattant le porte : valeurs du coup multipliées par le profil de son style (mis en cache).
const cache = new Map<string, AttackDef>();
export function attaque(e: { look?: Look | null }, id: string): AttackDef {
  const s = styleOf(e.look?.perso),
    base = WA[id] || HA[id];
  if (!base || s.id === 'equilibre') return base;
  const k = s.id + ':' + id;
  let d = cache.get(k);
  if (!d) {
    d = {
      ...base,
      su: base.su * s.vitesse,
      ac: base.ac * s.vitesse,
      rc: base.rc * s.vitesse,
      rg: base.rg * s.allonge,
      kb: (base.kb || 1) * s.force,
    };
    cache.set(k, d);
  }
  return d;
}
