"""Essai LPC : repère les animations où une pièce du combattant manque.

Certaines pièces LPC n'existent pas pour toutes les animations (pantalon large, ceintures, masques…) : le personnage
y apparaît sans elles. On prend les couleurs bien présentes dans la marche (même direction) et on vérifie qu'elles
se retrouvent dans l'animation ; si une partie disparaît, c'est qu'une pièce manque.

Résultat au 2026-11-05 : marche, estoc, taille et sort sont complets pour les 14 combattants ; repos, saut, course,
garde et emote perdent des pièces chez la moitié d'entre eux. Le jeu n'utilise donc que les premières.

Usage : python3 scripts/lpc-verif.py
"""
import glob
import os
from collections import Counter

from PIL import Image

SEUIL = 0.98  # part des couleurs de la marche qu'on doit retrouver
ANIMS = {
    'cast': (0, 7), 'thrust': (4, 8), 'slash': (12, 6), 'idle': (22, 2), 'jump': (26, 5), 'emote': (34, 3),
    'run': (38, 8), 'combat': (42, 2),
}


def couleurs(im, row, col):
    case = im.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64))
    return Counter(p[:3] for p in case.get_flattened_data() if p[3] > 0)


def main():
    dossier = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'lpc')
    for f in sorted(glob.glob(os.path.join(dossier, '*.png'))):
        im = Image.open(f).convert('RGBA')
        manque = []
        for nom, (row, n) in ANIMS.items():
            pire = 1.0
            for d in range(4):
                ref = [c for c, k in couleurs(im, 8 + d, 0).items() if k >= 12]
                vu = Counter()
                for c in range(n):
                    vu += couleurs(im, row + d, c)
                pire = min(pire, sum(1 for c in ref if vu[c] >= 2) / len(ref))
            if pire < SEUIL:
                manque.append('%s %.0f %%' % (nom, pire * 100))
        print('%-14s %s' % (os.path.basename(f)[:-4], ', '.join(manque) or 'complet'))


if __name__ == '__main__':
    main()
