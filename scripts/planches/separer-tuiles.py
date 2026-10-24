# Sépare des éléments qui se touchent (tuiles iso) : érosion du masque, composantes, puis regonflement.
import sys, os, glob
from collections import deque
from PIL import Image, ImageFilter, ImageChops
src, out, T, E = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
os.makedirs(out, exist_ok=True)
for f in glob.glob(out + '/*.png'): os.remove(f)
im = Image.open(src).convert('RGB'); W, H = im.size; px = im.load()
bg = px[1, 1]
fg = Image.new('L', (W, H)); fp = fg.load()
for y in range(H):
    for x in range(W):
        p = px[x, y]
        fp[x, y] = 255 if max(abs(p[0]-bg[0]), abs(p[1]-bg[1]), abs(p[2]-bg[2])) > T else 0
# bouche les petits trous puis érode
er = fg.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MinFilter(2 * E + 1)); ep = er.load()
lab = [[0] * W for _ in range(H)]; n = 0; sizes = {}
for y in range(H):
    for x in range(W):
        if ep[x, y] and not lab[y][x]:
            n += 1; q = deque([(x, y)]); lab[y][x] = n; c = 0
            while q:
                i, j = q.popleft(); c += 1
                for a, b in ((i+1,j),(i-1,j),(i,j+1),(i,j-1)):
                    if 0 <= a < W and 0 <= b < H and ep[a, b] and not lab[b][a]: lab[b][a] = n; q.append((a, b))
            sizes[n] = c
k = 0
for l, c in sorted(sizes.items(), key=lambda t: -t[1]):
    if c < 800: continue
    m = Image.new('L', (W, H)); mp = m.load()
    for y in range(H):
        for x in range(W):
            if lab[y][x] == l: mp[x, y] = 255
    m = ImageChops.multiply(m.filter(ImageFilter.MaxFilter(2 * E + 3)), fg.filter(ImageFilter.MaxFilter(3)))
    rgba = im.convert('RGBA'); rgba.putalpha(m); bb = m.getbbox()
    k += 1; rgba.crop(bb).save(f'{out}/{k:03d}.png')
print(src, k)
