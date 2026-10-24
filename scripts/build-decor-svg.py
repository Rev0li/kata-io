#!/usr/bin/env python3
"""Génère le décor vectoriel (SVG) de Kata.io dans public/assets/decor/ :

  bg-<dojo>.svg        horizon 2400x420 (6 dojos). Les éléments importants sont groupés entre x=500 et x=1900,
                       la zone réellement visible sur téléphone en paysage comme sur ordinateur.
  fish-<espèce>-body.svg / fish-<espèce>-tail.svg   poissons articulés : le corps et la queue sont deux
                       images, la queue bat et le corps ondule par le code (voir Renderer.updLife).
  float-<nom>.svg      objets flottants (nénuphars, glace, roche de lave, lanterne, feuille)

Les fichiers sont des SVG propres et éditables dans Inkscape ou Penpot. Usage : python3 scripts/build-decor-svg.py
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'decor')
W, H, HZ = 2400, 420, 300  # largeur, hauteur, ligne d'horizon (début de l'eau)
C0 = 1200  # centre


def mix(a, b, t):
    a, b = a.lstrip('#'), b.lstrip('#')
    ca = [int(a[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(int(round(ca[i] + (cb[i] - ca[i]) * t)) for i in range(3))


def lighter(c, t=0.3):
    return mix(c, '#ffffff', t)


def darker(c, t=0.35):
    return mix(c, '#000000', t)


class Doc:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.defs = []
        self.body = []
        self.n = 0

    def uid(self, p='g'):
        self.n += 1
        return f'{p}{self.n}'

    def lin(self, stops, x1=0, y1=0, x2=0, y2=1):
        i = self.uid('lg')
        s = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>' for o, c, a in stops)
        self.defs.append(f'<linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>')
        return f'url(#{i})'

    def rad(self, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None):
        i = self.uid('rg')
        s = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>' for o, c, a in stops)
        f = f' fx="{fx}" fy="{fy}"' if fx is not None else ''
        self.defs.append(f'<radialGradient id="{i}" cx="{cx}" cy="{cy}" r="{r}"{f}>{s}</radialGradient>')
        return f'url(#{i})'

    def blur(self, sd):
        i = self.uid('bl')
        self.defs.append(f'<filter id="{i}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{sd}"/></filter>')
        return f'url(#{i})'

    def add(self, s):
        self.body.append(s)

    def svg(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}">'
                f'<defs>{"".join(self.defs)}</defs>{"".join(self.body)}</svg>')


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


# ------------------------------------------------------------------ formes
def ridge_path(seed, base, amp, x0=0, x1=W, step=12, rough=1.0):
    rng = random.Random(seed)
    comps = [(rng.uniform(0.0016, 0.0032) * (2 ** k) * rough, rng.uniform(0, 6.28), 0.55 ** k) for k in range(5)]
    tot = sum(c[2] for c in comps)
    pts = []
    x = x0
    while x <= x1:
        v = sum(a * (math.sin(x * fr + ph) * 0.5 + 0.5) for fr, ph, a in comps) / tot
        pts.append((x, base - amp * v))
        x += step
    d = f'M{x0},{HZ + 2} ' + ' '.join(f'L{f(px)},{f(py)}' for px, py in pts) + f' L{x1},{HZ + 2} Z'
    return d, pts


def ridge(doc, seed, base, amp, fill, stroke=None, hi=None, rough=1.0, opacity=1):
    d, pts = ridge_path(seed, base, amp, rough=rough)
    g = doc.lin([(0, hi or lighter(fill, 0.25), None), (1, fill, None)])
    s = f' stroke="{stroke}" stroke-width="2" stroke-linejoin="round"' if stroke else ''
    doc.add(f'<path d="{d}" fill="{g}"{s} opacity="{opacity}"/>')
    return pts


def cloud(doc, cx, cy, w, col, shade, op=1.0):
    h = w * 0.28
    parts = [(0, 0.1, 0.34 * h * 1.1), (-0.28 * w, 0.18 * h, 0.34 * h), (0.28 * w, 0.2 * h, 0.3 * h), (-0.12 * w, -0.12 * h, 0.42 * h), (0.12 * w, -0.1 * h, 0.38 * h)]
    sh = ''.join(f'<ellipse cx="{f(cx + px)}" cy="{f(cy + py + h * 0.12)}" rx="{f(r * 1.25)}" ry="{f(r)}" fill="{shade}"/>' for px, py, r in parts)
    fg = ''.join(f'<ellipse cx="{f(cx + px)}" cy="{f(cy + py)}" rx="{f(r * 1.25)}" ry="{f(r)}" fill="{col}"/>' for px, py, r in parts)
    doc.add(f'<g opacity="{op}">{sh}{fg}<rect x="{f(cx - w * 0.5)}" y="{f(cy + h * 0.25)}" width="{f(w)}" height="{f(h * 0.2)}" rx="{f(h * 0.1)}" fill="{col}"/></g>')


def blob_tree(doc, x, base, s, col, trunk='#6b4630', ol=None):
    ol = ol or darker(col, 0.5)
    g = doc.rad([(0, lighter(col, 0.4), None), (0.6, col, None), (1, darker(col, 0.22), None)], 0.35, 0.3, 0.8)
    t = f'<path d="M{f(x - s * 0.06)},{f(base)} L{f(x - s * 0.03)},{f(base - s * 0.55)} L{f(x + s * 0.03)},{f(base - s * 0.55)} L{f(x + s * 0.06)},{f(base)} Z" fill="{trunk}" stroke="{darker(trunk, 0.4)}" stroke-width="2"/>'
    cs = [(0, -0.85, 0.5), (-0.34, -0.62, 0.36), (0.34, -0.62, 0.36), (0, -0.55, 0.42)]
    c = ''.join(f'<circle cx="{f(x + px * s * 0.6)}" cy="{f(base + py * s)}" r="{f(r * s * 0.6)}" fill="{g}" stroke="{ol}" stroke-width="2.5"/>' for px, py, r in cs[:3])
    c += f'<circle cx="{f(x)}" cy="{f(base - 0.55 * s)}" r="{f(0.42 * s * 0.6)}" fill="{g}"/>'
    doc.add(t + c)


def pine(doc, x, base, s, col, snow=None):
    g = doc.lin([(0, lighter(col, 0.25), None), (1, darker(col, 0.15), None)], 0, 0, 1, 0)
    ol = darker(col, 0.55)
    out = f'<rect x="{f(x - s * 0.04)}" y="{f(base - s * 0.14)}" width="{f(s * 0.08)}" height="{f(s * 0.14)}" fill="#5a3a28"/>'
    for i in range(4):
        top = base - s * (1 - i * 0.2)
        bot = base - s * (0.14 + 0.0 * i) - s * 0.0
        yb = base - s * (0.14 + 0.17 * (3 - i)) + 0
        hw = s * (0.16 + 0.07 * i)
        yt = yb - s * 0.36
        out += f'<path d="M{f(x)},{f(yt)} L{f(x + hw)},{f(yb)} L{f(x - hw)},{f(yb)} Z" fill="{g}" stroke="{ol}" stroke-width="2" stroke-linejoin="round"/>'
        if snow:
            out += f'<path d="M{f(x)},{f(yt)} L{f(x + hw * 0.62)},{f(yt + (yb - yt) * 0.62)} Q{f(x + hw * 0.2)},{f(yt + (yb - yt) * 0.5)} {f(x)},{f(yt + (yb - yt) * 0.66)} Q{f(x - hw * 0.2)},{f(yt + (yb - yt) * 0.5)} {f(x - hw * 0.62)},{f(yt + (yb - yt) * 0.62)} Z" fill="{snow}"/>'
    doc.add(out)


def bamboo(doc, x, base, h, col, leaf):
    w = max(6, h * 0.045)
    g = doc.lin([(0, lighter(col, 0.35), None), (0.5, col, None), (1, darker(col, 0.3), None)], 0, 0, 1, 0)
    ol = darker(col, 0.55)
    out = f'<rect x="{f(x - w / 2)}" y="{f(base - h)}" width="{f(w)}" height="{f(h)}" rx="{f(w / 2)}" fill="{g}" stroke="{ol}" stroke-width="2"/>'
    y = base - h * 0.15
    k = 0
    while y > base - h + 12:
        out += f'<rect x="{f(x - w * 0.62)}" y="{f(y)}" width="{f(w * 1.24)}" height="4" rx="2" fill="{darker(col, 0.35)}"/>'
        if k % 2 == 0:
            out += f'<path d="M{f(x + w / 2)},{f(y)} q{f(h * 0.12)},{f(-h * 0.02)} {f(h * 0.16)},{f(-h * 0.07)} q{f(-h * 0.1)},{f(h * 0.02)} {f(-h * 0.16)},{f(h * 0.07)} Z" fill="{leaf}" stroke="{darker(leaf, 0.4)}" stroke-width="1.5"/>'
        else:
            out += f'<path d="M{f(x - w / 2)},{f(y - 6)} q{f(-h * 0.12)},{f(-h * 0.02)} {f(-h * 0.16)},{f(-h * 0.07)} q{f(h * 0.1)},{f(h * 0.02)} {f(h * 0.16)},{f(h * 0.07)} Z" fill="{leaf}" stroke="{darker(leaf, 0.4)}" stroke-width="1.5"/>'
        y -= h * 0.17
        k += 1
    doc.add(out)


def pagoda(doc, x, base, s, wall, roof, trim, glow=None):
    out = ''
    tiers = 3
    rg = doc.lin([(0, lighter(roof, 0.3), None), (1, darker(roof, 0.2), None)])
    wg = doc.lin([(0, lighter(wall, 0.15), None), (1, darker(wall, 0.2), None)], 0, 0, 1, 0)
    ol = darker(roof, 0.55)
    th = s / (tiers + 0.6)
    for i in range(tiers):
        w = s * (0.62 - i * 0.14)
        y1 = base - i * th * 1.0
        y0 = y1 - th * 0.72
        out += f'<rect x="{f(x - w / 2 * 0.78)}" y="{f(y0)}" width="{f(w * 0.78)}" height="{f(y1 - y0)}" fill="{wg}" stroke="{darker(wall, 0.5)}" stroke-width="2"/>'
        dw = w * 0.16
        out += f'<rect x="{f(x - dw / 2)}" y="{f(y0 + (y1 - y0) * 0.25)}" width="{f(dw)}" height="{f((y1 - y0) * 0.75)}" fill="{glow or darker(wall, 0.45)}"/>'
        out += f'<rect x="{f(x - w / 2 * 0.78)}" y="{f(y0)}" width="{f(w * 0.78)}" height="{f(th * 0.06)}" fill="{trim}"/>'
        rw = w * 0.62
        out += (f'<path d="M{f(x - rw)},{f(y0 + th * 0.08)} Q{f(x - rw * 0.4)},{f(y0 + th * 0.04)} {f(x)},{f(y0 - th * 0.38)} '
                f'Q{f(x + rw * 0.4)},{f(y0 + th * 0.04)} {f(x + rw)},{f(y0 + th * 0.08)} Q{f(x + rw * 0.6)},{f(y0 + th * 0.18)} {f(x)},{f(y0 + th * 0.2)} '
                f'Q{f(x - rw * 0.6)},{f(y0 + th * 0.18)} {f(x - rw)},{f(y0 + th * 0.08)} Z" fill="{rg}" stroke="{ol}" stroke-width="2.5" stroke-linejoin="round"/>')
    top = base - (tiers - 1) * th - th * 0.72 - th * 0.38
    out += f'<path d="M{f(x)},{f(top)} L{f(x)},{f(top - th * 0.5)}" stroke="{trim}" stroke-width="3"/><circle cx="{f(x)}" cy="{f(top - th * 0.55)}" r="4" fill="{trim}"/>'
    doc.add(out)


def torii(doc, x, base, s, col):
    g = doc.lin([(0, lighter(col, 0.3), None), (1, darker(col, 0.15), None)], 0, 0, 1, 0)
    ol = darker(col, 0.5)
    w = s * 1.1
    out = (f'<rect x="{f(x - w / 2 + s * 0.08)}" y="{f(base - s)}" width="{f(s * 0.1)}" height="{f(s)}" fill="{g}" stroke="{ol}" stroke-width="2"/>'
           f'<rect x="{f(x + w / 2 - s * 0.18)}" y="{f(base - s)}" width="{f(s * 0.1)}" height="{f(s)}" fill="{g}" stroke="{ol}" stroke-width="2"/>'
           f'<rect x="{f(x - w / 2 + s * 0.02)}" y="{f(base - s * 0.72)}" width="{f(w - s * 0.04)}" height="{f(s * 0.07)}" fill="{g}" stroke="{ol}" stroke-width="2"/>'
           f'<path d="M{f(x - w / 2 - s * 0.1)},{f(base - s * 0.96)} Q{f(x)},{f(base - s * 0.84)} {f(x + w / 2 + s * 0.1)},{f(base - s * 0.96)} L{f(x + w / 2 + s * 0.04)},{f(base - s * 1.06)} Q{f(x)},{f(base - s * 0.94)} {f(x - w / 2 - s * 0.04)},{f(base - s * 1.06)} Z" fill="{g}" stroke="{ol}" stroke-width="2.5" stroke-linejoin="round"/>')
    doc.add(out)


def lantern(doc, x, base, s, stone, glow):
    g = doc.lin([(0, lighter(stone, 0.3), None), (1, darker(stone, 0.2), None)], 0, 0, 1, 0)
    ol = darker(stone, 0.55)
    gl = doc.rad([(0, glow, 0.9), (1, glow, 0)], 0.5, 0.5, 0.5)
    out = (f'<circle cx="{f(x)}" cy="{f(base - s * 0.62)}" r="{f(s * 0.7)}" fill="{gl}"/>'
           f'<rect x="{f(x - s * 0.06)}" y="{f(base - s * 0.4)}" width="{f(s * 0.12)}" height="{f(s * 0.4)}" fill="{g}" stroke="{ol}" stroke-width="2"/>'
           f'<rect x="{f(x - s * 0.18)}" y="{f(base - s * 0.5)}" width="{f(s * 0.36)}" height="{f(s * 0.12)}" fill="{g}" stroke="{ol}" stroke-width="2"/>'
           f'<rect x="{f(x - s * 0.13)}" y="{f(base - s * 0.8)}" width="{f(s * 0.26)}" height="{f(s * 0.3)}" fill="{glow}" stroke="{ol}" stroke-width="2"/>'
           f'<path d="M{f(x - s * 0.24)},{f(base - s * 0.8)} L{f(x)},{f(base - s * 1.0)} L{f(x + s * 0.24)},{f(base - s * 0.8)} Z" fill="{g}" stroke="{ol}" stroke-width="2" stroke-linejoin="round"/>')
    doc.add(out)


def rock(doc, x, base, w, h, col, snow=None):
    ol = darker(col, 0.55)
    p = [(x - w / 2, base), (x - w * 0.46, base - h * 0.5), (x - w * 0.22, base - h * 0.92), (x + w * 0.05, base - h), (x + w * 0.36, base - h * 0.62), (x + w / 2, base)]
    d = 'M' + ' L'.join(f'{f(a)},{f(b)}' for a, b in p) + ' Z'
    out = f'<path d="{d}" fill="{col}" stroke="{ol}" stroke-width="2.5" stroke-linejoin="round"/>'
    out += f'<path d="M{f(p[0][0])},{f(p[0][1])} L{f(p[1][0])},{f(p[1][1])} L{f(p[2][0])},{f(p[2][1])} L{f(p[3][0])},{f(p[3][1])} L{f(x - w * 0.02)},{f(base)} Z" fill="{lighter(col, 0.22)}"/>'
    out += f'<path d="M{f(p[3][0])},{f(p[3][1])} L{f(p[4][0])},{f(p[4][1])} L{f(p[5][0])},{f(p[5][1])} L{f(x - w * 0.02)},{f(base)} Z" fill="{darker(col, 0.2)}"/>'
    if snow:
        out += f'<path d="M{f(p[1][0])},{f(p[1][1])} L{f(p[2][0])},{f(p[2][1])} L{f(p[3][0])},{f(p[3][1])} L{f(p[4][0])},{f(p[4][1])} Q{f(x + w * 0.1)},{f(base - h * 0.55)} {f(x - w * 0.1)},{f(base - h * 0.62)} Q{f(x - w * 0.3)},{f(base - h * 0.45)} {f(p[1][0])},{f(p[1][1])} Z" fill="{snow}"/>'
    out += f'<path d="M{f(p[0][0])},{f(p[0][1])} L{f(p[5][0])},{f(p[5][1])}" stroke="{ol}" stroke-width="2"/>'
    doc.add(out)


def mountain(doc, cx, base, w, h, col, shade, snow):
    ol = darker(col, 0.5)
    d = f'M{f(cx - w / 2)},{f(base)} L{f(cx - w * 0.08)},{f(base - h)} L{f(cx + w * 0.02)},{f(base - h * 0.96)} L{f(cx + w / 2)},{f(base)} Z'
    out = f'<path d="{d}" fill="{col}" stroke="{ol}" stroke-width="2.5" stroke-linejoin="round"/>'
    out += f'<path d="M{f(cx + w * 0.02)},{f(base - h * 0.96)} L{f(cx + w / 2)},{f(base)} L{f(cx + w * 0.12)},{f(base)} L{f(cx - w * 0.04)},{f(base - h * 0.55)} Z" fill="{shade}"/>'
    if snow:
        out += (f'<path d="M{f(cx - w * 0.08)},{f(base - h)} L{f(cx + w * 0.02)},{f(base - h * 0.96)} L{f(cx + w * 0.17)},{f(base - h * 0.66)} L{f(cx + w * 0.08)},{f(base - h * 0.7)} '
                f'L{f(cx + w * 0.02)},{f(base - h * 0.6)} L{f(cx - w * 0.04)},{f(base - h * 0.7)} L{f(cx - w * 0.1)},{f(base - h * 0.62)} L{f(cx - w * 0.2)},{f(base - h * 0.68)} Z" fill="{snow}"/>')
    doc.add(out)


# ------------------------------------------------------------------ scène commune
def compose(name, sky_stops, water_top, water, scene_fn, glint=None, seed=1):
    d = Doc(W, H)
    sky = d.lin(sky_stops)
    d.add(f'<rect width="{W}" height="{HZ + 2}" fill="{sky}"/>')
    d.add('<g id="scene">')
    scene_fn(d, random.Random(seed))
    d.add('</g>')
    # eau : dégradé jusqu'à la couleur d'eau exacte en bas
    wg = d.lin([(0, water_top, None), (0.55, mix(water_top, water, 0.7), None), (1, water, None)])
    d.add(f'<rect y="{HZ}" width="{W}" height="{H - HZ}" fill="{wg}"/>')
    # reflet de la scène
    d.defs.append(f'<clipPath id="wclip"><rect y="{HZ}" width="{W}" height="{H - HZ}"/></clipPath>')
    fade = d.lin([(0, '#fff', 0.55), (1, '#fff', 0)])
    d.defs.append(f'<mask id="wm"><rect y="{HZ}" width="{W}" height="{H - HZ}" fill="{fade}"/></mask>')
    d.add(f'<g clip-path="url(#wclip)" mask="url(#wm)" opacity="0.5" filter="{d.blur(2.4)}"><use href="#scene" transform="translate(0,{2 * HZ}) scale(1,-1)"/></g>')
    # bande de brume d'horizon et quelques rides
    haze = d.lin([(0, mix(sky_stops[-1][1], '#ffffff', 0.35), 0), (1, mix(sky_stops[-1][1], '#ffffff', 0.35), 0.5)])
    d.add(f'<rect y="{HZ - 46}" width="{W}" height="46" fill="{haze}"/>')
    rr = random.Random(seed + 7)
    for _ in range(46):
        x, y = rr.uniform(300, 2100), rr.uniform(HZ + 8, H - 24)
        w = rr.uniform(26, 90)
        d.add(f'<path d="M{f(x)},{f(y)} q{f(w / 4)},-3 {f(w / 2)},0 t{f(w / 2)},0" fill="none" stroke="{glint or "#ffffff"}" stroke-width="2" stroke-linecap="round" opacity="{f(rr.uniform(0.10, 0.28))}"/>')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f'bg-{name}.svg'), 'w') as fh:
        fh.write(d.svg())


# ------------------------------------------------------------------ les 6 dojos
def coucher(d, r):
    d.add(f'<circle cx="{C0 - 40}" cy="{HZ - 36}" r="130" fill="{d.rad([(0, "#fff3d0", 0.9), (1, "#fbd9a2", 0)])}"/><circle cx="{C0 - 40}" cy="{HZ - 36}" r="34" fill="#fff4d6"/>')
    for cx, cy, w in [(700, 70, 230), (1560, 56, 260), (1900, 120, 190), (980, 130, 170)]:
        cloud(d, cx, cy, w, '#f9d9b6', '#e8b48a', 0.95)
    ridge(d, 3, HZ - 40, 50, '#a58f89', '#7a6560', '#c3aaa0', 0.9)
    ridge(d, 4, HZ - 12, 34, '#5f8a86', '#3d6560', '#86b0a8', 1.2)
    for x, s, c in [(560, 130, '#e08a52'), (690, 100, '#4f8f8c'), (800, 150, '#e08a52'), (900, 90, '#4f8f8c'), (1530, 110, '#4f8f8c'), (1650, 150, '#e08a52'), (1790, 105, '#e08a52'), (1900, 135, '#4f8f8c'), (440, 90, '#4f8f8c'), (2020, 100, '#e08a52')]:
        blob_tree(d, x, HZ + 4, s, c)
    pagoda(d, 1010, HZ + 2, 170, '#8c5a3a', '#3d6e72', '#e9c27a', '#ffd88a')
    for x, w, h in [(1580, 130, 90), (1710, 90, 60), (620, 100, 64)]:
        rock(d, x, HZ + 8, w, h, '#d99a78')


def brume(d, r):
    for cx, cy, w in [(620, 60, 340), (1500, 80, 400), (1000, 120, 280), (1900, 50, 300)]:
        cloud(d, cx, cy, w, '#dfe2d6', '#bcc0b2', 0.9)
    ridge(d, 5, HZ - 130, 80, '#a9aea3', '#8a9086', '#c8ccc0', 1.0, 0.9)
    ridge(d, 6, HZ - 80, 70, '#8a9388', '#6f7a70', '#aab2a6', 1.2, 0.95)
    ridge(d, 7, HZ - 28, 40, '#6d7a6e', '#4f5c52', '#90a090', 1.5)
    for x, s in [(520, 200), (620, 150), (700, 230), (820, 160), (1530, 190), (1640, 240), (1740, 150), (1860, 210), (1960, 160), (430, 150)]:
        pine(d, x, HZ + 3, s, '#4f6354' if s > 180 else '#6b7d6e')
    torii(d, 1200, HZ + 8, 150, '#9c4a3a')
    pagoda(d, 900, HZ + 2, 190, '#6e5a46', '#4a4f48', '#c9a25c', '#ffd88a')
    for x in (580, 1840):
        lantern(d, x, HZ + 10, 88, '#8a9086', '#ffd88a')
    haze = d.lin([(0, '#dfe2d6', 0), (1, '#dfe2d6', 0.65)])
    d.add(f'<rect y="{HZ - 90}" width="{W}" height="{HZ - (HZ - 90) + 4}" fill="{haze}"/>')


def neon(d, r):
    for _ in range(190):
        x, y = r.uniform(0, W), r.uniform(4, HZ - 70)
        d.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r.choice([1.2, 1.6, 2.2]))}" fill="{r.choice(["#dfe6ff", "#dfe6ff", "#2de6ea", "#ffd0ff"])}" opacity="{f(r.uniform(0.5, 1))}"/>')
    d.add(f'<circle cx="1680" cy="90" r="46" fill="#eef0ff"/><circle cx="1698" cy="82" r="42" fill="{d.lin([(0, "#14183a", None), (1, "#2a1f4d", None)])}"/>')
    ridge(d, 8, HZ - 40, 22, '#161a3a', '#0b0e24', '#242a5c', 2.0)
    gl = d.blur(5)
    cols = ['#ff9a3c', '#2de6ea', '#ff5fd0']
    xs = list(range(380, 1000, 62)) + list(range(1420, 2040, 62))
    for x in xs:
        bw, bh = r.uniform(40, 62), r.uniform(70, 190)
        bx = x + r.uniform(-8, 8)
        d.add(f'<rect x="{f(bx)}" y="{f(HZ - bh + 4)}" width="{f(bw)}" height="{f(bh)}" fill="#12162f" stroke="#05060f" stroke-width="2"/>')
        wins = ''
        gw = ''
        yy = HZ - bh + 14
        while yy < HZ - 10:
            xx = bx + 8
            while xx < bx + bw - 10:
                if r.random() < 0.5:
                    c = r.choice(cols)
                    wins += f'<rect x="{f(xx)}" y="{f(yy)}" width="7" height="9" fill="{c}"/>'
                    if r.random() < 0.35:
                        gw += f'<rect x="{f(xx)}" y="{f(yy)}" width="7" height="9" fill="{c}"/>'
                xx += 13
            yy += 18
        d.add(wins + f'<g filter="{gl}" opacity="0.8">{gw}</g>')
    pagoda(d, 1200, HZ + 4, 200, '#1b1f45', '#14808a', '#ff9a3c', '#2de6ea')
    d.add(f'<g filter="{gl}" opacity="0.9"><path d="M{C0 - 150},{HZ - 20} Q{C0},{HZ + 10} {C0 + 150},{HZ - 20}" fill="none" stroke="#2de6ea" stroke-width="3"/></g>')
    for i in range(28):
        x = 330 + i * 62
        d.add(f'<circle cx="{x}" cy="{HZ - 6 + 7 * math.sin(i * 0.9)}" r="5" fill="{cols[i % 2]}"/>')


def neige(d, r):
    for cx, cy, w in [(700, 70, 320), (1480, 52, 380), (1950, 110, 220)]:
        cloud(d, cx, cy, w, '#f6fafc', '#d3e0ea', 0.95)
    for cx, w, h, col in [(520, 460, 170, '#8aa0b8'), (1200, 380, 120, '#a4b6c9'), (1890, 500, 190, '#8aa0b8')]:
        mountain(d, cx, HZ + 2, w, h, col, '#6f869e', '#f6fafc')
    ridge(d, 9, HZ - 26, 24, '#dbe6ef', '#9fb3c6', '#ffffff', 1.4)
    for x, s in [(500, 170), (590, 120), (690, 200), (790, 140), (1520, 190), (1620, 130), (1730, 210), (1850, 150), (1950, 180), (430, 120)]:
        pine(d, x, HZ + 4, s, '#456a5e', '#f6fafc')
    pagoda(d, 960, HZ + 2, 170, '#8a6a58', '#b9ccdc', '#d9a45c', '#ffd070')
    for x, w, h in [(600, 120, 60), (1760, 140, 70)]:
        rock(d, x, HZ + 10, w, h, '#9fb0c0', '#f6fafc')
    for x in (1090, 1330):
        lantern(d, x, HZ + 10, 80, '#9fb0c0', '#ffd070')


def bambou(d, r):
    for cx, cy, w in [(720, 70, 280), (1520, 52, 340), (1920, 100, 200)]:
        cloud(d, cx, cy, w, '#f3f7d9', '#d4e0b0', 0.9)
    ridge(d, 12, HZ - 80, 80, '#8fb08a', '#6f9570', '#b2cdaa', 1.0)
    ridge(d, 13, HZ - 28, 46, '#5f8f6c', '#43715a', '#86b890', 1.3)
    stalks = []
    for _ in range(64):
        x = r.uniform(430, 2000)
        if abs(x - C0) < 150 and r.random() < 0.9:
            continue
        stalks.append((x, r.uniform(150, 330), r.random() < 0.4))
    for x, h, far in sorted(stalks, key=lambda t: t[2], reverse=True):
        bamboo(d, x, HZ + 6 + (0 if far else 6), h * (0.8 if far else 1.0), '#6e9a5e' if far else '#4e8a4a', '#8fb878' if far else '#78b85a')
    pagoda(d, 1200, HZ + 4, 160, '#8f6c4a', '#3f6b50', '#e9c27a', '#ffe09a')
    torii(d, 860, HZ + 10, 130, '#b0472f')
    for x, w, h in [(520, 130, 66), (1880, 150, 74)]:
        rock(d, x, HZ + 12, w, h, '#7d9a82')


def volcan(d, r):
    for _ in range(100):
        x, y = r.uniform(0, W), r.uniform(4, HZ - 120)
        d.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r.choice([1.2, 1.8, 2.4]))}" fill="#ffb066" opacity="{f(r.uniform(0.3, 0.9))}"/>')
    for cx, cy, w in [(700, 60, 260), (1560, 44, 320), (1900, 100, 220), (1050, 40, 200)]:
        cloud(d, cx, cy, w, '#5a3030', '#3a1c1c', 0.9)
    ridge(d, 14, HZ - 36, 36, '#2b1818', '#120606', '#4a2a24', 1.6)
    # volcan central
    gl = d.blur(6)
    vg = d.lin([(0, '#4a2e2e', None), (1, '#2a1818', None)])
    d.add(f'<path d="M{C0 - 330},{HZ + 2} L{C0 - 70},{HZ - 190} L{C0 + 70},{HZ - 190} L{C0 + 330},{HZ + 2} Z" fill="{vg}" stroke="#120606" stroke-width="3" stroke-linejoin="round"/>')
    d.add(f'<path d="M{C0 + 70},{HZ - 190} L{C0 + 330},{HZ + 2} L{C0 + 150},{HZ + 2} L{C0 + 40},{HZ - 120} Z" fill="#1d1010"/>')
    d.add(f'<g filter="{gl}"><ellipse cx="{C0}" cy="{HZ - 192}" rx="80" ry="18" fill="#ff7a2a" opacity="0.9"/></g><ellipse cx="{C0}" cy="{HZ - 190}" rx="70" ry="14" fill="#ff7a2a" stroke="#120606" stroke-width="3"/><ellipse cx="{C0}" cy="{HZ - 190}" rx="44" ry="8" fill="#ffd36a"/>')
    for dx, w in [(-24, 6), (14, 5), (46, 4)]:
        pts = f'M{C0 + dx},{HZ - 182} q{dx * 0.2 + 8},40 {dx * 0.5},{70} q{-10},40 {dx * 0.7},{110}'
        d.add(f'<g filter="{gl}" opacity="0.8"><path d="{pts}" fill="none" stroke="#ff7a2a" stroke-width="{w + 4}" stroke-linecap="round"/></g><path d="{pts}" fill="none" stroke="#ffb040" stroke-width="{w}" stroke-linecap="round"/>')
    ridge(d, 15, HZ - 18, 22, '#2b1818', '#120606', '#4a2a24', 1.4)
    for x, w, h in [(520, 160, 100), (700, 100, 62), (1830, 170, 110), (1990, 110, 70)]:
        rock(d, x, HZ + 10, w, h, '#3a2222')
    torii(d, 900, HZ + 10, 140, '#7a2a1c')
    for x in (590, 1800):
        lantern(d, x, HZ + 10, 90, '#4a2a24', '#ff9a3c')
    d.add(f'<g filter="{d.blur(14)}" opacity="0.6"><ellipse cx="{C0}" cy="{HZ + 40}" rx="260" ry="26" fill="#ff7a2a"/></g>')


THEMES = {
    'coucher': dict(sky=[(0, '#d9a982', None), (0.55, '#eebc91', None), (1, '#f6d3a2', None)], wt='#5a8a88', water='#355d62', fn=coucher, glint='#fbe2b4', seed=11),
    'brume': dict(sky=[(0, '#a3a69c', None), (0.6, '#c0c4b6', None), (1, '#d6d9cc', None)], wt='#848776', water='#656455', fn=brume, glint='#dfe2d6', seed=21),
    'neon': dict(sky=[(0, '#0c1229', None), (0.6, '#1c1a45', None), (1, '#3a2a5e', None)], wt='#14183a', water='#0a1020', fn=neon, glint='#2de6ea', seed=31),
    'neige': dict(sky=[(0, '#b9cfe0', None), (0.6, '#d6e4ef', None), (1, '#eaf2f8', None)], wt='#6d8aa2', water='#3b5a74', fn=neige, glint='#f6fafc', seed=41),
    'bambou': dict(sky=[(0, '#b8d4a0', None), (0.6, '#d4e5b0', None), (1, '#eaf2c4', None)], wt='#4f8068', water='#2f5a4a', fn=bambou, glint='#e9f0c2', seed=51),
    'volcan': dict(sky=[(0, '#2a0f12', None), (0.55, '#6e2418', None), (1, '#b44820', None)], wt='#5a1e10', water='#3a1208', fn=volcan, glint='#ff9a3c', seed=61),
}


# ------------------------------------------------------------------ poissons articulés
SPECIES = {
    'koi_orange': dict(body='#f6f0e6', patch='#e8742f', patch2='#2b2b33', fin='#f4a15a', belly='#d9d2c4', pat='koi'),
    'koi_blanc': dict(body='#f6f0e6', patch='#d93a2a', patch2='#f6f0e6', fin='#fbf6ee', belly='#d9d2c4', pat='koi'),
    'koi_or': dict(body='#f2c14e', patch='#e8902f', patch2='#fff0b0', fin='#f7d878', belly='#d9a23a', pat='koi'),
    'lanterne': dict(body='#12384a', patch='#2de6ea', patch2='#2de6ea', fin='#2de6ea', belly='#0b2230', pat='glow'),
    'argente': dict(body='#b9c9d6', patch='#8da2b4', patch2='#8da2b4', fin='#dce8f0', belly='#e9f1f6', pat='stripe'),
    'carpe_jade': dict(body='#5f9a6a', patch='#477a52', patch2='#477a52', fin='#8fc08a', belly='#a6c89a', pat='stripe'),
    'braise': dict(body='#7a2418', patch='#ff9a3c', patch2='#ffd36a', fin='#ff6a2a', belly='#4a140e', pat='ember'),
}
FWID, FHEI = 184, 64  # poisson d'un seul tenant : queue à gauche (x de 0 à 70), corps à droite (x de 64 à 184), tête vers la droite
BODY_X = 64


def fish_svgs(name, sp):
    """Un seul SVG par espèce. Le jeu le déforme en tranches (Rope) : l'onde de nage parcourt le poisson de la tête à la queue."""
    d = Doc(FWID, FHEI)
    body, ol = sp['body'], darker(sp['body'], 0.5)
    g = d.lin([(0, lighter(body, 0.25), None), (0.55, body, None), (1, mix(body, sp['belly'], 0.8), None)])
    bp = 'M6,32 C20,12 52,8 84,13 C102,16 112,24 117,32 C112,41 102,48 84,51 C52,56 20,52 6,32 Z'
    d.defs.append(f'<clipPath id="bc"><path d="{bp}"/></clipPath>')
    # queue
    tg = d.lin([(0, sp['fin'], None), (1, mix(sp['fin'], body, 0.6), None)], 1, 0, 0, 0)
    tail = 'M70,32 C58,26 40,6 8,2 C16,16 18,26 14,32 C18,38 16,48 8,62 C40,58 58,38 70,32 Z'
    d.add(f'<path d="{tail}" fill="{tg}" stroke="{ol}" stroke-width="2.5" stroke-linejoin="round" opacity="0.96"/>')
    for yy in (14, 24, 40, 50):
        d.add(f'<path d="M68,32 Q40,{yy} 14,{yy}" fill="none" stroke="{ol}" stroke-width="1.2" opacity="0.4"/>')
    # corps décalé de BODY_X pour que sa pointe arrière (x=6) tombe sur l'articulation de la queue (x=70)
    d.add(f'<g transform="translate({BODY_X},0)">')
    d.add(f'<path d="M30,19 C42,2 66,2 78,14 Z" fill="{sp["fin"]}" stroke="{ol}" stroke-width="2" stroke-linejoin="round" opacity="0.95"/>')
    d.add(f'<path d="{bp}" fill="{g}"/>')
    if sp['pat'] == 'koi':
        pat = (f'<ellipse cx="46" cy="22" rx="20" ry="11" fill="{sp["patch"]}"/><ellipse cx="78" cy="34" rx="14" ry="9" fill="{sp["patch"]}"/>'
               f'<ellipse cx="24" cy="30" rx="9" ry="7" fill="{sp["patch"]}"/><ellipse cx="62" cy="40" rx="8" ry="5" fill="{sp["patch2"]}"/><ellipse cx="96" cy="22" rx="9" ry="6" fill="{sp["patch"]}"/>')
    elif sp['pat'] == 'stripe':
        pat = ''.join(f'<path d="M{x},12 Q{x - 8},32 {x},54" fill="none" stroke="{sp["patch"]}" stroke-width="6" opacity="0.55"/>' for x in (34, 50, 66, 82))
    elif sp['pat'] == 'glow':
        pat = ''.join(f'<circle cx="{x}" cy="{y}" r="3.4" fill="{sp["patch"]}"/>' for x, y in [(30, 28), (44, 38), (58, 26), (72, 38), (86, 28), (50, 46), (96, 36)])
        pat += f'<ellipse cx="62" cy="30" rx="48" ry="16" fill="{sp["patch"]}" opacity="0.22"/>'
    else:
        pat = ''.join(f'<path d="M{x},14 L{x + 8},32 L{x},52" fill="none" stroke="{sp["patch"]}" stroke-width="5" stroke-linejoin="round" opacity="0.9"/>' for x in (34, 54, 74))
    d.add(f'<g clip-path="url(#bc)">{pat}</g>')
    d.add(f'<path d="{bp}" fill="none" stroke="{ol}" stroke-width="3" stroke-linejoin="round"/>')
    d.add(f'<path d="M62,44 C58,56 70,60 80,56 C76,52 72,48 70,43 Z" fill="{sp["fin"]}" stroke="{ol}" stroke-width="2" stroke-linejoin="round"/>')
    d.add('<circle cx="100" cy="27" r="6" fill="#fff"/><circle cx="102" cy="27" r="3.6" fill="#15121a"/><circle cx="103" cy="25.5" r="1.2" fill="#fff"/>')
    if sp['pat'] == 'glow':
        d.add(f'<ellipse cx="62" cy="32" rx="58" ry="26" fill="{d.rad([(0, sp["patch"], 0.35), (1, sp["patch"], 0)])}"/>')
    d.add('</g>')
    with open(os.path.join(OUT, f'fish-{name}.svg'), 'w') as fh:
        fh.write(d.svg())


# ------------------------------------------------------------------ objets flottants (96x64)
def floats():
    def save(name, d):
        with open(os.path.join(OUT, f'float-{name}.svg'), 'w') as fh:
            fh.write(d.svg())

    d = Doc(96, 64)
    g = d.rad([(0, '#8ad07a', None), (0.7, '#4e9a52', None), (1, '#3a7a42', None)], 0.4, 0.35, 0.7)
    pad = 'M48,8 C70,8 90,18 90,34 C90,50 70,58 48,58 C26,58 6,50 6,34 C6,18 26,8 48,8 L48,34 Z'
    d.add(f'<ellipse cx="50" cy="40" rx="42" ry="18" fill="#000" opacity="0.18"/>')
    d.add(f'<path d="M48,34 L88,26 C86,14 70,8 48,8 C26,8 8,16 7,28 C6,46 28,58 48,58 C70,58 90,48 89,34 Z" fill="{g}" stroke="#2f6a3a" stroke-width="3" stroke-linejoin="round"/>')
    for a in (-0.9, -0.3, 0.3, 0.9):
        d.add(f'<path d="M48,34 L{f(48 + 36 * math.cos(a + 1.57))},{f(34 + 22 * math.sin(a + 1.57))}" stroke="#2f6a3a" stroke-width="1.6" opacity="0.5"/>')
    d.add('<ellipse cx="34" cy="22" rx="14" ry="5" fill="#fff" opacity="0.2"/>')
    save('nenuphar', d)

    d = Doc(96, 64)
    d.add(f'<ellipse cx="50" cy="40" rx="42" ry="18" fill="#000" opacity="0.18"/>')
    d.add(f'<path d="M48,34 L88,26 C86,14 70,8 48,8 C26,8 8,16 7,28 C6,46 28,58 48,58 C70,58 90,48 89,34 Z" fill="{d.rad([(0, "#8ad07a", None), (1, "#3a7a42", None)], 0.4, 0.35, 0.7)}" stroke="#2f6a3a" stroke-width="3" stroke-linejoin="round"/>')
    for a in range(8):
        ang = a * 0.785
        d.add(f'<ellipse cx="{f(46 + 15 * math.cos(ang))}" cy="{f(30 + 9 * math.sin(ang))}" rx="11" ry="6" transform="rotate({int(ang * 57.3)} {f(46 + 15 * math.cos(ang))} {f(30 + 9 * math.sin(ang))})" fill="#f8b6d0" stroke="#d2709a" stroke-width="1.8"/>')
    d.add('<circle cx="46" cy="30" r="7" fill="#ffe27a" stroke="#d9a23a" stroke-width="2"/>')
    save('fleur', d)

    d = Doc(96, 64)
    d.add(f'<ellipse cx="50" cy="42" rx="42" ry="14" fill="#000" opacity="0.15"/>')
    d.add(f'<path d="M8,38 L22,16 L52,8 L80,22 L88,42 L62,56 L24,54 Z" fill="{d.lin([(0, "#ffffff", None), (1, "#bcd6e6", None)])}" stroke="#7fa3bd" stroke-width="3" stroke-linejoin="round"/>')
    d.add('<path d="M22,16 L52,8 L46,26 L24,32 Z" fill="#fff" opacity="0.85"/><path d="M80,22 L88,42 L62,56 L58,34 Z" fill="#a9c8dc" opacity="0.8"/>')
    save('glace', d)

    d = Doc(96, 64)
    gl = d.blur(3)
    d.add(f'<ellipse cx="50" cy="42" rx="46" ry="16" fill="#ff7a2a" opacity="0.28" filter="{gl}"/>')
    d.add('<path d="M8,44 L16,24 L36,12 L62,10 L82,22 L90,44 L64,56 L28,56 Z" fill="#3a2222" stroke="#120606" stroke-width="3" stroke-linejoin="round"/>')
    d.add('<path d="M16,24 L36,12 L62,10 L50,30 L26,34 Z" fill="#4e2e2e"/>')
    d.add(f'<g filter="{gl}"><path d="M24,40 L38,30 L52,38 L66,28 L80,38" fill="none" stroke="#ff7a2a" stroke-width="6" stroke-linecap="round"/></g><path d="M24,40 L38,30 L52,38 L66,28 L80,38" fill="none" stroke="#ffc060" stroke-width="3" stroke-linecap="round"/>')
    save('lave', d)

    d = Doc(96, 64)
    gl = d.blur(5)
    d.add(f'<ellipse cx="48" cy="34" rx="44" ry="26" fill="#2de6ea" opacity="0.28" filter="{gl}"/><ellipse cx="48" cy="34" rx="30" ry="18" fill="#ff9a3c" opacity="0.2" filter="{gl}"/>')
    d.add(f'<path d="M30,12 L66,12 L70,48 L26,48 Z" fill="{d.lin([(0, "#bffcff", None), (1, "#2de6ea", None)])}" stroke="#0a3a44" stroke-width="3" stroke-linejoin="round"/>')
    d.add('<rect x="24" y="8" width="48" height="8" rx="3" fill="#ff9a3c" stroke="#0a3a44" stroke-width="2.5"/><rect x="24" y="44" width="48" height="8" rx="3" fill="#ff9a3c" stroke="#0a3a44" stroke-width="2.5"/>')
    d.add('<path d="M38,16 L38,44 M58,16 L58,44" stroke="#0a3a44" stroke-width="1.6" opacity="0.5"/>')
    save('lanterne', d)

    d = Doc(96, 64)
    d.add(f'<ellipse cx="50" cy="40" rx="40" ry="12" fill="#000" opacity="0.15"/>')
    d.add(f'<path d="M6,34 C30,6 66,8 90,30 C66,46 30,50 6,34 Z" fill="{d.lin([(0, "#8fd070", None), (1, "#4e8a4a", None)])}" stroke="#2f6a3a" stroke-width="3" stroke-linejoin="round"/><path d="M8,34 C34,28 62,28 88,30" fill="none" stroke="#2f6a3a" stroke-width="2.5"/>')
    save('feuille', d)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n, t in THEMES.items():
        compose(n, t['sky'], t['wt'], t['water'], t['fn'], t['glint'], t['seed'])
        print('bg', n)
    for n, sp in SPECIES.items():
        fish_svgs(n, sp)
    print('fish', len(SPECIES))
    floats()
    print('floats ok')
