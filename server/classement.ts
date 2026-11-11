// Règles du serveur de jeu, sans réseau ni base imposée (tests : tests/serveur.test.ts).
//   ouvrirMontee      donne la graine d'une montée : c'est le serveur qui choisit le hasard, pas le joueur
//   envoyerMontee     rejoue tous les combats envoyés et inscrit le résultat qu'il trouve lui-même
//   lireClassement    le top et la ligne du joueur
//   noterEvenements   mesures de jeu anonymes
// Pas de compte pour l'instant : l'identifiant est le jeton anonyme du navigateur (les comptes de D13 le reprendront).
import { randomUUID, randomInt } from 'node:crypto';
import { verifierMontee } from '../src/sim/rejeu';
import type { Combat } from '../src/sim/rejeu';
import type { Base, Evenement, Record_ } from './base';

export const TOP = 20;
export const MONTEE_MAX_MS = 24 * 3600 * 1000; // une montée ouverte reste valable un jour
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Reponse = [status: number, corps: Record<string, unknown>];
const refus = (status: number, erreur: string, plus: Record<string, unknown> = {}): Reponse => [
  status,
  { erreur, ...plus },
];

export const idValide = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9]{4,24}$/.test(id);
export function nettoyerPseudo(v: unknown) {
  if (typeof v !== 'string') return '';
  return v
    .normalize('NFC')
    .replace(/[\p{C}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

export interface Contexte {
  base: Base;
  version: string; // version de la simulation du serveur (server/version.ts)
  maintenant?: () => Date;
  souffler?: () => Promise<void>;
  journal?: (msg: string, d?: Record<string, unknown>) => void;
}
const now = (c: Contexte) => (c.maintenant ? c.maintenant() : new Date());

export async function ouvrirMontee(c: Contexte, b: any): Promise<Reponse> {
  if (!b || !idValide(b.id)) return refus(400, 'Identifiant invalide.');
  // le jeu et le serveur doivent avoir la même simulation, sinon le rejeu ne retombe pas sur le même combat
  if (b.v !== c.version)
    return refus(409, 'Le jeu vient d’être mis à jour : le classement revient dans quelques minutes.', {
      version: c.version,
    });
  const m = { id: randomUUID(), joueur: b.id, graine: randomInt(0, 2 ** 32), debut: now(c), fin: null };
  await c.base.creerMontee(m);
  return [200, { montee: m.id, graine: m.graine }];
}

const ligne = (r: Record_, rang: number, moi: boolean) => ({
  rang,
  pseudo: r.pseudo,
  etages: r.etages,
  secondes: r.secondes,
  ...(moi ? { moi: true } : {}),
});
export async function lireClassement(c: Contexte, id: unknown): Promise<Reponse> {
  const top = (await c.base.top(TOP)).map((r, i) => ligne(r, i + 1, r.joueur === id));
  let moi = top.find(l => l.moi) || null;
  if (!moi && idValide(id)) {
    const [r, rang] = await Promise.all([c.base.lireRecord(id), c.base.rang(id)]);
    if (r && rang) moi = ligne(r, rang, true);
  }
  return [200, { top, moi, version: c.version }];
}

export async function envoyerMontee(c: Contexte, b: any): Promise<Reponse> {
  if (!b || typeof b !== 'object') return refus(400, 'Requête invalide.');
  if (!idValide(b.id)) return refus(400, 'Identifiant invalide.');
  const pseudo = nettoyerPseudo(b.pseudo);
  if (pseudo.length < 2) return refus(400, 'Choisis un pseudo d’au moins 2 caractères.');
  if (typeof b.montee !== 'string' || !UUID.test(b.montee)) return refus(400, 'Montée invalide.');
  const m = await c.base.lireMontee(b.montee);
  if (!m || m.joueur !== b.id) return refus(400, 'Montée inconnue.');
  if (m.fin) return refus(409, 'Cette montée est déjà inscrite.');
  const t = now(c);
  if (t.getTime() - m.debut.getTime() > MONTEE_MAX_MS) return refus(400, 'Montée trop ancienne.');

  const v = await verifierMontee(m.graine, b.combats as Combat[], c.souffler);
  if (v.ok === false) {
    c.journal?.('montée refusée', { joueur: b.id, raison: v.raison });
    return refus(400, 'Montée refusée : le serveur ne retrouve pas ces combats.');
  }
  if (v.etages < 1) return refus(400, 'Gagne au moins un étage pour entrer au classement.');
  // une montée ne peut pas avoir duré moins longtemps que ses combats (rejeu accéléré, calcul hors ligne)
  if (t.getTime() - m.debut.getTime() < (v.pas / 60) * 1000 * 0.95) {
    c.journal?.('montée refusée', { joueur: b.id, raison: 'plus rapide que le temps réel' });
    return refus(400, 'Montée refusée : elle a duré moins longtemps que ses combats.');
  }
  if (!(await c.base.cloreMontee(m.id, { etages: v.etages, secondes: v.secondes, fin: t })))
    return refus(409, 'Cette montée est déjà inscrite.');

  const ancien = await c.base.lireRecord(b.id);
  const record = !ancien || v.etages > ancien.etages || (v.etages === ancien.etages && v.secondes < ancien.secondes);
  // le pseudo suit toujours le dernier choisi
  await c.base.ecrireRecord(
    record ? { joueur: b.id, pseudo, etages: v.etages, secondes: v.secondes, le: t } : { ...ancien!, pseudo },
  );
  const [, corps] = await lireClassement(c, b.id);
  return [200, { ...corps, record, etages: v.etages, secondes: v.secondes }];
}

// Mesures de jeu : même format que l'ancien /api/e ({ m: contexte, e: événements }).
export async function noterEvenements(c: Contexte, b: any): Promise<Reponse> {
  const liste = b && Array.isArray(b.e) ? b.e.slice(0, 40) : [];
  const m = b && typeof b.m === 'object' && b.m ? b.m : {};
  const txt = (v: unknown, n: number) => String(v ?? '').slice(0, n);
  const evs: Evenement[] = [];
  for (const ev of liste) {
    if (!ev || typeof ev.n !== 'string' || !/^[a-z_]{1,40}$/.test(ev.n)) continue;
    const props = ev.p && typeof ev.p === 'object' ? ev.p : {};
    if (JSON.stringify(props).length > 1000) continue;
    evs.push({
      aid: txt(m.a, 24),
      sid: txt(m.s, 24),
      nom: ev.n,
      t: Number.isFinite(ev.t) ? Math.round(ev.t) : 0,
      props,
      ctx: txt(m.c, 8) + ' ' + txt(m.v, 12),
    });
  }
  await c.base.ajouterEvenements(evs);
  return [204, {}];
}
