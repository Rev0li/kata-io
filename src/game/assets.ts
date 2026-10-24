// Chargement des sprites du pack Ninja Adventure (Pixel-boy, CC0) : personnages, armes et effets.
// Les planches sont assemblées par scripts/build-assets.py dans public/assets.
import Phaser from 'phaser';

export const PX = 3; // un pixel du pack = 3 unités du monde
export const FX_KEYS = ['hit', 'star', 'guard', 'sparkle', 'cross', 'arc', 'spin', 'slash', 'fire', 'splash', 'dust', 'smoke', 'fireslash'] as const;
export type FxKey = typeof FX_KEYS[number];
// Particules des effets de boutique : [largeur, hauteur] d'une image
export const PARTS: Record<string, [number, number]> = { leaf: [12, 7], wood: [16, 16], pig: [16, 16], coin: [10, 10], shuriken: [13, 13], chest: [16, 14], ghost: [16, 16], bird: [16, 16], flame: [16, 16] };
export const THEME_BG = ['brume', 'coucher', 'neon'];
const BASE = import.meta.env.BASE_URL + 'assets/';

export function preloadAssets(scene: Phaser.Scene) {
  scene.load.spritesheet('persos', BASE + 'persos.png', { frameWidth: 16, frameHeight: 16 });
  scene.load.spritesheet('armes', BASE + 'armes.png', { frameWidth: 16, frameHeight: 16 });
  scene.load.image('dojo', BASE + 'dojo.png');
  scene.load.image('dojo-mousse', BASE + 'dojo-mousse.png');
  for (const t of THEME_BG) scene.load.image('bg-' + t, BASE + 'bg/' + t + '.png'); // horizons d'après art/reference
  for (const k of FX_KEYS) scene.load.spritesheet('fx-' + k, BASE + 'fx/' + k + '.png', { frameWidth: 32, frameHeight: 32 });
  for (const [k, [w, h]] of Object.entries(PARTS)) scene.load.spritesheet('fx-' + k, BASE + 'fx/' + k + '.png', { frameWidth: w, frameHeight: h });
}

export function setupAssets(scene: Phaser.Scene) {
  // Pixel art : pas de lissage quand on agrandit.
  for (const k of ['persos', 'armes', 'dojo', 'dojo-mousse', ...[...FX_KEYS, ...Object.keys(PARTS)].map(k => 'fx-' + k)]) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
  for (const k of FX_KEYS) {
    if (scene.anims.exists('fx-' + k)) continue;
    scene.anims.create({ key: 'fx-' + k, frames: scene.anims.generateFrameNumbers('fx-' + k), frameRate: k === 'splash' || k === 'smoke' ? 16 : 22, repeat: 0 });
  }
}
