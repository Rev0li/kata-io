// Pantin découpé (docs/PROMPTS-COMBATTANTS.md) : un combattant fait de pièces détachées (tête, buste, bras,
// jambes…) que le code assemble et anime. Remplace le sprite du pack quand le personnage a ses pièces
// (public/assets/combattants/<id>/<vue>/, préparées par scripts/planches/pantin.py). Prototype : activé par ?pantin.
//
// Repère local : pixels des pièces, origine entre les pieds, y vers le bas. Les membres sont placés par
// cinématique inverse à deux os (épaule -> coude -> poing, hanche -> genou -> pied) vers des cibles qui
// dépendent de l'état du combattant (garde, marche, coup, charge, parade, esquive, étourdi, chute).
import Phaser from 'phaser';
import { clamp } from '../../sim/sim';
import { RIG as NINJA_BLEU } from './pantins/ninja-bleu';

export interface PieceInfo {
  w: number;
  h: number;
  prox?: [number, number];
  dist?: [number, number];
}
export type PuppetRig = Record<string, Record<string, PieceInfo>>;

export const PUPPETS: Record<string, PuppetRig> = { 'ninja-bleu': NINJA_BLEU };
export const puppetOn = typeof location !== 'undefined' && new URLSearchParams(location.search).has('pantin');
const BASE = import.meta.env.BASE_URL + 'assets/combattants/';
const HEIGHT = 56; // hauteur du combattant dans le monde (le sprite du pack en faisait 48)
const HEAD = 1.15; // tête un peu plus grosse que sur la planche, comme sur la fiche validée
const JOINT = 4; // chevauchement aux coudes et aux genoux (px des pièces)

export function preloadPuppets(scene: Phaser.Scene) {
  if (!puppetOn) return;
  for (const [id, rig] of Object.entries(PUPPETS))
    for (const [view, pieces] of Object.entries(rig))
      for (const name of Object.keys(pieces))
        scene.load.image(`pp:${id}:${view}:${name}`, `${BASE}${id}/${view}/${name}.png`);
}

// Ce que le rendu des combattants sait de la posture à afficher.
export interface Pose {
  view: 'face' | 'dos';
  dirX: number; // direction du regard à l'écran (cos), pour les coups et le côté de l'arme
  dirY: number; // (sin)
  state: string;
  moving: boolean;
  walk: number; // distance parcourue (monde), pour le cycle de marche
  time: number;
  strike: { phase: string; ext: number; kick: boolean; side: number } | null;
  charge: number; // 0..1
  stateT: number;
  belt: number; // couleur de la ceinture
}

type Img = Phaser.GameObjects.Image;
const len = (p: PieceInfo) => Math.hypot(p.dist![0] - p.prox![0], p.dist![1] - p.prox![1]);
const ang0 = (p: PieceInfo) => Math.atan2(p.dist![1] - p.prox![1], p.dist![0] - p.prox![0]);

// Cinématique inverse à deux os : du point s vers la cible t ; le coude (ou le genou) part du côté qui
// le place le plus bas (bend = 0) ou le plus vers l'extérieur (bend = signe de x).
function ik2(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, out = 0) {
  const dx = tx - sx,
    dy = ty - sy,
    d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01),
    a = Math.atan2(dy, dx),
    A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const cand = [a + A, a - A].map(u => ({ u, ex: sx + Math.cos(u) * l1, ey: sy + Math.sin(u) * l1 }));
  const pick = out
    ? cand[0].ex * out > cand[1].ex * out
      ? cand[0]
      : cand[1]
    : cand[0].ey > cand[1].ey
      ? cand[0]
      : cand[1];
  const ex = pick.ex,
    ey = pick.ey,
    ux = sx + (dx / Math.hypot(dx, dy) || 0) * d,
    uy = sy + (dy / Math.hypot(dx, dy) || 0) * d;
  return { a1: pick.u, ex, ey, a2: Math.atan2(uy - ey, ux - ex), fx: ux, fy: uy };
}

export class Puppet {
  box: Phaser.GameObjects.Container;
  parts: Record<string, Img> = {};
  rig: PuppetRig;
  view: 'face' | 'dos' | '' = '';
  fist: { L: { x: number; y: number }; R: { x: number; y: number } } = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
  bodyH = 190;

  constructor(
    private scene: Phaser.Scene,
    readonly id: string,
  ) {
    this.rig = PUPPETS[id];
    this.box = scene.add.container(0, 0).setDepth(2.5);
  }

  destroy() {
    this.box.destroy();
  }
  setVisible(v: boolean) {
    this.box.setVisible(v);
  }

  // Construit les pièces d'une vue, dans l'ordre d'affichage (du fond vers l'avant).
  private build(view: 'face' | 'dos') {
    this.box.removeAll(true);
    this.parts = {};
    this.view = view;
    const order =
      view === 'face'
        ? [
            'jambe-d',
            'jambe-g',
            'bassin',
            'cuisse-d',
            'cuisse-g',
            'buste',
            'ceinture',
            'bras-d',
            'bras-g',
            'avant-bras-d',
            'avant-bras-g',
            'tete',
          ]
        : ['bras-g', 'bras-d', 'jambe-g', 'jambe-d', 'bassin', 'cuisse-g', 'cuisse-d', 'buste-ceinture', 'tete'];
    for (const n of order) {
      if (!this.rig[view][n]) continue;
      const img = this.scene.add.image(0, 0, `pp:${this.id}:${view}:${n}`);
      this.parts[n] = img;
      this.box.add(img);
    }
  }

  // Pose un membre : son extrémité « prox » sur le point (x, y), orienté selon l'angle a.
  private bone(n: string, x: number, y: number, a: number) {
    const img = this.parts[n],
      p = this.rig[this.view as string][n];
    if (!img || !p.prox) return;
    img
      .setOrigin(p.prox[0] / p.w, p.prox[1] / p.h)
      .setPosition(x, y)
      .setRotation(a - ang0(p));
  }
  // Pose une pièce rigide (tronc, tête) par un point d'ancrage (fractions de la pièce).
  private place(n: string, ox: number, oy: number, x: number, y: number, rot = 0) {
    const img = this.parts[n];
    if (img) img.setOrigin(ox, oy).setPosition(x, y).setRotation(rot);
  }

  draw(p: Pose) {
    if (p.view !== this.view) this.build(p.view);
    const R = this.rig[p.view],
      face = p.view === 'face';
    // longueurs des os
    const legL = len(R['jambe-d']) * 0.92,
      thighL = len(R['cuisse-d']) * 0.82,
      armL = len(R['bras-d']) * (face ? 0.85 : 0.95),
      foreL = face ? len(R['avant-bras-d']) * 0.8 : 0;
    const torso = R[face ? 'buste' : 'buste-ceinture'],
      pelvis = R['bassin'],
      head = R['tete'];

    // squelette au repos
    const st = p.state,
      t = p.time,
      ph = (p.walk / 52) * Math.PI * 2,
      walking = p.moving && (st === 'idle' || st === 'frozen');
    let crouch = 0,
      lean = 0;
    if (st === 'charge') crouch = 4 + 8 * p.charge;
    if (st === 'dodge') crouch = 8;
    if (p.strike && p.strike.phase === 'su') crouch = 3;
    if (st === 'stun' || st === 'recover') crouch = 4;
    const bob = walking ? -Math.abs(Math.sin(ph)) * 3 : Math.sin(t * 0.004) * 0.8;
    const footY = 0,
      hipY = -(legL + thighL) * 0.97 + crouch + bob,
      hipX = pelvis.w * 0.2,
      waistY = hipY - 9,
      hemY = hipY + (face ? 6 : -4),
      topY = hemY - torso.h * (face ? 1 : 0.86),
      shY = topY + torso.h * (face ? 0.24 : 0.12),
      shX = torso.w * (face ? 0.3 : 0.4),
      neckY = topY + (face ? 8 : 6);
    this.bodyH = -(neckY - head.h * HEAD * 0.95) + 2;

    // cibles des pieds : écartés en garde, levés tour à tour en marchant
    const stance = 13;
    let fL = { x: -stance, y: footY },
      fR = { x: stance, y: footY };
    if (walking) {
      fL = { x: -stance + Math.sin(ph) * 3, y: footY - Math.max(0, Math.sin(ph)) * 9 };
      fR = { x: stance - Math.sin(ph) * 3, y: footY - Math.max(0, -Math.sin(ph)) * 9 };
    }
    // coup de pied : la jambe d'attaque part dans la direction du coup
    const s = p.strike,
      dx = p.dirX,
      dy = p.dirY * 0.55,
      dl = Math.hypot(dx, dy) || 1,
      ux = dx / dl,
      uy = dy / dl;
    const kickRight = s && s.kick ? (s.side > 0 ? dx >= 0 : dx < 0) : false;
    if (s && s.kick) {
      const reach = (legL + thighL) * (0.35 + 0.6 * s.ext),
        hx = kickRight ? hipX : -hipX;
      const tgt = { x: hx + ux * reach, y: hipY + 4 + uy * reach - reach * 0.25 };
      if (kickRight) fR = tgt;
      else fL = tgt;
      lean = -ux * 0.12 * s.ext;
    }
    if (st === 'dodge') lean = (dx >= 0 ? -1 : 1) * 0.3;

    // cibles des poings : garde (poings devant la poitrine), puis selon l'état
    const lead = dx >= 0 ? 1 : -1; // côté de l'écran vers lequel il regarde
    // de dos, les poings sont cachés par le corps : les bras restent écartés pour qu'on les voie
    let hL = face ? { x: -shX * 0.55, y: shY + 12 } : { x: -shX * 1.5, y: shY + 22 },
      hR = face ? { x: shX * 0.55, y: shY + 12 } : { x: shX * 1.5, y: shY + 22 };
    if (walking) {
      hL.y += Math.sin(ph) * 2;
      hR.y -= Math.sin(ph) * 2;
    }
    if (s && !s.kick) {
      const reach = (armL + foreL) * (0.3 + 0.7 * s.ext),
        right = s.side > 0 ? lead > 0 : lead < 0,
        sx = right ? shX : -shX;
      const tgt = { x: sx + ux * reach, y: shY + 4 + uy * reach };
      if (right) hR = tgt;
      else hL = tgt;
    } else if (st === 'charge') {
      hL = { x: -lead * 6 - 10, y: shY + 16 };
      hR = { x: -lead * 6 + 10, y: shY + 14 };
    } else if (st === 'parry') {
      hL = { x: 7, y: shY + 8 };
      hR = { x: -7, y: shY + 6 };
    } else if (st === 'stun' || st === 'recover' || st === 'tumble') {
      hL = { x: -shX - 8, y: shY - 10 + Math.sin(t * 0.03) * 5 };
      hR = { x: shX + 8, y: shY - 10 - Math.sin(t * 0.03) * 5 };
    } else if (st === 'falling' || st === 'ledge' || st === 'climb') {
      hL = { x: -shX * 0.7, y: shY - 34 };
      hR = { x: shX * 0.7, y: shY - 34 };
    }

    // tronc et tête
    const headKey =
      st === 'charge' || (s && s.phase === 'ac')
        ? 'tete-cri'
        : st === 'stun' || st === 'recover' || st === 'tumble' || st === 'falling'
          ? 'tete-touche'
          : 'tete';
    this.place('bassin', 0.5, 0.06, 0, waistY);
    this.place(face ? 'buste' : 'buste-ceinture', 0.5, face ? 1 : 0.86, 0, hemY, lean * 0.3);
    if (face) this.place('ceinture', 0.5, 0.22, 0, hemY - torso.h * 0.2);
    const hd = this.parts['tete'];
    if (hd && face) hd.setTexture(`pp:${this.id}:face:${R[headKey] ? headKey : 'tete'}`);
    this.place('tete', 0.5, 0.95, lean * 20, neckY + (st === 'charge' ? 2 : 0), lean * 0.5);
    this.parts['tete']?.setScale(HEAD);

    // jambes : hanche -> genou -> pied, genou vers l'extérieur
    for (const [side, f] of [
      [-1, fL],
      [1, fR],
    ] as [number, { x: number; y: number }][]) {
      const c = face ? (side < 0 ? 'd' : 'g') : side < 0 ? 'g' : 'd';
      const k = ik2(side * hipX, hipY, f.x, f.y, thighL, legL, side);
      this.bone('cuisse-' + c, side * hipX, hipY, k.a1);
      // le mollet démarre un peu avant le genou : les pièces se chevauchent, pas de trou à l'articulation
      this.bone('jambe-' + c, k.ex - Math.cos(k.a1) * JOINT, k.ey - Math.sin(k.a1) * JOINT, k.a2);
    }
    // bras : épaule -> coude -> poing (de dos, le bras est d'une pièce : il pointe vers la cible)
    for (const [side, h] of [
      [-1, hL],
      [1, hR],
    ] as [number, { x: number; y: number }][]) {
      const c = face ? (side < 0 ? 'd' : 'g') : side < 0 ? 'g' : 'd';
      const sx = side * shX + lean * 10;
      if (face) {
        const k = ik2(sx, shY, h.x, h.y, armL, foreL, 0);
        this.bone('bras-' + c, sx, shY, k.a1);
        this.bone('avant-bras-' + c, k.ex - Math.cos(k.a1) * JOINT, k.ey - Math.sin(k.a1) * JOINT, k.a2);
        this.fist[side < 0 ? 'L' : 'R'] = { x: k.fx, y: k.fy };
      } else {
        const a = Math.atan2(h.y - shY, h.x - sx);
        this.bone('bras-' + c, sx, shY, a);
        this.fist[side < 0 ? 'L' : 'R'] = { x: sx + Math.cos(a) * armL, y: shY + Math.sin(a) * armL };
      }
    }
    // ceinture à la couleur du rang (pièce grise, teinte multipliée)
    const belt = this.parts['ceinture'];
    if (belt) belt.setTint(p.belt);
  }

  // Place le pantin (pieds en x, y), à l'échelle du monde ; renvoie de quoi poser l'arme dans la main.
  show(x: number, y: number, scale: number, sx: number, sy: number, rot: number, alpha: number, depth: number) {
    const k = (HEIGHT / this.bodyH) * scale;
    this.box
      .setVisible(true)
      .setPosition(x, y)
      .setScale(k * sx, k * sy)
      .setRotation(rot)
      .setAlpha(alpha)
      .setDepth(depth);
  }
  // Poing (gauche ou droite de l'écran) en coordonnées du monde.
  fistWorld(right: boolean) {
    const f = right ? this.fist.R : this.fist.L,
      b = this.box,
      c = Math.cos(b.rotation),
      s = Math.sin(b.rotation),
      x = f.x * b.scaleX,
      y = f.y * b.scaleY;
    return { x: b.x + x * c - y * s, y: b.y + x * s + y * c };
  }
  tint(mode: 'none' | 'flash' | number) {
    for (const [n, img] of Object.entries(this.parts)) {
      if (mode === 'flash') img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else {
        img.setTintMode(Phaser.TintModes.MULTIPLY);
        if (n === 'ceinture') continue; // garde la couleur du rang
        if (mode === 'none') img.clearTint();
        else img.setTint(mode);
      }
    }
  }
}
