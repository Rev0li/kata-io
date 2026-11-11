// Tutoriel, étape « paume du dragon » : le coup réussi ne coupe pas l'éjection.
// Le mannequin tombe à l'eau, et l'étape suivante ne commence qu'à sa réapparition.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../src/analytics', () => ({ track: () => {} }));

import { session as S } from '../src/net/session';
import { TUTO_COMPLET } from '../src/game/tutorial';
import { DEFAULT_LOOK } from '../src/sim/data';
import { FULL_ABIL } from '../src/sim/progression';

const PAS = 1 / 60;

function paume(passer = false) {
  const dragon = TUTO_COMPLET.find(s => s.kind === 'dragon')!,
    fin = TUTO_COMPLET[TUTO_COMPLET.length - 1];
  const etapes: number[] = [];
  S.hooks.onTuto = (st, i, _n, count) => {
    if (st && count === 0) etapes.push(i);
  };
  S.startTuto({ name: 'Joueur', look: DEFAULT_LOOK, abil: FULL_ABIL, belt: 'blanche' }, [
    { ...dragon, me: [10, 0], foe: [80, 0] },
    fin,
  ]);
  let touche = -1,
    tombe = -1,
    suite = -1,
    etatAuTouche = '';
  for (let k = 0; k < 60 * 12 && suite < 0; k++) {
    S.input.atk = k >= 10 && k < 70; // charge à fond, puis relâche
    S.tick(PAS);
    const foe = S.sim.f[1];
    if (touche < 0 && S.tuto!.suite > 0) {
      touche = k;
      etatAuTouche = foe.state;
      if (passer) S.tutoSkipStep();
    }
    if (touche >= 0 && tombe < 0 && foe.state === 'dead') tombe = k;
    if (etapes.length > 1) suite = k;
  }
  return { touche, tombe, suite, etatAuTouche, etapes, foe: S.sim.f[1], fin };
}

describe('tutoriel : paume du dragon', () => {
  test('le mannequin tombe à l’eau avant que l’étape suivante commence', () => {
    const r = paume();
    expect(r.touche).toBeGreaterThan(0);
    expect(r.tombe).toBeGreaterThan(r.touche); // il est bien sorti
    expect(r.suite).toBeGreaterThan(r.tombe + 30); // et le plouf a le temps de se voir
    expect(r.etapes).toEqual([0, 1]);
    // réapparition : debout, fragile, à la place prévue par la dernière étape
    expect(r.foe.state).not.toBe('dead');
    expect(r.foe.pct).toBe(r.fin.dummyPct);
    expect([r.foe.x, r.foe.y]).toEqual(r.fin.foe);
  });
  test('« Étape suivante » pendant l’attente passe tout de suite à la suite', () => {
    const r = paume(true);
    expect(r.suite).toBe(r.touche);
    expect(r.etapes).toEqual([0, 1]);
  });
});
