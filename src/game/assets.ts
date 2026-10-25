// Chargement des sprites du pack Ninja Adventure (Pixel-boy, CC0) : personnages, armes et effets.
// Les planches sont assemblées par scripts/build-assets.py dans public/assets.
import Phaser from 'phaser';
import { worldImages } from './render/worlds';
import { LIFE } from './render/themes';

export const PX = 3; // un pixel du pack = 3 unités du monde
// Combattants et armes un peu plus grands que le reste du pack (4 au lieu de 3). Réglable avec ?px= pour comparer.
const pxParam = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('px')) : 0;
export const FIGHTER_PX = pxParam >= 2 && pxParam <= 6 ? pxParam : 4;
export const FIGHTER_K = FIGHTER_PX / PX; // facteur d'agrandissement, pour les décalages (main, ombre, bulles)
export const FX_KEYS = [
  'hit',
  'star',
  'guard',
  'sparkle',
  'cross',
  'arc',
  'spin',
  'slash',
  'fire',
  'splash',
  'dust',
  'smoke',
  'fireslash',
] as const;
export type FxKey = (typeof FX_KEYS)[number];
// Particules des effets de boutique : [largeur, hauteur] d'une image
export const PARTS: Record<string, [number, number]> = {
  leaf: [12, 7],
  wood: [16, 16],
  pig: [16, 16],
  coin: [10, 10],
  shuriken: [13, 13],
  chest: [16, 14],
  ghost: [16, 16],
  bird: [16, 16],
  flame: [16, 16],
};
export const THEME_BG = ['brume', 'coucher', 'neon', 'neige', 'bambou', 'volcan'];
// Décor vectoriel (SVG, généré par scripts/build-decor-svg.py) : poissons articulés (corps + queue) et objets flottants.
export const SPECIES = ['koi_orange', 'koi_blanc', 'koi_or', 'lanterne', 'argente', 'carpe_jade', 'braise'];
export const FLOATS = ['nenuphar', 'fleur', 'glace', 'lave', 'lanterne', 'feuille'];
const BASE = import.meta.env.BASE_URL + 'assets/';

export function preloadAssets(scene: Phaser.Scene) {
  scene.load.spritesheet('persos', BASE + 'persos.png', { frameWidth: 16, frameHeight: 16 });
  scene.load.spritesheet('armes', BASE + 'armes.png', { frameWidth: 16, frameHeight: 16 });
  // Rastérisés à la taille demandée (4096 px de large au plus : limite des GPU mobiles) puis affichés à 2400 × 420.
  for (const t of THEME_BG) scene.load.svg('bg-' + t, BASE + 'decor/bg-' + t + '.svg', { width: 4096, height: 717 });
  for (const s of SPECIES) scene.load.svg('fish-' + s, BASE + 'decor/fish-' + s + '.svg', { width: 276, height: 96 }); // un seul tenant : déformé en tranches par le jeu
  for (const n of FLOATS) scene.load.svg('fl-' + n, BASE + 'decor/float-' + n + '.svg', { width: 192, height: 128 });
  for (const k of FX_KEYS)
    scene.load.spritesheet('fx-' + k, BASE + 'fx/' + k + '.png', { frameWidth: 32, frameHeight: 32 });
  for (const [k, [w, h]] of Object.entries(PARTS))
    scene.load.spritesheet('fx-' + k, BASE + 'fx/' + k + '.png', { frameWidth: w, frameHeight: h });
  // Mondes : éléments provisoires découpés dans les planches (art/decoupe -> public/assets/mondes).
  for (const k of worldImages(Object.values(LIFE).flatMap(l => l.floats)))
    scene.load.image('m:' + k, BASE + 'mondes/' + k + '.png');
}

export function setupAssets(scene: Phaser.Scene) {
  // Mondes : images dessinées (pas du pixel art), lissées quand on les agrandit.
  for (const k of scene.textures.getTextureKeys())
    if (k.startsWith('m:')) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
  // Pixel art : pas de lissage quand on agrandit.
  for (const k of ['persos', 'armes', ...[...FX_KEYS, ...Object.keys(PARTS)].map(k => 'fx-' + k)])
    scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
  for (const k of FX_KEYS) {
    if (scene.anims.exists('fx-' + k)) continue;
    scene.anims.create({
      key: 'fx-' + k,
      frames: scene.anims.generateFrameNumbers('fx-' + k),
      frameRate: k === 'splash' || k === 'smoke' ? 16 : 22,
      repeat: 0,
    });
  }
}
