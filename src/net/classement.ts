// Classement de la montée de la Tour (version minimale) : lecture et envoi vers /api/classement.
// Pas de compte : l'identifiant anonyme du navigateur (celui des mesures) garde la meilleure montée sous un pseudo.
import { aid } from '../analytics';

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
const URL_API = '/api/classement';

async function appel(init?: RequestInit): Promise<Classement> {
  const r = await fetch(init ? URL_API : `${URL_API}?id=${encodeURIComponent(aid())}`, init);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error((j && j.erreur) || 'Classement indisponible pour l’instant.');
  return j as Classement;
}
export const lireClassement = () => appel();
export const envoyerMontee = (pseudo: string, etages: number, secondes: number) =>
  appel({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: aid(), pseudo, etages, secondes }),
  });

// Liste <li> d'un classement, la ligne du joueur mise en avant (ajoutée en bas s'il est hors du top).
export function rendreClassement(ol: HTMLElement, c: Classement) {
  ol.innerHTML = '';
  const lignes = [...c.top];
  if (c.moi && !c.top.some(l => l.moi)) lignes.push(c.moi);
  for (const l of lignes) {
    const li = document.createElement('li');
    li.className = l.moi ? 'moi' : '';
    const m = Math.floor(l.secondes / 60),
      s = l.secondes % 60;
    li.innerHTML = `<b>${l.rang}</b><span></span><em>étage ${l.etages}</em><small>${m}:${String(s).padStart(2, '0')}</small>`;
    li.querySelector('span')!.textContent = l.pseudo; // pseudo écrit par un joueur : jamais en HTML
    ol.append(li);
  }
  if (!lignes.length) ol.innerHTML = '<li class="vide">Personne encore : sois le premier.</li>';
}
