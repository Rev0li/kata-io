// Barre d'actions animée : Frapper, Parer, Esquive, Emote.
// Sur mobile ce sont les vrais boutons ; sur ordinateur elle sert d'indicateur (touches, charge, souffle, qi).
import { controls } from './controls';
import { Ev } from '../sim/sim';
import { CHARGE_FULL, CHARGE_START } from '../sim/data';
import { Abil } from '../sim/progression';

const EMOTE_IDS = ['salut', 'rire', 'gg', 'viens'];
let emoteCycle = 0;
const els: Record<string, HTMLButtonElement> = {};
let ringLen = 0;
let lastState = '';

function vibrate(p: number | number[]) { if (controls.isTouch && 'vibrate' in navigator) { try { navigator.vibrate(p); } catch (e) { /* non pris en charge */ } } }
function restart(el: Element, cls: string) { el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls); }
export function burst(t: string, kind: string) {
  const b = els[t]; if (!b) return;
  const s = b.querySelector('.burst') as HTMLElement; if (!s) return;
  s.dataset.k = kind; restart(s, 'go');
}
export function press(t: string, down: boolean) {
  const b = els[t]; if (!b) return;
  if (down) { restart(b, 'tap'); b.classList.add('down'); if (t !== 'atk') setTimeout(() => b.classList.remove('down'), 130); vibrate(12); }
  else b.classList.remove('down');
}

export function setupActionBar() {
  document.querySelectorAll<HTMLButtonElement>('#actions .act').forEach(b => {
    const t = b.dataset.t!; els[t] = b;
    b.addEventListener('pointerdown', e => {
      if (!controls.isTouch) return;
      e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
      if (t === 'atk') controls.setAtk(true);
      else if (t === 'parry') controls.parry();
      else if (t === 'dodge') controls.dodge();
      else if (t === 'emote') controls.emote(EMOTE_IDS[emoteCycle++ % EMOTE_IDS.length]);
    });
    const up = () => { if (t === 'atk' && controls.isTouch) controls.setAtk(false); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
  const prog = document.querySelector('#actions .atk .prog') as SVGCircleElement | null;
  if (prog) { ringLen = 2 * Math.PI * 46; prog.style.strokeDasharray = `${ringLen}`; prog.style.strokeDashoffset = `${ringLen}`; }
  controls.onPress = (t, down) => press(t, down);
}

// Techniques pas encore débloquées : bouton grisé avec cadenas (masqué sur mobile).
export function setLocks(a: Abil) {
  if (!els.atk) return;
  els.parry.classList.toggle('locked', !a.parry);
  els.parry.title = a.parry ? '' : 'Débloqué à la ceinture orange';
  els.atk.classList.toggle('nocharge', !a.charge);
  els.atk.querySelector('.key')!.textContent = a.charge ? 'Clic · maintenir' : 'Clic gauche · J';
}

// Appelé à chaque image avec le combattant du joueur.
export function updateActionBar(me: any) {
  if (!me || !els.atk) return;
  const atk = els.atk, dod = els.dodge, par = els.parry;
  // charge du coup rouge : l'anneau se remplit, devient blanc à pleine charge, or si le qi est plein
  const charging = me.state === 'charge';
  const p = charging ? Math.min(1, me.chargeT / (CHARGE_FULL - CHARGE_START)) : 0;
  const prog = atk.querySelector('.prog') as SVGCircleElement;
  if (prog) prog.style.strokeDashoffset = `${ringLen * (1 - p)}`;
  atk.classList.toggle('charging', charging);
  atk.classList.toggle('full', charging && p >= 1);
  atk.classList.toggle('dragon', me.qi >= 100 && !!(me.abil && me.abil.dragon));
  // souffle : trois segments sous Esquive
  const pips = dod.querySelectorAll('.pips i');
  pips.forEach((el, i) => (el as HTMLElement).style.setProperty('--f', String(Math.max(0, Math.min(1, me.souffle - i)))));
  dod.classList.toggle('empty', me.souffle < 1);
  // parade ratée : temps de récupération visible
  par.classList.toggle('cool', me.state === 'recover');
  par.classList.toggle('active', me.state === 'parry');
  const st = me.state; if (st !== lastState) { if (st === 'attack' && me.atk && me.atk.kind === 'red') burst('atk', 'red'); lastState = st; }
}

// Réactions aux événements de la simulation.
export function actionEvent(ev: Ev, myIdx: number) {
  if (ev.t === 'parry' && ev.by === myIdx) { burst('parry', ev.perfect ? 'gold' : 'ok'); vibrate(ev.perfect ? [20, 30, 30] : 25); }
  if (ev.t === 'dodge' && ev.by === myIdx) { burst('dodge', 'jade'); vibrate([15, 20, 15]); }
  if (ev.t === 'hit' && ev.to === myIdx) vibrate(ev.red ? 60 : 30);
  if (ev.t === 'hit' && ev.by === myIdx) burst('atk', ev.red ? 'red' : 'ok');
  if (ev.t === 'ko' && ev.by === myIdx) vibrate([30, 40, 60]);
}
