// Classement de la montée de la Tour (version minimale) : lecture et envoi.
// Pas de compte : l'identifiant anonyme du navigateur (celui des mesures) garde la meilleure montée sous un pseudo.
//
// Deux serveurs possibles, selon la variable VITE_API_JEU du build :
//   définie (ex. /api/jeu)  serveur de jeu (server/, D19) : le classement est vérifié. Avant une montée, le jeu
//                           demande une graine (ticket) ; à la fin, il envoie ses combats enregistrés et le serveur
//                           les rejoue. Sans ticket (serveur injoignable au départ), la montée n'est pas classée.
//   absente                 pas de classement (l'ancienne fonction Vercel /api/classement n'existe plus) :
//                           développement local sans serveur de jeu. Pour l'avoir : npm run serveur et VITE_API_JEU.
import { aid } from '../analytics';
import type { Combat } from '../sim/rejeu';

export interface Ligne {
  rang: number;
  pseudo: string;
  etages: number;
  secondes: number;
  moi?: boolean;
}
export interface Classement {
  top: Ligne[];
  moi: Ligne | null;
}
const API = ((import.meta.env.VITE_API_JEU as string | undefined) || '').replace(/\/+$/, '');
export const classementVerifie = !!API;
const URL_API = API ? API + '/classement' : '/api/classement';

/* ---------- ticket d'une montée classée ---------- */
export interface Ticket {
  montee: string;
  graine: number;
}
const TICKET_MAX_MS = 20 * 3600 * 1000; // le serveur les garde 24 h
let ticket: (Ticket & { le: number }) | null = null,
  demande: Promise<void> | null = null;
// Demande un ticket d'avance (à l'accueil, puis dès qu'une montée en consomme un) : Jouer n'attend jamais le réseau.
export function preparerMontee() {
  if (!API || demande || (ticket && Date.now() - ticket.le < TICKET_MAX_MS)) return;
  demande = fetch(API + '/montee', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: aid(), v: __VERSION_SIM__ }),
  })
    .then(async r => {
      const j = await r.json().catch(() => null);
      ticket =
        r.ok && j && typeof j.montee === 'string' && Number.isInteger(j.graine)
          ? { montee: j.montee, graine: j.graine, le: Date.now() }
          : null;
    })
    .catch(() => {
      ticket = null;
    })
    .finally(() => {
      demande = null;
    });
}
// Le ticket de la montée qui démarre (null : montée non classée), et un nouveau est demandé pour la suivante.
export function prendreTicket(): Ticket | null {
  const t = ticket && Date.now() - ticket.le < TICKET_MAX_MS ? { montee: ticket.montee, graine: ticket.graine } : null;
  ticket = null;
  preparerMontee();
  return t;
}

async function appel(init?: RequestInit): Promise<Classement> {
  const r = await fetch(init ? URL_API : `${URL_API}?id=${encodeURIComponent(aid())}`, init);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error((j && j.erreur) || 'Classement indisponible pour l’instant.');
  return j as Classement;
}
export const lireClassement = () => appel();
// verif : ticket et combats enregistrés (serveur de jeu) ; le serveur recompte lui-même étages et secondes.
export const envoyerMontee = (
  pseudo: string,
  etages: number,
  secondes: number,
  verif?: { montee: string; combats: Combat[] },
) =>
  appel({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: aid(), pseudo, etages, secondes, ...verif }),
  });

// Liste <li> d'un classement, la ligne du joueur mise en avant (ajoutée en bas s'il est hors du top).
// max : nombre de lignes du top (10 à l'accueil). Chaque ligne porte --i pour l'apparition en cascade.
export function rendreClassement(ol: HTMLElement, c: Classement, max = c.top.length) {
  ol.innerHTML = '';
  const lignes = c.top.slice(0, max);
  if (c.moi && !lignes.some(l => l.moi)) lignes.push(c.moi);
  for (const [i, l] of lignes.entries()) {
    const li = document.createElement('li');
    li.className = l.moi ? 'moi' : '';
    li.style.setProperty('--i', String(i));
    const m = Math.floor(l.secondes / 60),
      s = l.secondes % 60;
    li.innerHTML = `<b>${l.rang}</b><span></span><em>étage ${l.etages}</em><small>${m}:${String(s).padStart(2, '0')}</small>`;
    li.querySelector('span')!.textContent = l.pseudo; // pseudo écrit par un joueur : jamais en HTML
    ol.append(li);
  }
  if (!lignes.length) ol.innerHTML = '<li class="vide">Personne encore : sois le premier.</li>';
}
