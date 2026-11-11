// Serveur de jeu de Kata.io (étape 1 du backend, D19) : classement vérifié par rejeu et mesures de jeu.
// Un seul processus Node derrière Caddy, sur le VPS. Lancement : npm run serveur (voir docs/BACKEND.md).
//
//   GET  /api/jeu/sante                  état du service et version de la simulation
//   POST /api/jeu/montee      { id, v }  ouvre une montée classée : { montee, graine }
//   GET  /api/jeu/classement?id=…        le top 20 et la ligne du joueur
//   POST /api/jeu/classement  { id, pseudo, montee, combats }
//   POST /api/jeu/e           { m, e }   mesures de jeu anonymes
//   WS   /api/jeu/duel[?salle=CODE]      duel entre amis arbitré ici (duel.ts) : sans code, ouvre une salle
//
// Variables : PORT (8787), la base par DATABASE_URL ou PGHOST, PGUSER, PGPASSWORD, PGDATABASE (sans base : tout
// en mémoire, pour le développement),
// KATA_ORIGINES (origines autorisées en appel direct, séparées par des virgules ; inutile derrière le relais Vercel).
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setImmediate as prochainTour } from 'node:timers/promises';
import pg from 'pg';
import { WebSocketServer } from 'ws';
import { Duels } from './duel';
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
  envois = limiteur(6, 60_000), // montées envoyées par joueur (le rejeu coûte du calcul)
  // Duels : connexions par minute. Les joueurs arrivent en direct (Vercel ne relaie pas le temps réel), et Caddy
  // ne transmet pas leur adresse : la limite vaut donc pour tout le monde à la fois, d'où sa largeur.
  salles = limiteur(240, 60_000);
const DUEL_MESSAGE_MAX = 2048, // octets : une entrée ou un combattant tiennent en quelques centaines
  DUEL_DEBIT_MAX = 200, // messages par seconde et par joueur (le jeu en envoie 60 au plus)
  DUEL_TAMPON_MAX = 512_000, // octets en attente d'envoi : au-delà, le joueur ne suit plus, on coupe
  DUEL_HORLOGE_MS = 8;

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
  if (chemin === '/api/jeu/duel') return [426, { erreur: 'Le duel se joue en WebSocket.' }];
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
  if (process.env.DATABASE_URL || process.env.PGHOST) {
    // DATABASE_URL, ou les variables standard PGHOST, PGUSER, PGPASSWORD, PGDATABASE (lues par pg)
    const url = process.env.DATABASE_URL;
    base = await basePostgres(new pg.Pool(url ? { connectionString: url, max: 5 } : { max: 5 }));
  } else {
    base = baseMemoire();
    journal('ATTENTION : pas de base configurée, tout est gardé en mémoire et perdu à l’arrêt');
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
  // Duels : le WebSocket partage le port du serveur HTTP.
  const duels = new Duels(Date.now, journal),
    wss = new WebSocketServer({ noServer: true, maxPayload: DUEL_MESSAGE_MAX });
  serveur.on('upgrade', (req, socket, tete) => {
    const url = new URL(req.url || '/', 'http://x');
    if (url.pathname.replace(/\/+$/, '') !== '/api/jeu/duel' || !salles('tous')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, tete, ws => {
      const lien = {
        envoyer: (texte: string) => {
          if (ws.readyState !== ws.OPEN) return;
          if (ws.bufferedAmount > DUEL_TAMPON_MAX) ws.terminate();
          else ws.send(texte);
        },
        fermer: () => ws.close(),
      };
      const code = url.searchParams.get('salle'),
        poignee = code ? duels.rejoindre(code, lien) : duels.creer(lien);
      if (!poignee) return;
      let recus = 0,
        seconde = 0,
        vivant = true;
      ws.on('message', (donnees, binaire) => {
        const t = Math.floor(Date.now() / 1000);
        if (t !== seconde) {
          seconde = t;
          recus = 0;
        }
        if (binaire || ++recus > DUEL_DEBIT_MAX) {
          ws.terminate();
          return;
        }
        let m: unknown;
        try {
          m = JSON.parse(String(donnees));
        } catch {
          return;
        }
        try {
          poignee.message(m);
        } catch (e: any) {
          journal('erreur duel', { erreur: String(e && e.stack ? e.stack : e) });
          ws.terminate();
        }
      });
      // un joueur dont la connexion est tombée sans prévenir ne répond plus au ping : on libère la salle
      ws.on('pong', () => (vivant = true));
      const veille = setInterval(() => {
        if (!vivant) ws.terminate();
        else {
          vivant = false;
          ws.ping();
        }
      }, 20_000);
      ws.on('close', () => {
        clearInterval(veille);
        poignee.ferme();
      });
      ws.on('error', () => ws.terminate());
    });
  });
  let avant = performance.now();
  setInterval(() => {
    const t = performance.now();
    try {
      duels.avancer(t - avant);
    } catch (e: any) {
      journal('erreur duel', { erreur: String(e && e.stack ? e.stack : e) });
      duels.toutFermer();
    }
    avant = t;
  }, DUEL_HORLOGE_MS).unref();

  serveur.listen(PORT, () => journal('serveur de jeu prêt', { port: PORT, version: c.version }));

  const arret = () => {
    duels.toutFermer();
    for (const ws of wss.clients) ws.terminate();
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
