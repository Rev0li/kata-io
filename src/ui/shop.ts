// Boutique d'effets (pièces gagnées en jouant). La vitrine est un vrai combat scripté derrière le panneau :
// ton combattant frappe le mannequin (traînée) ou l'envoie à l'eau (plouf), du côté du dojo que le panneau ne cache pas.
import { FULL_ABIL } from '../sim/progression';
import { session } from '../net/session';
import { viewState } from './viewstate';
import { sfx } from '../game/audio';
import { $, toast, wake } from './dom';
import { show } from './nav';
import { profile, save, myLook, owns, CATALOG, ShopKind } from './profile';
import { mySpec, renderHome, renderCoins } from './home';

let shopTab: ShopKind = 'trainee',
  shopSel = '';
const ICON_AR: Record<string, number> = { leaf: 7 / 12, chest: 14 / 16 }; // hauteur / largeur des images non carrées
function iconStyle(icon: [string, number, number]) {
  return `background-image:url(/assets/fx/${icon[0]}.png);--n:${icon[1]};--f:${icon[2]};--ar:${ICON_AR[icon[0]] || 1}`;
}

export function openShop() {
  wake();
  viewState.shop = true;
  session.startShowcase(mySpec(FULL_ABIL));
  show('shop');
  shopSel = myLook()[shopTab];
  renderShop();
  preview(shopSel);
}
export function closeShop() {
  viewState.shop = false;
  session.leave(true);
  renderHome();
  show('home');
}
export function selectTab(tab: ShopKind) {
  shopTab = tab;
  shopSel = myLook()[shopTab];
  renderShop();
  preview(shopSel);
  sfx('ui');
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
export function shopAction() {
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
