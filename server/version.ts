// Version de la simulation : une empreinte des fichiers de src/sim. Le jeu (au build, vite.config.ts) et le serveur
// (au démarrage) la calculent de la même façon. Si elles diffèrent, le serveur ne pourrait pas rejouer les combats
// à l'identique : il refuse alors d'ouvrir une montée classée, le temps que les deux soient à la même version.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function versionSim(racine = process.cwd()): string {
  const dir = join(racine, 'src', 'sim'),
    h = createHash('sha256');
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.ts')) continue;
    h.update(f + '\n' + readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n') + '\n');
  }
  return h.digest('hex').slice(0, 12);
}
