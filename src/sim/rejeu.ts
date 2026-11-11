// Enregistrement et rejeu d'un combat de la Tour : ce qui permet au serveur de vérifier une montée au lieu de croire
// le score envoyé (classement, D19). Aucune dépendance au DOM ni à Phaser : ce module tourne chez le joueur
// (enregistrement) et sur le serveur (rejeu).
//
// Principe : un combat est entièrement déterminé par sa graine, l'étage, le personnage du joueur et ses entrées,
// pas par pas (1/60 s). Le joueur envoie ces entrées ; le serveur refait le combat avec la même simulation et
// regarde qui gagne. Trois conditions pour que les deux côtés tombent sur le même combat :
//   1. les mêmes combattants et les mêmes options : combatEtage, utilisé des deux côtés ;
//   2. les mêmes entrées, au bit près : le déplacement est arrondi (QUANT) avant d'entrer dans la simulation, et la
//      visée n'est pas enregistrée mais recalculée à chaque pas (viser) ;
//   3. les mêmes calculs sur toutes les machines : src/sim/dmath.ts.
//
// Format des entrées : une suite d'octets en base64. Une entrée n'est écrite que quand quelque chose change :
//   [nombre de pas depuis l'entrée précédente, en varint] [mx + 127] [my + 127] [drapeaux]
//   drapeaux : bit 0 = Frapper maintenu, bit 1 = Parer pressé à ce pas, bit 2 = Esquive pressée à ce pas.
// Les emotes ne sont pas enregistrées : elles ne changent rien au combat.
import * as DM from './dmath';
import { createSim, stepSim, drainEvents, emptyInput } from './sim';
import type { Input, Sim, Spec, SimOpts } from './core';
import { DEFAULT_LOOK, PERSOS } from './data';
import { towerFloor, abilFor, FULL_ABIL, VIES, RANKS } from './progression';

export const PAS = 1 / 60;
export const QUANT = 127; // le déplacement vaut un entier de -127 à 127, divisé par 127
export const PAS_MAX = 60 * 600; // un combat ne dure pas dix minutes (mort subite à 25 s)
export const COMBATS_MAX = 400;

export interface Combat {
  n: number; // étage
  perso: string; // personnage du joueur (donc son style)
  quick: boolean; // relance sans compte à rebours
  e: string; // entrées, en base64
}

// Graine du i-ème combat d'une montée (i à partir de 0), tirée de la graine de la montée donnée par le serveur.
export const graineCombat = (graine: number, i: number) => ((graine >>> 0) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;

// Les deux combattants et les options d'un étage en version minimale : une manche, toutes les techniques pour le joueur.
// nom et apparence (traînée, plouf) ne changent rien au combat : le joueur garde les siens à l'écran.
export function combatEtage(c: { n: number; perso: string; quick: boolean }, graine: number, moi?: Partial<Spec>) {
  const f = towerFloor(c.n);
  const specs: Spec[] = [
    {
      name: 'Joueur',
      ...moi,
      look: { ...DEFAULT_LOOK, ...moi?.look, perso: c.perso },
      abil: { ...FULL_ABIL },
      god: false,
    },
    { name: f.name, look: f.look, deck: f.deck, bot: f.skill, abil: abilFor(f.tier), belt: RANKS[f.tier].belt },
  ];
  const opts: SimOpts = { firstTo: 1, H: f.H, damp: f.damp, quick: c.quick, seed: graine };
  return { specs, opts, floor: f };
}

const quant = (v: number) => Math.max(-QUANT, Math.min(QUANT, Math.round((+v || 0) * QUANT)));
// Visée automatique vers l'adversaire, recalculée à chaque pas des deux côtés (jamais enregistrée).
export function viser(S: Sim, idx: number, avant: number) {
  const me = S.f[idx],
    foe = S.f[1 - idx];
  return foe && foe.state !== 'dead' && foe.state !== 'falling' ? DM.atan2(foe.y - me.y, foe.x - me.x) : avant;
}

// État des entrées du joueur, tel qu'il entre dans la simulation à chaque pas.
class Entrees {
  mx = 0;
  my = 0;
  atk = false;
  parryN = 0;
  dodgeN = 0;
  aim = 0;
  // applique un pas (déplacement arrondi, boutons) et donne l'entrée à passer à stepSim
  pas(S: Sim, mx: number, my: number, atk: boolean, parer: boolean, esquiver: boolean): Input {
    this.mx = mx;
    this.my = my;
    this.atk = atk;
    if (parer) this.parryN++;
    if (esquiver) this.dodgeN++;
    this.aim = viser(S, 0, this.aim);
    return {
      mx: mx / QUANT,
      my: my / QUANT,
      aim: this.aim,
      atk,
      parryN: this.parryN,
      dodgeN: this.dodgeN,
      emoteN: 0,
      emote: null,
    };
  }
}

/* ---------- chez le joueur ---------- */
export class Enregistreur {
  private o: number[] = [];
  private etat = new Entrees();
  private n = 0; // pas joués
  private dernier = 0; // pas de la dernière entrée écrite
  private pParry: number;
  private pDodge: number;
  // brut : les entrées du joueur au lancement (ses compteurs d'appuis continuent d'une partie à l'autre)
  constructor(brut: Input) {
    this.pParry = brut.parryN;
    this.pDodge = brut.dodgeN;
  }
  get pasJoues() {
    return this.n;
  }
  // Un pas de simulation : note ce qui a changé et rend l'entrée exacte à passer à stepSim.
  pas(S: Sim, brut: Input): Input {
    const mx = quant(brut.mx),
      my = quant(brut.my),
      atk = !!brut.atk,
      parer = brut.parryN > this.pParry,
      esquiver = brut.dodgeN > this.pDodge;
    this.pParry = brut.parryN;
    this.pDodge = brut.dodgeN;
    const e = this.etat;
    if (mx !== e.mx || my !== e.my || atk !== e.atk || parer || esquiver) {
      let d = this.n - this.dernier;
      while (d >= 128) {
        this.o.push((d & 127) | 128);
        d >>>= 7;
      }
      this.o.push(d, mx + QUANT, my + QUANT, (atk ? 1 : 0) | (parer ? 2 : 0) | (esquiver ? 4 : 0));
      this.dernier = this.n;
    }
    this.n++;
    const inp = e.pas(S, mx, my, atk, parer, esquiver);
    // l'emote reste à l'écran chez le joueur (elle ne change rien au combat)
    inp.emoteN = brut.emoteN;
    inp.emote = brut.emote;
    return inp;
  }
  fin(): string {
    let s = '';
    for (const b of this.o) s += String.fromCharCode(b);
    return btoa(s);
  }
}

/* ---------- sur le serveur ---------- */
// Entrées décodées : pour chaque entrée, le pas où elle s'applique. null si la suite d'octets est mal formée.
function decoder(e: string): { pas: number; mx: number; my: number; f: number }[] | null {
  let bin: string;
  try {
    bin = atob(e);
  } catch {
    return null;
  }
  const out: { pas: number; mx: number; my: number; f: number }[] = [];
  let i = 0,
    pas = 0;
  while (i < bin.length) {
    let d = 0,
      dec = 0,
      b: number;
    do {
      if (i >= bin.length || dec > 21) return null;
      b = bin.charCodeAt(i++);
      d |= (b & 127) << dec;
      dec += 7;
    } while (b & 128);
    if (i + 3 > bin.length) return null;
    const mx = bin.charCodeAt(i++) - QUANT,
      my = bin.charCodeAt(i++) - QUANT,
      f = bin.charCodeAt(i++);
    if (mx > QUANT || my > QUANT || f > 7) return null;
    pas += d;
    if (pas > PAS_MAX) return null;
    out.push({ pas, mx, my, f });
  }
  return out;
}

// Rejoue un combat. null : entrées illisibles, personnage ou étage inconnu, ou combat pas terminé avec ces entrées
// (une entrée après la fin du combat est aussi refusée : l'enregistrement s'arrête au dernier coup).
export function rejouer(c: Combat, graine: number): { gagne: boolean; secondes: number; pas: number } | null {
  if (!c || !Number.isInteger(c.n) || c.n < 1 || c.n > 10000 || typeof c.perso !== 'string' || !PERSOS[c.perso])
    return null;
  if (typeof c.e !== 'string' || c.e.length > 400000) return null;
  const ent = decoder(c.e);
  if (!ent) return null;
  const { specs, opts } = combatEtage({ n: c.n, perso: c.perso, quick: !!c.quick }, graine);
  const S = createSim(specs, opts),
    etat = new Entrees(),
    bot = emptyInput();
  let k = 0;
  for (let pas = 0; pas < PAS_MAX; pas++) {
    let parer = false,
      esquiver = false,
      { mx, my, atk } = etat;
    if (k < ent.length && ent[k].pas === pas) {
      const x = ent[k++];
      mx = x.mx;
      my = x.my;
      atk = !!(x.f & 1);
      parer = !!(x.f & 2);
      esquiver = !!(x.f & 4);
    }
    stepSim(S, PAS, [etat.pas(S, mx, my, atk, parer, esquiver), bot]);
    for (const ev of drainEvents(S))
      if (ev.t === 'end') {
        if (k < ent.length) return null;
        const D = S.duel;
        return {
          gagne: ev.winner === 0,
          secondes: D && D.start != null ? Math.round((S.time - D.start) / 1000) : 0,
          pas: pas + 1,
        };
      }
  }
  return null;
}

// Vérifie une montée entière : les combats dans l'ordre, depuis l'étage 1, avec les vies de la version minimale.
// Le joueur peut s'arrêter après n'importe quel combat (« M'arrêter là »), mais pas continuer sans vie.
export type Verdict = { ok: true; etages: number; secondes: number; pas: number } | { ok: false; raison: string };
// souffler : appelée entre deux combats, pour que le serveur réponde aux autres pendant un long rejeu.
export async function verifierMontee(
  graine: number,
  combats: Combat[],
  souffler?: () => Promise<void>,
): Promise<Verdict> {
  if (!Array.isArray(combats) || !combats.length) return { ok: false, raison: 'aucun combat' };
  if (combats.length > COMBATS_MAX) return { ok: false, raison: 'trop de combats' };
  let etages = 0,
    secondes = 0,
    pas = 0,
    vies = VIES;
  for (let i = 0; i < combats.length; i++) {
    const c = combats[i];
    if (vies <= 0) return { ok: false, raison: `combat ${i + 1} : plus de vie` };
    if (!c || c.n !== etages + 1) return { ok: false, raison: `combat ${i + 1} : étage inattendu` };
    const r = rejouer(c, graineCombat(graine, i));
    if (!r) return { ok: false, raison: `combat ${i + 1} : rejeu impossible` };
    secondes += r.secondes;
    pas += r.pas;
    if (r.gagne) etages = c.n;
    else vies--;
    if (souffler) await souffler();
  }
  return { ok: true, etages, secondes, pas };
}
