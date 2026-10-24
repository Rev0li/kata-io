// Écrans HTML posés au-dessus du jeu : accueil, salon d'invitation, connexion, résultat.
import { session } from '../net/session';
import { hostRoom, joinRoom, cleanCode, NetKind, HostHandle } from '../net/transport';
import { TENUES, MASQUES, LEVELS, sanitizeLook, Look } from '../sim/data';
import { controls, clearKeys } from './controls';
import { initAudio, startMusic, sfx, audioPrefs, setMusicLevel } from '../game/audio';
import { Spec } from '../sim/sim';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const PROFILE_KEY = 'kata-io-dev-profile';
interface Profile { name: string; look: Look; level: number; sfx: boolean; music: boolean }
function loadProfile(): Profile {
  let p: any = null; try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { /* stockage indisponible */ }
  p = p && typeof p === 'object' ? p : {};
  return { name: typeof p.name === 'string' ? p.name.slice(0, 16) : '', look: sanitizeLook(p.look), level: [0, 1, 2].includes(p.level) ? p.level : 1, sfx: p.sfx !== false, music: p.music !== false };
}
const profile = loadProfile();
function save() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { /* rien */ } }

const params = new URLSearchParams(location.search);
const net: NetKind = params.get('net') === 'local' ? 'local' : 'peer';
let host: HostHandle | null = null;
let current = 'home';
const SCREENS = ['home', 'lobby', 'joining', 'result', 'lost', 'quit'];

function show(id: string | null) {
  current = id || '';
  for (const s of SCREENS) $('#' + s).hidden = s !== id;
  $('#quitBtn').hidden = !!id || !session.active;
  $('#touch').hidden = !!id || !session.active || !controls.isTouch;
  $('#actions').hidden = !!id || !session.active;
  if (id === 'joining') $('#joinSpin').hidden = false;
  if (id) clearKeys();
}
controls.blockedFn = () => current !== '';
function toast(msg: string) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout((toast as any)._t); (toast as any)._t = setTimeout(() => t.classList.remove('on'), 2200); }
function myName() { const v = ($('#nameIn') as HTMLInputElement).value.trim().slice(0, 16); profile.name = v || profile.name || 'Disciple ' + ((Math.random() * 900 + 100) | 0); ($('#nameIn') as HTMLInputElement).value = profile.name; save(); return profile.name; }
function mySpec(): Spec { return { name: myName(), look: profile.look }; }
function inviteLink(code: string) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('salle', code); if (net === 'local') u.searchParams.set('net', 'local'); return u.toString(); }
function cleanUrl() { const u = new URL(location.href); u.searchParams.delete('salle'); history.replaceState(null, '', u.toString()); }
function wake() { initAudio(); startMusic(); }

/* ---------- apparence ---------- */
const TK = Object.keys(TENUES), MK = Object.keys(MASQUES);
function renderLook() {
  $('#tenueName').textContent = TENUES[profile.look.tenue].name;
  $('#masqueName').textContent = MASQUES[profile.look.masque];
  ($('#tenueSw') as HTMLElement).style.background = `linear-gradient(90deg,${TENUES[profile.look.tenue].body} 0 70%,${TENUES[profile.look.tenue].trim} 70%)`;
}
function cycle(kind: 'tenue' | 'masque', d: number) {
  const list = kind === 'tenue' ? TK : MK; const i = list.indexOf(profile.look[kind]);
  profile.look = { ...profile.look, [kind]: list[(i + d + list.length) % list.length] }; save(); renderLook(); sfx('ui');
}

/* ---------- actions ---------- */
async function createRoom() {
  wake(); myName(); show('lobby');
  $('#lobbyCode').textContent = '······'; ($('#lobbyLink') as HTMLInputElement).value = ''; $('#lobbyStatus').textContent = 'Création de la salle…'; $('#lobbyWait').hidden = true;
  try {
    host = await hostRoom(net, conn => { session.startHost(conn, mySpec()); }, err => toast(err));
    revealCode(host.code); ($('#lobbyLink') as HTMLInputElement).value = inviteLink(host.code);
    $('#lobbyStatus').textContent = 'En attente de ton adversaire. Envoie-lui le lien.'; $('#lobbyWait').hidden = false;
    ($('#shareBtn') as HTMLButtonElement).hidden = !navigator.share;
  } catch (e: any) { $('#lobbyStatus').textContent = e.message || 'Impossible de créer la salle.'; $('#lobbyWait').hidden = true; }
}
async function join(codeRaw: string) {
  const code = cleanCode(codeRaw); if (code.length < 4) { toast('Code de salle invalide'); return; }
  wake(); myName(); show('joining');
  $('#joinTitle').textContent = 'Salle ' + code; $('#joinStatus').textContent = 'Connexion à la salle…';
  try { const conn = await joinRoom(net, code); session.startGuest(conn, mySpec()); }
  catch (e: any) { $('#joinStatus').textContent = e.message || 'Connexion impossible.'; $('#joinSpin').hidden = true; }
}
function practice() { wake(); session.startPractice(mySpec(), profile.level); }
function leave() {
  session.leave(true); if (host) { host.close(); host = null; } cleanUrl(); renderHome(); show('home');
}
function renderHome() {
  ($('#nameIn') as HTMLInputElement).value = profile.name; renderLook();
  document.querySelectorAll<HTMLButtonElement>('#lvls button').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.l! === profile.level)));
  ($('#setSfx') as HTMLInputElement).checked = profile.sfx; ($('#setMusic') as HTMLInputElement).checked = profile.music;
}

/* ---------- liaison avec la partie ---------- */
let endTimer = 0;
session.hooks = {
  onStart() { clearTimeout(endTimer); if (host) { host.close(); host = null; } show(null); },
  onEnd(winner, score) {
    endTimer = window.setTimeout(() => {
      const win = winner === session.myIdx; const st = session.state; const op = st ? st.f[1 - session.myIdx] : null;
      $('#resTitle').textContent = win ? 'Victoire' : 'Défaite'; $('#resTitle').className = win ? 'win' : 'lose';
      $('#resScore').textContent = `${score[session.myIdx]} – ${score[1 - session.myIdx]} contre ${op ? op.name : 'ton adversaire'}`;
      $('#resStatus').textContent = session.mode === 'practice' ? '' : 'Une revanche ? Il faut que vous la demandiez tous les deux.';
      ($('#rematchBtn') as HTMLButtonElement).disabled = false; $('#rematchLbl').textContent = 'Revanche';
      sfx(win ? 'win' : 'lose'); show('result'); restartAnim($('#resTitle')); if (win) confetti();
    }, 1400);
  },
  onRematch(me, them) {
    const st = session.state; const op = st ? st.f[1 - session.myIdx].name : 'Ton adversaire';
    $('#resStatus').textContent = me && them ? 'C’est reparti !' : me ? `En attente de ${op}…` : `${op} veut une revanche.`;
    if (me) { ($('#rematchBtn') as HTMLButtonElement).disabled = true; $('#rematchLbl').textContent = 'Revanche demandée'; }
  },
  onDisconnect() { if (current === 'home') return; $('#lostMsg').textContent = 'Ton adversaire s’est déconnecté.'; show('lost'); },
  onStatus(msg) { if (msg) { $('#lobbyStatus').textContent = msg; $('#joinStatus').textContent = msg; } },
};

// Petits effets d'interface : onde sous le doigt, survol sonore, lettres du code, confettis.
function restartAnim(el: HTMLElement) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
function revealCode(code: string) { $('#lobbyCode').innerHTML = [...code].map((c, i) => `<span style="animation-delay:${i * 70}ms">${c}</span>`).join(''); }
function confetti() {
  const box = $('#confetti'); box.innerHTML = '';
  const cols = ['#f2c14e', '#e0a243', '#ecdfc6', '#62c2a2', '#f2a7c3', '#e5483a'];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement('i'); const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170;
    el.style.background = cols[i % cols.length];
    el.style.setProperty('--dx', Math.cos(a) * d + 'px'); el.style.setProperty('--dy', Math.sin(a) * d * 0.8 + 60 + 'px'); el.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    el.style.animationDelay = Math.random() * 120 + 'ms'; box.append(el);
  }
}
function setupButtonFx() {
  document.addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest('.btn-play, .btn2, .ghost') as HTMLElement | null; if (!b || (b as HTMLButtonElement).disabled) return;
    const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
    s.className = 'ripple'; s.style.width = s.style.height = size + 'px'; s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px';
    b.append(s); setTimeout(() => s.remove(), 600); sfx('ui');
  });
  document.addEventListener('pointerover', e => {
    if (controls.isTouch) return;
    const b = (e.target as HTMLElement).closest('.btn-play, .btn2') as HTMLElement | null;
    const from = (e.relatedTarget as HTMLElement | null)?.closest?.('.btn-play, .btn2');
    if (b && b !== from && !(b as HTMLButtonElement).disabled) sfx('hover');
  });
}

export function setupUI() {
  setupButtonFx();
  renderHome();
  audioPrefs.sfx = profile.sfx; audioPrefs.music = profile.music;
  $('#createBtn').addEventListener('click', createRoom);
  $('#practiceBtn').addEventListener('click', practice);
  $('#joinForm').addEventListener('submit', e => { e.preventDefault(); join(($('#codeIn') as HTMLInputElement).value); });
  $('#codeIn').addEventListener('input', e => { const i = e.target as HTMLInputElement; i.value = cleanCode(i.value); });
  $('#nameIn').addEventListener('change', () => myName());
  $('#tPrev').addEventListener('click', () => cycle('tenue', -1)); $('#tNext').addEventListener('click', () => cycle('tenue', 1));
  $('#mPrev').addEventListener('click', () => cycle('masque', -1)); $('#mNext').addEventListener('click', () => cycle('masque', 1));
  document.querySelectorAll<HTMLButtonElement>('#lvls button').forEach(b => b.addEventListener('click', () => { profile.level = +b.dataset.l!; save(); renderHome(); sfx('ui'); }));
  $('#setSfx').addEventListener('change', e => { profile.sfx = audioPrefs.sfx = (e.target as HTMLInputElement).checked; save(); });
  $('#setMusic').addEventListener('change', e => { profile.music = audioPrefs.music = (e.target as HTMLInputElement).checked; save(); wake(); setMusicLevel(0.07); });
  $('#copyBtn').addEventListener('click', async () => {
    const v = ($('#lobbyLink') as HTMLInputElement).value; if (!v) return;
    const b = $('#copyBtn');
    try { await navigator.clipboard.writeText(v); b.textContent = 'Copié ✓'; b.classList.add('ok'); setTimeout(() => { b.textContent = 'Copier'; b.classList.remove('ok'); }, 1600); } catch (e) { ($('#lobbyLink') as HTMLInputElement).select(); toast('Sélectionne le lien et copie-le'); }
  });
  $('#shareBtn').addEventListener('click', () => { const v = ($('#lobbyLink') as HTMLInputElement).value; if (v && navigator.share) navigator.share({ title: 'Kata.io', text: 'Je te défie en duel sur Kata.io', url: v }).catch(() => { /* annulé */ }); });
  $('#lobbyCancel').addEventListener('click', leave);
  $('#joinCancel').addEventListener('click', leave);
  $('#rematchBtn').addEventListener('click', () => { session.requestRematch(); });
  $('#resHome').addEventListener('click', leave);
  $('#lostHome').addEventListener('click', leave);
  $('#quitBtn').addEventListener('click', () => show('quit'));
  $('#quitYes').addEventListener('click', leave);
  $('#quitNo').addEventListener('click', () => show(null));
  window.addEventListener('keydown', e => {
    if (e.code !== 'Escape') return;
    if (current === '' && session.active) show('quit'); else if (current === 'quit') show(null);
  });
  const code = cleanCode(params.get('salle') || '');
  if (code) {
    $('#homeJoinNote').hidden = false; $('#homeJoinNote').textContent = `Tu es invité dans la salle ${code}. Choisis ton nom puis rejoins le duel.`;
    ($('#codeIn') as HTMLInputElement).value = code; ($('#joinBtn') as HTMLButtonElement).classList.add('btn-play'); $('#joinBtn').textContent = 'Rejoindre le duel';
  }
  show('home');
  if (net === 'local') toast('Mode réseau local (deux onglets du même navigateur)');
}
