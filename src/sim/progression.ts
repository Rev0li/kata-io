// Progression : ceintures, techniques débloquées, étages de la Tour du temple.
// Aucune dépendance au DOM : ces règles serviront aussi côté serveur.
import { Look, Deck, DEFAULT_DECK, randDeck } from './data';

/* ---------- techniques ---------- */
export interface Abil { chain: number; parry: boolean; charge: boolean; elan: boolean; dragon: boolean }
export const FULL_ABIL: Abil = { chain: 3, parry: true, charge: true, elan: true, dragon: true };
export const BASE_ABIL: Abil = { chain: 1, parry: false, charge: false, elan: false, dragon: false };

export interface Rank { name: string; belt: string; xp: number; unlock: null | { key: keyof Abil | 'chain2' | 'chain3'; title: string; text: string; how: string } }
export const RANKS: Rank[] = [
  { name: 'Ceinture blanche', belt: '#efe8da', xp: 0, unlock: null },
  { name: 'Ceinture jaune', belt: '#e8c64a', xp: 100, unlock: { key: 'chain2', title: 'Enchaînement', text: 'Frappe deux fois de suite : le deuxième coup part dans la foulée.', how: 'Appuie deux fois sur Frapper.' } },
  { name: 'Ceinture orange', belt: '#e48a3a', xp: 250, unlock: { key: 'parry', title: 'Parade', text: 'Pare juste avant l’impact d’un coup blanc : l’attaquant reste étourdi.', how: 'Clic droit, K, ou le bouton Parer.' } },
  { name: 'Ceinture verte', belt: '#5aa86a', xp: 450, unlock: { key: 'charge', title: 'Coup chargé', text: 'Maintiens Frapper pour charger un coup rouge. Il traverse la parade et projette loin.', how: 'Maintiens Frapper, puis relâche.' } },
  { name: 'Ceinture bleue', belt: '#4f86c6', xp: 700, unlock: { key: 'chain3', title: 'Finisseur', text: 'Un troisième coup termine la chaîne et projette 35 % plus loin.', how: 'Appuie trois fois sur Frapper.' } },
  { name: 'Ceinture marron', belt: '#7a4a2a', xp: 1000, unlock: { key: 'elan', title: 'Élan', text: 'Une esquive au dernier moment te rend ton souffle, et ton coup suivant projette 40 % plus loin.', how: 'Esquive pile quand le coup arrive.' } },
  { name: 'Ceinture noire', belt: '#151515', xp: 1400, unlock: { key: 'dragon', title: 'Paume du dragon', text: 'Ton qi se remplit en touchant et en parant. Plein, ton prochain coup chargé devient dévastateur.', how: 'Qi plein, puis coup chargé.' } },
];
export function rankIndex(xp: number) { let r = 0; RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; }
export function abilFor(rank: number): Abil {
  const a: Abil = { ...BASE_ABIL };
  for (let i = 1; i <= rank && i < RANKS.length; i++) {
    const k = RANKS[i].unlock!.key;
    if (k === 'chain2') a.chain = Math.max(a.chain, 2);
    else if (k === 'chain3') a.chain = 3;
    else (a as any)[k] = true;
  }
  return a;
}
export function rankProgress(xp: number) {
  const i = rankIndex(xp), cur = RANKS[i], next = RANKS[i + 1] || null;
  return { i, cur, next, frac: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

/* ---------- Tour du temple ---------- */
export interface Floor { n: number; name: string; skill: number; tier: number; firstTo: number; H: number; damp: number; twist: string; boss: boolean; look: Look; deck: Deck; par: number }
const FLOORS: Omit<Floor, 'n' | 'deck' | 'par'>[] = [
  { name: 'Le gardien de la porte', skill: 0.12, tier: 0, firstTo: 2, H: 234, damp: 3.2, twist: '', boss: false, look: { tenue: 'gi-ecru', masque: 'aucun', trainee: 'aucune', ejection: 'plouf' } },
  { name: 'Le moine distrait', skill: 0.16, tier: 0, firstTo: 2, H: 234, damp: 3.2, twist: '', boss: false, look: { tenue: 'brume', masque: 'bandeau', trainee: 'aucune', ejection: 'plouf' } },
  { name: 'La sentinelle', skill: 0.26, tier: 1, firstTo: 2, H: 234, damp: 3.2, twist: '', boss: false, look: { tenue: 'gi-encre', masque: 'corbeau', trainee: 'aucune', ejection: 'plouf' } },
  { name: 'Le batelier', skill: 0.3, tier: 1, firstTo: 2, H: 208, damp: 3.2, twist: 'Petit radeau : le bord est tout près', boss: false, look: { tenue: 'robe-jade', masque: 'lune', trainee: 'jade-t', ejection: 'plouf' } },
  { name: 'Maître Kenji', skill: 0.36, tier: 2, firstTo: 3, H: 260, damp: 3.2, twist: 'Gardien de la ceinture orange : il pare', boss: true, look: { tenue: 'laque', masque: 'oni', trainee: 'braise', ejection: 'feu' } },
  { name: 'La danseuse', skill: 0.4, tier: 2, firstTo: 2, H: 260, damp: 2.6, twist: 'Tatami mouillé : on glisse plus loin', boss: false, look: { tenue: 'kimono-pourpre', masque: 'kitsune', trainee: 'aurore', ejection: 'petales' } },
  { name: 'Le forgeron', skill: 0.46, tier: 3, firstTo: 2, H: 260, damp: 3.2, twist: 'Il charge ses coups : esquive le rouge', boss: false, look: { tenue: 'laque', masque: 'aucun', trainee: 'braise', ejection: 'feu' } },
  { name: 'L’ombre', skill: 0.52, tier: 3, firstTo: 2, H: 234, damp: 3.2, twist: '', boss: false, look: { tenue: 'gi-encre', masque: 'corbeau', trainee: 'encre', ejection: 'encre-e' } },
  { name: 'Le tigre blanc', skill: 0.58, tier: 4, firstTo: 3, H: 260, damp: 3.2, twist: '', boss: false, look: { tenue: 'gi-ecru', masque: 'cerf', trainee: 'aucune', ejection: 'petales' } },
  { name: 'La grande prêtresse', skill: 0.66, tier: 5, firstTo: 3, H: 234, damp: 2.8, twist: 'Gardienne de la ceinture marron', boss: true, look: { tenue: 'soie-or', masque: 'couronne', trainee: 'aurore', ejection: 'petales' } },
  { name: 'Le dragon de jade', skill: 0.75, tier: 6, firstTo: 3, H: 260, damp: 3.2, twist: 'Son qi se remplit vite', boss: false, look: { tenue: 'robe-jade', masque: 'oni', trainee: 'jade-t', ejection: 'canards' } },
  { name: 'Le maître du temple', skill: 0.85, tier: 6, firstTo: 3, H: 260, damp: 3.2, twist: 'Le dernier gardien', boss: true, look: { tenue: 'nuit', masque: 'couronne', trainee: 'aurore', ejection: 'canards' } },
];
export const TOWER_LEN = FLOORS.length;
function seeded(n: number) { let h = (n * 2654435761) >>> 0; return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
export function towerFloor(n: number): Floor {
  if (n <= FLOORS.length) {
    const f = FLOORS[n - 1];
    // Les huit premiers gardiens ont les mêmes enchaînements que le joueur : la difficulté vient du niveau, pas de la portée.
    return { ...f, n, deck: n <= 8 ? DEFAULT_DECK : randDeck(seeded(n)), par: f.firstTo === 3 ? 75 : 50 };
  }
  // Tour infinie : au-delà du dernier gardien, des adversaires générés, de plus en plus coriaces.
  const rnd = seeded(n), twists = [['', 260, 3.2], ['Petit radeau : le bord est tout près', 208, 3.2], ['Tatami mouillé : on glisse plus loin', 260, 2.6]] as const;
  const tw = twists[(rnd() * twists.length) | 0];
  const tenues = ['gi-ecru', 'gi-encre', 'kimono-pourpre', 'robe-jade', 'laque', 'brume', 'soie-or', 'nuit'], masques = ['aucun', 'bandeau', 'kitsune', 'corbeau', 'lune', 'oni', 'cerf', 'couronne'];
  return { n, name: 'Ombre de l’étage ' + n, skill: Math.min(0.95, 0.86 + (n - FLOORS.length) * 0.005), tier: 6, firstTo: 3, H: tw[1], damp: tw[2], twist: tw[0], boss: n % 5 === 0, look: { tenue: tenues[(rnd() * 8) | 0], masque: masques[(rnd() * 8) | 0], trainee: 'aurore', ejection: 'canards' }, deck: randDeck(rnd), par: 75 };
}
// Étoiles : 1 pour la victoire, 2 sans perdre de manche, 3 sans perdre de manche et sous le temps de référence.
export function starsFor(won: boolean, roundsLost: number, seconds: number, par: number) { if (!won) return 0; if (roundsLost > 0) return 1; return seconds <= par ? 3 : 2; }
export function towerXp(floor: number, won: boolean, roundsWon: number, stars: number) { return won ? 40 + floor * 15 + stars * 10 : 10 + roundsWon * 8; }
export const XP_DUEL_WIN = 60, XP_DUEL_LOSS = 20, XP_TUTO = 50, XP_PRACTICE_WIN = 25;
