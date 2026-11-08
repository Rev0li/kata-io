#!/usr/bin/env python3
"""Fond de l'accueil : un combattant, de dos, regarde la Tour au coucher du soleil.
Écrit public/assets/accueil/tour.svg. Même famille que les horizons (build-decor-svg.py) : aplats, dégradés doux, contour sombre.

Composition, pensée pour la colonne de boutons à droite et le classement en bas à gauche :
la Tour à gauche (sa base passe dans la brume, derrière le classement), le combattant juste avant le milieu.
Format 1920 × 1000 : affiché en « cover », recadré sur les côtés sur PC, en haut et en bas sur téléphone.
"""
import math
import os
import random

W, H = 1920, 1000
OL = '#0f1719'
SORTIE = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'accueil', 'tour.svg')
s = []
add = s.append


def n(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def ridge(seed, base, amp, fill, step=26):
    r = random.Random(seed)
    pts, y = [], base
    a, b = r.uniform(0, 6), r.uniform(0, 6)
    for x in range(-20, W + 40, step):
        y = base - amp * (0.55 * math.sin(x / 230 + a) + 0.35 * math.sin(x / 97 + b) + 0.5) - r.uniform(0, amp * 0.12)
        pts.append(f'{x},{n(y)}')
    add(f'<path d="M-20,{H} L{" L".join(pts)} L{W + 20},{H} Z" fill="{fill}"/>')


def bande(x, y, w, h, col, op):
    add(f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" rx="{n(h / 2)}" fill="{col}" opacity="{op}"/>')


def etage(cx, y, lb, lh, roof):
    """Un étage : mur à fenêtres éclairées, toit aux coins relevés. y = bas du mur."""
    add(f'<rect x="{n(cx - lb / 2)}" y="{n(y - lh)}" width="{n(lb)}" height="{n(lh)}" fill="#3b2c49" stroke="{OL}" stroke-width="4"/>')
    add(f'<rect x="{n(cx + lb * 0.16)}" y="{n(y - lh)}" width="{n(lb * 0.34)}" height="{n(lh)}" fill="#2a2038"/>')
    nb = max(2, int(lb / 46))
    fw, fh = 15, lh * 0.5
    for i in range(nb):
        fx = cx - lb / 2 + lb * (i + 0.5) / nb
        col = '#ffd27a' if fx < cx + lb * 0.16 else '#c98a4e'
        add(
            f'<path d="M{n(fx - fw / 2)},{n(y - lh * 0.16)} V{n(y - lh * 0.16 - fh + 7)} Q{n(fx)},{n(y - lh * 0.16 - fh - 7)} '
            f'{n(fx + fw / 2)},{n(y - lh * 0.16 - fh + 7)} V{n(y - lh * 0.16)} Z" fill="{col}" stroke="{OL}" stroke-width="2.5"/>'
        )
    # toit : pointes relevées, dessous sombre, liseré doré
    top, ry = y - lh, lh * 0.5 + 12
    l, r = cx - roof / 2, cx + roof / 2
    add(f'<path d="M{n(l + 8)},{n(top + 4)} Q{n(cx)},{n(top + 18)} {n(r - 8)},{n(top + 4)} L{n(r - 26)},{n(top - 8)} L{n(l + 26)},{n(top - 8)} Z" fill="#581f2c" stroke="{OL}" stroke-width="4" stroke-linejoin="round"/>')
    add(
        f'<path d="M{n(l)},{n(top - 16)} Q{n(l + roof * 0.2)},{n(top - 6)} {n(cx - lb * 0.42)},{n(top - ry)} L{n(cx + lb * 0.42)},{n(top - ry)} '
        f'Q{n(r - roof * 0.2)},{n(top - 6)} {n(r)},{n(top - 16)} Q{n(cx)},{n(top + 6)} {n(l)},{n(top - 16)} Z" fill="#a8353a" stroke="{OL}" stroke-width="4" stroke-linejoin="round"/>'
    )
    add(f'<path d="M{n(l + 3)},{n(top - 16)} Q{n(cx)},{n(top + 5)} {n(r - 3)},{n(top - 16)}" fill="none" stroke="#f2c14e" stroke-width="3.5" stroke-linecap="round"/>')
    add(f'<path d="M{n(l + 12)},{n(top - 22)} Q{n(l + roof * 0.2)},{n(top - 12)} {n(cx - lb * 0.4)},{n(top - ry + 4)}" fill="none" stroke="#e8705f" stroke-width="3" stroke-linecap="round"/>')
    return top - ry


def tour(cx, y0):
    y = y0
    TIERS = 8
    for i in range(TIERS):
        t = i / (TIERS - 1)
        lb = 216 - 128 * t
        lh = 60 - 22 * t
        y = etage(cx, y, lb, lh, lb + 84)
    add(f'<path d="M{cx - 3},{n(y + 6)} V{n(y - 70)} M{cx + 3},{n(y + 6)} V{n(y - 70)}" stroke="#f2c14e" stroke-width="5" stroke-linecap="round"/>')
    for k, rr in ((14, 15), (32, 11), (48, 8)):
        add(f'<ellipse cx="{cx}" cy="{n(y - k)}" rx="{rr}" ry="4.5" fill="#f2c14e" stroke="{OL}" stroke-width="2.5"/>')
    add(f'<circle cx="{cx}" cy="{n(y - 76)}" r="8" fill="#ffe3a0" stroke="{OL}" stroke-width="2.5"/>')


def blossoms(cx, cy, rx, ry, seed, nb):
    r = random.Random(seed)
    for _ in range(nb):
        a, d = r.uniform(0, 6.28), math.sqrt(r.random())
        x, y = cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d
        rad = r.uniform(16, 40)
        col = r.choice(['#7d3556', '#96426a', '#b0527c', '#c9688f'])
        add(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(rad)}" fill="{col}"/>')


def combattant(x, y, k):
    p = f'stroke="{OL}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"'
    add(f'<g transform="translate({x},{y}) scale({k})">')
    add('<ellipse cx="4" cy="3" rx="82" ry="11" fill="#0b1118" opacity=".55"/>')
    # pans du bandeau, soulevés par le vent
    add(f'<path d="M20,-250 C60,-262 92,-238 128,-258 C112,-236 74,-222 22,-238 Z" fill="#c8463b" {p}/>')
    add(f'<path d="M20,-242 C58,-234 84,-208 122,-212 C102,-194 62,-200 18,-230 Z" fill="#9d3233" {p}/>')
    # katana dans le dos
    add(f'<path d="M-66,-262 L74,-92" stroke="{OL}" stroke-width="17" stroke-linecap="round"/>')
    add('<path d="M-66,-262 L-26,-214" stroke="#d9c49a" stroke-width="10" stroke-linecap="round"/>')
    add('<path d="M-22,-209 L74,-92" stroke="#3b2c49" stroke-width="10" stroke-linecap="round"/>')
    add(f'<path d="M-37,-204 L-12,-225" stroke="#f2c14e" stroke-width="9" stroke-linecap="round"/>')
    # pantalon large
    add(f'<path d="M-44,-116 L-66,-6 Q-40,6 -12,-2 L-3,-62 L5,-62 L16,-2 Q44,6 68,-6 L44,-116 Z" fill="#26324f" {p}/>')
    add('<path d="M-28,-100 L-40,-10 M28,-100 L42,-10 M0,-108 V-68" fill="none" stroke="#18213a" stroke-width="5" stroke-linecap="round"/>')
    # bras
    add(f'<path d="M-46,-196 Q-68,-158 -64,-112 L-44,-108 Q-40,-150 -28,-180 Z" fill="#cdbf9f" {p}/>')
    add(f'<path d="M46,-196 Q68,-158 64,-112 L44,-108 Q40,-150 28,-180 Z" fill="#a89a80" {p}/>')
    add(f'<circle cx="-55" cy="-102" r="11" fill="#d9a06f" {p}/>')
    add(f'<circle cx="55" cy="-102" r="11" fill="#b37f57" {p}/>')
    # veste, ombre à droite, lumière du soleil à gauche
    add(f'<path d="M-46,-118 L-52,-192 Q-30,-214 0,-216 Q30,-214 52,-192 L46,-118 Z" fill="#e4d8bf" {p}/>')
    add('<path d="M10,-214 Q34,-212 49,-191 L44,-120 L8,-120 Z" fill="#b9ab90"/>')
    add('<path d="M-49,-190 L-44,-122" fill="none" stroke="#ffc98a" stroke-width="5" stroke-linecap="round"/>')
    # ceinture et son nœud
    add(f'<rect x="-48" y="-126" width="96" height="17" rx="3" fill="#f2c14e" {p}/>')
    add(f'<path d="M-4,-112 L-20,-64 L-6,-68 L2,-110 Z M4,-112 L22,-70 L8,-70 L-2,-110 Z" fill="#d9a53a" {p}/>')
    # tête tournée vers la Tour : un peu de joue à gauche
    add(f'<ellipse cx="-30" cy="-244" rx="12" ry="19" fill="#d9a06f" {p}/>')
    add(f'<circle cx="-2" cy="-250" r="35" fill="#1b1a26" {p}/>')
    add(f'<path d="M-36,-256 Q-2,-240 33,-256 L33,-243 Q-2,-228 -36,-243 Z" fill="#c8463b" {p}/>')
    add(f'<path d="M-8,-282 Q-12,-310 4,-312 Q16,-308 10,-282 Z" fill="#1b1a26" {p}/>')
    add('<path d="M-26,-268 Q-14,-280 -4,-282" fill="none" stroke="#574a63" stroke-width="5" stroke-linecap="round"/>')
    add('</g>')


add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">')
add(
    '<defs>'
    '<linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">'
    '<stop offset="0" stop-color="#141c33"/><stop offset=".3" stop-color="#2e2d58"/><stop offset=".52" stop-color="#7c3f68"/>'
    '<stop offset=".7" stop-color="#df7a50"/><stop offset=".84" stop-color="#f7bd68"/></linearGradient>'
    '<radialGradient id="halo"><stop offset="0" stop-color="#ffdf9c" stop-opacity=".85"/><stop offset=".45" stop-color="#ffb066" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a5c" stop-opacity="0"/></radialGradient>'
    '<linearGradient id="soleil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeab8"/><stop offset="1" stop-color="#ffa45e"/></linearGradient>'
    '<linearGradient id="brume" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1a98a" stop-opacity="0"/><stop offset=".6" stop-color="#d98a86" stop-opacity=".78"/><stop offset="1" stop-color="#9a5d80" stop-opacity=".92"/></linearGradient>'
    '<linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a44"/><stop offset="1" stop-color="#121a28"/></linearGradient>'
    '</defs>'
)
add(f'<rect width="{W}" height="{H}" fill="url(#ciel)"/>')
r = random.Random(7)
for _ in range(110):
    x, y = r.uniform(0, W), r.uniform(0, 330)
    add(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(r.uniform(1, 2.6))}" fill="#f4ecd8" opacity="{n(r.uniform(.25, .9) * (1 - y / 400))}"/>')
TX = 470
add(f'<circle cx="{TX}" cy="540" r="660" fill="url(#halo)"/>')
add(f'<circle cx="{TX}" cy="540" r="262" fill="url(#soleil)"/>')
for x, y, w, h, c, o in [
    (-80, 330, 620, 20, '#e58a78', .55), (760, 390, 760, 24, '#d97a7c', .5), (1180, 300, 540, 16, '#b4627c', .45),
    (90, 470, 300, 15, '#ffd2a0', .6), (640, 500, 560, 20, '#f5a77e', .6), (1300, 560, 700, 24, '#ee9571', .55),
]:
    bande(x, y, w, h, c, o)
ridge(11, 690, 170, '#7a5079')
ridge(23, 760, 150, '#5b3f6c')
tour(TX, 842)
add(f'<rect x="0" y="640" width="{W}" height="250" fill="url(#brume)"/>')
for x, y, w, h, c, o in [(-60, 742, 720, 26, '#f3b693', .75), (300, 792, 760, 30, '#d98f8c', .8), (980, 720, 820, 26, '#e79f85', .55)]:
    bande(x, y, w, h, c, o)
ridge(37, 880, 90, '#3a2f55')
# falaise au premier plan, plus haute à droite
pts, rr = [], random.Random(5)
for x in range(-20, W + 40, 34):
    u = x / W
    y = 905 - 18 * math.sin(u * 7) - 95 * max(0, u - 0.46) ** 1.1 * 2 - rr.uniform(0, 7)
    pts.append(f'{x},{n(y)}')
add(f'<path d="M-20,{H} L{" L".join(pts)} L{W + 20},{H} Z" fill="url(#sol)" stroke="{OL}" stroke-width="5"/>')
add(f'<path d="M{" L".join(pts)}" fill="none" stroke="#c9705f" stroke-width="4" opacity=".75"/>')
# cerisier à droite : il encadre la scène et assombrit le fond derrière les boutons
add(f'<path d="M1840,1000 C1800,760 1880,520 1790,330 C1700,190 1540,150 1300,70 L1320,30 C1560,90 1700,110 1810,230 C1890,160 1930,100 1960,80 L1960,1000 Z" fill="#1e1a2a" stroke="{OL}" stroke-width="6" stroke-linejoin="round"/>')
blossoms(1660, 90, 400, 130, 3, 120)
blossoms(1320, 40, 200, 74, 9, 44)
pet = random.Random(21)
for _ in range(46):
    x, y, a = pet.uniform(560, W), pet.uniform(170, 860), pet.uniform(0, 180)
    add(f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{n(pet.uniform(4, 8))}" ry="{n(pet.uniform(2, 4))}" fill="#ecb3c8" opacity="{n(pet.uniform(.45, .95))}" transform="rotate({n(a)} {n(x)} {n(y)})"/>')
combattant(806, 886, 0.82)
add('</svg>')
with open(SORTIE, 'w', encoding='utf-8') as f:
    f.write(''.join(s))
print(os.path.normpath(SORTIE), len(''.join(s)) // 1024, 'Ko')
