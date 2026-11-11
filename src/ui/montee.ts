// Montée de la Tour (version minimale, D14) : de l'étage 1 jusqu'à la dernière vie. Le temps de tous les combats
// s'additionne, défaites comprises : une vie perdue coûte aussi du temps au classement.
// Aucune dépendance au DOM ni à Phaser : l'écran de résultat et l'affichage en combat lisent cet état.
import { VIES } from '../sim/progression';
import type { Combat } from '../sim/rejeu';

export { VIES };
// ticket : graine donnée par le serveur de jeu pour une montée classée (null : montée non classée) ;
// combats : les combats enregistrés, dans l'ordre, que le serveur rejouera.
export const montee = {
  etages: 0,
  secondes: 0,
  vies: VIES,
  ticket: null as { montee: string; graine: number } | null,
  combats: [] as Combat[],
};

export function nouvelleMontee(ticket: { montee: string; graine: number } | null = null) {
  montee.etages = 0;
  montee.secondes = 0;
  montee.vies = VIES;
  montee.ticket = ticket;
  montee.combats = [];
}
// Fin du combat de l'étage n. 'monte' : étage gagné ; 'rejoue' : perdu, il reste des vies, on retente le même étage ;
// 'fin' : dernière vie perdue, la montée s'arrête.
export type Suite = 'monte' | 'rejoue' | 'fin';
// combat : l'enregistrement du combat (montée classée). S'il manque, la montée ne peut plus être vérifiée.
export function finEtage(gagne: boolean, n: number, secondes: number, combat: Combat | null = null): Suite {
  montee.secondes += secondes;
  if (montee.ticket) {
    if (combat) montee.combats.push(combat);
    else montee.ticket = null;
  }
  if (gagne) {
    montee.etages = n;
    return 'monte';
  }
  montee.vies = Math.max(0, montee.vies - 1);
  return montee.vies > 0 ? 'rejoue' : 'fin';
}
export const coeurs = (vies = montee.vies) => '♥'.repeat(vies) + '♡'.repeat(Math.max(0, VIES - vies));
