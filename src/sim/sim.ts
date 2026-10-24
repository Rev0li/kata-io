// Simulation autoritaire d'un duel 1 contre 1 : point d'entrée et API publique.
// Elle ne dessine rien : elle avance l'état et émet des événements (impacts, sons, textes)
// que le client affiche. Le joueur hôte la fait tourner ; l'invité ne reçoit que des instantanés.
// Aucune variable globale : chaque partie est un objet Sim indépendant (plusieurs salles possibles sur un serveur).
//
//   core.ts      types, outils, hasard à graine, événements
//   fighter.ts   création et remise en place d'un combattant
//   duel.ts      manches, mort subite, points
//   actions.ts   entrées et actions (coups, charge, parade, esquive)
//   hits.ts      résolution des coups, bord du dojo, chute, éjection
//   update.ts    avancée d'un combattant d'un pas, collisions
//   bot.ts       bot d'entraînement et mannequin
//   snapshot.ts  instantanés réseau et miroir de l'invité
import { DUEL_H, KB_DAMP, FIRST_TO, DEFAULT_DECK, cloneDeck, sanitizeLook } from './data';
import { FULL_ABIL } from './progression';
import { emptyInput, seededRng } from './core';
import type { Ev, Fighter, Input, Sim, SimOpts, Spec } from './core';
import { makeFighter, resetFighter } from './fighter';
import { duelRound, duelUpdate } from './duel';
import { applyInput } from './actions';
import { updEnt, collide } from './update';
import { newBrain, botUpdate } from './bot';

export { clamp, lerp, easeOut, angDiff, alive, emptyInput, seededRng } from './core';
export type { Ev, Fighter, Input, Sim, SimOpts, Spec } from './core';
export { resetFighter } from './fighter';
export { SUDDEN_T, SUDDEN_RATE, SUDDEN_MIN } from './duel';
export { doAction, nextWhite } from './actions';
export { setDummy } from './bot';
export { snapshot, createMirror, applySnapshot, advanceMirror } from './snapshot';

export function createSim(specs: Spec[], opts: SimOpts = {}): Sim {
  const st: Sim = {
    H: opts.H || DUEL_H,
    H0: opts.H || DUEL_H,
    damp: opts.damp || KB_DAMP,
    time: 0,
    f: [],
    ev: [],
    hitstop: 0,
    slow: 0,
    uid: 0,
    atkUid: 0,
    duel: null,
    rng: opts.seed != null ? seededRng(opts.seed) : Math.random,
  };
  specs.forEach((sp, i) => {
    const e = makeFighter(st, {
      idx: i,
      name: String(sp.name || 'Combattant').slice(0, 24),
      look: sanitizeLook(sp.look),
      deck: sp.deck ? cloneDeck(sp.deck) : cloneDeck(DEFAULT_DECK),
      abil: { ...(sp.abil || FULL_ABIL) },
      belt: sp.belt || null,
      atkSlow: sp.atkSlow || 1,
    });
    if (sp.bot != null) e.bot = newBrain(sp.bot);
    if (sp.dummy) e.bot = newBrain(0, true);
    st.f.push(e);
  });
  st.duel = {
    score: [0, 0],
    round: 0,
    phase: 'intro',
    t: 0,
    winner: -1,
    firstTo: opts.firstTo || FIRST_TO,
    start: 0,
    fightT: 0,
    sudden: false,
    mp: false,
  };
  if (opts.free) {
    st.duel.phase = 'free';
    st.f.forEach((e: Fighter, i: number) => {
      const p = (opts.pos && opts.pos[i]) || [i ? 110 : -110, 0];
      resetFighter(e, p[0], p[1]);
      e.dropT = 0;
    });
  } else duelRound(st);
  return st;
}
export function respawn(st: Sim, e: Fighter, x: number, y: number) {
  resetFighter(e, x, y);
}

// Avance la partie d'un pas (1/60 s). inputs[i] : entrées du combattant i s'il n'est pas piloté par la simulation.
export function stepSim(st: Sim, realDt: number, inputs: Input[]) {
  st.f.forEach((e: Fighter, i: number) => {
    if (!e.bot) applyInput(st, e, inputs[i] || emptyInput());
  });
  if (st.hitstop > 0) {
    st.hitstop -= realDt * 1000;
    return;
  }
  let dt = realDt;
  if (st.slow > 0) {
    st.slow -= realDt * 1000;
    dt *= 0.3;
  }
  st.time += dt * 1000;
  for (const e of st.f) if (e.bot) botUpdate(st, e, dt);
  duelUpdate(st, dt);
  for (const e of st.f) updEnt(st, e, dt);
  collide(st);
}
export function drainEvents(st: Sim): Ev[] {
  const e = st.ev;
  st.ev = [];
  return e;
}
