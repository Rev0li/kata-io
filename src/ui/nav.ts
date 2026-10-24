// Navigation entre les écrans HTML posés au-dessus du jeu, et dernier mode lancé (pour « Rejouer »).
import { session } from '../net/session';
import { controls, clearKeys } from './controls';
import { $ } from './dom';

const SCREENS = ['home', 'settings', 'floors', 'shop', 'lobby', 'joining', 'result', 'lost', 'quit'];
export type LastMode = {
  kind: 'tower' | 'practice' | 'duel' | 'tuto' | 'daily';
  floor?: number;
  drill?: string | null;
  world?: string;
};
export const nav = {
  current: 'home', // écran affiché ; '' = en jeu, aucun écran
  lastMode: { kind: 'tower', floor: 1 } as LastMode,
};

// Affiche un écran (ou aucun : null = en jeu) et règle les commandes en conséquence.
export function show(id: string | null) {
  nav.current = id || '';
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
