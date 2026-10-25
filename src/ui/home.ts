// Écran d'accueil façon écran de jeu : ton combattant en grand sur la plateforme (dans la scène), un gros bouton
// Jouer (étage suivant de la Tour) et les autres modes en boutons secondaires. Les sous-écrans s'ouvrent par-dessus :
//   Vestiaire     combattant, arme, traînées, ploufs (shop.ts) ; on y entre aussi en touchant son combattant
//   Étages        la Tour étage par étage (floors.ts)
//   Entraînement  monde et niveau du bot
//   Duel          duel privé (code), partie publique (verrouillée jusqu'à la fin de la Tour)
// Les paramètres (commandes, son, plein écran, mode test) s'ouvrent par la roue en haut à droite.
import { PERSOS, ARMES, MONDES, LEVELS } from '../sim/data';
import {
  RANKS,
  rankProgress,
  towerFloor,
  streakMult,
  dailyFloor,
  DAILY_COINS,
  Abil,
  TOWER_LEN,
} from '../sim/progression';
import { session, MeSpec } from '../net/session';
import { controls } from './controls';
import { sfx } from '../game/audio';
import { $, toast } from './dom';
import { show } from './nav';
import { profile, save, myRank, myAbil, myLook, nextFloor, rollDaily } from './profile';
import { viewState } from './viewstate';

// Parties publiques : ouvertes une fois toutes les techniques acquises (ceinture noire)
// et les 12 étages de la Tour gagnés (towerMax = prochain étage à jouer, donc 13 après le 12e).
const TECHS = RANKS.filter(r => r.unlock).length;
const techsGot = () => RANKS.slice(1, myRank() + 1).filter(r => r.unlock).length;
const floorsWon = () => Math.min(TOWER_LEN, profile.towerMax - 1);
export const publicOpen = () => techsGot() >= TECHS && floorsWon() >= TOWER_LEN;

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

/* ---------- retour à l'accueil : ton combattant reprend sa place sur la plateforme ---------- */
export function goHome() {
  session.startMenu(mySpec());
  renderHome();
  show('home');
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

/* ---------- vignettes du combattant et de l'arme ---------- */
export function setFace(el: HTMLElement, id: string) {
  el.style.setProperty('--i', String(PERSOS[id].idx));
}
export function setWico(el: HTMLElement, id: string) {
  const w = ARMES[id];
  el.classList.toggle('none', w.idx < 0);
  if (w.idx >= 0) el.style.setProperty('--i', String(w.idx));
}

/* ---------- accueil ---------- */
export function renderCoins() {
  $('#homeCoins').textContent = String(profile.coins);
  $('#shopCoins').textContent = String(profile.coins);
}
export function renderHome() {
  ($('#nameIn') as HTMLInputElement).value = profile.name;
  $('#heroName').textContent = profile.name;
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
  // partie publique : verrouillée tant que la Tour n'est pas finie et toutes les techniques acquises
  const got = techsGot(),
    won = floorsWon(),
    open = publicOpen();
  $('#publicLock').hidden = open;
  $('#publicTechs').textContent = `Techniques : ${got} sur ${TECHS}`;
  ($('#publicTechsBar') as HTMLElement).style.width = Math.round((got / TECHS) * 100) + '%';
  $('#publicFloors').textContent = `Étages de la Tour : ${won} sur ${TOWER_LEN}`;
  ($('#publicFloorsBar') as HTMLElement).style.width = Math.round((won / TOWER_LEN) * 100) + '%';
  $('#publicBtn').textContent = open ? 'Bientôt' : 'Verrouillée';
  renderCoins();
  ($('#setSfx') as HTMLInputElement).checked = profile.sfx;
  ($('#setMusic') as HTMLInputElement).checked = profile.music;
  ($('#setAutoAim') as HTMLInputElement).checked = profile.autoAim;
  controls.autoAim = profile.autoAim;
  ($('#devRank') as HTMLSelectElement).value = String(myRank());
  ($('#devFloor') as HTMLSelectElement).value = String(Math.min(profile.towerMax, 20));
  ($('#devLvl') as HTMLSelectElement).value = String(profile.level);
  ($('#devGod') as HTMLInputElement).checked = profile.god;
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
  $('#devGod').addEventListener('change', e => {
    profile.god = (e.target as HTMLInputElement).checked;
    save();
    toast(profile.god ? 'Invincible : aucun coup ne te touche (hors duel)' : 'Invincible désactivé');
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
