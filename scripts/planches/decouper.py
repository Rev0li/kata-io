# Découpe une planche d'assets sur fond uni : un PNG transparent par élément, légendes retirées.
import subprocess, sys, re, os, glob
from collections import deque
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 14
LINES = len(sys.argv) > 4 and sys.argv[4] == '1'
DIL = sys.argv[5] if len(sys.argv) > 5 else 'Disk:2'
os.makedirs(out, exist_ok=True)
for f in glob.glob(out + '/*.png'): os.remove(f)
im = Image.open(src).convert('RGB'); W, H = im.size
border = [im.getpixel((x, y)) for x in range(0, W, 5) for y in (2, H - 3)] + [im.getpixel((x, y)) for y in range(0, H, 5) for x in (2, W - 3)]
bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
hexbg = 'rgb(%d,%d,%d)' % bg
def isbg(p, t=None):
    t = T if t is None else t
    return max(abs(p[0] - bg[0]), abs(p[1] - bg[1]), abs(p[2] - bg[2])) <= t
if LINES:
    # efface les traits fins et longs (cadres des sections)
    px0 = im.load()
    fgm = lambda x, y: 0 <= x < W and 0 <= y < H and not isbg(px0[x, y])
    for y in range(H):
        run = []
        for x in range(W + 1):
            if x < W and fgm(x, y) and not fgm(x, y - 4) and not fgm(x, y + 4): run.append(x)
            else:
                if len(run) >= 60:
                    for xx in run:
                        for yy in range(y - 3, y + 4):
                            if 0 <= yy < H: px0[xx, yy] = bg
                run = []
    for x in range(W):
        run = []
        for y in range(H + 1):
            if y < H and fgm(x, y) and not fgm(x - 4, y) and not fgm(x + 4, y): run.append(y)
            else:
                if len(run) >= 60:
                    for yy in run:
                        for xx in range(x - 3, x + 4):
                            if 0 <= xx < W: px0[xx, yy] = bg
                run = []
    src = out + '.clean.png'; im.save(src)
fz = '%d%%' % max(1, T * 100 // 255 * 2 // 3)
cc = subprocess.run(['magick', src, '-fuzz', fz, '-fill', 'black', '-opaque', hexbg, '-fill', 'white', '+opaque', 'black',
    '-morphology', 'Dilate', DIL, '-define', 'connected-components:verbose=true',
    '-define', 'connected-components:area-threshold=900', '-connected-components', '8', 'null:'], capture_output=True, text=True).stdout
boxes = [tuple(map(int, m.groups())) for m in re.finditer(r'(\d+)x(\d+)\+(\d+)\+(\d+) \S+ \d+ srgb\(255,255,255\)', cc)]
keep = []
for (w, h, x, y) in boxes:
    c = im.crop((x, y, x + w, y + h)).convert('RGBA'); px = c.load()
    fg = [[not isbg(px[i, j]) for i in range(w)] for j in range(h)]
    rows = [sum(r) for r in fg]
    # segments de lignes séparés par des bandes vides ; on retire les légendes du bas (peu hautes)
    segs, j = [], 0
    while j < h:
        if rows[j] <= 1: j += 1; continue
        k = j
        while k < h and rows[k] > 1: k += 1
        segs.append([j, k]); j = k
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 3: merged[-1][1] = s[1]
        else: merged.append(s)
    bottom = h
    while len(merged) > 1 and merged[-1][1] - merged[-1][0] <= 16 and merged[0][1] - merged[0][0] > 20:
        bottom = merged[-1][0]; merged.pop()
    # fond : composantes de fond touchant le bord, ou enclavées et grandes
    seen = [[False] * w for _ in range(h)]
    for j0 in range(h):
        for i0 in range(w):
            if seen[j0][i0] or fg[j0][i0]: continue
            comp, q, edge = [], deque([(i0, j0)]), False
            seen[j0][i0] = True
            while q:
                i, j = q.popleft(); comp.append((i, j))
                if i in (0, w - 1) or j in (0, h - 1): edge = True
                for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if 0 <= a < w and 0 <= b < h and not seen[b][a] and not fg[b][a]:
                        seen[b][a] = True; q.append((a, b))
            if edge or len(comp) > 300:
                for i, j in comp: px[i, j] = (0, 0, 0, 0)
    # liseré clair laissé par l'anticrénelage : pixels pâles collés au vide
    for j in range(h):
        for i in range(w):
            p = px[i, j]
            if p[3] and isbg(p, 40) and any(0 <= a < w and 0 <= b < h and px[a, b][3] == 0 for a, b in ((i+1,j),(i-1,j),(i,j+1),(i,j-1))):
                px[i, j] = (p[0], p[1], p[2], 110)
    c = c.crop((0, 0, w, bottom)); bb = c.getbbox()
    if not bb: continue
    c = c.crop(bb)
    if c.width < 18 or c.height < 18: continue
    keep.append((x + bb[0], y + bb[1], c))
keep.sort(key=lambda t: (t[1] // 60, t[0]))
open(out + '.boxes.txt', 'w').write(''.join(f'{n} {x} {y} {c.width} {c.height}\n' for n, (x, y, c) in enumerate(keep, 1)))
for n, (x, y, c) in enumerate(keep, 1): c.save(f'{out}/{n:03d}.png')
# planche d'aperçu numérotée
cell = 150; cols = 10; rows_n = (len(keep) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows_n * cell), (79, 111, 102)); d = ImageDraw.Draw(sheet)
for n, (x, y, c) in enumerate(keep, 1):
    t = c.copy(); t.thumbnail((cell - 22, cell - 22))
    X, Y = ((n - 1) % cols) * cell, ((n - 1) // cols) * cell
    sheet.paste(t, (X + (cell - t.width) // 2, Y + 18 + (cell - 22 - t.height) // 2), t)
    d.text((X + 4, Y + 2), str(n), fill=(255, 255, 0))
sheet.save(out + '.preview.png')
print(src, 'fond', bg, len(keep), 'éléments')
