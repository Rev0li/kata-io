// Vérification rapide de la simulation : des duels bot contre bot jusqu'au bout.
// Usage : npm run sim
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { randLook, LEVELS } from '../src/sim/data';

const pairs: [number, number][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [0, 2],
  [2, 0],
];
let bad = 0;
for (const [a, b] of pairs) {
  const sa = LEVELS[a].skill,
    sb = LEVELS[b].skill;
  const st = createSim([
    { name: 'A', look: randLook(), bot: sa },
    { name: 'B', look: randLook(), bot: sb },
  ]);
  const kos: number[] = [];
  let steps = 0,
    end: any = null;
  while (!end && steps < 60 * 600) {
    stepSim(st, 1 / 60, [emptyInput(), emptyInput()]);
    for (const e of drainEvents(st)) {
      if (e.t === 'ko') kos.push(e.pct);
      if (e.t === 'end') end = e;
    }
    for (const f of st.f) if (!Number.isFinite(f.x) || !Number.isFinite(f.pct)) bad++;
    steps++;
  }
  console.log(
    `${LEVELS[a].name} contre ${LEVELS[b].name} : ${end ? end.score.join(' – ') : 'pas fini'} en ${(steps / 60).toFixed(0)} s, éjections à ${kos.join(', ')} %`,
  );
}
if (bad) throw new Error('Valeurs invalides détectées : ' + bad);
