// Combattants : sprites du pack Ninja Adventure, arme qui suit le coup, signaux au sol (charge, parade, élan, qi),
// annonce du coup chargé, traînées de coup et bulles d'emote.
import Phaser from 'phaser';
import {
  RAD,
  R,
  CHARGE_FULL,
  CHARGE_START,
  PARRY_PERFECT,
  PERSOS,
  PERSO_COUNT,
  ARMES,
  TRAINEES,
  EMOTES,
  beltOf,
} from '../../sim/data';
import { clamp, lerp, easeOut, angDiff } from '../../sim/sim';
import { PX } from '../assets';
import { iso, worldAngleToScreen, fillC, strokeC, cone } from './iso';
import { C, FONT_BODY, hex, mix } from './palette';
import type { Renderer } from './index';

interface View {
  spr: Phaser.GameObjects.Sprite;
  wpn: Phaser.GameObjects.Image;
  px: number;
  py: number;
  walk: number;
  spd: number;
  flash: number;
  squash: number;
  prevState: string;
  prevPhase: string;
  prevDrop: number;
  ghostT: number;
  full: boolean;
  partT: number;
}

export class Fighters {
  views: View[] = [];
  emos: Phaser.GameObjects.Text[] = [];

  constructor(private r: Renderer) {}

  // Impact reçu : le sprite flashe en blanc et s'écrase un instant.
  flash(i: number) {
    const v = this.views[i];
    if (v) {
      v.flash = 110;
      v.squash = 1;
    }
  }

  view(i: number): View {
    let v = this.views[i];
    if (!v) {
      const scene = this.r.scene;
      const spr = scene.add.sprite(0, 0, 'persos', 0).setScale(PX).setDepth(2.5);
      const wpn = scene.add
        .image(0, 0, 'armes', 0)
        .setOrigin(2 / 16, 0.5)
        .setScale(PX)
        .setDepth(2.5);
      v = this.views[i] = {
        spr,
        wpn,
        px: 0,
        py: 0,
        walk: 0,
        spd: 0,
        flash: 0,
        squash: 0,
        prevState: '',
        prevPhase: '',
        prevDrop: 0,
        ghostT: 0,
        full: false,
        partT: 0,
      };
    }
    return v;
  }
  hideViews(from: number) {
    for (let i = from; i < this.views.length; i++) {
      this.views[i].spr.setVisible(false);
      this.views[i].wpn.setVisible(false);
    }
  }

  // Position du poing ou du pied pendant un coup (repère local du combattant) et phase du coup.
  strike(e: any) {
    const a = e.atk,
      d = a.def,
      hits = d.hits || 1,
      reach = d.rg - 6,
      kick = d.limb !== 'poing';
    const lead = a.startStance & 1 ? 1 : -1,
      useRear = d.tf === 'mirror' || d.tf === 'diag';
    let side = useRear ? -lead : lead;
    const rest = kick ? { x: useRear ? -9 : 11, y: side * 8 } : { x: 16, y: side * 6 };
    let P: { x: number; y: number }, phase: string;
    const t = a.t;
    if (t < a.su) {
      const p = t / a.su;
      phase = 'su';
      P = { x: rest.x - 8 * p, y: rest.y + side * 6 * p };
    } else if (t < a.su + a.ac) {
      phase = 'ac';
      const seg = a.ac / hits,
        k = Math.min(hits - 1, Math.floor((t - a.su) / seg)),
        p = (t - a.su - k * seg) / seg;
      if (k % 2 === 1) side = -side;
      if (d.sweep) {
        const span = d.arc >= 360 ? Math.PI * 2 : d.arc * RAD;
        const an = side * (span / 2) * (1 - 2 * p);
        P = { x: Math.cos(an) * reach, y: Math.sin(an) * reach };
      } else {
        const q = Math.min(1, p * 2.2);
        P = { x: lerp(10, reach, easeOut(q)), y: side * 6 * (1 - q) };
      }
    } else {
      phase = 'rc';
      const p = clamp((t - a.su - a.ac) / a.rc, 0, 1);
      P = { x: lerp(reach * 0.9, rest.x, easeOut(p)), y: lerp(0, rest.y, p) };
    }
    return { P, side, kick, phase, useRear };
  }

  // Annonce au sol du coup chargé (pendant la charge, puis pendant le coup). Les coups blancs ne sont pas annoncés.
  drawTelegraph(g: Phaser.GameObjects.Graphics, e: any) {
    if (e.state === 'charge' && e.chargeDef) {
      const d = e.chargeDef,
        p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1),
        col = e.qi >= 100 ? C.gold : C.red;
      g.fillStyle(col, 0.1 + 0.16 * p);
      g.lineStyle(2, col, 0.35 + 0.3 * p);
      if (d.arc >= 360) {
        const r = d.rg + d.lunge * 0.4;
        fillC(g, e.x, e.y, r);
        strokeC(g, e.x, e.y, r);
      } else cone(g, e.x, e.y, e.facing, d.rg + d.lunge, Math.max(d.arc, 24) * RAD);
      return;
    }
    if (e.state !== 'attack' || !e.atk) return;
    const a = e.atk,
      d = a.def;
    if (a.t >= a.su + a.ac) return;
    if (a.kind !== 'red') return; // pas de cône pâle pour les petits coups : il brouille le combat. Seul le coup chargé est annoncé.
    const act = a.t >= a.su,
      col = a.dragon ? C.gold : C.red;
    const rr = d.rg + 10 + (!act ? d.lunge * (1 - a.t / a.su) * 0.8 : 0);
    g.fillStyle(col, act ? 0.42 : 0.22 + (0.14 * a.t) / a.su);
    g.lineStyle(3, col, act ? 0.9 : 0.45);
    if (d.arc >= 360) {
      fillC(g, e.x, e.y, rr);
      strokeC(g, e.x, e.y, rr);
    } else cone(g, e.x, e.y, e.facing, rr, Math.max(d.arc, 24) * RAD);
  }

  // Coup entrant : éclat en étoile (façon animé) devant la tête de l'attaquant, dès la première image du coup,
  // seulement si le coup peut toucher la cible (à portée en comptant l'élan, et dans l'angle). Le démarrage d'un
  // coup blanc dure 150 à 240 ms, à peine le temps de réagir : l'éclat doit être immédiat et sans ambiguïté.
  drawWarning(g: Phaser.GameObjects.Graphics, e: any, target: any, time: number) {
    const a = e.atk;
    if (e.state !== 'attack' || !a || !a.def || !target || target === e) return;
    if (target.state === 'dead' || target.state === 'falling') return;
    const d = a.def,
      end = a.su + a.ac * 0.5;
    if (a.t >= end) return;
    const dx = target.x - e.x,
      dy = target.y - e.y,
      dist = Math.hypot(dx, dy);
    if (dist > d.rg + d.lunge + R * 0.7 + 12) return;
    if (
      d.arc < 360 &&
      Math.abs(angDiff(e.facing, Math.atan2(dy, dx))) > (d.arc * RAD) / 2 + Math.atan2(R, Math.max(dist, 1)) + 0.25
    )
      return;
    // apparition en 50 ms, puis l'éclat tient jusqu'au coup et s'éteint pendant la frappe
    const grow = easeOut(clamp(a.t / 50, 0, 1)),
      fade = a.t > a.su ? 1 - (a.t - a.su) / (end - a.su) : 1,
      k = grow * clamp(fade, 0, 1);
    if (k <= 0) return;
    const red = a.kind === 'red',
      col = red ? (a.dragon ? C.gold : C.red) : 0xffffff,
      f = e.facing,
      p = iso(e.x + Math.cos(f) * 4, e.y + Math.sin(f) * 4, 50),
      L = (red ? 21 : 18) * (0.6 + 0.4 * k) * (1 + 0.08 * Math.sin(time * 0.05)),
      rot = time * 0.004;
    const star = (len: number) => {
      const pts: any[] = [];
      for (let i = 0; i < 8; i++) {
        const an = rot + (i * Math.PI) / 4,
          r = i % 2 ? len * 0.28 : len;
        pts.push({ x: p.x + Math.cos(an) * r, y: p.y + Math.sin(an) * r });
      }
      return pts;
    };
    g.fillStyle(col, 0.22 * k);
    g.fillCircle(p.x, p.y, L * 0.9);
    g.lineStyle(3, 0x0f1719, 0.75 * k);
    g.strokePoints(star(L), true);
    g.fillStyle(col, k);
    g.fillPoints(star(L), true);
    g.fillStyle(0xffffff, k);
    g.fillCircle(p.x, p.y, 2.5);
  }

  // Traînée de coup : au premier plan (au-dessus des personnages), en transparence.
  drawTrail(g: Phaser.GameObjects.Graphics, pts: any[], id: string, time: number) {
    if (pts.length < 2) return;
    const tr = TRAINEES[id] || TRAINEES.aucune,
      col = hex(tr.col),
      plain = id === 'aucune';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i],
        age = clamp((time - b.t) / 160, 0, 1),
        k = 1 - age;
      if (b.red) {
        g.lineStyle(12 * k + 2, b.gold ? C.gold : C.red, 0.45 * k);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      g.lineStyle((plain ? 5 : 8) * k + 1, col, (plain ? 0.5 : 0.62) * k);
      g.lineBetween(a.x, a.y, b.x, b.y);
      if (!plain) {
        g.lineStyle(2 * k + 0.5, 0xffffff, 0.45 * k);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  draw(g: Phaser.GameObjects.Graphics, e: any, i: number, time: number, dt: number, myIdx: number, twin: boolean) {
    const fx = this.r.fx;
    const v = this.view(i),
      spr = v.spr,
      wpn = v.wpn,
      st = e.state;
    // vitesse mesurée dans le monde, pour l'animation de marche
    const moved = Math.hypot(e.x - v.px, e.y - v.py);
    v.px = e.x;
    v.py = e.y;
    if (moved < 60) {
      v.walk += moved;
      v.spd += ((dt > 0 ? moved / dt : 0) - v.spd) * Math.min(1, dt * 12);
    }
    v.flash = Math.max(0, v.flash - dt * 1000);
    v.squash = Math.max(0, v.squash - dt * 6);
    if (st === 'dead') {
      spr.setVisible(false);
      wpn.setVisible(false);
      v.prevState = st;
      v.prevPhase = '';
      v.prevDrop = 0;
      return;
    }

    let scale = 1,
      rot = 0,
      ga = 1;
    if (st === 'falling') {
      const p = clamp(e.fallT / 560, 0, 1);
      scale = 1 - 0.5 * p;
      rot = p * 5;
      ga = 1 - 0.35 * p;
    }
    if (e.spawnInv > 0 && st !== 'climb' && st !== 'falling' && !(e.dropT > 0))
      ga *= 0.55 + 0.3 * Math.sin(time * 0.02);
    const dp = e.dropT > 0 ? e.dropT / 500 : 0;
    if (dp) {
      scale *= 1 + dp * 1.2;
      ga *= 1 - dp * 0.45;
    }

    // sol : ombre, anneau du joueur ou couleur de ceinture de l'adversaire (posés à plat sur le dojo)
    const G = iso(e.x, e.y);
    if (st !== 'falling' && st !== 'ledge') {
      g.fillStyle(0x1e180c, 0.34 * ga);
      g.fillEllipse(G.x, G.y + 2, 32 * (1 - dp * 0.5), 14 * (1 - dp * 0.5));
      const ringCol = i === myIdx ? C.ochre : hex(e.belt || beltOf(e.kos)[2]);
      g.lineStyle(2, ringCol, (i === myIdx ? 0.9 : 0.65) * ga);
      g.strokeEllipse(G.x, G.y + 2, 44, 21);
    }
    if (st === 'charge') {
      const p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1),
        pulse = 0.5 + 0.5 * Math.sin(time * 0.035),
        gold = e.qi >= 100,
        r = 26 + 10 * p + pulse * 3,
        col = gold ? C.gold : C.red;
      g.fillStyle(col, (0.14 + 0.22 * p) * ga);
      fillC(g, e.x, e.y, r);
      g.lineStyle(2 + 2 * p, col, ga);
      strokeC(g, e.x, e.y, r);
      if (p >= 1) {
        g.lineStyle(1.5, 0xffffff, 0.7 * ga);
        strokeC(g, e.x, e.y, r + 5);
      }
      if (p >= 1 && !v.full) {
        v.full = true;
        fx.fxw('sparkle', e.x, e.y, 20, 0, 2.2, gold ? C.gold : 0xff6a50);
      }
    } else v.full = false;
    if (e.elanT > 0) {
      g.lineStyle(2, C.jade, ga * (0.4 + 0.4 * Math.sin(time * 0.02)));
      strokeC(g, e.x, e.y, 25);
    }
    if (e.qi >= 100 && st !== 'charge') {
      g.lineStyle(2, C.gold, ga * (0.35 + 0.25 * Math.sin(time * 0.012)));
      strokeC(g, e.x, e.y, 28);
    }
    if (st === 'parry') {
      const perf = e.stateT <= PARRY_PERFECT;
      g.fillStyle(C.bone, 0.12 * ga);
      fillC(g, e.x, e.y, 30);
      g.lineStyle(perf ? 4 : 3, perf ? C.gold : C.bone, (perf ? 1 : 0.85) * ga);
      strokeC(g, e.x, e.y, 30);
    }

    // image du personnage : colonne = direction à l'écran, ligne = posture
    const P = PERSOS[e.look.perso] || PERSOS['ninja-bleu'];
    const sa = worldAngleToScreen(e.facing),
      c = Math.cos(sa),
      sn = Math.sin(sa);
    // 4 directions du pack : la colonne suit l'angle à l'écran
    let col = Math.abs(c) >= Math.abs(sn) * 0.85 ? (c > 0 ? 3 : 2) : sn > 0 ? 0 : 1,
      row = 0;
    let sx = 1,
      sy = 1;
    const S = st === 'attack' && e.atk && e.atk.def ? this.strike(e) : null;
    const moving = v.spd > 40;
    switch (st) {
      case 'idle':
      case 'frozen':
        row = moving ? Math.floor(v.walk / 13) % 4 : 0;
        break;
      case 'attack':
        if (!S || S.phase === 'su') {
          row = 0;
          const p = S ? clamp(e.atk.t / e.atk.su, 0, 1) : 0;
          sx = 1 + 0.08 * p;
          sy = 1 - 0.07 * p;
        } else if (S.phase === 'ac') {
          row = 4;
          sx = 0.94;
          sy = 1.07;
        } else row = clamp((e.atk.t - e.atk.su - e.atk.ac) / e.atk.rc, 0, 1) < 0.5 ? 4 : 0;
        break;
      case 'charge':
        row = 5;
        {
          const p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1);
          sx = 1 + 0.06 * p;
          sy = 1 - 0.08 * p;
        }
        break;
      case 'parry':
        row = 6;
        col = 1;
        break;
      case 'dodge':
        row = 5;
        break;
      case 'stun':
      case 'recover':
      case 'tumble':
        row = 6;
        col = 0;
        break;
      case 'falling':
      case 'ledge':
      case 'climb':
        row = 5;
        break;
    }
    const em = e.emote && e.emote.id;
    if (em === 'salut' && e.emote.t < 900 && st === 'idle') {
      row = 6;
      col = 0;
    }
    sx *= 1 + 0.22 * v.squash;
    sy *= 1 - 0.18 * v.squash;
    if (st === 'tumble') rot += e.stateT * 0.022;
    if (st === 'stun' || st === 'recover') rot += Math.sin(e.stateT * 0.03) * 0.16;
    const jit = st === 'charge' && v.full ? Math.sin(time * 0.09) * 1.2 : 0;
    const depth = 2.5 + (G.y + 4000) * 1e-5;
    spr
      .setVisible(true)
      .setFrame(row * PERSO_COUNT * 4 + P.idx * 4 + col)
      .setPosition(G.x + jit, G.y - 18)
      .setScale(PX * scale * sx, PX * scale * sy)
      .setRotation(rot)
      .setAlpha(ga)
      .setDepth(depth);
    if (v.flash > 0) spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else {
      spr.setTintMode(Phaser.TintModes.MULTIPLY);
      if (st === 'charge') {
        const k = 0.35 + 0.35 * Math.sin(time * 0.035);
        spr.setTint(mix(0xffffff, e.qi >= 100 ? 0xffd25a : 0xff5a46, k));
      } else if (twin)
        spr.setTint(0xffa890); // même personnage des deux côtés : le second est teinté
      else spr.clearTint();
    }

    // arme : suit le coup (estoc ou balayage), se pose sur le côté au repos. Calcul dans le monde, puis projection.
    const W = ARMES[e.look.arme] || ARMES.katana,
      WS = PX * 0.82,
      L = W.len * WS;
    const s0 = S ? e.atk.startStance : e.stance,
      side = s0 & 1 ? 1 : -1;
    const f = e.facing,
      cf = Math.cos(f),
      sf = Math.sin(f);
    const toW = (lx: number, ly: number) => ({ x: e.x + cf * lx - sf * ly, y: e.y + sf * lx + cf * ly });
    let hand: { x: number; y: number } | null = null,
      wang = f,
      tip: { x: number; y: number } | null = null;
    if (S) {
      const la = Math.atan2(S.P.y, S.P.x),
        pl = Math.hypot(S.P.x, S.P.y);
      if (W.idx >= 0) {
        const d = Math.max(6, pl - L * 0.85);
        hand = toW(Math.cos(la) * d, Math.sin(la) * d);
        wang = f + la;
        tip = { x: hand.x + Math.cos(wang) * L, y: hand.y + Math.sin(wang) * L };
      } else tip = toW(S.P.x, S.P.y);
    } else if (st === 'parry') {
      hand = toW(13, side * L * 0.45);
      wang = f - (side * Math.PI) / 2;
    } else if (st === 'charge') {
      hand = toW(-4, side * 11);
      wang = f + Math.PI - side * 0.55 + jit * 0.02;
    } else if (st === 'stun' || st === 'recover' || st === 'tumble' || st === 'falling') {
      hand = toW(4, side * 12);
      wang = f + side * 1.2 + Math.sin(e.stateT * 0.03) * 0.4 + rot;
    } else if (st !== 'ledge' && st !== 'climb') {
      hand = toW(3, side * 19);
      wang = f + side * 0.3;
    }
    if (W.idx >= 0 && hand) {
      const hs = iso(hand.x, hand.y, 14),
        wsa = worldAngleToScreen(wang),
        behind = !S && hs.y + 14 < G.y - 2;
      wpn
        .setVisible(true)
        .setFrame(W.idx)
        .setPosition(hs.x, hs.y)
        .setRotation(wsa)
        .setFlipY(Math.cos(wsa) < 0)
        .setScale(WS * scale)
        .setAlpha(ga)
        .setDepth(depth + (behind ? -1e-6 : 1e-6));
      if (v.flash > 0) wpn.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else wpn.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    } else wpn.setVisible(false);

    // traînée au bout de l'arme (points en coordonnées écran) et effets de coup
    if (S && S.phase === 'ac' && tip) {
      const T = iso(tip.x, tip.y, 14);
      (e.trail ||= []).push({ x: T.x, y: T.y, t: time, red: e.atk.kind === 'red', gold: e.atk.dragon });
      v.partT -= dt * 1000;
      if (v.partT <= 0) {
        v.partT = 26;
        fx.trailPart(e.look.trainee, T.x, T.y, worldAngleToScreen(wang));
      }
    }
    const phase = S ? S.phase : '';
    if (phase === 'ac' && v.prevPhase !== 'ac') {
      const d = e.atk.def,
        red = e.atk.kind === 'red',
        drag = e.atk.dragon,
        tint = red && !drag ? 0xff5040 : undefined;
      if (d.sweep && d.arc >= 300)
        fx.fxw('spin', e.x, e.y, 6, 0, ((d.rg * 2 + 16) / 32) * 1.1, tint, red ? 0.85 : 0.65, 0.5);
      else if (d.sweep)
        fx.fxw(
          'slash',
          e.x + cf * d.rg * 0.55,
          e.y + sf * d.rg * 0.55,
          12,
          sa,
          (d.rg / 32) * 1.3,
          tint,
          red ? 0.85 : 0.65,
        );
      else
        fx.fxw(
          drag ? 'fireslash' : 'arc',
          e.x + cf * d.rg * 0.72,
          e.y + sf * d.rg * 0.72,
          12,
          sa,
          red ? 2.1 : 1.4,
          tint,
          red ? 0.85 : 0.6,
        );
    }
    v.prevPhase = phase;
    if (st === 'dodge') {
      if (v.prevState !== 'dodge') fx.fx('smoke', G.x, G.y - 4, 0, 1.5, undefined, 0.75);
      v.ghostT -= dt * 1000;
      if (v.ghostT <= 0) {
        v.ghostT = 40;
        fx.ghost(spr, depth - 1e-5, C.jade);
      }
    }
    if (st === 'ledge' && v.prevState !== 'ledge') fx.fx('dust', G.x, G.y, 0, 1.6);
    if (v.prevDrop > 0 && !(e.dropT > 0)) fx.fx('dust', G.x, G.y, 0, 2.2);
    v.prevDrop = e.dropT || 0;
    v.prevState = st;
  }

  /* ---------- bulles d'emote au-dessus des combattants ---------- */
  hideEmotes(from: number) {
    for (let i = from; i < this.emos.length; i++) this.emos[i].setVisible(false);
  }
  drawEmotes(st: any) {
    while (this.emos.length < st.f.length)
      this.emos.push(
        this.r.scene.add
          .text(0, 0, '', {
            fontFamily: FONT_BODY,
            fontStyle: '700',
            fontSize: '12px',
            color: '#0f1719',
            backgroundColor: '#fffaec',
            padding: { x: 7, y: 3 },
            resolution: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(7)
          .setVisible(false),
      );
    st.f.forEach((e: any, i: number) => {
      const emo = this.emos[i],
        G = iso(e.x, e.y);
      if (e.emote && e.state !== 'dead' && EMOTES[e.emote.id]) {
        const t = e.emote.t,
          al = t < 150 ? t / 150 : t > 1500 ? 1 - (t - 1500) / 300 : 1;
        emo
          .setVisible(true)
          .setText(EMOTES[e.emote.id])
          .setPosition(G.x, G.y - 52)
          .setAlpha(clamp(al, 0, 1));
      } else emo.setVisible(false);
    });
    this.hideEmotes(st.f.length);
  }
}
