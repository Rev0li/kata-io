// Écrans HTML posés au-dessus du jeu : accueil, Tour du temple, salon d'invitation, résultat, tutoriel.
import { session, MeSpec } from '../net/session';
import { hostRoom, joinRoom, cleanCode, NetKind, HostHandle } from '../net/transport';
import { PERSOS, ARMES, TRAINEES, EJECTIONS, DEFAULT_LOOK, sanitizeLook, Look, DOJOS } from '../sim/data';
import {
  RANKS,
  rankIndex,
  rankProgress,
  abilFor,
  FULL_ABIL,
  towerFloor,
  TOWER_LEN,
  starsFor,
  towerXp,
  XP_DUEL_WIN,
  XP_DUEL_LOSS,
  XP_TUTO,
  XP_PRACTICE_WIN,
  Abil,
  towerCoins,
  COINS_PRACTICE,
  COINS_DUEL,
  COINS_TUTO,
  streakMult,
  Floor,
  dayKey,
  dailyFloor,
  DAILY_COINS,
  DAILY_XP,
} from '../sim/progression';
import { viewState } from './viewstate';
import { MINI_TUTO, DRILLS, TutoStep } from '../game/tutorial';
import { controls, clearKeys } from './controls';
import { setLocks } from './actionbar';
import { track } from '../analytics';
import { initAudio, startMusic, sfx, audioPrefs, setMusicLevel } from '../game/audio';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const PROFILE_KEY = 'kata-io-dev-profile';

/* ================= profil et progression ================= */
interface Profile {
  name: string;
  look: Look;
  level: number;
  sfx: boolean;
  music: boolean;
  xp: number;
  towerMax: number;
  stars: Record<string, number>;
  tutoDone: boolean;
  coins: number;
  owned: string[];
  streak: number;
  autoAim: boolean;
  tries: Record<string, number>;
  daily: { day: string; best: number; won: boolean; tries: number };
}
function loadProfile(): Profile {
  let p: any = null;
  try {
    p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch (e) {
    /* stockage indisponible */
  }
  p = p && typeof p === 'object' ? p : {};
  return {
    name: typeof p.name === 'string' ? p.name.slice(0, 16) : '',
    look: sanitizeLook(p.look),
    level: [0, 1, 2].includes(p.level) ? p.level : 1,
    sfx: p.sfx !== false,
    music: p.music !== false,
    xp: Number.isFinite(p.xp) && p.xp >= 0 ? p.xp : 0,
    towerMax: Number.isFinite(p.towerMax) && p.towerMax >= 1 ? Math.floor(p.towerMax) : 1,
    stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
    tutoDone: !!p.tutoDone,
    coins: Number.isFinite(p.coins) && p.coins >= 0 ? Math.floor(p.coins) : 0,
    owned: Array.isArray(p.owned) ? p.owned.filter((x: any) => typeof x === 'string') : [],
    streak: Number.isFinite(p.streak) && p.streak >= 0 ? Math.floor(p.streak) : 0,
    autoAim: p.autoAim !== false,
    tries: p.tries && typeof p.tries === 'object' ? p.tries : {},
    daily:
      p.daily && typeof p.daily === 'object' && typeof p.daily.day === 'string'
        ? { day: p.daily.day, best: +p.daily.best || 0, won: !!p.daily.won, tries: +p.daily.tries || 0 }
        : { day: '', best: 0, won: false, tries: 0 },
  };
}
const profile = loadProfile();
function save() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    /* rien */
  }
}
const myRank = () => rankIndex(profile.xp);
const myAbil = (): Abil => abilFor(myRank());
// Ajoute de l'XP et renvoie la ceinture gagnée, s'il y en a une.
function addXp(n: number) {
  const before = myRank();
  profile.xp += n;
  save();
  const after = myRank();
  return after > before ? after : -1;
}

const params = new URLSearchParams(location.search);
const net: NetKind = params.get('net') === 'local' ? 'local' : 'peer';
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
let current = 'home';
const SCREENS = ['home', 'floors', 'shop', 'lobby', 'joining', 'result', 'lost', 'quit'];
let lastMode: { kind: 'tower' | 'practice' | 'duel' | 'tuto' | 'daily'; floor?: number; drill?: string | null } = {
  kind: 'tower',
  floor: 1,
};

function show(id: string | null) {
  current = id || '';
  for (const s of SCREENS) $('#' + s).hidden = s !== id;
  const inGame = !id && session.active;
  $('#quitBtn').hidden = !inGame;
  document.body.classList.toggle('ingame', inGame);
  $('#touch').hidden = !inGame || !controls.isTouch;
  $('#actions').hidden = !inGame;
  $('#tutoBar').hidden = !inGame || session.mode !== 'tuto';
  if (id === 'joining') $('#joinSpin').hidden = false;
  if (id) clearKeys();
}
controls.blockedFn = () => current !== '';
function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout((toast as any)._t);
  (toast as any)._t = setTimeout(() => t.classList.remove('on'), 2400);
}
function myName() {
  const v = ($('#nameIn') as HTMLInputElement).value.trim().slice(0, 16);
  profile.name = v || profile.name || 'Disciple ' + ((Math.random() * 900 + 100) | 0);
  ($('#nameIn') as HTMLInputElement).value = profile.name;
  save();
  return profile.name;
}
function mySpec(abil: Abil = myAbil()): MeSpec {
  return { name: myName(), look: myLook(), abil, belt: RANKS[myRank()].belt };
}
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
function wake() {
  initAudio();
  startMusic();
}

/* ================= apparence : personnages gagnés dans la Tour, armes gagnées avec les ceintures ================= */
const PK = Object.keys(PERSOS),
  AK = Object.keys(ARMES);
const persoOpen = (id: string) => PERSOS[id].floor === 0 || profile.towerMax > PERSOS[id].floor;
const armeOpen = (id: string) => myRank() >= ARMES[id].rank;
// Le look réellement utilisé : si un choix n'est plus débloqué (remise à zéro), on revient au défaut.
function myLook(): Look {
  const l = profile.look;
  return {
    ...l,
    perso: persoOpen(l.perso) ? l.perso : DEFAULT_LOOK.perso,
    arme: armeOpen(l.arme) ? l.arme : DEFAULT_LOOK.arme,
    trainee: owns('trainee', l.trainee) ? l.trainee : 'aucune',
    ejection: owns('ejection', l.ejection) ? l.ejection : 'plouf',
  };
}
let viewP = -1,
  viewA = -1; // ce que montre le sélecteur (peut être verrouillé)
function setFace(el: HTMLElement, id: string) {
  el.style.setProperty('--i', String(PERSOS[id].idx));
}
function setWico(el: HTMLElement, id: string) {
  const w = ARMES[id];
  el.classList.toggle('none', w.idx < 0);
  if (w.idx >= 0) el.style.setProperty('--i', String(w.idx));
}
function renderLook() {
  const l = myLook();
  if (viewP < 0) viewP = PK.indexOf(l.perso);
  if (viewA < 0) viewA = AK.indexOf(l.arme);
  const p = PK[viewP],
    a = AK[viewA],
    po = persoOpen(p),
    ao = armeOpen(a);
  setFace($('#persoFace'), p);
  $('#persoName').textContent = PERSOS[p].name;
  $('#persoReq').textContent = po ? '' : `Bats le gardien de l’étage ${PERSOS[p].floor}`;
  $('#persoCyc').classList.toggle('locked', !po);
  setWico($('#armeIco'), a);
  $('#armeName').textContent = ARMES[a].name;
  $('#armeReq').textContent = ao ? '' : RANKS[ARMES[a].rank].name;
  $('#armeCyc').classList.toggle('locked', !ao);
  const np = PK.filter(persoOpen).length,
    na = AK.filter(armeOpen).length;
  $('#lookCount').textContent = `${np} combattants sur ${PK.length} · ${na} armes sur ${AK.length}`;
  setFace($('#rankFaceImg'), l.perso);
}
function cycle(kind: 'perso' | 'arme', d: number) {
  if (kind === 'perso') {
    viewP = (viewP + d + PK.length) % PK.length;
    if (persoOpen(PK[viewP])) profile.look = { ...profile.look, perso: PK[viewP] };
  } else {
    viewA = (viewA + d + AK.length) % AK.length;
    if (armeOpen(AK[viewA])) profile.look = { ...profile.look, arme: AK[viewA] };
  }
  save();
  renderLook();
  sfx('ui');
}
const SCROLLS: Record<string, string> = {
  chain2: 'scroll-plant',
  parry: 'scroll-ice',
  charge: 'scroll-rock',
  chain3: 'scroll-empty',
  elan: 'scroll-thunder',
  dragon: 'scroll-fire',
};

/* ================= boutique d'effets (pièces gagnées en jouant) ================= */
type ShopKind = 'trainee' | 'ejection';
const CATALOG = { trainee: TRAINEES, ejection: EJECTIONS } as Record<
  ShopKind,
  Record<string, { name: string; price: number; icon: [string, number, number] }>
>;
function owns(kind: ShopKind, id: string) {
  const it = CATALOG[kind][id];
  return !!it && (it.price === 0 || profile.owned.includes(kind + ':' + id));
}
function addCoins(n: number) {
  profile.coins += n;
  save();
  renderCoins();
}
function renderCoins() {
  $('#homeCoins').textContent = String(profile.coins);
  $('#shopCoins').textContent = String(profile.coins);
}
let shopTab: ShopKind = 'trainee',
  shopSel = '';
const ICON_AR: Record<string, number> = { leaf: 7 / 12, chest: 14 / 16 }; // hauteur / largeur des images non carrées
function iconStyle(icon: [string, number, number]) {
  return `background-image:url(/assets/fx/${icon[0]}.png);--n:${icon[1]};--f:${icon[2]};--ar:${ICON_AR[icon[0]] || 1}`;
}
// La vitrine est un vrai combat scripté derrière le panneau : ton combattant frappe le mannequin
// (traînée) ou l'envoie à l'eau (plouf), du côté du dojo que le panneau ne cache pas.
function openShop() {
  wake();
  viewState.shop = true;
  session.startShowcase(mySpec(FULL_ABIL));
  show('shop');
  shopSel = myLook()[shopTab];
  renderShop();
  preview(shopSel);
}
function closeShop() {
  viewState.shop = false;
  session.leave(true);
  renderHome();
  show('home');
}
function preview(id: string) {
  session.showcase(shopTab, { ...myLook(), [shopTab]: id }, [-1, 0]); // éjection vers la gauche : jamais sous le panneau
}
function renderShop() {
  renderCoins();
  document
    .querySelectorAll<HTMLElement>('#shop .tab')
    .forEach(t => t.classList.toggle('on', t.dataset.tab === shopTab));
  const grid = $('#shopGrid');
  grid.innerHTML = '';
  const cur = myLook()[shopTab];
  for (const [id, it] of Object.entries(CATALOG[shopTab])) {
    const own = owns(shopTab, id),
      on = cur === id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sitem' + (own ? ' owned' : '') + (on ? ' on' : '') + (id === shopSel ? ' sel' : '');
    const st = on
      ? '<span class="st">Équipé</span>'
      : own
        ? '<span class="st">Possédé</span>'
        : `<span class="st price${profile.coins < it.price ? ' short' : ''}"><img class="px" src="/assets/items/gold-coin.png" alt="">${it.price}</span>`;
    b.innerHTML = `<i class="sico" style="${iconStyle(it.icon)}"></i><b>${it.name}</b>${st}`;
    b.addEventListener('click', () => {
      shopSel = id;
      renderShop();
      preview(id);
      sfx('ui');
    });
    grid.append(b);
  }
  const it = CATALOG[shopTab][shopSel],
    act = $('#shopAct') as HTMLButtonElement,
    own = owns(shopTab, shopSel);
  act.disabled = false;
  act.classList.remove('short');
  if (cur === shopSel) {
    $('#shopActLbl').textContent = 'Équipé';
    act.disabled = true;
  } else if (own) $('#shopActLbl').textContent = 'Équiper';
  else if (profile.coins >= it.price)
    $('#shopActLbl').innerHTML =
      `Acheter · ${it.price} <img class="px coin" src="/assets/items/gold-coin.png" alt="pièces">`;
  else {
    $('#shopActLbl').textContent = `Encore ${it.price - profile.coins} pièces`;
    act.disabled = true;
  }
}
function shopAction() {
  const it = CATALOG[shopTab][shopSel];
  if (!it) return;
  if (!owns(shopTab, shopSel)) {
    if (profile.coins < it.price) return;
    profile.coins -= it.price;
    profile.owned.push(shopTab + ':' + shopSel);
    sfx('coin', 1.2);
    toast(`${it.name} : à toi !`);
  } else sfx('ui');
  profile.look = { ...profile.look, [shopTab]: shopSel };
  save();
  renderShop();
  preview(shopSel);
}

/* ================= accueil ================= */
const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
function nextFloor() {
  return Math.max(1, profile.towerMax);
}
function renderHome() {
  ($('#nameIn') as HTMLInputElement).value = profile.name;
  viewP = viewA = -1;
  renderLook();
  const rp = rankProgress(profile.xp);
  $('#rankBelt').style.background = rp.cur.belt;
  $('#rankName').textContent = rp.cur.name;
  ($('#rankXp') as HTMLElement).style.width = Math.round(rp.frac * 100) + '%';
  $('#rankNext').textContent = rp.next
    ? `${profile.xp} / ${rp.next.xp} XP · prochaine technique : ${rp.next.unlock!.title}`
    : `${profile.xp} XP · toutes les techniques sont débloquées`;
  rollDaily();
  const dly = profile.daily;
  $('#dailySub').textContent = dly.won
    ? `Record du jour : ${dly.best} s · tu peux faire mieux`
    : `${dailyFloor(dly.day).name} · gagne-le : +${DAILY_COINS} pièces` +
      (dly.tries ? ` · ${dly.tries} essai${dly.tries > 1 ? 's' : ''}` : '');
  const f = towerFloor(nextFloor());
  $('#towerSub').textContent = !profile.tutoDone
    ? 'Commence par le tutoriel (1 min)'
    : profile.streak >= 2
      ? `Étage ${f.n} · série de ${profile.streak} · prochain gain ×${streakMult(profile.streak + 1)}`
      : `Étage ${f.n} · ${f.name}`;
  renderCoins();
  ($('#setSfx') as HTMLInputElement).checked = profile.sfx;
  ($('#setMusic') as HTMLInputElement).checked = profile.music;
  ($('#setAutoAim') as HTMLInputElement).checked = profile.autoAim;
  controls.autoAim = profile.autoAim;
  ($('#devRank') as HTMLSelectElement).value = String(myRank());
  ($('#devFloor') as HTMLSelectElement).value = String(Math.min(profile.towerMax, 20));
  ($('#devLvl') as HTMLSelectElement).value = String(profile.level);
}
function renderFloors() {
  const max = profile.towerMax,
    top = Math.max(TOWER_LEN, max + 1);
  const ol = $('#floorList');
  ol.innerHTML = '';
  for (let n = 1; n <= top; n++) {
    const f = towerFloor(n),
      locked = n > max,
      st = profile.stars[n] || 0;
    const li = document.createElement('li');
    li.className = (f.boss ? 'boss ' : '') + (locked ? 'locked ' : '') + (n === max ? 'cur' : '');
    const gift = n <= TOWER_LEN ? PK.find(id => PERSOS[id].floor === n) : undefined;
    const reward = gift ? (n < max ? `Gagné : ${PERSOS[gift].name}` : 'Récompense : son apparence') : '';
    li.innerHTML = `<span class="fn">${n}</span><i class="face${locked ? ' mystery' : ''}" style="--i:${PERSOS[f.look.perso].idx}"></i><span class="fi"><b>${locked ? '???' : f.name}${f.boss ? ' · gardien' : ''}</b><small>${[f.twist || (f.firstTo === 3 ? 'Premier à 3' : 'Premier à 2'), reward].filter(Boolean).join(' · ')}</small></span>`;
    const right = document.createElement('span');
    if (locked) right.innerHTML = '<span class="fs">Verrouillé</span>';
    else {
      const b = document.createElement('button');
      b.className = 'btn2';
      b.type = 'button';
      b.textContent = st ? starStr(st) : 'Combattre';
      b.addEventListener('click', () => startTower(n));
      right.append(b);
    }
    li.append(right);
    ol.append(li);
  }
  const cur = ol.querySelector('.cur');
  if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);
}

/* ================= lancements ================= */
function applyLocks(a: Abil) {
  setLocks(a);
}
function startTower(n: number) {
  track('play_clicked', { kind: 'tower', floor: n });
  wake();
  myName();
  if (!profile.tutoDone) {
    startTuto(null);
    return;
  }
  lastMode = { kind: 'tower', floor: n };
  const f = towerFloor(n);
  applyLocks(myAbil());
  session.startTower(mySpec(), f, towerExtra(f, profile.tries[n] || 0));
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
function rollDaily() {
  const k = dayKey();
  if (profile.daily.day !== k) {
    profile.daily = { day: k, best: 0, won: false, tries: 0 };
    save();
  }
}
function startDaily() {
  track('play_clicked', { kind: 'daily' });
  wake();
  myName();
  if (!profile.tutoDone) {
    startTuto(null);
    return;
  }
  rollDaily();
  lastMode = { kind: 'daily' };
  const f = dailyFloor(profile.daily.day);
  applyLocks(myAbil());
  // le défi reste à la portée de la ceinture du joueur : au plus une technique d'avance
  session.startTower(mySpec(), f, {
    ...towerExtra(f, profile.daily.tries),
    abil: abilFor(Math.min(f.tier, myRank() + 1)),
  });
  setTimeout(
    () => toast(f.twist ? 'Défi du jour · ' + f.twist : 'Défi du jour : le même adversaire pour tout le monde'),
    400,
  );
}
const nth = (n: number) => (n === 1 ? '1er' : n + 'e');
function startTuto(drill: string | null) {
  wake();
  myName();
  track('tutorial_started', { drill });
  lastMode = { kind: 'tuto', drill };
  const steps: TutoStep[] = drill ? DRILLS[drill] : MINI_TUTO;
  applyLocks(drill ? myAbil() : abilFor(0));
  session.startTuto(mySpec(drill ? myAbil() : abilFor(0)), steps);
}
function practice() {
  track('play_clicked', { kind: 'practice', level: profile.level });
  wake();
  lastMode = { kind: 'practice' };
  applyLocks(myAbil());
  session.startPractice(mySpec(), profile.level);
}
async function createRoom() {
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
        lastMode = { kind: 'duel' };
        applyLocks(FULL_ABIL);
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
async function join(codeRaw: string) {
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
    lastMode = { kind: 'duel' };
    applyLocks(FULL_ABIL);
    session.startGuest(conn, mySpec(FULL_ABIL));
  } catch (e: any) {
    $('#joinStatus').textContent = e.message || 'Connexion impossible.';
    $('#joinSpin').hidden = true;
  }
}
function leave() {
  viewState.dojo = null;
  session.leave(true);
  if (host) {
    host.close();
    host = null;
  }
  cleanUrl();
  renderHome();
  show('home');
}

/* ================= résultats ================= */
let mainAction: () => void = () => {},
  altAction: (() => void) | null = null;
function setResultButtons(main: string, onMain: () => void, alt: string | null, onAlt: (() => void) | null) {
  $('#resMainLbl').textContent = main;
  mainAction = onMain;
  ($('#resMain') as HTMLButtonElement).disabled = false;
  const a = $('#resAlt');
  a.hidden = !alt;
  if (alt) a.textContent = alt;
  altAction = onAlt;
  $('#resRow').style.gridTemplateColumns = alt ? '1fr 1fr' : '1fr';
  $('#resHint').textContent = `Espace : ${main.toLowerCase()}`;
}
function showUnlock(rank: number) {
  const r = RANKS[rank],
    u = r.unlock;
  const box = $('#resUnlock');
  if (!u) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('#unlockBelt').textContent = r.name;
  $('#unlockTitle').textContent = u.title + ' :';
  $('#unlockText').textContent = u.text + ' ' + u.how;
  ($('#unlockScroll') as HTMLImageElement).src = `/assets/items/${SCROLLS[u.key] || 'scroll-empty'}.png`;
  const w = AK.find(id => ARMES[id].rank === rank);
  $('#unlockWpn').hidden = !w;
  if (w) {
    setWico($('#unlockWpnIco'), w);
    $('#unlockWpnTxt').textContent = `Nouvelle arme : ${ARMES[w].name}`;
  }
  $('#unlockTry').onclick = () =>
    startTuto(u.key === 'chain2' ? 'chain2' : u.key === 'chain3' ? 'chain3' : String(u.key));
  sfx('gong', 0.7);
}
function showPerso(id: string) {
  $('#resPerso').hidden = false;
  setFace($('#resPersoFace'), id);
  $('#resPersoName').textContent = PERSOS[id].name;
  const b = $('#resPersoUse') as HTMLButtonElement;
  b.disabled = false;
  b.textContent = 'Le prendre';
  b.onclick = () => {
    profile.look = { ...profile.look, perso: id };
    save();
    viewP = -1;
    renderLook();
    b.disabled = true;
    b.textContent = 'C’est ton combattant';
  };
}
function showXp(gain: number, before: number, coins = 0) {
  $('#resXp').hidden = gain <= 0;
  if (gain <= 0) return;
  $('#resXpTxt').innerHTML =
    `+${gain} XP` +
    (coins ? ` <span class="coingain"><img class="px" src="/assets/items/gold-coin.png" alt="">+${coins}</span>` : '');
  const bar = $('#resXpBar') as HTMLElement;
  const rp0 = rankProgress(before),
    rp1 = rankProgress(profile.xp);
  bar.style.transition = 'none';
  bar.style.width = Math.round((rp1.i > rp0.i ? 0 : rp0.frac) * 100) + '%';
  void bar.offsetWidth;
  bar.style.transition = '';
  setTimeout(() => {
    bar.style.width = Math.round(rp1.frac * 100) + '%';
  }, 250);
}
let endTimer = 0;
function onEnd(winner: number, score: number[]) {
  endTimer = window.setTimeout(() => {
    const win = winner === session.myIdx,
      st = session.state,
      me = st ? st.f[session.myIdx] : null,
      op = st ? st.f[1 - session.myIdx] : null;
    const sMe = score[session.myIdx],
      sOp = score[1 - session.myIdx];
    $('#resTitle').className = win ? 'win' : 'lose';
    $('#resStatus').textContent = '';
    $('#resNear').hidden = true;
    $('#resUnlock').hidden = true;
    $('#resPerso').hidden = true;
    $('#resStreak').hidden = true;
    let coins = 0;
    const starsEl = $('#resStars');
    starsEl.hidden = true;
    starsEl.querySelectorAll('i').forEach(i => i.classList.remove('on'));
    const xpBefore = profile.xp;
    let gain = 0,
      newRank = -1;
    if (!win && op && op.pct >= 70) {
      $('#resNear').hidden = false;
      $('#resNear').textContent = `Il était à ${Math.round(op.pct)} % : encore un coup et il tombait.`;
    }
    if (session.mode === 'tower' && session.floor && session.floor.daily) {
      rollDaily();
      const D = profile.daily,
        f = session.floor,
        t = session.seconds;
      $('#resKicker').textContent = `Défi du jour · ${f.name}`;
      if (win) {
        const rec = !D.best || t < D.best;
        if (rec) D.best = t;
        if (!D.won) {
          D.won = true;
          gain = DAILY_XP;
          coins = DAILY_COINS;
        } else {
          gain = 10;
          coins = 3;
        }
        $('#resTitle').textContent = 'Défi réussi';
        $('#resScore').textContent =
          `${sMe} – ${sOp} en ${t} s` + (rec ? ' · record du jour !' : ` · record : ${D.best} s`);
        if (D.tries) $('#resStatus').textContent = `Battu au ${nth(D.tries + 1)} essai.`;
        D.tries = 0;
        setResultButtons('Améliorer mon temps', () => startDaily(), null, null);
      } else {
        D.tries++;
        gain = 5;
        coins = 1;
        $('#resTitle').textContent = 'Défi raté';
        $('#resScore').textContent = `${sMe} – ${sOp}`;
        $('#resStatus').textContent = `Essai ${D.tries} raté. Demain, ce sera un autre adversaire.`;
        setResultButtons('Réessayer', () => startDaily(), null, null);
      }
      save();
    } else if (session.mode === 'tower' && session.floor) {
      const f = session.floor,
        stars = starsFor(win, session.roundsLost, session.seconds, f.par);
      const first = win && profile.towerMax <= f.n;
      gain = towerXp(f.n, win, sMe, stars);
      coins = towerCoins(f.n, win, stars, first);
      // série d'étages gagnés : multiplie l'XP et les pièces ; une défaite la remet à zéro
      const rs = $('#resStreak');
      if (win) {
        profile.streak++;
        const m = streakMult(profile.streak);
        gain = Math.round(gain * m);
        coins = Math.round(coins * m);
        if (profile.streak >= 2) {
          rs.hidden = false;
          rs.className = 'streak';
          rs.textContent = `Série de ${profile.streak} étages : XP et pièces ×${m}`;
        }
      } else {
        if (profile.streak >= 2) {
          rs.hidden = false;
          rs.className = 'streak lost';
          rs.textContent = `Série perdue : ${profile.streak} étages d'affilée`;
        }
        profile.streak = 0;
      }
      save();
      $('#resKicker').textContent = `Étage ${f.n} · ${f.name}`;
      $('#resTitle').textContent = win ? 'Étage réussi' : 'Défaite';
      $('#resScore').textContent = `${sMe} – ${sOp}` + (win ? ` en ${session.seconds} s` : '');
      if (win) {
        starsEl.hidden = false;
        starsEl.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < stars));
        const firstClear = profile.towerMax <= f.n;
        profile.stars[f.n] = Math.max(profile.stars[f.n] || 0, stars);
        profile.towerMax = Math.max(profile.towerMax, f.n + 1);
        save();
        const gift = firstClear ? PK.find(id => PERSOS[id].floor === f.n) : undefined;
        if (gift) showPerso(gift);
        const tries = profile.tries[f.n] || 0;
        delete profile.tries[f.n];
        save();
        const hint =
          stars < 3
            ? stars === 1
              ? 'Deuxième étoile : gagne sans perdre une manche.'
              : `Troisième étoile : gagne en moins de ${f.par} s.`
            : '';
        $('#resStatus').textContent = (tries ? `Battu au ${nth(tries + 1)} essai ! ` : '') + hint;
        setResultButtons(
          `Étage ${f.n + 1}`,
          () => startTower(f.n + 1),
          'Rejouer',
          () => startTower(f.n),
        );
      } else {
        const tries = (profile.tries[f.n] = (profile.tries[f.n] || 0) + 1);
        save();
        const next = RANKS[myRank() + 1];
        $('#resStatus').textContent =
          session.teaser && next
            ? `Il t’a eu avec : ${session.teaser} ? Tu l’apprends à la ${next.name.toLowerCase()} (encore ${next.xp - profile.xp - gain} XP).`
            : `Essai ${tries} raté. Il t’attend.`;
        setResultButtons('Réessayer', () => startTower(f.n), null, null);
      }
    } else if (session.mode === 'practice') {
      gain = win ? XP_PRACTICE_WIN : 5;
      coins = COINS_PRACTICE[win ? 1 : 0];
      $('#resKicker').textContent = 'Entraînement';
      $('#resTitle').textContent = win ? 'Victoire' : 'Défaite';
      $('#resScore').textContent = `${sMe} – ${sOp} contre ${op ? op.name : 'le bot'}`;
      setResultButtons('Revanche', () => practice(), null, null);
    } else {
      gain = win ? XP_DUEL_WIN : XP_DUEL_LOSS;
      coins = COINS_DUEL[win ? 1 : 0];
      $('#resKicker').textContent = 'Duel';
      $('#resTitle').textContent = win ? 'Victoire' : 'Défaite';
      $('#resScore').textContent = `${sMe} – ${sOp} contre ${op ? op.name : 'ton adversaire'}`;
      $('#resStatus').textContent = 'Une revanche ? Il faut que vous la demandiez tous les deux.';
      setResultButtons('Revanche', () => session.requestRematch(), null, null);
    }
    const b = session.bonus,
      bc = b.saves * 2 + b.perfects * 5;
    $('#resBonus').hidden = !bc;
    if (bc) {
      coins += bc;
      $('#resBonus').textContent =
        [b.perfects ? `Parfait ×${b.perfects}` : '', b.saves ? `Sauvé ×${b.saves}` : ''].filter(Boolean).join(' · ') +
        ` : +${bc} pièces`;
    }
    newRank = addXp(gain);
    addCoins(coins);
    showXp(gain, xpBefore, coins);
    if (newRank > 0) showUnlock(newRank);
    sfx(win ? 'win' : 'lose');
    show('result');
    restartAnim($('#resTitle'));
    if (win) confetti();
    void me;
  }, 1300);
}

/* ================= tutoriel ================= */
function onTuto(step: TutoStep | null, i: number, n: number, count: number) {
  const bar = $('#tutoBar');
  bar.classList.toggle('done', !step);
  if (!step) {
    $('#tutoStep').textContent = 'Terminé';
    $('#tutoTxt').textContent = lastMode.drill ? 'Technique maîtrisée !' : 'Bravo ! Direction la Tour du temple.';
    $('#tutoDots').innerHTML = '';
    return;
  }
  $('#tutoStep').textContent = lastMode.drill ? 'Nouvelle technique' : `Tutoriel · étape ${i + 1} sur ${n}`;
  $('#tutoTxt').textContent = controls.isTouch && step.touch ? step.touch : step.text;
  $('#tutoDots').innerHTML =
    step.goal > 1
      ? Array.from({ length: step.goal }, (_, k) => `<i class="${k < count ? 'on' : ''}"></i>`).join('')
      : '';
  if (count === 0) restartAnim(bar);
}
function onTutoDone() {
  track('tutorial_completed', { drill: lastMode.drill || null });
  if (lastMode.drill) {
    toast('Technique maîtrisée');
    leave();
    return;
  }
  const first = !profile.tutoDone;
  profile.tutoDone = true;
  if (first) {
    addXp(XP_TUTO);
    addCoins(COINS_TUTO);
  }
  save();
  toast(first ? `+${XP_TUTO} XP et ${COINS_TUTO} pièces · la Tour du temple t'attend` : 'Tutoriel terminé');
  startTower(nextFloor());
}

/* ================= liaison avec la partie ================= */
session.hooks = {
  onStart() {
    clearTimeout(endTimer);
    if (host) {
      host.close();
      host = null;
    }
    show(null);
  },
  onEnd,
  onRematch(me, them) {
    const st = session.state;
    const op = st ? st.f[1 - session.myIdx].name : 'Ton adversaire';
    $('#resStatus').textContent =
      me && them ? 'C’est reparti !' : me ? `En attente de ${op}…` : `${op} veut une revanche.`;
    if (me) {
      ($('#resMain') as HTMLButtonElement).disabled = true;
      $('#resMainLbl').textContent = 'Revanche demandée';
    }
  },
  onDisconnect() {
    if (current === 'home') return;
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

/* ================= petits effets d'interface ================= */
function restartAnim(el: HTMLElement) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}
function revealCode(code: string) {
  $('#lobbyCode').innerHTML = [...code].map((c, i) => `<span style="animation-delay:${i * 70}ms">${c}</span>`).join('');
}
function confetti() {
  const box = $('#confetti');
  box.innerHTML = '';
  const cols = ['#f2c14e', '#e0a243', '#ecdfc6', '#62c2a2', '#f2a7c3', '#e5483a'];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement('i');
    const a = Math.random() * Math.PI * 2,
      d = 90 + Math.random() * 170;
    el.style.background = cols[i % cols.length];
    el.style.setProperty('--dx', Math.cos(a) * d + 'px');
    el.style.setProperty('--dy', Math.sin(a) * d * 0.8 + 60 + 'px');
    el.style.setProperty('--r', Math.random() * 720 - 360 + 'deg');
    el.style.animationDelay = Math.random() * 120 + 'ms';
    box.append(el);
  }
}
function setupButtonFx() {
  document.addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest('.btn-play, .btn2, .ghost') as HTMLElement | null;
    if (!b || (b as HTMLButtonElement).disabled) return;
    const r = b.getBoundingClientRect(),
      size = Math.max(r.width, r.height) * 2.2,
      s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = e.clientX - r.left + 'px';
    s.style.top = e.clientY - r.top + 'px';
    b.append(s);
    setTimeout(() => s.remove(), 600);
    sfx('ui');
  });
  document.addEventListener('pointerover', e => {
    if (controls.isTouch) return;
    const b = (e.target as HTMLElement).closest('.btn-play, .btn2') as HTMLElement | null;
    const from = (e.relatedTarget as HTMLElement | null)?.closest?.('.btn-play, .btn2');
    if (b && b !== from && !(b as HTMLButtonElement).disabled) sfx('hover');
  });
}

/* ================= mise en place ================= */
export function setupUI() {
  setupButtonFx();
  // panneau de test : ceinture, étages débloqués, niveau du bot
  const dr = $('#devRank') as HTMLSelectElement;
  dr.innerHTML = RANKS.map(
    (r, i) =>
      `<option value="${i}">${i + 1}. ${r.name}${r.unlock ? ' · ' + r.unlock.title : ' · Frapper + Esquive'}</option>`,
  ).join('');
  const df = $('#devFloor') as HTMLSelectElement;
  df.innerHTML = Array.from(
    { length: 20 },
    (_, i) => `<option value="${i + 1}">Jusqu'à l'étage ${i + 1}</option>`,
  ).join('');
  dr.addEventListener('change', () => {
    profile.xp = RANKS[+dr.value].xp;
    profile.tutoDone = true;
    save();
    renderHome();
    toast(RANKS[+dr.value].name);
  });
  df.addEventListener('change', () => {
    profile.towerMax = +df.value;
    profile.tutoDone = true;
    save();
    renderHome();
    toast(`Étages 1 à ${df.value} débloqués`);
  });
  ($('#devLvl') as HTMLSelectElement).addEventListener('change', e => {
    profile.level = +(e.target as HTMLSelectElement).value;
    save();
  });
  $('#devReset').addEventListener('click', () => {
    Object.assign(profile, { xp: 0, towerMax: 1, stars: {}, tutoDone: false, coins: 0, owned: [], streak: 0 });
    save();
    renderHome();
    toast('Progression réinitialisée');
  });
  $('#devCoins').addEventListener('click', () => {
    const n = Math.max(1, Math.min(999999, Math.floor(+($('#devCoinsN') as HTMLInputElement).value || 0)));
    addCoins(n);
    toast(`+${n} pièces (total ${profile.coins})`);
  });
  $('#shopBtn').addEventListener('click', openShop);
  $('#dailyBtn').addEventListener('click', startDaily);
  $('#shopClose').addEventListener('click', closeShop);
  $('#shopAct').addEventListener('click', shopAction);
  document.querySelectorAll<HTMLElement>('#shop .tab').forEach(t =>
    t.addEventListener('click', () => {
      shopTab = t.dataset.tab as ShopKind;
      shopSel = myLook()[shopTab];
      renderShop();
      preview(shopSel);
      sfx('ui');
    }),
  );

  renderHome();
  audioPrefs.sfx = profile.sfx;
  audioPrefs.music = profile.music;
  $('#towerBtn').addEventListener('click', () => startTower(nextFloor()));
  $('#floorsBtn').addEventListener('click', () => {
    renderFloors();
    show('floors');
  });
  $('#floorsClose').addEventListener('click', () => show('home'));
  $('#practiceBtn').addEventListener('click', practice);
  $('#tutoBtn').addEventListener('click', () => startTuto(null));
  $('#tutoSkip').addEventListener('click', () => {
    if (!lastMode.drill) {
      profile.tutoDone = true;
      save();
      startTower(nextFloor());
    } else leave();
  });
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
  $('#tPrev').addEventListener('click', () => cycle('perso', -1));
  $('#tNext').addEventListener('click', () => cycle('perso', 1));
  $('#mPrev').addEventListener('click', () => cycle('arme', -1));
  $('#mNext').addEventListener('click', () => cycle('arme', 1));
  $('#rankFace').addEventListener('click', () => {
    const d = $('#fighterBox') as HTMLDetailsElement;
    d.open = true;
    d.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
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
  $('#resMain').addEventListener('click', () => mainAction());
  $('#resAlt').addEventListener('click', () => altAction && altAction());
  $('#resHome').addEventListener('click', leave);
  $('#lostHome').addEventListener('click', leave);
  $('#quitBtn').addEventListener('click', () => show('quit'));
  $('#quitYes').addEventListener('click', leave);
  $('#quitNo').addEventListener('click', () => show(null));
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      if (current === '' && session.active) show('quit');
      else if (current === 'quit') show(null);
      else if (current === 'floors') show('home');
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
      mainAction();
    }
  });
  const code = cleanCode(params.get('salle') || '');
  if (code) {
    $('#homeJoinNote').hidden = false;
    $('#homeJoinNote').textContent = `Tu es invité dans la salle ${code}. Choisis ton nom puis rejoins le duel.`;
    ($('#codeIn') as HTMLInputElement).value = code;
    $('#joinBtn').classList.add('btn-play');
    $('#joinBtn').textContent = 'Rejoindre le duel';
    ($('#fighterBox') as HTMLDetailsElement).open = true;
  }
  show('home');
  if (net === 'local') toast('Mode réseau local (deux onglets du même navigateur)');
}
