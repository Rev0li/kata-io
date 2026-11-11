// Souffle rendu par les gestes réussis : l'esquive au bon moment rembourse son coût, la parade rend plus qu'elle ne coûte.
// Le joueur fait face au mannequin qui frappe en blanc et appuie à chaque délai possible après le début du coup.
import { describe, test, expect } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput, setDummy } from '../src/sim/sim';
import { DEFAULT_LOOK, DEFAULT_DECK, RULES } from '../src/sim/data';
import { FULL_ABIL } from '../src/sim/progression';

const DEPART = 2; // souffle au moment d'appuyer : loin du plafond (3), pour voir ce qui est rendu

interface Essai {
  geste: 'esquive' | 'parade' | 'parade parfaite' | 'touché' | 'rien';
  avant: number;
  apres: number;
}

function essai(touche: 'dodgeN' | 'parryN', delai: number): Essai {
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
  setDummy(st, 1, 'white', 40, 0);
  const moi = st.f[0],
    inp = emptyInput();
  let depuis = -1,
    avant = DEPART;
  for (let k = 0; k < 60 * 8; k++) {
    if (depuis < 0 && st.f[1].state === 'attack') depuis = 0;
    if (depuis === delai) {
      moi.souffle = DEPART;
      avant = moi.souffle;
      inp[touche]++;
    }
    if (depuis >= 0) depuis++;
    stepSim(st, 1 / 60, [inp, emptyInput()]);
    for (const e of drainEvents(st)) {
      if (depuis <= delai) continue;
      if (e.t === 'dodge' && e.by === 0) return { geste: 'esquive', avant, apres: moi.souffle };
      if (e.t === 'parry' && e.by === 0)
        return { geste: e.perfect ? 'parade parfaite' : 'parade', avant, apres: moi.souffle };
      if (e.t === 'hit' && e.to === 0) return { geste: 'touché', avant, apres: moi.souffle };
    }
  }
  return { geste: 'rien', avant, apres: moi.souffle };
}

const tous = (touche: 'dodgeN' | 'parryN') => Array.from({ length: 40 }, (_, d) => essai(touche, d));

describe('souffle rendu par les gestes réussis', () => {
  test('esquive au bon moment : le souffle dépensé est rendu en entier', () => {
    const reussies = tous('dodgeN').filter(r => r.geste === 'esquive');
    expect(reussies.length).toBeGreaterThan(0);
    for (const r of reussies) expect(r.apres).toBeCloseTo(r.avant, 5);
  });
  test('parade parfaite : rend un segment, plus que son coût', () => {
    const parfaites = tous('parryN').filter(r => r.geste === 'parade parfaite');
    expect(parfaites.length).toBeGreaterThan(0);
    for (const r of parfaites) {
      expect(r.apres).toBeGreaterThanOrEqual(r.avant - RULES.parryCost + RULES.parryPerfectSouffle - 1e-6);
      expect(r.apres).toBeGreaterThan(r.avant);
    }
  });
  test('parade simple : rend son coût, et un peu plus', () => {
    const simples = tous('parryN').filter(r => r.geste === 'parade');
    expect(simples.length).toBeGreaterThan(0);
    for (const r of simples) expect(r.apres).toBeGreaterThanOrEqual(r.avant);
  });
});
