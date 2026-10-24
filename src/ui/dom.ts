// Petits utilitaires des écrans HTML : sélecteur, message éphémère, animations, son au clic.
import { controls } from './controls';
import { initAudio, startMusic, sfx } from '../game/audio';

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

let toastTimer = 0;
export function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('on'), 2400);
}
// Réveille l'audio (il faut un geste du joueur) et lance la musique.
export function wake() {
  initAudio();
  startMusic();
}
export function restartAnim(el: HTMLElement) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}
export function confetti() {
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
// Onde au clic sur les boutons, et petit son au survol.
export function setupButtonFx() {
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
