#!/usr/bin/env python3
"""Génère le décor pixel art de Kata.io : horizons des 6 dojos, poissons animés, nénuphars et objets flottants.

Tout est dessiné en code (aucun pack externe), donc libre de droits. Résultat dans public/assets :
  bg/<theme>.png   horizon 400x70 px (affiché ×6) : ciel dégradé tramé, silhouettes, rive, reflets
  fauna.png        poissons 32x16, 8 images de nage par espèce (une ligne par espèce)
  floats.png       objets flottants 24x16 (nénuphar, fleur, glace, roche de lave, lanterne, feuille)

Usage : python3 scripts/build-decor.py
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
K = 2  # finesse : l'horizon est dessiné en 800x140 et affiché à ×3, comme les sprites (même taille de pixel)
W, H = 400 * K, 70 * K
HORIZON = 50 * K  # première ligne d'eau


def u(v):
    return int(round(v * K))


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def hx(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def mixc(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def dark(c, k=0.55):
    return tuple(int(v * k) for v in c)


def light(c, k=0.35):
    return mixc(c, (255, 255, 255), k)


def dither_vgrad(px, x0, x1, y0, y1, c0, c1, steps=5):
    """Dégradé vertical tramé (Bayer 4x4) : quelques teintes seulement, comme en pixel art."""
    cols = [mixc(c0, c1, i / (steps - 1)) for i in range(steps)]
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1) * (steps - 1)
        lo = int(math.floor(t))
        fr = t - lo
        for x in range(x0, x1):
            th = (BAYER[y % 4][x % 4] + 0.5) / 16
            i = min(steps - 1, lo + (1 if fr > th else 0))
            px[x, y] = cols[i] + (255,)


def noise1d(rng, n, octaves=4):
    """Bruit lisse en 1D normalisé entre 0 et 1."""
    out = [0.0] * n
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        step = max(2, n // (3 * 2 ** o))
        pts = [rng.random() for _ in range(n // step + 3)]
        for x in range(n):
            i = x // step
            f = (x % step) / step
            f = f * f * (3 - 2 * f)
            out[x] += amp * (pts[i] * (1 - f) + pts[i + 1] * f)
        tot += amp
        amp *= 0.5
    return [v / tot for v in out]


def stamp(base, el, outline=None, ox=0, oy=0):
    """Colle un élément RGBA avec un contour d'un pixel (1 px de plus que la silhouette)."""
    a = el.split()[3].point(lambda v: 255 if v > 0 else 0)
    big = a.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(big, a)
    if outline is None:
        # contour = version sombre de la couleur dominante de l'élément
        px = [p for p in el.get_flattened_data() if p[3] > 0] if hasattr(el, 'get_flattened_data') else [p for p in el.getdata() if p[3] > 0]
        r = sum(p[0] for p in px) // max(1, len(px))
        g = sum(p[1] for p in px) // max(1, len(px))
        b = sum(p[2] for p in px) // max(1, len(px))
        outline = dark((r, g, b), 0.45)
    ol = Image.new('RGBA', el.size, outline + (255,))
    ol.putalpha(ring)
    base.alpha_composite(ol, (ox, oy))
    base.alpha_composite(el, (ox, oy))


def ridge(img, base_y, amp, seed, col, shade, top_light=None, x0=0, x1=W, fade=18, octaves=4, dither_rows=3):
    base_y, amp, fade, dither_rows = base_y * K, amp * K, fade * K, dither_rows * K
    """Ligne de crêtes : silhouette de montagnes ou de collines, avec trame d'ombre sous la crête."""
    rng = random.Random(seed)
    n = noise1d(rng, W, octaves)
    px = img.load()
    for x in range(x0, x1):
        # la crête s'efface vers les bords du cadre pour que l'horizon reste ouvert
        edge = min(1.0, min(x - x0, x1 - 1 - x) / fade) if fade else 1.0
        h = int(round(base_y - amp * n[x] * edge))
        for y in range(h, HORIZON):
            d = y - h
            c = col
            if d < dither_rows and (x + y) % 2 == 0:
                c = top_light or light(col, 0.18)
            elif d >= dither_rows + 3 * K and (BAYER[y % 4][x % 4] < 4 * (d / (24 * K))):
                c = shade
            px[x, y] = c + (255,)
        if 0 <= h < H:
            px[x, h] = (top_light or light(col, 0.25)) + (255,)


def blob_tree(w, h, col, shade, hi, trunk=None, rng=None):
    w, h = u(w), u(h)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    ch = int(h * 0.78)
    d.ellipse([0, 0, w - 1, ch], fill=col + (255,))
    d.ellipse([w * 0.16, ch * 0.08, w * 0.6, ch * 0.5], fill=hi + (255,))
    d.ellipse([w * 0.22, ch * 0.14, w * 0.42, ch * 0.3], fill=light(hi, 0.3) + (255,))
    px = el.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x / w + y / ch) > 1.2 and (x + y) % 2 == 0:
                px[x, y] = shade + (255,)
    if trunk:
        d.rectangle([w // 2 - K, ch - 1, w // 2 + K - 1, h - 1], fill=trunk + (255,))
    return el


def pine(w, h, col, shade, hi, snow=None):
    w, h = u(w), u(h)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    tiers = 5
    th = u(5)
    for i in range(tiers):
        top = int(i * (h - th) / tiers * 0.85)
        bot = top + int((h - th) / tiers * 1.5)
        half = int(w / 2 * (0.4 + 0.6 * (i + 1) / tiers))
        d.polygon([(w // 2, top), (w // 2 - half, bot), (w // 2 + half, bot)], fill=col + (255,))
        d.polygon([(w // 2, top), (w // 2 - half, bot), (w // 2 - half // 3, bot)], fill=hi + (255,))
        d.polygon([(w // 2, top), (w // 2 + half, bot), (w // 2 + half // 2, bot)], fill=shade + (255,))
        if snow:
            d.polygon([(w // 2, top), (w // 2 - half * 0.55, top + (bot - top) * 0.55), (w // 2 + half * 0.55, top + (bot - top) * 0.55)], fill=snow + (255,))
    d.rectangle([w // 2 - K, h - th, w // 2 + K - 1, h - 1], fill=shade + (255,))
    return el


def bamboo(h, col, shade, hi, leaf):
    h = u(h)
    w = u(9)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    d.rectangle([u(3), 0, u(5) - 1, h - 1], fill=col + (255,))
    d.rectangle([u(3), 0, u(3) + 1, h - 1], fill=hi + (255,))
    d.rectangle([u(5) - 2, 0, u(5) - 1, h - 1], fill=shade + (255,))
    for y in range(u(4), h, u(9)):
        d.rectangle([u(2), y, u(6) - 1, y + 1], fill=shade + (255,))
    for y in (u(3), u(10), u(17)):
        if y < h - u(3):
            d.polygon([(u(5), y), (u(8), y - u(2)), (u(8), y + u(1))], fill=leaf + (255,))
            d.polygon([(u(3), y + u(2)), (0, y), (0, y + u(3))], fill=leaf + (255,))
    return el


def pagoda(w, h, wall, roof, roof_hi, trim):
    w, h = u(w), u(h)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    tiers = 3
    th = h // tiers
    for i in range(tiers):
        tw = int(w * (1 - i * 0.22))
        cx = w // 2
        y1 = h - u(3) - i * th
        y0 = y1 - th + u(2)
        d.rectangle([cx - tw // 2 + u(2), y0 + u(3), cx + tw // 2 - u(2), y1], fill=wall + (255,))
        d.rectangle([cx - tw // 4, y0 + u(5), cx - tw // 4 + K, y1 - 1], fill=trim + (255,))
        d.rectangle([cx + tw // 4 - K, y0 + u(5), cx + tw // 4, y1 - 1], fill=trim + (255,))
        d.rectangle([cx - tw // 2 + u(2), y1 - 1, cx + tw // 2 - u(2), y1], fill=dark(wall, 0.7) + (255,))
        d.polygon([(cx - tw // 2 - u(3), y0 + u(3)), (cx - tw // 2 + u(1), y0 + u(4)), (cx, y0 - u(2)), (cx + tw // 2 - u(1), y0 + u(4)), (cx + tw // 2 + u(3), y0 + u(3)), (cx + tw // 2 - u(1), y0 + u(6)), (cx - tw // 2 + u(1), y0 + u(6))], fill=roof + (255,))
        d.line([(cx - tw // 2, y0 + u(3)), (cx, y0 - u(1))], fill=roof_hi + (255,), width=K)
    d.line([(w // 2, 0), (w // 2, u(5))], fill=trim + (255,), width=K)
    return el


def torii(w, h, col, hi):
    w, h = u(w), u(h)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    d.rectangle([u(2), u(4), u(4) - 1, h - 1], fill=col + (255,))
    d.rectangle([w - u(5), u(4), w - u(3) - 1, h - 1], fill=col + (255,))
    d.rectangle([0, u(1), w - 1, u(3) - 1], fill=col + (255,))
    d.rectangle([u(3), u(7), w - u(4), u(8) - 1], fill=col + (255,))
    d.rectangle([0, u(1), w - 1, u(1) + 1], fill=hi + (255,))
    return el


def rock(w, h, col, shade, hi, snow=None):
    w, h = u(w), u(h)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    pts = [(0, h - 1), (int(w * 0.1), int(h * 0.5)), (int(w * 0.28), int(h * 0.18)), (int(w * 0.42), 1), (int(w * 0.75), int(h * 0.25)), (int(w * 0.92), int(h * 0.6)), (w - 1, h - 1)]
    d.polygon(pts, fill=col + (255,))
    d.polygon([pts[0], pts[1], pts[2], pts[3], (int(w * 0.44), h - 1)], fill=hi + (255,))
    d.polygon([pts[3], pts[4], pts[5], pts[6], (int(w * 0.52), h - 1)], fill=shade + (255,))
    d.line([(int(w * 0.42), 2), (int(w * 0.5), int(h * 0.6))], fill=dark(col, 0.7) + (255,))
    if snow:
        d.polygon([pts[1], pts[2], pts[3], pts[4], (int(w * 0.6), int(h * 0.4)), (int(w * 0.3), int(h * 0.48))], fill=snow + (255,))
    return el


def stone_lantern(h, col, hi, glow):
    h = u(h)
    w = u(9)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    d.rectangle([u(3), h // 2, u(6) - 1, h - 1], fill=col + (255,))
    d.rectangle([u(1), h // 2 - u(5), u(8) - 1, h // 2], fill=col + (255,))
    d.rectangle([u(3), h // 2 - u(4), u(6) - 1, h // 2 - u(1)], fill=glow + (255,))
    d.polygon([(0, h // 2 - u(5)), (w // 2, h // 2 - u(10)), (w - 1, h // 2 - u(5))], fill=hi + (255,))
    d.rectangle([u(2), h - u(2), u(7) - 1, h - 1], fill=hi + (255,))
    return el


def cloud(w, h, col, shade, rng):
    w, h = u(w), u(h)
    el = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(el)
    for _ in range(7):
        cx, cy = rng.randint(w // 5, 4 * w // 5), rng.randint(h // 2, h - u(3))
        r = rng.randint(h // 3, h // 2)
        d.ellipse([cx - r, cy - r + 1, cx + r, cy + r - 1], fill=col + (255,))
    d.rectangle([0, h - u(3), w - 1, h - 1], fill=col + (255,))
    px = el.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and y > h - u(5) and (x + y) % 2 == 0:
                px[x, y] = shade + (255,)
    return el


def reflect(img):
    """Reflets : on miroite le bas de la scène sous l'horizon, plus sombre et décalé en vagues."""
    px = img.load()
    water = px[0, H - 1]
    for y in range(HORIZON, H):
        d = y - HORIZON
        sy = HORIZON - 1 - int(d * 1.6)
        if sy < 12 * K:
            continue
        for x in range(W):
            sx = x + (1 if (y // K) % 2 else 0) + (1 if d % (5 * K) == 0 else 0)
            sx = max(0, min(W - 1, sx))
            c = px[sx, sy]
            wcol = px[x, y]
            if c[3] and (BAYER[y % 4][x % 4] < 9 - d // (2 * K)):
                px[x, y] = mixc(wcol[:3], c[:3], 0.38) + (255,)


def finish(img, water_col, name, sky_top):
    """Fond d'eau opaque, fondu final vers la couleur d'eau, première ligne = couleur du ciel."""
    px = img.load()
    # la ligne du haut doit valoir exactement la couleur du ciel (le ciel continue derrière)
    for x in range(W):
        px[x, 0] = sky_top + (255,)
    # fondu des 8 dernières lignes vers l'eau (trame)
    for y in range(H - 8 * K, H):
        t = (y - (H - 8 * K)) / (8 * K - 1)
        for x in range(W):
            if t > (BAYER[y % 4][x % 4] + 0.5) / 16:
                px[x, y] = water_col + (255,)
    for x in range(W):
        px[x, H - 1] = water_col + (255,)
    os.makedirs(os.path.join(OUT, 'bg'), exist_ok=True)
    img.save(os.path.join(OUT, 'bg', name + '.png'))


def sprinkle(img, rng, ys, col, n, step=1):
    px = img.load()
    for _ in range(n):
        x, y = rng.randrange(W), rng.randrange(*ys)
        if (x + y) % step == 0:
            px[x, y] = col + (255,)


def place(img, el, x, base_y, **kw):
    x = x * K  # x en unités 1x, base_y déjà en pixels réels (HORIZON + décalage)
    stamp(img, el, ox=int(x - el.size[0] / 2), oy=int(base_y - el.size[1]), **kw)


def base_scene(sky0, sky1, water, horizon_col):
    img = Image.new('RGBA', (W, H), water + (255,))
    px = img.load()
    dither_vgrad(px, 0, W, 0, HORIZON, sky0, sky1, steps=7)
    # eau : léger dégradé tramé vers le fond
    dither_vgrad(px, 0, W, HORIZON, H, mixc(water, horizon_col, 0.35), water, steps=5)
    return img


# ---------------------------------------------------------------- les 6 dojos
def make_coucher():
    rng = random.Random(11)
    sky0, sky1, water = hx('#d9a982'), hx('#f3c99a'), hx('#355d62')
    img = base_scene(sky0, sky1, water, hx('#f3c99a'))
    d = ImageDraw.Draw(img)
    # soleil bas, auréole tramée
    cx, cy = u(205), u(40)
    px = img.load()
    for y in range(u(18), HORIZON):
        for x in range(cx - u(40), cx + u(40)):
            dist = math.hypot((x - cx) / 1.6, y - cy)
            if dist < u(15) and (BAYER[y % 4][x % 4] < 16 * (1 - dist / u(15)) * 1.0):
                px[x, y] = hx('#fbe2b4') + (255,)
    d.ellipse([cx - u(8), cy - u(8), cx + u(8), cy + u(8)], fill=hx('#fff0cc') + (255,))
    for _ in range(3):
        el = cloud(rng.randint(40, 70), 11, hx('#f6cfa5'), hx('#e0a57b'), rng)
        place(img, el, rng.randint(30, 370), u(rng.randint(14, 30)))
    ridge(img, 40, 12, 3, hx('#9d8f86'), hx('#8c7e7a'), hx('#b9a79a'))
    ridge(img, 46, 8, 4, hx('#5f8a86'), hx('#4a7370'), hx('#78a29c'), fade=30)
    # arbres orange et bleu-vert de part et d'autre, comme la référence
    for side in (0, 1):
        for i in range(6):
            x = (10 + i * 20 + rng.randint(-5, 5)) if side == 0 else (400 - 10 - i * 20 + rng.randint(-5, 5))
            tw, th = rng.randint(14, 22), rng.randint(22, 38)
            if rng.random() < 0.5:
                el = blob_tree(tw, th, hx('#e08a52'), hx('#b4623a'), hx('#f0a874'), hx('#7a4630'))
            else:
                el = blob_tree(tw, th, hx('#4f8f8c'), hx('#2f6468'), hx('#7ab8b0'), hx('#7a4630'))
            place(img, el, x, HORIZON + 1 - rng.randint(0, 3))
    for x, w_, h_ in [(335, 24, 20), (362, 18, 14), (60, 16, 11)]:
        place(img, rock(w_, h_, hx('#d99a78'), hx('#a56a52'), hx('#efb996')), x, HORIZON + 3)
    el = pagoda(26, 36, hx('#8c5a3a'), hx('#3d6e72'), hx('#5f9aa0'), hx('#e9c27a'))
    place(img, el, 150, HORIZON + 1)
    reflect(img)
    finish(img, water, 'coucher', sky0)


def make_brume():
    rng = random.Random(21)
    sky0, sky1, water = hx('#a3a69c'), hx('#cfd3c6'), hx('#656455')
    img = base_scene(sky0, sky1, water, hx('#cfd3c6'))
    for _ in range(4):
        el = cloud(rng.randint(60, 110), 12, hx('#d9ddd0'), hx('#b8bcae'), rng)
        place(img, el, rng.randint(40, 360), u(rng.randint(14, 34)))
    ridge(img, 34, 22, 5, hx('#a9aea3'), hx('#98a095'), hx('#c4c8bb'), octaves=5)
    ridge(img, 42, 16, 6, hx('#8a9388'), hx('#78837a'), hx('#a5ada1'), fade=30)
    ridge(img, 47, 8, 7, hx('#6d7a6e'), hx('#5b685d'), hx('#8b988c'), fade=40)
    # pins dans la brume, plus pâles au loin
    for i in range(14):
        x = rng.randint(5, 395)
        if 150 < x < 255:
            continue
        h_ = rng.randint(18, 34)
        far = rng.random() < 0.5
        col = hx('#7f8c80') if far else hx('#4f6354')
        el = pine(rng.randint(10, 16), h_, col, hx('#38493e'), light(col, 0.18))
        place(img, el, x, HORIZON + 1 - (3 if far else 0))
    place(img, torii(30, 28, hx('#9c4a3a'), hx('#c26a54')), 205, HORIZON + 2)
    place(img, pagoda(24, 34, hx('#6e5a46'), hx('#4a4f48'), hx('#6e766c'), hx('#c9a25c')), 72, HORIZON + 1)
    for x in (30, 360):
        place(img, stone_lantern(16, hx('#7a8077'), hx('#a1a79c'), hx('#ffd88a')), x, HORIZON + 4)
    # voile de brume : trame blanche au ras de l'eau
    px = img.load()
    for y in range(HORIZON - u(9), HORIZON + u(2)):
        for x in range(W):
            if (BAYER[y % 4][x % 4] < (y - (HORIZON - u(9))) * 1.3 / K):
                px[x, y] = mixc(px[x, y][:3], hx('#dfe2d6'), 0.5) + (255,)
    reflect(img)
    finish(img, water, 'brume', sky0)


def make_neon():
    rng = random.Random(31)
    sky0, sky1, water = hx('#0c1229'), hx('#2a1f4d'), hx('#0a1020')
    img = base_scene(sky0, sky1, water, hx('#2a1f4d'))
    px = img.load()
    # étoiles et lune
    for _ in range(110):
        x, y = rng.randrange(W - 1), rng.randrange(1, HORIZON - 8 * K)
        c = (hx('#dfe6ff') if rng.random() < 0.7 else hx('#2de6ea')) + (255,)
        px[x, y] = c
        if rng.random() < 0.25:
            px[x + 1, y] = c; px[x, y + 1] = c
    d = ImageDraw.Draw(img)
    d.ellipse([u(300), u(8), u(322), u(30)], fill=hx('#e9ecff') + (255,))
    d.ellipse([u(306), u(8), u(326), u(28)], fill=hx('#2a1f4d') + (255,))
    # silhouette de ville-temple : tours et toits éclairés
    ridge(img, 44, 10, 8, hx('#161a3a'), hx('#101330'), hx('#242a5c'))
    for i in range(18):
        x = 10 + i * 22 + rng.randint(-6, 6)
        if 160 < x < 250:
            continue
        w_, h_ = u(rng.randint(10, 20)), u(rng.randint(14, 34))
        el = Image.new('RGBA', (w_, h_), hx('#12162f') + (255,))
        ed = ImageDraw.Draw(el)
        for wy in range(u(3), h_ - u(2), u(4)):
            for wx in range(u(2), w_ - u(2), u(4)):
                if rng.random() < 0.55:
                    col = hx('#ff9a3c') if rng.random() < 0.6 else hx('#2de6ea')
                    ed.rectangle([wx, wy, wx + K, wy + K], fill=col + (255,))
        place(img, el, x, HORIZON + 1, outline=hx('#05060f'))
    place(img, pagoda(28, 38, hx('#1b1f45'), hx('#2de6ea'), hx('#a8fbff'), hx('#ff9a3c')), 205, HORIZON + 1, outline=hx('#05060f'))
    # guirlande de lanternes néon à l'horizon
    for x in range(0, W - K, u(9)):
        sag = int(u(2.5) * math.sin(x / u(9) * math.pi / 4))
        col = hx('#ff9a3c') if (x // u(9)) % 2 else hx('#2de6ea')
        for dx in range(K):
            px[x + dx, HORIZON - u(3) + sag] = col + (255,)
            px[x + dx, HORIZON - u(3) + sag + 1] = col + (255,)
            px[x + dx, HORIZON - u(2) + sag + 1] = mixc(col, (0, 0, 0), 0.4) + (255,)
    reflect(img)
    # reflets néon plus nets dans l'eau
    for y in range(HORIZON + 1, H - 8 * K, 2):
        for x in range(0, W, u(9)):
            col = hx('#ff9a3c') if (x // u(9)) % 2 else hx('#2de6ea')
            if (x + y) % 3 == 0:
                px[x, y] = mixc(px[x, y][:3], col, 0.5) + (255,)
    finish(img, water, 'neon', sky0)


def make_neige():
    rng = random.Random(41)
    sky0, sky1, water = hx('#b9cfe0'), hx('#e4eef6'), hx('#3b5a74')
    img = base_scene(sky0, sky1, water, hx('#e4eef6'))
    px = img.load()
    for _ in range(3):
        place(img, cloud(rng.randint(60, 100), 11, hx('#f4f8fb'), hx('#cfdde8'), rng), rng.randint(40, 360), u(rng.randint(12, 30)))
    # grandes montagnes enneigées
    for cx, w_, h_, col in [(60, 90, 34, '#8aa0b8'), (330, 100, 38, '#8aa0b8'), (200, 80, 26, '#a4b6c9')]:
        w_, h_ = u(w_), u(h_)
        el = Image.new('RGBA', (w_, h_), (0, 0, 0, 0))
        ed = ImageDraw.Draw(el)
        ed.polygon([(0, h_ - 1), (w_ // 2, 0), (w_ - 1, h_ - 1)], fill=hx(col) + (255,))
        ed.polygon([(w_ // 2, 0), (w_ - 1, h_ - 1), (w_ // 2 + u(8), h_ - 1), (w_ // 2 - 1, h_ // 3)], fill=hx('#6f869e') + (255,))
        ed.polygon([(w_ // 2, 0), (w_ // 2 - u(14), h_ // 2.4), (w_ // 2 - u(5), h_ // 2.8), (w_ // 2, h_ // 2.2), (w_ // 2 + u(6), h_ // 2.9), (w_ // 2 + u(14), h_ // 2.4)], fill=hx('#f6fafc') + (255,))
        place(img, el, cx, HORIZON + 1)
    ridge(img, 46, 8, 9, hx('#dbe6ef'), hx('#bccbd9'), hx('#f6fafc'), fade=40)
    for i in range(16):
        x = rng.randint(5, 395)
        if 160 < x < 250:
            continue
        el = pine(rng.randint(10, 15), rng.randint(18, 32), hx('#456a5e'), hx('#2c4a42'), hx('#5d8776'), snow=hx('#f6fafc'))
        place(img, el, x, HORIZON + 1)
    place(img, pagoda(24, 34, hx('#8a6a58'), hx('#c9d6e2'), hx('#f6fafc'), hx('#d9a45c')), 120, HORIZON + 1)
    for x in (40, 350):
        place(img, rock(22, 14, hx('#9fb0c0'), hx('#7d8fa2'), hx('#c4d2de'), snow=hx('#f6fafc')), x, HORIZON + 4)
    reflect(img)
    finish(img, water, 'neige', sky0)


def make_bambou():
    rng = random.Random(51)
    sky0, sky1, water = hx('#b8d4a0'), hx('#e9f0c2'), hx('#2f5a4a')
    img = base_scene(sky0, sky1, water, hx('#e9f0c2'))
    px = img.load()
    for _ in range(3):
        place(img, cloud(rng.randint(50, 90), 10, hx('#f3f7d9'), hx('#cddcab'), rng), rng.randint(40, 360), u(rng.randint(10, 26)))
    ridge(img, 38, 18, 12, hx('#8fb08a'), hx('#7a9c78'), hx('#aac8a2'), octaves=5)
    ridge(img, 45, 10, 13, hx('#5f8f6c'), hx('#4a7a5a'), hx('#7aaa86'), fade=40)
    # forêt dense de bambous sur les côtés, plus clairsemée au centre
    for i in range(46):
        x = rng.randint(2, 397)
        center = 1 - min(1, abs(x - 200) / 90)
        if rng.random() < center * 0.85:
            continue
        h_ = rng.randint(30, 62)
        far = rng.random() < 0.4
        col = hx('#6e9a5e') if far else hx('#4e8a4a')
        el = bamboo(h_, col, dark(col, 0.7), light(col, 0.25), hx('#78b85a') if not far else hx('#8fb878'))
        place(img, el, x, HORIZON + 2 + (0 if far else 2))
    place(img, pagoda(22, 30, hx('#8f6c4a'), hx('#3f6b50'), hx('#6a9a76'), hx('#e9c27a')), 205, HORIZON + 1)
    place(img, torii(24, 22, hx('#b0472f'), hx('#d46a4c')), 120, HORIZON + 3)
    for x in (30, 365):
        place(img, rock(24, 14, hx('#7d9a82'), hx('#5b7a64'), hx('#a3bda6')), x, HORIZON + 4)
    # rayons de soleil dans les feuillages
    for _ in range(160):
        x, y = rng.randrange(W), rng.randrange(u(8), HORIZON - u(4))
        if px[x, y][:3] == hx('#4e8a4a'):
            px[x, y] = hx('#c8e38a') + (255,)
    reflect(img)
    finish(img, water, 'bambou', sky0)


def make_volcan():
    rng = random.Random(61)
    sky0, sky1, water = hx('#2a0f12'), hx('#a8381e'), hx('#3a1208')
    img = base_scene(sky0, sky1, water, hx('#ff7a2a'))
    px = img.load()
    d = ImageDraw.Draw(img)
    for _ in range(70):
        x, y = rng.randrange(W - 1), rng.randrange(1, u(30))
        px[x, y] = hx('#ffb066') + (255,)
        if rng.random() < 0.3:
            px[x + 1, y] = hx('#ffb066') + (255,)
    # fumée sombre
    for _ in range(4):
        place(img, cloud(rng.randint(50, 90), 11, hx('#4a2a2a'), hx('#2e1818'), rng), rng.randint(40, 360), u(rng.randint(8, 24)))
    # grand volcan central avec lave
    w_, h_ = u(150), u(50)
    el = Image.new('RGBA', (w_, h_), (0, 0, 0, 0))
    ed = ImageDraw.Draw(el)
    ed.polygon([(0, h_ - 1), (w_ // 2 - u(18), u(6)), (w_ // 2 + u(18), u(6)), (w_ - 1, h_ - 1)], fill=hx('#3b2424') + (255,))
    ed.polygon([(w_ // 2 + u(18), u(6)), (w_ - 1, h_ - 1), (w_ // 2 + u(20), h_ - 1)], fill=hx('#2a1818') + (255,))
    ed.polygon([(0, h_ - 1), (w_ // 2 - u(18), u(6)), (w_ // 2 - u(12), u(6)), (u(40), h_ - 1)], fill=hx('#4a2e2e') + (255,))
    ed.ellipse([w_ // 2 - u(18), u(3), w_ // 2 + u(18), u(11)], fill=hx('#ff7a2a') + (255,))
    ed.ellipse([w_ // 2 - u(10), u(5), w_ // 2 + u(10), u(9)], fill=hx('#ffd36a') + (255,))
    for i in range(7):
        sx = w_ // 2 + rng.randint(-u(10), u(10))
        pts = [(sx, u(10))]
        y = u(10)
        while y < h_ - u(4):
            sx += rng.randint(-u(3), u(3))
            y += rng.randint(u(4), u(7))
            pts.append((sx, y))
        ed.line(pts, fill=hx('#ff7a2a') + (255,), width=K)
    place(img, el, 205, HORIZON + 1, outline=hx('#120606'))
    ridge(img, 44, 14, 14, hx('#2b1818'), hx('#1c0f0f'), hx('#4a2a24'), octaves=5)
    for x, w_, h_ in [(40, 28, 22), (95, 20, 14), (330, 30, 24), (370, 18, 12)]:
        place(img, rock(w_, h_, hx('#3a2222'), hx('#241313'), hx('#5a3430')), x, HORIZON + 3, outline=hx('#120606'))
    place(img, torii(26, 24, hx('#7a2a1c'), hx('#b0482e')), 135, HORIZON + 3, outline=hx('#120606'))
    for x in (60, 345):
        place(img, stone_lantern(16, hx('#4a2a24'), hx('#7a4a3c'), hx('#ff9a3c')), x, HORIZON + 4, outline=hx('#120606'))
    reflect(img)
    # reflets de lave dans l'eau (colonnes orange)
    for y in range(HORIZON + 1, H - 8 * K):
        for x in range(u(170), u(240)):
            if (BAYER[y % 4][x % 4] < 6 and (x + y // 2) % 3 == 0):
                px[x, y] = mixc(px[x, y][:3], hx('#ff7a2a'), 0.55) + (255,)
    finish(img, water, 'volcan', sky0)


# ---------------------------------------------------------------- poissons
FW, FH, FN = 32, 16, 8


def fish_frame(spec, k):
    """Une image de nage : le corps ondule, la queue bat. Poisson tourné vers la droite."""
    body, patch, patch2, fin, belly = spec['body'], spec['patch'], spec['patch2'], spec['fin'], spec['belly']
    ph = k / FN * 2 * math.pi
    el = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    px = el.load()
    cy = 8
    x_tail, x_head = 9, 26
    # profil de largeur du corps
    def half_w(x):
        t = (x - x_tail) / (x_head - x_tail)
        return 0.6 + 4.0 * math.sin(min(1, max(0, t)) ** 0.7 * math.pi * 0.95 + 0.25) * (1 - 0.15 * t)
    def y_off(x):
        t = 1 - (x - x_tail) / (x_head - x_tail)
        return 2.2 * math.sin(ph + t * 2.4) * t ** 1.3
    for x in range(x_tail, x_head + 1):
        hw = half_w(x)
        yo = y_off(x)
        for y in range(FH):
            dy = y - cy - yo
            if abs(dy) <= hw:
                c = body
                u = x - x_tail
                # taches : fixées au corps (ne bougent pas avec l'onde)
                if spec['pattern'] == 'koi':
                    if math.sin(u * 0.55 + 1.2) * math.cos(dy * 0.5) > 0.4:
                        c = patch
                    if math.sin(u * 0.95 + 0.4) * math.cos(dy * 0.8 + 1.0) > 0.82:
                        c = patch2
                elif spec['pattern'] == 'stripe':
                    if u % 6 < 2:
                        c = patch
                elif spec['pattern'] == 'glow':
                    if (u + int(dy)) % 5 == 0 and abs(dy) < hw - 1:
                        c = patch
                elif spec['pattern'] == 'ember':
                    if u % 4 == 0:
                        c = patch
                if dy > hw * 0.35:
                    c = mixc(c, belly, 0.55)
                px[x, y] = c + (255,)
    # queue en éventail qui bat
    tx = x_tail
    ty = cy + y_off(tx)
    sw = math.sin(ph + 0.9) * 4.5
    for i in range(1, 9):
        xx = tx - i
        spread = 0.9 + i * 0.42
        for j in range(-int(spread) - 1, int(spread) + 2):
            yy = int(round(ty + j + sw * i / 8))
            if 0 <= xx < FW and 0 <= yy < FH and abs(j) <= spread:
                c = fin if (i + abs(j)) % 3 else mixc(fin, spec['body'], 0.45)
                if px[xx, yy][3] == 0:
                    px[xx, yy] = c + (255,)
    # nageoire dorsale et pectorale
    for i in range(5):
        xx = 14 + i
        yy = int(round(cy + y_off(xx) - half_w(xx) - 1 - (2 if i in (1, 2) else 0)))
        if 0 <= yy < FH and px[xx, yy][3] == 0:
            px[xx, yy] = fin + (255,)
    pxx, pyy = 21, int(round(cy + y_off(21) + half_w(21) * 0.6))
    for i in range(3):
        if 0 <= pyy + 1 < FH:
            px[pxx - i, pyy + 1] = fin + (255,)
    # oeil
    px[24, int(round(cy + y_off(24) - 1))] = (15, 12, 18, 255)
    # contour sombre
    a = el.split()[3].point(lambda v: 255 if v else 0)
    ring = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(3)), a)
    ol = Image.new('RGBA', (FW, FH), dark(spec['body'], 0.35) + (255,))
    ol.putalpha(ring)
    out = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    out.alpha_composite(ol)
    out.alpha_composite(el)
    return out


FISH = [
    dict(name='koi_orange', body=hx('#f6f0e6'), patch=hx('#e8742f'), patch2=hx('#2b2b33'), fin=hx('#f4a15a'), belly=hx('#d9d2c4'), pattern='koi'),
    dict(name='koi_blanc', body=hx('#f6f0e6'), patch=hx('#d93a2a'), patch2=hx('#f6f0e6'), fin=hx('#fbf6ee'), belly=hx('#d9d2c4'), pattern='koi'),
    dict(name='koi_or', body=hx('#f2c14e'), patch=hx('#e8902f'), patch2=hx('#fff0b0'), fin=hx('#f7d878'), belly=hx('#d9a23a'), pattern='koi'),
    dict(name='lanterne', body=hx('#12384a'), patch=hx('#2de6ea'), patch2=hx('#2de6ea'), fin=hx('#2de6ea'), belly=hx('#0b2230'), pattern='glow'),
    dict(name='argente', body=hx('#b9c9d6'), patch=hx('#8da2b4'), patch2=hx('#8da2b4'), fin=hx('#dce8f0'), belly=hx('#e9f1f6'), pattern='stripe'),
    dict(name='carpe_jade', body=hx('#5f9a6a'), patch=hx('#477a52'), patch2=hx('#477a52'), fin=hx('#8fc08a'), belly=hx('#a6c89a'), pattern='stripe'),
    dict(name='braise', body=hx('#7a2418'), patch=hx('#ff9a3c'), patch2=hx('#ffd36a'), fin=hx('#ff6a2a'), belly=hx('#4a140e'), pattern='ember'),
]


def make_fauna():
    sheet = Image.new('RGBA', (FW * FN, FH * len(FISH)), (0, 0, 0, 0))
    for r, spec in enumerate(FISH):
        for k in range(FN):
            sheet.alpha_composite(fish_frame(spec, k), (k * FW, r * FH))
    sheet.save(os.path.join(OUT, 'fauna.png'))


# ---------------------------------------------------------------- objets flottants
OW, OH = 24, 16


def make_floats():
    items = []

    def new():
        return Image.new('RGBA', (OW, OH), (0, 0, 0, 0))

    # 0 nénuphar, 1 nénuphar à fleur, 2 floe de glace, 3 roche de lave, 4 lanterne flottante, 5 feuille de bambou
    e = new(); d = ImageDraw.Draw(e)
    d.ellipse([2, 4, 21, 13], fill=hx('#4e9a52') + (255,)); d.ellipse([4, 5, 12, 9], fill=hx('#78c06c') + (255,))
    d.polygon([(12, 8), (21, 6), (21, 10)], fill=(0, 0, 0, 0)); stamp(new(), e)
    t = new(); stamp(t, e); items.append(t)
    e = new(); d = ImageDraw.Draw(e)
    d.ellipse([2, 5, 21, 14], fill=hx('#4e9a52') + (255,)); d.ellipse([4, 6, 11, 10], fill=hx('#78c06c') + (255,))
    for (fx_, fy_) in [(11, 5), (8, 6), (14, 6), (11, 3)]:
        d.ellipse([fx_ - 2, fy_ - 2, fx_ + 2, fy_ + 2], fill=hx('#f6a8c8') + (255,))
    d.ellipse([10, 4, 12, 6], fill=hx('#ffe27a') + (255,))
    t = new(); stamp(t, e); items.append(t)
    e = new(); d = ImageDraw.Draw(e)
    d.polygon([(2, 9), (6, 4), (15, 3), (21, 7), (19, 13), (8, 14)], fill=hx('#e4f0f8') + (255,))
    d.polygon([(6, 4), (15, 3), (12, 7), (7, 8)], fill=hx('#ffffff') + (255,))
    d.polygon([(19, 13), (21, 7), (15, 10)], fill=hx('#a9c4d8') + (255,))
    t = new(); stamp(t, e, outline=hx('#6f8aa4')); items.append(t)
    e = new(); d = ImageDraw.Draw(e)
    d.polygon([(3, 12), (5, 6), (12, 4), (19, 7), (21, 12), (12, 14)], fill=hx('#3a2222') + (255,))
    d.line([(7, 8), (11, 10), (15, 8), (18, 10)], fill=hx('#ff7a2a') + (255,))
    d.point([(11, 10), (15, 8)], fill=hx('#ffd36a') + (255,))
    t = new(); stamp(t, e, outline=hx('#120606')); items.append(t)
    e = new(); d = ImageDraw.Draw(e)
    d.rectangle([8, 3, 15, 11], fill=hx('#2de6ea') + (255,)); d.rectangle([9, 4, 14, 7], fill=hx('#c8ffff') + (255,))
    d.rectangle([7, 2, 16, 3], fill=hx('#ff9a3c') + (255,)); d.rectangle([7, 11, 16, 12], fill=hx('#ff9a3c') + (255,))
    t = new(); stamp(t, e, outline=hx('#05060f')); items.append(t)
    e = new(); d = ImageDraw.Draw(e)
    d.polygon([(2, 9), (12, 4), (21, 8), (12, 11)], fill=hx('#78b85a') + (255,))
    d.line([(3, 9), (20, 8)], fill=hx('#4e8a4a') + (255,))
    t = new(); stamp(t, e); items.append(t)
    sheet = Image.new('RGBA', (OW * len(items), OH), (0, 0, 0, 0))
    for i, it in enumerate(items):
        sheet.alpha_composite(it, (i * OW, 0))
    sheet.save(os.path.join(OUT, 'floats.png'))


if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'bg'), exist_ok=True)
    for fn in (make_coucher, make_brume, make_neon, make_neige, make_bambou, make_volcan, make_fauna, make_floats):
        fn()
        print('ok', fn.__name__)
