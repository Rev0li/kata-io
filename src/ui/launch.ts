// Lancement des parties locales : étage de la Tour, défi du jour, tutoriel et exercices, entraînement contre le bot.
import { RANKS, abilFor, towerFloor, dailyFloor, Floor } from '../sim/progression';
import { session, MeSpec } from '../net/session';
import { MINI_TUTO, DRILLS, TutoStep } from '../game/tutorial';
import { setLocks } from './actionbar';
import { track } from '../analytics';
import { toast, wake } from './dom';
import { nav } from './nav';
import { profile, myRank, myAbil, rollDaily } from './profile';
import { myName, mySpec } from './home';
import { viewState } from './viewstate';

// Parties locales : le mode test peut rendre le joueur invincible (jamais en duel).
const local = (spec: MeSpec): MeSpec => (profile.god ? { ...spec, god: true } : spec);

export function startTower(n: number) {
  track('play_clicked', { kind: 'tower', floor: n });
  wake();
  myName();
  if (!profile.tutoDone) {
    startTuto(null);
    return;
  }
  nav.lastMode = { kind: 'tower', floor: n };
  const f = towerFloor(n);
  setLocks(myAbil());
  session.startTower(local(mySpec()), f, towerExtra(f, profile.tries[n] || 0));
  if (f.twist) setTimeout(() => toast(f.twist), 400);
}
// Gardien : ses techniques, plus la prochaine que tu vas débloquer (avant-goût) ; il nargue si tu reviens après une défaite.
function towerExtra(f: Floor, tries: number) {
  const abil = abilFor(f.tier),
    next = RANKS[myRank() + 1];
  let teaser = '';
  if (next && next.unlock && !f.daily) {
    const k = next.unlock.key,
      before = JSON.stringify(abil);
    if (k === 'chain2') abil.chain = Math.max(abil.chain, 2);
    else if (k === 'chain3') abil.chain = 3;
    else (abil as any)[k] = true;
    if (JSON.stringify(abil) !== before) teaser = next.unlock.title;
  }
  return { abil, attempt: tries + 1, taunt: tries >= 1 ? 'n' + Math.min(5, tries) : undefined, teaser };
}
export function startDaily() {
  track('play_clicked', { kind: 'daily' });
  wake();
  myName();
  if (!profile.tutoDone) {
    startTuto(null);
    return;
  }
  rollDaily();
  nav.lastMode = { kind: 'daily' };
  const f = dailyFloor(profile.daily.day);
  setLocks(myAbil());
  // le défi reste à la portée de la ceinture du joueur : au plus une technique d'avance
  session.startTower(local(mySpec()), f, {
    ...towerExtra(f, profile.daily.tries),
    abil: abilFor(Math.min(f.tier, myRank() + 1)),
  });
  setTimeout(
    () => toast(f.twist ? 'Défi du jour · ' + f.twist : 'Défi du jour : le même adversaire pour tout le monde'),
    400,
  );
}
// drill : exercice d'une technique (après une nouvelle ceinture) ; null : le tutoriel complet.
export function startTuto(drill: string | null) {
  wake();
  myName();
  track('tutorial_started', { drill });
  nav.lastMode = { kind: 'tuto', drill };
  const steps: TutoStep[] = drill ? DRILLS[drill] : MINI_TUTO;
  setLocks(drill ? myAbil() : abilFor(0));
  session.startTuto(local(mySpec(drill ? myAbil() : abilFor(0))), steps);
}
// Entraînement contre le bot, dans le monde choisi à l'accueil.
export function practice(world = viewState.world) {
  track('play_clicked', { kind: 'practice', level: profile.level, world });
  wake();
  viewState.world = world;
  nav.lastMode = { kind: 'practice', world };
  setLocks(myAbil());
  session.startPractice(local(mySpec()), profile.level);
}
