// Avancée d'un combattant d'un pas : états (coup, charge, parade, esquive, bord…), souffle, déplacement, recul et collisions.
import {
  R,
  DODGE_T,
  DODGE_DIST,
  CHARGE_START,
  CHARGE_MAX,
  PARRY_WIN,
  PARRY_MISS,
  SOUFFLE_REGEN,
  MOVE_SPEED,
  LEDGE_MAX,
  RULES,
} from './data';
import { clamp, lerp, easeOut, angDiff, alive, emit, fx } from './core';
import type { Fighter, Sim } from './core';
import { toIdle, moveSafe } from './fighter';
import { startCharge, releaseCharge, runBuffer, climb } from './actions';
import { checkHits, grabLedge, startFall } from './hits';

const MOVEMULT: Record<string, number> = {
  idle: 1,
  charge: 0.35,
  parry: 0.3,
  recover: 0.4,
  dodge: 0,
  stun: 0,
  tumble: 0,
  ledge: 0,
  climb: 0,
  frozen: 0,
};
function turnRate(e: Fighter) {
  switch (e.state) {
    case 'idle':
      return 14;
    case 'parry':
      return 12;
    case 'charge':
      return 7;
    case 'recover':
      return 6;
    case 'dodge':
      return 4;
    case 'attack': {
      const a = e.atk;
      return a.t < a.su ? 9 : a.t < a.su + a.ac ? 1.5 : 4;
    }
    default:
      return 0;
  }
}
function updAttack(S: Sim, e: Fighter, ms: number) {
  const a = e.atk,
    d = a.def,
    prev = a.t;
  a.t += ms;
  // Le coup blanc se transforme en charge si le bouton est encore tenu. La marge évite de rater
  // la fenêtre quand le démarrage du coup est à peine plus long que le seuil (pas de 16,7 ms).
  if (
    a.kind === 'white' &&
    e.abil.charge &&
    e.holding &&
    e.holdT >= CHARGE_START &&
    a.t < Math.max(a.su, CHARGE_START + 30) &&
    a.hit.size === 0 &&
    e.souffle >= 1
  ) {
    startCharge(S, e);
    return;
  }
  const l0 = a.su * 0.3,
    l1 = a.su + a.ac;
  if (d.lunge && a.t > l0 && prev < l1) {
    const dd = (d.lunge * (Math.min(a.t, l1) - Math.max(prev, l0))) / (l1 - l0);
    moveSafe(S, e, Math.cos(e.facing) * dd, Math.sin(e.facing) * dd);
  }
  checkHits(S, e);
  if (e.state !== 'attack') return;
  if (!a.applied && a.t >= a.su + a.ac) {
    e.stance = a.endStance;
    a.applied = true;
  }
  if (a.t >= a.su + a.ac + a.rc * 0.45 && e.buffer) {
    const b = e.buffer;
    e.buffer = null;
    finishAttack(e);
    runBuffer(S, e, b);
    return;
  }
  if (a.t >= a.su + a.ac + a.rc) finishAttack(e);
}
function finishAttack(e: Fighter) {
  const a = e.atk;
  if (a && !a.applied) e.stance = a.endStance;
  e.comboT = a && a.kind === 'white' ? 500 : 0;
  e.atk = null;
  toIdle(e);
}
function updDodge(S: Sim, e: Fighter) {
  const p = clamp(e.stateT / DODGE_T, 0, 1),
    want = DODGE_DIST * easeOut(p),
    dd = want - e.dodge.done;
  e.dodge.done = want;
  moveSafe(S, e, e.dodge.dx * dd, e.dodge.dy * dd);
  if (e.stateT >= DODGE_T + 60) toIdle(e);
}
function updClimb(S: Sim, e: Fighter) {
  const L = e.ledge,
    p = clamp(e.stateT / 300, 0, 1);
  const H = S.H;
  const d = lerp(8, -30, easeOut(p));
  if (L.nx) e.x = L.nx * (H + d);
  else e.y = L.ny * (H + d);
  if (e.stateT >= 300) {
    e.ledge = null;
    e.spawnInv = Math.max(e.spawnInv, 220);
    toIdle(e);
    fx.float(S, e.x, e.y - 50, 'SAUVÉ !', '#62c2a2', 19);
    emit(S, { t: 'saved', idx: e.idx });
  }
}
function updFall(S: Sim, e: Fighter, dt: number) {
  e.fallT += dt * 1000;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const k = Math.exp(-2.5 * dt);
  e.vx *= k;
  e.vy *= k;
  if (e.fallT >= 560) {
    emit(S, { t: 'splash', x: e.x, y: e.y, fx: e.splashFx, word: e.koWord });
    fx.sfx(S, 'splash', e.x, e.y);
    e.state = 'dead';
  }
}
// D6.1 : plein régime si on agit ou si on avance vers l'adversaire, ralenti si on attend ou recule.
function regenMult(S: Sim, e: Fighter) {
  if (e.state !== 'idle') return RULES.regenAdvance;
  const o = S.f.find((x: Fighter) => x !== e && alive(x));
  if (!o) return RULES.regenAdvance;
  const dx = o.x - e.x,
    dy = o.y - e.y,
    d = Math.hypot(dx, dy) || 1;
  return (e.move.x * dx + e.move.y * dy) / d > 0.3 ? RULES.regenAdvance : RULES.regenIdle;
}
export function updEnt(S: Sim, e: Fighter, dt: number) {
  const ms = dt * 1000;
  if (e.state === 'dead') return;
  if (e.state === 'falling') {
    updFall(S, e, dt);
    return;
  }
  e.spam = Math.max(0, e.spam - RULES.spamDecay * dt);
  e.stateT += ms;
  e.comboT -= ms;
  e.spawnInv = Math.max(0, e.spawnInv - ms);
  e.elanT = Math.max(0, e.elanT - ms);
  if (e.dropT > 0) {
    e.dropT -= ms;
    if (e.dropT <= 0) {
      e.dropT = 0;
      fx.ring(S, e.x, e.y, 12, 44, 380, '#ecdfc6', 4);
      fx.sfx(S, 'thud', e.x, e.y, 0.8);
    }
  }
  if (e.holding) e.holdT += ms;
  if (e.buffer) {
    e.bufferT += ms;
    if (e.bufferT > 450) e.buffer = null;
  }
  if (e.emote) {
    e.emote.t += ms;
    if (e.emote.t > 1800) e.emote = null;
  }
  if (e.state !== 'dodge') e.souffle = Math.min(3, e.souffle + (dt / SOUFFLE_REGEN) * regenMult(S, e));
  const tr = turnRate(e);
  e.facing += clamp(angDiff(e.facing, e.wantFacing), -tr * dt, tr * dt);
  switch (e.state) {
    case 'attack':
      updAttack(S, e, ms);
      break;
    case 'charge':
      e.chargeT += ms;
      if (!e.holding || e.chargeT >= CHARGE_MAX - CHARGE_START) releaseCharge(S, e);
      break;
    case 'parry':
      if (e.stateT >= PARRY_WIN) {
        e.state = 'recover';
        e.stateT = 0;
        e.stunDur = PARRY_MISS;
      }
      break;
    case 'recover':
    case 'stun':
      if (e.stateT >= e.stunDur) toIdle(e);
      break;
    case 'dodge':
      updDodge(S, e);
      break;
    case 'tumble':
      if (e.stateT > 200 && Math.hypot(e.vx, e.vy) < 130) {
        e.state = 'stun';
        e.stateT = 0;
        e.stunDur = 120;
      }
      break;
    case 'ledge':
      e.ledge.t += ms;
      if (e.ledge.t > 1500) climb(e);
      break;
    case 'climb':
      updClimb(S, e);
      break;
  }
  if (e.state === 'idle' && e.buffer) {
    const b = e.buffer;
    e.buffer = null;
    runBuffer(S, e, b);
  }
  if (e.state === 'ledge' || e.state === 'climb') return;
  let mm = MOVEMULT[e.state];
  if (e.state === 'attack') mm = e.atk && e.atk.kind === 'white' && e.atk.t > e.atk.su + e.atk.ac ? 0.5 : 0.15;
  mm = mm || 0;
  if (mm > 0) moveSafe(S, e, e.move.x * MOVE_SPEED * mm * dt, e.move.y * MOVE_SPEED * mm * dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const k = Math.exp(-S.damp * dt);
  e.vx *= k;
  e.vy *= k;
  const H = S.H;
  if (Math.abs(e.x) > H || Math.abs(e.y) > H) {
    const sp = Math.hypot(e.vx, e.vy);
    if (sp > 30 && !e.god) {
      if (sp / S.damp < LEDGE_MAX) grabLedge(S, e);
      else startFall(S, e);
    } else {
      e.x = clamp(e.x, -H + 2, H - 2);
      e.y = clamp(e.y, -H + 2, H - 2);
    }
  }
}
export function collide(S: Sim) {
  const f = S.f;
  for (let i = 0; i < f.length; i++) {
    const a = f[i];
    if (!alive(a) || a.state === 'ledge' || a.state === 'climb') continue;
    for (let j = i + 1; j < f.length; j++) {
      const b = f[j];
      if (!alive(b) || b.state === 'ledge' || b.state === 'climb') continue;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy);
      if (d < R * 2 && d > 0.01) {
        const o = (R * 2 - d) / 2,
          ux = dx / d,
          uy = dy / d;
        moveSafe(S, a, -ux * o, -uy * o);
        moveSafe(S, b, ux * o, uy * o);
      }
    }
  }
}
