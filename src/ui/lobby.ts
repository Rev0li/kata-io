// Duel privé : création d'une salle (code, lien d'invitation, choix du dojo), arrivée d'un invité, retour à l'accueil.
import { DOJOS } from '../sim/data';
import { FULL_ABIL } from '../sim/progression';
import { session } from '../net/session';
import { hostRoom, joinRoom, cleanCode, NetKind, HostHandle } from '../net/transport';
import { setLocks } from './actionbar';
import { viewState } from './viewstate';
import { track } from '../analytics';
import { sfx } from '../game/audio';
import { $, toast, wake } from './dom';
import { nav, show } from './nav';
import { myName, mySpec, renderHome } from './home';

const params = new URLSearchParams(location.search);
export const net: NetKind = params.get('net') === 'local' ? 'local' : 'peer';
// Code de salle reçu dans le lien d'invitation (?salle=…), ou ''.
export const inviteCode = cleanCode(params.get('salle') || '');

let host: HostHandle | null = null;
let lobbyDojo = 'alea'; // dojo choisi dans le salon : un nom de DOJOS, ou 'alea' (tiré au sort au début du duel)

function renderDojoChips() {
  const box = $('#dojoChips');
  box.textContent = '';
  for (const [id, name] of [['alea', 'Au hasard'], ...DOJOS]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === lobbyDojo));
    b.addEventListener('click', () => {
      lobbyDojo = id;
      viewState.dojo = id === 'alea' ? null : id;
      renderDojoChips();
      sfx('ui');
    });
    box.append(b);
  }
}
const pickDojo = () => (lobbyDojo === 'alea' ? DOJOS[(Math.random() * DOJOS.length) | 0][0] : lobbyDojo);
function inviteLink(code: string) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('salle', code);
  if (net === 'local') u.searchParams.set('net', 'local');
  return u.toString();
}
function cleanUrl() {
  const u = new URL(location.href);
  u.searchParams.delete('salle');
  history.replaceState(null, '', u.toString());
}
function revealCode(code: string) {
  $('#lobbyCode').innerHTML = [...code].map((c, i) => `<span style="animation-delay:${i * 70}ms">${c}</span>`).join('');
}
// Le duel a commencé : la salle n'attend plus personne.
export function closeHost() {
  if (host) {
    host.close();
    host = null;
  }
}

export async function createRoom() {
  track('play_clicked', { kind: 'duel_create' });
  wake();
  myName();
  show('lobby');
  lobbyDojo = 'alea';
  viewState.dojo = null;
  renderDojoChips();
  $('#lobbyCode').textContent = '······';
  ($('#lobbyLink') as HTMLInputElement).value = '';
  $('#lobbyStatus').textContent = 'Création de la salle…';
  $('#lobbyWait').hidden = true;
  try {
    host = await hostRoom(
      net,
      conn => {
        nav.lastMode = { kind: 'duel' };
        setLocks(FULL_ABIL);
        session.startHost(conn, mySpec(FULL_ABIL), pickDojo());
        viewState.dojo = null;
      },
      err => toast(err),
    );
    revealCode(host.code);
    ($('#lobbyLink') as HTMLInputElement).value = inviteLink(host.code);
    $('#lobbyStatus').textContent = 'En attente de ton adversaire. Envoie-lui le lien.';
    $('#lobbyWait').hidden = false;
    $('#shareBtn').hidden = !navigator.share;
  } catch (e: any) {
    $('#lobbyStatus').textContent = e.message || 'Impossible de créer la salle.';
    $('#lobbyWait').hidden = true;
  }
}
export async function join(codeRaw: string) {
  const code = cleanCode(codeRaw);
  if (code.length < 4) {
    toast('Code de salle invalide');
    return;
  }
  track('invite_opened', {});
  wake();
  myName();
  show('joining');
  $('#joinTitle').textContent = 'Salle ' + code;
  $('#joinStatus').textContent = 'Connexion à la salle…';
  try {
    const conn = await joinRoom(net, code);
    nav.lastMode = { kind: 'duel' };
    setLocks(FULL_ABIL);
    session.startGuest(conn, mySpec(FULL_ABIL));
  } catch (e: any) {
    $('#joinStatus').textContent = e.message || 'Connexion impossible.';
    $('#joinSpin').hidden = true;
  }
}
// Quitte la partie ou la salle en cours et revient à l'accueil.
export function leave() {
  viewState.dojo = null;
  session.leave(true);
  closeHost();
  cleanUrl();
  renderHome();
  show('home');
}
