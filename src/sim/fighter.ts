// Combattant : création, remise en place, déplacement borné au dojo.
import { clamp } from './core';
import type { Fighter, Sim } from './core';

export function makeFighter(S: Sim, o: any): Fighter {
  return Object.assign(
    {
      id: ++S.uid,
      idx: 0,
      name: '',
      bot: null,
      look: null,
      deck: null,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 0,
      wantFacing: 0,
      move: { x: 0, y: 0 },
      pct: 0,
      souffle: 3,
      qi: 0,
      state: 'idle',
      stateT: 0,
      stunDur: 0,
      atk: null,
      combo: { stance: 0, idx: 0 },
      comboT: 0,
      stance: 0,
      buffer: null,
      bufferT: 0,
      holding: false,
      holdT: 0,
      chargeT: 0,
      chargeDef: null,
      dodge: null,
      ledge: null,
      fallT: 0,
      elanT: 0,
      kos: 0,
      lastHitBy: null,
      lastHitT: -1e9,
      lastHitDragon: false,
      spawnInv: 0,
      emote: null,
      dropT: 0,
      spam: 0,
      lastAvoid: -1,
      splashFx: 'plouf',
      koWord: 'PLOUF !',
      inPrev: { atk: false, parryN: 0, dodgeN: 0, emoteN: 0 },
    },
    o,
  );
}
export function resetFighter(e: Fighter, x: number, y: number) {
  Object.assign(e, {
    x,
    y,
    vx: 0,
    vy: 0,
    pct: 0,
    souffle: 3,
    qi: 0,
    state: 'idle',
    stateT: 0,
    atk: null,
    buffer: null,
    comboT: 0,
    holding: false,
    holdT: 0,
    ledge: null,
    dodge: null,
    fallT: 0,
    elanT: 0,
    spawnInv: 0,
    lastHitBy: null,
    lastHitT: -1e9,
    emote: null,
    spam: 0,
    exhHit: false,
    dropT: 500,
    stance: 0,
    chargeT: 0,
    chargeDef: null,
  });
  e.facing = e.wantFacing = x < 0 ? 0 : Math.PI;
}
export function toIdle(e: Fighter) {
  e.state = 'idle';
  e.stateT = 0;
}
// Déplacement qui ne fait pas sortir du dojo (les éjections passent par la vitesse, pas par ici).
export function moveSafe(S: Sim, e: Fighter, dx: number, dy: number) {
  const H = S.H - 6;
  e.x = clamp(e.x + dx, -H, H);
  e.y = clamp(e.y + dy, -H, H);
}
