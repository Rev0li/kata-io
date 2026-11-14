import { describe, expect, it } from 'vitest';
import { Tampon, RETARD_MAX } from '../src/net/tampon';

// Simule un duel : le serveur émet toutes les 33 ms, le réseau ajoute un délai par instantané ; l'écran tourne à
// 60 images par seconde. Rend les écarts (en temps local) entre deux instantanés joués.
function jouer(delai: (n: number) => number, dureeMs = 8000) {
  const t = new Tampon<number>();
  const envois: { arrivee: number; tm: number }[] = [];
  for (let n = 0, tm = 0; tm < dureeMs; n++, tm += 33.3) envois.push({ arrivee: 1000 + tm + delai(n), tm });
  envois.sort((a, b) => a.arrivee - b.arrivee);
  const joues: { t: number; tm: number }[] = [];
  let i = 0;
  for (let ici = 1000; ici < 1000 + dureeMs + 1000; ici += 16.7) {
    while (i < envois.length && envois[i].arrivee <= ici) t.recevoir(envois[i].tm, envois[i].tm, ici), i++;
    for (const tm of t.avancer(16.7, ici)) joues.push({ t: ici, tm });
  }
  return { t, joues };
}
// plus long arrêt de l'image (aucun instantané joué), passé le démarrage
const arretMax = (joues: { t: number }[], apres: number) => {
  let m = 0;
  for (let k = 1; k < joues.length; k++) if (joues[k].t > apres) m = Math.max(m, joues[k].t - joues[k - 1].t);
  return m;
};

describe('tampon de lecture des instantanés', () => {
  it('réseau régulier : retard faible, lecture régulière, rien de perdu ni de désordre', () => {
    const { t, joues } = jouer(() => 40);
    expect(t.retard).toBeLessThan(100);
    expect(arretMax(joues, 1500)).toBeLessThan(60);
    expect(joues.map(j => j.tm)).toEqual([...joues.map(j => j.tm)].sort((a, b) => a - b));
  });

  it('paquets bloqués puis livrés d’un coup (TCP) : le retard grandit et l’image ne gèle plus', () => {
    // toutes les 2 s, 300 ms où rien n'arrive, puis tout d'un coup
    const { t, joues } = jouer(n => {
      const tm = n * 33.3,
        r = tm % 2000;
      return 40 + (r > 1000 && r < 1300 ? 1300 - r : 0);
    });
    expect(t.retard).toBeGreaterThan(250);
    expect(t.retard).toBeLessThanOrEqual(RETARD_MAX);
    expect(t.trous).toBeGreaterThan(0);
    // après le premier trou, plus de gel : au pire un léger ralenti pendant le recalage (sans tampon : 300 ms figé)
    expect(arretMax(joues, 3500)).toBeLessThan(100);
  });

  it('nouvelle manche : l’horloge du serveur repart de zéro, le tampon suit', () => {
    const t = new Tampon<string>();
    for (let k = 0; k < 30; k++) t.recevoir(5000 + k * 33, 'a', k * 33), t.avancer(33, k * 33);
    expect(t.recevoir(0, 'b', 1000)).toBe(true);
    const sortis: string[] = [];
    for (let k = 0; k < 30; k++) sortis.push(...t.avancer(33, 1000 + k * 33));
    expect(sortis).toContain('b');
  });
});
