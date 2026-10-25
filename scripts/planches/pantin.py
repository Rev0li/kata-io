"""Prépare les pièces d'un pantin pour le jeu : réduction, même échelle pour toutes les vues, axe de chaque membre.

Usage : python3 scripts/planches/pantin.py ninja-bleu
Lit art/decoupe/combattants/<id>/<vue>/*.png et écrit :
  - public/assets/combattants/<id>/<vue>/<pièce>.png (réduites)
  - src/game/render/pantins/<id>.ts (tailles et axes des pièces, lus par puppet.ts)
L'axe d'un membre est son grand axe (analyse en composantes principales du masque) : « prox » est
l'extrémité du haut (épaule, coude, hanche, genou), « dist » celle du bas (coude, poing, genou, pied).
"""
import json
import math
import os
import sys

from PIL import Image

CID = sys.argv[1]
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art', 'decoupe', 'combattants', CID)
OUT = os.path.join(ROOT, 'public', 'assets', 'combattants', CID)
TS = os.path.join(ROOT, 'src', 'game', 'render', 'pantins', CID + '.ts')
PRE = 0.2  # réduction des pièces de face (corps entier d'environ 940 px -> 190 px)
LIMBS = ('bras', 'avant-bras', 'cuisse', 'jambe', 'bras-sans-main')
# Corps (hors tête) agrandi par vue : la planche de dos a été générée avec un corps plus petit que la tête.
BODY = {'dos': 1.3}


def axis(im):
    a = im.getchannel('A')
    w, h = im.size
    pts = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if a.getpixel((x, y)) > 128]
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts) / n
    syy = sum((p[1] - my) ** 2 for p in pts) / n
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts) / n
    th = 0.5 * math.atan2(2 * sxy, sxx - syy)
    vx, vy = math.cos(th), math.sin(th)
    proj = [(p[0] - mx) * vx + (p[1] - my) * vy for p in pts]
    lo, hi = min(proj), max(proj)
    a1 = (mx + vx * lo, my + vy * lo)
    a2 = (mx + vx * hi, my + vy * hi)
    prox, dist = (a1, a2) if a1[1] <= a2[1] else (a2, a1)
    return [round(prox[0], 1), round(prox[1], 1)], [round(dist[0], 1), round(dist[1], 1)]


def shin_axis(im):
    # jambe avec le pied : l'axe va du centre du haut au centre du mollet (le pied qui dépasse fausserait le grand axe)
    a = im.getchannel('A')
    w, h = im.size

    def mid(y0, y1):
        xs = [x for y in range(int(y0), int(y1)) for x in range(w) if a.getpixel((x, y)) > 128]
        return sum(xs) / len(xs)

    return [round(mid(0, h * 0.08), 1), 0.0], [round(mid(h * 0.6, h * 0.72), 1), round(h * 0.82, 1)]


views = {}
heads = {}
for view in sorted(os.listdir(SRC)):
    d = os.path.join(SRC, view)
    if os.path.isdir(d):
        heads[view] = Image.open(os.path.join(d, 'tete.png')).height
ref = heads.get('face', next(iter(heads.values())))
for view, hh in heads.items():
    k = PRE * ref / hh  # toutes les vues à l'échelle de la face (même hauteur de tête)
    os.makedirs(os.path.join(OUT, view), exist_ok=True)
    pieces = {}
    for f in sorted(os.listdir(os.path.join(SRC, view))):
        if not f.endswith('.png'):
            continue
        name = f[:-4]
        im = Image.open(os.path.join(SRC, view, f)).convert('RGBA')
        kk = k * (1 if name.startswith('tete') else BODY.get(view, 1))
        im = im.resize((max(1, round(im.width * kk)), max(1, round(im.height * kk))), Image.LANCZOS)
        im.save(os.path.join(OUT, view, f), optimize=True)
        p = {'w': im.width, 'h': im.height}
        if name.startswith('jambe'):
            p['prox'], p['dist'] = shin_axis(im)
        elif name.rsplit('-', 1)[0] in LIMBS or name in LIMBS:
            p['prox'], p['dist'] = axis(im)
        pieces[name] = p
    views[view] = pieces

os.makedirs(os.path.dirname(TS), exist_ok=True)
with open(TS, 'w') as fh:
    fh.write('// Généré par scripts/planches/pantin.py : taille des pièces (px) et axe des membres (prox -> dist).\n')
    fh.write('import type { PuppetRig } from \'../puppet\';\n\n')
    fh.write('export const RIG: PuppetRig = ' + json.dumps(views, ensure_ascii=False) + ';\n')
print(CID, {v: len(p) for v, p in views.items()})
