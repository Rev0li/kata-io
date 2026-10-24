// Barre du tutoriel et des exercices : consigne de l'étape, progression, fin du tutoriel.
import { XP_TUTO, COINS_TUTO } from '../sim/progression';
import { TutoStep } from '../game/tutorial';
import { controls } from './controls';
import { track } from '../analytics';
import { $, toast, restartAnim } from './dom';
import { nav } from './nav';
import { profile, save, addXp, addCoins, nextFloor } from './profile';
import { renderCoins } from './home';
import { startTower } from './launch';
import { leave } from './lobby';

export function onTuto(step: TutoStep | null, i: number, n: number, count: number) {
  const bar = $('#tutoBar'),
    drill = nav.lastMode.drill;
  bar.classList.toggle('done', !step);
  if (!step) {
    $('#tutoStep').textContent = 'Terminé';
    $('#tutoTxt').textContent = drill ? 'Technique maîtrisée !' : 'Bravo ! Direction la Tour du temple.';
    $('#tutoDots').innerHTML = '';
    return;
  }
  $('#tutoStep').textContent = drill ? 'Nouvelle technique' : `Tutoriel · étape ${i + 1} sur ${n}`;
  $('#tutoTxt').textContent = controls.isTouch && step.touch ? step.touch : step.text;
  $('#tutoDots').innerHTML =
    step.goal > 1
      ? Array.from({ length: step.goal }, (_, k) => `<i class="${k < count ? 'on' : ''}"></i>`).join('')
      : '';
  if (count === 0) restartAnim(bar);
}
export function onTutoDone() {
  const drill = nav.lastMode.drill;
  track('tutorial_completed', { drill: drill || null });
  if (drill) {
    toast('Technique maîtrisée');
    leave();
    return;
  }
  const first = !profile.tutoDone;
  profile.tutoDone = true;
  if (first) {
    addXp(XP_TUTO);
    addCoins(COINS_TUTO);
    renderCoins();
  }
  save();
  toast(first ? `+${XP_TUTO} XP et ${COINS_TUTO} pièces · la Tour du temple t'attend` : 'Tutoriel terminé');
  startTower(nextFloor());
}
// « Passer » : le tutoriel complet compte comme fait ; un exercice ramène à l'accueil.
export function skipTuto() {
  if (!nav.lastMode.drill) {
    profile.tutoDone = true;
    save();
    startTower(nextFloor());
  } else leave();
}
