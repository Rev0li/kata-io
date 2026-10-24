// Écran d'accueil (maquette art/reference/mondes/accueil-v2.png), en onglets :
//   Accueil         profil (ceinture et XP), duel privé, partie publique (à venir)
//   Mon combattant  nom, combattant et arme
//   Temple          Tour du temple, défi du jour, entraînement dans un monde
//   Boutique        écran de la boutique (shop.ts)
//   Mode test       panneau de test, à la place de Communauté en attendant
// Les paramètres (commandes, son, plein écran) s'ouvrent par la roue en haut à droite.
import { PERSOS, ARMES, MONDES, LEVELS } from '../sim/data';
import { RANKS, rankProgress, towerFloor, streakMult, dailyFloor, DAILY_COINS, Abil } from '../sim/progression';
import { MeSpec } from '../net/session';
import { controls } from './controls';
import { sfx } from '../game/audio';
import { $, toast } from './dom';
import { profile, save, myRank, myAbil, myLook, persoOpen, armeOpen, PK, AK, nextFloor, rollDaily } from './profile';
import { viewState } from './viewstate';

// Parchemin de chaque technique (pack Ninja Adventure, public/assets/items).
export const SCROLLS: Record<string, string> = {
  chain2: 'scroll-plant',
  parry: 'scroll-ice',
  charge: 'scroll-rock',
  chain3: 'scroll-empty',
  elan: 'scroll-thunder',
  dragon: 'scroll-fire',
};
// Vignette de chaque monde dans le choix de l'entraînement : un élément du décor sur les couleurs du monde.
const WORLD_TILE: Record<string, [string, string, string]> = {
  cerisiers: ['cerisiers/cerisier-rose', '#7ea35a', '#4fb3c2'],
  bambous: ['bambous/pagode-3-etages', '#5f7f44', '#3f9c94'],
  enneige: ['neige/torii-enneige-a', '#e9f1f5', '#9ed6dc'],
  forge: ['forge/tour-a', '#2b1713', '#e2561f'],
};

/* ---------- onglets : des panneaux de l'accueil ; la Boutique ouvre son écran ---------- */
export type HomeTab = 'accueil' | 'combattants' | 'temple' | 'test';
const PANELS: Record<HomeTab, string> = {
  accueil: '#panelAccueil',
  combattants: '#panelCombattants',
  temple: '#panelTemple',
  test: '#panelTest',
};
export function homeTab(tab: HomeTab) {
  for (const [t, sel] of Object.entries(PANELS)) $(sel).hidden = t !== tab;
  document.querySelectorAll<HTMLElement>('#home .htab[data-tab]').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-current', String(b.dataset.tab === tab));
  });
  renderHome();
  $('#home').scrollTop = 0;
}

/* ---------- entraînement : monde et niveau du bot ---------- */
export function setupTraining() {
  const wp = $('#worldPick');
  wp.innerHTML = '';
  for (const [id, name] of MONDES) {
    const [img, ground, pond] = WORLD_TILE[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wtile';
    b.dataset.world = id;
    b.setAttribute('role', 'radio');
    b.style.setProperty('--g', ground);
    b.style.setProperty('--p', pond);
    b.innerHTML = `<img src="/assets/mondes/${img}.png" alt="" /><span>${name}</span>`;
    b.addEventListener('click', () => {
      viewState.world = id; // le décor derrière l'accueil change aussitôt
      renderTraining();
      sfx('ui');
    });
    wp.append(b);
  }
  const lp = $('#lvlPick');
  lp.innerHTML = '';
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.lvl = String(i);
    b.setAttribute('role', 'radio');
    b.textContent = l.name;
    b.addEventListener('click', () => {
      profile.level = i;
      save();
      renderTraining();
      ($('#devLvl') as HTMLSelectElement).value = String(i);
    });
    lp.append(b);
  });
}
export function renderTraining() {
  document.querySelectorAll<HTMLElement>('#worldPick .wtile').forEach(b => {
    const on = b.dataset.world === viewState.world;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  document.querySelectorAll<HTMLElement>('#lvlPick .chip').forEach(b => {
    const on = Number(b.dataset.lvl) === profile.level;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
}

/* ---------- nom et combattant du joueur ---------- */
export function myName() {
  const v = ($('#nameIn') as HTMLInputElement).value.trim().slice(0, 16);
  profile.name = v || profile.name || 'Disciple ' + ((Math.random() * 900 + 100) | 0);
  ($('#nameIn') as HTMLInputElement).value = profile.name;
  save();
  return profile.name;
}
export function mySpec(abil: Abil = myAbil()): MeSpec {
  return { name: myName(), look: myLook(), abil, belt: RANKS[myRank()].belt };
}

/* ---------- sélecteur de combattant et d'arme ---------- */
let viewP = -1,
  viewA = -1; // ce que montre le sélecteur (peut être verrouillé)
export function setFace(el: HTMLElement, id: string) {
  el.style.setProperty('--i', String(PERSOS[id].idx));
}
export function setWico(el: HTMLElement, id: string) {
  const w = ARMES[id];
  el.classList.toggle('none', w.idx < 0);
  if (w.idx >= 0) el.style.setProperty('--i', String(w.idx));
}
// Le sélecteur revient sur le combattant et l'arme équipés.
export function resetLookView() {
  viewP = viewA = -1;
}
export function renderLook() {
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
export function cycle(kind: 'perso' | 'arme', d: number) {
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

/* ---------- accueil ---------- */
export function renderCoins() {
  $('#homeCoins').textContent = String(profile.coins);
  $('#shopCoins').textContent = String(profile.coins);
}
export function renderHome() {
  ($('#nameIn') as HTMLInputElement).value = profile.name;
  resetLookView();
  renderLook();
  const rp = rankProgress(profile.xp);
  $('#rankBelt').style.background = rp.cur.belt;
  $('#rankName').textContent = rp.cur.name;
  ($('#rankXp') as HTMLElement).style.width = Math.round(rp.frac * 100) + '%';
  $('#rankXpTxt').textContent = rp.next ? `${profile.xp} / ${rp.next.xp} XP` : `${profile.xp} XP`;
  $('#rankNextLbl').textContent = rp.next ? 'Prochaine technique :' : 'Toutes les techniques';
  $('#rankNext').textContent = rp.next ? rp.next.unlock!.title : 'sont débloquées';
  ($('#rankNextIco') as HTMLImageElement).src =
    `/assets/items/${(rp.next && SCROLLS[rp.next.unlock!.key]) || 'scroll-fire'}.png`;
  rollDaily();
  const dly = profile.daily;
  $('#dailySub').textContent = dly.won
    ? `Record du jour : ${dly.best} s · tu peux faire mieux`
    : `${dailyFloor(dly.day).name} · gagne-le : +${DAILY_COINS} pièces` +
      (dly.tries ? ` · ${dly.tries} essai${dly.tries > 1 ? 's' : ''}` : '');
  const f = towerFloor(nextFloor());
  renderTraining();
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

/* ---------- panneau de test : ceinture, étages débloqués, niveau du bot, pièces ---------- */
export function setupDevPanel() {
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
    renderTraining();
  });
  $('#devReset').addEventListener('click', () => {
    Object.assign(profile, { xp: 0, towerMax: 1, stars: {}, tutoDone: false, coins: 0, owned: [], streak: 0 });
    save();
    renderHome();
    toast('Progression réinitialisée');
  });
  $('#devCoins').addEventListener('click', () => {
    const n = Math.max(1, Math.min(999999, Math.floor(+($('#devCoinsN') as HTMLInputElement).value || 0)));
    profile.coins += n;
    save();
    renderCoins();
    toast(`+${n} pièces (total ${profile.coins})`);
  });
}
