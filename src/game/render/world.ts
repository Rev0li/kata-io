// Décor d'un monde : sol de la rive, étang (eau, glace ou lave), éléments posés autour de la plateforme
// et premier plan en parallaxe. Les poissons, objets flottants et ronds dans l'eau restent dans lake.ts.
import Phaser from 'phaser';
import { TAU } from '../../sim/data';
import { iso, unIso } from './iso';
import { hex, mix } from './palette';
import { WORLDS, WorldDef } from './worlds';
import type { Renderer } from './index';

const FORE_K = 0.35; // le premier plan glisse 35 % plus vite que le décor quand la caméra bouge

// Petit hasard reproductible : le même monde est toujours dessiné pareil.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class World {
  def: WorldDef | null = null;
  groundG: Phaser.GameObjects.Graphics;
  sprites: Phaser.GameObjects.Image[] = [];
  fore: { spr: Phaser.GameObjects.Image; ax: number; ay: number; h: number }[] = [];
  wob: [number, number, number][] = []; // rayon de l'étang : [amplitude, fréquence, phase]

  constructor(private r: Renderer) {
    this.groundG = r.scene.add.graphics().setDepth(-1.5);
  }

  get active() {
    return !!this.def;
  }

  // L'étang est une ellipse à l'écran (demi-axes ax × ay), au bord légèrement ondulé.
  // k(θ) : facteur du bord dans la direction θ de l'ellipse.
  edge(th: number) {
    let k = 1;
    for (const [amp, f, ph] of this.wob) k += amp * Math.sin(f * th + ph);
    return k;
  }
  inPondScreen(sx: number, sy: number, margin = 0) {
    const d = this.def;
    if (!d) return true;
    const u = sx / (d.ax - margin),
      v = (sy - d.cy) / (d.ay - margin / 2);
    return Math.hypot(u, v) < this.edge(Math.atan2(v, u));
  }
  // Un point du monde est-il dans l'étang ? (marge en pixels écran)
  inPond(x: number, y: number, margin = 0) {
    const p = iso(x, y);
    return this.inPondScreen(p.x, p.y, margin);
  }
  // Point d'eau au hasard autour de la plateforme (unités du monde) ; près de `near` si donné.
  pondPoint(H: number, rnd: () => number, near?: { x: number; y: number }) {
    const d = this.def!;
    for (let i = 0; i < 30; i++) {
      const n = near ? iso(near.x, near.y) : null,
        th = n ? Math.atan2((n.y - d.cy) / d.ay, n.x / d.ax) + (rnd() - 0.5) * 2 : rnd() * TAU,
        k = this.edge(th) * (0.55 + rnd() * 0.37),
        w = unIso(Math.cos(th) * d.ax * k, d.cy + Math.sin(th) * d.ay * k);
      if (Math.abs(w.x) > H + 90 || Math.abs(w.y) > H + 90) return w;
    }
    return unIso(d.ax * 0.8, d.cy);
  }

  clear() {
    for (const s of this.sprites) s.destroy();
    for (const f of this.fore) f.spr.destroy();
    this.sprites = [];
    this.fore = [];
    this.groundG.clear();
    this.def = null;
  }

  build(name: string) {
    this.clear();
    const def = WORLDS[name];
    if (!def) return;
    this.def = def;
    const rnd = seeded(name.length * 7919 + name.charCodeAt(0));
    this.wob = [
      [0.05, 3, rnd() * TAU],
      [0.035, 5, rnd() * TAU],
      [0.02, 8, rnd() * TAU],
    ];
    this.drawGround(def, rnd);
    const scene = this.r.scene;
    const add = (p: [string, number, number, number, boolean?], depth: number) => {
      const [k, x, y, s, flip] = p;
      const spr = scene.add
        .image(x, y, 'm:' + k)
        .setOrigin(0.5, 1)
        .setScale(s)
        .setFlipX(!!flip)
        .setDepth(depth);
      this.sprites.push(spr);
      return spr;
    };
    // derrière (au fond et sur les côtés) : sous les combattants ; devant : au-dessus
    for (const p of def.props) add(p, p[2] < 150 ? 0.9 + p[2] * 1e-5 : 5 + p[2] * 1e-5);
    for (const p of def.decals) add(p, 0.55).setOrigin(0.5, 0.5);
    for (const [k, ax, ay, h, flip] of def.fore) {
      const spr = scene.add
        .image(0, 0, 'm:' + k)
        .setFlipX(!!flip)
        .setDepth(6)
        .setTint(mix(0xffffff, hex(def.ground), 0.35)); // plus sombre que la scène : il n'attire pas l'œil
      this.fore.push({ spr, ax, ay, h });
    }
  }

  // Sol, berge et étang : dessinés une fois, à plat.
  drawGround(def: WorldDef, rnd: () => number) {
    const g = this.groundG,
      ground = hex(def.ground),
      pond = hex(def.pond),
      pond2 = hex(def.pond2);
    g.fillStyle(ground, 1);
    g.fillRect(-4000, -3000, 8000, 6000);
    // taches et petites touches sur la rive
    for (let i = 0; i < 260; i++) {
      const x = (rnd() - 0.5) * 2600,
        y = (rnd() - 0.5) * 1300;
      if (this.inPondScreen(x, y, -60)) continue;
      g.fillStyle(hex(def.ground2), 0.55);
      g.fillEllipse(x, y, 40 + rnd() * 120, 14 + rnd() * 40);
    }
    for (let i = 0; i < 700; i++) {
      const x = (rnd() - 0.5) * 2600,
        y = (rnd() - 0.5) * 1300;
      if (this.inPondScreen(x, y, -30)) continue;
      g.fillStyle(def.speck[i % def.speck.length], 0.75);
      g.fillEllipse(x, y, 4 + rnd() * 5, 2 + rnd() * 3);
    }
    const shape = (grow: number) => {
      const pts: any[] = []; // fillPoints attend des Vector2 : des {x, y} suffisent (comme dans arena.ts)
      for (let i = 0; i < 96; i++) {
        const th = (i / 96) * TAU,
          k = this.edge(th);
        pts.push({ x: Math.cos(th) * (def.ax + grow) * k, y: def.cy + Math.sin(th) * (def.ay + grow / 2) * k });
      }
      return pts;
    };
    const inside = (k: number, rnd: () => number) => {
      const th = rnd() * TAU,
        r = rnd() * k * this.edge(th);
      return { x: Math.cos(th) * def.ax * r, y: def.cy + Math.sin(th) * def.ay * r };
    };
    // berge : ombre, bord clair, puis l'étang
    g.fillStyle(mix(ground, 0x000000, 0.35), 1);
    g.fillPoints(shape(46), true);
    g.fillStyle(hex(def.bank), 1);
    g.fillPoints(shape(30), true);
    g.fillStyle(mix(pond, 0x000000, def.matter === 'lave' ? 0.45 : 0.25), 1);
    g.fillPoints(shape(8), true);
    g.fillStyle(pond, 1);
    g.fillPoints(shape(0), true);
    // profondeur : l'eau fonce vers le centre, la lave y rougeoie
    for (let k = 1; k <= 4; k++) {
      g.fillStyle(def.matter === 'lave' ? pond2 : mix(pond, 0x000000, 0.06), 0.12);
      g.fillPoints(shape(-60 * k), true);
    }
    if (def.matter === 'glace') {
      // glace : plaques claires et fissures
      for (let i = 0; i < 40; i++) {
        const p = inside(0.9, rnd);
        g.fillStyle(pond2, 0.35);
        g.fillEllipse(p.x, p.y, 60 + rnd() * 160, 20 + rnd() * 50);
      }
      g.lineStyle(2, 0xffffff, 0.7);
      for (let i = 0; i < 26; i++) {
        const p0 = unIso(inside(0.9, rnd).x, inside(0.9, rnd).y);
        let a = rnd() * TAU,
          x = p0.x,
          y = p0.y;
        const pts: any[] = [iso(x, y)];
        for (let j = 0; j < 4; j++) {
          a += (rnd() - 0.5) * 1.6;
          x += Math.cos(a) * (30 + rnd() * 60);
          y += Math.sin(a) * (30 + rnd() * 60);
          pts.push(iso(x, y));
        }
        g.strokePoints(pts, false);
      }
    } else if (def.matter === 'lave') {
      // lave : coulées claires et croûtes sombres
      for (let i = 0; i < 60; i++) {
        const p = inside(0.92, rnd),
          crust = rnd() < 0.35;
        g.fillStyle(crust ? 0xa8331a : pond2, crust ? 0.4 : 0.45);
        g.fillEllipse(p.x, p.y, crust ? 30 + rnd() * 60 : 40 + rnd() * 150, crust ? 10 + rnd() * 16 : 12 + rnd() * 40);
      }
    } else {
      for (let i = 0; i < 30; i++) {
        const p = inside(0.9, rnd);
        g.fillStyle(pond2, 0.18);
        g.fillEllipse(p.x, p.y, 80 + rnd() * 200, 20 + rnd() * 50);
      }
    }
  }

  // Lave : bulles qui gonflent et rougeoient (sur le calque de l'eau, redessiné à chaque image).
  drawLive(g: Phaser.GameObjects.Graphics, time: number) {
    const def = this.def;
    if (!def || def.matter !== 'lave') return;
    for (let i = 0; i < 14; i++) {
      const th = i * 2.39996,
        d = 0.62 + ((i * 0.37) % 0.3),
        p = { x: Math.cos(th) * def.ax * d, y: def.cy + Math.sin(th) * def.ay * d },
        k = 0.5 + 0.5 * Math.sin(time * 0.0016 + i * 1.7);
      g.fillStyle(0xffd36a, 0.25 * k);
      g.fillEllipse(p.x, p.y, 30 + 40 * k, 12 + 16 * k);
    }
  }

  // Premier plan : accroché aux bords de la vue, il glisse plus vite que le décor (parallaxe).
  update(cam: Phaser.Cameras.Scene2D.Camera) {
    if (!this.def) return;
    // centre de repos de la caméra : (0, -10) ; le premier plan s'en écarte plus vite que le décor
    const hw = cam.worldView.width / 2,
      hh = cam.worldView.height / 2,
      dx = cam.midPoint.x,
      dy = cam.midPoint.y + 10;
    for (const f of this.fore)
      f.spr
        .setPosition(dx + f.ax * hw - FORE_K * dx, -10 + dy + f.ay * hh - FORE_K * dy)
        .setScale((f.h * 2 * hh) / f.spr.height);
  }
}
