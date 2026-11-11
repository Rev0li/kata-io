// Équilibrage de la montée de la Tour telle qu'elle se joue (version minimale, D14) : une manche par étage,
// toutes les techniques, trois vies. Un joueur simulé (bot) affronte chaque gardien, puis on en déduit jusqu'où
// il monte en moyenne. À relancer après tout changement de règles, de gardiens ou de styles.
//
// Usage : npm run tour -- [niveau du joueur, 0 à 1] [personnage] [combats par étage]
//   npm run tour                     joueur moyen (0,45), ninja bleu, 60 combats par étage
//   npm run tour -- 0.6 sumo 100     joueur fort, style puissant, mesure plus fine
// Les bots ne jouent pas comme des humains : lire les écarts entre étages et entre styles, pas les valeurs absolues.
// À 60 combats, l'incertitude est d'environ 12 points par étage.
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { DEFAULT_LOOK, PERSOS } from '../src/sim/data';
import { towerFloor, abilFor, FULL_ABIL } from '../src/sim/progression';
import { styleOf, lookStyle } from '../src/sim/styles';
import { VIES } from '../src/ui/montee';

declare const process: { argv: string[]; exit(code: number): never }; // pas de types Node dans ce projet

const JOUEUR = +(process.argv[2] || 0.45),
  PERSO = process.argv[3] || 'ninja-bleu',
  N = +(process.argv[4] || 60),
  ETAGES = 16;
if (!PERSOS[PERSO]) {
  console.error(`Personnage inconnu : ${PERSO}. Connus : ${Object.keys(PERSOS).join(', ')}`);
  process.exit(1);
}
const look = lookStyle({ ...DEFAULT_LOOK, perso: PERSO });
console.log(`Joueur simulé ${JOUEUR}, ${PERSOS[PERSO].name} (style ${styleOf(PERSO).name}), ${N} combats par étage\n`);

const p: number[] = [];
for (let n = 1; n <= ETAGES; n++) {
  const f = towerFloor(n);
  let wins = 0,
    secs = 0;
  for (let k = 0; k < N; k++) {
    const st = createSim(
      [
        { name: 'Joueur', look, bot: JOUEUR, abil: { ...FULL_ABIL } },
        { name: f.name, look: f.look, deck: f.deck, bot: f.skill, abil: abilFor(f.tier) },
      ],
      { firstTo: 1, H: f.H, damp: f.damp, seed: n * 1000 + k },
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
  p.push(wins / N);
  console.log(
    `Étage ${String(n).padStart(2)} ${f.name.padEnd(24)} niveau ${f.skill.toFixed(2)} : ` +
      `${String(Math.round((wins / N) * 100)).padStart(3)} % de victoires, ${Math.round(secs / N)} s`,
  );
}

// Étages gravis avec v vies, d'après les taux mesurés (au-delà du dernier étage mesuré, on garde son taux).
function gravis(vies: number, tirages = 20000) {
  let total = 0,
    s = 12345;
  const alea = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
  for (let k = 0; k < tirages; k++) {
    let v = vies,
      n = 0;
    while (v > 0 && n < 200) {
      if (alea() < p[Math.min(n, p.length - 1)]) n++;
      else v--;
    }
    total += n;
  }
  return total / tirages;
}
console.log(
  `\nÉtages gravis en moyenne : ${gravis(VIES).toFixed(1)} avec ${VIES} vies (${gravis(1).toFixed(1)} avec une seule)`,
);
