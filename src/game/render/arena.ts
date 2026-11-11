// Plateforme du dojo, dessinée en code (elle rétrécit en mort subite). Les lanternes sur pied des angles ont été
// retirées le 2026-11-12 : elles gênaient la lecture du bord.
import Phaser from 'phaser';
import { lerp } from '../../sim/sim';
import { isoX, isoY, iso } from './iso';
import { C, mix } from './palette';
import { THEMES } from './themes';
import type { Renderer } from './index';

export class Arena {
  constructor(private r: Renderer) {}

  /* ---------- dojo : cadre en bois et lattes ---------- */
  draw(H: number, wet = false, sudden = false) {
    const r = this.r;
    r.H = H;
    r.wet = wet;
    r.sudden = sudden;
    const g = r.arenaG;
    g.clear();
    const T = THEMES[r.theme],
      m = 24,
      TH = 30;
    const P = (x: number, y: number, dy = 0): any => ({ x: isoX(x, y), y: isoY(x, y) + dy });
    const quad = (h: number, dy = 0): any[] => [P(-h, -h, dy), P(h, -h, dy), P(h, h, dy), P(-h, h, dy)]; // haut, droite, bas, gauche
    const O = H + m,
      o = quad(O);
    // reflet sombre sur l'eau
    g.fillStyle(0x000000, 0.3);
    g.fillPoints(
      o.map((p: any): any => ({ x: p.x + 14, y: p.y + TH + 18 })),
      true,
    );
    // flancs : gauche (clair) et droit (sombre), puis des pieux sous le bord
    const dn = (p: any, d = TH): any => ({ x: p.x, y: p.y + d });
    g.fillStyle(T.side, 1);
    g.fillPoints([o[3], o[2], dn(o[2]), dn(o[3])], true);
    g.fillStyle(mix(T.side, 0x000000, 0.3), 1);
    g.fillPoints([o[2], o[1], dn(o[1]), dn(o[2])], true);
    g.lineStyle(2, mix(T.side, 0x000000, 0.5), 0.9);
    for (let i = 1; i < 8; i++) {
      const k = i / 8,
        a = { x: lerp(o[3].x, o[2].x, k), y: lerp(o[3].y, o[2].y, k) },
        c = { x: lerp(o[2].x, o[1].x, k), y: lerp(o[2].y, o[1].y, k) };
      g.lineBetween(a.x, a.y, a.x, a.y + TH);
      g.lineBetween(c.x, c.y, c.x, c.y + TH);
    }
    // bord, puis lattes
    g.fillStyle(T.rim, 1);
    g.fillPoints(o, true);
    g.lineStyle(2, mix(T.rim, 0xffffff, 0.25), 0.7);
    g.strokePoints(quad(O - 3), true);
    const n = Math.max(6, Math.round(H / 24)),
      step = (2 * H) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -H + i * step,
        x1 = x0 + step;
      g.fillStyle(i % 2 ? T.top : T.top2, 1);
      g.fillPoints([P(x0, -H), P(x1, -H), P(x1, H), P(x0, H)], true);
    }
    g.lineStyle(1.5, T.seam, 0.85);
    for (let i = 0; i <= n; i++) {
      const x = -H + i * step,
        a = P(x, -H),
        c = P(x, H);
      g.lineBetween(a.x, a.y, c.x, c.y);
    }
    g.lineStyle(1, T.seam, 0.5); // joints d'about, décalés d'une latte à l'autre
    for (let i = 0; i < n; i++) {
      const x0 = -H + i * step,
        y = -H + ((i * 0.37) % 1) * 2 * H,
        a = P(x0, y),
        c = P(x0 + step, y);
      g.lineBetween(a.x, a.y, c.x, c.y);
    }
    if (wet) {
      g.fillStyle(0x4d7a4a, 0.3);
      g.fillPoints(quad(H), true);
    }
    // liseré intérieur : turquoise en cartoon, néon en nuit
    if (T.line) {
      if (T.edge) {
        g.lineStyle(9, T.line, 0.16);
        g.strokePoints(quad(H - 14), true);
        g.lineStyle(9, T.edge, 0.16);
        g.strokePoints(quad(O - 1), true);
      }
      g.lineStyle(3, T.line, 1);
      g.strokePoints(quad(H - 14), true);
    }
    if (T.edge) {
      g.lineStyle(3, T.edge, 1);
      g.strokePoints(quad(O - 2), true);
    }
    if (sudden) {
      g.lineStyle(6, C.red, 0.16);
      g.strokePoints(quad(H - 4), true);
      g.lineStyle(3, C.red, 0.95);
      g.strokePoints(quad(H - 4), true);
    }
    g.lineStyle(3, T.out, 1);
    g.strokePoints(o, true);
    g.lineStyle(2, T.out, 0.9);
    g.lineBetween(o[3].x, o[3].y, o[3].x, o[3].y + TH);
    g.lineBetween(o[2].x, o[2].y, o[2].x, o[2].y + TH);
    g.lineBetween(o[1].x, o[1].y, o[1].x, o[1].y + TH);
    g.lineBetween(o[3].x, o[3].y + TH, o[2].x, o[2].y + TH);
    g.lineBetween(o[2].x, o[2].y + TH, o[1].x, o[1].y + TH);
  }
}
