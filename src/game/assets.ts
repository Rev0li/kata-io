// Chargement des sprites du pack Ninja Adventure (Pixel-boy, CC0) : personnages, armes et effets.
// Les planches sont assemblées par scripts/build-assets.py dans public/assets.
import Phaser from 'phaser';

export const PX = 3; // un pixel du pack = 3 unités du monde
export const FX_KEYS = ['hit', 'star', 'guard', 'sparkle', 'cross', 'arc', 'spin', 'slash', 'fire', 'splash', 'dust', 'smoke', 'fireslash'] as const;
export type FxKey = typeof FX_KEYS[number];
const BASE = import.meta.env.BASE_URL + 'assets/';

export function preloadAssets(scene: Phaser.Scene) {
  scene.load.spritesheet('persos', BASE + 'persos.png', { frameWidth: 16, frameHeight: 16 });
  scene.load.spritesheet('armes', BASE + 'armes.png', { frameWidth: 16, frameHeight: 16 });
  scene.load.image('dojo', BASE + 'dojo.png');
  scene.load.image('dojo-mousse', BASE + 'dojo-mousse.png');
  for (const k of FX_KEYS) scene.load.spritesheet('fx-' + k, BASE + 'fx/' + k + '.png', { frameWidth: 32, frameHeight: 32 });
}

export function setupAssets(scene: Phaser.Scene) {
  // Pixel art : pas de lissage quand on agrandit.
  for (const k of ['persos', 'armes', 'dojo', 'dojo-mousse', ...FX_KEYS.map(k => 'fx-' + k)]) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
  for (const k of FX_KEYS) {
    if (scene.anims.exists('fx-' + k)) continue;
    scene.anims.create({ key: 'fx-' + k, frames: scene.anims.generateFrameNumbers('fx-' + k), frameRate: k === 'splash' || k === 'smoke' ? 16 : 22, repeat: 0 });
  }
}
