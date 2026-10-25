// Vestiaire : tout ce qui change l'apparence de ton combattant, au même endroit.
//   Combattant  gagné en battant le gardien d'un étage de la Tour
//   Arme        gagnée avec une ceinture
//   Traînée     effet de coup, acheté avec les pièces
//   Plouf       effet d'éjection, acheté avec les pièces
// La vitrine est un vrai combat scripté derrière le panneau : ton combattant frappe le mannequin (combattant, arme,
// traînée) ou l'envoie à l'eau (plouf), du côté du dojo que le panneau ne cache pas.
import { PERSOS, ARMES } from '../sim/data';
import { RANKS, FULL_ABIL } from '../sim/progression';
import { session } from '../net/session';
import { viewState } from './viewstate';
import { sfx } from '../game/audio';
import { $, toast, wake } from './dom';
import { show } from './nav';
import { profile, save, myLook, owns, CATALOG, ShopKind, PK, AK, persoOpen, armeOpen } from './profile';
import { mySpec, renderCoins, goHome, setFace, setWico } from './home';

export type LockerTab = 'perso' | 'arme' | ShopKind;
let tab: LockerTab = 'perso',
  sel = '';
const isEffect = (t: LockerTab): t is ShopKind => t === 'trainee' || t === 'ejection';
const HINTS: Record<LockerTab, string> = {
  perso: 'Bats le gardien d’un étage de la Tour pour gagner son apparence.',
  arme: 'Chaque nouvelle ceinture apporte une arme. Elles ne changent que l’apparence.',
  trainee: 'Traînée de tes coups. Gagne des pièces dans la Tour, en entraînement et en duel.',
  ejection: 'Effet quand tu envoies ton adversaire à l’eau. Lui aussi le voit.',
};
const ICON_AR: Record<string, number> = { leaf: 7 / 12, chest: 14 / 16 }; // hauteur / largeur des images non carrées
function iconStyle(icon: [string, number, number]) {
  return `background-image:url(/assets/fx/${icon[0]}.png);--n:${icon[1]};--f:${icon[2]};--ar:${ICON_AR[icon[0]] || 1}`;
}

export function openShop() {
  wake();
  viewState.shop = true;
  session.startShowcase(mySpec(FULL_ABIL));
  show('shop');
  sel = myLook()[tab];
  renderShop();
  preview(sel);
}
export function closeShop() {
  viewState.shop = false;
  goHome();
}
export function selectTab(t: LockerTab) {
  tab = t;
  sel = myLook()[tab];
  renderShop();
  preview(sel);
  sfx('ui');
}
// Aperçu en situation : un plouf pour les ploufs, trois coups sur le mannequin pour tout le reste.
function preview(id: string) {
  const look = { ...myLook(), [tab]: id };
  session.showcase(tab === 'ejection' ? 'ejection' : 'trainee', look, [-1, 0]); // éjection vers la gauche : jamais sous le panneau
}

/* ---------- état de chaque élément ---------- */
const unlocked = (id: string) =>
  tab === 'perso' ? persoOpen(id) : tab === 'arme' ? armeOpen(id) : owns(tab as ShopKind, id);
// Ce qu'il faut pour débloquer un combattant ou une arme.
const need = (id: string) => (tab === 'perso' ? `Étage ${PERSOS[id].floor}` : RANKS[ARMES[id].rank].name);
function items(): [string, string][] {
  if (tab === 'perso') return PK.map(id => [id, PERSOS[id].name]);
  if (tab === 'arme') return AK.map(id => [id, ARMES[id].name]);
  return Object.entries(CATALOG[tab]).map(([id, it]) => [id, it.name]);
}

function renderShop() {
  renderCoins();
  document.querySelectorAll<HTMLElement>('#shop .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  $('#shopHint').textContent = HINTS[tab];
  const grid = $('#shopGrid');
  grid.innerHTML = '';
  grid.classList.toggle('looks', !isEffect(tab));
  const cur = myLook()[tab];
  for (const [id, name] of items()) {
    const open = unlocked(id),
      on = cur === id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sitem' + (open ? ' owned' : '') + (on ? ' on' : '') + (id === sel ? ' sel' : '');
    let st: string;
    if (on) st = '<span class="st">Équipé</span>';
    else if (open) st = isEffect(tab) ? '<span class="st">Possédé</span>' : '';
    else if (isEffect(tab)) {
      const price = CATALOG[tab][id].price;
      st = `<span class="st price${profile.coins < price ? ' short' : ''}"><img class="px" src="/assets/items/gold-coin.png" alt="">${price}</span>`;
    } else st = `<span class="st need">${need(id)}</span>`;
    if (tab === 'perso') {
      b.innerHTML = `<i class="face${open ? '' : ' mystery'}"></i><b>${open ? name : '???'}</b>${st}`;
      setFace(b.querySelector('i')!, id);
    } else if (tab === 'arme') {
      b.innerHTML = `<i class="wico"></i><b>${name}</b>${st}`;
      setWico(b.querySelector('i')!, id);
    } else b.innerHTML = `<i class="sico" style="${iconStyle(CATALOG[tab][id].icon)}"></i><b>${name}</b>${st}`;
    b.addEventListener('click', () => {
      sel = id;
      renderShop();
      preview(id);
      sfx('ui');
    });
    grid.append(b);
  }
  // bouton d'action : équiper, acheter, ou ce qui manque
  const act = $('#shopAct') as HTMLButtonElement,
    lbl = $('#shopActLbl');
  act.disabled = false;
  act.classList.remove('short');
  if (cur === sel) {
    lbl.textContent = 'Équipé';
    act.disabled = true;
  } else if (unlocked(sel)) lbl.textContent = 'Équiper';
  else if (!isEffect(tab)) {
    lbl.textContent = tab === 'perso' ? `Bats le gardien de l’étage ${PERSOS[sel].floor}` : RANKS[ARMES[sel].rank].name;
    act.disabled = true;
  } else {
    const price = CATALOG[tab][sel].price;
    if (profile.coins >= price)
      lbl.innerHTML = `Acheter · ${price} <img class="px coin" src="/assets/items/gold-coin.png" alt="pièces">`;
    else {
      lbl.textContent = `Encore ${price - profile.coins} pièces`;
      act.disabled = true;
    }
  }
}
export function shopAction() {
  if (!sel) return;
  if (isEffect(tab) && !owns(tab, sel)) {
    const it = CATALOG[tab][sel];
    if (profile.coins < it.price) return;
    profile.coins -= it.price;
    profile.owned.push(tab + ':' + sel);
    sfx('coin', 1.2);
    toast(`${it.name} : à toi !`);
  } else if (!unlocked(sel)) return;
  else sfx('ui');
  profile.look = { ...profile.look, [tab]: sel };
  save();
  renderShop();
  preview(sel);
}
