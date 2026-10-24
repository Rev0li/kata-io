// Rendu Phaser du dojo et des combattants. Tout est dessiné en code (Graphics) :
// aucun sprite à charger. Les effets arrivent sous forme d'événements de la simulation.
import Phaser from 'phaser';
import { TAU, RAD, CELL, CHARGE_FULL, CHARGE_START, PARRY_PERFECT, TENUES, TRAINEES, EMOTES, beltOf } from '../sim/data';
import { clamp, lerp, easeOut, Ev } from '../sim/sim';
import { sfxAt } from './audio';

const C = { ink: 0x0f1719, bone: 0xecdfc6, mist: 0x93a59f, ochre: 0xe0a243, jade: 0x62c2a2, red: 0xe5483a, gold: 0xf2c14e, mat: 0xbcab78, mat2: 0xb1a06c, heri: 0x2b2417, rim: 0x3a281a, rim2: 0x523822, water: 0x0d2a30 };
export const WATER_HEX = '#0d2a30';
const cache = new Map<string, number>();
export function hex(s: string): number { let v = cache.get(s); if (v === undefined) { v = parseInt(s.slice(1), 16); cache.set(s, v); } return v; }
function shade(c: number, k: number) { let r = c >> 16, g = (c >> 8) & 255, b = c & 255; const f = k < 0 ? 0 : 255, t = Math.abs(k); r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t); return (r << 16) | (g << 8) | b; }
const HEAT: [number, number[]][] = [[0, [236, 223, 198]], [60, [240, 196, 96]], [110, [236, 138, 60]], [160, [229, 72, 58]], [230, [190, 40, 60]]];
export function heatCss(p: number) { for (let i = 1; i < HEAT.length; i++) { if (p <= HEAT[i][0]) { const a = HEAT[i - 1], b = HEAT[i], t = (p - a[0]) / (b[0] - a[0]); return '#' + a[1].map((v, k) => Math.round(lerp(v, b[1][k], t)).toString(16).padStart(2, '0')).join(''); } } return '#be283c'; }
const hsl = (h: number) => Phaser.Display.Color.HSVToRGB(h / 360, 0.75, 1) as any;
const hsvInt = (h: number) => { const c = hsl(h); return (c.r << 16) | (c.g << 8) | c.b; };
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const FONT_DISP = '"Big Shoulders Display", Impact, sans-serif';
const FONT_BODY = 'Barlow, system-ui, sans-serif';

interface Part { x: number; y: number; vx: number; vy: number; t: number; life: number; col: number; s: number; kind: string; rot?: number; vr?: number }
interface Ring { x: number; y: number; r: number; max: number; t: number; life: number; col: number; w: number }

export class Renderer {
  scene: Phaser.Scene;
  waterG: Phaser.GameObjects.Graphics; arenaG: Phaser.GameObjects.Graphics; dynG: Phaser.GameObjects.Graphics; topG: Phaser.GameObjects.Graphics;
  parts: Part[] = []; rings: Ring[] = []; ripples: { x: number; y: number; t: number; life: number }[] = [];
  floats: { tx: Phaser.GameObjects.Text; x: number; y: number; t: number; life: number }[] = [];
  floatPool: Phaser.GameObjects.Text[] = [];
  labels: { name: Phaser.GameObjects.Text; pct: Phaser.GameObjects.Text; emo: Phaser.GameObjects.Text }[] = [];
  koi: { a: number; off: number; sp: number; col: number; spot: boolean; size: number; wig: number }[] = [];
  H = 260; rippleT = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.waterG = scene.add.graphics().setDepth(0);
    this.arenaG = scene.add.graphics().setDepth(1);
    this.dynG = scene.add.graphics().setDepth(2);
    this.topG = scene.add.graphics().setDepth(4);
    for (let i = 0; i < 7; i++) this.koi.push({ a: rand(0, TAU), off: rand(60, 380), sp: rand(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1), col: [0xe8742f, 0xf2efe6, 0xe05a2a, 0xf4b24a][(Math.random() * 4) | 0], spot: Math.random() < 0.6, size: rand(0.8, 1.25), wig: rand(0, TAU) });
    this.drawArena(this.H);
  }

  /* ---------- dojo statique ---------- */
  drawArena(H: number) {
    this.H = H; const g = this.arenaG; g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRect(-H - 12 + 18, -H - 12 + 26, 2 * H + 24, 2 * H + 24);
    g.fillStyle(C.rim, 1); g.fillRect(-H - 12, -H - 12, 2 * H + 24, 2 * H + 24);
    g.fillStyle(C.rim2, 1); g.fillRect(-H - 6, -H - 6, 2 * H + 12, 2 * H + 12);
    const n = Math.round(2 * H / CELL);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = -H + i * CELL, y0 = -H + j * CELL; const alt = (i + j) % 2;
      g.fillStyle(alt ? C.mat : C.mat2, 1); g.fillRect(x0, y0, CELL, CELL);
      g.lineStyle(1, 0x3c301a, 0.18);
      for (let s = 8; s < CELL; s += 8) { if (alt) g.lineBetween(x0 + s, y0 + 3, x0 + s, y0 + CELL - 3); else g.lineBetween(x0 + 3, y0 + s, x0 + CELL - 3, y0 + s); }
      g.lineStyle(3, C.heri, 1); g.strokeRect(x0 + 1.5, y0 + 1.5, CELL - 3, CELL - 3);
    }
    g.save(); g.rotateCanvas(Math.PI / 4); const q = Math.min(70, H * 0.25), gp = 12;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => { g.lineStyle(6, i === 0 ? C.ochre : C.heri, 0.22); g.strokeRect(sx < 0 ? -q - gp / 2 : gp / 2, sy < 0 ? -q - gp / 2 : gp / 2, q, q); });
    g.restore();
  }

  /* ---------- événements ---------- */
  handle(ev: Ev) {
    switch (ev.t) {
      case 'float': this.addFloat(ev.x, ev.y, ev.text, ev.col, ev.size); break;
      case 'sparks': for (let i = 0; i < ev.n; i++) this.parts.push({ x: ev.x, y: ev.y, vx: rand(-250, 250), vy: rand(-250, 250), life: rand(160, 340), t: 0, col: hex(ev.col), s: rand(1.5, 3), kind: 'dot' }); break;
      case 'ring': this.rings.push({ x: ev.x, y: ev.y, r: ev.r, max: ev.max, life: ev.life, t: 0, col: hex(ev.col), w: ev.w }); break;
      case 'sfx': sfxAt(ev.n, ev.x, ev.y, ev.v); break;
      case 'splash': this.splash(ev.x, ev.y, ev.fx, 1); this.addFloat(ev.x, ev.y - 20, ev.word, '#cfeef4', ev.word.length > 8 ? 24 : 28); break;
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
  update(dt: number, time: number, st: any, myIdx: number, view: Phaser.Geom.Rectangle) {
    if (st && st.H !== this.H) this.drawArena(st.H);
    const ms = dt * 1000;
    for (const k of this.koi) k.a += k.sp * dt;
    this.rippleT -= ms;
    if (this.rippleT <= 0) { this.rippleT = 260; const x = rand(view.x, view.right), y = rand(view.y, view.bottom); if (Math.abs(x) > this.H + 20 || Math.abs(y) > this.H + 20) this.ripples.push({ x, y, t: 0, life: 2400 }); }
    for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.t += ms; if (r.t > r.life) this.ripples.splice(i, 1); }
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += ms; if (p.t >= p.life) { this.parts.splice(i, 1); continue; } const d = p.kind === 'petal' ? 0.96 : p.kind === 'duck' ? 0.93 : 0.9; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= d; p.vy *= d; if (p.vr) p.rot! += p.vr * dt; }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += ms; if (r.t >= r.life) this.rings.splice(i, 1); }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.t += ms; const p = f.t / f.life; if (p >= 1) { f.tx.setVisible(false); this.floatPool.push(f.tx); this.floats.splice(i, 1); continue; } f.tx.setPosition(f.x, f.y - p * 30).setAlpha(1 - p * p); }

    this.drawWater(time);
    const g = this.dynG; g.clear();
    if (!st) { this.hideLabels(0); return; }
    const fs = st.f.slice().sort((a: any, b: any) => a.y - b.y);
    const me = st.f[myIdx];
    if (me && me.state !== 'dead' && me.state !== 'falling' && me.state !== 'ledge') { g.lineStyle(2, C.ochre, 0.7); g.strokeCircle(me.x, me.y, 26); }
    for (const e of fs) this.drawTelegraph(g, e);
    for (const e of fs) this.drawTrail(g, e, time);
    for (const e of fs) this.drawFighter(g, e, time);
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

  drawMask(g: Phaser.GameObjects.Graphics, id: string, hx: number, ga: number) {
    switch (id) {
      case 'bandeau': g.lineStyle(3, 0xc8463b, ga); g.beginPath(); g.arc(hx, 0, 8.4, -1.9, 1.9); g.strokePath(); g.lineStyle(2.4, 0xc8463b, ga); g.lineBetween(hx - 8, -2, hx - 21, -2); g.lineBetween(hx - 8, 2, hx - 20, 7); break;
      case 'kitsune': g.fillStyle(0xf3efe6, ga); for (const s of [-1, 1]) g.fillTriangle(hx - 4, s * 5, hx - 1, s * 15, hx + 4, s * 6); g.fillEllipse(hx + 4, 0, 18, 14); g.lineStyle(1.6, 0xd24b3e, ga); g.lineBetween(hx + 5, -4, hx + 10, -2); g.lineBetween(hx + 5, 4, hx + 10, 2); break;
      case 'oni': g.fillStyle(0xa8322a, ga); g.fillCircle(hx + 1, 0, 9.4); g.fillStyle(0xecdfc6, ga); for (const s of [-1, 1]) g.fillTriangle(hx - 2, s * 5, hx + 3, s * 7, hx + 9, s * 17); g.fillStyle(0xffd27a, ga); g.fillRect(hx + 6, -4, 2, 2); g.fillRect(hx + 6, 2, 2, 2); break;
      case 'corbeau': g.fillStyle(0x141414, ga); g.fillCircle(hx, 0, 9.6); g.fillStyle(0x3a3a3a, ga); g.fillTriangle(hx + 6, -4, hx + 20, 0, hx + 6, 4); g.lineStyle(2, 0x141414, ga); for (const s of [-4, 0, 4]) g.lineBetween(hx - 8, s, hx - 16, s * 1.6); break;
      case 'lune': g.lineStyle(4, 0xe8c25a, ga); g.beginPath(); g.arc(hx - 2, 0, 10.5, Math.PI * 0.55, Math.PI * 1.45); g.strokePath(); break;
      case 'cerf': g.lineStyle(2.4, 0xd9c9a3, ga); for (const s of [-1, 1]) { g.lineBetween(hx - 2, s * 6, hx - 11, s * 17); g.lineBetween(hx - 6, s * 11, hx - 1, s * 19); g.lineBetween(hx - 11, s * 17, hx - 18, s * 19); } break;
      case 'couronne': g.lineStyle(2.6, 0x62c2a2, ga); g.strokeCircle(hx, 0, 7.5); g.fillStyle(0x9ff0d3, ga); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.fillCircle(hx + Math.cos(a) * 9.5, Math.sin(a) * 9.5, 1.8); } break;
    }
  }

  drawFighter(g: Phaser.GameObjects.Graphics, e: any, time: number) {
    const st = e.state; if (st === 'dead') return;
    const T = TENUES[e.look.tenue] || TENUES['gi-ecru'];
    const body = hex(T.body), trim = hex(T.trim), pants = shade(body, -0.35), skin = 0xe7d6b8;
    let scale = 1, rot = 0, ga = 1;
    if (st === 'falling') { const p = clamp(e.fallT / 560, 0, 1); scale = 1 - 0.5 * p; rot = p * 5; ga = 1 - 0.35 * p; }
    if (e.spawnInv > 0 && st !== 'climb' && st !== 'falling' && !(e.dropT > 0)) ga *= 0.55 + 0.3 * Math.sin(time * 0.02);
    const dp = e.dropT > 0 ? e.dropT / 500 : 0; if (dp) { scale *= 1 + dp * 1.2; ga *= 1 - dp * 0.45; }
    g.save(); g.translateCanvas(e.x, e.y);
    if (st !== 'falling' && st !== 'ledge') { g.fillStyle(0x1e180c, 0.3 * ga); g.fillEllipse(3, 6, 38 * (1 - dp * 0.5), 28 * (1 - dp * 0.5)); }
    if (st === 'charge') {
      const p = clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1), pulse = 0.5 + 0.5 * Math.sin(time * 0.035), gold = e.qi >= 100, r = 24 + 10 * p + pulse * 3, col = gold ? C.gold : C.red;
      g.fillStyle(col, (0.16 + 0.26 * p) * ga); g.fillCircle(0, 0, r); g.lineStyle(2 + 2 * p, col, ga); g.strokeCircle(0, 0, r);
      if (p >= 1) { g.lineStyle(1.5, 0xffffff, 0.7 * ga); g.strokeCircle(0, 0, r + 5); }
    }
    if (e.elanT > 0) { g.lineStyle(2, C.jade, ga * (0.4 + 0.4 * Math.sin(time * 0.02))); g.strokeCircle(0, 0, 23); }
    if (e.qi >= 100 && st !== 'charge') { g.lineStyle(2, C.gold, ga * (0.35 + 0.25 * Math.sin(time * 0.012))); g.strokeCircle(0, 0, 26); }
    if (st === 'parry') { const perf = e.stateT <= PARRY_PERFECT; g.fillStyle(C.bone, 0.14 * ga); g.fillCircle(0, 0, 29); g.lineStyle(perf ? 4 : 3, perf ? C.gold : C.bone, (perf ? 1 : 0.85) * ga); g.strokeCircle(0, 0, 29); }
    g.rotateCanvas(e.facing + rot); g.scaleCanvas(scale, scale);
    if (st === 'tumble') g.rotateCanvas(e.stateT * 0.022);
    if (st === 'stun' || st === 'recover') g.rotateCanvas(Math.sin(e.stateT * 0.03) * 0.16);
    const s0 = st === 'attack' && e.atk ? e.atk.startStance : e.stance;
    const side = (s0 & 1) ? 1 : -1, prof = s0 >> 1, tw = (prof ? 1.0 : 0.42) * (-side);
    let leadF: any = prof ? { x: 13, y: side * 3 } : { x: 11, y: side * 8 }, rearF: any = prof ? { x: -12, y: -side * 4 } : { x: -9, y: -side * 10 };
    let leadH = prof ? { x: 22, y: side * 2 } : { x: 20, y: side * 5 }, rearH = prof ? { x: 8, y: -side * 10 } : { x: 13, y: -side * 8 };
    if (st === 'parry') { leadH = { x: 21, y: 5 }; rearH = { x: 21, y: -5 }; }
    if (st === 'charge') { leadH = { x: -2, y: side * 16 }; rearH = { x: 15, y: -side * 6 }; }
    if (st === 'ledge' || st === 'climb') { leadH = { x: 24, y: 9 }; rearH = { x: 24, y: -9 }; leadF = { x: -14, y: 6 }; rearF = { x: -14, y: -6 }; }
    if (st === 'tumble' || st === 'stun') { leadH = { x: 6, y: side * 19 }; rearH = { x: 4, y: -side * 19 }; }
    let S: any = null, kickPt: any = null;
    if (st === 'attack' && e.atk && e.atk.def) {
      S = this.strike(e);
      if (S.kick) { if (S.useRear) rearF = null; else leadF = null; kickPt = S.P; } else { if (S.useRear) rearH = S.P; else leadH = S.P; }
      if (S.phase === 'ac') { const ct = Math.cos(e.facing), sn = Math.sin(e.facing), P = S.P; (e.trail ||= []).push({ x: e.x + (ct * P.x - sn * P.y) * scale, y: e.y + (sn * P.x + ct * P.y) * scale, t: time, red: e.atk.kind === 'red', gold: e.atk.dragon }); }
    }
    g.fillStyle(0x1b1714, ga);
    for (const f of [leadF, rearF]) if (f) g.fillEllipse(f.x, f.y, 13, 8.4);
    if (kickPt) { const hipY = (S.useRear ? -side : side) * 6; g.lineStyle(8, pants, ga); g.lineBetween(0, hipY, kickPt.x, kickPt.y); g.fillStyle(pants, ga); g.fillCircle(0, hipY, 4); g.fillStyle(0x1b1714, ga); g.fillCircle(kickPt.x, kickPt.y, 5.5); }
    // corps
    if (T.fx === 'mist') { g.fillStyle(0xe7eef2, 0.2 * ga); g.fillCircle(0, 0, 20 + Math.sin(time * 0.004) * 1.5); }
    g.fillStyle(body, ga); g.fillCircle(0, 0, 15);
    g.fillStyle(shade(body, 0.22), 0.5 * ga); g.fillCircle(-4, -4, 9);
    g.lineStyle(2, 0x0f1719, 0.85 * ga); g.strokeCircle(0, 0, 15);
    if (T.fx === 'plates') { g.lineStyle(1.2, trim, ga); for (let r = 6; r < 15; r += 4) { g.beginPath(); g.arc(0, 0, r, 0.6, TAU - 0.6); g.strokePath(); } }
    if (T.fx === 'stars') { for (let i = 0; i < 7; i++) { const a = i * 2.4 + time * 0.0004, r = 4 + (i * 5) % 10; g.fillStyle(trim, ga * (0.5 + 0.5 * Math.sin(time * 0.006 + i))); g.fillRect(Math.cos(a) * r - 0.8, Math.sin(a) * r - 0.8, 1.6, 1.6); } }
    if (T.fx === 'shine') { const a = time * 0.003; g.lineStyle(2.5, 0xfff1c4, 0.8 * ga); g.beginPath(); g.arc(0, 0, 12, a, a + 0.9); g.strokePath(); }
    const belt = hex(beltOf(e.kos)[2]);
    g.lineStyle(3, belt, ga); g.strokeCircle(0, 0, 11); g.lineStyle(2.4, belt, ga); g.lineBetween(-11, 1, -19, 4); g.lineBetween(-11, -1, -18, -5);
    const rot2 = (p: any, a: number) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
    const SL = rot2({ x: 0, y: -14 }, tw), SR = rot2({ x: 0, y: 14 }, tw);
    const leadS = side > 0 ? SR : SL, rearS = side > 0 ? SL : SR;
    for (const [sh, h] of [[rearS, rearH], [leadS, leadH]] as any) { g.lineStyle(7, body, ga); g.lineBetween(sh.x, sh.y, h.x, h.y); g.fillStyle(body, ga); g.fillCircle(sh.x, sh.y, 3.5); g.fillStyle(skin, ga); g.fillCircle(h.x, h.y, 4.6); }
    g.save(); g.rotateCanvas(tw); g.fillStyle(trim, ga); g.fillRect(-5, -15, 10, 30); g.fillStyle(body, ga); g.fillRect(-3, -10, 6, 20); g.restore();
    const em = e.emote && e.emote.id; const bow = em === 'salut' && e.emote.t < 900;
    const hx = bow ? 6 : 1;
    g.fillStyle(0x2a201b, ga); g.fillCircle(hx, 0, 9.4); g.fillStyle(0x55443a, 0.6 * ga); g.fillCircle(hx - 3, -3, 4);
    this.drawMask(g, e.look.masque, hx, ga);
    g.restore();
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
