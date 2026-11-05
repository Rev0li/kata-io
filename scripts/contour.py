"""Adoucit le contour noir des combattants du pack Ninja Adventure.

Le pack entoure chaque personnage d'un trait noir d'un pixel. Agrandi 4 fois en combat, il se voit comme
une bordure noire. On remplace chaque pixel noir du bord extérieur par la couleur voisine, assombrie :
le personnage garde une silhouette lisible sur tous les fonds, sans cadre noir. Les traits noirs à
l'intérieur (yeux, bandeaux) ne changent pas.

Usage : python3 scripts/contour.py <planche d'entrée> <planche de sortie> [taille d'une case, 16 par défaut]
Appelé aussi par scripts/build-assets.py.
"""
import sys

from PIL import Image

SOMBRE = 40  # un pixel est « noir » si aucune de ses composantes ne dépasse cette valeur
ASSOMBRIR = 0.5  # la couleur du contour = couleur voisine x ce facteur


def adoucir(im, case=16):
    im = im.convert('RGBA')
    src = im.load()
    out = im.copy()
    dst = out.load()
    w, h = im.size

    def plein(x, y, cx, cy):  # opaque et dans la même case (les cases voisines ne débordent pas)
        return cx <= x < cx + case and cy <= y < cy + case and src[x, y][3] > 0

    def noir(p):
        return p[3] > 0 and max(p[:3]) <= SOMBRE

    for y in range(h):
        for x in range(w):
            p = src[x, y]
            if not noir(p):
                continue
            cx, cy = x - x % case, y - y % case
            if all(plein(x + dx, y + dy, cx, cy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue  # trait intérieur : on le garde
            # couleur des voisins non noirs (proches d'abord, puis à deux pixels)
            for r in (1, 2):
                vois = [
                    src[x + dx, y + dy]
                    for dy in range(-r, r + 1)
                    for dx in range(-r, r + 1)
                    if plein(x + dx, y + dy, cx, cy) and not noir(src[x + dx, y + dy])
                ]
                if vois:
                    break
            if not vois:
                continue  # pointe fine toute noire : on la garde
            n = len(vois)
            dst[x, y] = tuple(round(sum(v[i] for v in vois) / n * ASSOMBRIR) for i in range(3)) + (p[3],)
    return out


if __name__ == '__main__':
    case = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    adoucir(Image.open(sys.argv[1]), case).save(sys.argv[2], optimize=True)
