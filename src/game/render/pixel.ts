// Dessin en pixel art : une petite image dont chaque pixel couvre `px` pixels d'écran, agrandie sans lissage.
// Même vocabulaire que Phaser.GameObjects.Graphics pour ce dont la plateforme a besoin (polygones pleins et traits),
// mais sans aucun lissage : des pixels francs, de la taille de ceux des combattants.
import Phaser from 'phaser';

interface Pt {
  x: number;
  y: number;
}
type Rgba = [number, number, number, number];
const rgba = (col: number, a: number): Rgba => [(col >> 16) & 255, (col >> 8) & 255, col & 255, a];

export class Pixels {
  readonly img: Phaser.GameObjects.Image;
  private tex: Phaser.Textures.CanvasTexture;
  private data: ImageData;
  private w: number;
  private h: number;
  private fill: Rgba = [0, 0, 0, 1];
  private stroke: Rgba = [0, 0, 0, 1];
  private lw = 1;

  // (x0, y0)-(x1, y1) : zone couverte, en pixels d'écran au zoom 1 ; px : taille d'un pixel de l'image.
  constructor(
    scene: Phaser.Scene,
    key: string,
    private x0: number,
    private y0: number,
    x1: number,
    y1: number,
    private px: number,
  ) {
    this.w = Math.ceil((x1 - x0) / px);
    this.h = Math.ceil((y1 - y0) / px);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, this.w, this.h)!;
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.data = this.tex.getContext().createImageData(this.w, this.h);
    this.img = scene.add.image(x0, y0, key).setOrigin(0, 0).setScale(px);
  }
  clear() {
    this.data.data.fill(0);
    return this;
  }
  // À appeler après le dessin : envoie l'image à la carte graphique.
  flush() {
    this.tex.getContext().putImageData(this.data, 0, 0);
    this.tex.refresh();
  }
  fillStyle(col: number, a = 1) {
    this.fill = rgba(col, a);
    return this;
  }
  lineStyle(width: number, col: number, a = 1) {
    this.lw = Math.max(1, Math.round(width / this.px));
    this.stroke = rgba(col, a);
    return this;
  }
  private dot(x: number, y: number, c: Rgba) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const d = this.data.data,
      i = (y * this.w + x) * 4,
      a = c[3],
      da = d[i + 3] / 255,
      oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  // Polygone plein : un pixel est rempli si son centre est dans le polygone.
  fillPoints(pts: Pt[], _close = true) {
    const P = pts.map(p => ({ x: (p.x - this.x0) / this.px, y: (p.y - this.y0) / this.px }));
    const ya = Math.max(0, Math.floor(Math.min(...P.map(p => p.y)))),
      yb = Math.min(this.h - 1, Math.ceil(Math.max(...P.map(p => p.y))));
    for (let y = ya; y <= yb; y++) {
      const cy = y + 0.5,
        xs: number[] = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i],
          b = P[(i + 1) % P.length];
        if (a.y <= cy !== b.y <= cy) xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.dot(x, y, this.fill);
    }
    return this;
  }
  lineBetween(xa: number, ya: number, xb: number, yb: number) {
    const ax = (xa - this.x0) / this.px,
      ay = (ya - this.y0) / this.px,
      bx = (xb - this.x0) / this.px,
      by = (yb - this.y0) / this.px,
      dx = bx - ax,
      dy = by - ay,
      horiz = Math.abs(dx) >= Math.abs(dy),
      n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy)))),
      off = -Math.floor((this.lw - 1) / 2);
    let lx = NaN,
      ly = NaN;
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(ax + (dx * i) / n),
        y = Math.floor(ay + (dy * i) / n);
      if (x === lx && y === ly) continue; // jamais deux fois le même pixel : un trait translucide reste uniforme
      lx = x;
      ly = y;
      for (let t = 0; t < this.lw; t++) this.dot(horiz ? x : x + off + t, horiz ? y + off + t : y, this.stroke);
    }
    return this;
  }
  strokePoints(pts: Pt[], close = false) {
    for (let i = 0; i + 1 < pts.length; i++) this.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (close && pts.length > 2) this.lineBetween(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y);
    return this;
  }
}
