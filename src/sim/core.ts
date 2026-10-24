// Socle de la simulation : types, outils mathématiques, hasard et émission d'événements.
// Chaque fonction reçoit l'état de la partie (S) en paramètre : plusieurs simulations peuvent tourner en même temps.
import { TAU } from './data';
import type { Deck, Look } from './data';
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
}
export type Ev = { t: string; [k: string]: any };
export type Fighter = any;
export type Sim = any;

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
