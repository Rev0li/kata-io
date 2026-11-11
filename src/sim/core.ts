// Socle de la simulation : types, outils mathématiques, hasard et émission d'événements.
// Chaque fonction reçoit l'état de la partie (S) en paramètre : plusieurs simulations peuvent tourner en même temps.
import { TAU } from './data';
import type { AttackDef, Deck, Look } from './data';
import type { Abil } from './progression';

export interface Input {
  mx: number;
  my: number;
  aim: number;
  atk: boolean;
  parryN: number;
  dodgeN: number;
  emoteN: number;
  emote: string | null;
}
export const emptyInput = (): Input => ({
  mx: 0,
  my: 0,
  aim: 0,
  atk: false,
  parryN: 0,
  dodgeN: 0,
  emoteN: 0,
  emote: null,
});
export interface Spec {
  name: string;
  look: Look;
  deck?: Deck;
  bot?: number | null;
  abil?: Abil;
  belt?: string;
  dummy?: boolean;
  atkSlow?: number;
  god?: boolean; // mode test : intouchable, aucun coup ne porte et il ne tombe pas à l'eau (parties locales seulement)
}
export interface SimOpts {
  firstTo?: number;
  H?: number;
  damp?: number;
  free?: boolean;
  pos?: [number, number][];
  seed?: number;
  quick?: boolean; // relance : pas de compte à rebours 3-2-1, juste « COMBAT ! »
}
// Événement émis par la simulation (impact, son, texte, point…) : le client l'affiche. Champs libres selon t.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ev = { t: string; [k: string]: any };

export type Etat =
  | 'idle'
  | 'frozen' // avant le début de la manche
  | 'attack'
  | 'charge'
  | 'parry'
  | 'recover'
  | 'dodge'
  | 'stun'
  | 'tumble' // projeté, roule
  | 'ledge' // accroché au bord
  | 'climb'
  | 'falling'
  | 'dead';
// Coup en cours : su (démarrage), ac (actif), rc (récupération), en millisecondes.
export interface Coup {
  def: AttackDef;
  kind: 'white' | 'red';
  t: number;
  su: number;
  ac: number;
  rc: number;
  seg: number; // segment en cours d'un coup à plusieurs touches
  hit: Set<number>; // identifiants déjà touchés pendant ce segment
  startStance: number;
  endStance: number;
  applied: boolean;
  uid: number;
  idx: number; // rang dans l'enchaînement (2 : finisseur)
  finisher: boolean;
  power: number;
  dragon: boolean;
}
export type Action = 'atk' | 'parry' | 'dodge';
export interface Vec {
  x: number;
  y: number;
}
// Cerveau d'un bot ou du mannequin (bot.ts).
export interface Cerveau {
  adapt: number;
  adaptShown: boolean;
  dummy: boolean;
  mode: string; // mannequin : 'idle', 'white', 'red'
  cd: number;
  ax: number;
  ay: number;
  skill: number;
  atkCd: number;
  strafe: number;
  strafeT: number;
  pref: number;
  plan: { act: 'dodge' | 'parry'; at: number } | null;
  holdFor: number;
  chain: number;
  seen: Map<number, number>; // adversaire -> dernier coup auquel il a déjà réagi
  climbAt: number | null;
  respect: number;
  waited: boolean;
}
export interface Fighter {
  id: number;
  idx: number;
  name: string;
  bot: Cerveau | null;
  look: Look;
  deck: Deck;
  abil: Abil;
  belt: string | null;
  atkSlow: number;
  god: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  wantFacing: number;
  move: Vec;
  pct: number;
  souffle: number;
  qi: number;
  state: Etat;
  stateT: number;
  stunDur: number;
  atk: Coup | null;
  combo: { stance: number; idx: number };
  comboT: number;
  stance: number;
  buffer: { type: Action; arg?: Vec } | null; // action demandée trop tôt, rejouée dès que possible
  bufferT: number;
  holding: boolean;
  holdT: number;
  chargeT: number;
  chargeDef: AttackDef | null;
  dodge: { dx: number; dy: number; done: number; ox: number; oy: number } | null;
  ledge: { nx: number; ny: number; t: number } | null;
  ledgeUsed: boolean;
  z: number;
  vz: number;
  star: boolean;
  fallT: number;
  elanT: number;
  kos: number;
  lastHitBy: number | null;
  lastHitT: number;
  lastHitDragon: boolean;
  exhHit: boolean;
  spawnInv: number;
  emote: { id: string; t: number } | null;
  dropT: number;
  spam: number;
  lastAvoid: number;
  dodgeCount?: number; // D2 : esquives parfaites d'affilée (bonus pas encore décidé)
  splashFx: string;
  koWord: string;
  inPrev: { atk: boolean; parryN: number; dodgeN: number; emoteN: number };
}
export interface Duel {
  score: [number, number];
  round: number;
  phase: 'intro' | 'fight' | 'point' | 'end' | 'free';
  t: number;
  winner: number;
  firstTo: number;
  start: number;
  fightT: number;
  sudden: boolean;
  mp: boolean; // balle de match
  quick: boolean;
}
export interface Sim {
  H: number; // demi-côté du dojo
  H0: number;
  damp: number;
  time: number;
  f: Fighter[];
  ev: Ev[];
  hitstop: number;
  slow: number;
  uid: number;
  atkUid: number;
  duel: Duel;
  rng: () => number;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const angDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const alive = (e: Fighter) => e.state !== 'dead' && e.state !== 'falling';

// Générateur à graine (mulberry32) : même graine, même suite de nombres, donc même match.
export function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Hasard de la simulation : celui de la partie en cours (graine fixe dans les tests, Math.random sinon).
export const rnd = (S: Sim): number => S.rng();
export const rand = (S: Sim, a: number, b: number) => a + rnd(S) * (b - a);
export const pick = <T>(S: Sim, arr: T[]) => arr[(rnd(S) * arr.length) | 0];

export function emit(S: Sim, o: Ev) {
  S.ev.push(o);
}
export const fx = {
  float: (S: Sim, x: number, y: number, text: string, col: string, size = 17) =>
    emit(S, { t: 'float', x, y, text, col, size }),
  sparks: (S: Sim, x: number, y: number, col: string, n: number) => emit(S, { t: 'sparks', x, y, col, n }),
  ring: (S: Sim, x: number, y: number, r: number, max: number, life: number, col: string, w: number) =>
    emit(S, { t: 'ring', x, y, r, max, life, col, w }),
  sfx: (S: Sim, n: string, x: number, y: number, v = 1) => emit(S, { t: 'sfx', n, x, y, v }),
  shake: (S: Sim, n: number) => emit(S, { t: 'shake', n }),
  big: (S: Sim, text: string, col: string, life: number) => emit(S, { t: 'big', text, col, life }),
};
