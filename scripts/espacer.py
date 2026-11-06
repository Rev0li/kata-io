"""Écarte les cases d'une planche de sprites pour supprimer les traits fins au bord des combattants.

Dans une planche collée (cases de 16 px bord à bord), le jeu agrandit les sprites avec un zoom de caméra
qui n'est pas entier : la carte graphique lit parfois la première colonne de la case voisine, qui
apparaît comme un trait fin à côté du combattant. On entoure chaque case d'un pixel qui recopie son
propre bord (extrusion) : ce qui déborde est alors la couleur du sprite lui-même, ou du vide.

Planche de sortie : marge de 1 px, 2 px entre les cases (à déclarer dans le chargement Phaser :
margin: 1, spacing: 2).

Usage : python3 scripts/espacer.py <planche d'entrée> <planche de sortie> [taille d'une case, 16 par défaut]
Appelé aussi par scripts/build-assets.py. À ne lancer qu'une fois sur une planche collée.
"""
import sys

from PIL import Image

MARGE = 1  # pixels recopiés autour de chaque case


def espacer(im, case=16):
    im = im.convert('RGBA')
    w, h = im.size
    assert w % case == 0 and h % case == 0, ('planche déjà espacée ?', im.size)
    pas = case + 2 * MARGE
    out = Image.new('RGBA', (w // case * pas, h // case * pas))
    for cy in range(h // case):
        for cx in range(w // case):
            fr = im.crop((cx * case, cy * case, cx * case + case, cy * case + case))
            x, y = cx * pas + MARGE, cy * pas + MARGE
            out.paste(fr, (x, y))
            for d in range(1, MARGE + 1):  # bords recopiés, puis coins
                out.paste(fr.crop((0, 0, case, 1)), (x, y - d))
                out.paste(fr.crop((0, case - 1, case, case)), (x, y + case - 1 + d))
                out.paste(fr.crop((0, 0, 1, case)), (x - d, y))
                out.paste(fr.crop((case - 1, 0, case, case)), (x + case - 1 + d, y))
            for dx in range(-MARGE, 1):
                for dy in range(-MARGE, 1):
                    out.putpixel((x + dx, y + dy), fr.getpixel((0, 0)))
                    out.putpixel((x + case - 1 - dx, y + dy), fr.getpixel((case - 1, 0)))
                    out.putpixel((x + dx, y + case - 1 - dy), fr.getpixel((0, case - 1)))
                    out.putpixel((x + case - 1 - dx, y + case - 1 - dy), fr.getpixel((case - 1, case - 1)))
    return out


if __name__ == '__main__':
    case = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    espacer(Image.open(sys.argv[1]), case).save(sys.argv[2], optimize=True)
