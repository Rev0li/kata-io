// Déroulé d'un duel : manches, compte à rebours, mort subite, points et fin de partie.
import { emit, fx } from './core';
import type { Fighter, Sim } from './core';
import { resetFighter, toIdle } from './fighter';

// Mort subite : passé ce délai dans une manche, le dojo rétrécit jusqu'à SUDDEN_MIN.
export const SUDDEN_T = 25000,
  SUDDEN_RATE = 9,
  SUDDEN_MIN = 110;

export function duelRound(S: Sim) {
  const D = S.duel;
  D.round++;
  D.phase = 'intro';
  D.t = 0;
  D.fightT = 0;
  D.sudden = false;
  S.H = S.H0;
  const [a, b] = S.f;
  resetFighter(a, -110, 0);
  resetFighter(b, 110, 0);
  for (const e of S.f) {
    e.state = 'frozen';
    e.kos = D.score[e.idx];
    if (e.bot) {
      e.bot.plan = null;
      e.bot.seen.clear();
      e.bot.holdFor = 0;
    }
  }
  // balle de match : un point de plus et c'est fini
  D.mp = D.score.some((n: number) => n === D.firstTo - 1);
  if (D.mp) fx.big(S, 'BALLE DE MATCH', '#e5483a', 1100);
  else fx.big(S, 'MANCHE ' + D.round, '#ecdfc6', 850);
}
export function duelUpdate(S: Sim, dt: number) {
  const D = S.duel;
  if (D.phase === 'free') return;
  const prev = D.t;
  D.t += dt * 1000;
  if (D.phase === 'intro') {
    for (const [m, txt] of [
      [900, '3'],
      [1500, '2'],
      [2100, '1'],
    ] as [number, string][])
      if (D.t >= m && prev < m) {
        fx.big(S, txt, '#ecdfc6', 560);
        fx.sfx(S, 'ui', 0, 0, 1);
      }
    if (D.t >= 2700) {
      fx.big(S, 'COMBAT !', '#e0a243', 700);
      fx.sfx(S, 'gong', 0, 0, 0.6);
      for (const e of S.f) if (e.state === 'frozen') toIdle(e);
      D.phase = 'fight';
      if (D.round === 1) D.start = S.time;
    }
  } else if (D.phase === 'fight') {
    D.fightT += dt * 1000;
    if (!D.sudden && D.fightT >= SUDDEN_T) {
      D.sudden = true;
      fx.big(S, 'MORT SUBITE', '#e5483a', 1200);
      fx.sfx(S, 'gong', 0, 0, 0.9);
      fx.shake(S, 6);
      emit(S, { t: 'sudden' });
    }
    if (D.sudden && S.H > SUDDEN_MIN) {
      S.H = Math.max(SUDDEN_MIN, S.H - SUDDEN_RATE * dt);
      for (const e of S.f)
        if (e.state === 'ledge' && e.ledge) {
          if (e.ledge.nx) e.x = e.ledge.nx * (S.H + 8);
          else e.y = e.ledge.ny * (S.H + 8);
        }
    }
  } else if (D.phase === 'point') {
    if (D.t >= 1900) {
      if (D.score[0] >= D.firstTo || D.score[1] >= D.firstTo) {
        D.phase = 'end';
        D.winner = D.score[0] > D.score[1] ? 0 : 1;
        emit(S, { t: 'end', winner: D.winner, score: D.score.slice() });
      } else duelRound(S);
    }
  }
}
// v vient d'être éjecté : l'autre marque le point.
export function duelPoint(S: Sim, v: Fighter) {
  const D = S.duel;
  if (D.phase !== 'fight') return;
  const other = S.f[1 - v.idx];
  D.score[other.idx]++;
  D.phase = 'point';
  D.t = 0;
  // manche parfaite : gagnée sans avoir été touché une seule fois
  if (other.pct < 0.5) {
    fx.float(S, other.x, other.y - 66, 'PARFAIT !', '#f2c14e', 26);
    emit(S, { t: 'perfect', idx: other.idx });
  }
  other.state = 'frozen';
  other.holding = false;
  other.atk = null;
  other.kos = D.score[other.idx];
  emit(S, { t: 'point', to: other.idx, score: D.score.slice() });
}
