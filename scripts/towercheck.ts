// @ts-nocheck
// Équilibrage de la Tour : un joueur moyen (bot 0,45), avec les techniques de la ceinture
// qu'il aurait à cet étage, affronte chaque gardien. Usage : npx tsx scripts/towercheck.ts
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { randLook } from '../src/sim/data';
import { towerFloor, abilFor, rankIndex, towerXp } from '../src/sim/progression';

let xp = 50; // tutoriel
const N = 30,
  PLAYER = +(process.argv[2] || 0.45);
for (let n = 1; n <= 12; n++) {
  const f = towerFloor(n),
    rank = rankIndex(xp);
  let wins = 0,
    secs = 0;
  for (let k = 0; k < N; k++) {
    const st = createSim(
      [
        { name: 'Joueur', look: randLook(), bot: PLAYER, abil: abilFor(rank) },
        { name: f.name, look: f.look, deck: f.deck, bot: f.skill, abil: abilFor(f.tier) },
      ],
      { firstTo: f.firstTo, H: f.H, damp: f.damp },
    );
    let end: any = null,
      steps = 0;
    while (!end && steps < 60 * 400) {
      stepSim(st, 1 / 60, [emptyInput(), emptyInput()]);
      for (const e of drainEvents(st)) if (e.t === 'end') end = e;
      steps++;
    }
    if (end && end.winner === 0) wins++;
    secs += steps / 60;
  }
  console.log(
    `Étage ${String(n).padStart(2)} ${f.name.padEnd(24)} ceinture joueur ${rank} / gardien ${f.tier} : ${Math.round((wins / N) * 100)} % de victoires, ${Math.round(secs / N)} s`,
  );
  xp += towerXp(n, true, f.firstTo, 2);
}
