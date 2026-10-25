// Écrans HTML posés au-dessus du jeu : branchement des boutons, du clavier et des événements de la partie.
//
//   dom.ts      utilitaires ($, toast, animations, son des boutons)
//   nav.ts      écran affiché, dernier mode lancé
//   profile.ts  profil et progression (sauvegardés dans le navigateur)
//   home.ts     accueil (écran de jeu), entraînement, panneau de test
//   launch.ts   lancement des parties locales (Tour, défi du jour, tutoriel, entraînement)
//   floors.ts   liste des étages de la Tour
//   shop.ts     vestiaire : combattant, arme, traînées, ploufs
//   lobby.ts    duel privé (salle, invitation) et retour à l'accueil
//   result.ts   écran de fin de partie
//   tutobar.ts  barre du tutoriel
import { session } from '../net/session';
import { cleanCode } from '../net/transport';
import { controls } from './controls';
import { audioPrefs, setMusicLevel } from '../game/audio';
import { $, toast, wake, setupButtonFx } from './dom';
import { nav, show } from './nav';
import { viewState } from './viewstate';
import { profile, save, nextFloor } from './profile';
import { renderHome, goHome, myName, setupDevPanel, setupTraining, renderTraining } from './home';
import { startTower, startDaily, startTuto, practice } from './launch';
import { renderFloors } from './floors';
import { openShop, closeShop, selectTab, shopAction, LockerTab } from './shop';
import { net, inviteCode, createRoom, join, leave, closeHost } from './lobby';
import { onEnd, onRematch, cancelEnd, runMain, runAlt } from './result';
import { onTuto, onTutoDone, skipTuto } from './tutobar';

export function setupUI() {
  controls.blockedFn = () => nav.current !== '' && nav.current !== 'home'; // à l'accueil, on s'échauffe au clavier
  session.hooks = {
    onStart() {
      cancelEnd();
      closeHost();
      show(null);
    },
    onEnd,
    onRematch,
    onDisconnect() {
      if (nav.current === 'home') return;
      $('#lostMsg').textContent = 'Ton adversaire s’est déconnecté.';
      show('lost');
    },
    onStatus(msg) {
      if (msg) {
        $('#lobbyStatus').textContent = msg;
        $('#joinStatus').textContent = msg;
      }
    },
    onTuto,
    onTutoDone,
  };

  setupButtonFx();
  setupDevPanel();
  // vestiaire : par le bouton, ou en touchant son combattant sur la plateforme
  $('#lockerBtn').addEventListener('click', openShop);
  viewState.onHero = () => {
    if (nav.current === 'home') openShop();
  };
  $('#dailyBtn').addEventListener('click', startDaily);
  $('#shopClose').addEventListener('click', closeShop);
  $('#shopAct').addEventListener('click', shopAction);
  document
    .querySelectorAll<HTMLElement>('#shop .tab')
    .forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab as LockerTab)));

  setupTraining();
  audioPrefs.sfx = profile.sfx;
  audioPrefs.music = profile.music;
  // accueil
  $('#towerBtn').addEventListener('click', () => startTower(nextFloor()));
  $('#floorsBtn').addEventListener('click', () => {
    renderFloors();
    show('floors');
  });
  $('#floorsClose').addEventListener('click', () => show('home'));
  $('#trainBtn').addEventListener('click', () => {
    renderTraining();
    show('training');
  });
  $('#trainClose').addEventListener('click', () => show('home'));
  $('#practiceBtn').addEventListener('click', () => practice());
  $('#duelBtn').addEventListener('click', () => {
    renderHome();
    show('duel');
  });
  $('#duelClose').addEventListener('click', () => show('home'));
  $('#setBtn').addEventListener('click', () => show('settings'));
  $('#setClose').addEventListener('click', () => show('home'));
  $('#tutoBtn').addEventListener('click', () => startTuto(null));
  $('#tutoSkip').addEventListener('click', skipTuto);
  $('#createBtn').addEventListener('click', createRoom);
  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    join(($('#codeIn') as HTMLInputElement).value);
  });
  $('#codeIn').addEventListener('input', e => {
    const i = e.target as HTMLInputElement;
    i.value = cleanCode(i.value);
  });
  $('#nameIn').addEventListener('change', () => myName());
  // réglages
  $('#setAutoAim').addEventListener('change', e => {
    profile.autoAim = controls.autoAim = (e.target as HTMLInputElement).checked;
    save();
    toast(profile.autoAim ? 'Visée automatique activée' : 'Visée à la souris');
  });
  $('#setSfx').addEventListener('change', e => {
    profile.sfx = audioPrefs.sfx = (e.target as HTMLInputElement).checked;
    save();
  });
  $('#setMusic').addEventListener('change', e => {
    profile.music = audioPrefs.music = (e.target as HTMLInputElement).checked;
    save();
    wake();
    setMusicLevel(0.07);
  });
  // salon d'invitation
  $('#copyBtn').addEventListener('click', async () => {
    const v = ($('#lobbyLink') as HTMLInputElement).value;
    if (!v) return;
    const b = $('#copyBtn');
    try {
      await navigator.clipboard.writeText(v);
      b.textContent = 'Copié ✓';
      b.classList.add('ok');
      setTimeout(() => {
        b.textContent = 'Copier';
        b.classList.remove('ok');
      }, 1600);
    } catch (e) {
      ($('#lobbyLink') as HTMLInputElement).select();
      toast('Sélectionne le lien et copie-le');
    }
  });
  $('#shareBtn').addEventListener('click', () => {
    const v = ($('#lobbyLink') as HTMLInputElement).value;
    if (v && navigator.share)
      navigator.share({ title: 'Kata.io', text: 'Je te défie en duel sur Kata.io', url: v }).catch(() => {
        /* annulé */
      });
  });
  $('#lobbyCancel').addEventListener('click', leave);
  $('#joinCancel').addEventListener('click', leave);
  // résultat, déconnexion, quitter
  $('#resMain').addEventListener('click', runMain);
  $('#resAlt').addEventListener('click', runAlt);
  $('#resHome').addEventListener('click', leave);
  $('#lostHome').addEventListener('click', leave);
  $('#quitBtn').addEventListener('click', () => show('quit'));
  $('#quitYes').addEventListener('click', leave);
  $('#quitNo').addEventListener('click', () => show(null));
  window.addEventListener('keydown', e => {
    const current = nav.current;
    if (e.code === 'Escape') {
      if (current === '' && session.active) show('quit');
      else if (current === 'quit') show(null);
      else if (['floors', 'settings', 'training', 'duel'].includes(current)) show('home');
      else if (current === 'shop') closeShop();
      return;
    }
    // relance instantanée depuis l'écran de résultat
    if (
      current === 'result' &&
      (e.code === 'Space' || e.code === 'Enter') &&
      !($('#resMain') as HTMLButtonElement).disabled
    ) {
      e.preventDefault();
      runMain();
    }
  });
  // arrivée par un lien d'invitation
  if (inviteCode) {
    $('#homeJoinNote').hidden = false;
    $('#homeJoinNote').textContent = `Tu es invité dans la salle ${inviteCode}. Choisis ton nom puis rejoins le duel.`;
    ($('#codeIn') as HTMLInputElement).value = inviteCode;
    $('#joinBtn').classList.add('hot');
    $('#joinBtn').textContent = 'Rejoindre le duel';
  }
  goHome();
  if (inviteCode) show('duel');
  if (net === 'local') toast('Mode réseau local (deux onglets du même navigateur)');
}
