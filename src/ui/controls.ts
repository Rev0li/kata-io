// Entrées du joueur : clavier, souris (via GameScene) et commandes tactiles.
// Tout aboutit dans session.input, envoyé tel quel à la simulation ou à l'hôte.
import { session } from '../net/session';
import { initAudio, startMusic } from '../game/audio';
import { screenDirToWorld } from '../game/render';

const keys = new Set<string>();
const stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
const EMOTE_KEYS: Record<string, string> = { Digit1: 'salut', Digit2: 'rire', Digit3: 'gg', Digit4: 'viens' };

export const controls = {
  isTouch: matchMedia('(pointer: coarse)').matches,
  mouseSeen: false,
  autoAim: true, // visée automatique vers l'adversaire, comme sur mobile (réglable sur ordinateur)
  blockedFn: () => false as boolean,
  blocked() { return this.blockedFn(); },
  onPress: null as null | ((t: string, down: boolean) => void),
  setAtk(v: boolean) { if (session.input.atk !== v) this.onPress?.('atk', v); session.input.atk = v; },
  parry() { session.input.parryN++; this.onPress?.('parry', true); },
  dodge() { session.input.dodgeN++; this.onPress?.('dodge', true); },
  emote(id: string) { session.input.emote = id; session.input.emoteN++; this.onPress?.('emote', true); },
};

function moveVec() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  x += stick.x; y += stick.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return { x, y };
}
export function updateControls(aim: number) {
  const inp = session.input;
  if ((window as any).__autopilot) return; // tests automatisés (avec ?debug)
  if (!session.active || controls.blocked()) { inp.mx = 0; inp.my = 0; inp.atk = false; return; }
  const m = screenDirToWorld(moveVec().x, moveVec().y); // les touches et le joystick suivent l'écran : haut = vers le fond du dojo
  inp.mx = m.x; inp.my = m.y; inp.aim = aim;
}
export function clearKeys() { keys.clear(); stick.x = stick.y = 0; const i = session.input; i.atk = false; i.mx = 0; i.my = 0; session.flushInput(); }

export function setupControls() {
  window.addEventListener('keydown', ev => {
    const tg = ev.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    initAudio(); startMusic();
    if (!session.active || controls.blocked()) return;
    const c = ev.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) ev.preventDefault();
    if (keys.has(c)) return; keys.add(c);
    if (c === 'KeyJ') controls.setAtk(true);
    else if (c === 'KeyK' || c === 'KeyL') controls.parry();
    else if (c === 'Space' || c === 'ShiftLeft' || c === 'ShiftRight') controls.dodge();
    else if (EMOTE_KEYS[c]) controls.emote(EMOTE_KEYS[c]);
  });
  window.addEventListener('keyup', ev => { keys.delete(ev.code); if (ev.code === 'KeyJ') controls.setAtk(false); });
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); session.setAway(document.hidden); });
  window.addEventListener('mouseup', ev => { if (ev.button === 0) controls.setAtk(false); });
  window.addEventListener('pointerdown', ev => {
    initAudio(); startMusic();
    const t = ev.pointerType === 'touch';
    if (t !== controls.isTouch) { controls.isTouch = t; document.body.classList.toggle('touch', t); }
  }, true);
  document.body.classList.toggle('touch', controls.isTouch);

  // commandes tactiles
  const zone = document.getElementById('stickZone')!, knob = document.getElementById('stick')!;
  zone.addEventListener('pointerdown', e => {
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
    try { zone.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    const r = zone.getBoundingClientRect(); knob.style.left = (e.clientX - r.left) + 'px'; knob.style.top = (e.clientY - r.top) + 'px'; knob.hidden = false; (knob.firstElementChild as HTMLElement).style.transform = '';
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), m = 46;
    if (l > m) { dx = dx / l * m; dy = dy / l * m; }
    stick.x = dx / m; stick.y = dy / m; if (Math.hypot(stick.x, stick.y) < 0.18) stick.x = stick.y = 0;
    (knob.firstElementChild as HTMLElement).style.transform = `translate(${dx}px,${dy}px)`;
  });
  const end = (e: PointerEvent) => { if (e.pointerId !== stick.id) return; stick.id = -1; stick.x = stick.y = 0; knob.hidden = true; };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
}
