// Duels arbitrés par le serveur (server/duel.ts), sans réseau : de faux liens reçoivent ce que le serveur envoie.
import { describe, it, expect, beforeEach } from 'vitest';
import { Duels, lireEntree, SALLES_MAX, ATTENTE_MAX_MS, SILENCE_MAX_MS } from '../server/duel';
import type { Poignee } from '../server/duel';

class Faux {
  recus: any[] = [];
  ferme = false;
  envoyer(texte: string) {
    this.recus.push(JSON.parse(texte));
  }
  fermer() {
    this.ferme = true;
  }
  dernier(t: string) {
    return [...this.recus].reverse().find(m => m.t === t);
  }
  tous(t: string) {
    return this.recus.filter(m => m.t === t);
  }
}
const spec = (name: string) => ({ name, look: { perso: 'sumo' }, belt: 'noire' });

let heure: number, duels: Duels;
beforeEach(() => {
  heure = 1_000_000;
  duels = new Duels(() => heure);
});
// Fait tourner le serveur n pas de simulation (60 par seconde).
function tourner(pas: number) {
  for (let i = 0; i < pas; i++) {
    heure += 1000 / 60;
    duels.avancer(1000 / 60);
  }
}
function duel() {
  const a = new Faux(),
    b = new Faux();
  const pa = duels.creer(a)!;
  const code = a.dernier('salle').code as string;
  pa.message({ t: 'hello', spec: spec('Ana') });
  const pb = duels.rejoindre(code, b)!;
  pb.message({ t: 'hello', spec: spec('Bob') });
  return { a, b, pa, pb, code };
}
// b fonce sur a et martèle jusqu'à la fin du duel ; a ne fait rien.
function jusquALaFin(a: Faux, b: Faux, pb: Poignee) {
  for (let pas = 0; pas < 60 * 400; pas++) {
    const s = b.dernier('s');
    if (s) {
      const [ax, ay] = s.s.f[0],
        [bx, by] = s.s.f[1],
        d = Math.hypot(ax - bx, ay - by) || 1;
      pb.message({
        t: 'in',
        i: [(ax - bx) / d, (ay - by) / d, Math.atan2(ay - by, ax - bx), pas % 12 < 6 ? 1 : 0, 0, 0, 0, ''],
      });
      b.recus = b.recus.filter(m => m.t !== 's' || m.e.length);
    }
    tourner(1);
    const fin = a.recus.flatMap(m => (m.t === 's' ? m.e : [])).find((e: any) => e.t === 'end');
    if (fin) return fin;
  }
  throw new Error('duel sans fin');
}

describe('salle de duel', () => {
  it('donne un code au créateur et attend les deux combattants avant de commencer', () => {
    const a = new Faux(),
      b = new Faux();
    const pa = duels.creer(a)!;
    const code = a.dernier('salle').code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    pa.message({ t: 'hello', spec: spec('Ana') });
    const pb = duels.rejoindre(code.toLowerCase(), b)!;
    expect(b.dernier('ok')).toBeTruthy();
    expect(a.dernier('welcome')).toBeUndefined();
    pb.message({ t: 'hello', spec: spec('Bob') });
    const wa = a.dernier('welcome'),
      wb = b.dernier('welcome');
    expect([wa.moi, wb.moi]).toEqual([0, 1]);
    expect(wa.specs.map((s: any) => s.name)).toEqual(['Ana', 'Bob']);
    expect(wa.theme).toBe(wb.theme);
  });

  it('envoie les mêmes instantanés aux deux joueurs, trente fois par seconde', () => {
    const { a, b } = duel();
    tourner(60);
    expect(a.tous('s').length).toBe(30);
    expect(b.tous('s')).toEqual(a.tous('s'));
  });

  it('prend le dojo choisi par le créateur, pas celui de l’invité', () => {
    const a = new Faux(),
      b = new Faux();
    const pa = duels.creer(a)!;
    pa.message({ t: 'hello', spec: spec('Ana') });
    pa.message({ t: 'theme', v: 'neige' });
    const pb = duels.rejoindre(a.dernier('salle').code, b)!;
    pb.message({ t: 'theme', v: 'volcan' });
    pb.message({ t: 'hello', spec: spec('Bob') });
    expect(b.dernier('welcome').theme).toBe('neige');
  });

  it('refuse une salle inconnue ou déjà complète', () => {
    const x = new Faux();
    expect(duels.rejoindre('ZZZZZZ', x)).toBeNull();
    expect(x.dernier('refus').msg).toMatch(/introuvable/);
    expect(x.ferme).toBe(true);
    const { code } = duel();
    const y = new Faux();
    expect(duels.rejoindre(code, y)).toBeNull();
    expect(y.dernier('refus').msg).toMatch(/complète/);
  });

  it('c’est le serveur qui joue : le joueur qui frappe gagne, et la revanche demande l’accord des deux', () => {
    const { a, b, pa, pb } = duel();
    const fin = jusquALaFin(a, b, pb);
    expect(fin.winner).toBe(1);
    pa.message({ t: 'rematch' });
    expect(b.dernier('rematch')).toBeTruthy();
    expect(a.dernier('restart')).toBeUndefined();
    pb.message({ t: 'rematch' });
    expect(a.dernier('restart')).toBeTruthy();
    expect(b.dernier('restart')).toBeTruthy();
    a.recus = [];
    tourner(2);
    expect(a.dernier('s').s.d.slice(0, 2)).toEqual([0, 0]);
  }, 30_000);

  it('pas de revanche pendant le combat', () => {
    const { a, b, pa, pb } = duel();
    pa.message({ t: 'rematch' });
    pb.message({ t: 'rematch' });
    expect(a.dernier('restart')).toBeUndefined();
    expect(b.dernier('rematch')).toBeUndefined();
  });

  it('un départ ferme le lien de l’autre et libère la salle', () => {
    const { a, b, pb } = duel();
    tourner(10);
    pb.ferme();
    expect(a.ferme).toBe(true);
    expect(b.ferme).toBe(false);
    expect(duels.nombre).toBe(0);
  });

  it('avant le début, l’invité peut repartir et un autre prendre sa place', () => {
    const a = new Faux(),
      b = new Faux(),
      c = new Faux();
    duels.creer(a)!.message({ t: 'hello', spec: spec('Ana') });
    const code = a.dernier('salle').code;
    duels.rejoindre(code, b)!.ferme();
    expect(a.ferme).toBe(false);
    duels.rejoindre(code, c)!.message({ t: 'hello', spec: spec('Cléo') });
    expect(a.dernier('welcome').specs[1].name).toBe('Cléo');
  });

  it('ferme une salle restée sans adversaire, et un combat où plus personne ne joue', () => {
    const a = new Faux();
    duels.creer(a);
    heure += ATTENTE_MAX_MS + 1;
    duels.avancer(16);
    expect(a.ferme).toBe(true);
    const d = duel();
    heure += SILENCE_MAX_MS + 1;
    duels.avancer(16);
    expect(d.a.ferme && d.b.ferme).toBe(true);
    expect(duels.nombre).toBe(0);
  });

  it('limite le nombre de salles', () => {
    for (let i = 0; i < SALLES_MAX; i++) expect(duels.creer(new Faux())).not.toBeNull();
    const x = new Faux();
    expect(duels.creer(x)).toBeNull();
    expect(x.dernier('refus')).toBeTruthy();
  });

  it('ne plante pas sur des messages malformés, et nettoie le combattant reçu', () => {
    const a = new Faux(),
      b = new Faux();
    const pa = duels.creer(a)!;
    for (const m of [null, 3, 'x', [], {}, { t: 'in' }, { t: 'in', i: 'zz' }, { t: 'theme', v: {} }, { t: 'ping' }])
      pa.message(m);
    pa.message({
      t: 'hello',
      spec: { name: 'x'.repeat(80) + '\n', look: { perso: 'nimporte', arme: 7 }, abil: { god: 1 } },
    });
    const pb = duels.rejoindre(a.dernier('salle').code, b)!;
    pb.message({ t: 'hello' });
    const w = a.dernier('welcome');
    expect(w.specs[0].name).toHaveLength(16);
    expect(w.specs[1].name).toBe('Disciple');
    pb.message({ t: 'in', i: [1e9, NaN, 'a', 1, -5, 1e99, {}, 'pas-une-emote'] });
    tourner(120);
    expect(a.dernier('s')).toBeTruthy();
  });
});

describe('entrées reçues', () => {
  it('sont bornées', () => {
    expect(lireEntree([5, -5, Infinity, 1, 2.7, -1, 3, 'gg'])).toEqual({
      mx: 1,
      my: -1,
      aim: 0,
      atk: true,
      parryN: 2,
      dodgeN: 0,
      emoteN: 3,
      emote: 'gg',
    });
    expect(lireEntree('non')).toBeNull();
    expect(lireEntree(new Array(9).fill(0))).toBeNull();
    expect(lireEntree([0, 0, 0, 0, 0, 0, 1, '__proto__'])!.emote).toBeNull();
  });
});
