// Données de jeu partagées : réglages, gardes, coups, cosmétiques.
// Aucune dépendance à Phaser ni au DOM : ce module tourne aussi côté serveur ou dans les tests.

export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;

/* ---------- réglages ---------- */
export const R = 18;
export const CELL = 104;
export const DUEL_H = 260; // demi-côté du dojo (520 unités de côté)
export const KB_DAMP = 3.2; // amortissement du recul (1/s) : distance = vitesse / 3,2
export const WHITE_KB: [number, number] = [110, 3.0]; // vitesse de recul = base + facteur × %
export const RED_KB: [number, number] = [300, 7.5];
export const TUMBLE_V = 420;
export const LEDGE_MAX = 55;
export const PARRY_WIN = 240, PARRY_PERFECT = 80, PARRY_MISS = 300;
export const DODGE_T = 300, DODGE_IF0 = 20, DODGE_IF1 = 260, DODGE_DIST = 125;
export const CHARGE_START = 120, CHARGE_FULL = 800, CHARGE_MAX = 1600;
export const SOUFFLE_REGEN = 1.3, MOVE_SPEED = 210;
export const FIRST_TO = 3;

/* ---------- gardes ---------- */
export const STANCES = [
  { code: '3/4 G', name: 'Face gauche' },
  { code: '3/4 D', name: 'Face droite' },
  { code: '1/2 G', name: 'Profil gauche' },
  { code: '1/2 D', name: 'Profil droit' },
];
export const TF: Record<string, (s: number) => number> = {
  same: s => s, mirror: s => s ^ 1, flip: s => s ^ 2, diag: s => s ^ 3,
};

/* ---------- coups ---------- */
export interface AttackDef {
  id: string; name: string; limb: 'poing' | 'pied' | 'genou';
  dmg: number; hits?: number; su: number; ac: number; rc: number;
  rg: number; arc: number; lunge: number; tf: string; kb: number; sweep?: number;
}
export const WHITES: AttackDef[] = [
  { id: 'direct', name: 'Direct', limb: 'poing', dmg: 5, su: 150, ac: 80, rc: 180, rg: 62, arc: 40, lunge: 22, tf: 'same', kb: 1 },
  { id: 'crochet', name: 'Crochet', limb: 'poing', dmg: 6, su: 180, ac: 90, rc: 200, rg: 58, arc: 100, lunge: 16, tf: 'mirror', kb: 1, sweep: 1 },
  { id: 'revers', name: 'Revers', limb: 'poing', dmg: 5, su: 165, ac: 80, rc: 190, rg: 60, arc: 90, lunge: 14, tf: 'flip', kb: 1, sweep: 1 },
  { id: 'coude', name: 'Coude', limb: 'poing', dmg: 6, su: 155, ac: 70, rc: 190, rg: 48, arc: 70, lunge: 24, tf: 'diag', kb: 1 },
  { id: 'paume', name: 'Paume du tigre', limb: 'poing', dmg: 7, su: 200, ac: 90, rc: 220, rg: 64, arc: 44, lunge: 26, tf: 'diag', kb: 1.15 },
  { id: 'double', name: 'Double frappe', limb: 'poing', dmg: 4, hits: 2, su: 170, ac: 160, rc: 210, rg: 60, arc: 40, lunge: 18, tf: 'same', kb: 1 },
  { id: 'rafale', name: 'Rafale', limb: 'poing', dmg: 3, hits: 3, su: 190, ac: 210, rc: 240, rg: 58, arc: 50, lunge: 16, tf: 'mirror', kb: 0.9 },
  { id: 'lowkick', name: 'Coup de pied bas', limb: 'pied', dmg: 6, su: 180, ac: 90, rc: 210, rg: 72, arc: 40, lunge: 12, tf: 'mirror', kb: 1 },
  { id: 'genou', name: 'Genou montant', limb: 'genou', dmg: 7, su: 190, ac: 80, rc: 210, rg: 50, arc: 50, lunge: 28, tf: 'same', kb: 0.9 },
  { id: 'fouette', name: 'Fouetté', limb: 'pied', dmg: 8, su: 240, ac: 100, rc: 260, rg: 82, arc: 120, lunge: 12, tf: 'mirror', kb: 1.2, sweep: 1 },
  { id: 'balayage', name: 'Balayage', limb: 'pied', dmg: 6, su: 230, ac: 110, rc: 260, rg: 74, arc: 160, lunge: 6, tf: 'flip', kb: 0.8, sweep: 1 },
  { id: 'pique', name: 'Pique de la grue', limb: 'pied', dmg: 6, su: 210, ac: 80, rc: 220, rg: 88, arc: 24, lunge: 14, tf: 'flip', kb: 1 },
];
export const HEAVIES: AttackDef[] = [
  { id: 'retourne', name: 'Pied retourné', limb: 'pied', dmg: 15, su: 200, ac: 100, rc: 420, rg: 84, arc: 40, lunge: 80, tf: 'flip', kb: 1 },
  { id: 'hache', name: 'Pied hache', limb: 'pied', dmg: 17, su: 230, ac: 100, rc: 440, rg: 76, arc: 44, lunge: 60, tf: 'same', kb: 1.1 },
  { id: 'uppercut', name: 'Uppercut volant', limb: 'poing', dmg: 13, su: 180, ac: 90, rc: 400, rg: 56, arc: 60, lunge: 95, tf: 'diag', kb: 1.05 },
  { id: 'belier', name: 'Coup de bélier', limb: 'poing', dmg: 12, su: 190, ac: 110, rc: 420, rg: 50, arc: 70, lunge: 120, tf: 'mirror', kb: 1.1 },
  { id: 'tornade', name: 'Tornade', limb: 'pied', dmg: 13, su: 220, ac: 160, rc: 460, rg: 70, arc: 360, lunge: 30, tf: 'mirror', kb: 0.9, sweep: 1 },
  { id: 'faucheur', name: 'Fauchage', limb: 'pied', dmg: 14, su: 210, ac: 120, rc: 430, rg: 80, arc: 150, lunge: 40, tf: 'flip', kb: 0.95, sweep: 1 },
];
export const WA: Record<string, AttackDef> = {};
export const HA: Record<string, AttackDef> = {};
WHITES.forEach(a => (WA[a.id] = a));
HEAVIES.forEach(a => (HA[a.id] = a));
export const ATTACK_BY_ID: Record<string, AttackDef> = { ...WA, ...HA };

export interface Deck { chain: (string | null)[][]; heavy: string[] }
export const DEFAULT_DECK: Deck = {
  chain: [['direct', 'crochet', 'fouette'], ['direct', 'revers', 'paume'], ['lowkick', 'coude', 'balayage'], ['genou', 'double', 'pique']],
  heavy: ['retourne', 'hache', 'belier', 'tornade'],
};
export const cloneDeck = (d: Deck): Deck => ({ chain: d.chain.map(r => r.slice()), heavy: d.heavy.slice() });
export function randDeck(rnd: () => number = Math.random): Deck {
  const w = () => WHITES[(rnd() * WHITES.length) | 0].id;
  return { chain: [0, 1, 2, 3].map(() => [w(), w(), w()]), heavy: [0, 1, 2, 3].map(() => HEAVIES[(rnd() * HEAVIES.length) | 0].id) };
}

/* ---------- apparence ---------- */
export interface Look { tenue: string; masque: string; trainee: string; ejection: string }
export const TENUES: Record<string, { name: string; body: string; trim: string; fx?: string }> = {
  'gi-ecru': { name: 'Gi écru', body: '#d6cab0', trim: '#8f826a' },
  'gi-encre': { name: "Gi d'encre", body: '#2c3236', trim: '#69737a' },
  'kimono-pourpre': { name: 'Kimono pourpre', body: '#6d2a4a', trim: '#c58aa3' },
  'robe-jade': { name: 'Robe de jade', body: '#2f7a62', trim: '#9fdcc5' },
  'laque': { name: 'Armure laquée', body: '#a8322a', trim: '#2a1612', fx: 'plates' },
  'brume': { name: 'Manteau de brume', body: '#8fa3b5', trim: '#e7eef2' },
  'soie-or': { name: "Soie d'or", body: '#c99a3a', trim: '#fff1c4', fx: 'shine' },
  'nuit': { name: 'Nuit étoilée', body: '#1b2350', trim: '#9fb3ff', fx: 'stars' },
};
export const MASQUES: Record<string, string> = {
  aucun: 'Tête nue', bandeau: 'Bandeau', kitsune: 'Kitsune', corbeau: 'Corbeau', lune: 'Croissant de lune', oni: 'Oni', cerf: 'Esprit du cerf', couronne: 'Couronne de jade',
};
export const TRAINEES: Record<string, { name: string; col: string | null }> = {
  aucune: { name: 'Traînée simple', col: null }, braise: { name: 'Braise', col: '#ff8a3d' }, 'jade-t': { name: 'Souffle de jade', col: '#62e0b5' }, encre: { name: 'Encre', col: '#050505' }, aurore: { name: 'Aurore', col: 'rainbow' },
};
export const EJECTIONS: Record<string, string> = {
  plouf: 'Plouf classique', petales: 'Pétales de cerisier', 'encre-e': "Éclaboussure d'encre", feu: "Feu d'artifice", canards: 'Canards en plastique',
};
export const EMOTES: Record<string, string> = { salut: 'Salut !', rire: 'Ha ha !', gg: 'GG', viens: 'Viens !', lent: 'Trop lent', mouille: "L'eau est bonne ?" };
export const DEFAULT_LOOK: Look = { tenue: 'gi-ecru', masque: 'bandeau', trainee: 'aucune', ejection: 'plouf' };
export function randLook(rnd: () => number = Math.random): Look {
  const p = (o: object) => { const k = Object.keys(o); return k[(rnd() * k.length) | 0]; };
  return { tenue: p(TENUES), masque: p(MASQUES), trainee: p(TRAINEES), ejection: p(EJECTIONS) };
}
export function sanitizeLook(l: any): Look {
  const o = Object.assign({}, DEFAULT_LOOK, l && typeof l === 'object' ? l : {});
  if (!TENUES[o.tenue]) o.tenue = DEFAULT_LOOK.tenue;
  if (!MASQUES[o.masque]) o.masque = DEFAULT_LOOK.masque;
  if (!TRAINEES[o.trainee]) o.trainee = DEFAULT_LOOK.trainee;
  if (!EJECTIONS[o.ejection]) o.ejection = DEFAULT_LOOK.ejection;
  return { tenue: o.tenue, masque: o.masque, trainee: o.trainee, ejection: o.ejection };
}

export const BELTS: [number, string, string][] = [[0, 'Blanche', '#efe8da'], [1, 'Jaune', '#e8c64a'], [2, 'Orange', '#e48a3a'], [3, 'Verte', '#5aa86a']];
export function beltOf(k: number) { let b = BELTS[0]; for (const x of BELTS) if (k >= x[0]) b = x; return b; }

export const LEVELS = [
  { name: 'Disciple', skill: 0.32 },
  { name: 'Adepte', skill: 0.6 },
  { name: 'Maître', skill: 0.88 },
];
export const BOT_NAMES = ['Kenji', 'Brume', 'Tigre blanc', 'Saule', 'Mei', 'Rōnin', 'Orchidée', 'Shen', 'Faucon', 'Akiko', 'Lune noire', 'Hibiki', 'Mante', 'Bambou', 'Feng', 'Tempête', 'Yuki', 'Petit Panda', 'Tofu ninja'];
