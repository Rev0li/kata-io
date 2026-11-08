// Essai : rendre les styles de combat visibles (posture au repos, élan du corps, effets du coup).
// Uniquement l'affichage : la simulation ne lit rien d'ici. ?styles=0 dans l'adresse retire tout, pour comparer.
//   Équilibré  sobre, sert de référence
//   Rapide     sautille, part sans prévenir, laisse des images fantômes et des lignes de vitesse
//   Puissant   respire lourdement, s'écrase et recule avant de frapper, onde de choc au sol
//   Allonge    se balance, s'étire vers l'avant, une longue ligne montre la portée du coup
import { clamp, easeOut, lerp } from '../../sim/sim';
import { styleOf } from '../../sim/styles';
import { FIGHTER_K } from '../assets';
import type { Effects } from './effects';

const ACTIF = typeof location === 'undefined' || new URLSearchParams(location.search).get('styles') !== '0';
const BLEU = 0x9fe8ff,
  ORANGE = 0xff9a3c,
  JADE = 0xbff5dc;

// recul : à l'armé, fente : au coup (px avant agrandissement) ; tasse : écrasement à l'armé ; etire : allongement au coup.
const PROFILS: Record<string, { recul: number; fente: number; tasse: number; etire: number }> = {
  equilibre: { recul: 3, fente: 7, tasse: 0, etire: 0 },
  rapide: { recul: 0.5, fente: 12, tasse: 0, etire: 0.06 },
  puissant: { recul: 11, fente: 16, tasse: 0.16, etire: 0 },
  allonge: { recul: 4, fente: 5, tasse: 0, etire: 0.2 },
};

const idStyle = (e: any) => styleOf(e.look?.perso).id;

export interface Corps {
  avance: number; // vers où il regarde
  decale: number; // sur le côté (écran)
  saut: number; // vers le haut
  sx: number;
  sy: number;
}
// Mouvement du corps selon le style. phase : 'su' (armé), 'ac' (coup), 'rc' (récupération), '' hors d'un coup.
export function corpsDuStyle(
  e: any,
  phase: string,
  auRepos: boolean,
  time: number,
  i: number,
  horizontal: boolean,
): Corps {
  const c: Corps = { avance: 0, decale: 0, saut: 0, sx: 1, sy: 1 };
  if (!ACTIF) return c;
  const id = idStyle(e);
  if (auRepos) {
    if (id === 'rapide') c.saut = Math.abs(Math.sin(time * 0.012 + i)) * 2.6 * FIGHTER_K;
    else if (id === 'puissant') {
      const b = Math.sin(time * 0.0032 + i) * 0.035;
      c.sx = 1.04 + b;
      c.sy = 0.98 - b;
    } else if (id === 'allonge') {
      c.decale = Math.sin(time * 0.0042 + i) * 2.4 * FIGHTER_K;
      c.sy = 1.02;
    } else c.sy = 1 + Math.sin(time * 0.005 + i) * 0.012;
    return c;
  }
  if (!phase) return c;
  const a = e.atk,
    P = PROFILS[id],
    k = a.kind === 'red' ? 1.4 : 1;
  if (phase === 'su') {
    const p = clamp(a.t / a.su, 0, 1);
    c.avance = -P.recul * k * easeOut(p) * FIGHTER_K;
    c.sx = 1 + P.tasse * k * p;
    c.sy = 1 - P.tasse * k * p;
  } else if (phase === 'ac') {
    const p = clamp((a.t - a.su) / a.ac, 0, 1);
    c.avance = lerp(-P.recul, P.fente, easeOut(Math.min(1, p * 2.4))) * k * FIGHTER_K;
    if (horizontal) c.sx = 1 + P.etire * k;
    else c.sy = 1 + P.etire * k;
  } else {
    const p = clamp((a.t - a.su - a.ac) / a.rc, 0, 1);
    c.avance = P.fente * k * (1 - easeOut(p)) * FIGHTER_K;
  }
  return c;
}

// Couleur des images fantômes pendant le coup, pour les styles qui en laissent.
export function fantomeDuStyle(e: any, phase: string): number | null {
  return ACTIF && (phase === 'su' || phase === 'ac') && idStyle(e) === 'rapide' ? BLEU : null;
}

// Départ du coup : sol = pieds à l'écran, ang = direction à l'écran.
export function coupDuStyle(fx: Effects, e: any, sol: { x: number; y: number }, ang: number) {
  if (!ACTIF) return;
  const red = e.atk.kind === 'red',
    d = e.atk.def,
    buste = sol.y - 14 * FIGHTER_K;
  const id = idStyle(e);
  if (id === 'rapide') fx.streaks(sol.x, buste, ang, red ? 7 : 4, red ? 190 : 120, BLEU, 2.5, 170);
  else if (id === 'puissant') {
    fx.rings.push({
      x: e.x,
      y: e.y,
      r: 12,
      max: red ? 135 : 82,
      life: red ? 340 : 240,
      t: 0,
      col: ORANGE,
      w: red ? 6 : 4,
    });
    fx.fx('dust', sol.x, sol.y, 0, red ? 2.8 : 1.9, undefined, 0.85);
  } else if (id === 'allonge')
    for (const [dec, w] of [
      [0, red ? 7 : 4.5],
      [-5, 2],
      [5, 2],
    ])
      fx.slines.push({
        x: sol.x - Math.sin(ang) * dec,
        y: buste + Math.cos(ang) * dec,
        ang,
        r0: 12,
        len: d.rg * (red ? 2.1 : 1.8),
        w,
        t: 0,
        life: 250,
        col: JADE,
      });
}

// Coup qui touche : x, y = point d'impact à l'écran.
export function impactDuStyle(fx: Effects, attaquant: any, cible: any, x: number, y: number, fort: boolean) {
  if (!ACTIF) return;
  const id = idStyle(attaquant);
  if (id === 'rapide') fx.burst(x, y, fort ? 9 : 6, 10, fort ? 70 : 46, BLEU, 2.4, 170);
  else if (id === 'puissant')
    fx.rings.push({
      x: cible.x,
      y: cible.y,
      r: 10,
      max: fort ? 105 : 62,
      life: 260,
      t: 0,
      col: ORANGE,
      w: fort ? 5 : 3,
    });
}
