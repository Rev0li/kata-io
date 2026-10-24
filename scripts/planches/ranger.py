# Range les morceaux retenus sous des noms parlants, retire les éclats isolés, et fait un aperçu par monde.
import os, sys, shutil
from collections import deque
from PIL import Image, ImageDraw
C, OUT = sys.argv[1], sys.argv[2]
M = {
 'cerisiers': ('cerisiers', {7:'plateforme', 8:'bord-angle-a', 9:'bord-planche', 14:'bord-angle-jade', 15:'bord-cotes', 18:'bord-angle-b',
   11:'cerisier-mixte', 37:'cerisier-rose', 46:'cerisier-rose-vif', 47:'cerisier-blanc', 12:'nenuphar-a', 28:'nenuphar-b', 29:'nenuphar-c',
   13:'lotus-bouton', 32:'lotus-rose-a', 33:'lotus-rose-b', 34:'lotus-blanc', 16:'koi-rouge-a', 38:'koi-rouge-b', 44:'koi-rouge-c',
   17:'koi-noir-or-a', 39:'koi-noir-or-b', 19:'koi-argente-saut', 45:'koi-argente', 20:'branche-moussue-a', 24:'branche-moussue-b',
   53:'branche-moussue-c', 23:'roseaux-a', 52:'roseaux-b', 30:'buisson', 31:'herbes-a', 62:'herbes-b', 25:'eau-tuile', 27:'rive-etang',
   36:'torii-grand', 41:'torii-petit', 42:'pont', 43:'stele', 40:'lanterne-pierre', 55:'lanterne-chemin-a', 56:'lanterne-chemin-b',
   57:'eclaboussure', 65:'petale'}),
 'bambous': ('bambou-b-final', {7:'torii-grand-a', 9:'torii-grand-b', 24:'torii-moyen', 25:'torii-petit', 14:'eau-tuiles', 26:'bord-angle-g',
   27:'bord-angle-d', 18:'bambous-groupe', 28:'bambous-a', 29:'bambous-b', 30:'bambous-c', 20:'pin-bonsai-a', 21:'pin-bonsai-b', 31:'sapin',
   23:'sapin-enneige-a', 33:'sapin-enneige-b', 32:'pin-enneige', 34:'pagode-3-etages', 35:'pagode-4-etages', 36:'sanctuaire-a', 37:'sanctuaire-b',
   38:'koi-a', 39:'koi-b', 41:'koi-c', 40:'koi-noir-or-a', 50:'koi-noir-or-b', 43:'nenuphars', 44:'nenuphars-lotus', 51:'nenuphars-sombres',
   52:'lotus', 59:'boutons-lotus', 45:'lanterne-pierre-a', 46:'lanterne-pierre-b', 47:'lanterne-pierre-c', 48:'lanterne-pierre-d',
   49:'lanterne-pierre-e', 53:'pont-rouge', 60:'pont-bois', 61:'pont-gris', 55:'rochers-a', 58:'rocher-b', 62:'rocher-c', 63:'rochers-d', 65:'rocher-e'}),
 'neige': ('neige-b-final', {9:'pin-enneige-a', 12:'pin-enneige-b', 10:'bambous-enneiges', 11:'prunier', 15:'buisson-a', 16:'buisson-b',
   13:'lanterne-a', 14:'lanterne-b', 18:'lanterne-c', 7:'lanterne-d', 21:'flocon-a', 22:'flocon-b', 26:'flocons-a', 27:'flocons-b',
   23:'rafale', 24:'lotus-gele'}),
 'neige+ez1': ('ez1', {1:'plaque-a', 2:'plaque-b', 3:'plaque-c', 4:'plaque-d', 5:'bord-angle', 6:'plaque-neige'}),
 'neige+ez2': ('ez2', {1:'glace-fissuree-paire', 2:'glace-paire', 3:'glace-a', 4:'glace-b', 5:'glace-fissuree', 6:'glace-c', 7:'lotus-blanc'}),
 'neige+ez3': ('ez3', {1:'torii-enneige-a', 2:'torii-enneige-b', 3:'pilier-torii'}),
 'forge': ('forge', {12:'dalle-a', 13:'dalle-b', 14:'dalle-c', 15:'dalle-d', 23:'dalle-e', 24:'dalle-f', 25:'dalle-g', 26:'dalle-h',
   32:'dalle-lave-a', 33:'dalle-lave-b', 34:'dalle-lave-c', 35:'dalle-lave-d', 16:'dalle-cadre', 27:'dalles-cadre-pile', 38:'bloc-cadre',
   52:'bloc-lave-a', 55:'bloc-lave-b', 53:'bloc-coin', 54:'bloc-moitie', 39:'blocs-lave-a', 40:'blocs-lave-b',
   17:'lave-a', 18:'lave-b', 19:'lave-ilot', 28:'lave-bulles-a', 29:'lave-bulles-b', 30:'lave-rocher', 36:'lave-bord-a', 37:'lave-bord-b', 41:'lave-bord-c',
   20:'mur-angle', 31:'mur', 21:'tour-a', 22:'tour-b', 43:'banniere-noire', 44:'banniere-rose', 45:'banniere-bleu-nuit', 47:'banniere-rouge',
   48:'banniere-verte', 49:'banniere-bleue', 50:'rocher-a', 57:'rocher-b', 51:'rochers-volcan', 56:'cone-volcan', 58:'rocher-arbre-mort',
   59:'arbre-mort', 62:'fumee-a', 63:'fumee-b', 64:'bulle-eclate', 66:'flamme-a', 67:'flammes-b', 68:'bulle-lave'}),
}
CROP = {('cerisiers', 25): (0, 18, 0, 0), ('cerisiers', 27): (0, 18, 0, 0), ('cerisiers', 55): (0, 0, 0, 26), ('cerisiers', 56): (0, 0, 0, 26)}
def clean(im):
    # garde les îlots opaques d'au moins 4 % du plus grand (retire les éclats des voisins)
    W, H = im.size; a = im.getchannel('A').load(); lab = {}; comps = []
    for y in range(H):
        for x in range(W):
            if a[x, y] > 40 and (x, y) not in lab:
                q = deque([(x, y)]); lab[(x, y)] = len(comps); cur = []
                while q:
                    i, j = q.popleft(); cur.append((i, j))
                    for u in (-1, 0, 1):
                        for v in (-1, 0, 1):
                            p = (i + u, j + v)
                            if 0 <= p[0] < W and 0 <= p[1] < H and a[p] > 40 and p not in lab: lab[p] = len(comps); q.append(p)
                comps.append(cur)
    if not comps: return im
    big = max(map(len, comps)); px = im.load()
    for c in comps:
        if len(c) < 0.04 * big:
            for p in c: px[p] = (0, 0, 0, 0)
    for y in range(H):
        for x in range(W):
            if a[x, y] <= 40: px[x, y] = (0, 0, 0, 0)
    return im.crop(im.getbbox())
done = {}
for key, (d, names) in M.items():
    monde = key.split('+')[0]; o = os.path.join(OUT, monde); os.makedirs(o, exist_ok=True)
    for n, name in names.items():
        im = Image.open(f'{C}/{d}/{n:03d}.png').convert('RGBA')
        if (monde, n) in CROP and d == 'cerisiers':
            l, t, r, b = CROP[(monde, n)]; im = im.crop((l, t, im.width - r, im.height - b))
        im = clean(im); im.save(f'{o}/{name}.png'); done.setdefault(monde, []).append((name, im))
for monde, items in done.items():
    items.sort(); cell, cols = 170, 8
    sheet = Image.new('RGB', (cols * cell, ((len(items) + cols - 1) // cols) * cell), (79, 111, 102)); dr = ImageDraw.Draw(sheet)
    for k, (name, im) in enumerate(items):
        t = im.copy(); t.thumbnail((cell - 12, cell - 30)); X, Y = (k % cols) * cell, (k // cols) * cell
        sheet.paste(t, (X + (cell - t.width) // 2, Y + 4 + (cell - 30 - t.height) // 2), t); dr.text((X + 6, Y + cell - 20), name, fill=(255, 255, 255))
    sheet.save(f'{OUT}/{monde}-apercu.png'); print(monde, len(items))
