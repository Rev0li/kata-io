// Audit : joueurs scriptés (entrées seulement, comme un humain) contre les gardiens de la Tour.
// Usage : npm run audit -- [combats par étage] [perso]
import { createSim, stepSim, drainEvents } from '../src/sim/sim';
import type { Sim, Fighter, Input } from '../src/sim/core';
import { combatEtage } from '../src/sim/rejeu';
import { attaque } from '../src/sim/styles';
import { R } from '../src/sim/data';

const N = +(process.argv[2] || 40),
  PERSO = process.argv[3] || 'ninja-bleu';
const ETAGES = [1, 3, 5, 7, 9, 11, 12, 14, 16, 20, 30, 45, 66, 100];

type Mem = Record<string, any>;
interface Ctl {
  mx: number;
  my: number;
  atk: boolean;
  parer: boolean;
  esquiver: boolean;
}
type Strat = (S: Sim, me: Fighter, foe: Fighter, m: Mem, pas: number) => Ctl;

const vers = (me: Fighter, foe: Fighter) => {
  const dx = foe.x - me.x,
    dy = foe.y - me.y,
    d = Math.hypot(dx, dy) || 1;
  return { ux: dx / d, uy: dy / d, d };
};
const portee = (me: Fighter) => {
  const hv = attaque(me, me.deck.heavy[me.stance]);
  return hv.rg + hv.lunge + R * 0.7;
};
const z: Ctl = { mx: 0, my: 0, atk: false, parer: false, esquiver: false };

// 1. Matraquage : avance et martèle Frapper.
const matraque: Strat = (S, me, foe, m, pas) => {
  const { ux, uy, d } = vers(me, foe);
  return { ...z, mx: d > 50 ? ux : 0, my: d > 50 ? uy : 0, atk: d < 110 && pas % 8 < 4 };
};
// 2. Coup chargé seul : s'approche, charge 500 ms à portée, relâche.
const charge: Strat = (S, me, foe, m) => {
  const { ux, uy, d } = vers(me, foe),
    p = portee(me);
  if (me.state === 'charge' || m.h > 0) {
    m.h = (m.h || 0) + 1;
    const lacher = m.h > 30 && d < p;
    if (lacher || m.h > 85) m.h = 0;
    return { ...z, mx: d > p - 20 ? ux : 0, my: d > p - 20 ? uy : 0, atk: m.h > 0 };
  }
  if (me.souffle >= 1.2 && d < p + 60) {
    m.h = 1;
    return { ...z, atk: true };
  }
  // sinon : tourne à distance en attendant le souffle
  const loin = d < 150 ? -1 : d > 200 ? 1 : 0;
  return { ...z, mx: ux * loin - uy * 0.6 - me.x / 400, my: uy * loin + ux * 0.6 - me.y / 400 };
};
// 3. Fuite : ne frappe jamais, tourne autour du centre loin de l'adversaire (attend la mort subite).
const fuite: Strat = (S, me, foe) => {
  const { ux, uy, d } = vers(me, foe);
  const k = d < 220 ? 1 : 0.2;
  return { ...z, mx: -ux * k - uy * 0.7 - me.x / 150, my: -uy * k + ux * 0.7 - me.y / 150 };
};
// 4. Appât : recule vers le centre en chargeant, relâche quand le gardien entre à portée. Rien d'autre.
const appat: Strat = (S, me, foe, m) => {
  const { ux, uy, d } = vers(me, foe),
    p = portee(me);
  const mx = -me.x / 200 - uy * 0.4,
    my = -me.y / 200 + ux * 0.4;
  if (me.state === 'charge' || m.h > 0) {
    m.h = (m.h || 0) + 1;
    if ((m.h > 22 && d < p - 8) || m.h > 88) {
      m.h = 0;
      return { ...z, mx, my };
    }
    return { ...z, mx, my, atk: true };
  }
  if (me.souffle >= 2 && d < 260 && me.state === 'idle') {
    m.h = 1;
    return { ...z, mx, my, atk: true };
  }
  const k = d < 170 ? 1 : 0;
  return { ...z, mx: mx - ux * k, my: my - uy * k };
};
// 5. Joueur « propre » à temps de réaction humain (reac, en pas de 1/60 s) : pare les coups blancs vus, esquive les
//    rouges, punit l'étourdissement par un coup chargé, sinon pique en 2 coups quand il a du souffle.
const propre =
  (reac: number): Strat =>
  (S, me, foe, m) => {
    const { ux, uy, d } = vers(me, foe),
      p = portee(me);
    const c: Ctl = { ...z };
    // perception retardée : ce que faisait l'adversaire il y a `reac` pas
    m.vu = m.vu || [];
    m.vu.push({ st: foe.state, uid: foe.atk?.uid ?? 0, kind: foe.atk?.kind ?? '', d });
    const v = m.vu.length > reac ? m.vu[m.vu.length - 1 - reac] : null;
    if (m.vu.length > 120) m.vu.shift();
    // il charge (annonce rouge au sol) : on attend le temps de la charge, puis on esquive de côté
    if (v && v.st === 'charge' && !m.charge && v.d < 190) {
      m.charge = true;
      m.esq = Math.max(1, Math.round(500 / 16.67) - reac);
    }
    if (foe.state !== 'charge' && v && v.st !== 'charge') m.charge = false;
    if (m.esq > 0 && --m.esq === 0 && me.souffle >= 1) return { ...c, esquiver: true, mx: -uy, my: ux };
    if (v && v.st === 'attack' && v.uid !== m.reagi && v.d < 150) {
      m.reagi = v.uid;
      if (v.kind === 'red') {
        if (me.souffle >= 1) return { ...c, esquiver: true, mx: -uy, my: ux };
      } else if (me.souffle >= 0.4) return { ...c, parer: true };
    }
    // punition : il est étourdi ou en récupération -> coup chargé court
    if (m.h > 0) {
      m.h++;
      if (m.h > 16) {
        m.h = 0;
        return c;
      }
      return { ...c, atk: true, mx: d > p - 30 ? ux : 0, my: d > p - 30 ? uy : 0 };
    }
    if (
      v &&
      (v.st === 'stun' || v.st === 'recover') &&
      foe.state !== 'idle' &&
      d < p &&
      me.souffle >= 1.4 &&
      me.state === 'idle'
    ) {
      m.h = 1;
      return { ...c, atk: true };
    }
    // pique : deux coups blancs, puis recule
    m.cd = (m.cd || 0) - 1;
    if (m.n > 0 && me.state === 'attack') {
      m.t = (m.t || 0) + 1;
      if (m.t % 10 === 5) {
        m.n--;
        return { ...c, atk: true, mx: ux, my: uy };
      }
      return { ...c, mx: ux, my: uy };
    }
    if (me.souffle >= 2.2 && m.cd <= 0) {
      if (d < 78 && me.state === 'idle') {
        m.n = 1;
        m.t = 0;
        m.cd = 70;
        return { ...c, atk: true };
      }
      return { ...c, mx: ux, my: uy };
    }
    // sinon garde la distance, vers le centre
    const k = d < 130 ? -1 : d > 180 ? 1 : 0;
    return { ...c, mx: ux * k - uy * 0.5 - me.x / 300, my: uy * k + ux * 0.5 - me.y / 300 };
  };
// 6. Chasseur d'épuisé : comme l'appât, mais ne charge que si le gardien n'a plus de souffle (il le lit dans l'état :
//    un humain le devine aux coups que le gardien vient d'enchaîner).
const chasseur: Strat = (S, me, foe, m) => {
  const { ux, uy, d } = vers(me, foe),
    p = portee(me);
  if (me.state === 'charge' || m.h > 0) {
    m.h = (m.h || 0) + 1;
    if ((m.h > 26 && d < p - 8) || m.h > 80) {
      m.h = 0;
      return { ...z, mx: ux, my: uy };
    }
    return { ...z, mx: ux, my: uy, atk: true };
  }
  if (foe.souffle < 1.1 && me.souffle >= 1 && d < p + 90 && me.state === 'idle') {
    m.h = 1;
    return { ...z, mx: ux, my: uy, atk: true };
  }
  const k = d < 150 ? -1 : d > 200 ? 1 : 0;
  return { ...z, mx: ux * k - uy * 0.6 - me.x / 250, my: uy * k + ux * 0.6 - me.y / 250 };
};

const STRATS: [string, Strat][] = [
  ['matraquage', matraque],
  ['chargé seul', charge],
  ['fuite', fuite],
  ['appât chargé', appat],
  ['chasseur épuisé', chasseur],
  ['propre 200 ms', propre(12)],
  ['propre 280 ms', propre(17)],
  ['propre 120 ms', propre(7)],
];

function combat(n: number, strat: Strat, graine: number) {
  const { specs, opts } = combatEtage({ n, perso: PERSO, quick: true }, graine);
  const S = createSim(specs, opts);
  const m: Mem = {};
  let parryN = 0,
    dodgeN = 0,
    aim = 0;
  const st = { gagne: false, s: 0, sudden: false, exhKo: false, coups: 0, recus: 0, fin: false };
  for (let pas = 0; pas < 60 * 240; pas++) {
    const me = S.f[0],
      foe = S.f[1];
    const c = S.duel.phase === 'fight' ? strat(S, me, foe, m, pas) : z;
    if (c.parer) parryN++;
    if (c.esquiver) dodgeN++;
    aim = Math.atan2(foe.y - me.y, foe.x - me.x);
    const l = Math.hypot(c.mx, c.my),
      k = l > 1 ? 1 / l : 1;
    const inp: Input = { mx: c.mx * k, my: c.my * k, aim, atk: c.atk, parryN, dodgeN, emoteN: 0, emote: null };
    stepSim(S, 1 / 60, [inp, inp]);
    for (const e of drainEvents(S)) {
      if (e.t === 'sudden') st.sudden = true;
      if (e.t === 'hit') e.by === 0 ? st.coups++ : st.recus++;
      if (e.t === 'ko') st.exhKo = !!e.exh;
      if (e.t === 'end') {
        st.gagne = e.winner === 0;
        st.fin = true;
      }
    }
    if (st.fin) {
      st.s = S.duel.fightT / 1000;
      break;
    }
  }
  if (!st.fin) st.s = 240;
  return st;
}

console.log(`Perso ${PERSO}, ${N} combats par étage. Chaque case : % de victoires (durée moyenne en s)`);
console.log('stratégie'.padEnd(18) + ETAGES.map(n => ('ét.' + n).padStart(10)).join(''));
const detail: string[] = [];
for (const [nom, s] of STRATS) {
  let ligne = nom.padEnd(18);
  let sud = 0,
    exhW = 0,
    w = 0,
    coups = 0,
    tot = 0;
  for (const n of ETAGES) {
    let g = 0,
      t = 0;
    for (let k = 0; k < N; k++) {
      const r = combat(n, s, n * 7919 + k * 31 + 5);
      if (r.gagne) {
        g++;
        w++;
        if (r.exhKo) exhW++;
        coups += r.coups;
      }
      if (r.sudden) sud++;
      t += r.s;
      tot++;
    }
    ligne += `${String(Math.round((g / N) * 100)).padStart(4)}%(${String(Math.round(t / N)).padStart(2)})`.padStart(10);
  }
  console.log(ligne);
  detail.push(
    `${nom.padEnd(18)} mort subite ${Math.round((sud / tot) * 100)} % des combats ; victoires sur gardien épuisé ${w ? Math.round((exhW / w) * 100) : 0} % ; coups portés par victoire ${w ? (coups / w).toFixed(1) : '-'}`,
  );
}
console.log('\n' + detail.join('\n'));
