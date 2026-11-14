// Gardiens de la Tour : un gardien habile gère son souffle (il ne se laisse pas épuiser puis éjecter d'un coup),
// et les Ombres du haut de la Tour deviennent de plus en plus coriaces, sans plafond.
import { describe, it, expect } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { DEFAULT_LOOK } from '../src/sim/data';
import { towerFloor, abilFor, FULL_ABIL } from '../src/sim/progression';
import { lookStyle } from '../src/sim/styles';

const look = lookStyle({ ...DEFAULT_LOOK, perso: 'ninja-bleu' });
// Part du temps où le gardien de l'étage n est épuisé, face à un joueur simulé de niveau moyen.
function tempsEpuise(n: number, combats = 12) {
  const f = towerFloor(n);
  let exh = 0,
    tot = 0;
  for (let k = 0; k < combats; k++) {
    const st: any = createSim(
      [
        { name: 'J', look, bot: 0.45, abil: { ...FULL_ABIL } },
        { name: f.name, look: f.look, deck: f.deck, bot: f.skill, abil: abilFor(f.tier) },
      ],
      { firstTo: 1, H: f.H, damp: f.damp, seed: n * 1000 + k },
    );
    let fin = false,
      pas = 0;
    while (!fin && pas++ < 60 * 120) {
      stepSim(st, 1 / 60, [emptyInput(), emptyInput()]);
      if (st.f[1].souffle < 1) exh++;
      tot++;
      for (const e of drainEvents(st)) if (e.t === 'end') fin = true;
    }
  }
  return exh / tot;
}

describe('gardiens de la Tour', () => {
  it('un gardien habile reste rarement épuisé', () => {
    // avant la gestion du souffle : 15 à 23 % du temps
    expect(tempsEpuise(12)).toBeLessThan(0.1);
    expect(tempsEpuise(16)).toBeLessThan(0.1);
  });
  it('les Ombres continuent de progresser au-delà du dernier gardien', () => {
    expect(towerFloor(17).skill).toBeGreaterThan(towerFloor(16).skill);
    expect(towerFloor(66).skill).toBeGreaterThan(1.3);
  });
});
