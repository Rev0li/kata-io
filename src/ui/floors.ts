// Écran des étages de la Tour : gardiens, étoiles, récompenses, étages verrouillés.
import { PERSOS } from '../sim/data';
import { towerFloor, TOWER_LEN } from '../sim/progression';
import { $ } from './dom';
import { profile, PK } from './profile';
import { startTower } from './launch';

const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function renderFloors() {
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
