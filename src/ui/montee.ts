// Montée de la Tour (version minimale, D14) : de l'étage 1 jusqu'à la dernière vie. Le temps de tous les combats
// s'additionne, défaites comprises : une vie perdue coûte aussi du temps au classement.
// Aucune dépendance au DOM ni à Phaser : l'écran de résultat et l'affichage en combat lisent cet état.
export const VIES = 3;
export const montee = { etages: 0, secondes: 0, vies: VIES };

export function nouvelleMontee() {
  montee.etages = 0;
  montee.secondes = 0;
  montee.vies = VIES;
}
// Fin du combat de l'étage n. 'monte' : étage gagné ; 'rejoue' : perdu, il reste des vies, on retente le même étage ;
// 'fin' : dernière vie perdue, la montée s'arrête.
export type Suite = 'monte' | 'rejoue' | 'fin';
export function finEtage(gagne: boolean, n: number, secondes: number): Suite {
  montee.secondes += secondes;
  if (gagne) {
    montee.etages = n;
    return 'monte';
  }
  montee.vies = Math.max(0, montee.vies - 1);
  return montee.vies > 0 ? 'rejoue' : 'fin';
}
export const coeurs = (vies = montee.vies) => '♥'.repeat(vies) + '♡'.repeat(Math.max(0, VIES - vies));
