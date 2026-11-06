// Classement de la montée de la Tour (api/classement.js), avec un faux Redis en mémoire.
import { describe, it, expect, beforeEach } from 'vitest';
import { traiter, nettoyerPseudo } from '../api/classement.js';

function fauxRedis() {
  const z = new Map<string, number>(),
    h = new Map<string, string>(),
    verrous = new Set<string>();
  const trie = () => [...z.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const une = (c: string[]): unknown => {
    switch (c[0]) {
      case 'PING':
        return 'PONG';
      case 'ZREVRANGE':
        return trie().slice(+c[2], +c[3] + 1);
      case 'ZREVRANK': {
        const i = trie().indexOf(c[2]);
        return i < 0 ? null : i;
      }
      case 'ZADD':
        z.set(c[3], +c[2]);
        return 1;
      case 'HGET':
        return h.get(c[2]) ?? null;
      case 'HSET':
        h.set(c[2], c[3]);
        return 1;
      case 'HMGET':
        return c.slice(2).map(k => h.get(k) ?? null);
      case 'SET':
        if (verrous.has(c[1])) return null;
        verrous.add(c[1]);
        return 'OK';
    }
    throw new Error('commande inconnue ' + c[0]);
  };
  const redis = async (cmds: string[][]) => cmds.map(une);
  return { redis, libere: () => verrous.clear() };
}

const post = (body: object) => ({ method: 'POST', body });

describe('classement', () => {
  let r: ReturnType<typeof fauxRedis>;
  beforeEach(() => {
    r = fauxRedis();
  });

  it('sans base configurée : fermé', async () => {
    const [st] = await traiter({ method: 'GET' }, null);
    expect(st).toBe(503);
  });

  it('range par étages puis par temps, et garde la meilleure montée', async () => {
    await traiter(post({ id: 'aaaa1', pseudo: 'Alice', etages: 5, secondes: 300 }), r.redis);
    await traiter(post({ id: 'bbbb2', pseudo: 'Bob', etages: 5, secondes: 200 }), r.redis);
    await traiter(post({ id: 'cccc3', pseudo: 'Chloé', etages: 7, secondes: 900 }), r.redis);
    r.libere();
    // Alice fait moins bien : son record reste, son pseudo change
    const [, moins] = await traiter(post({ id: 'aaaa1', pseudo: 'Alix', etages: 2, secondes: 100 }), r.redis);
    expect(moins.record).toBe(false);
    const [st, c] = await traiter({ method: 'GET', query: { id: 'aaaa1' } }, r.redis);
    expect(st).toBe(200);
    expect(c.top.map((l: any) => [l.rang, l.pseudo, l.etages])).toEqual([
      [1, 'Chloé', 7],
      [2, 'Bob', 5],
      [3, 'Alix', 5],
    ]);
    expect(c.moi).toMatchObject({ rang: 3, pseudo: 'Alix', moi: true });
  });

  it('refuse l’impossible et le trop rapide', async () => {
    const essai = (b: object) => traiter(post({ id: 'dddd4', pseudo: 'Dan', ...b }), r.redis).then(x => x[0]);
    expect(await essai({ etages: 10, secondes: 20 })).toBe(400); // 2 s par étage
    expect(await essai({ etages: 0, secondes: 20 })).toBe(400);
    expect(await essai({ etages: 1.5, secondes: 20 })).toBe(400);
    expect(await essai({ etages: 3, secondes: 60, pseudo: ' ' })).toBe(400);
    expect(await essai({ etages: 3, secondes: 60, id: 'X' })).toBe(400);
    expect(await essai({ etages: 3, secondes: 60 })).toBe(200);
    expect(await essai({ etages: 4, secondes: 80 })).toBe(429); // deux envois de suite
  });

  it('le joueur hors du top 20 voit quand même sa ligne', async () => {
    for (let i = 0; i < 22; i++)
      await traiter(
        post({ id: 'id' + String(i).padStart(3, '0'), pseudo: 'J' + i, etages: 30 - i, secondes: 600 }),
        r.redis,
      );
    const [, c] = await traiter({ method: 'GET', query: { id: 'id021' } }, r.redis);
    expect(c.top).toHaveLength(20);
    expect(c.moi).toMatchObject({ rang: 22, pseudo: 'J21' });
  });

  it('nettoie les pseudos', () => {
    expect(nettoyerPseudo('  <b>Ninja</b>\u0000  du   soir ')).toBe('bNinja/b du soir');
    expect(nettoyerPseudo('x'.repeat(40))).toHaveLength(16);
    expect(nettoyerPseudo(42)).toBe('');
  });
});
