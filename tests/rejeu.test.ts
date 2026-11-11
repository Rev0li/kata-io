// Enregistrement d'un combat chez le joueur, rejeu sur le serveur : les deux doivent tomber sur le même combat.
import { describe, it, expect } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput, seededRng } from '../src/sim/sim';
import type { Input } from '../src/sim/core';
import { Enregistreur, combatEtage, graineCombat, rejouer, verifierMontee, PAS } from '../src/sim/rejeu';
import type { Combat } from '../src/sim/rejeu';
import { VIES } from '../src/sim/progression';

// Un « joueur » scripté : il avance vers l'adversaire, frappe souvent, pare et esquive parfois, comme au joystick
// (déplacements non arrondis, compteurs d'appuis qui ne partent pas de zéro). force : de 0 (passif) à 1 (agressif).
function jouer(n: number, perso: string, graine: number, force: number, quick = false) {
  const c = { n, perso, quick };
  // côté joueur : nom, ceinture et apparence à lui, comme dans le jeu
  const { specs, opts } = combatEtage(c, graine, {
    name: 'Rev',
    belt: '#151515',
    look: { perso, arme: 'hache', trainee: 'etoiles', ejection: 'phenix' },
  });
  const S = createSim(specs, opts),
    alea = seededRng(graine ^ 0xabcdef),
    brut: Input = { ...emptyInput(), parryN: 41, dodgeN: 7, emoteN: 3 },
    rec = new Enregistreur(brut);
  for (let pas = 0; pas < 60 * 300; pas++) {
    const me = S.f[0],
      foe = S.f[1],
      dx = foe.x - me.x,
      dy = foe.y - me.y,
      d = Math.hypot(dx, dy) || 1;
    if (pas % 7 === 0) {
      const a = (alea() - 0.5) * 1.2;
      brut.mx = (dx / d) * Math.cos(a) * (0.4 + 0.6 * force) - (dy / d) * Math.sin(a) * 0.5;
      brut.my = (dy / d) * Math.cos(a) * (0.4 + 0.6 * force) + (dx / d) * Math.sin(a) * 0.5;
    }
    const r = alea();
    brut.atk = d < 90 && r < 0.25 + 0.5 * force ? !brut.atk : brut.atk && r < 0.9;
    if (alea() < 0.01) brut.parryN++;
    if (alea() < 0.006) brut.dodgeN += 2; // deux appuis dans le même pas : un seul compte
    if (alea() < 0.002) {
      brut.emoteN++;
      brut.emote = 'rire';
    }
    stepSim(S, PAS, [rec.pas(S, brut), emptyInput()]);
    for (const ev of drainEvents(S))
      if (ev.t === 'end') {
        const combat: Combat = { ...c, e: rec.fin() };
        return {
          combat,
          gagne: ev.winner === 0,
          pas: pas + 1,
          secondes: Math.round((S.time - S.duel.start) / 1000),
          etat: S.f.map((e: any) => [e.x, e.y, e.pct]),
        };
      }
  }
  throw new Error('combat sans fin');
}

describe('rejeu d’un combat', () => {
  it('le serveur retrouve le même vainqueur, au même pas, pour des étages, styles et graines variés', () => {
    const cas: [number, string, number][] = [
      [1, 'ninja-bleu', 0.9],
      [1, 'sumo', 0.2],
      [2, 'ninja-pourpre', 0.8],
      [4, 'samourai', 0.7],
      [6, 'oni', 0.5],
      [9, 'moine', 0.9],
      [12, 'loup', 0.6],
      [14, 'squelette', 0.4],
      [20, 'shogun', 0.8],
    ];
    let victoires = 0,
      defaites = 0;
    cas.forEach(([n, perso, force], i) => {
      for (const quick of [false, true]) {
        const graine = graineCombat(123456789 + i, n),
          j = jouer(n, perso, graine, force, quick),
          r = rejouer(j.combat, graine);
        expect(r, `étage ${n} ${perso}`).toEqual({ gagne: j.gagne, secondes: j.secondes, pas: j.pas });
        if (j.gagne) victoires++;
        else defaites++;
      }
    });
    // le test n'a de valeur que s'il couvre les deux issues
    expect(victoires).toBeGreaterThan(0);
    expect(defaites).toBeGreaterThan(0);
  });
  it('une autre graine ne donne pas le même combat', () => {
    const g = graineCombat(42, 0),
      j = jouer(3, 'ninja-bleu', g, 0.8);
    const r = rejouer(j.combat, g + 1);
    expect(r === null || r.pas !== j.pas || r.gagne !== j.gagne).toBe(true);
  });
  it('refuse les entrées illisibles, tronquées ou prolongées, les étages et personnages inconnus', () => {
    const g = graineCombat(7, 0),
      j = jouer(1, 'ninja-bleu', g, 0.9);
    expect(rejouer({ ...j.combat, e: '***' }, g)).toBeNull();
    expect(rejouer({ ...j.combat, e: '' }, g)?.gagne).toBe(false); // sans entrée, le joueur ne bouge pas : il perd
    expect(rejouer({ ...j.combat, e: btoa(atob(j.combat.e).slice(0, 9)) }, g)?.pas).not.toBe(j.pas);
    expect(rejouer({ ...j.combat, e: btoa(atob(j.combat.e) + '\x7f\x7f\x7f\x00') }, g)).toBeNull(); // entrée après la fin
    expect(rejouer({ ...j.combat, perso: 'dragon' }, g)).toBeNull();
    expect(rejouer({ ...j.combat, n: 0 }, g)).toBeNull();
    expect(rejouer({ ...j.combat, n: 1.5 }, g)).toBeNull();
  });
});

describe('vérification d’une montée', () => {
  // une montée scriptée jusqu'à la dernière vie
  function montee(graine: number, force: number) {
    const combats: Combat[] = [];
    let etages = 0,
      secondes = 0,
      vies = VIES;
    while (vies > 0 && combats.length < 40) {
      const j = jouer(etages + 1, 'ninja-bleu', graineCombat(graine, combats.length), force, combats.length > 0);
      combats.push(j.combat);
      secondes += j.secondes;
      if (j.gagne) etages++;
      else vies--;
    }
    return { combats, etages, secondes };
  }
  const M = montee(2026, 0.9);

  it('le serveur recompte les étages et le temps lui-même', async () => {
    expect(M.combats.length).toBeGreaterThanOrEqual(VIES);
    const v = await verifierMontee(2026, M.combats);
    expect(v).toMatchObject({ ok: true, etages: M.etages, secondes: M.secondes });
  });
  it('s’arrêter avant la dernière vie est permis', async () => {
    const v = await verifierMontee(2026, M.combats.slice(0, 1));
    expect(v.ok).toBe(true);
  });
  it('refuse une montée vide, un étage sauté, un combat après la dernière vie, une autre graine', async () => {
    expect((await verifierMontee(2026, [])).ok).toBe(false);
    expect((await verifierMontee(2026, [{ ...M.combats[0], n: 5 }])).ok).toBe(false);
    expect((await verifierMontee(2026, [...M.combats, M.combats[M.combats.length - 1]])).ok).toBe(false);
    const autre = await verifierMontee(2027, M.combats);
    expect(autre.ok && autre.etages === M.etages && autre.secondes === M.secondes).toBe(false);
  });
});
