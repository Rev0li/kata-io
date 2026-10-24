// Couleurs, polices et petits outils partagés par le rendu.
import { lerp } from '../../sim/sim';

export const C = {
  bone: 0xecdfc6,
  ochre: 0xe0a243,
  jade: 0x62c2a2,
  red: 0xe5483a,
  gold: 0xf2c14e,
};
export const FONT_DISP = '"Big Shoulders Display", Impact, sans-serif';
export const FONT_BODY = 'Barlow, system-ui, sans-serif';

const cache = new Map<string, number>();
// '#rrggbb' -> 0xrrggbb (mis en cache : appelé à chaque image)
export function hex(s: string): number {
  let v = cache.get(s);
  if (v === undefined) {
    v = parseInt(s.slice(1), 16);
    cache.set(s, v);
  }
  return v;
}
export function mix(a: number, b: number, t: number) {
  const r = Math.round(lerp(a >> 16, b >> 16, t)),
    g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)),
    bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}
// Couleur d'un pourcentage : crème, puis jaune, orange, rouge.
const HEAT: [number, number[]][] = [
  [0, [236, 223, 198]],
  [60, [240, 196, 96]],
  [110, [236, 138, 60]],
  [160, [229, 72, 58]],
  [230, [190, 40, 60]],
];
export function heatCss(p: number) {
  for (let i = 1; i < HEAT.length; i++) {
    if (p <= HEAT[i][0]) {
      const a = HEAT[i - 1],
        b = HEAT[i],
        t = (p - a[0]) / (b[0] - a[0]);
      return (
        '#' +
        a[1]
          .map((v, k) =>
            Math.round(lerp(v, b[1][k], t))
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
      );
    }
  }
  return '#be283c';
}
// Hasard purement visuel (la simulation a le sien).
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
