// Mode test « invincible » : aucun coup ne porte sur le combattant et il ne tombe jamais à l'eau.
import { describe, test, expect } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { LEVELS, DEFAULT_LOOK, randDeck } from '../src/sim/data';

describe('mode invincible', () => {
  test('un bot Maître ne touche ni n’éjecte un combattant invincible', () => {
    const st = createSim(
      [
        { name: 'Invincible', look: DEFAULT_LOOK, bot: LEVELS[0].skill, god: true },
        { name: 'Maître', look: DEFAULT_LOOK, deck: randDeck(() => 0.3), bot: LEVELS[2].skill },
      ],
      { seed: 7 },
    );
    let hitsOnGod = 0,
      kosOfGod = 0;
    for (let k = 0; k < 60 * 90; k++) {
      stepSim(st, 1 / 60, [emptyInput(), emptyInput()]);
      for (const e of drainEvents(st)) {
        if (e.t === 'hit' && e.to === 0) hitsOnGod++;
        if (e.t === 'ko' && e.to === 0) kosOfGod++;
      }
    }
    expect(hitsOnGod).toBe(0);
    expect(kosOfGod).toBe(0);
    expect(st.f[0].pct).toBe(0);
    expect(st.duel.score[1]).toBe(0);
  });
});
