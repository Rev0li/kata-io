// Effets visuels éphémères : étincelles, anneaux au sol, lignes de vitesse, sprites d'impact, particules de boutique,
// ploufs d'éjection, planches qui tombent, images fantômes et textes flottants.
import Phaser from 'phaser';
import { TAU, TRAINEES } from '../../sim/data';
import { lerp, easeOut } from '../../sim/sim';
import { sfxAt } from '../audio';
import type { FxKey } from '../assets';
import { ISO, iso, strokeC } from './iso';
import { C, FONT_DISP, hex, rand } from './palette';
import type { Renderer } from './index';

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  col: number;
  s: number;
  kind: 'dot' | 'drop';
}
interface SLine {
  x: number;
  y: number;
  ang: number;
  r0: number;
  len: number;
  w: number;
  t: number;
  life: number;
  col: number;
}
interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  t: number;
  life: number;
  col: number;
  w: number;
  scr?: boolean;
}
// Particule-sprite (effets de boutique, débris) : mouvement balistique, échelle et opacité sur la durée de vie.
export interface SP {
  s: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  drag: number;
  t: number;
  life: number;
  rot: number;
  vr: number;
  s0: number;
  s1: number;
  a: number;
  fadeIn: number;
  fade: boolean;
  fps: number;
  loop: boolean;
  f0: number;
  wob: number;
  n: number;
  emit?: { key: string; every: number; acc: number; opts: SPOpts };
  end?: (p: SP) => void;
}
type SPOpts = Partial<Omit<SP, 's' | 't' | 'n'>> & { tint?: number; depth?: number };

export class Effects {
  parts: Part[] = [];
  rings: Ring[] = [];
  slines: SLine[] = [];
  later: { t: number; fn: () => void }[] = [];
  sparts: SP[] = [];
  spPool: Phaser.GameObjects.Sprite[] = [];
  fxPool: Phaser.GameObjects.Sprite[] = [];
  ghosts: { s: Phaser.GameObjects.Sprite; t: number; life: number }[] = [];
  ghostPool: Phaser.GameObjects.Sprite[] = [];
  floats: { tx: Phaser.GameObjects.Text; x: number; y: number; t: number; life: number }[] = [];
  floatPool: Phaser.GameObjects.Text[] = [];

  constructor(private r: Renderer) {}

  after(ms: number, fn: () => void) {
    this.later.push({ t: ms, fn });
  }
  sparks(x: number, y: number, col: string, n: number) {
    const S = iso(x, y, 14);
    for (let i = 0; i < n; i++)
      this.parts.push({
        x: S.x,
        y: S.y,
        vx: rand(-250, 250),
        vy: rand(-250, 250),
        life: rand(160, 340),
        t: 0,
        col: hex(col),
        s: rand(1.5, 3),
        kind: 'dot',
      });
  }
  addFloat(x: number, y: number, text: string, col: string, size = 17) {
    const tx =
      this.floatPool.pop() ||
      this.r.scene.add
        .text(0, 0, '', {
          fontFamily: FONT_DISP,
          fontStyle: '800',
          stroke: '#0f1719',
          strokeThickness: 4,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(6);
    tx.setText(text).setColor(col).setFontSize(size).setVisible(true).setAlpha(1).setPosition(x, y);
    this.floats.push({ tx, x, y, t: 0, life: 1000 });
  }

  /* ---------- sprites d'effet ---------- */
  // Effet sprite : x, y en coordonnées écran ; fxw prend un point du monde de la simulation et une hauteur en pixels.
  fxw(key: FxKey, x: number, y: number, h: number, rot: number, scale: number, tint?: number, alpha = 1, flat = 1) {
    const p = iso(x, y, h);
    this.fx(key, p.x, p.y, rot, scale, tint, alpha, flat);
  }
  fx(key: FxKey, x: number, y: number, rot: number, scale: number, tint?: number, alpha = 1, flat = 1) {
    const s = this.fxPool.pop() || this.r.scene.add.sprite(0, 0, 'fx-' + key);
    s.setTexture('fx-' + key, 0)
      .setPosition(x, y)
      .setRotation(rot)
      .setScale(scale, scale * flat)
      .setAlpha(alpha)
      .setDepth(3.5)
      .setVisible(true)
      .setTintMode(Phaser.TintModes.MULTIPLY);
    if (tint !== undefined) s.setTint(tint);
    else s.clearTint();
    s.play('fx-' + key);
    s.once('animationcomplete', () => {
      s.setVisible(false);
      this.fxPool.push(s);
    });
  }
  // Image fantôme d'un combattant (traînée d'esquive).
  ghost(spr: Phaser.GameObjects.Sprite, depth: number, col: number) {
    const s = this.ghostPool.pop() || this.r.scene.add.sprite(0, 0, 'persos', 0);
    s.setFrame(spr.frame.name)
      .setPosition(spr.x, spr.y)
      .setScale(spr.scaleX, spr.scaleY)
      .setRotation(spr.rotation)
      .setDepth(depth)
      .setVisible(true)
      .setAlpha(0.5)
      .setTint(col)
      .setTintMode(Phaser.TintModes.FILL);
    this.ghosts.push({ s, t: 0, life: 220 });
  }

  /* ---------- particules-sprites ---------- */
  spawn(key: string, x: number, y: number, o: SPOpts = {}): SP {
    const s = this.spPool.pop() || this.r.scene.add.sprite(0, 0, 'fx-' + key);
    s.setTexture('fx-' + key, o.f0 || 0)
      .setVisible(true)
      .setDepth(o.depth ?? 3.65)
      .setTintMode(Phaser.TintModes.MULTIPLY);
    if (o.tint !== undefined) s.setTint(o.tint);
    else s.clearTint();
    const p: SP = {
      s,
      x,
      y,
      vx: 0,
      vy: 0,
      ay: 0,
      drag: 0,
      t: 0,
      life: 600,
      rot: 0,
      vr: 0,
      s0: 2,
      s1: 2,
      a: 1,
      fadeIn: 0,
      fade: true,
      fps: 0,
      loop: false,
      f0: 0,
      wob: 0,
      n: Math.max(1, s.texture.frameTotal - 1),
      ...o,
    };
    if (p.emit) p.emit = { ...p.emit, acc: 0 };
    this.sparts.push(p);
    this.stepSP(p, 0);
    return p;
  }
  stepSP(p: SP, dt: number) {
    p.t += dt * 1000;
    if (p.drag) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
    }
    p.vy += p.ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const k = Math.min(1, p.t / p.life),
      fade = p.fade && k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    const fr = p.fps ? Math.floor((p.t / 1000) * p.fps) : 0,
      f = p.fps ? (p.loop ? (p.f0 + fr) % p.n : Math.min(p.n - 1, p.f0 + fr)) : p.f0;
    p.s
      .setFrame(f)
      .setPosition(p.x + (p.wob ? Math.sin(p.t * 0.006) * p.wob : 0), p.y)
      .setRotation(p.rot)
      .setScale(lerp(p.s0, p.s1, k))
      .setAlpha(p.a * (p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1) * fade);
    if (p.emit) {
      p.emit.acc += dt * 1000;
      while (p.emit.acc >= p.emit.every) {
        p.emit.acc -= p.emit.every;
        this.spawn(p.emit.key, p.x, p.y + 6, p.emit.opts);
      }
    }
  }

  // Particule semée au bout de l'arme par une traînée de la boutique.
  trailPart(id: string, x: number, y: number, dir: number) {
    const r = () => rand(-6, 6);
    switch (TRAINEES[id]?.part) {
      case 'flame':
        this.spawn('flame', x + r(), y + r(), {
          fps: 12,
          loop: true,
          f0: (Math.random() * 4) | 0,
          life: 420,
          s0: 1.7,
          s1: 0.5,
          vy: -50,
        });
        break;
      case 'leaf':
        this.spawn('leaf', x + r(), y + r(), {
          f0: (Math.random() * 6) | 0,
          life: 950,
          s0: 2.4,
          s1: 1.8,
          vx: rand(-50, 50),
          vy: rand(-40, 10),
          ay: 50,
          drag: 1.5,
          rot: rand(0, TAU),
          vr: rand(-5, 5),
          wob: 5,
        });
        break;
      case 'smoke':
        this.spawn('smoke', x + r(), y + r(), { fps: 14, life: 430, s0: 0.8, s1: 1.4, tint: 0x3a2b48, a: 0.75 });
        break;
      case 'sparkle':
        this.spawn('sparkle', x + r() * 2, y + r() * 2, {
          fps: 16,
          life: 380,
          s0: 1.2,
          s1: 1.2,
          tint: Math.random() < 0.5 ? 0xfff1a8 : 0xffffff,
        });
        break;
      case 'splash':
        this.spawn('splash', x, y, { fps: 16, life: 380, s0: 0.9, s1: 1.1, rot: dir + Math.PI / 2, a: 0.85 });
        break;
      case 'shuriken':
        this.spawn('shuriken', x, y, {
          life: 560,
          s0: 2.3,
          s1: 1.4,
          vr: 16,
          vx: Math.cos(dir) * 60 + r() * 8,
          vy: Math.sin(dir) * 60 + r() * 8,
          drag: 3,
        });
        break;
      case 'coin':
        this.spawn('coin', x, y, {
          fps: 12,
          loop: true,
          f0: (Math.random() * 4) | 0,
          life: 650,
          s0: 2.3,
          s1: 2,
          vx: rand(-60, 60),
          vy: rand(-140, -60),
          ay: 520,
        });
        break;
    }
  }

  // Plouf d'éjection : la gerbe d'eau, plus l'effet acheté en boutique par celui qui éjecte.
  splash(wx: number, wy: number, fx: string, s: number) {
    const S = iso(wx, wy),
      x = S.x,
      y = S.y; // l'effet se joue en coordonnées écran, à partir du point d'impact
    this.fx('splash', x, y - 22, 0, 4 * s);
    this.rings.push({ x: wx, y: wy, r: 6 * s, max: 60 * s, life: 650, t: 0, col: 0xd6f0f2, w: 5 * s });
    this.rings.push({ x: wx, y: wy, r: 4 * s, max: 96 * s, life: 1000, t: 0, col: 0x9fc9cf, w: 3 * s });
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU),
        sp = rand(90, 260) * s;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.8 - 40,
        life: rand(380, 720),
        t: 0,
        col: 0xd3ecee,
        s: rand(2, 4) * s,
        kind: 'drop',
      });
    }
    const mini = (p: SP) => {
      this.fx('splash', p.x, p.y - 8, 0, 2);
      this.rings.push({ x: p.x, y: p.y + 10, r: 4, max: 24, life: 600, t: 0, col: 0xd6f0f2, w: 3, scr: true });
    };
    switch (fx) {
      case 'encre-e':
        this.spawn('smoke', x, y - 14, { fps: 10, life: 900, s0: 3.6, s1: 5, tint: 0x120c16, a: 0.9 });
        for (let i = 0; i < 4; i++)
          this.after(i * 90, () =>
            this.spawn('smoke', x + rand(-50, 50), y + rand(-30, 10), {
              fps: 12,
              life: 700,
              s0: 1.8,
              s1: 2.8,
              tint: 0x1b1222,
              a: 0.85,
            }),
          );
        for (let i = 0; i < 18; i++) {
          const a = rand(0, TAU),
            sp = rand(80, 240);
          this.parts.push({
            x,
            y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp * 0.8,
            life: rand(500, 900),
            t: 0,
            col: 0x070707,
            s: rand(3, 6),
            kind: 'drop',
          });
        }
        break;
      case 'petales':
        for (let i = 0; i < 28; i++)
          this.spawn('leaf', x + rand(-10, 10), y - 10, {
            f0: (Math.random() * 6) | 0,
            vx: rand(-240, 240),
            vy: rand(-420, -120),
            ay: 260,
            drag: 1.6,
            rot: rand(0, TAU),
            vr: rand(-8, 8),
            life: rand(1500, 2300),
            s0: 2.8,
            s1: 2.1,
            wob: 8,
          });
        break;
      case 'cochon':
        this.spawn('pig', x, y - 10, {
          fps: 8,
          loop: true,
          vx: rand(-90, 90),
          vy: -640,
          ay: 1120,
          vr: rand(-5, 5),
          life: 1150,
          s0: 3.4,
          s1: 3.4,
          fade: false,
          end: mini,
        });
        this.after(250, () => this.addFloat(x, y - 120, 'GROIN !', '#f6b6cf', 22));
        break;
      case 'fantome':
        this.spawn('ghost', x, y - 24, {
          fps: 6,
          loop: true,
          vy: -60,
          life: 2600,
          s0: 2.4,
          s1: 3.8,
          a: 0.85,
          fadeIn: 300,
          wob: 16,
        });
        for (let i = 0; i < 6; i++)
          this.after(200 + i * 160, () =>
            this.spawn('sparkle', x + rand(-40, 40), y - rand(40, 140), {
              fps: 16,
              life: 380,
              s0: 1.2,
              s1: 1.2,
              tint: 0xbff3ff,
            }),
          );
        this.after(350, () => this.addFloat(x, y - 130, 'BOUH !', '#bff3ff', 22));
        break;
      case 'feu':
        this.fx('fire', x, y - 20, 0, 3);
        for (let k = 0; k < 5; k++)
          this.after(120 + k * 210, () => {
            const bx = x + rand(-80, 80),
              by = y - rand(50, 150),
              col = [C.gold, 0xff5a46, 0x8ff5d0, 0xf6b6cf, 0xffffff][k % 5];
            this.fx('star', bx, by, 0, rand(2.4, 3.4), col);
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * TAU,
                sp = rand(140, 220);
              this.parts.push({
                x: bx,
                y: by,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: rand(450, 700),
                t: 0,
                col,
                s: 3,
                kind: 'dot',
              });
            }
            sfxAt('ui', wx, wy, 0.6);
          });
        break;
      case 'tresor': {
        const chest = this.spawn('chest', x, y - 10, {
          f0: 0,
          vy: -500,
          ay: 900,
          life: 1150,
          s0: 3.4,
          s1: 3.4,
          fade: false,
          end: mini,
        });
        this.after(520, () => {
          chest.f0 = 1;
          this.fx('sparkle', chest.x, chest.y - 10, 0, 3, C.gold);
          for (let i = 0; i < 18; i++)
            this.spawn('coin', chest.x, chest.y - 8, {
              fps: 12,
              loop: true,
              f0: (Math.random() * 4) | 0,
              vx: rand(-240, 240),
              vy: rand(-560, -240),
              ay: 950,
              life: rand(900, 1300),
              s0: 2.6,
              s1: 2.6,
              vr: rand(-4, 4),
            });
          sfxAt('coin', wx, wy, 1);
        });
        break;
      }
      case 'phenix':
        this.fx('fire', x, y - 24, 0, 4.5);
        this.spawn('bird', x, y - 24, {
          fps: 12,
          loop: true,
          vy: -110,
          ay: -300,
          life: 1900,
          s0: 2.6,
          s1: 4,
          fadeIn: 120,
          emit: { key: 'fire', every: 45, acc: 0, opts: { fps: 18, life: 300, s0: 1.3, s1: 0.5, vy: 40, a: 0.9 } },
        });
        this.after(200, () => this.addFloat(x, y - 140, 'RENAISSANCE !', '#ffb36b', 20));
        break;
    }
  }

  // Mort subite : une planche du bord tombe à l'eau.
  plank(H: number) {
    const side = (Math.random() * 4) | 0,
      u = rand(-H, H),
      nx = side === 0 ? -1 : side === 1 ? 1 : 0,
      ny = side === 2 ? -1 : side === 3 ? 1 : 0;
    const x = nx ? nx * H : u,
      y = ny ? ny * H : u,
      S = iso(x, y),
      o = { x: (nx - ny) * ISO, y: (nx + ny) * ISO * 0.5 };
    this.spawn('wood', S.x, S.y, {
      f0: (Math.random() * 6) | 0,
      vx: o.x * rand(90, 190),
      vy: o.y * rand(90, 190) - rand(90, 170),
      ay: 560,
      vr: rand(-7, 7),
      life: 620,
      s0: 3,
      s1: 2.2,
      depth: 1.5,
      end: p => this.rings.push({ x: p.x, y: p.y, r: 3, max: 18, life: 600, t: 0, col: 0xd6f0f2, w: 2, scr: true }),
    });
  }

  /* ---------- lignes de vitesse façon animé ---------- */
  // Éclat radial autour d'un impact (écran).
  burst(x: number, y: number, n: number, r0: number, len: number, col: number, w: number, life: number) {
    for (let i = 0; i < n; i++)
      this.slines.push({
        x,
        y,
        ang: (i / n) * TAU + rand(-0.12, 0.12),
        r0: r0 * rand(0.8, 1.2),
        len: len * rand(0.6, 1.3),
        w: w * rand(0.7, 1.3),
        t: 0,
        life: life * rand(0.8, 1.1),
        col,
      });
  }
  // Traînées parallèles dans une direction.
  streaks(x: number, y: number, ang: number, n: number, len: number, col: number, w: number, life: number) {
    const px = -Math.sin(ang),
      py = Math.cos(ang);
    for (let i = 0; i < n; i++) {
      const o = rand(-46, 46);
      this.slines.push({
        x: x + px * o,
        y: y + py * o,
        ang,
        r0: rand(14, 50),
        len: len * rand(0.5, 1.2),
        w: w * rand(0.6, 1.2),
        t: 0,
        life: life * rand(0.8, 1.1),
        col,
      });
    }
  }

  /* ---------- image par image ---------- */
  update(dt: number) {
    const ms = dt * 1000;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += ms;
      if (p.t >= p.life) {
        this.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += ms;
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.slines.length - 1; i >= 0; i--) {
      const l = this.slines[i];
      l.t += ms;
      if (l.t >= l.life) this.slines.splice(i, 1);
    }
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      l.t -= ms;
      if (l.t <= 0) {
        this.later.splice(i, 1);
        l.fn();
      }
    }
    for (let i = this.sparts.length - 1; i >= 0; i--) {
      const p = this.sparts[i];
      this.stepSP(p, dt);
      if (p.t >= p.life) {
        p.s.setVisible(false);
        this.spPool.push(p.s);
        this.sparts.splice(i, 1);
        if (p.end) p.end(p);
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const gh = this.ghosts[i];
      gh.t += ms;
      if (gh.t >= gh.life) {
        gh.s.setVisible(false);
        this.ghostPool.push(gh.s);
        this.ghosts.splice(i, 1);
      } else gh.s.setAlpha(0.45 * (1 - gh.t / gh.life));
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += ms;
      const p = f.t / f.life;
      if (p >= 1) {
        f.tx.setVisible(false);
        this.floatPool.push(f.tx);
        this.floats.splice(i, 1);
        continue;
      }
      f.tx.setPosition(f.x, f.y - p * 30).setAlpha(1 - p * p);
    }
  }
  drawRings(g: Phaser.GameObjects.Graphics) {
    for (const r of this.rings) {
      const p = r.t / r.life,
        rad = Math.max(1, lerp(r.r, r.max, easeOut(p)));
      g.lineStyle(r.w * (1 - p) + 1, r.col, 1 - p);
      if (r.scr) g.strokeEllipse(r.x, r.y, 2 * rad, rad);
      else strokeC(g, r.x, r.y, rad);
    }
  }
  // Lignes de vitesse : elles jaillissent puis s'effilent.
  drawLines(g: Phaser.GameObjects.Graphics) {
    for (const l of this.slines) {
      const p = l.t / l.life,
        a = Math.cos(l.ang),
        b = Math.sin(l.ang),
        r0 = l.r0 + l.len * 0.5 * easeOut(p),
        r1 = l.r0 + l.len * easeOut(Math.min(1, p * 1.6));
      g.lineStyle(Math.max(1, l.w * (1 - p)), l.col, 1 - p * p);
      g.lineBetween(l.x + a * r0, l.y + b * r0, l.x + a * r1, l.y + b * r1);
    }
  }
  drawParts(g: Phaser.GameObjects.Graphics) {
    for (const p of this.parts) {
      const k = p.t / p.life;
      g.fillStyle(p.col, 1 - k);
      if (p.kind === 'drop') g.fillCircle(p.x, p.y, p.s * (1 - k * 0.5));
      else g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
  }
}
