// Vue isométrique 2:1 : le monde de la simulation (x, y) est projeté sur l'écran, les sprites restent debout.
import Phaser from 'phaser';

export const ISO = 0.6;
export const RX = Math.SQRT2 * ISO; // demi-axe horizontal d'un cercle de rayon 1 une fois projeté (la hauteur vaut la moitié)
export const isoX = (x: number, y: number) => (x - y) * ISO;
export const isoY = (x: number, y: number) => (x + y) * ISO * 0.5;
export const iso2 = (x: number, y: number) => ({ x: isoX(x, y), y: isoY(x, y) });
// Point écran d'un point du monde, à une hauteur h (en pixels) au-dessus du sol.
export const iso = (x: number, y: number, h = 0) => ({ x: (x - y) * ISO, y: (x + y) * ISO * 0.5 - h });
export function unIso(sx: number, sy: number) {
  const u = sx / ISO,
    w = (2 * sy) / ISO;
  return { x: (u + w) / 2, y: (w - u) / 2 };
}
// direction écran -> direction monde, à longueur égale (pour les touches et le joystick)
export function screenDirToWorld(dx: number, dy: number) {
  const x = (dx + 2 * dy) / 2,
    y = (2 * dy - dx) / 2,
    l = Math.hypot(x, y),
    m = Math.hypot(dx, dy);
  return l ? { x: (x / l) * m, y: (y / l) * m } : { x: 0, y: 0 };
}
export const worldAngleToScreen = (a: number) =>
  Math.atan2((Math.cos(a) + Math.sin(a)) * 0.5, Math.cos(a) - Math.sin(a));

/* ---------- formes posées à plat sur le sol ---------- */
export function fillC(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
  const p = iso(x, y);
  g.fillEllipse(p.x, p.y, 2 * RX * r, RX * r);
}
export function strokeC(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
  const p = iso(x, y);
  g.strokeEllipse(p.x, p.y, 2 * RX * r, RX * r);
}
// Secteur (cône de coup) posé au sol : fillPath/strokePath sur les points projetés.
export function cone(g: Phaser.GameObjects.Graphics, x: number, y: number, facing: number, r: number, arc: number) {
  const pts: any[] = [iso(x, y)],
    n = Math.max(6, Math.ceil(arc / 0.18));
  for (let i = 0; i <= n; i++) {
    const a = facing - arc / 2 + (arc * i) / n;
    pts.push(iso(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
}
