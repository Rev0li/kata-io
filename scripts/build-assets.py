"""Assemble les sprites du pack Ninja Adventure (Pixel-boy, CC0) dans public/assets.

Sources (deux dépôts publics, licence CC0) :
  git clone --depth 1 https://github.com/pixel-boy/NinjaAdventure.git na
  git clone --depth 1 --filter=blob:none --sparse https://github.com/sparklinlabs/superpowers-asset-packs.git sp
  (cd sp && git sparse-checkout set ninja-adventure)

Usage : python3 scripts/build-assets.py <dossier na> <dossier sp>
Il faut Pillow (pip install pillow). L'ordre des listes ci-dessous doit rester celui de src/game/assets.ts.
"""
import os
import shutil
import sys

from PIL import Image

NA, SP = sys.argv[1], os.path.join(sys.argv[2], 'ninja-adventure')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
# Assets générés mais plus utilisés par le jeu : gardés hors de public/ (non déployés).
ARCHIVE = os.path.join(os.path.dirname(__file__), '..', 'archive', 'assets')

# Personnages : planche de 4 colonnes (bas, haut, gauche, droite) sur 7 lignes de 16 px.
PERSOS = [
    ('ninja-bleu', os.path.join(NA, 'content/character/ninja_blue/sprite.png'), None),
    ('ninja-vert', os.path.join(SP, 'characters/1.png'), 1),
    ('ninja-pourpre', os.path.join(SP, 'characters/24.png'), 24),
    ('ombre', os.path.join(SP, 'characters/7.png'), 7),
    ('bandit', os.path.join(SP, 'characters/13.png'), 13),
    ('moine', os.path.join(SP, 'characters/2.png'), 2),
    ('samourai', os.path.join(SP, 'characters/21.png'), 21),
    ('ronin', os.path.join(SP, 'characters/5.png'), 5),
    ('oni', os.path.join(SP, 'characters/12.png'), 12),
    ('sumo', os.path.join(SP, 'characters/22.png'), 22),
    ('loup', os.path.join(SP, 'characters/11.png'), 11),
    ('ermite', os.path.join(SP, 'characters/9.png'), 9),
    ('shogun', os.path.join(SP, 'characters/20.png'), 20),
    ('squelette', os.path.join(SP, 'characters/23.png'), 23),
]
# Armes : (identifiant, fichier, sens de la pointe dans l'image d'origine)
ARMES = [
    ('katana', os.path.join(SP, 'weapons/katana.png'), 'down'),
    ('sai', os.path.join(SP, 'weapons/sai.png'), 'down'),
    ('yari', os.path.join(SP, 'weapons/lance.png'), 'down'),
    ('massue', os.path.join(NA, 'content/weapon/club/sprite.png'), 'up'),
    ('trident', os.path.join(SP, 'weapons/fork.png'), 'down'),
    ('hache', os.path.join(NA, 'content/weapon/axe/sprite.png'), 'up'),
    ('nodachi', os.path.join(NA, 'content/weapon/big_sword/sprite.png'), 'up'),
]
FX = {
    'hit': 2, 'star': 3, 'guard': 4, 'sparkle': 5, 'cross': 7, 'arc': 8, 'spin': 9, 'slash': 10,
    'fire': 12, 'splash': 15, 'dust': 16, 'smoke': 18, 'fireslash': 20,
}
ITEMS = ['scroll-empty', 'scroll-fire', 'scroll-ice', 'scroll-plant', 'scroll-rock', 'scroll-thunder',
         'shuriken', 'gold-coin']
ITEMS_ARCHIVE = ['gold-cup', 'silver-cup', 'little-treasure-chest', 'gold-key']


def main():
    os.makedirs(os.path.join(OUT, 'fx'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'items'), exist_ok=True)
    os.makedirs(os.path.join(ARCHIVE, 'items'), exist_ok=True)

    sheet = Image.new('RGBA', (64 * len(PERSOS), 112))
    faces = Image.new('RGBA', (38 * len(PERSOS), 38))
    for i, (pid, path, face) in enumerate(PERSOS):
        im = Image.open(path).convert('RGBA')
        assert im.size == (64, 112), (pid, im.size)
        sheet.paste(im, (64 * i, 0))
        if face:
            f = Image.open(os.path.join(SP, 'characters/faceset/%d.png' % face)).convert('RGBA')
        else:
            # pas de portrait dans le pack : la vue de face, agrandie, sur le même fond que les autres
            f = Image.new('RGBA', (38, 38), (2, 2, 2, 255))
            front = im.crop((0, 0, 16, 16)).resize((32, 32), Image.NEAREST)
            f.paste(front, (3, 6), front)
        faces.paste(f, (38 * i, 0))
    sheet.save(os.path.join(OUT, 'persos.png'), optimize=True)
    faces.save(os.path.join(OUT, 'portraits.png'), optimize=True)

    # Armes : pointe vers la droite, poignée à gauche, centrées dans une case de 16 px.
    weap = Image.new('RGBA', (16 * len(ARMES), 16))
    for i, (wid, path, tip) in enumerate(ARMES):
        im = Image.open(path).convert('RGBA')
        im = im.rotate(90 if tip == 'down' else -90, expand=True)
        im = im.crop(im.getbbox())
        assert im.width <= 16 and im.height <= 16, (wid, im.size)
        weap.paste(im, (16 * i, 8 - im.height // 2), im)
    weap.save(os.path.join(OUT, 'armes.png'), optimize=True)

    # Sol du dojo : un motif de 3 x 3 tuiles du temple (pierre claire, ou mousse pour le tatami mouillé).
    # Archivé : la plateforme est maintenant dessinée en code (render.ts).
    floor = Image.open(os.path.join(NA, 'content/map/tileset_interior_floor.png')).convert('RGBA')
    floor.crop((11 * 16, 0, 14 * 16, 48)).save(os.path.join(ARCHIVE, 'dojo.png'), optimize=True)
    floor.crop((11 * 16, 6 * 16, 14 * 16, 9 * 16)).save(os.path.join(ARCHIVE, 'dojo-mousse.png'), optimize=True)

    # Particules des effets de la boutique (traînées, ploufs) : bandes horizontales d'images.
    def strip(frames, name):
        w, h = frames[0].size
        out = Image.new('RGBA', (w * len(frames), h))
        for k, fr in enumerate(frames):
            out.paste(fr, (k * w, 0))
        out.save(os.path.join(OUT, 'fx', name + '.png'), optimize=True)

    def column(path, col=0):  # monstres : 4 colonnes (directions) x 4 lignes (images)
        im = Image.open(path).convert('RGBA')
        return [im.crop((col * 16, r * 16, col * 16 + 16, r * 16 + 16)) for r in range(4)]

    shutil.copy(os.path.join(NA, 'content/particle/particle_leaf_pink.png'), os.path.join(OUT, 'fx', 'leaf.png'))
    shutil.copy(os.path.join(NA, 'content/particle/particle_wood.png'), os.path.join(OUT, 'fx', 'wood.png'))
    shutil.copy(os.path.join(NA, 'content/character/pig/pig.png'), os.path.join(OUT, 'fx', 'pig.png'))
    shutil.copy(os.path.join(SP, 'items/coin-2.png'), os.path.join(OUT, 'fx', 'coin.png'))
    shutil.copy(os.path.join(SP, 'items/shuriken.png'), os.path.join(OUT, 'fx', 'shuriken.png'))
    shutil.copy(os.path.join(SP, 'items/big-treasure-chest.png'), os.path.join(OUT, 'fx', 'chest.png'))
    strip(column(os.path.join(SP, 'monsters/7.png')), 'ghost')
    strip(column(os.path.join(SP, 'monsters/9.png')), 'bird')
    strip(column(os.path.join(SP, 'monsters/2.png')), 'flame')

    for name, n in FX.items():
        shutil.copy(os.path.join(SP, 'fx/%d.png' % n), os.path.join(OUT, 'fx', name + '.png'))
    for name in ITEMS:
        shutil.copy(os.path.join(SP, 'items', name + '.png'), os.path.join(OUT, 'items', name + '.png'))
    for name in ITEMS_ARCHIVE:
        shutil.copy(os.path.join(SP, 'items', name + '.png'), os.path.join(ARCHIVE, 'items', name + '.png'))
    print('ok', len(PERSOS), 'personnages,', len(ARMES), 'armes,', len(FX), 'effets,', len(ITEMS), 'objets')


if __name__ == '__main__':
    main()
