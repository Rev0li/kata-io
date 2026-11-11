// Actions d'un combattant : entrées du joueur, coups blancs et chargés, parade, esquive, remontée au bord.
import * as DM from './dmath';
import { RAD, R, CHARGE_START, CHARGE_FULL, TF, RULES } from './data';
import { attaque } from './styles';
import type { AttackDef } from './data';
import { clamp, angDiff, alive, emit, fx } from './core';
import type { Fighter, Input, Sim } from './core';

export function applyInput(S: Sim, e: Fighter, inp: Input) {
  const p = e.inPrev;
  if (!alive(e) || e.state === 'frozen') {
    e.move = { x: 0, y: 0 };
    e.holding = false;
    e.inPrev = { atk: inp.atk, parryN: inp.parryN, dodgeN: inp.dodgeN, emoteN: inp.emoteN };
    return;
  }
  let mx = clamp(+inp.mx || 0, -1, 1),
    my = clamp(+inp.my || 0, -1, 1);
  const l = DM.hypot(mx, my);
  if (l > 1) {
    mx /= l;
    my /= l;
  }
  e.move = { x: mx, y: my };
  if (Number.isFinite(inp.aim)) e.wantFacing = inp.aim;
  if (inp.atk && !p.atk) doAction(S, e, 'pressAtk');
  else if (!inp.atk && p.atk) doAction(S, e, 'releaseAtk');
  if (inp.parryN > p.parryN) doAction(S, e, 'parry');
  if (inp.dodgeN > p.dodgeN) doAction(S, e, 'dodge', { x: mx, y: my });
  if (inp.emoteN > p.emoteN && inp.emote) doAction(S, e, 'emote', inp.emote);
  if (e.state === 'ledge' && e.ledge) {
    const L = e.ledge;
    if (mx * -L.nx + my * -L.ny > 0.5) climb(e);
  }
  e.inPrev = { atk: inp.atk, parryN: inp.parryN, dodgeN: inp.dodgeN, emoteN: inp.emoteN };
}

function startAttack(S: Sim, e: Fighter, d: AttackDef, o: any) {
  aimAssist(S, e, d, o.kind);
  e.state = 'attack';
  e.stateT = 0;
  e.chargeT = 0;
  e.atk = {
    def: d,
    kind: o.kind,
    t: 0,
    su: d.su,
    ac: d.ac,
    rc: d.rc,
    seg: -1,
    hit: new Set(),
    startStance: e.stance,
    endStance: TF[d.tf](e.stance),
    applied: false,
    uid: ++S.atkUid,
    idx: o.idx || 0,
    finisher: !!o.finisher,
    power: o.power || 1,
    dragon: !!o.dragon,
  };
  if (o.kind === 'red') fx.sfx(S, 'heavy', e.x, e.y, 0.8);
  if (o.kind === 'white' && e.atkSlow > 1) e.atk.su = d.su * e.atkSlow;
}
// Pas assez de souffle pour l'action : elle ne part pas, et le joueur le voit.
function tired(S: Sim, e: Fighter) {
  fx.float(S, e.x, e.y - 50, 'À BOUT DE SOUFFLE', '#93a59f', 14);
  emit(S, { t: 'tired', idx: e.idx });
}
export function startWhite(S: Sim, e: Fighter) {
  if (RULES.whiteCost > 0) {
    // chaque coup blanc coûte du souffle : c'est lui qui limite le spam
    if (e.souffle < RULES.whiteCost) {
      tired(S, e);
      return;
    }
    e.souffle -= RULES.whiteCost;
  } else if (e.spam >= RULES.spamThreshold) {
    // ancien anti-spam : en dessous du seuil, aucun coût ; au-dessus, le coup coûte du souffle et se bloque sans souffle
    if (e.souffle < RULES.spamAttackCost) {
      fx.float(S, e.x, e.y - 50, 'À BOUT DE SOUFFLE', '#93a59f', 14);
      emit(S, { t: 'spamblock', idx: e.idx });
      return;
    }
    e.souffle -= RULES.spamAttackCost;
  }
  const before = e.spam;
  e.spam += RULES.spamPerAttack; // compteur gardé : le bot s'adapte toujours à un joueur qui martèle
  if (!RULES.whiteCost && before < RULES.spamThreshold && e.spam >= RULES.spamThreshold)
    emit(S, { t: 'spam', idx: e.idx });
  const ch = e.deck.chain;
  if (e.comboT <= 0 || e.combo.idx >= Math.min(3, e.abil.chain) || !ch[e.combo.stance][e.combo.idx])
    e.combo = { stance: e.stance, idx: 0 };
  const idx = e.combo.idx,
    d = attaque(e, ch[e.combo.stance][idx]);
  e.combo.idx++;
  startAttack(S, e, d, { kind: 'white', idx, finisher: idx === 2 });
}
// Prochain coup blanc de l'enchaînement (sert aussi à l'affichage de la barre d'actions).
export function nextWhite(e: Fighter) {
  const ch = e.deck.chain;
  if (e.comboT > 0 && e.combo.idx < Math.min(3, e.abil.chain) && ch[e.combo.stance][e.combo.idx])
    return attaque(e, ch[e.combo.stance][e.combo.idx]);
  return attaque(e, ch[e.stance][0]);
}
export function startCharge(S: Sim, e: Fighter) {
  e.spam = Math.max(0, e.spam - RULES.spamDefend);
  e.state = 'charge';
  e.stateT = 0;
  e.chargeT = 0;
  e.chargeDef = attaque(e, e.deck.heavy[e.stance]);
  e.atk = null;
  e.combo = { stance: e.stance, idx: 0 };
  e.comboT = 0;
  fx.sfx(S, 'charge', e.x, e.y, 0.6);
}
export function releaseCharge(S: Sim, e: Fighter) {
  const d = e.chargeDef || attaque(e, e.deck.heavy[e.stance]);
  const power = 0.65 + 0.35 * clamp(e.chargeT / (CHARGE_FULL - CHARGE_START), 0, 1);
  const dragon = e.qi >= 100;
  if (dragon) e.qi = 0;
  e.souffle = Math.max(0, e.souffle - 1);
  startAttack(S, e, d, { kind: 'red', power, dragon });
  if (dragon) {
    fx.float(S, e.x, e.y - 52, 'PAUME DU DRAGON', '#f2c14e', 18);
    fx.ring(S, e.x, e.y, 20, 70, 400, '#f2c14e', 5);
  }
}
function aimAssist(S: Sim, e: Fighter, d: AttackDef, kind: string) {
  const reach = d.rg + (kind === 'red' ? d.lunge : d.lunge + 20) + R;
  let best = null,
    ba = 50 * RAD;
  for (const o of S.f) {
    if (o === e || !alive(o)) continue;
    const dx = o.x - e.x,
      dy = o.y - e.y,
      dist = DM.hypot(dx, dy);
    if (dist > reach) continue;
    const a = Math.abs(angDiff(e.facing, DM.atan2(dy, dx)));
    if (a < ba) {
      ba = a;
      best = o;
    }
  }
  if (best) e.facing = e.wantFacing = DM.atan2(best.y - e.y, best.x - e.x);
}
// Action mémorisée pendant un coup ou un étourdissement, jouée dès que possible.
export function runBuffer(S: Sim, e: Fighter, b: any) {
  if (b.type === 'atk') startWhite(S, e);
  else doAction(S, e, b.type, b.arg);
}

export function doAction(S: Sim, e: Fighter, type: string, arg?: any) {
  if (!e || !alive(e) || e.state === 'frozen') return;
  const st = e.state;
  switch (type) {
    case 'pressAtk':
      e.holding = true;
      e.holdT = 0;
      if (st === 'idle') startWhite(S, e);
      else if (st === 'ledge') climb(e);
      else if (['attack', 'stun', 'recover', 'dodge', 'parry', 'climb'].includes(st)) {
        e.buffer = { type: 'atk' };
        e.bufferT = 0;
      }
      return;
    case 'releaseAtk':
      e.holding = false;
      if (st === 'charge') releaseCharge(S, e);
      return;
    case 'parry':
      if (!e.abil.parry) return;
      if (st === 'idle' || st === 'charge') {
        if (e.souffle < RULES.parryCost) {
          tired(S, e);
          return;
        }
        e.souffle -= RULES.parryCost;
        e.spam = Math.max(0, e.spam - RULES.spamDefend);
        e.state = 'parry';
        e.stateT = 0;
        e.atk = null;
        e.holding = false;
        return;
      }
      if (st === 'attack' || st === 'stun' || st === 'dodge') {
        e.buffer = { type: 'parry' };
        e.bufferT = 0;
      }
      return;
    case 'dodge': {
      if (st === 'ledge') {
        climb(e);
        return;
      }
      const recov = st === 'attack' && e.atk.kind === 'white' && e.atk.t >= e.atk.su + e.atk.ac;
      if (st === 'idle' || st === 'charge' || recov) {
        if (e.souffle < 1) {
          tired(S, e);
          return;
        }
        startDodge(S, e, arg);
        return;
      }
      if (st === 'attack' || st === 'stun') {
        e.buffer = { type: 'dodge', arg };
        e.bufferT = 0;
      }
      return;
    }
    case 'emote':
      if (st === 'ledge' || typeof arg !== 'string') return;
      e.emote = { id: arg, t: 0 };
      return;
  }
}
function startDodge(S: Sim, e: Fighter, dir: any) {
  let dx: number, dy: number;
  if (dir && DM.hypot(dir.x, dir.y) > 0.2) {
    const l = DM.hypot(dir.x, dir.y);
    dx = dir.x / l;
    dy = dir.y / l;
  } else {
    dx = -DM.cos(e.facing);
    dy = -DM.sin(e.facing);
  }
  e.spam = Math.max(0, e.spam - RULES.spamDefend);
  e.souffle -= 1;
  e.state = 'dodge';
  e.stateT = 0;
  e.dodge = { dx, dy, done: 0, ox: e.x, oy: e.y }; // ox, oy : d'où part l'esquive (voir checkHits)
  e.atk = null;
  e.holding = false;
  e.chargeT = 0;
  fx.sfx(S, 'avoid', e.x, e.y, 0.45);
}
export function climb(e: Fighter) {
  if (e.state !== 'ledge') return;
  e.state = 'climb';
  e.stateT = 0;
  e.holding = false;
}
