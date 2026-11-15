// Audit, temps de réaction : (a) fenêtre de réaction réelle face aux coups blancs des gardiens ; (b) comment on perd ; (c) rythme des gardiens.
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import type { Input } from '../src/sim/core';
import { combatEtage } from '../src/sim/rejeu';
import { towerFloor } from '../src/sim/progression';
import { styleOf } from '../src/sim/styles';

// (a) Le joueur reste planté et pare `reac` ms après le départ de chaque coup blanc du gardien. Taux de parades réussies.
function parades(n: number, reacMs: number, N = 30) {
  let ok = 0,
    touche = 0,
    vus = 0,
    rouges = 0,
    blancs = 0,
    tAvert = 0,
    nAvert = 0;
  for (let k = 0; k < N; k++) {
    const { specs, opts } = combatEtage({ n, perso: 'ninja-bleu', quick: true }, n * 331 + k);
    specs[0].god = false;
    const S = createSim(specs, opts);
    let parryN = 0,
      vu = 0,
      at = -1,
      fin = false;
    for (let pas = 0; pas < 60 * 40 && !fin; pas++) {
      const me = S.f[0],
        foe = S.f[1];
      me.pct = 0;
      me.souffle = 3; // on isole la question du temps de réaction
      if (foe.state === 'attack' && foe.atk && foe.atk.uid !== vu) {
        vu = foe.atk.uid;
        const d = Math.hypot(foe.x - me.x, foe.y - me.y);
        if (foe.atk.kind === 'white') {
          blancs++;
          if (d < 130) {
            at = pas + Math.round(reacMs / 16.67);
            vus++;
            tAvert += foe.atk.su;
            nAvert++;
          }
        } else rouges++;
      }
      const inp: Input = { ...emptyInput(), aim: Math.atan2(foe.y - me.y, foe.x - me.x), parryN };
      if (pas === at) inp.parryN = ++parryN;
      stepSim(S, 1 / 60, [inp, inp]);
      for (const e of drainEvents(S)) {
        if (e.t === 'parry' && e.by === 0) ok++;
        if (e.t === 'hit' && e.to === 0 && !e.red) touche++;
        if (e.t === 'end') fin = true;
      }
    }
  }
  return {
    ok,
    touche,
    vus,
    pctRouge: Math.round((100 * rouges) / Math.max(1, rouges + blancs)),
    avert: Math.round(tAvert / Math.max(1, nAvert)),
  };
}
console.log('(a) Parade en réaction : % des coups blancs du gardien réellement parés, selon le temps de réaction');
console.log('étage style      annonce   100ms 150ms 200ms 250ms 300ms   part de coups rouges');
for (const n of [1, 3, 5, 6, 8, 9, 11, 12, 20]) {
  const f = towerFloor(n);
  const r = [100, 150, 200, 250, 300].map(ms => parades(n, ms));
  console.log(
    `${String(n).padStart(4)}  ${styleOf(f.look.perso).name.padEnd(10)} ${String(r[0].avert).padStart(4)} ms  ` +
      r.map(x => (Math.round((100 * x.ok) / Math.max(1, x.vus)) + '%').padStart(5)).join(' ') +
      `      ${r[0].pctRouge} %`,
  );
}

// (c) rythme : face à un joueur immobile qui ne fait rien, en combien de temps le gardien l'éjecte, et en combien de coups
console.log('\n(c) Joueur immobile au centre : temps avant éjection, coups reçus, % au moment du dernier coup');
for (const n of [1, 3, 5, 7, 9, 12, 16, 30, 66]) {
  let t = 0,
    coups = 0,
    pct = 0,
    N = 30,
    exh = 0;
  for (let k = 0; k < N; k++) {
    const { specs, opts } = combatEtage({ n, perso: 'ninja-bleu', quick: true }, n * 97 + k);
    const S = createSim(specs, opts);
    let fin = false;
    for (let pas = 0; pas < 60 * 120 && !fin; pas++) {
      const inp = { ...emptyInput(), aim: 0 };
      stepSim(S, 1 / 60, [inp, inp]);
      for (const e of drainEvents(S)) {
        if (e.t === 'hit' && e.to === 0) coups++;
        if (e.t === 'ko' && e.to === 0) {
          pct += e.pct;
          if (e.exh) exh++;
        }
        if (e.t === 'end') fin = true;
      }
    }
    t += S.duel.fightT / 1000;
  }
  console.log(
    `étage ${String(n).padStart(3)} : ${(t / N).toFixed(1)} s, ${(coups / N).toFixed(1)} coups, éjecté à ${Math.round(pct / N)} %`,
  );
}
