// Caméra pendant une éjection : elle suit le combattant éjecté jusqu'au plouf, garde l'auteur du coup dans le cadre
// (on voit la distance parcourue), recule si le vol part loin, marque un temps sur le point de chute, puis rend la
// main à la caméra normale (GameScene), qui revient en douceur sur le joueur.
// Sans Phaser : reçoit les événements du combat et l'état, rend un cadre en coordonnées écran du monde.
import { iso } from './render/iso';

export const PAUSE_MS = 650, // temps passé sur le point de chute, après le plouf
  PAUSE_LOIN_MS = 950,
  MARGE = 150, // place autour des deux combattants, en pixels du monde
  LOIN = 260; // distance (pixels écran du monde) entre la victime et le centre au-delà de laquelle le vol est « loin »

interface Suivi {
  idx: number; // combattant éjecté
  par: number; // auteur du coup (-1 : sorti seul)
  x: number; // dernier point connu de la victime (écran du monde)
  y: number;
  pause: number; // ms restantes après le plouf ; -1 : encore en vol
  loin: boolean;
}

export interface Cadre {
  x: number;
  y: number;
  zoomMax: number; // le zoom ne dépasse pas cette valeur, pour que tout tienne
  loin: boolean;
}

export class SuiviEjection {
  s: Suivi | null = null;

  // à appeler pour chaque événement du combat ; rend true au plouf d'une éjection lointaine (secousse)
  evenement(ev: any): boolean {
    if (ev.t === 'ko') {
      this.s = { idx: ev.to, par: ev.by, x: 0, y: 0, pause: -1, loin: ev.pct >= 120 };
      return false;
    }
    if ((ev.t === 'splash' || ev.t === 'star') && this.s && this.s.pause < 0) {
      this.s.pause = this.s.loin ? PAUSE_LOIN_MS : PAUSE_MS;
      if (ev.t === 'splash') {
        const p = iso(ev.x, ev.y);
        this.s.x = p.x;
        this.s.y = p.y;
      }
      return this.s.loin;
    }
    return false;
  }

  // Cadre voulu pour cette image, ou null quand il n'y a rien à suivre. W, H : taille de l'écran en pixels.
  cadre(st: any, dtMs: number, W: number, H: number): Cadre | null {
    const s = this.s;
    if (!s || !st) return (this.s = null);
    const v = st.f[s.idx];
    if (!v) return (this.s = null);
    // le combattant revient (nouvelle manche, remontée) : fin du suivi
    if (v.state !== 'falling' && v.state !== 'dead') return (this.s = null);
    if (v.state === 'falling') {
      const p = iso(v.x, v.y, v.z || 0);
      s.x = p.x;
      s.y = p.y;
      if (Math.hypot(p.x, p.y) > LOIN) s.loin = true;
    } else if (s.pause < 0) s.pause = s.loin ? PAUSE_LOIN_MS : PAUSE_MS; // plouf déjà passé (instantané manqué)
    if (s.pause >= 0) {
      s.pause -= dtMs;
      if (s.pause <= 0) return (this.s = null);
    }
    // l'auteur du coup reste dans le cadre ; la victime pèse plus lourd (c'est elle qu'on regarde)
    const a = s.par >= 0 ? st.f[s.par] : null;
    let x = s.x,
      y = s.y,
      lx = 0,
      ly = 0;
    if (a && a.state !== 'falling' && a.state !== 'dead') {
      const q = iso(a.x, a.y);
      x = s.x * 0.62 + q.x * 0.38;
      y = s.y * 0.62 + q.y * 0.38;
      lx = Math.abs(s.x - q.x);
      ly = Math.abs(s.y - q.y);
    }
    // la victime n'est pas au centre : il faut la place de la plus grande des deux parts (0,62 de l'écart)
    const zoomMax = Math.min(W / (lx * 1.24 + MARGE * 2), H / (ly * 1.24 + MARGE * 1.6));
    return { x, y: y - 10, zoomMax, loin: s.loin };
  }
}
