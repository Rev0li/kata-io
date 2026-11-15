// Gardiens lisibles (D20) : annonce des coups blancs et signature des gardiens de la Tour.
import { describe, it, expect } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { towerFloor, specGardien, annonceMs, ANNONCE_MIN, FULL_ABIL } from '../src/sim/progression';
import { attaque } from '../src/sim/styles';
import { DEFAULT_LOOK } from '../src/sim/data';

describe('gardiens lisibles', () => {
  it('le coup blanc le plus vif de chaque gardien part au moins en annonceMs', () => {
    for (const n of [1, 3, 6, 8, 12, 13, 20, 40, 66, 200]) {
      const f = towerFloor(n);
      let vif = Infinity;
      for (const g of f.deck.chain) for (const id of g) if (id) vif = Math.min(vif, attaque({ look: f.look }, id).su);
      expect(vif + f.annonce!).toBeGreaterThanOrEqual(annonceMs(n) - 0.5);
      expect(annonceMs(n)).toBeGreaterThanOrEqual(ANNONCE_MIN);
    }
  });
  it('l’annonce se resserre en montant', () => {
    expect(annonceMs(1)).toBeGreaterThan(annonceMs(6));
    expect(annonceMs(6)).toBeGreaterThan(annonceMs(10));
    expect(annonceMs(10)).toBeGreaterThan(annonceMs(40));
  });
  it('chaque gardien a une signature, la même à chaque visite', () => {
    for (const n of [1, 7, 12, 13, 27, 66]) {
      expect(towerFloor(n).motif!.length).toBeGreaterThan(0);
      expect(towerFloor(n).motif).toEqual(towerFloor(n).motif);
    }
  });
  it('le démarrage des coups blancs du gardien est bien allongé en combat, pas celui du joueur', () => {
    const f = towerFloor(6);
    const S = createSim([{ name: 'Joueur', look: DEFAULT_LOOK, bot: 0.4, abil: { ...FULL_ABIL } }, specGardien(f)], {
      firstTo: 1,
      H: f.H,
      damp: f.damp,
      seed: 7,
    });
    let vus = 0;
    for (let pas = 0; pas < 60 * 60; pas++) {
      stepSim(S, 1 / 60, [emptyInput(), emptyInput()]);
      const [moi, g] = S.f;
      if (g.atk && g.atk.kind === 'white') {
        expect(g.atk.su).toBeGreaterThanOrEqual(annonceMs(6) - 0.5);
        vus++;
      }
      if (moi.atk && moi.atk.kind === 'white') expect(moi.atk.su).toBe(moi.atk.def.su);
      if (drainEvents(S).some(e => e.t === 'end')) break;
    }
    expect(vus).toBeGreaterThan(0);
  });
  it('martelage puni : le premier gardien pare un joueur qui enchaîne les coups sans s’arrêter', () => {
    const f = towerFloor(1);
    let parades = 0,
      gagnes = 0;
    for (let k = 0; k < 20; k++) {
      const S = createSim([{ name: 'Joueur', look: DEFAULT_LOOK, abil: { ...FULL_ABIL } }, specGardien(f)], {
        firstTo: 1,
        H: f.H,
        damp: f.damp,
        seed: 100 + k,
        quick: true,
      });
      fin: for (let pas = 0; pas < 60 * 60; pas++) {
        const [moi, g] = S.f,
          dx = g.x - moi.x,
          dy = g.y - moi.y,
          d = Math.hypot(dx, dy) || 1;
        const inp = { ...emptyInput(), aim: Math.atan2(dy, dx), mx: d > 50 ? dx / d : 0, my: d > 50 ? dy / d : 0 };
        inp.atk = d < 110 && pas % 8 < 4;
        stepSim(S, 1 / 60, [inp, emptyInput()]);
        for (const e of drainEvents(S)) {
          if (e.t === 'parry' && e.by === 1) parades++;
          if (e.t === 'end') {
            if (e.winner === 0) gagnes++;
            break fin;
          }
        }
      }
    }
    expect(parades).toBeGreaterThan(20);
    expect(gagnes).toBeLessThan(8); // marteler ne doit plus payer, même à l'étage 1
  });
  it('le gardien suit sa signature dans l’ordre : le forgeron place un coup chargé après ses deux coups blancs', () => {
    const f = towerFloor(7); // ['b2', 'r']
    const S = createSim(
      [{ name: 'Joueur', look: DEFAULT_LOOK, dummy: true, abil: { ...FULL_ABIL }, god: true }, specGardien(f)],
      { firstTo: 1, H: f.H, damp: f.damp, seed: 3 },
    );
    const suite: string[] = [];
    let uid = 0;
    for (let pas = 0; pas < 60 * 20; pas++) {
      stepSim(S, 1 / 60, [emptyInput(), emptyInput()]);
      drainEvents(S);
      const a = S.f[1].atk;
      // compté quand le coup part vraiment : une charge commence toujours par un début de coup blanc
      if (a && a.uid !== uid && a.t >= a.su) {
        uid = a.uid;
        suite.push(a.kind === 'red' ? 'r' : 'b');
      }
    }
    expect(suite.length).toBeGreaterThanOrEqual(6);
    // jamais deux rouges d'affilée, jamais plus de deux blancs avant un rouge
    const s = suite.join('');
    expect(s).not.toMatch(/rr/);
    expect(s).not.toMatch(/bbb/);
    expect(s).toMatch(/bbr/);
  });
});
