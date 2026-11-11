// Duel sans WebSocket (server/duel-http.ts) : un vrai serveur HTTP local, deux joueurs qui se parlent par
// requêtes et flux d'événements.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Duels } from '../server/duel';
import { duelHttp } from '../server/duel-http';

let serveur: Server, base: string, duels: Duels, horloge: ReturnType<typeof setInterval>;
beforeAll(async () => {
  duels = new Duels();
  const secours = duelHttp(duels, () => {});
  serveur = createServer(async (req, res) => {
    if (!(await secours(req, res, new URL(req.url || '/', 'http://x')))) res.writeHead(404).end();
  });
  await new Promise<void>(ok => serveur.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/jeu/duel`;
  horloge = setInterval(() => duels.avancer(8), 8);
});
afterAll(() => {
  clearInterval(horloge);
  duels.toutFermer();
  serveur.closeAllConnections();
  serveur.close();
});

const poster = (chemin: string, corps: unknown) =>
  fetch(base + chemin, { method: 'POST', body: JSON.stringify(corps) });
// Lit le flux d'un joueur : les messages reçus s'ajoutent à la liste rendue.
function flux(jeton: string) {
  const recus: any[] = [],
    etat = { fini: false },
    ctl = new AbortController();
  (async () => {
    const r = await fetch(base + '/flux?j=' + jeton, { signal: ctl.signal });
    expect(r.headers.get('content-type')).toMatch(/event-stream/);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    let reste = '';
    for await (const morceau of r.body as any) {
      reste += Buffer.from(morceau).toString('utf8');
      const blocs = reste.split('\n\n');
      reste = blocs.pop()!;
      for (const b of blocs) {
        if (b.startsWith('event: fin')) etat.fini = true;
        else if (b.startsWith('data: ')) recus.push(JSON.parse(b.slice(6)));
      }
    }
    etat.fini = true;
  })().catch(() => {
    etat.fini = true;
  });
  return { recus, etat, couper: () => ctl.abort() };
}
async function attendre(cond: () => unknown, ms = 3000) {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error('attendu trop longtemps');
    await new Promise(r => setTimeout(r, 10));
  }
}

describe('duel sans WebSocket', () => {
  it('ouvre une salle, fait entrer un ami, diffuse le combat, et ferme l’autre quand l’un part', async () => {
    const a = await (await poster('/ouvrir', {})).json();
    expect(a.jeton).toMatch(/^[0-9a-f]{32}$/);
    const code = a.m[0].code;
    expect(a.m[0].t).toBe('salle');
    const fa = flux(a.jeton);
    await poster('/dire?j=' + a.jeton, [{ t: 'hello', spec: { name: 'Ana', look: {} } }]);

    const b = await (await poster('/ouvrir', { salle: code })).json();
    expect(b.m[0].t).toBe('ok');
    // le combattant est envoyé avant que le flux soit branché : rien ne doit se perdre
    await poster('/dire?j=' + b.jeton, [{ t: 'hello', spec: { name: 'Bob', look: {} } }]);
    const fb = flux(b.jeton);

    await attendre(() => fa.recus.some(m => m.t === 'welcome') && fb.recus.some(m => m.t === 'welcome'));
    expect(fb.recus.find(m => m.t === 'welcome').moi).toBe(1);
    await attendre(() => fa.recus.filter(m => m.t === 's').length > 5);

    await poster('/dire?j=' + a.jeton, [{ t: 'ping', ts: 42 }]);
    await attendre(() => fa.recus.some(m => m.t === 'pong' && m.ts === 42));

    fb.couper();
    await attendre(() => fa.etat.fini);
    expect(duels.nombre).toBe(0);
    expect((await poster('/dire?j=' + a.jeton, [])).status).toBe(404);
  });

  it('refuse une salle inconnue sans donner de jeton', async () => {
    const r = await (await poster('/ouvrir', { salle: 'ZZZZZZ' })).json();
    expect(r.jeton).toBeUndefined();
    expect(r.m[0].t).toBe('refus');
  });

  it('ignore un jeton inconnu et un corps illisible', async () => {
    expect((await fetch(base + '/flux?j=nimporte')).status).toBe(404);
    const a = await (await poster('/ouvrir', {})).json();
    const r = await fetch(base + '/dire?j=' + a.jeton, { method: 'POST', body: '{pas du json' });
    expect(r.status).toBe(204);
    const gros = await fetch(base + '/dire?j=' + a.jeton, {
      method: 'POST',
      body: JSON.stringify(['x'.repeat(9000)]),
    }).catch(() => null);
    expect(gros === null || gros.status === 204).toBe(true);
  });
});
