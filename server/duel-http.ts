// Duel, voie de secours sans WebSocket. Certains navigateurs et bloqueurs de publicité (Brave, par exemple) coupent
// les WebSocket vers un autre domaine que celui de la page ; les requêtes HTTP ordinaires, elles, passent. Le jeu
// essaie donc le WebSocket, puis se rabat ici (src/net/transport.ts). Mêmes salles, mêmes messages (duel.ts).
//
//   POST /api/jeu/duel/ouvrir   { salle? }   → { jeton, m }   m : premiers messages (salle, ok ou refus)
//   GET  /api/jeu/duel/flux?j=jeton          flux d'événements (text/event-stream), un message du duel par « data »
//   POST /api/jeu/duel/dire?j=jeton  [messages]   → 204
//
// Le jeton, tiré au hasard, vaut pour une connexion ; fermer le flux, c'est quitter la salle.
// Ces routes sont appelées directement depuis la page du jeu (autre domaine) : elles autorisent toute origine,
// sans risque puisqu'il n'y a ni cookie ni compte, seulement le jeton.
import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duels, Lien, Poignee } from './duel';

const CORPS_MAX = 4096, // octets par requête
  LOT_MAX = 20, // messages par requête
  DEBIT_MAX = 120, // requêtes « dire » par seconde et par joueur
  FILE_MAX = 300, // messages en attente du flux : au-delà, le joueur ne suit plus
  SANS_FLUX_MS = 15_000, // jeton ouvert dont le flux n'arrive pas
  BATTEMENT_MS = 15_000;

interface Joueur {
  poignee: Poignee | null;
  file: string[];
  res: ServerResponse | null;
  ouvert: number;
  seconde: number;
  recus: number;
  fini: boolean;
}

function lireCorps(req: IncomingMessage): Promise<unknown> {
  return new Promise(ok => {
    let taille = 0;
    const morceaux: Buffer[] = [];
    req.on('data', (d: Buffer) => {
      taille += d.length;
      if (taille > CORPS_MAX) {
        ok(undefined);
        req.destroy();
      } else morceaux.push(d);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(morceaux).toString('utf8') || 'null'));
      } catch {
        ok(undefined);
      }
    });
    req.on('error', () => ok(undefined));
  });
}

// Rend le gestionnaire des routes /api/jeu/duel/* : true si la requête était pour lui.
export function duelHttp(duels: Duels, journal: (msg: string, d?: Record<string, unknown>) => void) {
  const joueurs = new Map<string, Joueur>();

  const quitter = (jeton: string, j: Joueur) => {
    if (j.fini) return;
    j.fini = true;
    joueurs.delete(jeton);
    if (j.res) {
      j.res.write('event: fin\ndata: 1\n\n');
      j.res.end();
    }
    j.poignee?.ferme();
  };
  setInterval(() => {
    const t = Date.now();
    for (const [jeton, j] of joueurs) {
      if (j.res) j.res.write(': \n\n');
      else if (t - j.ouvert > SANS_FLUX_MS) quitter(jeton, j);
    }
  }, BATTEMENT_MS).unref();

  const json = (res: ServerResponse, code: number, corps?: unknown) => {
    if (corps === undefined) res.writeHead(code).end();
    else res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(corps));
  };

  return async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
    const chemin = url.pathname.replace(/\/+$/, '');
    if (!chemin.startsWith('/api/jeu/duel/')) return false;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('cache-control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.setHeader('access-control-allow-headers', 'content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST');
      json(res, 204);
      return true;
    }
    const quoi = chemin.slice('/api/jeu/duel/'.length);

    if (quoi === 'ouvrir' && req.method === 'POST') {
      const corps = (await lireCorps(req)) as { salle?: unknown } | null | undefined;
      const jeton = randomBytes(16).toString('hex');
      const j: Joueur = { poignee: null, file: [], res: null, ouvert: Date.now(), seconde: 0, recus: 0, fini: false };
      const lien: Lien = {
        envoyer: texte => {
          if (j.fini) return;
          if (j.res) j.res.write('data: ' + texte + '\n\n');
          else if (j.file.push(texte) > FILE_MAX) quitter(jeton, j);
        },
        fermer: () => quitter(jeton, j),
      };
      const salle = corps && typeof corps.salle === 'string' ? corps.salle : '';
      j.poignee = salle ? duels.rejoindre(salle, lien) : duels.creer(lien);
      const m = j.file.splice(0).map(t => JSON.parse(t) as unknown);
      if (!j.poignee || j.fini) {
        json(res, 200, { m }); // refus : pas de jeton
        return true;
      }
      joueurs.set(jeton, j);
      json(res, 200, { jeton, m });
      return true;
    }

    const jeton = url.searchParams.get('j') || '',
      j = joueurs.get(jeton);
    if (!j) {
      json(res, 404, { erreur: 'Salle fermée.' });
      return true;
    }

    if (quoi === 'flux' && req.method === 'GET') {
      if (j.res) {
        json(res, 409, { erreur: 'Déjà connecté.' });
        return true;
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'x-accel-buffering': 'no',
      });
      j.res = res;
      for (const t of j.file.splice(0)) res.write('data: ' + t + '\n\n');
      res.write(': \n\n');
      req.on('close', () => {
        j.res = null;
        quitter(jeton, j);
      });
      return true;
    }

    if (quoi === 'dire' && req.method === 'POST') {
      const t = Math.floor(Date.now() / 1000);
      if (t !== j.seconde) {
        j.seconde = t;
        j.recus = 0;
      }
      if (++j.recus > DEBIT_MAX) {
        quitter(jeton, j);
        json(res, 429, { erreur: 'Trop de messages.' });
        return true;
      }
      const lot = await lireCorps(req);
      if (Array.isArray(lot) && j.poignee && !j.fini)
        try {
          for (const m of lot.slice(0, LOT_MAX)) j.poignee.message(m);
        } catch (e: any) {
          journal('erreur duel', { erreur: String(e && e.stack ? e.stack : e) });
          quitter(jeton, j);
        }
      json(res, 204);
      return true;
    }

    json(res, 404, { erreur: 'Inconnu.' });
    return true;
  };
}
