#!/usr/bin/env python3
"""Fond de l'accueil : prolonge l'image générée (art/source/accueil/tour.png, 16:9) au format des téléphones.

L'image d'origine est posée à gauche, à pleine hauteur ; à droite, sous les boutons, elle se fond dans le bleu nuit
de l'interface. Écrit public/assets/accueil/tour.webp, en 2160 × 1000 : à ce rapport, un téléphone en paysage voit
toute la hauteur (la Tour et le sol). Sur ordinateur, le fond est recadré par la droite.
"""
import os

from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(ICI, '..', 'art', 'source', 'accueil', 'tour.png')
SORTIE = os.path.join(ICI, '..', 'public', 'assets', 'accueil', 'tour.webp')
W, H = 2160, 1000
SOMBRE = (17, 24, 32)  # le bleu nuit de l'interface
DEBUT_OMBRE, FIN_OMBRE = 1330, 1750  # abscisses où l'image commence à s'assombrir, puis disparaît

source = Image.open(SOURCE).convert('RGB')
im = source.resize((round(source.width * H / source.height), H), Image.LANCZOS)
out = Image.new('RGB', (W, H), SOMBRE)
out.paste(im, (0, 0))
ombre = Image.new('L', (W, H), 0)
for x in range(W):
    t = max(0.0, min(1.0, (x - DEBUT_OMBRE) / (FIN_OMBRE - DEBUT_OMBRE)))
    ombre.paste(int(255 * t * t * (3 - 2 * t)), (x, 0, x + 1, H))
out.paste(Image.new('RGB', (W, H), SOMBRE), (0, 0), ombre)
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
out.save(SORTIE, 'WEBP', quality=84, method=6)
print(os.path.normpath(SORTIE), os.path.getsize(SORTIE) // 1024, 'Ko')
