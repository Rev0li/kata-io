// Serveur de jeu de Kata.io (étape 1 du backend, D19) : classement vérifié par rejeu et mesures de jeu.
// Un seul processus Node derrière Caddy, sur le VPS. Lancement : npm run serveur (voir docs/BACKEND.md).
//
//   GET  /api/jeu/sante                  état du service et version de la simulation
//   POST /api/jeu/montee      { id, v }  ouvre une montée classée : { montee, graine }
//   GET  /api/jeu/classement?id=…        le top 20 et la ligne du joueur
//   POST /api/jeu/classement  { id, pseudo, montee, combats }
//   POST /api/jeu/e           { m, e }   mesures de jeu anonymes
//
// Variables : PORT (8787), DATABASE_URL (sans elle : tout en mémoire, pour le développement),
// KATA_ORIGINES (origines autorisées en appel direct, séparées par des virgules ; inutile derrière le relais Vercel).
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setImmediate as prochainTour } from 'node:timers/promises';
import pg from 'pg';
import { baseMemoire, basePostgres } from './base';
import type { Base } from './base';
import { ouvrirMontee, envoyerMontee, lireClassement, noterEvenements, MONTEE_MAX_MS } from './classement';
import type { Contexte, Reponse } from './classement';
import { versionSim } from './version';

const PORT = +(process.env.PORT || 8787),
  CORPS_MAX = 600_000, // octets : une longue montée au joystick tient largement
  ORIGINES = (process.env.KATA_ORIGINES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  EVENEMENTS_JOURS = 180;

const journal = (msg: string, d: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ le: new Date().toISOString(), msg, ...d }));

// Débit : un nombre de requêtes par fenêtre et par clé (adresse ou joueur), en mémoire.
function limiteur(max: number, fenetreMs: number) {
  const vus = new Map<string, { n: number; fin: number }>();
  setInterval(() => {
    const t = Date.now();
    for (const [k, v] of vus) if (v.fin < t) vus.delete(k);
  }, 60_000).unref();
  return (cle: string) => {
    const t = Date.now(),
      v = vus.get(cle);
    if (!v || v.fin < t) {
      vus.set(cle, { n: 1, fin: t + fenetreMs });
      return true;
    }
    return ++v.n <= max;
  };
}
const parAdresse = limiteur(120, 60_000),
  ouvertures = limiteur(20, 60_000), // montées ouvertes par joueur
  envois = limiteur(6, 60_000); // montées envoyées par joueur (le rejeu coûte du calcul)

function lireCorps(req: IncomingMessage): Promise<any> {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux: Buffer[] = [];
    req.on('data', (d: Buffer) => {
      taille += d.length;
      if (taille > CORPS_MAX) {
        ko(Object.assign(new Error('trop gros'), { status: 413 }));
        req.destroy();
      } else morceaux.push(d);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(morceaux).toString('utf8') || 'null'));
      } catch {
        ko(Object.assign(new Error('json'), { status: 400 }));
      }
    });
    req.on('error', ko);
  });
}

async function router(c: Contexte, req: IncomingMessage, url: URL): Promise<Reponse> {
  const chemin = url.pathname.replace(/\/+$/, ''),
    m = req.method;
  if (chemin === '/api/jeu/sante' && m === 'GET') return [200, { ok: true, version: c.version }];
  if (chemin === '/api/jeu/classement' && m === 'GET') return lireClassement(c, url.searchParams.get('id'));
  if (m !== 'POST') return [chemin.startsWith('/api/jeu/') ? 405 : 404, { erreur: 'Inconnu.' }];
  const corps = await lireCorps(req);
  const trop: Reponse = [429, { erreur: 'Doucement : réessaie dans une minute.' }];
  switch (chemin) {
    case '/api/jeu/montee':
      return ouvertures(String(corps?.id)) ? ouvrirMontee(c, corps) : trop;
    case '/api/jeu/classement':
      return envois(String(corps?.id)) ? envoyerMontee(c, corps) : trop;
    case '/api/jeu/e':
      return noterEvenements(c, corps);
  }
  return [404, { erreur: 'Inconnu.' }];
}

async function demarrer() {
  let base: Base;
  if (process.env.DATABASE_URL) {
    base = await basePostgres(new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
  } else {
    base = baseMemoire();
    journal('ATTENTION : pas de DATABASE_URL, tout est gardé en mémoire et perdu à l’arrêt');
  }
  const c: Contexte = { base, version: versionSim(), souffler: () => prochainTour(), journal };

  const menage = () =>
    base
      .purger(new Date(Date.now() - MONTEE_MAX_MS), new Date(Date.now() - EVENEMENTS_JOURS * 86400_000))
      .catch(e => journal('ménage raté', { erreur: String(e) }));
  menage();
  setInterval(menage, 6 * 3600_000).unref();

  const serveur = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const origine = req.headers.origin;
    if (origine && ORIGINES.includes(origine)) {
      res.setHeader('access-control-allow-origin', origine);
      res.setHeader('vary', 'origin');
      res.setHeader('access-control-allow-headers', 'content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    // derrière Caddy ou le relais Vercel, l'adresse du joueur est dans x-forwarded-for
    const adresse = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0]
      .trim();
    let rep: Reponse;
    try {
      rep = parAdresse(adresse)
        ? await router(c, req, new URL(req.url || '/', 'http://x'))
        : [429, { erreur: 'Doucement : réessaie dans une minute.' }];
    } catch (e: any) {
      if (e && e.status) rep = [e.status, { erreur: 'Requête invalide.' }];
      else {
        journal('erreur', { chemin: req.url, erreur: String(e && e.stack ? e.stack : e) });
        rep = [500, { erreur: 'Classement indisponible pour l’instant.' }];
      }
    }
    res.setHeader('cache-control', 'no-store');
    if (rep[0] === 204) res.writeHead(204).end();
    else res.writeHead(rep[0], { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(rep[1]));
  });
  serveur.listen(PORT, () => journal('serveur de jeu prêt', { port: PORT, version: c.version }));

  const arret = () => {
    serveur.close(() => base.fermer().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', arret);
  process.on('SIGINT', arret);
}

demarrer().catch(e => {
  journal('démarrage raté', { erreur: String(e && e.stack ? e.stack : e) });
  process.exit(1);
});
