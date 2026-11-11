// Mannequin du tutoriel : en mode « red », il charge puis porte un coup rouge (étape « esquive le coup rouge »).
import { describe, test, expect } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput, setDummy } from '../src/sim/sim';
import { DEFAULT_LOOK, DEFAULT_DECK } from '../src/sim/data';
import { FULL_ABIL } from '../src/sim/progression';

function mannequin(mode: string) {
  const st = createSim(
    [
      { name: 'Joueur', look: DEFAULT_LOOK, abil: FULL_ABIL },
      { name: 'Mannequin', look: DEFAULT_LOOK, dummy: true, abil: FULL_ABIL, deck: DEFAULT_DECK },
    ],
    {
      seed: 3,
      free: true,
      pos: [
        [-40, 0],
        [40, 0],
      ],
    },
  );
  setDummy(st, 1, mode, 40, 0);
  const coups = { blancs: 0, rouges: 0 };
  let charge = false;
  for (let k = 0; k < 60 * 8; k++) {
    stepSim(st, 1 / 60, [emptyInput(), emptyInput()]);
    if (st.f[1].state === 'charge') charge = true;
    for (const e of drainEvents(st)) if (e.t === 'hit' && e.by === 1) coups[e.red ? 'rouges' : 'blancs']++;
  }
  return { ...coups, charge };
}

describe('mannequin du tutoriel', () => {
  test('immobile : il ne frappe pas', () => {
    expect(mannequin('idle')).toEqual({ blancs: 0, rouges: 0, charge: false });
  });
  test('coups blancs', () => {
    const r = mannequin('white');
    expect(r.blancs).toBeGreaterThan(0);
    expect(r.rouges).toBe(0);
  });
  test('coups chargés : il charge puis frappe en rouge, jamais en blanc', () => {
    const r = mannequin('red');
    expect(r.charge).toBe(true);
    expect(r.rouges).toBeGreaterThan(0);
    expect(r.blancs).toBe(0);
  });
});
