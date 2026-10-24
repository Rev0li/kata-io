// Instantanés réseau : l'hôte compacte l'état de la partie, l'invité l'applique à sa copie locale (miroir).
import { DUEL_H, FIRST_TO, ATTACK_BY_ID, sanitizeLook } from './data';
import { FULL_ABIL } from './progression';
import type { Fighter, Sim, Spec } from './core';
import { nextWhite } from './actions';

const r1 = (v: number) => Math.round(v * 10) / 10,
  r2 = (v: number) => Math.round(v * 100) / 100;
export function snapshot(st: Sim) {
  const D = st.duel;
  return {
    tm: Math.round(st.time),
    h: r1(st.H),
    d: [D.score[0], D.score[1], D.round, D.phase, Math.round(D.fightT || 0), D.sudden ? 1 : 0, D.mp ? 1 : 0],
    f: st.f.map((e: Fighter) => {
      const a = e.atk;
      return [
        r1(e.x),
        r1(e.y),
        r2(e.facing),
        e.state,
        Math.round(e.stateT),
        e.stance,
        r1(e.pct),
        r2(e.souffle),
        Math.round(e.qi),
        Math.round(e.elanT),
        Math.round(e.spawnInv),
        Math.round(e.fallT),
        Math.round(e.dropT || 0),
        e.kos,
        Math.round(e.chargeT),
        e.chargeDef ? e.chargeDef.id : '',
        a
          ? [
              a.def.id,
              a.kind === 'red' ? 1 : 0,
              Math.round(a.t),
              Math.round(a.su),
              a.ac,
              Math.round(a.rc),
              a.startStance,
              a.dragon ? 1 : 0,
            ]
          : 0,
        e.emote ? [e.emote.id, Math.round(e.emote.t)] : 0,
        e.ledge ? [e.ledge.nx, e.ledge.ny] : 0,
        e.deck.heavy[e.stance],
        nextWhite(e).id,
      ];
    }),
  };
}
// Copie locale de l'état chez l'invité, mise à jour par les instantanés et avancée entre deux.
export function createMirror(specs: Spec[]) {
  return {
    H: DUEL_H,
    time: 0,
    duel: { score: [0, 0], round: 1, phase: 'intro', firstTo: FIRST_TO, fightT: 0, sudden: false, mp: false },
    f: specs.map((sp, i) => ({
      idx: i,
      name: sp.name,
      look: sanitizeLook(sp.look),
      belt: sp.belt || null,
      abil: { ...(sp.abil || FULL_ABIL) },
      x: i ? 110 : -110,
      y: 0,
      tx: i ? 110 : -110,
      ty: 0,
      facing: i ? Math.PI : 0,
      state: 'frozen',
      stateT: 0,
      stance: 0,
      pct: 0,
      souffle: 3,
      qi: 0,
      elanT: 0,
      spawnInv: 0,
      fallT: 0,
      dropT: 0,
      kos: 0,
      chargeT: 0,
      chargeDef: null,
      atk: null,
      emote: null,
      ledge: null,
      trail: [],
      heavyId: 'retourne',
      nextId: 'direct',
      fresh: true,
    })),
  };
}
export function applySnapshot(m: any, s: any) {
  m.time = s.tm;
  m.duel.score = [s.d[0], s.d[1]];
  m.duel.round = s.d[2];
  m.duel.phase = s.d[3];
  m.duel.fightT = s.d[4] || 0;
  m.duel.sudden = !!s.d[5];
  m.duel.mp = !!s.d[6];
  if (s.h) m.H = s.h;
  s.f.forEach((p: any[], i: number) => {
    const e = m.f[i];
    if (!e) return;
    const [
      x,
      y,
      facing,
      state,
      stateT,
      stance,
      pct,
      souffle,
      qi,
      elanT,
      spawnInv,
      fallT,
      dropT,
      kos,
      chargeT,
      chargeId,
      a,
      em,
      ledge,
      heavyId,
      nextId,
    ] = p;
    const jump = Math.hypot(x - e.x, y - e.y) > 160 || e.fresh || (state === 'frozen' && e.state !== 'frozen');
    e.tx = x;
    e.ty = y;
    if (jump) {
      e.x = x;
      e.y = y;
      e.fresh = false;
    }
    e.facing = facing;
    e.state = state;
    e.stateT = stateT;
    e.stance = stance;
    e.pct = pct;
    e.souffle = souffle;
    e.qi = qi;
    e.elanT = elanT;
    e.spawnInv = spawnInv;
    e.fallT = fallT;
    e.dropT = dropT;
    e.kos = kos;
    e.chargeT = chargeT;
    e.chargeDef = chargeId ? ATTACK_BY_ID[chargeId] : null;
    e.atk = a
      ? {
          def: ATTACK_BY_ID[a[0]],
          kind: a[1] ? 'red' : 'white',
          t: a[2],
          su: a[3],
          ac: a[4],
          rc: a[5],
          startStance: a[6],
          dragon: !!a[7],
        }
      : null;
    e.emote = em ? { id: em[0], t: em[1] } : null;
    e.ledge = ledge ? { nx: ledge[0], ny: ledge[1] } : null;
    e.heavyId = heavyId;
    e.nextId = nextId;
  });
}
export function advanceMirror(m: any, dt: number) {
  const ms = dt * 1000,
    k = 1 - Math.exp(-22 * dt);
  for (const e of m.f) {
    e.x += (e.tx - e.x) * k;
    e.y += (e.ty - e.y) * k;
    e.stateT += ms;
    if (e.atk) e.atk.t += ms;
    if (e.state === 'charge') e.chargeT += ms;
    if (e.state === 'falling') e.fallT += ms;
    if (e.emote) e.emote.t += ms;
    if (e.dropT > 0) e.dropT = Math.max(0, e.dropT - ms);
    e.elanT = Math.max(0, e.elanT - ms);
    e.spawnInv = Math.max(0, e.spawnInv - ms);
  }
}
