// Vie du lac autour du dojo : poissons, objets flottants, ronds dans l'eau, reflets et particules d'ambiance.
import Phaser from 'phaser';
import { TAU } from '../../sim/data';
import { clamp, angDiff } from '../../sim/sim';
import { ISO, iso, unIso } from './iso';
import { hex, mix, rand } from './palette';
import { THEMES, LIFE } from './themes';
import type { Renderer } from './index';

interface Fish {
  x: number;
  y: number;
  h: number;
  tx: number;
  ty: number;
  sp: number;
  boost: number;
  ph: number;
  phase: number;
  turn: number;
  prevAng: number;
  len: number;
  rip: number;
  kind: string;
  rope: Phaser.GameObjects.Rope;
}
interface Floater {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  rot: number;
  vr: number;
  spr: Phaser.GameObjects.Image;
  kind: string;
}
interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  sz: number;
}

export class Lake {
  fish: Fish[] = [];
  floaters: Floater[] = [];
  motes: Mote[] = [];
  ripples: { x: number; y: number; t: number; life: number }[] = [];
  life = LIFE.brume;
  rippleT = 0;

  constructor(private r: Renderer) {}

  // Point d'eau visible : devant l'horizon, dans le lac.
  lakePoint(near?: { x: number; y: number }): { x: number; y: number } {
    if (this.r.world.active) return this.r.world.pondPoint(this.r.H, Math.random, near); // monde : n'importe où dans l'étang
    // toujours à l'extérieur du dojo ; si `near` est donné, un point proche de lui sur le pourtour, pour que les poissons contournent le dojo
    const R0 = 284; // demi-côté du dojo avec son cadre (taille de départ)
    for (let i = 0; i < 14; i++) {
      const a = near ? Math.atan2(near.y, near.x) + rand(-1, 1) : rand(0, TAU),
        ca = Math.cos(a),
        sa = Math.sin(a);
      const r = (R0 + 70) / Math.max(Math.abs(ca), Math.abs(sa)) + rand(10, 200),
        x = ca * r,
        y = sa * r;
      if (x + y > -380 && Math.hypot(x, y) < 900) return { x, y };
    }
    return { x: 420, y: 300 };
  }
  build(name: string) {
    const L = LIFE[name] || LIFE.brume,
      scene = this.r.scene;
    this.life = L;
    for (const f of this.fish) f.rope.destroy();
    for (const f of this.floaters) f.spr.destroy();
    this.fish = [];
    this.floaters = [];
    this.motes = [];
    const water = hex(THEMES[name].water);
    for (let i = 0; i < L.nFish; i++) {
      const p = this.lakePoint(),
        q = this.lakePoint(),
        kind = L.fish[i % L.fish.length],
        len = rand(46, 62);
      // un seul poisson déformé en tranches : l'onde de nage le parcourt de la tête à la queue
      const rope = (scene.add as any)
        .rope(0, 0, 'fish-' + kind, undefined, 12)
        .setDepth(0.5) as Phaser.GameObjects.Rope;
      const glow = kind === 'lanterne' || kind === 'braise';
      if (glow) rope.setBlendMode(Phaser.BlendModes.ADD);
      else rope.setColors(mix(0xffffff, water, 0.45)); // le poisson se fond dans l'eau
      rope.setAlpha(L.fishA ?? (glow ? 0.75 : 0.62)).setScale(len / 276);
      this.fish.push({
        x: p.x,
        y: p.y,
        h: rand(0, TAU),
        tx: q.x,
        ty: q.y,
        sp: rand(18, 30),
        boost: 0,
        ph: rand(0, TAU),
        phase: rand(0, TAU),
        turn: 0,
        prevAng: 0,
        len,
        rip: rand(2, 8),
        kind,
        rope,
      });
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand(-0.3, 0.3),
        r = rand(this.r.H + 150, 620),
        q = this.r.world.active ? this.lakePoint() : { x: Math.cos(a) * r, y: Math.sin(a) * r },
        x = q.x,
        y = q.y;
      if (!L.floats.length || (x + y < -300 && !this.r.world.active) || !this.r.world.inPond(x, y, 70)) continue;
      const kind = L.floats[i % L.floats.length],
        big = kind === 'glace' || kind === 'lave';
      // « monde/nom » : image découpée dans une planche, gardée à sa taille ; sinon objet vectoriel
      const spr = kind.includes('/')
        ? scene.add
            .image(0, 0, 'm:' + kind)
            .setScale(rand(1, 1.3))
            .setDepth(0.6)
        : scene.add
            .image(0, 0, 'fl-' + kind)
            .setDisplaySize(big ? 84 : 76, big ? 56 : 51)
            .setDepth(0.6);
      this.floaters.push({
        x,
        y,
        vx: 0,
        vy: 0,
        ph: rand(0, TAU),
        rot: rand(-0.3, 0.3),
        vr: rand(-0.04, 0.04),
        spr,
        kind,
      });
    }
    for (let i = 0; i < 44; i++)
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        vx: rand(-0.02, 0.02),
        vy: rand(0.02, 0.07),
        ph: rand(0, TAU),
        sz: 1 + ((Math.random() * 2) | 0),
      });
  }
  // Un plouf ou un gros coup : poissons et feuilles s'écartent.
  scare(x: number, y: number, rad: number, power: number) {
    for (const f of this.fish) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d > rad) continue;
      const away = Math.atan2(f.y - y, f.x - x),
        k = 1 - d / rad;
      f.boost = Math.max(f.boost, power * k);
      f.tx = f.x + Math.cos(away) * 380;
      f.ty = f.y + Math.sin(away) * 380;
      if (f.tx + f.ty < -380) {
        const q = this.lakePoint();
        f.tx = q.x;
        f.ty = q.y;
      }
    }
    for (const o of this.floaters) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d > rad) continue;
      const away = Math.atan2(o.y - y, o.x - x),
        k = 1 - d / rad;
      o.vx += Math.cos(away) * power * 0.5 * k;
      o.vy += Math.sin(away) * power * 0.5 * k;
      o.vr += rand(-0.2, 0.2) * k;
    }
  }

  /* ---------- image par image ---------- */
  update(dt: number, time: number, view: Phaser.Geom.Rectangle) {
    const ms = dt * 1000;
    this.updLife(dt, time);
    // ronds dans l'eau, au hasard dans la partie visible du lac
    this.rippleT -= ms;
    if (this.rippleT <= 0) {
      this.rippleT = 260;
      const x = rand(view.x, view.right),
        y = rand(view.y, view.bottom);
      const w = unIso(x, y);
      if (
        y > this.r.bg.y - 100 &&
        this.r.world.inPond(w.x, w.y, 40) &&
        (Math.abs(w.x) > this.r.H + 40 || Math.abs(w.y) > this.r.H + 40)
      )
        this.ripples.push({ x, y, t: 0, life: 2400 });
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += ms;
      if (r.t > r.life) this.ripples.splice(i, 1);
    }
  }
  updLife(dt: number, time: number) {
    const horizon = this.r.bg.y - 96;
    for (const f of this.fish) {
      f.boost *= Math.exp(-1.3 * dt);
      const dx = f.tx - f.x,
        dy = f.ty - f.y,
        d = Math.hypot(dx, dy);
      if (d < 60 || f.x + f.y < -420) {
        const q = this.lakePoint(f);
        f.tx = q.x;
        f.ty = q.y;
      }
      // virages larges et lents ; un coup de queue pousse, puis le poisson glisse
      const want = Math.atan2(dy, dx),
        turn = 0.7 + f.boost * 0.012;
      f.h += clamp(angDiff(f.h, want), -turn * dt, turn * dt);
      const base = f.sp * (0.8 + 0.3 * Math.sin(f.phase - 0.6)) + f.boost;
      f.phase += dt * (3.4 + base * 0.1);
      const vx = Math.cos(f.h),
        vy = Math.sin(f.h);
      f.x += vx * base * dt;
      f.y += vy * base * dt;
      const S = iso(f.x, f.y),
        sx = (vx - vy) * ISO,
        sy = (vx + vy) * ISO * 0.5,
        ang = Math.atan2(sy, sx),
        flip = sx < 0;
      f.turn += (angDiff(f.prevAng, ang) / Math.max(dt, 1e-3) - f.turn) * Math.min(1, dt * 6);
      f.prevAng = ang;
      const bend = clamp(f.turn * 0.35, -1, 1) * 16 * (flip ? 1 : -1); // en virage, la queue se déporte vers l'extérieur
      const pts = f.rope.points,
        n = pts.length,
        amp = 15 + f.boost * 0.08;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1),
          tail = 1 - t; // t=0 : bout de la queue, t=1 : tête
        pts[i].y = amp * (0.1 + 0.9 * Math.pow(tail, 1.5)) * Math.sin(f.phase + 2.9 * t) + bend * tail * tail;
      }
      f.rope.setDirty();
      f.rope
        .setPosition(S.x, S.y)
        .setRotation(ang)
        .setFlipY(flip)
        .setVisible(S.y > horizon);
      f.rip -= dt;
      if (f.rip <= 0) {
        f.rip = rand(5, 11);
        this.ripples.push({ x: S.x, y: S.y, t: 0, life: 1800 });
      } // le poisson effleure la surface
    }
    for (const o of this.floaters) {
      o.vx *= Math.exp(-1.4 * dt);
      o.vy *= Math.exp(-1.4 * dt);
      o.vr *= Math.exp(-1.2 * dt);
      o.x += (o.vx + Math.cos(o.ph + time * 0.0003) * 2) * dt;
      o.y += (o.vy + Math.sin(o.ph + time * 0.00027) * 2) * dt;
      o.rot += (o.vr + 0.01) * dt * 0.3;
      if (!this.r.world.inPond(o.x, o.y, 60)) {
        // monde : la berge renvoie les objets vers le large
        const a = Math.atan2(o.y, o.x);
        o.vx -= Math.cos(a) * 30 * dt * 10;
        o.vy -= Math.sin(a) * 30 * dt * 10;
      }
      if (Math.hypot(o.x, o.y) < this.r.H + 60) {
        const a = Math.atan2(o.y, o.x);
        o.vx += Math.cos(a) * 30 * dt * 10;
        o.vy += Math.sin(a) * 30 * dt * 10;
      }
      const S = iso(o.x, o.y);
      o.spr
        .setPosition(S.x, S.y + Math.sin(time * 0.002 + o.ph) * 1.5)
        .setRotation(Math.sin(time * 0.0008 + o.ph) * 0.06 + o.rot * 0.2)
        .setVisible(S.y > horizon);
    }
  }

  /* ---------- dessin ---------- */
  // Surface de l'eau : ronds, puis reflets.
  drawWater(g: Phaser.GameObjects.Graphics, time: number) {
    for (const r of this.ripples) {
      const p = r.t / r.life;
      g.lineStyle(2, 0xaadcdc, 0.09 * (1 - p));
      g.strokeEllipse(r.x, r.y, 16 + p * 140, 8 + p * 70);
    }
    this.drawGlints(g, time);
  }
  // Reflets de lumière qui scintillent sur l'eau (cases fixes dans le monde, donc stables quand la caméra bouge).
  drawGlints(g: Phaser.GameObjects.Graphics, time: number) {
    const v = this.r.camView;
    if (!v) return;
    const cell = 150,
      col = this.life.glint,
      top = this.r.bg.y - 100;
    for (let cx = Math.floor(v.x / cell); cx <= Math.floor(v.right / cell); cx++)
      for (let cy = Math.floor(v.y / cell); cy <= Math.floor(v.bottom / cell); cy++) {
        const h = Math.abs(Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453) % 1;
        if (h < 0.4) continue;
        const x = (cx + ((h * 7) % 1)) * cell,
          y = (cy + ((h * 13) % 1)) * cell;
        if (y < top || !this.r.world.inPondScreen(x, y, 30)) continue;
        const a = Math.sin(time * 0.0018 * (0.6 + h) + h * 30);
        if (a < 0.55) continue;
        g.fillStyle(col, 0.55 * (a - 0.4));
        const w = 3 * (3 + ((h * 5) | 0));
        g.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, w, 3);
        g.fillRect(Math.round(x / 3) * 3 + 3, Math.round(y / 3) * 3 + 3, w - 6, 3);
      }
    for (const o of this.floaters)
      if (o.kind === 'lanterne') {
        // lanternes flottantes : halo
        const S = iso(o.x, o.y);
        g.fillStyle(0x2de6ea, 0.1);
        g.fillEllipse(S.x, S.y, 90, 40);
        g.fillStyle(0xff9a3c, 0.08);
        g.fillEllipse(S.x, S.y, 56, 26);
      }
  }
  // Particules d'ambiance en pixels : pétales, feuilles, neige, lucioles, braises.
  drawAmbient(g: Phaser.GameObjects.Graphics, view: Phaser.Geom.Rectangle, time: number, dt: number) {
    const kind = this.life.amb;
    for (const m of this.motes) {
      if (kind === 'ember') {
        m.y -= (0.05 + m.sz * 0.02) * dt;
        m.x += Math.sin(time * 0.002 + m.ph) * 0.02 * dt;
      } else if (kind === 'firefly') {
        m.x += Math.sin(time * 0.0007 + m.ph) * 0.03 * dt;
        m.y += Math.cos(time * 0.0009 + m.ph * 2) * 0.03 * dt;
      } else if (kind === 'snow') {
        m.y += (0.05 + m.sz * 0.03) * dt;
        m.x += Math.sin(time * 0.001 + m.ph) * 0.02 * dt;
      } else {
        m.x += (-0.02 + Math.sin(time * 0.0012 + m.ph) * 0.02) * dt;
        m.y += (0.03 + m.sz * 0.01) * dt;
      }
      if (m.y > 1.05) m.y = -0.05;
      if (m.y < -0.05) m.y = 1.05;
      if (m.x > 1.05) m.x = -0.05;
      if (m.x < -0.05) m.x = 1.05;
      const x = Math.round((view.x + m.x * view.width) / 3) * 3,
        y = Math.round((view.y + m.y * view.height) / 3) * 3,
        s = 3 * m.sz;
      if (kind === 'snow') {
        g.fillStyle(0xffffff, 0.85);
        g.fillRect(x, y, s, s);
      } else if (kind === 'petal') {
        g.fillStyle(m.sz > 1 ? 0xf6b6cf : 0xf4a15a, 0.9);
        g.fillRect(x, y, 6, 3);
        g.fillRect(x + 3, y + 3, 3, 3);
      } else if (kind === 'leaf') {
        g.fillStyle(0x9ab88a, 0.8);
        g.fillRect(x, y, 6, 3);
        g.fillRect(x + 3, y + 3, 3, 3);
      } else if (kind === 'ember') {
        const a = clamp(m.y * 1.6, 0.1, 1);
        g.fillStyle(m.sz > 1 ? 0xffd36a : 0xff7a2a, a);
        g.fillRect(x, y, s, s);
      } else {
        const a = Math.max(0, Math.sin(time * 0.003 + m.ph * 5));
        if (a > 0.1) {
          g.fillStyle(this.r.theme === 'neon' ? (m.sz > 1 ? 0xff9a3c : 0x2de6ea) : 0xe9f07a, a * 0.9);
          g.fillRect(x, y, 3, 3);
          g.fillStyle(0xffffff, a * 0.5);
          g.fillRect(x, y, 3, 3);
        }
      }
    }
  }
}
