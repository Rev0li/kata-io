// Rendu Phaser du dojo et des combattants. Le décor et les signaux de combat (cônes, anneaux)
// sont dessinés en code ; les combattants, les armes et les impacts viennent du pack
// Ninja Adventure (Pixel-boy, CC0). Les effets arrivent sous forme d'événements de la simulation.
import Phaser from 'phaser';
import { TAU, RAD, CHARGE_FULL, CHARGE_START, PARRY_PERFECT, PERSOS, PERSO_COUNT, ARMES, TRAINEES, EMOTES, beltOf } from '../sim/data';
import { clamp, lerp, easeOut, Ev } from '../sim/sim';
import { sfxAt } from './audio';
import { PX, FxKey } from './assets';

const C = { ink: 0x0f1719, bone: 0xecdfc6, mist: 0x93a59f, ochre: 0xe0a243, jade: 0x62c2a2, red: 0xe5483a, gold: 0xf2c14e, mat: 0xbcab78, mat2: 0xb1a06c, heri: 0x2b2417, rim: 0x3a281a, rim2: 0x523822, water: 0x0d2a30 };
export const WATER_HEX = '#0d2a30';
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
interface Ring { x: number; y: number; r: number; max: number; t: number; life: number; col: number; w: number }
interface View { spr: Phaser.GameObjects.Sprite; wpn: Phaser.GameObjects.Image; px: number; py: number; walk: number; spd: number; flash: number; squash: number; prevState: string; prevPhase: string; prevDrop: number; ghostT: number; full: boolean }

export class Renderer {
  scene: Phaser.Scene;
  floor: Phaser.GameObjects.TileSprite; edgeG: Phaser.GameObjects.Graphics; wet = false;
  waterG: Phaser.GameObjects.Graphics; arenaG: Phaser.GameObjects.Graphics; dynG: Phaser.GameObjects.Graphics; topG: Phaser.GameObjects.Graphics;
  parts: Part[] = []; rings: Ring[] = []; ripples: { x: number; y: number; t: number; life: number }[] = [];
  floats: { tx: Phaser.GameObjects.Text; x: number; y: number; t: number; life: number }[] = [];
  floatPool: Phaser.GameObjects.Text[] = [];
  labels: { name: Phaser.GameObjects.Text; pct: Phaser.GameObjects.Text; emo: Phaser.GameObjects.Text }[] = [];
  koi: { a: number; off: number; sp: number; col: number; spot: boolean; size: number; wig: number }[] = [];
  views: View[] = []; fxPool: Phaser.GameObjects.Sprite[] = [];
  ghosts: { s: Phaser.GameObjects.Sprite; t: number; life: number }[] = []; ghostPool: Phaser.GameObjects.Sprite[] = [];
  lastSt: any = null;
  H = 260; rippleT = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.waterG = scene.add.graphics().setDepth(0);
    this.arenaG = scene.add.graphics().setDepth(1);
    this.floor = scene.add.tileSprite(0, 0, 520, 520, 'dojo').setDepth(1.01).setTileScale(PX).setAlpha(0.42);
    this.edgeG = scene.add.graphics().setDepth(1.02);
    this.dynG = scene.add.graphics().setDepth(2);
    this.topG = scene.add.graphics().setDepth(4);
    for (let i = 0; i < 7; i++) this.koi.push({ a: rand(0, TAU), off: rand(60, 380), sp: rand(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1), col: [0xe8742f, 0xf2efe6, 0xe05a2a, 0xf4b24a][(Math.random() * 4) | 0], spot: Math.random() < 0.6, size: rand(0.8, 1.25), wig: rand(0, TAU) });
    this.drawArena(this.H);
  }

  /* ---------- dojo : cadre en bois dessiné, sol en tuiles du temple (pixel art) ---------- */
  drawArena(H: number, wet = false) {
    this.H = H; this.wet = wet; const g = this.arenaG; g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRect(-H - 12 + 18, -H - 12 + 26, 2 * H + 24, 2 * H + 24);
    g.fillStyle(C.rim, 1); g.fillRect(-H - 12, -H - 12, 2 * H + 24, 2 * H + 24);
    g.fillStyle(C.rim2, 1); g.fillRect(-H - 6, -H - 6, 2 * H + 12, 2 * H + 12);
    g.fillStyle(wet ? 0x74866c : 0xb59f72, 1); g.fillRect(-H, -H, 2 * H, 2 * H);
    // le motif reste accroché au centre du dojo, quelle que soit sa taille
    const tile = 48, off = ((-H / PX) % tile + tile) % tile;
    this.floor.setTexture(wet ? 'dojo-mousse' : 'dojo').setSize(2 * H, 2 * H).setTilePosition(off, off).setVisible(true);
    const e = this.edgeG; e.clear();
    e.lineStyle(4, C.heri, 0.9); e.strokeRect(-H + 2, -H + 2, 2 * H - 4, 2 * H - 4);
    e.lineStyle(2, 0xfff1c4, 0.18); e.strokeRect(-H + 6, -H + 6, 2 * H - 12, 2 * H - 12);
  }

  /* ---------- événements ---------- */
  handle(ev: Ev) {
    switch (ev.t) {
      case 'float': this.addFloat(ev.x, ev.y, ev.text, ev.col, ev.size); break;
      case 'sparks': for (let i = 0; i < ev.n; i++) this.parts.push({ x: ev.x, y: ev.y, vx: rand(-250, 250), vy: rand(-250, 250), life: rand(160, 340), t: 0, col: hex(ev.col), s: rand(1.5, 3), kind: 'dot' }); break;
      case 'ring': this.rings.push({ x: ev.x, y: ev.y, r: ev.r, max: ev.max, life: ev.life, t: 0, col: hex(ev.col), w: ev.w }); break;
      case 'sfx': sfxAt(ev.n, ev.x, ev.y, ev.v); break;
      case 'splash': this.fx('splash', ev.x, ev.y - 22, 0, 4); this.splash(ev.x, ev.y, ev.fx, 1); this.addFloat(ev.x, ev.y - 20, ev.word, '#cfeef4', ev.word.length > 8 ? 24 : 28); break;
      case 'hit': {
        const A = this.lastSt?.f[ev.by], T = this.lastSt?.f[ev.to]; if (!A || !T) break;
        const v = this.views[ev.to]; if (v) { v.flash = 110; v.squash = 1; }
        const x = lerp(A.x, T.x, 0.7), y = lerp(A.y, T.y, 0.7) - 4, ang = Math.atan2(T.y - A.y, T.x - A.x);
        if (ev.dragon) { this.fx('fire', T.x, T.y - 8, 0, 4); this.fx('hit', x, y, 0, 3, C.gold); }
        else if (ev.red) { this.fx('cross', x, y, ang, 3, 0xff5a46); this.fx('hit', x, y, 0, 2.6); }
        else this.fx('hit', x, y, 0, 2);
        break;
      }
      case 'parry': {
        const D = this.lastSt?.f[ev.by]; if (!D) break;
        const x = D.x + Math.cos(D.facing) * 16, y = D.y + Math.sin(D.facing) * 16 - 4;
        if (ev.perfect) this.fx('star', x, y, 0, 2.6); else this.fx('guard', x, y, 0, 1.8);
        break;
      }
      case 'dodge': { const D = this.lastSt?.f[ev.by]; if (D) this.fx('sparkle', D.x, D.y - 6, 0, 2.4, 0x8ff5d0); break; }
    }
  }
  addFloat(x: number, y: number, text: string, col: string, size = 17) {
    const tx = this.floatPool.pop() || this.scene.add.text(0, 0, '', { fontFamily: FONT_DISP, fontStyle: '800', stroke: '#0f1719', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(6);
    tx.setText(text).setColor(col).setFontSize(size).setVisible(true).setAlpha(1).setPosition(x, y);
    this.floats.push({ tx, x, y, t: 0, life: 1000 });
  }
  splash(x: number, y: number, fx: string, s: number) {
    this.rings.push({ x, y, r: 6 * s, max: 60 * s, life: 650, t: 0, col: 0xd6f0f2, w: 5 * s });
    this.rings.push({ x, y, r: 4 * s, max: 96 * s, life: 1000, t: 0, col: 0x9fc9cf, w: 3 * s });
    for (let i = 0; i < 16; i++) { const a = rand(0, TAU), sp = rand(90, 260) * s; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(380, 720), t: 0, col: 0xd3ecee, s: rand(2, 4) * s, kind: 'drop' }); }
    if (fx === 'petales') for (let i = 0; i < 24; i++) { const a = rand(0, TAU), sp = rand(40, 170) * s; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(1200, 1800), t: 0, col: Math.random() < 0.5 ? 0xf2a7c3 : 0xf9d3e0, s: rand(3, 5) * s, kind: 'petal', rot: rand(0, TAU), vr: rand(-6, 6) }); }
    if (fx === 'encre-e') { this.rings.push({ x, y, r: 10 * s, max: 84 * s, life: 900, t: 0, col: 0x080808, w: 12 * s }); for (let i = 0; i < 18; i++) { const a = rand(0, TAU), sp = rand(80, 240) * s; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(500, 900), t: 0, col: 0x070707, s: rand(3, 6) * s, kind: 'drop' }); } }
    if (fx === 'feu') { for (let i = 0; i < 40; i++) { const a = rand(0, TAU), sp = rand(180, 430) * s; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(500, 900), t: 0, col: hsvInt(Math.random() * 360), s: rand(2, 3.5) * s, kind: 'dot' }); } this.rings.push({ x, y, r: 10, max: 110 * s, life: 700, t: 0, col: C.gold, w: 3 }); }
    if (fx === 'canards') for (let i = 0; i < 6; i++) { const a = rand(0, TAU), sp = rand(30, 110) * s; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(2000, 2600), t: 0, col: 0xf6d23c, s, kind: 'duck', rot: rand(0, TAU) }); }
  }

  /* ---------- image par image ---------- */
  update(dt: number, time: number, st: any, myIdx: number, view: Phaser.Geom.Rectangle, marker: { x: number; y: number; r: number } | null = null) {
    if (st && (st.H !== this.H || (st.damp < 3) !== this.wet)) this.drawArena(st.H, st.damp < 3);
    const ms = dt * 1000;
    for (const k of this.koi) k.a += k.sp * dt;
    this.rippleT -= ms;
    if (this.rippleT <= 0) { this.rippleT = 260; const x = rand(view.x, view.right), y = rand(view.y, view.bottom); if (Math.abs(x) > this.H + 20 || Math.abs(y) > this.H + 20) this.ripples.push({ x, y, t: 0, life: 2400 }); }
    for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.t += ms; if (r.t > r.life) this.ripples.splice(i, 1); }
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += ms; if (p.t >= p.life) { this.parts.splice(i, 1); continue; } const d = p.kind === 'petal' ? 0.96 : p.kind === 'duck' ? 0.93 : 0.9; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= d; p.vy *= d; if (p.vr) p.rot! += p.vr * dt; }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += ms; if (r.t >= r.life) this.rings.splice(i, 1); }
    for (let i = this.ghosts.length - 1; i >= 0; i--) { const gh = this.ghosts[i]; gh.t += ms; if (gh.t >= gh.life) { gh.s.setVisible(false); this.ghostPool.push(gh.s); this.ghosts.splice(i, 1); } else gh.s.setAlpha(0.45 * (1 - gh.t / gh.life)); }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.t += ms; const p = f.t / f.life; if (p >= 1) { f.tx.setVisible(false); this.floatPool.push(f.tx); this.floats.splice(i, 1); continue; } f.tx.setPosition(f.x, f.y - p * 30).setAlpha(1 - p * p); }

    this.drawWater(time);
    const g = this.dynG; g.clear();
    this.lastSt = st;
    if (!st) { this.hideLabels(0); this.hideViews(0); return; }
    if (marker) { const p = 0.5 + 0.5 * Math.sin(time * 0.006); g.fillStyle(C.jade, 0.14 + 0.1 * p); g.fillCircle(marker.x, marker.y, marker.r); g.lineStyle(3, C.jade, 0.7 + 0.3 * p); g.strokeCircle(marker.x, marker.y, marker.r + p * 4); g.lineStyle(2, C.jade, 0.35 * (1 - p)); g.strokeCircle(marker.x, marker.y, marker.r + 10 + p * 14); }
    const fs = st.f.slice().sort((a: any, b: any) => a.y - b.y);
    const twin = st.f.length === 2 && st.f[0].look.perso === st.f[1].look.perso;
    for (const e of fs) this.drawFighter(g, e, e.idx, time, dt, myIdx, twin && e.idx === 1);
    this.hideViews(st.f.length);
    for (const e of fs) this.drawTelegraph(g, e);
    for (const e of fs) this.drawTrail(g, e, time);
    const t = this.topG; t.clear();
    for (const r of this.rings) { const p = r.t / r.life; t.lineStyle(r.w * (1 - p) + 1, r.col, 1 - p); t.strokeCircle(r.x, r.y, Math.max(1, lerp(r.r, r.max, easeOut(p)))); }
    this.drawParts(t);
    this.drawLabels(st, myIdx);
  }

  drawWater(time: number) {
    const g = this.waterG; g.clear(); const H = this.H;
    g.lineStyle(2, 0xaadcdc, 0.08);
    for (const r of this.ripples) { const p = r.t / r.life; g.lineStyle(2, 0xaadcdc, 0.09 * (1 - p)); g.strokeEllipse(r.x, r.y, 16 + p * 140, 10 + p * 84); }
    for (const k of this.koi) {
      const rr = H * 1.3 + k.off, x = Math.cos(k.a) * rr, y = Math.sin(k.a) * rr * 0.9;
      const dir = k.a + (k.sp > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(time * 0.006 + k.wig) * 0.18;
      g.save(); g.translateCanvas(x, y); g.rotateCanvas(dir); g.scaleCanvas(k.size, k.size);
      g.fillStyle(k.col, 0.62); g.fillEllipse(0, 0, 32, 12); g.fillTriangle(-14, 0, -24, -6, -24, 6);
      if (k.spot) { g.fillStyle(0xf6f1e6, 0.62); g.fillEllipse(4, 0, 10, 7); }
      g.restore();
    }
    const fl = 0.85 + 0.15 * Math.sin(time * 0.004);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = sx * (H + 10), y = sy * (H + 10); g.fillStyle(0xf2be5a, 0.12 * fl); g.fillCircle(x, y, 46); g.fillStyle(0x2a1c10, 1); g.fillRect(x - 10, y - 10, 20, 20); g.fillStyle(0xffd682, 0.85 * fl); g.fillRect(x - 6, y - 6, 12, 12); }
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
      g.save(); g.translateCanvas(e.x, e.y); g.rotateCanvas(e.facing);
      g.fillStyle(col, 0.1 + 0.16 * p); g.lineStyle(2, col, 0.35 + 0.3 * p);
      if (d.arc >= 360) { g.fillCircle(0, 0, d.rg + d.lunge * 0.4); g.strokeCircle(0, 0, d.rg + d.lunge * 0.4); }
      else { const ar = Math.max(d.arc, 24) * RAD; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, d.rg + d.lunge, -ar / 2, ar / 2); g.closePath(); g.fillPath(); g.strokePath(); }
      g.restore(); return;
    }
    if (e.state !== 'attack' || !e.atk) return;
    const a = e.atk, d = a.def; if (a.t >= a.su + a.ac) return;
    const act = a.t >= a.su, red = a.kind === 'red', col = red ? (a.dragon ? C.gold : C.red) : 0xfffaf0;
    const rr = d.rg + 10 + (red && !act ? d.lunge * (1 - a.t / a.su) * 0.8 : 0);
    g.save(); g.translateCanvas(e.x, e.y); g.rotateCanvas(e.facing);
    g.fillStyle(col, red ? (act ? 0.42 : 0.22 + 0.14 * a.t / a.su) : (act ? 0.3 : 0.07 + 0.15 * a.t / a.su));
    g.lineStyle(red ? 3 : 2, col, act ? 0.9 : 0.45);
    if (d.arc >= 360) { g.fillCircle(0, 0, rr); g.strokeCircle(0, 0, rr); }
    else { const ar = Math.max(d.arc, 24) * RAD; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rr, -ar / 2, ar / 2); g.closePath(); g.fillPath(); g.strokePath(); }
    g.restore();
  }

  drawTrail(g: Phaser.GameObjects.Graphics, e: any, time: number) {
    if (!e.trail) e.trail = [];
    e.trail = e.trail.filter((p: any) => time - p.t < 150);
    if (e.trail.length < 2) return;
    const tr = TRAINEES[e.look.trainee] || TRAINEES.aucune, col = tr.col;
    for (let i = 1; i < e.trail.length; i++) {
      const a = e.trail[i - 1], b = e.trail[i], age = clamp((time - b.t) / 150, 0, 1);
      if (b.red) { g.lineStyle(11 * (1 - age) + 2, b.gold ? C.gold : C.red, 0.55 * (1 - age)); g.lineBetween(a.x, a.y, b.x, b.y); }
      const c = col === 'rainbow' ? hsvInt((time * 0.3 + i * 40) % 360) : col ? hex(col) : 0xfffaec;
      g.lineStyle((col ? 7 : 4) * (1 - age) + 1, c, (col ? 0.9 : 0.5) * (1 - age)); g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  /* ---------- combattants : sprites du pack Ninja Adventure ---------- */
  view(i: number): View {
    let v = this.views[i];
    if (!v) {
      const spr = this.scene.add.sprite(0, 0, 'persos', 0).setScale(PX).setDepth(2.5);
      const wpn = this.scene.add.image(0, 0, 'armes', 0).setOrigin(2 / 16, 0.5).setScale(PX).setDepth(2.5);
      v = this.views[i] = { spr, wpn, px: 0, py: 0, walk: 0, spd: 0, flash: 0, squash: 0, prevState: '', prevPhase: '', prevDrop: 0, ghostT: 0, full: false };
    }
    return v;
  }
  hideViews(from: number) { for (let i = from; i < this.views.length; i++) { this.views[i].spr.setVisible(false); this.views[i].wpn.setVisible(false); } }

  fx(key: FxKey, x: number, y: number, rot: number, scale: number, tint?: number, alpha = 1) {
    const s = this.fxPool.pop() || this.scene.add.sprite(0, 0, 'fx-' + key);
    s.setTexture('fx-' + key, 0).setPosition(x, y).setRotation(rot).setScale(scale).setAlpha(alpha).setDepth(3.5).setVisible(true).setTintMode(Phaser.TintModes.MULTIPLY);
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
    // vitesse mesurée à l'écran, pour l'animation de marche
    const moved = Math.hypot(e.x - v.px, e.y - v.py); v.px = e.x; v.py = e.y;
    if (moved < 60) { v.walk += moved; v.spd += ((dt > 0 ? moved / dt : 0) - v.spd) * Math.min(1, dt * 12); }
    v.flash = Math.max(0, v.flash - dt * 1000); v.squash = Math.max(0, v.squash - dt * 6);
    if (st === 'dead') { spr.setVisible(false); wpn.setVisible(false); v.prevState = st; v.prevPhase = ''; v.prevDrop = 0; return; }

    let scale = 1, rot = 0, ga = 1;
    if (st === 'falling') { const p = clamp(e.fallT / 560, 0, 1); scale = 1 - 0.5 * p; rot = p * 5; ga = 1 - 0.35 * p; }
    if (e.spawnInv > 0 && st !== 'climb' && st !== 'falling' && !(e.dropT > 0)) ga *= 0.55 + 0.3 * Math.sin(time * 0.02);
    const dp = e.dropT > 0 ? e.dropT / 500 : 0; if (dp) { scale *= 1 + dp * 1.2; ga *= 1 - dp * 0.45; }

    // sol : ombre, anneau du joueur ou couleur de ceinture de l'adversaire
    const fy = e.y + 15;
    if (st !== 'falling' && st !== 'ledge') {
      g.fillStyle(0x1e180c, 0.32 * ga); g.fillEllipse(e.x, fy, 34 * (1 - dp * 0.5), 12 * (1 - dp * 0.5));
      const ringCol = i === myIdx ? C.ochre : hex(e.belt || beltOf(e.kos)[2]);
      g.lineStyle(2, ringCol, (i === myIdx ? 0.85 : 0.6) * ga); g.strokeEllipse(e.x, fy, 46, 17);
    }
    if (st === 'charge') {
      const p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1), pulse = 0.5 + 0.5 * Math.sin(time * 0.035), gold = e.qi >= 100, r = 26 + 10 * p + pulse * 3, col = gold ? C.gold : C.red;
      g.fillStyle(col, (0.14 + 0.22 * p) * ga); g.fillCircle(e.x, e.y, r); g.lineStyle(2 + 2 * p, col, ga); g.strokeCircle(e.x, e.y, r);
      if (p >= 1) { g.lineStyle(1.5, 0xffffff, 0.7 * ga); g.strokeCircle(e.x, e.y, r + 5); }
      if (p >= 1 && !v.full) { v.full = true; this.fx('sparkle', e.x, e.y - 8, 0, 2.2, gold ? C.gold : 0xff6a50); }
    } else v.full = false;
    if (e.elanT > 0) { g.lineStyle(2, C.jade, ga * (0.4 + 0.4 * Math.sin(time * 0.02))); g.strokeCircle(e.x, e.y, 25); }
    if (e.qi >= 100 && st !== 'charge') { g.lineStyle(2, C.gold, ga * (0.35 + 0.25 * Math.sin(time * 0.012))); g.strokeCircle(e.x, e.y, 28); }
    if (st === 'parry') { const perf = e.stateT <= PARRY_PERFECT; g.fillStyle(C.bone, 0.12 * ga); g.fillCircle(e.x, e.y, 30); g.lineStyle(perf ? 4 : 3, perf ? C.gold : C.bone, (perf ? 1 : 0.85) * ga); g.strokeCircle(e.x, e.y, 30); }

    // image du personnage : colonne = direction, ligne = posture
    const P = PERSOS[e.look.perso] || PERSOS['ninja-bleu'];
    const c = Math.cos(e.facing), sn = Math.sin(e.facing);
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
    const depth = 2.5 + (e.y + 2000) * 1e-5;
    spr.setVisible(true).setFrame(row * PERSO_COUNT * 4 + P.idx * 4 + col).setPosition(e.x + jit, e.y - 4)
      .setScale(PX * scale * sx, PX * scale * sy).setRotation(rot).setAlpha(ga).setDepth(depth);
    if (v.flash > 0) spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else {
      spr.setTintMode(Phaser.TintModes.MULTIPLY);
      if (st === 'charge') { const k = 0.35 + 0.35 * Math.sin(time * 0.035); spr.setTint(mix(0xffffff, e.qi >= 100 ? 0xffd25a : 0xff5a46, k)); }
      else if (twin) spr.setTint(0xffc8b4);
      else spr.clearTint();
    }

    // arme : suit le coup (estoc ou balayage), se pose sur le côté au repos
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
      const behind = !S && hand.y < e.y - 3;
      wpn.setVisible(true).setFrame(W.idx).setPosition(hand.x, hand.y - 2).setRotation(wang).setFlipY(Math.cos(wang) < 0)
        .setScale(WS * scale).setAlpha(ga).setDepth(depth + (behind ? -1e-6 : 1e-6));
      if (v.flash > 0) wpn.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else wpn.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    } else wpn.setVisible(false);

    // traînée au bout de l'arme et effets de coup
    if (S && S.phase === 'ac' && tip) (e.trail ||= []).push({ x: tip.x, y: tip.y, t: time, red: e.atk.kind === 'red', gold: e.atk.dragon });
    const phase = S ? S.phase : '';
    if (phase === 'ac' && v.prevPhase !== 'ac') {
      const d = e.atk.def, red = e.atk.kind === 'red', drag = e.atk.dragon, tint = red && !drag ? 0xff5040 : undefined;
      if (d.sweep && d.arc >= 300) this.fx('spin', e.x, e.y, f, (d.rg * 2 + 16) / 32, tint, 0.9);
      else if (d.sweep) this.fx('slash', e.x + cf * d.rg * 0.55, e.y + sf * d.rg * 0.55, f, d.rg / 32 * 1.4, tint, 0.9);
      else this.fx(drag ? 'fireslash' : 'arc', e.x + cf * d.rg * 0.72, e.y + sf * d.rg * 0.72, f, red ? 2.3 : 1.7, tint, 0.9);
    }
    v.prevPhase = phase;
    if (st === 'dodge') {
      if (v.prevState !== 'dodge') this.fx('smoke', e.x, e.y + 6, 0, 1.5, undefined, 0.75);
      v.ghostT -= dt * 1000; if (v.ghostT <= 0) { v.ghostT = 40; this.ghost(v, depth - 1e-5, C.jade); }
    }
    if (st === 'ledge' && v.prevState !== 'ledge') this.fx('dust', e.x, e.y + 8, 0, 1.6);
    if (v.prevDrop > 0 && !(e.dropT > 0)) this.fx('dust', e.x, fy - 4, 0, 2.2);
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
      const L = this.labels[i]; const vis = e.state !== 'dead';
      const a = e.state === 'falling' ? clamp(1 - e.fallT / 400, 0, 1) : 1;
      L.name.setVisible(vis).setText(e.name).setColor(i === myIdx ? '#e0a243' : '#fffaec').setPosition(e.x, e.y - 48).setAlpha(a);
      L.pct.setVisible(vis).setText(Math.round(e.pct) + '%').setColor(heatCss(e.pct)).setPosition(e.x, e.y - 30).setAlpha(a);
      if (e.emote && vis && EMOTES[e.emote.id]) { const t = e.emote.t, al = t < 150 ? t / 150 : t > 1500 ? 1 - (t - 1500) / 300 : 1; L.emo.setVisible(true).setText(EMOTES[e.emote.id]).setPosition(e.x, e.y - 64).setAlpha(clamp(al, 0, 1)); }
      else L.emo.setVisible(false);
    });
    this.hideLabels(st.f.length);
  }
}
