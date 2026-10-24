// Simulation autoritaire d'un duel 1 contre 1.
// Elle ne dessine rien : elle avance l'état et émet des événements (impacts, sons, textes)
// que le client affiche. Le joueur hôte la fait tourner ; l'invité ne reçoit que des instantanés.
import {
  TAU, RAD, R, DUEL_H, KB_DAMP, WHITE_KB, RED_KB, TUMBLE_V, LEDGE_MAX, PARRY_WIN, PARRY_PERFECT, PARRY_MISS,
  DODGE_T, DODGE_IF0, DODGE_IF1, DODGE_DIST, CHARGE_START, CHARGE_FULL, CHARGE_MAX, SOUFFLE_REGEN, MOVE_SPEED, FIRST_TO,
  TF, WA, HA, ATTACK_BY_ID, DEFAULT_DECK, cloneDeck, sanitizeLook, Deck, Look, AttackDef, RULES,
} from './data';
import { Abil, FULL_ABIL } from './progression';

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
// Hasard de la simulation : celui de la partie en cours (graine fixe dans les tests, Math.random sinon).
const rnd = () => S.rng();
// Générateur à graine (mulberry32) : même graine, même suite de nombres, donc même match.
export function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T>(arr: T[]) => arr[(rnd() * arr.length) | 0];

export interface Input { mx: number; my: number; aim: number; atk: boolean; parryN: number; dodgeN: number; emoteN: number; emote: string | null }
export const emptyInput = (): Input => ({ mx: 0, my: 0, aim: 0, atk: false, parryN: 0, dodgeN: 0, emoteN: 0, emote: null });
export interface Spec { name: string; look: Look; deck?: Deck; bot?: number | null; abil?: Abil; belt?: string; dummy?: boolean; atkSlow?: number }
export interface SimOpts { firstTo?: number; H?: number; damp?: number; free?: boolean; pos?: [number, number][]; seed?: number }
export type Ev = { t: string; [k: string]: any };
// Mort subite : passé ce délai dans une manche, le dojo rétrécit jusqu'à SUDDEN_MIN.
export const SUDDEN_T = 25000, SUDDEN_RATE = 9, SUDDEN_MIN = 110;

export type Fighter = any;
export type Sim = any;
let S: Sim = null;

const alive = (e: Fighter) => e.state !== 'dead' && e.state !== 'falling';
export { alive };
function emit(o: Ev) { S.ev.push(o); }
const fx = {
  float: (x: number, y: number, text: string, col: string, size = 17) => emit({ t: 'float', x, y, text, col, size }),
  sparks: (x: number, y: number, col: string, n: number) => emit({ t: 'sparks', x, y, col, n }),
  ring: (x: number, y: number, r: number, max: number, life: number, col: string, w: number) => emit({ t: 'ring', x, y, r, max, life, col, w }),
  sfx: (n: string, x: number, y: number, v = 1) => emit({ t: 'sfx', n, x, y, v }),
  shake: (n: number) => emit({ t: 'shake', n }),
  big: (text: string, col: string, life: number) => emit({ t: 'big', text, col, life }),
};

/* ================= création ================= */
export function createSim(specs: Spec[], opts: SimOpts = {}): Sim {
  const st: Sim = { H: opts.H || DUEL_H, H0: opts.H || DUEL_H, damp: opts.damp || KB_DAMP, time: 0, f: [], ev: [], hitstop: 0, slow: 0, uid: 0, atkUid: 0, duel: null, rng: opts.seed != null ? seededRng(opts.seed) : Math.random };
  S = st;
  specs.forEach((sp, i) => {
    const e = makeFighter({ idx: i, name: String(sp.name || 'Combattant').slice(0, 24), look: sanitizeLook(sp.look), deck: sp.deck ? cloneDeck(sp.deck) : cloneDeck(DEFAULT_DECK), abil: { ...(sp.abil || FULL_ABIL) }, belt: sp.belt || null, atkSlow: sp.atkSlow || 1 });
    if (sp.bot != null) e.bot = newBrain(sp.bot);
    if (sp.dummy) e.bot = newBrain(0, true);
    st.f.push(e);
  });
  st.duel = { score: [0, 0], round: 0, phase: 'intro', t: 0, winner: -1, firstTo: opts.firstTo || FIRST_TO, start: 0, fightT: 0, sudden: false, mp: false };
  if (opts.free) {
    st.duel.phase = 'free';
    st.f.forEach((e: Fighter, i: number) => { const p = (opts.pos && opts.pos[i]) || [i ? 110 : -110, 0]; resetFighter(e, p[0], p[1]); e.dropT = 0; });
  } else duelRound();
  return st;
}
export function respawn(st: Sim, e: Fighter, x: number, y: number) { S = st; resetFighter(e, x, y); }
function makeFighter(o: any): Fighter {
  return Object.assign({
    id: ++S.uid, idx: 0, name: '', bot: null, look: null, deck: null,
    x: 0, y: 0, vx: 0, vy: 0, facing: 0, wantFacing: 0, move: { x: 0, y: 0 }, pct: 0, souffle: 3, qi: 0, state: 'idle', stateT: 0, stunDur: 0, atk: null,
    combo: { stance: 0, idx: 0 }, comboT: 0, stance: 0, buffer: null, bufferT: 0, holding: false, holdT: 0, chargeT: 0, chargeDef: null,
    dodge: null, ledge: null, fallT: 0, elanT: 0, kos: 0, lastHitBy: null, lastHitT: -1e9, lastHitDragon: false, spawnInv: 0, emote: null,
    dropT: 0, spam: 0, lastAvoid: -1, splashFx: 'plouf', koWord: 'PLOUF !', inPrev: { atk: false, parryN: 0, dodgeN: 0, emoteN: 0 },
  }, o);
}
export function resetFighter(e: Fighter, x: number, y: number) {
  Object.assign(e, { x, y, vx: 0, vy: 0, pct: 0, souffle: 3, qi: 0, state: 'idle', stateT: 0, atk: null, buffer: null, comboT: 0, holding: false, holdT: 0, ledge: null, dodge: null, fallT: 0, elanT: 0, spawnInv: 0, lastHitBy: null, lastHitT: -1e9, emote: null, spam: 0, exhHit: false, dropT: 500, stance: 0, chargeT: 0, chargeDef: null });
  e.facing = e.wantFacing = x < 0 ? 0 : Math.PI;
}

/* ================= duel ================= */
function duelRound() {
  const D = S.duel; D.round++; D.phase = 'intro'; D.t = 0; D.fightT = 0; D.sudden = false;
  S.H = S.H0;
  const [a, b] = S.f;
  resetFighter(a, -110, 0); resetFighter(b, 110, 0);
  for (const e of S.f) { e.state = 'frozen'; e.kos = D.score[e.idx]; if (e.bot) { e.bot.plan = null; e.bot.seen.clear(); e.bot.holdFor = 0; } }
  // balle de match : un point de plus et c'est fini
  D.mp = D.score.some((n: number) => n === D.firstTo - 1);
  if (D.mp) fx.big('BALLE DE MATCH', '#e5483a', 1100); else fx.big('MANCHE ' + D.round, '#ecdfc6', 850);
}
function duelUpdate(dt: number) {
  const D = S.duel; if (D.phase === 'free') return; const prev = D.t; D.t += dt * 1000;
  if (D.phase === 'intro') {
    for (const [m, txt] of [[900, '3'], [1500, '2'], [2100, '1']] as [number, string][]) if (D.t >= m && prev < m) { fx.big(txt, '#ecdfc6', 560); fx.sfx('ui', 0, 0, 1); }
    if (D.t >= 2700) { fx.big('COMBAT !', '#e0a243', 700); fx.sfx('gong', 0, 0, 0.6); for (const e of S.f) if (e.state === 'frozen') toIdle(e); D.phase = 'fight'; if (D.round === 1) D.start = S.time; }
  } else if (D.phase === 'fight') {
    D.fightT += dt * 1000;
    if (!D.sudden && D.fightT >= SUDDEN_T) { D.sudden = true; fx.big('MORT SUBITE', '#e5483a', 1200); fx.sfx('gong', 0, 0, 0.9); fx.shake(6); emit({ t: 'sudden' }); }
    if (D.sudden && S.H > SUDDEN_MIN) {
      S.H = Math.max(SUDDEN_MIN, S.H - SUDDEN_RATE * dt);
      for (const e of S.f) if (e.state === 'ledge' && e.ledge) { if (e.ledge.nx) e.x = e.ledge.nx * (S.H + 8); else e.y = e.ledge.ny * (S.H + 8); }
    }
  } else if (D.phase === 'point') {
    if (D.t >= 1900) {
      if (D.score[0] >= D.firstTo || D.score[1] >= D.firstTo) { D.phase = 'end'; D.winner = D.score[0] > D.score[1] ? 0 : 1; emit({ t: 'end', winner: D.winner, score: D.score.slice() }); }
      else duelRound();
    }
  }
}
function addQi(e: Fighter, n: number) { if (e.abil.dragon) e.qi = Math.min(100, e.qi + n); }
function duelPoint(v: Fighter) {
  const D = S.duel; if (D.phase !== 'fight') return;
  const other = S.f[1 - v.idx]; D.score[other.idx]++; D.phase = 'point'; D.t = 0;
  // manche parfaite : gagnée sans avoir été touché une seule fois
  if (other.pct < 0.5) { fx.float(other.x, other.y - 66, 'PARFAIT !', '#f2c14e', 26); emit({ t: 'perfect', idx: other.idx }); }
  other.state = 'frozen'; other.holding = false; other.atk = null;
  other.kos = D.score[other.idx];
  emit({ t: 'point', to: other.idx, score: D.score.slice() });
}

/* ================= entrées ================= */
function applyInput(e: Fighter, inp: Input) {
  const p = e.inPrev;
  if (!alive(e) || e.state === 'frozen') { e.move = { x: 0, y: 0 }; e.holding = false; e.inPrev = { atk: inp.atk, parryN: inp.parryN, dodgeN: inp.dodgeN, emoteN: inp.emoteN }; return; }
  let mx = clamp(+inp.mx || 0, -1, 1), my = clamp(+inp.my || 0, -1, 1); const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  e.move = { x: mx, y: my };
  if (Number.isFinite(inp.aim)) e.wantFacing = inp.aim;
  if (inp.atk && !p.atk) doAction(e, 'pressAtk');
  else if (!inp.atk && p.atk) doAction(e, 'releaseAtk');
  if (inp.parryN > p.parryN) doAction(e, 'parry');
  if (inp.dodgeN > p.dodgeN) doAction(e, 'dodge', { x: mx, y: my });
  if (inp.emoteN > p.emoteN && inp.emote) doAction(e, 'emote', inp.emote);
  if (e.state === 'ledge' && e.ledge) { const L = e.ledge; if (mx * -L.nx + my * -L.ny > 0.5) climb(e); }
  e.inPrev = { atk: inp.atk, parryN: inp.parryN, dodgeN: inp.dodgeN, emoteN: inp.emoteN };
}

/* ================= pas de simulation ================= */
export function stepSim(st: Sim, realDt: number, inputs: Input[]) {
  S = st;
  S.f.forEach((e: Fighter, i: number) => { if (!e.bot) applyInput(e, inputs[i] || emptyInput()); });
  if (S.hitstop > 0) { S.hitstop -= realDt * 1000; return; }
  let dt = realDt;
  if (S.slow > 0) { S.slow -= realDt * 1000; dt *= 0.3; }
  S.time += dt * 1000;
  for (const e of S.f) if (e.bot) botUpdate(e, dt);
  duelUpdate(dt);
  for (const e of S.f) updEnt(e, dt);
  collide();
}
export function drainEvents(st: Sim): Ev[] { const e = st.ev; st.ev = []; return e; }

/* ================= mécanique ================= */
function startAttack(e: Fighter, d: AttackDef, o: any) {
  aimAssist(e, d, o.kind);
  e.state = 'attack'; e.stateT = 0; e.chargeT = 0;
  e.atk = { def: d, kind: o.kind, t: 0, su: d.su, ac: d.ac, rc: d.rc, seg: -1, hit: new Set(), startStance: e.stance, endStance: TF[d.tf](e.stance), applied: false, uid: ++S.atkUid, idx: o.idx || 0, finisher: !!o.finisher, power: o.power || 1, dragon: !!o.dragon };
  if (o.kind === 'red') fx.sfx('heavy', e.x, e.y, 0.8);
  if (o.kind === 'white' && e.atkSlow > 1) e.atk.su = d.su * e.atkSlow;
}
function startWhite(e: Fighter) {
  // Anti-spam : en dessous du seuil, aucun coût. Au-dessus, le coup coûte du souffle et se bloque sans souffle.
  if (e.spam >= RULES.spamThreshold) {
    if (e.souffle < RULES.spamAttackCost) { fx.float(e.x, e.y - 50, 'À BOUT DE SOUFFLE', '#93a59f', 14); emit({ t: 'spamblock', idx: e.idx }); return; }
    e.souffle -= RULES.spamAttackCost;
  }
  const before = e.spam; e.spam += RULES.spamPerAttack;
  if (before < RULES.spamThreshold && e.spam >= RULES.spamThreshold) emit({ t: 'spam', idx: e.idx });
  const ch = e.deck.chain;
  if (e.comboT <= 0 || e.combo.idx >= Math.min(3, e.abil.chain) || !ch[e.combo.stance][e.combo.idx]) e.combo = { stance: e.stance, idx: 0 };
  const idx = e.combo.idx, d = WA[ch[e.combo.stance][idx]]; e.combo.idx++;
  startAttack(e, d, { kind: 'white', idx, finisher: idx === 2 });
}
export function nextWhite(e: Fighter) { const ch = e.deck.chain; if (e.comboT > 0 && e.combo.idx < Math.min(3, e.abil.chain) && ch[e.combo.stance][e.combo.idx]) return WA[ch[e.combo.stance][e.combo.idx]]; return WA[ch[e.stance][0]]; }
function startCharge(e: Fighter) { e.spam = Math.max(0, e.spam - RULES.spamDefend); e.state = 'charge'; e.stateT = 0; e.chargeT = 0; e.chargeDef = HA[e.deck.heavy[e.stance]]; e.atk = null; e.combo = { stance: e.stance, idx: 0 }; e.comboT = 0; fx.sfx('charge', e.x, e.y, 0.6); }
function releaseCharge(e: Fighter) {
  const d = e.chargeDef || HA[e.deck.heavy[e.stance]];
  const power = 0.65 + 0.35 * clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1);
  const dragon = e.qi >= 100; if (dragon) e.qi = 0;
  e.souffle = Math.max(0, e.souffle - 1);
  startAttack(e, d, { kind: 'red', power, dragon });
  if (dragon) { fx.float(e.x, e.y - 52, 'PAUME DU DRAGON', '#f2c14e', 18); fx.ring(e.x, e.y, 20, 70, 400, '#f2c14e', 5); }
}
function aimAssist(e: Fighter, d: AttackDef, kind: string) {
  const reach = d.rg + (kind === 'red' ? d.lunge : d.lunge + 20) + R; let best = null, ba = 50 * RAD;
  for (const o of S.f) { if (o === e || !alive(o)) continue; const dx = o.x - e.x, dy = o.y - e.y, dist = Math.hypot(dx, dy); if (dist > reach) continue; const a = Math.abs(angDiff(e.facing, Math.atan2(dy, dx))); if (a < ba) { ba = a; best = o; } }
  if (best) e.facing = e.wantFacing = Math.atan2(best.y - e.y, best.x - e.x);
}
function moveSafe(e: Fighter, dx: number, dy: number) { const H = S.H - 6; e.x = clamp(e.x + dx, -H, H); e.y = clamp(e.y + dy, -H, H); }
function toIdle(e: Fighter) { e.state = 'idle'; e.stateT = 0; }
function runBuffer(e: Fighter, b: any) { if (b.type === 'atk') startWhite(e); else doAction(e, b.type, b.arg); }

export function doAction(e: Fighter, type: string, arg?: any) {
  if (!e || !alive(e) || e.state === 'frozen') return;
  const st = e.state;
  switch (type) {
    case 'pressAtk':
      e.holding = true; e.holdT = 0;
      if (st === 'idle') startWhite(e);
      else if (st === 'ledge') climb(e);
      else if (['attack', 'stun', 'recover', 'dodge', 'parry', 'climb'].includes(st)) { e.buffer = { type: 'atk' }; e.bufferT = 0; }
      return;
    case 'releaseAtk':
      e.holding = false;
      if (st === 'charge') releaseCharge(e);
      return;
    case 'parry':
      if (!e.abil.parry) return;
      if (st === 'idle' || st === 'charge') { e.spam = Math.max(0, e.spam - RULES.spamDefend); e.state = 'parry'; e.stateT = 0; e.atk = null; e.holding = false; return; }
      if (st === 'attack' || st === 'stun' || st === 'dodge') { e.buffer = { type: 'parry' }; e.bufferT = 0; }
      return;
    case 'dodge': {
      if (st === 'ledge') { climb(e); return; }
      const recov = st === 'attack' && e.atk.kind === 'white' && e.atk.t >= e.atk.su + e.atk.ac;
      if (st === 'idle' || st === 'charge' || recov) {
        if (e.souffle < 1) { fx.float(e.x, e.y - 50, 'À BOUT DE SOUFFLE', '#93a59f', 14); return; }
        startDodge(e, arg); return;
      }
      if (st === 'attack' || st === 'stun') { e.buffer = { type: 'dodge', arg }; e.bufferT = 0; }
      return;
    }
    case 'emote':
      if (st === 'ledge' || typeof arg !== 'string') return;
      e.emote = { id: arg, t: 0 }; return;
  }
}
function startDodge(e: Fighter, dir: any) {
  let dx: number, dy: number;
  if (dir && Math.hypot(dir.x, dir.y) > 0.2) { const l = Math.hypot(dir.x, dir.y); dx = dir.x / l; dy = dir.y / l; } else { dx = -Math.cos(e.facing); dy = -Math.sin(e.facing); }
  e.spam = Math.max(0, e.spam - RULES.spamDefend); e.souffle -= 1; e.state = 'dodge'; e.stateT = 0; e.dodge = { dx, dy, done: 0 }; e.atk = null; e.holding = false; e.chargeT = 0;
  fx.sfx('avoid', e.x, e.y, 0.45);
}
function updDodge(e: Fighter) { const p = clamp(e.stateT / DODGE_T, 0, 1), want = DODGE_DIST * easeOut(p), dd = want - e.dodge.done; e.dodge.done = want; moveSafe(e, e.dodge.dx * dd, e.dodge.dy * dd); if (e.stateT >= DODGE_T + 60) toIdle(e); }
function climb(e: Fighter) { if (e.state !== 'ledge') return; e.state = 'climb'; e.stateT = 0; e.holding = false; }
function updClimb(e: Fighter) {
  const L = e.ledge, p = clamp(e.stateT / 300, 0, 1); const H = S.H; const d = lerp(8, -30, easeOut(p));
  if (L.nx) e.x = L.nx * (H + d); else e.y = L.ny * (H + d);
  if (e.stateT >= 300) { e.ledge = null; e.spawnInv = Math.max(e.spawnInv, 220); toIdle(e); fx.float(e.x, e.y - 50, 'SAUVÉ !', '#62c2a2', 19); emit({ t: 'saved', idx: e.idx }); }
}
function grabLedge(e: Fighter) {
  const H = S.H, ox = Math.abs(e.x) - H, oy = Math.abs(e.y) - H; let nx = 0, ny = 0;
  if (ox >= oy) { nx = Math.sign(e.x); e.x = nx * (H + 8); e.y = clamp(e.y, -H + 10, H - 10); } else { ny = Math.sign(e.y); e.y = ny * (H + 8); e.x = clamp(e.x, -H + 10, H - 10); }
  e.state = 'ledge'; e.stateT = 0; e.ledge = { nx, ny, t: 0 }; e.vx = e.vy = 0; e.atk = null; e.buffer = null; e.holding = false;
  e.facing = e.wantFacing = Math.atan2(-ny, -nx);
  fx.float(e.x, e.y - 46, 'RATTRAPÉ', '#ecdfc6', 15);
}
function startFall(e: Fighter) {
  if (!alive(e)) return;
  const killer = S.time - e.lastHitT < 4000 ? S.f.find((o: Fighter) => o.id === e.lastHitBy && o !== e) : null;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp < 120) { const nx = Math.abs(e.x) >= Math.abs(e.y) ? Math.sign(e.x) : 0, ny = nx ? 0 : Math.sign(e.y); e.vx = nx * 160; e.vy = ny * 160; }
  e.state = 'falling'; e.stateT = 0; e.fallT = 0; e.atk = null; e.holding = false; e.buffer = null; e.ledge = null; e.emote = null;
  koFighter(e, killer);
}
function updFall(e: Fighter, dt: number) {
  e.fallT += dt * 1000; e.x += e.vx * dt; e.y += e.vy * dt; const k = Math.exp(-2.5 * dt); e.vx *= k; e.vy *= k;
  if (e.fallT >= 560) { emit({ t: 'splash', x: e.x, y: e.y, fx: e.splashFx, word: e.koWord }); fx.sfx('splash', e.x, e.y); e.state = 'dead'; }
}
function checkHits(e: Fighter) {
  const a = e.atk, d = a.def; if (a.t < a.su || a.t >= a.su + a.ac) return;
  const hits = d.hits || 1, seg = a.ac / hits, k = Math.min(hits - 1, Math.floor((a.t - a.su) / seg));
  if (k !== a.seg) { a.seg = k; a.hit.clear(); fx.sfx('whoosh', e.x, e.y, 0.5); }
  const ar = d.arc * RAD / 2;
  for (const o of S.f) {
    if (o === e || !alive(o) || a.hit.has(o.id)) continue;
    const dx = o.x - e.x, dy = o.y - e.y, dist = Math.hypot(dx, dy);
    if (dist > d.rg + R * 0.7) continue;
    if (d.arc < 360 && Math.abs(angDiff(e.facing, Math.atan2(dy, dx))) > ar + Math.atan2(R, Math.max(dist, 1))) continue;
    resolveHit(e, o);
    if (e.state !== 'attack') return;
  }
}
function resolveHit(att: Fighter, tgt: Fighter) {
  const a = att.atk; a.hit.add(tgt.id);
  if (tgt.spawnInv > 0 || tgt.state === 'climb') return;
  if (tgt.state === 'dodge' && tgt.stateT >= DODGE_IF0 && tgt.stateT <= DODGE_IF1) { perfectDodge(tgt, att); return; }
  if (tgt.state === 'ledge') { tgt.lastHitBy = att.id; tgt.lastHitT = S.time; tgt.lastHitDragon = a.dragon; tgt.pct += a.def.dmg; const an = Math.atan2(tgt.y - att.y, tgt.x - att.x); tgt.vx = Math.cos(an) * 420; tgt.vy = Math.sin(an) * 420; fx.sparks(tgt.x, tgt.y, '#ecdfc6', 8); fx.sfx('hit', tgt.x, tgt.y); startFall(tgt); return; }
  const red = a.kind === 'red'; let guardBreak = false;
  if (tgt.state === 'parry') {
    if (!red) { parried(tgt, att, tgt.stateT <= PARRY_PERFECT); return; }
    guardBreak = true; fx.float(tgt.x, tgt.y - 52, 'GARDE BRISÉE', '#e5483a', 17);
  }
  if (tgt.state === 'charge') fx.float(tgt.x, tgt.y - 52, 'INTERROMPU', '#ecdfc6', 16);
  applyHit(att, tgt, guardBreak);
}
function applyHit(att: Fighter, tgt: Fighter, guardBreak: boolean) {
  const a = att.atk, d = a.def, red = a.kind === 'red';
  const dmg = red ? d.dmg * a.power : d.dmg;
  tgt.pct = Math.min(999, tgt.pct + dmg);
  tgt.lastHitBy = att.id; tgt.lastHitT = S.time; tgt.lastHitDragon = a.dragon;
  let mult = (d.kb || 1) * (a.finisher ? 1.35 : 1) * (red ? a.power : 1) * (a.dragon ? 1.5 : 1) * (guardBreak ? 1.2 : 1);
  if (att.elanT > 0) { mult *= 1.4; att.elanT = 0; fx.float(att.x, att.y - 52, 'ÉLAN', '#62c2a2', 15); }
  // D1 : épuisé = presque certain d'être éjecté
  tgt.exhHit = false;
  if (tgt.souffle < 1 && tgt.state !== 'dodge') { tgt.exhHit = true; mult *= RULES.exhaustKbMult; fx.float(tgt.x, tgt.y - 66, 'ÉPUISÉ !', '#e5483a', 20); emit({ t: 'exhausted', to: tgt.idx }); }
  tgt.dodgeCount = 0;
  const K = red ? RED_KB : WHITE_KB; const v = (K[0] + K[1] * tgt.pct) * mult;
  const dist = Math.hypot(tgt.x - att.x, tgt.y - att.y);
  let ang = dist > 1 ? Math.atan2(tgt.y - att.y, tgt.x - att.x) : att.facing; ang += angDiff(ang, att.facing) * 0.3;
  tgt.vx = Math.cos(ang) * v; tgt.vy = Math.sin(ang) * v;
  tgt.atk = null; tgt.buffer = null; tgt.comboT = 0; tgt.chargeT = 0; tgt.dodge = null;
  if (v > TUMBLE_V) { tgt.state = 'tumble'; tgt.stateT = 0; } else { tgt.state = 'stun'; tgt.stateT = 0; tgt.stunDur = Math.min(520, 200 + 1.5 * tgt.pct); }
  addQi(att, red ? 8 : 4); addQi(tgt, 2);
  const col = a.dragon ? '#f2c14e' : red ? '#e5483a' : '#ecdfc6';
  fx.sparks(tgt.x - Math.cos(ang) * 10, tgt.y - Math.sin(ang) * 10, col, red ? 16 : 9);
  if (red || v > 700) fx.ring(tgt.x, tgt.y, 8, red ? 52 : 36, 240, col, red ? 5 : 3);
  fx.sfx(v > 650 ? 'bighit' : 'hit', tgt.x, tgt.y, clamp(0.6 + v / 1500, 0.6, 1.2));
  S.hitstop = Math.max(S.hitstop, Math.min(150, 40 + v / 22));
  fx.shake(Math.min(10, 2 + v / 170));
  emit({ t: 'hit', by: att.idx, to: tgt.idx, v, red, idx: a.idx, dragon: a.dragon, exh: !!tgt.exhHit });
}
function parried(def: Fighter, att: Fighter, perfect: boolean) {
  att.state = 'stun'; att.stateT = 0; att.stunDur = perfect ? 900 : 650; att.atk = null; att.buffer = null; att.comboT = 0; att.holding = false;
  const an = Math.atan2(att.y - def.y, att.x - def.x);
  if (perfect) { att.vx = Math.cos(an) * 260; att.vy = Math.sin(an) * 260; }
  toIdle(def); addQi(def, perfect ? 25 : 15);
  def.souffle = Math.min(3, def.souffle + (perfect ? RULES.parryPerfectSouffle : RULES.parrySouffle));
  const mx = (att.x + def.x) / 2, my = (att.y + def.y) / 2, col = perfect ? '#f2c14e' : '#e0a243';
  fx.ring(mx, my, 6, perfect ? 60 : 44, 280, col, perfect ? 5 : 4);
  fx.sparks(mx, my, col, perfect ? 20 : 12);
  fx.float(def.x, def.y - 52, perfect ? 'PARADE PARFAITE' : 'PARADE', col, perfect ? 19 : 17);
  fx.sfx(perfect ? 'perfect' : 'parry', def.x, def.y);
  S.hitstop = Math.max(S.hitstop, 90); fx.shake(perfect ? 5 : 3);
  if (perfect) S.slow = Math.max(S.slow, 160);
  emit({ t: 'parry', by: def.idx, perfect });
}
function perfectDodge(tgt: Fighter, att: Fighter) {
  if (tgt.lastAvoid === att.atk.uid) return; tgt.lastAvoid = att.atk.uid;
  if (tgt.abil.elan) { tgt.souffle = Math.min(3, tgt.souffle + 1); tgt.elanT = 1500; S.slow = Math.max(S.slow, 200); }
  addQi(tgt, 15);
  tgt.dodgeCount = (tgt.dodgeCount || 0) + 1; // D2 : compteur d'équilibre (bonus pas encore décidé)
  if (RULES.balanceEnabled && tgt.dodgeCount >= RULES.balanceDodgesRequired) { tgt.dodgeCount = 0; emit({ t: 'balance', idx: tgt.idx }); }
  fx.float(tgt.x, tgt.y - 52, 'ESQUIVE !', '#62c2a2', 17); fx.sfx('avoid', tgt.x, tgt.y, 1);
  emit({ t: 'dodge', by: tgt.idx });
}
function koFighter(v: Fighter, killer: Fighter) {
  const pct = Math.round(v.pct);
  v.splashFx = killer ? (killer.look.ejection || 'plouf') : 'plouf';
  v.koWord = pct >= 180 || v.lastHitDragon ? 'DÉCOLLAGE !' : pct >= 120 ? 'GRAND PLOUF !' : 'PLOUF !';
  if (killer) addQi(killer, 15);
  const D = S.duel, final = D && D.phase === 'fight' && D.score[1 - v.idx] + 1 >= D.firstTo;
  // éjection décisive : ralenti plus long et caméra sur la victime
  if (final) { S.slow = Math.max(S.slow, 1100); emit({ t: 'cine', id: v.idx, ms: 1500 }); emit({ t: 'final', to: v.idx }); }
  else if (pct >= 120 || v.lastHitDragon) { S.slow = Math.max(S.slow, 700); emit({ t: 'cine', id: v.idx, ms: 900 }); }
  emit({ t: 'ko', to: v.idx, by: killer ? killer.idx : -1, pct, exh: !!v.exhHit && S.time - v.lastHitT < 4000 });
  duelPoint(v);
}
const MOVEMULT: Record<string, number> = { idle: 1, charge: 0.35, parry: 0.3, recover: 0.4, dodge: 0, stun: 0, tumble: 0, ledge: 0, climb: 0, frozen: 0 };
function turnRate(e: Fighter) {
  switch (e.state) {
    case 'idle': return 14; case 'parry': return 12; case 'charge': return 7; case 'recover': return 6; case 'dodge': return 4;
    case 'attack': { const a = e.atk; return a.t < a.su ? 9 : a.t < a.su + a.ac ? 1.5 : 4; }
    default: return 0;
  }
}
function updAttack(e: Fighter, ms: number) {
  const a = e.atk, d = a.def, prev = a.t; a.t += ms;
  // Le coup blanc se transforme en charge si le bouton est encore tenu. La marge évite de rater
  // la fenêtre quand le démarrage du coup est à peine plus long que le seuil (pas de 16,7 ms).
  if (a.kind === 'white' && e.abil.charge && e.holding && e.holdT >= CHARGE_START && a.t < Math.max(a.su, CHARGE_START + 30) && a.hit.size === 0 && e.souffle >= 1) { startCharge(e); return; }
  const l0 = a.su * 0.3, l1 = a.su + a.ac;
  if (d.lunge && a.t > l0 && prev < l1) { const dd = d.lunge * (Math.min(a.t, l1) - Math.max(prev, l0)) / (l1 - l0); moveSafe(e, Math.cos(e.facing) * dd, Math.sin(e.facing) * dd); }
  checkHits(e);
  if (e.state !== 'attack') return;
  if (!a.applied && a.t >= a.su + a.ac) { e.stance = a.endStance; a.applied = true; }
  if (a.t >= a.su + a.ac + a.rc * 0.45 && e.buffer) { const b = e.buffer; e.buffer = null; finishAttack(e); runBuffer(e, b); return; }
  if (a.t >= a.su + a.ac + a.rc) finishAttack(e);
}
function finishAttack(e: Fighter) { const a = e.atk; if (a && !a.applied) e.stance = a.endStance; e.comboT = a && a.kind === 'white' ? 500 : 0; e.atk = null; toIdle(e); }
// D6.1 : plein régime si on agit ou si on avance vers l'adversaire, ralenti si on attend ou recule.
function regenMult(e: Fighter) {
  if (e.state !== 'idle') return RULES.regenAdvance;
  const o = S.f.find((x: Fighter) => x !== e && alive(x)); if (!o) return RULES.regenAdvance;
  const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 1;
  return (e.move.x * dx + e.move.y * dy) / d > 0.3 ? RULES.regenAdvance : RULES.regenIdle;
}
function updEnt(e: Fighter, dt: number) {
  const ms = dt * 1000;
  if (e.state === 'dead') return;
  if (e.state === 'falling') { updFall(e, dt); return; }
  e.spam = Math.max(0, e.spam - RULES.spamDecay * dt); e.stateT += ms; e.comboT -= ms; e.spawnInv = Math.max(0, e.spawnInv - ms); e.elanT = Math.max(0, e.elanT - ms);
  if (e.dropT > 0) { e.dropT -= ms; if (e.dropT <= 0) { e.dropT = 0; fx.ring(e.x, e.y, 12, 44, 380, '#ecdfc6', 4); fx.sfx('thud', e.x, e.y, 0.8); } }
  if (e.holding) e.holdT += ms;
  if (e.buffer) { e.bufferT += ms; if (e.bufferT > 450) e.buffer = null; }
  if (e.emote) { e.emote.t += ms; if (e.emote.t > 1800) e.emote = null; }
  if (e.state !== 'dodge') e.souffle = Math.min(3, e.souffle + dt / SOUFFLE_REGEN * regenMult(e));
  const tr = turnRate(e); e.facing += clamp(angDiff(e.facing, e.wantFacing), -tr * dt, tr * dt);
  switch (e.state) {
    case 'attack': updAttack(e, ms); break;
    case 'charge': e.chargeT += ms; if (!e.holding || e.chargeT >= CHARGE_MAX - CHARGE_START) releaseCharge(e); break;
    case 'parry': if (e.stateT >= PARRY_WIN) { e.state = 'recover'; e.stateT = 0; e.stunDur = PARRY_MISS; } break;
    case 'recover': case 'stun': if (e.stateT >= e.stunDur) toIdle(e); break;
    case 'dodge': updDodge(e); break;
    case 'tumble': if (e.stateT > 200 && Math.hypot(e.vx, e.vy) < 130) { e.state = 'stun'; e.stateT = 0; e.stunDur = 120; } break;
    case 'ledge': e.ledge.t += ms; if (e.ledge.t > 1500) climb(e); break;
    case 'climb': updClimb(e); break;
  }
  if (e.state === 'idle' && e.buffer) { const b = e.buffer; e.buffer = null; runBuffer(e, b); }
  if (e.state === 'ledge' || e.state === 'climb') return;
  let mm = MOVEMULT[e.state];
  if (e.state === 'attack') mm = e.atk && e.atk.kind === 'white' && e.atk.t > e.atk.su + e.atk.ac ? 0.5 : 0.15;
  mm = mm || 0;
  if (mm > 0) moveSafe(e, e.move.x * MOVE_SPEED * mm * dt, e.move.y * MOVE_SPEED * mm * dt);
  e.x += e.vx * dt; e.y += e.vy * dt; const k = Math.exp(-S.damp * dt); e.vx *= k; e.vy *= k;
  const H = S.H;
  if (Math.abs(e.x) > H || Math.abs(e.y) > H) {
    const sp = Math.hypot(e.vx, e.vy);
    if (sp > 30) { if (sp / S.damp < LEDGE_MAX) grabLedge(e); else startFall(e); }
    else { e.x = clamp(e.x, -H + 2, H - 2); e.y = clamp(e.y, -H + 2, H - 2); }
  }
}
function collide() {
  const f = S.f;
  for (let i = 0; i < f.length; i++) {
    const a = f[i]; if (!alive(a) || a.state === 'ledge' || a.state === 'climb') continue;
    for (let j = i + 1; j < f.length; j++) {
      const b = f[j]; if (!alive(b) || b.state === 'ledge' || b.state === 'climb') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < R * 2 && d > 0.01) { const o = (R * 2 - d) / 2, ux = dx / d, uy = dy / d; moveSafe(a, -ux * o, -uy * o); moveSafe(b, ux * o, uy * o); }
    }
  }
}

/* ================= bot d'entraînement ================= */
function newBrain(skill: number, dummy = false) { return { adapt: 0, adaptShown: false, dummy, mode: 'idle', cd: 1200, ax: 0, ay: 0, skill, atkCd: 900, strafe: 1, strafeT: 0, pref: 58, plan: null, holdFor: 0, chain: 0, seen: new Map(), climbAt: null, respect: 0, waited: false }; }
function edgeInward(e: Fighter) { const H = S.H, m = 110; let x = 0, y = 0; if (e.x > H - m) x = -(e.x - (H - m)) / m; if (e.x < -H + m) x = (-H + m - e.x) / m; if (e.y > H - m) y = -(e.y - (H - m)) / m; if (e.y < -H + m) y = (-H + m - e.y) / m; return { x, y }; }
function botPress(e: Fighter, hold: number) { doAction(e, 'pressAtk'); e.bot.holdFor = hold; }
function botUpdate(e: Fighter, dt: number) {
  if (!alive(e) || e.state === 'frozen') { e.move = { x: 0, y: 0 }; return; }
  const b = e.bot, ms = dt * 1000;
  if (b.dummy) { dummyUpdate(e, dt); return; }
  // Anti-spam : si l'humain martèle l'attaque, le bot monte de niveau et le dit.
  const H = S.f.find((o: Fighter) => o !== e && alive(o));
  if (H && !H.bot) {
    if (H.spam >= RULES.spamThreshold) {
      b.adapt = Math.min(RULES.botAdaptMax, b.adapt + RULES.botAdaptRate * dt);
      if (!b.adaptShown && b.adapt > 0.03) { b.adaptShown = true; fx.float(e.x, e.y - 66, 'IL T’A LU', '#e5483a', 18); }
    } else { b.adapt = Math.max(0, b.adapt - RULES.botAdaptDecay * dt); if (b.adapt === 0) b.adaptShown = false; }
  }
  const s = Math.min(1, b.skill + b.adapt);
  b.atkCd -= ms; b.strafeT -= ms; b.respect -= ms;
  if (e.holding) { b.holdFor -= ms; if (b.holdFor <= 0) doAction(e, 'releaseAtk'); }
  if (e.state === 'ledge') { if (b.climbAt == null) b.climbAt = rand(150, 900) * (1.25 - s); b.climbAt -= ms; if (b.climbAt <= 0) { b.climbAt = null; climb(e); } e.move = { x: 0, y: 0 }; return; }
  b.climbAt = null;
  if (b.strafeT <= 0) { b.strafe = rnd() < 0.5 ? -1 : 1; b.strafeT = rand(700, 2000); b.pref = rand(50, 64); }
  const T = S.f.find((o: Fighter) => o !== e && alive(o));
  if (T) {
    const dx0 = e.x - T.x, dy0 = e.y - T.y, d0 = Math.hypot(dx0, dy0);
    if (T.state === 'charge' && d0 < 170) b.respect = 250;
    if (T.state === 'attack' && b.seen.get(T.id) !== T.atk.uid) {
      const a = T.atk;
      if (d0 <= a.def.rg + a.def.lunge + 40 && (a.def.arc >= 360 || Math.abs(angDiff(T.facing, Math.atan2(dy0, dx0))) <= a.def.arc * RAD / 2 + 0.6)) {
        b.seen.set(T.id, a.uid); const left = a.su - a.t;
        if (a.kind === 'red') { if (rnd() < s * 0.95) { const react = rand(80, 230) * (1.3 - s); if (react < left + a.ac * 0.6) b.plan = { act: 'dodge', at: Math.max(0, Math.min(react, left - 50)) }; } }
        else {
          const r = rnd();
          if (r < s * 0.78 && e.abil.parry) { const react = rand(70, 210) * (1.3 - s); const lead = s > 0.8 ? rand(40, 120) : rand(100, 200); let at = left - lead; if (at < react) at = rnd() < s ? react : 1e9; if (at < left + a.ac) b.plan = { act: 'parry', at }; }
          else if (r < s * 0.92 || (!e.abil.parry && r < s * 0.85)) b.plan = { act: 'dodge', at: Math.max(rand(50, 150) * (1.3 - s), left - 120) };
        }
      }
    }
  }
  if (b.plan) { b.plan.at -= ms; if (b.plan.at <= 0) { const p = b.plan; b.plan = null;
    if (p.act === 'parry') doAction(e, 'parry');
    else if (T) { const sg = rnd() < 0.5 ? 1 : -1; const px = -Math.sin(T.facing) * sg, py = Math.cos(T.facing) * sg; const inw = edgeInward(e); doAction(e, 'dodge', { x: px + inw.x * 1.5, y: py + inw.y * 1.5 }); } } }
  let mx = 0, my = 0;
  if (T) {
    const dx = T.x - e.x, dy = T.y - e.y, dist = Math.max(1, Math.hypot(dx, dy)), ux = dx / dist, uy = dy / dist;
    e.wantFacing = Math.atan2(dy, dx);
    const tc = Math.hypot(T.x, T.y) || 1, cx = -T.x / tc, cy = -T.y / tc;
    let px = lerp(-ux, cx, s * 0.75), py = lerp(-uy, cy, s * 0.75); const pl = Math.hypot(px, py) || 1; px /= pl; py /= pl;
    const gx = T.x + px * b.pref, gy = T.y + py * b.pref, tx = gx - e.x, ty = gy - e.y, tl = Math.hypot(tx, ty);
    if (tl > 10) { const k = Math.min(1, tl / 40); mx = tx / tl * k; my = ty / tl * k; }
    mx += -uy * b.strafe * 0.3; my += ux * b.strafe * 0.3;
    if (b.respect > 0 && s > 0.3 && e.state !== 'charge') { mx -= ux * 0.9; my -= uy * 0.9; }
    if (e.souffle < 1 && s > 0.5 && dist < 120) { mx -= ux * 0.5; my -= uy * 0.5; }
    const tOk = T.spawnInv <= 0 && T.state !== 'climb';
    if (e.state === 'idle' && !b.plan && b.atkCd <= 0 && tOk) {
      const wr = nextWhite(e).rg + 12, hv = HA[e.deck.heavy[e.stance]];
      if (T.state === 'ledge' && dist < wr + 20) botPress(e, 0);
      else if (T.state === 'charge' && dist < wr + 18 && rnd() < 0.35 + s * 0.55) botPress(e, 0);
      else if ((T.state === 'parry' || T.state === 'recover' || T.state === 'stun') && dist < hv.rg + hv.lunge && e.souffle >= 1 && rnd() < 0.3 + s * 0.6) botPress(e, T.state === 'parry' ? rand(160, 260) : rand(200, 500));
      else if (dist < wr) { if (e.souffle >= 1 && rnd() < 0.22) botPress(e, rand(260, 820)); else { botPress(e, 0); b.chain = rnd() < 0.35 + s * 0.5 ? (rnd() < 0.5 ? 1 : 2) : 0; } }
      else if (dist < hv.rg + hv.lunge && e.souffle >= 1 && rnd() < 0.015 + s * 0.012) botPress(e, rand(300, 760));
      b.atkCd = rand(220, 700) * (1.45 - s);
    }
    if (e.state === 'charge' && T.state === 'dodge' && s > 0.65 && !b.waited) { b.holdFor += 260; b.waited = true; }
    if (e.state !== 'charge') b.waited = false;
    if (e.state === 'attack' && e.atk.kind === 'white' && e.atk.t > e.atk.su && !e.buffer && b.chain > 0 && dist < 95) { doAction(e, 'pressAtk'); b.holdFor = 0; b.chain--; }
    if (rnd() < 0.0008 && e.state === 'idle') doAction(e, 'emote', pick(['salut', 'rire', 'viens', 'lent']));
  }
  const inw = edgeInward(e); mx += inw.x * (0.6 + s); my += inw.y * (0.6 + s);
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; } e.move = { x: mx, y: my };
}

/* ================= mannequin d'entraînement ================= */
// Modes pilotés par le tutoriel : 'idle' (reste à sa place), 'white' (attaque lentement en blanc).
function dummyUpdate(e: Fighter, dt: number) {
  const b = e.bot, ms = dt * 1000; b.cd -= ms;
  e.souffle = 3;
  const T = S.f.find((o: Fighter) => o !== e && alive(o));
  e.move = { x: 0, y: 0 };
  if (!T || e.state === 'frozen') return;
  const dx = T.x - e.x, dy = T.y - e.y, dist = Math.hypot(dx, dy);
  if (e.state !== 'attack' || e.atk.t < e.atk.su) e.wantFacing = Math.atan2(dy, dx);
  if (b.mode === 'idle') { const hx = b.ax - e.x, hy = b.ay - e.y, hl = Math.hypot(hx, hy); if (e.state === 'idle' && hl > 30) e.move = { x: hx / hl * 0.4, y: hy / hl * 0.4 }; return; }
  if (b.mode === 'white' && e.state === 'idle') {
    if (dist > 64) e.move = { x: dx / dist * 0.55, y: dy / dist * 0.55 };
    else if (b.cd <= 0) { startWhite(e); b.cd = 1700; }
  }
}
export function setDummy(st: Sim, idx: number, mode: string, ax = 0, ay = 0) { const e = st.f[idx]; if (e && e.bot) { e.bot.mode = mode; e.bot.ax = ax; e.bot.ay = ay; e.bot.cd = 900; } }

/* ================= instantanés réseau ================= */
const r1 = (v: number) => Math.round(v * 10) / 10, r2 = (v: number) => Math.round(v * 100) / 100;
export function snapshot(st: Sim) {
  const D = st.duel;
  return {
    tm: Math.round(st.time), h: r1(st.H),
    d: [D.score[0], D.score[1], D.round, D.phase, Math.round(D.fightT || 0), D.sudden ? 1 : 0, D.mp ? 1 : 0],
    f: st.f.map((e: Fighter) => {
      const a = e.atk;
      return [r1(e.x), r1(e.y), r2(e.facing), e.state, Math.round(e.stateT), e.stance, r1(e.pct), r2(e.souffle), Math.round(e.qi), Math.round(e.elanT), Math.round(e.spawnInv), Math.round(e.fallT), Math.round(e.dropT || 0), e.kos, Math.round(e.chargeT), e.chargeDef ? e.chargeDef.id : '',
        a ? [a.def.id, a.kind === 'red' ? 1 : 0, Math.round(a.t), Math.round(a.su), a.ac, Math.round(a.rc), a.startStance, a.dragon ? 1 : 0] : 0,
        e.emote ? [e.emote.id, Math.round(e.emote.t)] : 0, e.ledge ? [e.ledge.nx, e.ledge.ny] : 0, e.deck.heavy[e.stance], nextWhite(e).id];
    }),
  };
}
// Copie locale de l'état chez l'invité, mise à jour par les instantanés et avancée entre deux.
export function createMirror(specs: Spec[]) {
  return {
    H: DUEL_H, time: 0, duel: { score: [0, 0], round: 1, phase: 'intro', firstTo: FIRST_TO, fightT: 0, sudden: false, mp: false },
    f: specs.map((sp, i) => ({ idx: i, name: sp.name, look: sanitizeLook(sp.look), belt: sp.belt || null, abil: { ...(sp.abil || FULL_ABIL) }, x: i ? 110 : -110, y: 0, tx: i ? 110 : -110, ty: 0, facing: i ? Math.PI : 0, state: 'frozen', stateT: 0, stance: 0, pct: 0, souffle: 3, qi: 0, elanT: 0, spawnInv: 0, fallT: 0, dropT: 0, kos: 0, chargeT: 0, chargeDef: null, atk: null, emote: null, ledge: null, trail: [], heavyId: 'retourne', nextId: 'direct', fresh: true })),
  };
}
export function applySnapshot(m: any, s: any) {
  m.time = s.tm; m.duel.score = [s.d[0], s.d[1]]; m.duel.round = s.d[2]; m.duel.phase = s.d[3];
  m.duel.fightT = s.d[4] || 0; m.duel.sudden = !!s.d[5]; m.duel.mp = !!s.d[6]; if (s.h) m.H = s.h;
  s.f.forEach((p: any[], i: number) => {
    const e = m.f[i]; if (!e) return;
    const [x, y, facing, state, stateT, stance, pct, souffle, qi, elanT, spawnInv, fallT, dropT, kos, chargeT, chargeId, a, em, ledge, heavyId, nextId] = p;
    const jump = Math.hypot(x - e.x, y - e.y) > 160 || e.fresh || (state === 'frozen' && e.state !== 'frozen');
    e.tx = x; e.ty = y; if (jump) { e.x = x; e.y = y; e.fresh = false; }
    e.facing = facing; e.state = state; e.stateT = stateT; e.stance = stance; e.pct = pct; e.souffle = souffle; e.qi = qi; e.elanT = elanT; e.spawnInv = spawnInv; e.fallT = fallT; e.dropT = dropT; e.kos = kos; e.chargeT = chargeT;
    e.chargeDef = chargeId ? ATTACK_BY_ID[chargeId] : null;
    e.atk = a ? { def: ATTACK_BY_ID[a[0]], kind: a[1] ? 'red' : 'white', t: a[2], su: a[3], ac: a[4], rc: a[5], startStance: a[6], dragon: !!a[7] } : null;
    e.emote = em ? { id: em[0], t: em[1] } : null;
    e.ledge = ledge ? { nx: ledge[0], ny: ledge[1] } : null;
    e.heavyId = heavyId; e.nextId = nextId;
  });
}
export function advanceMirror(m: any, dt: number) {
  const ms = dt * 1000, k = 1 - Math.exp(-22 * dt);
  for (const e of m.f) {
    e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
    e.stateT += ms; if (e.atk) e.atk.t += ms; if (e.state === 'charge') e.chargeT += ms; if (e.state === 'falling') e.fallT += ms;
    if (e.emote) e.emote.t += ms; if (e.dropT > 0) e.dropT = Math.max(0, e.dropT - ms);
    e.elanT = Math.max(0, e.elanT - ms); e.spawnInv = Math.max(0, e.spawnInv - ms);
  }
}
