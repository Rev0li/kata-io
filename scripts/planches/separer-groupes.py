# Sépare les groupes : chaque élément est redécoupé sans dilatation ; s'il donne plusieurs morceaux conséquents, on les garde à part.
import subprocess, sys, os, glob, shutil
from PIL import Image, ImageDraw
planche, d, T = sys.argv[1], sys.argv[2], sys.argv[3]
cut = os.path.join(os.path.dirname(__file__), 'decouper.py')
im = Image.open(planche).convert('RGB')
res = []
for line in open(d + '.boxes.txt'):
    n, x, y, w, h = map(int, line.split())
    orig = Image.open(f'{d}/{n:03d}.png')
    if w * h > 6000:
        m = 6; tmp = f'{d}.tmp'
        im.crop((x - m, y - m, x + w + m, y + h + m)).save(tmp + '.png')
        subprocess.run(['python3', '-I', cut, tmp + '.png', tmp, T, '0', 'Disk:0.5'], capture_output=True)
        parts = [Image.open(f) for f in sorted(glob.glob(tmp + '/*.png'))]
        area = lambda p: sum(1 for a in p.getchannel('A').get_flattened_data() if a > 128)
        big = [p for p in parts if area(p) >= 1200]
        if len(big) >= 2 and max(map(area, big)) < 0.85 * area(orig):
            mx = max(map(area, big)); res += [p for p in big if area(p) >= 0.12 * mx]; continue
    res.append(orig)
out = d + '-final'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
cell, cols = 150, 10
sheet = Image.new('RGB', (cols * cell, ((len(res) + cols - 1) // cols) * cell), (79, 111, 102)); dr = ImageDraw.Draw(sheet)
for k, p in enumerate(res, 1):
    p.save(f'{out}/{k:03d}.png'); t = p.copy(); t.thumbnail((cell - 22, cell - 22))
    X, Y = ((k - 1) % cols) * cell, ((k - 1) // cols) * cell
    sheet.paste(t, (X + (cell - t.width) // 2, Y + 18 + (cell - 22 - t.height) // 2), t); dr.text((X + 4, Y + 2), str(k), fill=(255, 255, 0))
sheet.save(out + '.preview.png'); print(planche, len(res))
