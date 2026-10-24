"""Passe une planche de personnages de 4 directions (bas, haut, gauche, droite) à 8 directions.

Le pack Ninja Adventure ne dessine que 4 directions. Les 4 diagonales sont assemblées ici en vue de trois quarts :
moitié gauche d'une vue, moitié droite d'une autre. Les colonnes d'une planche de 8 sont, dans l'ordre :
0 bas, 1 haut, 2 gauche, 3 droite, 4 bas-droite, 5 bas-gauche, 6 haut-droite, 7 haut-gauche.
Quand de vrais sprites en diagonale existeront, il suffira de remplacer les colonnes 4 à 7.
"""
import sys
from PIL import Image


def eight(im):
    """im : image 64x112 (4 colonnes, 7 postures de 16 px) -> image 128x112."""
    out = Image.new('RGBA', (128, im.height))
    for row in range(im.height // 16):
        f = [im.crop((c * 16, row * 16, c * 16 + 16, row * 16 + 16)) for c in range(4)]
        down, up, left, right = f

        def halves(a, b):
            o = a.copy(); o.paste(b.crop((8, 0, 16, 16)), (8, 0)); return o
        cols = [down, up, left, right, halves(down, right), halves(left, down), halves(up, right), halves(left, up)]
        for c, fr in enumerate(cols):
            out.paste(fr, (c * 16, row * 16))
    return out


if __name__ == '__main__':
    # usage : diagonals.py planche.png [nombre_de_personnages]  (convertit sur place une planche de 4 directions)
    src = sys.argv[1]; count = int(sys.argv[2]) if len(sys.argv) > 2 else 14
    sheet = Image.open(src).convert('RGBA')
    if sheet.width == 128 * count:
        sys.exit('déjà à 8 directions : rien à faire')
    assert sheet.width == 64 * count, sheet.size
    res = Image.new('RGBA', (128 * count, sheet.height))
    for i in range(count):
        res.paste(eight(sheet.crop((64 * i, 0, 64 * i + 64, sheet.height))), (128 * i, 0))
    res.save(src, optimize=True)
    print('ok', res.size)
