// Règles du serveur de jeu (server/classement.ts), avec la base en mémoire : une montée n'entre au classement
// que si le serveur retrouve lui-même ses combats.
import { describe, it, expect, beforeEach } from 'vitest';
import { createSim, stepSim, drainEvents, emptyInput } from '../src/sim/sim';
import { Enregistreur, combatEtage, graineCombat, PAS } from '../src/sim/rejeu';
import type { Combat } from '../src/sim/rejeu';
import { baseMemoire } from '../server/base';
import { ouvrirMontee, envoyerMontee, lireClassement, noterEvenements } from '../server/classement';
import type { Contexte } from '../server/classement';
import { versionSim } from '../server/version';

// Joue un combat d'étage : fonce = va au contact et martèle (gagne l'étage 1), sinon reste immobile (perd).
function combat(n: number, graine: number, fonce: boolean): { c: Combat; gagne: boolean } {
  const base = { n, perso: 'sumo', quick: false };
  const { specs, opts } = combatEtage(base, graine);
  const S = createSim(specs, opts),
    brut = emptyInput(),
    rec = new Enregistreur(brut);
  for (let pas = 0; pas < 60 * 300; pas++) {
    if (fonce) {
      const dx = S.f[1].x - S.f[0].x,
        dy = S.f[1].y - S.f[0].y,
        d = Math.hypot(dx, dy) || 1;
      brut.mx = dx / d;
      brut.my = dy / d;
      brut.atk = pas % 12 < 6;
    }
    stepSim(S, PAS, [rec.pas(S, brut), emptyInput()]);
    for (const ev of drainEvents(S))
      if (ev.t === 'end') return { c: { ...base, e: rec.fin() }, gagne: ev.winner === 0 };
  }
  throw new Error('combat sans fin');
}

let base: ReturnType<typeof baseMemoire>, heure: number, c: Contexte;
const V = 'v-test';
beforeEach(() => {
  base = baseMemoire();
  heure = Date.UTC(2026, 10, 11, 12);
  c = { base, version: V, maintenant: () => new Date(heure) };
});
const plusTard = (s: number) => (heure += s * 1000);

async function ouvrir(id = 'joueur1') {
  const [st, r] = await ouvrirMontee(c, { id, v: V });
  expect(st).toBe(200);
  return r as { montee: string; graine: number };
}
// Une montée honnête : un étage gagné si possible, puis on s'arrête.
async function monteeGagnee(id = 'joueur1') {
  for (let essai = 0; essai < 8; essai++) {
    const m = await ouvrir(id),
      k = combat(1, graineCombat(m.graine, 0), true);
    if (k.gagne) return { m, combats: [k.c] };
  }
  throw new Error('le joueur scripté ne gagne jamais l’étage 1');
}

describe('ouverture d’une montée', () => {
  it('donne une graine et un identifiant', async () => {
    const m = await ouvrir();
    expect(m.montee).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isInteger(m.graine)).toBe(true);
  });
  it('refuse une autre version du jeu, et un identifiant invalide', async () => {
    expect((await ouvrirMontee(c, { id: 'joueur1', v: 'autre' }))[0]).toBe(409);
    expect((await ouvrirMontee(c, { id: 'X', v: V }))[0]).toBe(400);
  });
});

describe('envoi d’une montée', () => {
  it('inscrit le résultat que le serveur trouve lui-même', async () => {
    const { m, combats } = await monteeGagnee();
    plusTard(60);
    const [st, r] = await envoyerMontee(c, { id: 'joueur1', pseudo: ' Rev ', montee: m.montee, combats, etages: 99 });
    expect(st).toBe(200);
    expect(r).toMatchObject({ record: true, etages: 1, moi: { rang: 1, pseudo: 'Rev', etages: 1, moi: true } });
    expect((r as any).secondes).toBeGreaterThan(0);
  });
  it('refuse une montée envoyée deux fois', async () => {
    const { m, combats } = await monteeGagnee();
    plusTard(60);
    const envoi = { id: 'joueur1', pseudo: 'Rev', montee: m.montee, combats };
    expect((await envoyerMontee(c, envoi))[0]).toBe(200);
    expect((await envoyerMontee(c, envoi))[0]).toBe(409);
  });
  it('refuse la montée d’un autre joueur, inconnue ou trop ancienne', async () => {
    const { m, combats } = await monteeGagnee();
    plusTard(60);
    expect((await envoyerMontee(c, { id: 'voleur1', pseudo: 'Rev', montee: m.montee, combats }))[0]).toBe(400);
    const inconnue = '00000000-0000-4000-8000-000000000000';
    expect((await envoyerMontee(c, { id: 'joueur1', pseudo: 'Rev', montee: inconnue, combats }))[0]).toBe(400);
    plusTard(25 * 3600);
    expect((await envoyerMontee(c, { id: 'joueur1', pseudo: 'Rev', montee: m.montee, combats }))[0]).toBe(400);
  });
  it('refuse des combats inventés, sans rien inscrire', async () => {
    const m = await ouvrir();
    plusTard(60);
    const faux: Combat[] = [{ n: 1, perso: 'sumo', quick: false, e: 'AH9/AQ==' }];
    const [st] = await envoyerMontee(c, { id: 'joueur1', pseudo: 'Rev', montee: m.montee, combats: faux });
    expect(st).toBe(400);
    expect(await base.top(20)).toEqual([]);
  });
  it('refuse une montée sans étage gagné', async () => {
    const m = await ouvrir(),
      k = combat(1, graineCombat(m.graine, 0), false);
    expect(k.gagne).toBe(false);
    plusTard(120);
    expect((await envoyerMontee(c, { id: 'joueur1', pseudo: 'Rev', montee: m.montee, combats: [k.c] }))[0]).toBe(400);
  });
  it('refuse une montée plus rapide que le temps réel', async () => {
    const { m, combats } = await monteeGagnee();
    plusTard(1);
    const [st, r] = await envoyerMontee(c, { id: 'joueur1', pseudo: 'Rev', montee: m.montee, combats });
    expect(st).toBe(400);
    expect(String((r as any).erreur)).toContain('moins longtemps');
  });
  it('garde le meilleur résultat, et le pseudo suit le dernier choisi', async () => {
    const a = await monteeGagnee();
    plusTard(60);
    await envoyerMontee(c, { id: 'joueur1', pseudo: 'Avant', montee: a.m.montee, combats: a.combats });
    const b = await monteeGagnee();
    plusTard(60);
    const [, r] = await envoyerMontee(c, { id: 'joueur1', pseudo: 'Après', montee: b.m.montee, combats: b.combats });
    expect((r as any).top).toHaveLength(1);
    expect((r as any).top[0].pseudo).toBe('Après');
  });
  it('classe plusieurs joueurs et donne la ligne de chacun', async () => {
    for (const id of ['joueur1', 'joueur2']) {
      const { m, combats } = await monteeGagnee(id);
      plusTard(60);
      expect((await envoyerMontee(c, { id, pseudo: id, montee: m.montee, combats }))[0]).toBe(200);
    }
    const [, r] = await lireClassement(c, 'joueur2');
    expect((r as any).top).toHaveLength(2);
    expect((r as any).moi).toMatchObject({ pseudo: 'joueur2', moi: true });
    expect((r as any).top.map((l: any) => l.rang)).toEqual([1, 2]);
  });
});

describe('mesures de jeu', () => {
  it('garde les événements bien formés et ignore le reste', async () => {
    const [st] = await noterEvenements(c, {
      m: { a: 'abc123', s: 'sess', c: 'desk', v: '1280x720' },
      e: [
        { n: 'match_started', t: 1200, p: { mode: 'tower', floor: 1 } },
        { n: 'Pas Valide', t: 1 },
        { n: 'trop_gros', t: 1, p: { x: 'y'.repeat(2000) } },
        null,
      ],
    });
    expect(st).toBe(204);
    expect(base.evenements).toHaveLength(1);
    expect(base.evenements[0]).toMatchObject({ aid: 'abc123', nom: 'match_started', t: 1200, ctx: 'desk 1280x720' });
  });
});

describe('version de la simulation', () => {
  it('est une empreinte stable des fichiers de src/sim', () => {
    expect(versionSim()).toMatch(/^[0-9a-f]{12}$/);
    expect(versionSim()).toBe(versionSim());
  });
});
