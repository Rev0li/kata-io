// Adversaires pilotés par la simulation : bot d'entraînement (et gardiens de la Tour), mannequin du tutoriel.
import { RAD, HA, RULES } from './data';
import { lerp, angDiff, alive, rnd, rand, pick, fx } from './core';
import type { Fighter, Sim } from './core';
import { doAction, climb, startWhite, nextWhite } from './actions';

export function newBrain(skill: number, dummy = false) {
  return {
    adapt: 0,
    adaptShown: false,
    dummy,
    mode: 'idle',
    cd: 1200,
    ax: 0,
    ay: 0,
    skill,
    atkCd: 900,
    strafe: 1,
    strafeT: 0,
    pref: 58,
    plan: null,
    holdFor: 0,
    chain: 0,
    seen: new Map(),
    climbAt: null,
    respect: 0,
    waited: false,
  };
}
function edgeInward(S: Sim, e: Fighter) {
  const H = S.H,
    m = 110;
  let x = 0,
    y = 0;
  if (e.x > H - m) x = -(e.x - (H - m)) / m;
  if (e.x < -H + m) x = (-H + m - e.x) / m;
  if (e.y > H - m) y = -(e.y - (H - m)) / m;
  if (e.y < -H + m) y = (-H + m - e.y) / m;
  return { x, y };
}
function botPress(S: Sim, e: Fighter, hold: number) {
  doAction(S, e, 'pressAtk');
  e.bot.holdFor = hold;
}

/* ================= bot d'entraînement ================= */
export function botUpdate(S: Sim, e: Fighter, dt: number) {
  if (!alive(e) || e.state === 'frozen') {
    e.move = { x: 0, y: 0 };
    return;
  }
  const b = e.bot,
    ms = dt * 1000;
  if (b.dummy) {
    dummyUpdate(S, e, dt);
    return;
  }
  // Anti-spam : si l'humain martèle l'attaque, le bot monte de niveau et le dit.
  const H = S.f.find((o: Fighter) => o !== e && alive(o));
  if (H && !H.bot) {
    if (H.spam >= RULES.spamThreshold) {
      b.adapt = Math.min(RULES.botAdaptMax, b.adapt + RULES.botAdaptRate * dt);
      if (!b.adaptShown && b.adapt > 0.03) {
        b.adaptShown = true;
        fx.float(S, e.x, e.y - 66, 'IL T’A LU', '#e5483a', 18);
      }
    } else {
      b.adapt = Math.max(0, b.adapt - RULES.botAdaptDecay * dt);
      if (b.adapt === 0) b.adaptShown = false;
    }
  }
  const s = Math.min(1, b.skill + b.adapt);
  b.atkCd -= ms;
  b.strafeT -= ms;
  b.respect -= ms;
  if (e.holding) {
    b.holdFor -= ms;
    if (b.holdFor <= 0) doAction(S, e, 'releaseAtk');
  }
  if (e.state === 'ledge') {
    if (b.climbAt == null) b.climbAt = rand(S, 150, 900) * (1.25 - s);
    b.climbAt -= ms;
    if (b.climbAt <= 0) {
      b.climbAt = null;
      climb(e);
    }
    e.move = { x: 0, y: 0 };
    return;
  }
  b.climbAt = null;
  if (b.strafeT <= 0) {
    b.strafe = rnd(S) < 0.5 ? -1 : 1;
    b.strafeT = rand(S, 700, 2000);
    b.pref = rand(S, 50, 64);
  }
  const T = S.f.find((o: Fighter) => o !== e && alive(o));
  if (T) {
    const dx0 = e.x - T.x,
      dy0 = e.y - T.y,
      d0 = Math.hypot(dx0, dy0);
    if (T.state === 'charge' && d0 < 170) b.respect = 250;
    if (T.state === 'attack' && b.seen.get(T.id) !== T.atk.uid) {
      const a = T.atk;
      if (
        d0 <= a.def.rg + a.def.lunge + 40 &&
        (a.def.arc >= 360 || Math.abs(angDiff(T.facing, Math.atan2(dy0, dx0))) <= (a.def.arc * RAD) / 2 + 0.6)
      ) {
        b.seen.set(T.id, a.uid);
        const left = a.su - a.t;
        if (a.kind === 'red') {
          if (rnd(S) < s * 0.95) {
            const react = rand(S, 80, 230) * (1.3 - s);
            if (react < left + a.ac * 0.6) b.plan = { act: 'dodge', at: Math.max(0, Math.min(react, left - 50)) };
          }
        } else {
          const r = rnd(S);
          if (r < s * 0.78 && e.abil.parry) {
            const react = rand(S, 70, 210) * (1.3 - s);
            const lead = s > 0.8 ? rand(S, 40, 120) : rand(S, 100, 200);
            let at = left - lead;
            if (at < react) at = rnd(S) < s ? react : 1e9;
            if (at < left + a.ac) b.plan = { act: 'parry', at };
          } else if (r < s * 0.92 || (!e.abil.parry && r < s * 0.85))
            b.plan = { act: 'dodge', at: Math.max(rand(S, 50, 150) * (1.3 - s), left - 120) };
        }
      }
    }
  }
  if (b.plan) {
    b.plan.at -= ms;
    if (b.plan.at <= 0) {
      const p = b.plan;
      b.plan = null;
      if (p.act === 'parry') doAction(S, e, 'parry');
      else if (T) {
        const sg = rnd(S) < 0.5 ? 1 : -1;
        const px = -Math.sin(T.facing) * sg,
          py = Math.cos(T.facing) * sg;
        const inw = edgeInward(S, e);
        doAction(S, e, 'dodge', { x: px + inw.x * 1.5, y: py + inw.y * 1.5 });
      }
    }
  }
  let mx = 0,
    my = 0;
  if (T) {
    const dx = T.x - e.x,
      dy = T.y - e.y,
      dist = Math.max(1, Math.hypot(dx, dy)),
      ux = dx / dist,
      uy = dy / dist;
    e.wantFacing = Math.atan2(dy, dx);
    const tc = Math.hypot(T.x, T.y) || 1,
      cx = -T.x / tc,
      cy = -T.y / tc;
    let px = lerp(-ux, cx, s * 0.75),
      py = lerp(-uy, cy, s * 0.75);
    const pl = Math.hypot(px, py) || 1;
    px /= pl;
    py /= pl;
    const gx = T.x + px * b.pref,
      gy = T.y + py * b.pref,
      tx = gx - e.x,
      ty = gy - e.y,
      tl = Math.hypot(tx, ty);
    if (tl > 10) {
      const k = Math.min(1, tl / 40);
      mx = (tx / tl) * k;
      my = (ty / tl) * k;
    }
    mx += -uy * b.strafe * 0.3;
    my += ux * b.strafe * 0.3;
    if (b.respect > 0 && s > 0.3 && e.state !== 'charge') {
      mx -= ux * 0.9;
      my -= uy * 0.9;
    }
    if (e.souffle < 1 && s > 0.5 && dist < 120) {
      mx -= ux * 0.5;
      my -= uy * 0.5;
    }
    const tOk = T.spawnInv <= 0 && T.state !== 'climb';
    if (e.state === 'idle' && !b.plan && b.atkCd <= 0 && tOk) {
      const wr = nextWhite(e).rg + 12,
        hv = HA[e.deck.heavy[e.stance]];
      if (T.state === 'ledge' && dist < wr + 20) botPress(S, e, 0);
      else if (T.state === 'charge' && dist < wr + 18 && rnd(S) < 0.35 + s * 0.55) botPress(S, e, 0);
      else if (
        (T.state === 'parry' || T.state === 'recover' || T.state === 'stun') &&
        dist < hv.rg + hv.lunge &&
        e.souffle >= 1 &&
        rnd(S) < 0.3 + s * 0.6
      )
        botPress(S, e, T.state === 'parry' ? rand(S, 160, 260) : rand(S, 200, 500));
      else if (dist < wr) {
        if (e.souffle >= 1 && rnd(S) < 0.22) botPress(S, e, rand(S, 260, 820));
        else {
          botPress(S, e, 0);
          b.chain = rnd(S) < 0.35 + s * 0.5 ? (rnd(S) < 0.5 ? 1 : 2) : 0;
        }
      } else if (dist < hv.rg + hv.lunge && e.souffle >= 1 && rnd(S) < 0.015 + s * 0.012)
        botPress(S, e, rand(S, 300, 760));
      b.atkCd = rand(S, 220, 700) * (1.45 - s);
    }
    if (e.state === 'charge' && T.state === 'dodge' && s > 0.65 && !b.waited) {
      b.holdFor += 260;
      b.waited = true;
    }
    if (e.state !== 'charge') b.waited = false;
    if (e.state === 'attack' && e.atk.kind === 'white' && e.atk.t > e.atk.su && !e.buffer && b.chain > 0 && dist < 95) {
      doAction(S, e, 'pressAtk');
      b.holdFor = 0;
      b.chain--;
    }
    if (rnd(S) < 0.0008 && e.state === 'idle') doAction(S, e, 'emote', pick(S, ['salut', 'rire', 'viens', 'lent']));
  }
  const inw = edgeInward(S, e);
  mx += inw.x * (0.6 + s);
  my += inw.y * (0.6 + s);
  const l = Math.hypot(mx, my);
  if (l > 1) {
    mx /= l;
    my /= l;
  }
  e.move = { x: mx, y: my };
}

/* ================= mannequin d'entraînement ================= */
// Modes pilotés par le tutoriel : 'idle' (reste à sa place), 'white' (attaque lentement en blanc).
function dummyUpdate(S: Sim, e: Fighter, dt: number) {
  const b = e.bot,
    ms = dt * 1000;
  b.cd -= ms;
  e.souffle = 3;
  const T = S.f.find((o: Fighter) => o !== e && alive(o));
  e.move = { x: 0, y: 0 };
  if (!T || e.state === 'frozen') return;
  const dx = T.x - e.x,
    dy = T.y - e.y,
    dist = Math.hypot(dx, dy);
  if (e.state !== 'attack' || e.atk.t < e.atk.su) e.wantFacing = Math.atan2(dy, dx);
  if (b.mode === 'idle') {
    const hx = b.ax - e.x,
      hy = b.ay - e.y,
      hl = Math.hypot(hx, hy);
    if (e.state === 'idle' && hl > 30) e.move = { x: (hx / hl) * 0.4, y: (hy / hl) * 0.4 };
    return;
  }
  if (b.mode === 'white' && e.state === 'idle') {
    if (dist > 64) e.move = { x: (dx / dist) * 0.55, y: (dy / dist) * 0.55 };
    else if (b.cd <= 0) {
      startWhite(S, e);
      b.cd = 1700;
    }
  }
}
export function setDummy(st: Sim, idx: number, mode: string, ax = 0, ay = 0) {
  const e = st.f[idx];
  if (e && e.bot) {
    e.bot.mode = mode;
    e.bot.ax = ax;
    e.bot.ay = ay;
    e.bot.cd = 900;
  }
}
