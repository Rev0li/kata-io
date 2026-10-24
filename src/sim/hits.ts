// Résolution des coups : touche, parade, esquive parfaite, recul, rattrapage au bord, chute et éjection.
import { RAD, R, WHITE_KB, RED_KB, TUMBLE_V, PARRY_PERFECT, DODGE_IF0, DODGE_IF1, RULES } from './data';
import { clamp, angDiff, alive, emit, fx } from './core';
import type { Fighter, Sim } from './core';
import { toIdle } from './fighter';
import { duelPoint } from './duel';

function addQi(e: Fighter, n: number) {
  if (e.abil.dragon) e.qi = Math.min(100, e.qi + n);
}

export function checkHits(S: Sim, e: Fighter) {
  const a = e.atk,
    d = a.def;
  if (a.t < a.su || a.t >= a.su + a.ac) return;
  const hits = d.hits || 1,
    seg = a.ac / hits,
    k = Math.min(hits - 1, Math.floor((a.t - a.su) / seg));
  if (k !== a.seg) {
    a.seg = k;
    a.hit.clear();
    fx.sfx(S, 'whoosh', e.x, e.y, 0.5);
  }
  const ar = (d.arc * RAD) / 2;
  for (const o of S.f) {
    if (o === e || !alive(o) || a.hit.has(o.id)) continue;
    const dx = o.x - e.x,
      dy = o.y - e.y,
      dist = Math.hypot(dx, dy);
    if (dist > d.rg + R * 0.7) continue;
    if (d.arc < 360 && Math.abs(angDiff(e.facing, Math.atan2(dy, dx))) > ar + Math.atan2(R, Math.max(dist, 1)))
      continue;
    resolveHit(S, e, o);
    if (e.state !== 'attack') return;
  }
}
function resolveHit(S: Sim, att: Fighter, tgt: Fighter) {
  const a = att.atk;
  a.hit.add(tgt.id);
  if (tgt.spawnInv > 0 || tgt.state === 'climb') return;
  if (tgt.god) {
    // mode test : le coup glisse sur lui
    fx.sparks(S, tgt.x, tgt.y, '#8ff5d0', 4);
    return;
  }
  if (tgt.state === 'dodge' && tgt.stateT >= DODGE_IF0 && tgt.stateT <= DODGE_IF1) {
    perfectDodge(S, tgt, att);
    return;
  }
  if (tgt.state === 'ledge') {
    tgt.lastHitBy = att.id;
    tgt.lastHitT = S.time;
    tgt.lastHitDragon = a.dragon;
    tgt.pct += a.def.dmg;
    const an = Math.atan2(tgt.y - att.y, tgt.x - att.x);
    tgt.vx = Math.cos(an) * 420;
    tgt.vy = Math.sin(an) * 420;
    fx.sparks(S, tgt.x, tgt.y, '#ecdfc6', 8);
    fx.sfx(S, 'hit', tgt.x, tgt.y);
    startFall(S, tgt);
    return;
  }
  const red = a.kind === 'red';
  let guardBreak = false;
  if (tgt.state === 'parry') {
    if (!red) {
      parried(S, tgt, att, tgt.stateT <= PARRY_PERFECT);
      return;
    }
    guardBreak = true;
    fx.float(S, tgt.x, tgt.y - 52, 'GARDE BRISÉE', '#e5483a', 17);
  }
  if (tgt.state === 'charge') fx.float(S, tgt.x, tgt.y - 52, 'INTERROMPU', '#ecdfc6', 16);
  applyHit(S, att, tgt, guardBreak);
}
function applyHit(S: Sim, att: Fighter, tgt: Fighter, guardBreak: boolean) {
  const a = att.atk,
    d = a.def,
    red = a.kind === 'red';
  const dmg = red ? d.dmg * a.power : d.dmg;
  tgt.pct = Math.min(999, tgt.pct + dmg);
  tgt.lastHitBy = att.id;
  tgt.lastHitT = S.time;
  tgt.lastHitDragon = a.dragon;
  let mult =
    (d.kb || 1) * (a.finisher ? 1.35 : 1) * (red ? a.power : 1) * (a.dragon ? 1.5 : 1) * (guardBreak ? 1.2 : 1);
  if (att.elanT > 0) {
    mult *= 1.4;
    att.elanT = 0;
    fx.float(S, att.x, att.y - 52, 'ÉLAN', '#62c2a2', 15);
  }
  // D1 : épuisé = presque certain d'être éjecté
  tgt.exhHit = false;
  if (tgt.souffle < 1 && tgt.state !== 'dodge') {
    tgt.exhHit = true;
    mult *= RULES.exhaustKbMult;
    fx.float(S, tgt.x, tgt.y - 66, 'ÉPUISÉ !', '#e5483a', 20);
    emit(S, { t: 'exhausted', to: tgt.idx });
  }
  tgt.dodgeCount = 0;
  const K = red ? RED_KB : WHITE_KB;
  const v = (K[0] + K[1] * tgt.pct) * mult;
  const dist = Math.hypot(tgt.x - att.x, tgt.y - att.y);
  let ang = dist > 1 ? Math.atan2(tgt.y - att.y, tgt.x - att.x) : att.facing;
  ang += angDiff(ang, att.facing) * 0.3;
  tgt.vx = Math.cos(ang) * v;
  tgt.vy = Math.sin(ang) * v;
  tgt.atk = null;
  tgt.buffer = null;
  tgt.comboT = 0;
  tgt.chargeT = 0;
  tgt.dodge = null;
  if (v > TUMBLE_V) {
    tgt.state = 'tumble';
    tgt.stateT = 0;
  } else {
    tgt.state = 'stun';
    tgt.stateT = 0;
    tgt.stunDur = Math.min(520, 200 + 1.5 * tgt.pct);
  }
  addQi(att, red ? 8 : 4);
  addQi(tgt, 2);
  const col = a.dragon ? '#f2c14e' : red ? '#e5483a' : '#ecdfc6';
  fx.sparks(S, tgt.x - Math.cos(ang) * 10, tgt.y - Math.sin(ang) * 10, col, red ? 16 : 9);
  if (red || v > 700) fx.ring(S, tgt.x, tgt.y, 8, red ? 52 : 36, 240, col, red ? 5 : 3);
  fx.sfx(S, v > 650 ? 'bighit' : 'hit', tgt.x, tgt.y, clamp(0.6 + v / 1500, 0.6, 1.2));
  S.hitstop = Math.max(S.hitstop, Math.min(150, 40 + v / 22));
  fx.shake(S, Math.min(10, 2 + v / 170));
  emit(S, { t: 'hit', by: att.idx, to: tgt.idx, v, red, idx: a.idx, dragon: a.dragon, exh: !!tgt.exhHit });
}
function parried(S: Sim, def: Fighter, att: Fighter, perfect: boolean) {
  att.state = 'stun';
  att.stateT = 0;
  att.stunDur = perfect ? 900 : 650;
  att.atk = null;
  att.buffer = null;
  att.comboT = 0;
  att.holding = false;
  const an = Math.atan2(att.y - def.y, att.x - def.x);
  if (perfect) {
    att.vx = Math.cos(an) * 260;
    att.vy = Math.sin(an) * 260;
  }
  toIdle(def);
  addQi(def, perfect ? 25 : 15);
  def.souffle = Math.min(3, def.souffle + (perfect ? RULES.parryPerfectSouffle : RULES.parrySouffle));
  const mx = (att.x + def.x) / 2,
    my = (att.y + def.y) / 2,
    col = perfect ? '#f2c14e' : '#e0a243';
  fx.ring(S, mx, my, 6, perfect ? 60 : 44, 280, col, perfect ? 5 : 4);
  fx.sparks(S, mx, my, col, perfect ? 20 : 12);
  fx.float(S, def.x, def.y - 52, perfect ? 'PARADE PARFAITE' : 'PARADE', col, perfect ? 19 : 17);
  fx.sfx(S, perfect ? 'perfect' : 'parry', def.x, def.y);
  S.hitstop = Math.max(S.hitstop, 90);
  fx.shake(S, perfect ? 5 : 3);
  if (perfect) S.slow = Math.max(S.slow, 160);
  emit(S, { t: 'parry', by: def.idx, perfect });
}
function perfectDodge(S: Sim, tgt: Fighter, att: Fighter) {
  if (tgt.lastAvoid === att.atk.uid) return;
  tgt.lastAvoid = att.atk.uid;
  if (tgt.abil.elan) {
    tgt.souffle = Math.min(3, tgt.souffle + 1);
    tgt.elanT = 1500;
    S.slow = Math.max(S.slow, 200);
  }
  addQi(tgt, 15);
  tgt.dodgeCount = (tgt.dodgeCount || 0) + 1; // D2 : compteur d'équilibre (bonus pas encore décidé)
  if (RULES.balanceEnabled && tgt.dodgeCount >= RULES.balanceDodgesRequired) {
    tgt.dodgeCount = 0;
    emit(S, { t: 'balance', idx: tgt.idx });
  }
  fx.float(S, tgt.x, tgt.y - 52, 'ESQUIVE !', '#62c2a2', 17);
  fx.sfx(S, 'avoid', tgt.x, tgt.y, 1);
  emit(S, { t: 'dodge', by: tgt.idx });
}

/* ---------- bord du dojo, chute et éjection ---------- */
export function grabLedge(S: Sim, e: Fighter) {
  const H = S.H,
    ox = Math.abs(e.x) - H,
    oy = Math.abs(e.y) - H;
  let nx = 0,
    ny = 0;
  if (ox >= oy) {
    nx = Math.sign(e.x);
    e.x = nx * (H + 8);
    e.y = clamp(e.y, -H + 10, H - 10);
  } else {
    ny = Math.sign(e.y);
    e.y = ny * (H + 8);
    e.x = clamp(e.x, -H + 10, H - 10);
  }
  e.state = 'ledge';
  e.stateT = 0;
  e.ledge = { nx, ny, t: 0 };
  e.vx = e.vy = 0;
  e.atk = null;
  e.buffer = null;
  e.holding = false;
  e.facing = e.wantFacing = Math.atan2(-ny, -nx);
  fx.float(S, e.x, e.y - 46, 'RATTRAPÉ', '#ecdfc6', 15);
}
export function startFall(S: Sim, e: Fighter) {
  if (!alive(e)) return;
  const killer = S.time - e.lastHitT < 4000 ? S.f.find((o: Fighter) => o.id === e.lastHitBy && o !== e) : null;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp < 120) {
    const nx = Math.abs(e.x) >= Math.abs(e.y) ? Math.sign(e.x) : 0,
      ny = nx ? 0 : Math.sign(e.y);
    e.vx = nx * 160;
    e.vy = ny * 160;
  }
  e.state = 'falling';
  e.stateT = 0;
  e.fallT = 0;
  e.atk = null;
  e.holding = false;
  e.buffer = null;
  e.ledge = null;
  e.emote = null;
  koFighter(S, e, killer);
}
function koFighter(S: Sim, v: Fighter, killer: Fighter) {
  const pct = Math.round(v.pct);
  v.splashFx = killer ? killer.look.ejection || 'plouf' : 'plouf';
  v.koWord = pct >= 180 || v.lastHitDragon ? 'DÉCOLLAGE !' : pct >= 120 ? 'GRAND PLOUF !' : 'PLOUF !';
  if (killer) addQi(killer, 15);
  const D = S.duel,
    final = D && D.phase === 'fight' && D.score[1 - v.idx] + 1 >= D.firstTo;
  // éjection décisive : ralenti plus long et caméra sur la victime
  if (final) {
    S.slow = Math.max(S.slow, 1100);
    emit(S, { t: 'cine', id: v.idx, ms: 1500 });
    emit(S, { t: 'final', to: v.idx });
  } else if (pct >= 120 || v.lastHitDragon) {
    S.slow = Math.max(S.slow, 700);
    emit(S, { t: 'cine', id: v.idx, ms: 900 });
  }
  emit(S, { t: 'ko', to: v.idx, by: killer ? killer.idx : -1, pct, exh: !!v.exhHit && S.time - v.lastHitT < 4000 });
  duelPoint(S, v);
}
