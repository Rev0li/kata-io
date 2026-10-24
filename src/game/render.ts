// Rendu Phaser du dojo et des combattants. Le décor et les signaux de combat (cônes, anneaux)
// sont dessinés en code ; les combattants, les armes et les impacts viennent du pack
// Ninja Adventure (Pixel-boy, CC0). Les effets arrivent sous forme d'événements de la simulation.
import Phaser from 'phaser';
import { TAU, RAD, CHARGE_FULL, CHARGE_START, PARRY_PERFECT, PERSOS, PERSO_COUNT, ARMES, TRAINEES, EMOTES, beltOf } from '../sim/data';
import { clamp, lerp, easeOut, angDiff, Ev } from '../sim/sim';
import { sfxAt } from './audio';
import { PX, FxKey } from './assets';

const C = { ink: 0x0f1719, bone: 0xecdfc6, mist: 0x93a59f, ochre: 0xe0a243, jade: 0x62c2a2, red: 0xe5483a, gold: 0xf2c14e, mat: 0xbcab78, mat2: 0xb1a06c, heri: 0x2b2417, rim: 0x3a281a, rim2: 0x523822, water: 0x0d2a30 };
export const WATER_HEX = '#0d2a30';

// Vue isométrique 2:1 : le monde de la simulation (x, y) est projeté sur l'écran, les sprites restent debout.
export const ISO = 0.6;
const RX = Math.SQRT2 * ISO; // demi-axe horizontal d'un cercle de rayon 1 une fois projeté (la hauteur vaut la moitié)
export const isoX = (x: number, y: number) => (x - y) * ISO;
export const isoY = (x: number, y: number) => (x + y) * ISO * 0.5;
export const iso2 = (x: number, y: number) => ({ x: isoX(x, y), y: isoY(x, y) });
export function unIso(sx: number, sy: number) { const u = sx / ISO, w = 2 * sy / ISO; return { x: (u + w) / 2, y: (w - u) / 2 }; }
// direction écran -> direction monde, à longueur égale (pour les touches et le joystick)
export function screenDirToWorld(dx: number, dy: number) {
  const x = (dx + 2 * dy) / 2, y = (2 * dy - dx) / 2, l = Math.hypot(x, y), m = Math.hypot(dx, dy);
  return l ? { x: x / l * m, y: y / l * m } : { x: 0, y: 0 };
}
export const worldAngleToScreen = (a: number) => Math.atan2((Math.cos(a) + Math.sin(a)) * 0.5, Math.cos(a) - Math.sin(a));

// Ambiances d'arène, d'après les visuels de référence (art/reference).
export interface Theme { water: string; top: number; top2: number; seam: number; rim: number; side: number; out: number; line?: number; edge?: number; lamp?: number; glow?: number; sky: string }
export const THEMES: Record<string, Theme> = {
  brume: { water: '#656455', sky: '#a3a69c', top: 0x76604d, top2: 0x82694f, seam: 0x4a3b2f, rim: 0x8d9189, side: 0x4d4238, out: 0x2a2924, lamp: 0xf5e2b0, glow: 0xffd88a },
  coucher: { water: '#355d62', sky: '#d9a982', top: 0xc98450, top2: 0xd89462, seam: 0x7a4624, rim: 0xb36a38, side: 0x7d4a27, out: 0x3a2314, line: 0x2f6f7d },
  neige: { water: '#3b5a74', sky: '#b9cfe0', top: 0xb59f86, top2: 0xc4af95, seam: 0x6f5a45, rim: 0xe9f1f6, side: 0x7b6a5a, out: 0x1e2b38, line: 0x7fb8e8, lamp: 0xffe0a0, glow: 0xffd070 },
  bambou: { water: '#2f5a4a', sky: '#b8d4a0', top: 0xa8924e, top2: 0xb59f58, seam: 0x6a5a2a, rim: 0xc4b060, side: 0x6b5a30, out: 0x1d3a2c, line: 0x3e8a5a },
  volcan: { water: '#3a1208', sky: '#2a0f12', top: 0x4a3028, top2: 0x563830, seam: 0x2a1a16, rim: 0x6a4a3c, side: 0x2a1a16, out: 0x120606, line: 0xff7a2a, edge: 0xff9a3c, lamp: 0xff9a3c, glow: 0xff7a2a },
  neon: { water: '#0a1020', sky: '#0c1229', top: 0x3a2a3c, top2: 0x45324b, seam: 0x1b1220, rim: 0x2b2132, side: 0x18111f, out: 0x080610, line: 0x2de6ea, edge: 0xff9a3c, lamp: 0x2de6ea, glow: 0xff9a3c },
};
// Vie de chaque dojo : espèces de poissons (decor/fish-*.svg), objets flottants (decor/float-*.svg), particules d'ambiance.
const LIFE: Record<string, { fish: string[]; floats: string[]; amb: string; glint: number; nFish: number }> = {
  coucher: { fish: ['koi_orange', 'koi_blanc', 'koi_or'], floats: ['nenuphar', 'fleur'], amb: 'petal', glint: 0xfbe2b4, nFish: 5 },
  brume: { fish: ['koi_blanc', 'argente', 'carpe_jade'], floats: ['nenuphar', 'feuille'], amb: 'leaf', glint: 0xdfe2d6, nFish: 4 },
  neon: { fish: ['lanterne'], floats: ['lanterne'], amb: 'firefly', glint: 0x2de6ea, nFish: 5 },
  neige: { fish: ['argente', 'koi_blanc'], floats: ['glace'], amb: 'snow', glint: 0xf6fafc, nFish: 4 },
  bambou: { fish: ['carpe_jade', 'koi_or', 'koi_orange'], floats: ['nenuphar', 'fleur', 'feuille'], amb: 'firefly', glint: 0xe9f0c2, nFish: 5 },
  volcan: { fish: ['braise'], floats: ['lave'], amb: 'ember', glint: 0xff9a3c, nFish: 4 },
};
const LAKE = 720; // rayon du lac où nagent les poissons (unités du monde)
interface Fish { x: number; y: number; h: number; tx: number; ty: number; sp: number; boost: number; ph: number; phase: number; turn: number; prevAng: number; len: number; rip: number; kind: string; rope: Phaser.GameObjects.Rope }
interface Floater { x: number; y: number; vx: number; vy: number; ph: number; rot: number; vr: number; spr: Phaser.GameObjects.Image; kind: string }
interface Mote { x: number; y: number; vx: number; vy: number; ph: number; sz: number }
const cache = new Map<string, number>();
export function hex(s: string): number { let v = cache.get(s); if (v === undefined) { v = parseInt(s.slice(1), 16); cache.set(s, v); } return v; }
function mix(a: number, b: number, t: number) { const r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t)); return (r << 16) | (g << 8) | bl; }
const HEAT: [number, number[]][] = [[0, [236, 223, 198]], [60, [240, 196, 96]], [110, [236, 138, 60]], [160, [229, 72, 58]], [230, [190, 40, 60]]];
export function heatCss(p: number) { for (let i = 1; i < HEAT.length; i++) { if (p <= HEAT[i][0]) { const a = HEAT[i - 1], b = HEAT[i], t = (p - a[0]) / (b[0] - a[0]); return '#' + a[1].map((v, k) => Math.round(lerp(v, b[1][k], t)).toString(16).padStart(2, '0')).join(''); } } return '#be283c'; }
const hsl = (h: number) => Phaser.Display.Color.HSVToRGB(h / 360, 0.75, 1) as any;
const hsvInt = (h: number) => { const c = hsl(h); return (c.r << 16) | (c.g << 8) | c.b; };
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const FONT_DISP = '"Big Shoulders Display", Impact, sans-serif';
const FONT_BODY = 'Barlow, system-ui, sans-serif';

interface Part { x: number; y: number; vx: number; vy: number; t: number; life: number; col: number; s: number; kind: string; rot?: number; vr?: number }
interface SLine { x: number; y: number; ang: number; r0: number; len: number; w: number; t: number; life: number; col: number }
interface Ring { x: number; y: number; r: number; max: number; t: number; life: number; col: number; w: number; scr?: boolean }
// Particule-sprite (effets de boutique, débris) : mouvement balistique, échelle et opacité sur la durée de vie.
interface SP { s: Phaser.GameObjects.Sprite; x: number; y: number; vx: number; vy: number; ay: number; drag: number; t: number; life: number; rot: number; vr: number; s0: number; s1: number; a: number; fadeIn: number; fade: boolean; fps: number; loop: boolean; f0: number; wob: number; n: number; emit?: { key: string; every: number; acc: number; opts: SPOpts }; end?: (p: SP) => void }
type SPOpts = Partial<Omit<SP, 's' | 't' | 'n'>> & { tint?: number; depth?: number };
interface View { spr: Phaser.GameObjects.Sprite; wpn: Phaser.GameObjects.Image; px: number; py: number; walk: number; spd: number; flash: number; squash: number; prevState: string; prevPhase: string; prevDrop: number; ghostT: number; full: boolean; partT: number }

export class Renderer {
  scene: Phaser.Scene;
  bg: Phaser.GameObjects.Image; sky: Phaser.GameObjects.Image; theme = ''; wet = false;
  waterG: Phaser.GameObjects.Graphics; arenaG: Phaser.GameObjects.Graphics; dynG: Phaser.GameObjects.Graphics; topG: Phaser.GameObjects.Graphics;
  parts: Part[] = []; rings: Ring[] = []; ripples: { x: number; y: number; t: number; life: number }[] = [];
  floats: { tx: Phaser.GameObjects.Text; x: number; y: number; t: number; life: number }[] = [];
  floatPool: Phaser.GameObjects.Text[] = [];
  labels: { name: Phaser.GameObjects.Text; pct: Phaser.GameObjects.Text; emo: Phaser.GameObjects.Text }[] = [];
  fish: Fish[] = []; floaters: Floater[] = []; motes: Mote[] = []; camView: Phaser.Geom.Rectangle | null = null; life = LIFE.brume;
  views: View[] = []; fxPool: Phaser.GameObjects.Sprite[] = [];
  ghosts: { s: Phaser.GameObjects.Sprite; t: number; life: number }[] = []; ghostPool: Phaser.GameObjects.Sprite[] = [];
  sparts: SP[] = []; spPool: Phaser.GameObjects.Sprite[] = [];
  later: { t: number; fn: () => void }[] = [];
  slines: SLine[] = [];
  trailG: Phaser.GameObjects.Graphics;
  lastSt: any = null; sudden = false; shrinkAcc = 0;
  H = 260; rippleT = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.waterG = scene.add.graphics().setDepth(0);
    this.arenaG = scene.add.graphics().setDepth(1);
    this.bg = scene.add.image(0, 0, 'bg-brume').setOrigin(0.5, 1).setDepth(-1).setScrollFactor(0.95);
    this.sky = scene.add.image(0, 0, '__WHITE').setDisplaySize(2400, 3000).setOrigin(0.5, 1).setDepth(-2).setScrollFactor(0.95); // le ciel prolonge le haut de l'horizon
    this.dynG = scene.add.graphics().setDepth(2);
    this.topG = scene.add.graphics().setDepth(4);
    this.trailG = scene.add.graphics().setDepth(3.6); // traînées : au-dessus des combattants, en transparence
    this.setTheme('brume');
  }

  iso(x: number, y: number, h = 0) { return { x: (x - y) * ISO, y: (x + y) * ISO * 0.5 - h }; }
  fillC(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) { const p = this.iso(x, y); g.fillEllipse(p.x, p.y, 2 * RX * r, RX * r); }
  strokeC(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) { const p = this.iso(x, y); g.strokeEllipse(p.x, p.y, 2 * RX * r, RX * r); }
  // Secteur (cône de coup) posé au sol : fillPath/strokePath sur les points projetés.
  cone(g: Phaser.GameObjects.Graphics, x: number, y: number, facing: number, r: number, arc: number) {
    const pts: any[] = [this.iso(x, y)], n = Math.max(6, Math.ceil(arc / 0.18));
    for (let i = 0; i <= n; i++) { const a = facing - arc / 2 + arc * i / n; pts.push(this.iso(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
    g.fillPoints(pts, true); g.strokePoints(pts, true);
  }
  setTheme(name: string) {
    if (!THEMES[name]) name = 'brume';
    if (name === this.theme && this.bg.texture.key === 'bg-' + name) return;
    this.theme = name; const T = THEMES[name];
    this.scene.cameras.main.setBackgroundColor(T.water);
    this.bg.setTexture('bg-' + name); this.bg.setDisplaySize(2400, 420).setPosition(0, -ISO * 260 * 0.3);
    this.sky.setTint(hex(T.sky)).setPosition(0, this.bg.y - this.bg.displayHeight + 3); // le haut de l'horizon a la couleur du ciel : il se prolonge derrière
    this.buildLife(name);
    this.drawArena(this.H, this.wet, this.sudden);
  }

  /* ---------- dojo : cadre en bois dessiné, sol en tuiles du temple (pixel art) ---------- */
  drawArena(H: number, wet = false, sudden = false) {
    this.H = H; this.wet = wet; this.sudden = sudden; const g = this.arenaG; g.clear();
    const T = THEMES[this.theme], m = 24, TH = 30;
    const P = (x: number, y: number, dy = 0): any => ({ x: isoX(x, y), y: isoY(x, y) + dy });
    const quad = (h: number, dy = 0): any[] => [P(-h, -h, dy), P(h, -h, dy), P(h, h, dy), P(-h, h, dy)]; // haut, droite, bas, gauche
    const O = H + m, o = quad(O);
    // reflet sombre sur l'eau
    g.fillStyle(0x000000, 0.3); g.fillPoints(o.map((p: any): any => ({ x: p.x + 14, y: p.y + TH + 18 })), true);
    // flancs : gauche (clair) et droit (sombre), puis des pieux sous le bord
    const dn = (p: any, d = TH): any => ({ x: p.x, y: p.y + d });
    g.fillStyle(T.side, 1); g.fillPoints([o[3], o[2], dn(o[2]), dn(o[3])], true);
    g.fillStyle(mix(T.side, 0x000000, 0.3), 1); g.fillPoints([o[2], o[1], dn(o[1]), dn(o[2])], true);
    g.lineStyle(2, mix(T.side, 0x000000, 0.5), 0.9);
    for (let i = 1; i < 8; i++) { const k = i / 8, a = { x: lerp(o[3].x, o[2].x, k), y: lerp(o[3].y, o[2].y, k) }, c = { x: lerp(o[2].x, o[1].x, k), y: lerp(o[2].y, o[1].y, k) }; g.lineBetween(a.x, a.y, a.x, a.y + TH); g.lineBetween(c.x, c.y, c.x, c.y + TH); }
    // bord, puis lattes
    g.fillStyle(T.rim, 1); g.fillPoints(o, true);
    g.lineStyle(2, mix(T.rim, 0xffffff, 0.25), 0.7); g.strokePoints(quad(O - 3), true);
    const n = Math.max(6, Math.round(H / 24)), step = 2 * H / n;
    for (let i = 0; i < n; i++) {
      const x0 = -H + i * step, x1 = x0 + step;
      g.fillStyle(i % 2 ? T.top : T.top2, 1); g.fillPoints([P(x0, -H), P(x1, -H), P(x1, H), P(x0, H)], true);
    }
    g.lineStyle(1.5, T.seam, 0.85);
    for (let i = 0; i <= n; i++) { const x = -H + i * step, a = P(x, -H), c = P(x, H); g.lineBetween(a.x, a.y, c.x, c.y); }
    g.lineStyle(1, T.seam, 0.5); // joints d'about, décalés d'une latte à l'autre
    for (let i = 0; i < n; i++) { const x0 = -H + i * step, y = -H + ((i * 0.37) % 1) * 2 * H, a = P(x0, y), c = P(x0 + step, y); g.lineBetween(a.x, a.y, c.x, c.y); }
    if (wet) { g.fillStyle(0x4d7a4a, 0.3); g.fillPoints(quad(H), true); }
    // liseré intérieur : turquoise en cartoon, néon en nuit
    if (T.line) {
      if (T.edge) { g.lineStyle(9, T.line, 0.16); g.strokePoints(quad(H - 14), true); g.lineStyle(9, T.edge, 0.16); g.strokePoints(quad(O - 1), true); }
      g.lineStyle(3, T.line, 1); g.strokePoints(quad(H - 14), true);
    }
    if (T.edge) { g.lineStyle(3, T.edge, 1); g.strokePoints(quad(O - 2), true); }
    if (sudden) { g.lineStyle(6, C.red, 0.16); g.strokePoints(quad(H - 4), true); g.lineStyle(3, C.red, 0.95); g.strokePoints(quad(H - 4), true); }
    g.lineStyle(3, T.out, 1); g.strokePoints(o, true);
    g.lineStyle(2, T.out, 0.9); g.lineBetween(o[3].x, o[3].y, o[3].x, o[3].y + TH); g.lineBetween(o[2].x, o[2].y, o[2].x, o[2].y + TH); g.lineBetween(o[1].x, o[1].y, o[1].x, o[1].y + TH);
    g.lineBetween(o[3].x, o[3].y + TH, o[2].x, o[2].y + TH); g.lineBetween(o[2].x, o[2].y + TH, o[1].x, o[1].y + TH);
  }

  /* ---------- événements ---------- */
  handle(ev: Ev) {
    switch (ev.t) {
      case 'float': { const S = this.iso(ev.x, ev.y + 52); this.addFloat(S.x, S.y - 46, ev.text, ev.col, ev.size); break; }
      case 'sparks': { const S = this.iso(ev.x, ev.y, 14); for (let i = 0; i < ev.n; i++) this.parts.push({ x: S.x, y: S.y, vx: rand(-250, 250), vy: rand(-250, 250), life: rand(160, 340), t: 0, col: hex(ev.col), s: rand(1.5, 3), kind: 'dot' }); break; }
      case 'ring': this.rings.push({ x: ev.x, y: ev.y, r: ev.r, max: ev.max, life: ev.life, t: 0, col: hex(ev.col), w: ev.w }); break;
      case 'sfx': sfxAt(ev.n, ev.x, ev.y, ev.v); break;
      case 'final': { // éjection décisive : trois éclats de lignes de vitesse autour de la victime
        const V = this.lastSt?.f[ev.to]; if (!V) break; const S = this.iso(V.x, V.y, 14);
        for (const [d, n, len, col] of [[0, 24, 320, 0xffffff], [110, 20, 280, C.gold], [230, 28, 360, 0xff5a46]] as [number, number, number, number][]) this.later.push({ t: d, fn: () => this.burst(S.x, S.y, n, 60, len, col, 6, 420) });
        break;
      }
      case 'splash': { this.scare(ev.x, ev.y, 460, 230); this.splash(ev.x, ev.y, ev.fx, 1); const S = this.iso(ev.x, ev.y); this.addFloat(S.x, S.y - 42, ev.word, '#cfeef4', ev.word.length > 8 ? 24 : 28); break; }
      case 'hit': {
        const A = this.lastSt?.f[ev.by], T = this.lastSt?.f[ev.to]; if (!A || !T) break;
        const v = this.views[ev.to]; if (v) { v.flash = 110; v.squash = 1; }
        if (ev.v > 500) this.scare(T.x, T.y, 260, Math.min(140, ev.v / 6));
        { // sensation animé : éclat radial et traînées dans le sens du recul
          const S = this.iso(lerp(A.x, T.x, 0.7), lerp(A.y, T.y, 0.7), 14), sa = worldAngleToScreen(Math.atan2(T.y - A.y, T.x - A.x));
          if (ev.dragon) { this.burst(S.x, S.y, 22, 40, 240, C.gold, 6, 360); this.streaks(S.x, S.y, sa, 10, 300, 0xffffff, 4, 340); }
          else if (ev.red) { this.burst(S.x, S.y, 14, 30, 170, 0xff5a46, 5, 280); this.streaks(S.x, S.y, sa, 8, 240, 0xffffff, 3.5, 300); }
          else if (ev.v > 420) { this.burst(S.x, S.y, 9, 22, 100, 0xffffff, 3, 200); this.streaks(S.x, S.y, sa, 5, 150, 0xffffff, 2.5, 220); }
        }
        const x = lerp(A.x, T.x, 0.7), y = lerp(A.y, T.y, 0.7), ang = worldAngleToScreen(Math.atan2(T.y - A.y, T.x - A.x));
        if (ev.dragon) { this.fxw('fire', T.x, T.y, 10, 0, 4); this.fxw('hit', x, y, 16, 0, 3, C.gold); }
        else if (ev.red) { this.fxw('cross', x, y, 16, ang, 3, 0xff5a46); this.fxw('hit', x, y, 16, 0, 2.6); }
        else this.fxw('hit', x, y, 16, 0, 2);
        break;
      }
      case 'parry': {
        const D = this.lastSt?.f[ev.by]; if (!D) break;
        const x = D.x + Math.cos(D.facing) * 16, y = D.y + Math.sin(D.facing) * 16;
        if (ev.perfect) this.fxw('star', x, y, 16, 0, 2.6); else this.fxw('guard', x, y, 16, 0, 1.8);
        break;
      }
      case 'dodge': { const D = this.lastSt?.f[ev.by]; if (D) this.fxw('sparkle', D.x, D.y, 14, 0, 2.4, 0x8ff5d0); break; }
    }
  }
  addFloat(x: number, y: number, text: string, col: string, size = 17) {
    const tx = this.floatPool.pop() || this.scene.add.text(0, 0, '', { fontFamily: FONT_DISP, fontStyle: '800', stroke: '#0f1719', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(6);
    tx.setText(text).setColor(col).setFontSize(size).setVisible(true).setAlpha(1).setPosition(x, y);
    this.floats.push({ tx, x, y, t: 0, life: 1000 });
  }
  /* ---------- particules-sprites ---------- */
  spawn(key: string, x: number, y: number, o: SPOpts = {}): SP {
    const s = this.spPool.pop() || this.scene.add.sprite(0, 0, 'fx-' + key);
    s.setTexture('fx-' + key, o.f0 || 0).setVisible(true).setDepth(o.depth ?? 3.65).setTintMode(Phaser.TintModes.MULTIPLY);
    if (o.tint !== undefined) s.setTint(o.tint); else s.clearTint();
    const p: SP = { s, x, y, vx: 0, vy: 0, ay: 0, drag: 0, t: 0, life: 600, rot: 0, vr: 0, s0: 2, s1: 2, a: 1, fadeIn: 0, fade: true, fps: 0, loop: false, f0: 0, wob: 0, n: Math.max(1, s.texture.frameTotal - 1), ...o };
    if (p.emit) p.emit = { ...p.emit, acc: 0 };
    this.sparts.push(p); this.stepSP(p, 0); return p;
  }
  stepSP(p: SP, dt: number) {
    p.t += dt * 1000;
    if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
    p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const k = Math.min(1, p.t / p.life), fade = p.fade && k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    const fr = p.fps ? Math.floor(p.t / 1000 * p.fps) : 0, f = p.fps ? (p.loop ? (p.f0 + fr) % p.n : Math.min(p.n - 1, p.f0 + fr)) : p.f0;
    p.s.setFrame(f).setPosition(p.x + (p.wob ? Math.sin(p.t * 0.006) * p.wob : 0), p.y).setRotation(p.rot)
      .setScale(lerp(p.s0, p.s1, k)).setAlpha(p.a * (p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1) * fade);
    if (p.emit) { p.emit.acc += dt * 1000; while (p.emit.acc >= p.emit.every) { p.emit.acc -= p.emit.every; this.spawn(p.emit.key, p.x, p.y + 6, p.emit.opts); } }
  }
  after(ms: number, fn: () => void) { this.later.push({ t: ms, fn }); }

  // Particule semée au bout de l'arme par une traînée de la boutique.
  trailPart(id: string, x: number, y: number, dir: number) {
    const r = () => rand(-6, 6);
    switch (TRAINEES[id]?.part) {
      case 'flame': this.spawn('flame', x + r(), y + r(), { fps: 12, loop: true, f0: (Math.random() * 4) | 0, life: 420, s0: 1.7, s1: 0.5, vy: -50 }); break;
      case 'leaf': this.spawn('leaf', x + r(), y + r(), { f0: (Math.random() * 6) | 0, life: 950, s0: 2.4, s1: 1.8, vx: rand(-50, 50), vy: rand(-40, 10), ay: 50, drag: 1.5, rot: rand(0, TAU), vr: rand(-5, 5), wob: 5 }); break;
      case 'smoke': this.spawn('smoke', x + r(), y + r(), { fps: 14, life: 430, s0: 0.8, s1: 1.4, tint: 0x3a2b48, a: 0.75 }); break;
      case 'sparkle': this.spawn('sparkle', x + r() * 2, y + r() * 2, { fps: 16, life: 380, s0: 1.2, s1: 1.2, tint: Math.random() < 0.5 ? 0xfff1a8 : 0xffffff }); break;
      case 'splash': this.spawn('splash', x, y, { fps: 16, life: 380, s0: 0.9, s1: 1.1, rot: dir + Math.PI / 2, a: 0.85 }); break;
      case 'shuriken': this.spawn('shuriken', x, y, { life: 560, s0: 2.3, s1: 1.4, vr: 16, vx: Math.cos(dir) * 60 + r() * 8, vy: Math.sin(dir) * 60 + r() * 8, drag: 3 }); break;
      case 'coin': this.spawn('coin', x, y, { fps: 12, loop: true, f0: (Math.random() * 4) | 0, life: 650, s0: 2.3, s1: 2, vx: rand(-60, 60), vy: rand(-140, -60), ay: 520 }); break;
    }
  }

  // Plouf d'éjection : la gerbe d'eau, plus l'effet acheté en boutique par celui qui éjecte.
  splash(wx: number, wy: number, fx: string, s: number) {
    const S = this.iso(wx, wy), x = S.x, y = S.y; // l'effet se joue en coordonnées écran, à partir du point d'impact
    this.fx('splash', x, y - 22, 0, 4 * s);
    this.rings.push({ x: wx, y: wy, r: 6 * s, max: 60 * s, life: 650, t: 0, col: 0xd6f0f2, w: 5 * s });
    this.rings.push({ x: wx, y: wy, r: 4 * s, max: 96 * s, life: 1000, t: 0, col: 0x9fc9cf, w: 3 * s });
    for (let i = 0; i < 16; i++) { const a = rand(0, TAU), sp = rand(90, 260) * s; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 40, life: rand(380, 720), t: 0, col: 0xd3ecee, s: rand(2, 4) * s, kind: 'drop' }); }
    const mini = (p: SP) => { this.fx('splash', p.x, p.y - 8, 0, 2); this.rings.push({ x: p.x, y: p.y + 10, r: 4, max: 24, life: 600, t: 0, col: 0xd6f0f2, w: 3, scr: true }); };
    switch (fx) {
      case 'encre-e':
        this.spawn('smoke', x, y - 14, { fps: 10, life: 900, s0: 3.6, s1: 5, tint: 0x120c16, a: 0.9 });
        for (let i = 0; i < 4; i++) this.after(i * 90, () => this.spawn('smoke', x + rand(-50, 50), y + rand(-30, 10), { fps: 12, life: 700, s0: 1.8, s1: 2.8, tint: 0x1b1222, a: 0.85 }));
        for (let i = 0; i < 18; i++) { const a = rand(0, TAU), sp = rand(80, 240); this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, life: rand(500, 900), t: 0, col: 0x070707, s: rand(3, 6), kind: 'drop' }); }
        break;
      case 'petales':
        for (let i = 0; i < 28; i++) this.spawn('leaf', x + rand(-10, 10), y - 10, { f0: (Math.random() * 6) | 0, vx: rand(-240, 240), vy: rand(-420, -120), ay: 260, drag: 1.6, rot: rand(0, TAU), vr: rand(-8, 8), life: rand(1500, 2300), s0: 2.8, s1: 2.1, wob: 8 });
        break;
      case 'cochon':
        this.spawn('pig', x, y - 10, { fps: 8, loop: true, vx: rand(-90, 90), vy: -640, ay: 1120, vr: rand(-5, 5), life: 1150, s0: 3.4, s1: 3.4, fade: false, end: mini });
        this.after(250, () => this.addFloat(x, y - 120, 'GROIN !', '#f6b6cf', 22));
        break;
      case 'fantome':
        this.spawn('ghost', x, y - 24, { fps: 6, loop: true, vy: -60, life: 2600, s0: 2.4, s1: 3.8, a: 0.85, fadeIn: 300, wob: 16 });
        for (let i = 0; i < 6; i++) this.after(200 + i * 160, () => this.spawn('sparkle', x + rand(-40, 40), y - rand(40, 140), { fps: 16, life: 380, s0: 1.2, s1: 1.2, tint: 0xbff3ff }));
        this.after(350, () => this.addFloat(x, y - 130, 'BOUH !', '#bff3ff', 22));
        break;
      case 'feu':
        this.fx('fire', x, y - 20, 0, 3);
        for (let k = 0; k < 5; k++) this.after(120 + k * 210, () => {
          const bx = x + rand(-80, 80), by = y - rand(50, 150), col = [C.gold, 0xff5a46, 0x8ff5d0, 0xf6b6cf, 0xffffff][k % 5];
          this.fx('star', bx, by, 0, rand(2.4, 3.4), col);
          for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, sp = rand(140, 220); this.parts.push({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(450, 700), t: 0, col, s: 3, kind: 'dot' }); }
          sfxAt('ui', wx, wy, 0.6);
        });
        break;
      case 'tresor': {
        const chest = this.spawn('chest', x, y - 10, { f0: 0, vy: -500, ay: 900, life: 1150, s0: 3.4, s1: 3.4, fade: false, end: mini });
        this.after(520, () => {
          chest.f0 = 1; this.fx('sparkle', chest.x, chest.y - 10, 0, 3, C.gold);
          for (let i = 0; i < 18; i++) this.spawn('coin', chest.x, chest.y - 8, { fps: 12, loop: true, f0: (Math.random() * 4) | 0, vx: rand(-240, 240), vy: rand(-560, -240), ay: 950, life: rand(900, 1300), s0: 2.6, s1: 2.6, vr: rand(-4, 4) });
          sfxAt('coin', wx, wy, 1);
        });
        break;
      }
      case 'phenix':
        this.fx('fire', x, y - 24, 0, 4.5);
        this.spawn('bird', x, y - 24, { fps: 12, loop: true, vy: -110, ay: -300, life: 1900, s0: 2.6, s1: 4, fadeIn: 120, emit: { key: 'fire', every: 45, acc: 0, opts: { fps: 18, life: 300, s0: 1.3, s1: 0.5, vy: 40, a: 0.9 } } });
        this.after(200, () => this.addFloat(x, y - 140, 'RENAISSANCE !', '#ffb36b', 20));
        break;
    }
  }

  /* ---------- image par image ---------- */
  update(dt: number, time: number, st: any, myIdx: number, view: Phaser.Geom.Rectangle, marker: { x: number; y: number; r: number } | null = null) {
    const ms = dt * 1000;
    if (st && st.H < this.H - 0.01) { // le dojo rétrécit : des planches tombent à l'eau
      this.shrinkAcc += this.H - st.H;
      if (this.shrinkAcc >= 6) { this.shrinkAcc = 0; for (let i = 0; i < 3; i++) this.plank(st.H); }
    }
    const sudden = !!(st && st.duel && st.duel.sudden);
    if (st && (st.H !== this.H || (st.damp < 3) !== this.wet || sudden !== this.sudden)) this.drawArena(st.H, st.damp < 3, sudden);
    if (!st && (this.H !== 260 || this.sudden || this.wet)) this.drawArena(260);
    this.camView = view; this.updLife(dt, time);
    this.rippleT -= ms;
    if (this.rippleT <= 0) { this.rippleT = 260; const x = rand(view.x, view.right), y = rand(view.y, view.bottom); const w = unIso(x, y); if (y > this.bg.y - 100 && (Math.abs(w.x) > this.H + 40 || Math.abs(w.y) > this.H + 40)) this.ripples.push({ x, y, t: 0, life: 2400 }); }
    for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.t += ms; if (r.t > r.life) this.ripples.splice(i, 1); }
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += ms; if (p.t >= p.life) { this.parts.splice(i, 1); continue; } const d = p.kind === 'petal' ? 0.96 : p.kind === 'duck' ? 0.93 : 0.9; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= d; p.vy *= d; if (p.vr) p.rot! += p.vr * dt; }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += ms; if (r.t >= r.life) this.rings.splice(i, 1); }
    for (let i = this.slines.length - 1; i >= 0; i--) { const l = this.slines[i]; l.t += ms; if (l.t >= l.life) this.slines.splice(i, 1); }
    for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; l.t -= ms; if (l.t <= 0) { this.later.splice(i, 1); l.fn(); } }
    for (let i = this.sparts.length - 1; i >= 0; i--) { const p = this.sparts[i]; this.stepSP(p, dt); if (p.t >= p.life) { p.s.setVisible(false); this.spPool.push(p.s); this.sparts.splice(i, 1); if (p.end) p.end(p); } }
    for (let i = this.ghosts.length - 1; i >= 0; i--) { const gh = this.ghosts[i]; gh.t += ms; if (gh.t >= gh.life) { gh.s.setVisible(false); this.ghostPool.push(gh.s); this.ghosts.splice(i, 1); } else gh.s.setAlpha(0.45 * (1 - gh.t / gh.life)); }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.t += ms; const p = f.t / f.life; if (p >= 1) { f.tx.setVisible(false); this.floatPool.push(f.tx); this.floats.splice(i, 1); continue; } f.tx.setPosition(f.x, f.y - p * 30).setAlpha(1 - p * p); }

    this.drawWater(time);
    const g = this.dynG; g.clear();
    const tg = this.trailG; tg.clear();
    this.lastSt = st;
    const t = this.topG; t.clear();
    for (const r of this.rings) { const p = r.t / r.life, rad = Math.max(1, lerp(r.r, r.max, easeOut(p))); t.lineStyle(r.w * (1 - p) + 1, r.col, 1 - p); if (r.scr) t.strokeEllipse(r.x, r.y, 2 * rad, rad); else this.strokeC(t, r.x, r.y, rad); }
    this.drawLamp(t, 1, time);
    for (const l of this.slines) { // lignes de vitesse : elles jaillissent puis s'effilent
      const p = l.t / l.life, a = Math.cos(l.ang), b = Math.sin(l.ang), r0 = l.r0 + l.len * 0.5 * easeOut(p), r1 = l.r0 + l.len * easeOut(Math.min(1, p * 1.6));
      t.lineStyle(Math.max(1, l.w * (1 - p)), l.col, 1 - p * p); t.lineBetween(l.x + a * r0, l.y + b * r0, l.x + a * r1, l.y + b * r1);
    }
    this.drawParts(t);
    this.drawAmbient(t, view, time, dt);
    if (!st) { this.hideLabels(0); this.hideViews(0); return; }
    if (marker) { const p = 0.5 + 0.5 * Math.sin(time * 0.006); g.fillStyle(C.jade, 0.14 + 0.1 * p); this.fillC(g, marker.x, marker.y, marker.r); g.lineStyle(3, C.jade, 0.7 + 0.3 * p); this.strokeC(g, marker.x, marker.y, marker.r + p * 4); g.lineStyle(2, C.jade, 0.35 * (1 - p)); this.strokeC(g, marker.x, marker.y, marker.r + 10 + p * 14); }
    const fs = st.f.slice().sort((a: any, b: any) => (a.x + a.y) - (b.x + b.y));
    const twin = st.f.length === 2 && st.f[0].look.perso === st.f[1].look.perso;
    for (const e of fs) this.drawFighter(g, e, e.idx, time, dt, myIdx, twin && e.idx === 1);
    this.hideViews(st.f.length);
    for (const e of fs) this.drawTelegraph(g, e);
    for (const e of fs) { e.trail = (e.trail || []).filter((p: any) => time - p.t < 160); this.drawTrail(tg, e.trail, e.look.trainee, time); }
    this.drawLabels(st, myIdx);
  }

  plank(H: number) {
    const side = (Math.random() * 4) | 0, u = rand(-H, H), nx = side === 0 ? -1 : side === 1 ? 1 : 0, ny = side === 2 ? -1 : side === 3 ? 1 : 0;
    const x = nx ? nx * H : u, y = ny ? ny * H : u, S = this.iso(x, y), o = { x: (nx - ny) * ISO, y: (nx + ny) * ISO * 0.5 };
    this.spawn('wood', S.x, S.y, { f0: (Math.random() * 6) | 0, vx: o.x * rand(90, 190), vy: o.y * rand(90, 190) - rand(90, 170), ay: 560, vr: rand(-7, 7), life: 620, s0: 3, s1: 2.2, depth: 1.5,
      end: p => this.rings.push({ x: p.x, y: p.y, r: 3, max: 18, life: 600, t: 0, col: 0xd6f0f2, w: 2, scr: true }) });
  }

  // Lanterne sur pied aux angles du dojo ; flickering léger. back = angles du fond (sous le dojo), front = angle du bas.
  drawLamp(g: Phaser.GameObjects.Graphics, front: number, time = performance.now()) {
    const T = THEMES[this.theme]; if (!T.lamp) return;
    const fl = 0.85 + 0.15 * Math.sin(time * 0.004), d = this.H + 40;
    const corners: [number, number][] = front ? [[1, 1]] : [[-1, -1], [1, -1], [-1, 1]];
    for (const [sx, sy] of corners) {
      const p = this.iso(sx * d, sy * d);
      for (const [w, a] of [[70, 0.05], [46, 0.07], [28, 0.1]]) { g.fillStyle(T.glow || 0xffd88a, a * fl); g.fillEllipse(p.x, p.y - 63, w, w * 0.9); }
      g.fillStyle(0x2a1c10, 1); g.fillRect(p.x - 2, p.y - 54, 4, 56); g.fillRect(p.x - 12, p.y - 1, 24, 4); g.fillRect(p.x - 3, p.y - 6, 6, 6);
      g.fillStyle(T.out, 1); g.fillRoundedRect(p.x - 9, p.y - 76, 18, 26, 5);
      g.fillStyle(T.lamp!, 0.95 * fl); g.fillRoundedRect(p.x - 7, p.y - 74, 14, 22, 4);
      g.fillStyle(0xffffff, 0.35 * fl); g.fillRect(p.x - 4, p.y - 71, 3, 14);
    }
  }

  /* ---------- vie du lac : poissons, objets flottants, particules d'ambiance ---------- */
  // Point d'eau visible : devant l'horizon, dans le lac.
  lakePoint(near?: { x: number; y: number }): { x: number; y: number } {
    // toujours à l'extérieur du dojo ; si `near` est donné, un point proche de lui sur le pourtour, pour que les poissons contournent le dojo
    const R0 = 284; // demi-côté du dojo avec son cadre (taille de départ)
    for (let i = 0; i < 14; i++) {
      const a = (near ? Math.atan2(near.y, near.x) + rand(-1, 1) : rand(0, TAU)), ca = Math.cos(a), sa = Math.sin(a);
      const r = (R0 + 70) / Math.max(Math.abs(ca), Math.abs(sa)) + rand(10, 200), x = ca * r, y = sa * r;
      if (x + y > -380 && Math.hypot(x, y) < 900) return { x, y };
    }
    return { x: 420, y: 300 };
  }
  buildLife(name: string) {
    const L = LIFE[name] || LIFE.brume; this.life = L;
    for (const f of this.fish) f.rope.destroy(); for (const f of this.floaters) f.spr.destroy();
    this.fish = []; this.floaters = []; this.motes = [];
    const water = hex(THEMES[name].water);
    for (let i = 0; i < L.nFish; i++) {
      const p = this.lakePoint(), q = this.lakePoint(), kind = L.fish[i % L.fish.length], len = rand(46, 62);
      // un seul poisson déformé en tranches : l'onde de nage le parcourt de la tête à la queue
      const rope = (this.scene.add as any).rope(0, 0, 'fish-' + kind, undefined, 12).setDepth(0.5) as Phaser.GameObjects.Rope;
      const glow = kind === 'lanterne' || kind === 'braise';
      if (glow) rope.setBlendMode(Phaser.BlendModes.ADD); else rope.setColors(mix(0xffffff, water, 0.45)); // le poisson se fond dans l'eau
      rope.setAlpha(glow ? 0.75 : 0.62).setScale(len / 276);
      this.fish.push({ x: p.x, y: p.y, h: rand(0, TAU), tx: q.x, ty: q.y, sp: rand(18, 30), boost: 0, ph: rand(0, TAU), phase: rand(0, TAU), turn: 0, prevAng: 0, len, rip: rand(2, 8), kind, rope });
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand(-0.3, 0.3), r = rand(this.H + 150, 620), x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (x + y < -300) continue;
      const kind = L.floats[i % L.floats.length], big = kind === 'glace' || kind === 'lave';
      const spr = this.scene.add.image(0, 0, 'fl-' + kind).setDisplaySize(big ? 84 : 76, big ? 56 : 51).setDepth(0.6);
      this.floaters.push({ x, y, vx: 0, vy: 0, ph: rand(0, TAU), rot: rand(-0.3, 0.3), vr: rand(-0.04, 0.04), spr, kind });
    }
    for (let i = 0; i < 44; i++) this.motes.push({ x: Math.random(), y: Math.random(), vx: rand(-0.02, 0.02), vy: rand(0.02, 0.07), ph: rand(0, TAU), sz: 1 + ((Math.random() * 2) | 0) });
  }
  // Lignes de vitesse façon animé : éclat radial autour d'un impact (écran) ou traînées parallèles dans une direction.
  burst(x: number, y: number, n: number, r0: number, len: number, col: number, w: number, life: number) {
    for (let i = 0; i < n; i++) this.slines.push({ x, y, ang: (i / n) * TAU + rand(-0.12, 0.12), r0: r0 * rand(0.8, 1.2), len: len * rand(0.6, 1.3), w: w * rand(0.7, 1.3), t: 0, life: life * rand(0.8, 1.1), col });
  }
  streaks(x: number, y: number, ang: number, n: number, len: number, col: number, w: number, life: number) {
    const px = -Math.sin(ang), py = Math.cos(ang);
    for (let i = 0; i < n; i++) { const o = rand(-46, 46); this.slines.push({ x: x + px * o, y: y + py * o, ang, r0: rand(14, 50), len: len * rand(0.5, 1.2), w: w * rand(0.6, 1.2), t: 0, life: life * rand(0.8, 1.1), col }); }
  }
  // Un plouf ou un gros coup : poissons et feuilles s'écartent.
  scare(x: number, y: number, rad: number, power: number) {
    for (const f of this.fish) {
      const d = Math.hypot(f.x - x, f.y - y); if (d > rad) continue;
      const away = Math.atan2(f.y - y, f.x - x), k = 1 - d / rad;
      f.boost = Math.max(f.boost, power * k); f.tx = f.x + Math.cos(away) * 380; f.ty = f.y + Math.sin(away) * 380;
      if (f.tx + f.ty < -380) { const q = this.lakePoint(); f.tx = q.x; f.ty = q.y; }
    }
    for (const o of this.floaters) {
      const d = Math.hypot(o.x - x, o.y - y); if (d > rad) continue;
      const away = Math.atan2(o.y - y, o.x - x), k = 1 - d / rad;
      o.vx += Math.cos(away) * power * 0.5 * k; o.vy += Math.sin(away) * power * 0.5 * k; o.vr += rand(-0.2, 0.2) * k;
    }
  }
  updLife(dt: number, time: number) {
    const horizon = this.bg.y - 96;
    for (const f of this.fish) {
      f.boost *= Math.exp(-1.3 * dt);
      const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
      if (d < 60 || (f.x + f.y < -420)) { const q = this.lakePoint(f); f.tx = q.x; f.ty = q.y; }
      // virages larges et lents ; un coup de queue pousse, puis le poisson glisse
      const want = Math.atan2(dy, dx), turn = 0.7 + f.boost * 0.012;
      f.h += clamp(angDiff(f.h, want), -turn * dt, turn * dt);
      const base = f.sp * (0.8 + 0.3 * Math.sin(f.phase - 0.6)) + f.boost;
      f.phase += dt * (3.4 + base * 0.1);
      const vx = Math.cos(f.h), vy = Math.sin(f.h); f.x += vx * base * dt; f.y += vy * base * dt;
      const S = this.iso(f.x, f.y), sx = (vx - vy) * ISO, sy = (vx + vy) * ISO * 0.5, ang = Math.atan2(sy, sx), flip = sx < 0;
      f.turn += (angDiff(f.prevAng, ang) / Math.max(dt, 1e-3) - f.turn) * Math.min(1, dt * 6); f.prevAng = ang;
      const bend = clamp(f.turn * 0.35, -1, 1) * 16 * (flip ? 1 : -1); // en virage, la queue se déporte vers l'extérieur
      const pts = f.rope.points, n = pts.length, amp = 15 + f.boost * 0.08;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), tail = 1 - t; // t=0 : bout de la queue, t=1 : tête
        pts[i].y = amp * (0.1 + 0.9 * Math.pow(tail, 1.5)) * Math.sin(f.phase + 2.9 * t) + bend * tail * tail;
      }
      f.rope.setDirty();
      f.rope.setPosition(S.x, S.y).setRotation(ang).setFlipY(flip).setVisible(S.y > horizon);
      f.rip -= dt; if (f.rip <= 0) { f.rip = rand(5, 11); this.ripples.push({ x: S.x, y: S.y, t: 0, life: 1800 }); } // le poisson effleure la surface
    }
    for (const o of this.floaters) {
      o.vx *= Math.exp(-1.4 * dt); o.vy *= Math.exp(-1.4 * dt); o.vr *= Math.exp(-1.2 * dt);
      o.x += (o.vx + Math.cos(o.ph + time * 0.0003) * 2) * dt; o.y += (o.vy + Math.sin(o.ph + time * 0.00027) * 2) * dt; o.rot += (o.vr + 0.01) * dt * 0.3;
      if (Math.hypot(o.x, o.y) < this.H + 60) { const a = Math.atan2(o.y, o.x); o.vx += Math.cos(a) * 30 * dt * 10; o.vy += Math.sin(a) * 30 * dt * 10; }
      const S = this.iso(o.x, o.y);
      o.spr.setPosition(S.x, S.y + Math.sin(time * 0.002 + o.ph) * 1.5).setRotation(Math.sin(time * 0.0008 + o.ph) * 0.06 + o.rot * 0.2).setVisible(S.y > horizon);
    }
  }
  // Reflets de lumière qui scintillent sur l'eau (cases fixes dans le monde, donc stables quand la caméra bouge).
  drawGlints(g: Phaser.GameObjects.Graphics, time: number) {
    const v = this.camView; if (!v) return; const cell = 150, col = this.life.glint, top = this.bg.y - 100;
    for (let cx = Math.floor(v.x / cell); cx <= Math.floor(v.right / cell); cx++) for (let cy = Math.floor(v.y / cell); cy <= Math.floor(v.bottom / cell); cy++) {
      const h = Math.abs(Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453) % 1; if (h < 0.4) continue;
      const x = (cx + ((h * 7) % 1)) * cell, y = (cy + ((h * 13) % 1)) * cell; if (y < top) continue;
      const a = Math.sin(time * 0.0018 * (0.6 + h) + h * 30); if (a < 0.55) continue;
      g.fillStyle(col, 0.55 * (a - 0.4)); const w = 3 * (3 + ((h * 5) | 0));
      g.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, w, 3); g.fillRect(Math.round(x / 3) * 3 + 3, Math.round(y / 3) * 3 + 3, w - 6, 3);
    }
    for (const o of this.floaters) if (o.kind === 'lanterne') { // lanternes flottantes : halo
      const S = this.iso(o.x, o.y); g.fillStyle(0x2de6ea, 0.10); g.fillEllipse(S.x, S.y, 90, 40); g.fillStyle(0xff9a3c, 0.08); g.fillEllipse(S.x, S.y, 56, 26);
    }
  }
  // Particules d'ambiance en pixels : pétales, feuilles, neige, lucioles, braises.
  drawAmbient(g: Phaser.GameObjects.Graphics, view: Phaser.Geom.Rectangle, time: number, dt: number) {
    const kind = this.life.amb;
    for (const m of this.motes) {
      if (kind === 'ember') { m.y -= (0.05 + m.sz * 0.02) * dt; m.x += Math.sin(time * 0.002 + m.ph) * 0.02 * dt; }
      else if (kind === 'firefly') { m.x += Math.sin(time * 0.0007 + m.ph) * 0.03 * dt; m.y += Math.cos(time * 0.0009 + m.ph * 2) * 0.03 * dt; }
      else if (kind === 'snow') { m.y += (0.05 + m.sz * 0.03) * dt; m.x += Math.sin(time * 0.001 + m.ph) * 0.02 * dt; }
      else { m.x += (-0.02 + Math.sin(time * 0.0012 + m.ph) * 0.02) * dt; m.y += (0.03 + m.sz * 0.01) * dt; }
      if (m.y > 1.05) m.y = -0.05; if (m.y < -0.05) m.y = 1.05; if (m.x > 1.05) m.x = -0.05; if (m.x < -0.05) m.x = 1.05;
      const x = Math.round((view.x + m.x * view.width) / 3) * 3, y = Math.round((view.y + m.y * view.height) / 3) * 3, s = 3 * m.sz;
      if (kind === 'snow') { g.fillStyle(0xffffff, 0.85); g.fillRect(x, y, s, s); }
      else if (kind === 'petal') { g.fillStyle(m.sz > 1 ? 0xf6b6cf : 0xf4a15a, 0.9); g.fillRect(x, y, 6, 3); g.fillRect(x + 3, y + 3, 3, 3); }
      else if (kind === 'leaf') { g.fillStyle(0x9ab88a, 0.8); g.fillRect(x, y, 6, 3); g.fillRect(x + 3, y + 3, 3, 3); }
      else if (kind === 'ember') { const a = clamp(m.y * 1.6, 0.1, 1); g.fillStyle(m.sz > 1 ? 0xffd36a : 0xff7a2a, a); g.fillRect(x, y, s, s); }
      else { const a = Math.max(0, Math.sin(time * 0.003 + m.ph * 5)); if (a > 0.1) { g.fillStyle(this.theme === 'neon' ? (m.sz > 1 ? 0xff9a3c : 0x2de6ea) : 0xe9f07a, a * 0.9); g.fillRect(x, y, 3, 3); g.fillStyle(0xffffff, a * 0.5); g.fillRect(x, y, 3, 3); } }
    }
  }

  drawWater(time: number) {
    const g = this.waterG; g.clear(); const H = this.H;
    for (const r of this.ripples) { const p = r.t / r.life; g.lineStyle(2, 0xaadcdc, 0.09 * (1 - p)); g.strokeEllipse(r.x, r.y, 16 + p * 140, 8 + p * 70); }
    this.drawGlints(g, time);
    this.drawLamp(g, 0, time);
  }

  strike(e: any) {
    const a = e.atk, d = a.def, hits = d.hits || 1, reach = d.rg - 6, kick = d.limb !== 'poing';
    const lead = (a.startStance & 1) ? 1 : -1, useRear = d.tf === 'mirror' || d.tf === 'diag';
    let side = useRear ? -lead : lead;
    const rest = kick ? { x: useRear ? -9 : 11, y: side * 8 } : { x: 16, y: side * 6 }; let P: { x: number; y: number }, phase: string; const t = a.t;
    if (t < a.su) { const p = t / a.su; phase = 'su'; P = { x: rest.x - 8 * p, y: rest.y + side * 6 * p }; }
    else if (t < a.su + a.ac) {
      phase = 'ac'; const seg = a.ac / hits, k = Math.min(hits - 1, Math.floor((t - a.su) / seg)), p = ((t - a.su) - k * seg) / seg; if (k % 2 === 1) side = -side;
      if (d.sweep) { const span = d.arc >= 360 ? TAU : d.arc * RAD; const an = side * (span / 2) * (1 - 2 * p); P = { x: Math.cos(an) * reach, y: Math.sin(an) * reach }; }
      else { const q = Math.min(1, p * 2.2); P = { x: lerp(10, reach, easeOut(q)), y: side * 6 * (1 - q) }; }
    } else { phase = 'rc'; const p = clamp((t - a.su - a.ac) / a.rc, 0, 1); P = { x: lerp(reach * 0.9, rest.x, easeOut(p)), y: lerp(0, rest.y, p) }; }
    return { P, side, kick, phase, useRear };
  }

  drawTelegraph(g: Phaser.GameObjects.Graphics, e: any) {
    if (e.state === 'charge' && e.chargeDef) {
      const d = e.chargeDef, p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1), col = e.qi >= 100 ? C.gold : C.red;
      g.fillStyle(col, 0.1 + 0.16 * p); g.lineStyle(2, col, 0.35 + 0.3 * p);
      if (d.arc >= 360) { const r = d.rg + d.lunge * 0.4; this.fillC(g, e.x, e.y, r); this.strokeC(g, e.x, e.y, r); }
      else this.cone(g, e.x, e.y, e.facing, d.rg + d.lunge, Math.max(d.arc, 24) * RAD);
      return;
    }
    if (e.state !== 'attack' || !e.atk) return;
    const a = e.atk, d = a.def; if (a.t >= a.su + a.ac) return;
    if (a.kind !== 'red') return; // pas de cône pâle pour les petits coups : il brouille le combat. Seul le coup chargé est annoncé.
    const act = a.t >= a.su, red = true, col = a.dragon ? C.gold : C.red;
    const rr = d.rg + 10 + (red && !act ? d.lunge * (1 - a.t / a.su) * 0.8 : 0);
    g.fillStyle(col, red ? (act ? 0.42 : 0.22 + 0.14 * a.t / a.su) : (act ? 0.3 : 0.07 + 0.15 * a.t / a.su));
    g.lineStyle(red ? 3 : 2, col, act ? 0.9 : 0.45);
    if (d.arc >= 360) { this.fillC(g, e.x, e.y, rr); this.strokeC(g, e.x, e.y, rr); }
    else this.cone(g, e.x, e.y, e.facing, rr, Math.max(d.arc, 24) * RAD);
  }

  // Traînée de coup : au premier plan (au-dessus des personnages), en transparence.
  drawTrail(g: Phaser.GameObjects.Graphics, pts: any[], id: string, time: number) {
    if (pts.length < 2) return;
    const tr = TRAINEES[id] || TRAINEES.aucune, col = hex(tr.col), plain = id === 'aucune';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], age = clamp((time - b.t) / 160, 0, 1), k = 1 - age;
      if (b.red) { g.lineStyle(12 * k + 2, b.gold ? C.gold : C.red, 0.45 * k); g.lineBetween(a.x, a.y, b.x, b.y); }
      g.lineStyle((plain ? 5 : 8) * k + 1, col, (plain ? 0.5 : 0.62) * k); g.lineBetween(a.x, a.y, b.x, b.y);
      if (!plain) { g.lineStyle(2 * k + 0.5, 0xffffff, 0.45 * k); g.lineBetween(a.x, a.y, b.x, b.y); }
    }
  }

  /* ---------- combattants : sprites du pack Ninja Adventure ---------- */
  view(i: number): View {
    let v = this.views[i];
    if (!v) {
      const spr = this.scene.add.sprite(0, 0, 'persos', 0).setScale(PX).setDepth(2.5);
      const wpn = this.scene.add.image(0, 0, 'armes', 0).setOrigin(2 / 16, 0.5).setScale(PX).setDepth(2.5);
      v = this.views[i] = { spr, wpn, px: 0, py: 0, walk: 0, spd: 0, flash: 0, squash: 0, prevState: '', prevPhase: '', prevDrop: 0, ghostT: 0, full: false, partT: 0 };
    }
    return v;
  }
  hideViews(from: number) { for (let i = from; i < this.views.length; i++) { this.views[i].spr.setVisible(false); this.views[i].wpn.setVisible(false); } }

  // Effet sprite : x, y en coordonnées écran ; fxw prend un point du monde de la simulation et une hauteur en pixels.
  fxw(key: FxKey, x: number, y: number, h: number, rot: number, scale: number, tint?: number, alpha = 1, flat = 1) { const p = this.iso(x, y, h); this.fx(key, p.x, p.y, rot, scale, tint, alpha, flat); }
  fx(key: FxKey, x: number, y: number, rot: number, scale: number, tint?: number, alpha = 1, flat = 1) {
    const s = this.fxPool.pop() || this.scene.add.sprite(0, 0, 'fx-' + key);
    s.setTexture('fx-' + key, 0).setPosition(x, y).setRotation(rot).setScale(scale, scale * flat).setAlpha(alpha).setDepth(3.5).setVisible(true).setTintMode(Phaser.TintModes.MULTIPLY);
    if (tint !== undefined) s.setTint(tint); else s.clearTint();
    s.play('fx-' + key);
    s.once('animationcomplete', () => { s.setVisible(false); this.fxPool.push(s); });
  }
  ghost(v: View, depth: number, col: number) {
    const s = this.ghostPool.pop() || this.scene.add.sprite(0, 0, 'persos', 0);
    s.setFrame(v.spr.frame.name).setPosition(v.spr.x, v.spr.y).setScale(v.spr.scaleX, v.spr.scaleY).setRotation(v.spr.rotation)
      .setDepth(depth).setVisible(true).setAlpha(0.5).setTint(col).setTintMode(Phaser.TintModes.FILL);
    this.ghosts.push({ s, t: 0, life: 220 });
  }

  drawFighter(g: Phaser.GameObjects.Graphics, e: any, i: number, time: number, dt: number, myIdx: number, twin: boolean) {
    const v = this.view(i), spr = v.spr, wpn = v.wpn, st = e.state;
    // vitesse mesurée dans le monde, pour l'animation de marche
    const moved = Math.hypot(e.x - v.px, e.y - v.py); v.px = e.x; v.py = e.y;
    if (moved < 60) { v.walk += moved; v.spd += ((dt > 0 ? moved / dt : 0) - v.spd) * Math.min(1, dt * 12); }
    v.flash = Math.max(0, v.flash - dt * 1000); v.squash = Math.max(0, v.squash - dt * 6);
    if (st === 'dead') { spr.setVisible(false); wpn.setVisible(false); v.prevState = st; v.prevPhase = ''; v.prevDrop = 0; return; }

    let scale = 1, rot = 0, ga = 1;
    if (st === 'falling') { const p = clamp(e.fallT / 560, 0, 1); scale = 1 - 0.5 * p; rot = p * 5; ga = 1 - 0.35 * p; }
    if (e.spawnInv > 0 && st !== 'climb' && st !== 'falling' && !(e.dropT > 0)) ga *= 0.55 + 0.3 * Math.sin(time * 0.02);
    const dp = e.dropT > 0 ? e.dropT / 500 : 0; if (dp) { scale *= 1 + dp * 1.2; ga *= 1 - dp * 0.45; }

    // sol : ombre, anneau du joueur ou couleur de ceinture de l'adversaire (posés à plat sur le dojo)
    const G = this.iso(e.x, e.y);
    if (st !== 'falling' && st !== 'ledge') {
      g.fillStyle(0x1e180c, 0.34 * ga); g.fillEllipse(G.x, G.y + 2, 32 * (1 - dp * 0.5), 14 * (1 - dp * 0.5));
      const ringCol = i === myIdx ? C.ochre : hex(e.belt || beltOf(e.kos)[2]);
      g.lineStyle(2, ringCol, (i === myIdx ? 0.9 : 0.65) * ga); g.strokeEllipse(G.x, G.y + 2, 44, 21);
    }
    if (st === 'charge') {
      const p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1), pulse = 0.5 + 0.5 * Math.sin(time * 0.035), gold = e.qi >= 100, r = 26 + 10 * p + pulse * 3, col = gold ? C.gold : C.red;
      g.fillStyle(col, (0.14 + 0.22 * p) * ga); this.fillC(g, e.x, e.y, r); g.lineStyle(2 + 2 * p, col, ga); this.strokeC(g, e.x, e.y, r);
      if (p >= 1) { g.lineStyle(1.5, 0xffffff, 0.7 * ga); this.strokeC(g, e.x, e.y, r + 5); }
      if (p >= 1 && !v.full) { v.full = true; this.fxw('sparkle', e.x, e.y, 20, 0, 2.2, gold ? C.gold : 0xff6a50); }
    } else v.full = false;
    if (e.elanT > 0) { g.lineStyle(2, C.jade, ga * (0.4 + 0.4 * Math.sin(time * 0.02))); this.strokeC(g, e.x, e.y, 25); }
    if (e.qi >= 100 && st !== 'charge') { g.lineStyle(2, C.gold, ga * (0.35 + 0.25 * Math.sin(time * 0.012))); this.strokeC(g, e.x, e.y, 28); }
    if (st === 'parry') { const perf = e.stateT <= PARRY_PERFECT; g.fillStyle(C.bone, 0.12 * ga); this.fillC(g, e.x, e.y, 30); g.lineStyle(perf ? 4 : 3, perf ? C.gold : C.bone, (perf ? 1 : 0.85) * ga); this.strokeC(g, e.x, e.y, 30); }

    // image du personnage : colonne = direction à l'écran, ligne = posture
    const P = PERSOS[e.look.perso] || PERSOS['ninja-bleu'];
    const sa = worldAngleToScreen(e.facing), c = Math.cos(sa), sn = Math.sin(sa);
    // 4 directions du pack : la colonne suit l'angle à l'écran
    let col = Math.abs(c) >= Math.abs(sn) * 0.85 ? (c > 0 ? 3 : 2) : (sn > 0 ? 0 : 1), row = 0;
    let sx = 1, sy = 1;
    const S = st === 'attack' && e.atk && e.atk.def ? this.strike(e) : null;
    const moving = v.spd > 40;
    switch (st) {
      case 'idle': case 'frozen': row = moving ? Math.floor(v.walk / 13) % 4 : 0; break;
      case 'attack':
        if (!S || S.phase === 'su') { row = 0; const p = S ? clamp(e.atk.t / e.atk.su, 0, 1) : 0; sx = 1 + 0.08 * p; sy = 1 - 0.07 * p; }
        else if (S.phase === 'ac') { row = 4; sx = 0.94; sy = 1.07; }
        else row = clamp((e.atk.t - e.atk.su - e.atk.ac) / e.atk.rc, 0, 1) < 0.5 ? 4 : 0;
        break;
      case 'charge': row = 5; { const p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1); sx = 1 + 0.06 * p; sy = 1 - 0.08 * p; } break;
      case 'parry': row = 6; col = 1; break;
      case 'dodge': row = 5; break;
      case 'stun': case 'recover': case 'tumble': row = 6; col = 0; break;
      case 'falling': case 'ledge': case 'climb': row = 5; break;
    }
    const em = e.emote && e.emote.id; if (em === 'salut' && e.emote.t < 900 && st === 'idle') { row = 6; col = 0; }
    sx *= 1 + 0.22 * v.squash; sy *= 1 - 0.18 * v.squash;
    if (st === 'tumble') rot += e.stateT * 0.022;
    if (st === 'stun' || st === 'recover') rot += Math.sin(e.stateT * 0.03) * 0.16;
    const jit = st === 'charge' && v.full ? Math.sin(time * 0.09) * 1.2 : 0;
    const depth = 2.5 + (G.y + 4000) * 1e-5;
    spr.setVisible(true).setFrame(row * PERSO_COUNT * 4 + P.idx * 4 + col).setPosition(G.x + jit, G.y - 18)
      .setScale(PX * scale * sx, PX * scale * sy).setRotation(rot).setAlpha(ga).setDepth(depth);
    if (v.flash > 0) spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else {
      spr.setTintMode(Phaser.TintModes.MULTIPLY);
      if (st === 'charge') { const k = 0.35 + 0.35 * Math.sin(time * 0.035); spr.setTint(mix(0xffffff, e.qi >= 100 ? 0xffd25a : 0xff5a46, k)); }
      else if (twin) spr.setTint(0xffa890); // même personnage des deux côtés : le second est teinté
      else spr.clearTint();
    }

    // arme : suit le coup (estoc ou balayage), se pose sur le côté au repos. Calcul dans le monde, puis projection.
    const W = ARMES[e.look.arme] || ARMES.katana, WS = PX * 0.82, L = W.len * WS;
    const s0 = S ? e.atk.startStance : e.stance, side = (s0 & 1) ? 1 : -1;
    const f = e.facing, cf = Math.cos(f), sf = Math.sin(f);
    const toW = (lx: number, ly: number) => ({ x: e.x + cf * lx - sf * ly, y: e.y + sf * lx + cf * ly });
    let hand: { x: number; y: number } | null = null, wang = f, tip: { x: number; y: number } | null = null;
    if (S) {
      const la = Math.atan2(S.P.y, S.P.x), pl = Math.hypot(S.P.x, S.P.y);
      if (W.idx >= 0) { const d = Math.max(6, pl - L * 0.85); hand = toW(Math.cos(la) * d, Math.sin(la) * d); wang = f + la; tip = { x: hand.x + Math.cos(wang) * L, y: hand.y + Math.sin(wang) * L }; }
      else tip = toW(S.P.x, S.P.y);
    } else if (st === 'parry') { hand = toW(13, side * L * 0.45); wang = f - side * Math.PI / 2; }
    else if (st === 'charge') { hand = toW(-4, side * 11); wang = f + Math.PI - side * 0.55 + jit * 0.02; }
    else if (st === 'stun' || st === 'recover' || st === 'tumble' || st === 'falling') { hand = toW(4, side * 12); wang = f + side * 1.2 + Math.sin(e.stateT * 0.03) * 0.4 + rot; }
    else if (st !== 'ledge' && st !== 'climb') { hand = toW(3, side * 19); wang = f + side * 0.3; }
    if (W.idx >= 0 && hand) {
      const hs = this.iso(hand.x, hand.y, 14), wsa = worldAngleToScreen(wang), behind = !S && hs.y + 14 < G.y - 2;
      wpn.setVisible(true).setFrame(W.idx).setPosition(hs.x, hs.y).setRotation(wsa).setFlipY(Math.cos(wsa) < 0)
        .setScale(WS * scale).setAlpha(ga).setDepth(depth + (behind ? -1e-6 : 1e-6));
      if (v.flash > 0) wpn.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else wpn.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    } else wpn.setVisible(false);

    // traînée au bout de l'arme (points en coordonnées écran) et effets de coup
    if (S && S.phase === 'ac' && tip) {
      const T = this.iso(tip.x, tip.y, 14);
      (e.trail ||= []).push({ x: T.x, y: T.y, t: time, red: e.atk.kind === 'red', gold: e.atk.dragon });
      v.partT -= dt * 1000; if (v.partT <= 0) { v.partT = 26; this.trailPart(e.look.trainee, T.x, T.y, worldAngleToScreen(wang)); }
    }
    const phase = S ? S.phase : '';
    if (phase === 'ac' && v.prevPhase !== 'ac') {
      const d = e.atk.def, red = e.atk.kind === 'red', drag = e.atk.dragon, tint = red && !drag ? 0xff5040 : undefined;
      if (d.sweep && d.arc >= 300) this.fxw('spin', e.x, e.y, 6, 0, (d.rg * 2 + 16) / 32 * 1.1, tint, red ? 0.85 : 0.65, 0.5);
      else if (d.sweep) this.fxw('slash', e.x + cf * d.rg * 0.55, e.y + sf * d.rg * 0.55, 12, sa, d.rg / 32 * 1.3, tint, red ? 0.85 : 0.65);
      else this.fxw(drag ? 'fireslash' : 'arc', e.x + cf * d.rg * 0.72, e.y + sf * d.rg * 0.72, 12, sa, red ? 2.1 : 1.4, tint, red ? 0.85 : 0.6);
    }
    v.prevPhase = phase;
    if (st === 'dodge') {
      if (v.prevState !== 'dodge') this.fx('smoke', G.x, G.y - 4, 0, 1.5, undefined, 0.75);
      v.ghostT -= dt * 1000; if (v.ghostT <= 0) { v.ghostT = 40; this.ghost(v, depth - 1e-5, C.jade); }
    }
    if (st === 'ledge' && v.prevState !== 'ledge') this.fx('dust', G.x, G.y, 0, 1.6);
    if (v.prevDrop > 0 && !(e.dropT > 0)) this.fx('dust', G.x, G.y, 0, 2.2);
    v.prevDrop = e.dropT || 0; v.prevState = st;
  }

  drawParts(g: Phaser.GameObjects.Graphics) {
    for (const p of this.parts) {
      const k = p.t / p.life;
      if (p.kind === 'duck') {
        const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1, s = p.s * (k < 0.12 ? k / 0.12 * 1.2 : 1 + 0.06 * Math.sin(p.t * 0.01));
        g.save(); g.translateCanvas(p.x, p.y); g.rotateCanvas(p.rot! + Math.sin(p.t * 0.004) * 0.2); g.scaleCanvas(s, s);
        g.fillStyle(0xf6d23c, a); g.fillEllipse(0, 0, 16, 12); g.fillCircle(6, -1, 4.2); g.fillStyle(0xef7d22, a); g.fillTriangle(9.5, -2, 14, -0.5, 9.5, 1); g.fillStyle(0x111111, a); g.fillRect(6.5, -3.5, 1.4, 1.4);
        g.restore(); continue;
      }
      g.fillStyle(p.col, 1 - k);
      if (p.kind === 'petal') { g.save(); g.translateCanvas(p.x, p.y); g.rotateCanvas(p.rot!); g.fillEllipse(0, 0, p.s * 2, p.s * 1.1); g.restore(); }
      else if (p.kind === 'drop') g.fillCircle(p.x, p.y, p.s * (1 - k * 0.5));
      else g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
  }

  ensureLabels(n: number) {
    while (this.labels.length < n) {
      const name = this.scene.add.text(0, 0, '', { fontFamily: FONT_BODY, fontStyle: '600', fontSize: '11px', color: '#fffaec', stroke: '#0f1719', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1).setDepth(5);
      const pct = this.scene.add.text(0, 0, '', { fontFamily: FONT_DISP, fontStyle: '800', fontSize: '16px', color: '#ecdfc6', stroke: '#0f1719', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1).setDepth(5);
      const emo = this.scene.add.text(0, 0, '', { fontFamily: FONT_BODY, fontStyle: '700', fontSize: '12px', color: '#0f1719', backgroundColor: '#fffaec', padding: { x: 7, y: 3 }, resolution: 2 }).setOrigin(0.5, 1).setDepth(7).setVisible(false);
      this.labels.push({ name, pct, emo });
    }
  }
  hideLabels(from: number) { for (let i = from; i < this.labels.length; i++) { const l = this.labels[i]; l.name.setVisible(false); l.pct.setVisible(false); l.emo.setVisible(false); } }
  drawLabels(st: any, myIdx: number) {
    this.ensureLabels(st.f.length);
    st.f.forEach((e: any, i: number) => {
      const L = this.labels[i], G = this.iso(e.x, e.y); const vis = e.state !== 'dead';
      const a = e.state === 'falling' ? clamp(1 - e.fallT / 400, 0, 1) : 1;
      L.name.setVisible(false); L.pct.setVisible(false); void a;
      if (e.emote && vis && EMOTES[e.emote.id]) { const t = e.emote.t, al = t < 150 ? t / 150 : t > 1500 ? 1 - (t - 1500) / 300 : 1; L.emo.setVisible(true).setText(EMOTES[e.emote.id]).setPosition(G.x, G.y - 52).setAlpha(clamp(al, 0, 1)); }
      else L.emo.setVisible(false);
    });
    this.hideLabels(st.f.length);
  }
}
