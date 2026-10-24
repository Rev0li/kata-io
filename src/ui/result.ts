// Écran de fin de partie : score, étoiles, XP et pièces, ceinture ou combattant débloqué, série, boutons de relance.
import {
  RANKS,
  starsFor,
  towerXp,
  towerCoins,
  streakMult,
  XP_DUEL_WIN,
  XP_DUEL_LOSS,
  XP_PRACTICE_WIN,
  COINS_PRACTICE,
  COINS_DUEL,
  DAILY_COINS,
  DAILY_XP,
  rankProgress,
} from '../sim/progression';
import { PERSOS, ARMES } from '../sim/data';
import { session } from '../net/session';
import { sfx } from '../game/audio';
import { $, confetti, restartAnim } from './dom';
import { show } from './nav';
import { profile, save, addXp, addCoins, myRank, rollDaily, PK, AK } from './profile';
import { setFace, setWico, renderLook, renderCoins, resetLookView } from './home';
import { startTower, startDaily, startTuto, practice } from './launch';

const SCROLLS: Record<string, string> = {
  chain2: 'scroll-plant',
  parry: 'scroll-ice',
  charge: 'scroll-rock',
  chain3: 'scroll-empty',
  elan: 'scroll-thunder',
  dragon: 'scroll-fire',
};
const nth = (n: number) => (n === 1 ? '1er' : n + 'e');

/* ---------- boutons ---------- */
let mainAction: () => void = () => {},
  altAction: (() => void) | null = null;
export const runMain = () => mainAction();
export const runAlt = () => altAction && altAction();
function setResultButtons(main: string, onMain: () => void, alt: string | null, onAlt: (() => void) | null) {
  $('#resMainLbl').textContent = main;
  mainAction = onMain;
  ($('#resMain') as HTMLButtonElement).disabled = false;
  const a = $('#resAlt');
  a.hidden = !alt;
  if (alt) a.textContent = alt;
  altAction = onAlt;
  $('#resRow').style.gridTemplateColumns = alt ? '1fr 1fr' : '1fr';
  $('#resHint').textContent = `Espace : ${main.toLowerCase()}`;
}

/* ---------- récompenses ---------- */
function showUnlock(rank: number) {
  const r = RANKS[rank],
    u = r.unlock;
  const box = $('#resUnlock');
  if (!u) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('#unlockBelt').textContent = r.name;
  $('#unlockTitle').textContent = u.title + ' :';
  $('#unlockText').textContent = u.text + ' ' + u.how;
  ($('#unlockScroll') as HTMLImageElement).src = `/assets/items/${SCROLLS[u.key] || 'scroll-empty'}.png`;
  const w = AK.find(id => ARMES[id].rank === rank);
  $('#unlockWpn').hidden = !w;
  if (w) {
    setWico($('#unlockWpnIco'), w);
    $('#unlockWpnTxt').textContent = `Nouvelle arme : ${ARMES[w].name}`;
  }
  $('#unlockTry').onclick = () =>
    startTuto(u.key === 'chain2' ? 'chain2' : u.key === 'chain3' ? 'chain3' : String(u.key));
  sfx('gong', 0.7);
}
function showPerso(id: string) {
  $('#resPerso').hidden = false;
  setFace($('#resPersoFace'), id);
  $('#resPersoName').textContent = PERSOS[id].name;
  const b = $('#resPersoUse') as HTMLButtonElement;
  b.disabled = false;
  b.textContent = 'Le prendre';
  b.onclick = () => {
    profile.look = { ...profile.look, perso: id };
    save();
    resetLookView();
    renderLook();
    b.disabled = true;
    b.textContent = 'C’est ton combattant';
  };
}
function showXp(gain: number, before: number, coins = 0) {
  $('#resXp').hidden = gain <= 0;
  if (gain <= 0) return;
  $('#resXpTxt').innerHTML =
    `+${gain} XP` +
    (coins ? ` <span class="coingain"><img class="px" src="/assets/items/gold-coin.png" alt="">+${coins}</span>` : '');
  const bar = $('#resXpBar') as HTMLElement;
  const rp0 = rankProgress(before),
    rp1 = rankProgress(profile.xp);
  bar.style.transition = 'none';
  bar.style.width = Math.round((rp1.i > rp0.i ? 0 : rp0.frac) * 100) + '%';
  void bar.offsetWidth;
  bar.style.transition = '';
  setTimeout(() => {
    bar.style.width = Math.round(rp1.frac * 100) + '%';
  }, 250);
}

/* ---------- fin de partie ---------- */
let endTimer = 0;
export const cancelEnd = () => clearTimeout(endTimer);
export function onEnd(winner: number, score: number[]) {
  endTimer = window.setTimeout(() => {
    const win = winner === session.myIdx,
      st = session.state,
      op = st ? st.f[1 - session.myIdx] : null;
    const sMe = score[session.myIdx],
      sOp = score[1 - session.myIdx];
    $('#resTitle').className = win ? 'win' : 'lose';
    $('#resStatus').textContent = '';
    $('#resNear').hidden = true;
    $('#resUnlock').hidden = true;
    $('#resPerso').hidden = true;
    $('#resStreak').hidden = true;
    let coins = 0;
    const starsEl = $('#resStars');
    starsEl.hidden = true;
    starsEl.querySelectorAll('i').forEach(i => i.classList.remove('on'));
    const xpBefore = profile.xp;
    let gain = 0;
    if (!win && op && op.pct >= 70) {
      $('#resNear').hidden = false;
      $('#resNear').textContent = `Il était à ${Math.round(op.pct)} % : encore un coup et il tombait.`;
    }
    if (session.mode === 'tower' && session.floor && session.floor.daily) {
      rollDaily();
      const D = profile.daily,
        f = session.floor,
        t = session.seconds;
      $('#resKicker').textContent = `Défi du jour · ${f.name}`;
      if (win) {
        const rec = !D.best || t < D.best;
        if (rec) D.best = t;
        if (!D.won) {
          D.won = true;
          gain = DAILY_XP;
          coins = DAILY_COINS;
        } else {
          gain = 10;
          coins = 3;
        }
        $('#resTitle').textContent = 'Défi réussi';
        $('#resScore').textContent =
          `${sMe} – ${sOp} en ${t} s` + (rec ? ' · record du jour !' : ` · record : ${D.best} s`);
        if (D.tries) $('#resStatus').textContent = `Battu au ${nth(D.tries + 1)} essai.`;
        D.tries = 0;
        setResultButtons('Améliorer mon temps', () => startDaily(), null, null);
      } else {
        D.tries++;
        gain = 5;
        coins = 1;
        $('#resTitle').textContent = 'Défi raté';
        $('#resScore').textContent = `${sMe} – ${sOp}`;
        $('#resStatus').textContent = `Essai ${D.tries} raté. Demain, ce sera un autre adversaire.`;
        setResultButtons('Réessayer', () => startDaily(), null, null);
      }
      save();
    } else if (session.mode === 'tower' && session.floor) {
      const f = session.floor,
        stars = starsFor(win, session.roundsLost, session.seconds, f.par);
      const first = win && profile.towerMax <= f.n;
      gain = towerXp(f.n, win, sMe, stars);
      coins = towerCoins(f.n, win, stars, first);
      // série d'étages gagnés : multiplie l'XP et les pièces ; une défaite la remet à zéro
      const rs = $('#resStreak');
      if (win) {
        profile.streak++;
        const m = streakMult(profile.streak);
        gain = Math.round(gain * m);
        coins = Math.round(coins * m);
        if (profile.streak >= 2) {
          rs.hidden = false;
          rs.className = 'streak';
          rs.textContent = `Série de ${profile.streak} étages : XP et pièces ×${m}`;
        }
      } else {
        if (profile.streak >= 2) {
          rs.hidden = false;
          rs.className = 'streak lost';
          rs.textContent = `Série perdue : ${profile.streak} étages d'affilée`;
        }
        profile.streak = 0;
      }
      save();
      $('#resKicker').textContent = `Étage ${f.n} · ${f.name}`;
      $('#resTitle').textContent = win ? 'Étage réussi' : 'Défaite';
      $('#resScore').textContent = `${sMe} – ${sOp}` + (win ? ` en ${session.seconds} s` : '');
      if (win) {
        starsEl.hidden = false;
        starsEl.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < stars));
        const firstClear = profile.towerMax <= f.n;
        profile.stars[f.n] = Math.max(profile.stars[f.n] || 0, stars);
        profile.towerMax = Math.max(profile.towerMax, f.n + 1);
        save();
        const gift = firstClear ? PK.find(id => PERSOS[id].floor === f.n) : undefined;
        if (gift) showPerso(gift);
        const tries = profile.tries[f.n] || 0;
        delete profile.tries[f.n];
        save();
        const hint =
          stars < 3
            ? stars === 1
              ? 'Deuxième étoile : gagne sans perdre une manche.'
              : `Troisième étoile : gagne en moins de ${f.par} s.`
            : '';
        $('#resStatus').textContent = (tries ? `Battu au ${nth(tries + 1)} essai ! ` : '') + hint;
        setResultButtons(
          `Étage ${f.n + 1}`,
          () => startTower(f.n + 1),
          'Rejouer',
          () => startTower(f.n),
        );
      } else {
        const tries = (profile.tries[f.n] = (profile.tries[f.n] || 0) + 1);
        save();
        const next = RANKS[myRank() + 1];
        $('#resStatus').textContent =
          session.teaser && next
            ? `Il t’a eu avec : ${session.teaser} ? Tu l’apprends à la ${next.name.toLowerCase()} (encore ${next.xp - profile.xp - gain} XP).`
            : `Essai ${tries} raté. Il t’attend.`;
        setResultButtons('Réessayer', () => startTower(f.n), null, null);
      }
    } else if (session.mode === 'practice') {
      gain = win ? XP_PRACTICE_WIN : 5;
      coins = COINS_PRACTICE[win ? 1 : 0];
      $('#resKicker').textContent = 'Entraînement';
      $('#resTitle').textContent = win ? 'Victoire' : 'Défaite';
      $('#resScore').textContent = `${sMe} – ${sOp} contre ${op ? op.name : 'le bot'}`;
      setResultButtons('Revanche', () => practice(), null, null);
    } else {
      gain = win ? XP_DUEL_WIN : XP_DUEL_LOSS;
      coins = COINS_DUEL[win ? 1 : 0];
      $('#resKicker').textContent = 'Duel';
      $('#resTitle').textContent = win ? 'Victoire' : 'Défaite';
      $('#resScore').textContent = `${sMe} – ${sOp} contre ${op ? op.name : 'ton adversaire'}`;
      $('#resStatus').textContent = 'Une revanche ? Il faut que vous la demandiez tous les deux.';
      setResultButtons('Revanche', () => session.requestRematch(), null, null);
    }
    const b = session.bonus,
      bc = b.saves * 2 + b.perfects * 5;
    $('#resBonus').hidden = !bc;
    if (bc) {
      coins += bc;
      $('#resBonus').textContent =
        [b.perfects ? `Parfait ×${b.perfects}` : '', b.saves ? `Sauvé ×${b.saves}` : ''].filter(Boolean).join(' · ') +
        ` : +${bc} pièces`;
    }
    const newRank = addXp(gain);
    addCoins(coins);
    renderCoins();
    showXp(gain, xpBefore, coins);
    if (newRank > 0) showUnlock(newRank);
    sfx(win ? 'win' : 'lose');
    show('result');
    restartAnim($('#resTitle'));
    if (win) confetti();
  }, 1300);
}
// Demande de revanche en duel : état de chacun des deux joueurs.
export function onRematch(me: boolean, them: boolean) {
  const st = session.state;
  const op = st ? st.f[1 - session.myIdx].name : 'Ton adversaire';
  $('#resStatus').textContent =
    me && them ? 'C’est reparti !' : me ? `En attente de ${op}…` : `${op} veut une revanche.`;
  if (me) {
    ($('#resMain') as HTMLButtonElement).disabled = true;
    $('#resMainLbl').textContent = 'Revanche demandée';
  }
}
