import Phaser from 'phaser';
import { session } from '../net/session';
import { heatCss } from '../game/render';
import { controls } from '../ui/controls';
import { FIRST_TO, LEVELS, ATTACK_BY_ID, RULES } from '../sim/data';
import { nextWhite, SUDDEN_T } from '../sim/sim';
import { Ev } from '../sim/sim';
import { bumpHint } from '../game/hints';

const DISP = '"Big Shoulders Display", Impact, sans-serif';
const BODY = 'Barlow, system-ui, sans-serif';

// Interface en jeu, dessinée par-dessus le combat sans être affectée par le zoom de la caméra.
export class HudScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  score!: Phaser.GameObjects.Text; sub!: Phaser.GameObjects.Text; ping!: Phaser.GameObjects.Text;
  myName!: Phaser.GameObjects.Text; myPct!: Phaser.GameObjects.Text; myMoves!: Phaser.GameObjects.Text;
  opName!: Phaser.GameObjects.Text; opPct!: Phaser.GameObjects.Text;
  big!: Phaser.GameObjects.Text; hint!: Phaser.GameObjects.Text;
  warnT = 0; tip = ''; tipT = 0; cause = ''; causeT = 0; prevS = 3; flash = { col: 0xffffff, a: 0, t: 0, life: 1 }; bigT = 0; bigLife = 1; bump = 0; matchT = 0;

  constructor() { super('hud'); }

  create() {
    const t = (size: number, family = DISP, weight = '800', color = '#ecdfc6') => this.add.text(0, 0, '', { fontFamily: family, fontStyle: weight, fontSize: size + 'px', color, stroke: '#0f1719', strokeThickness: 4, resolution: 2 });
    this.g = this.add.graphics();
    this.score = t(30).setOrigin(0.5, 0);
    this.sub = t(13, BODY, '600', '#93a59f').setOrigin(0.5, 0);
    this.ping = t(12, BODY, '600', '#93a59f').setOrigin(1, 0);
    this.myName = t(13, BODY, '700', '#e0a243');
    this.myPct = t(58, DISP, '900');
    this.myMoves = t(12, BODY, '600', '#cfc5b0');
    this.opName = t(13, BODY, '700', '#ecdfc6').setOrigin(1, 0);
    this.opPct = t(40, DISP, '900').setOrigin(1, 0);
    this.big = t(110, DISP, '900').setOrigin(0.5).setAlpha(0);
    this.hint = t(14, BODY, '600', '#ecdfc6').setOrigin(0.5, 1);
    this.game.events.on('fx', (ev: Ev) => this.onFx(ev));
    this.scale.on('resize', () => this.layout());
    this.layout();
  }

  onFx(ev: Ev) {
    if (ev.t === 'big') { this.big.setText(ev.text).setColor(ev.col); this.bigT = 0; this.bigLife = ev.life; }
    if (ev.t === 'hit' && ev.to === session.myIdx) this.bump = 1;
    if (ev.t === 'spam' && ev.idx === session.myIdx) this.warnT = 3500;
    if (ev.t === 'spamblock' && ev.idx === session.myIdx && bumpHint('spamblock') <= 3) { this.tip = 'Tu martèles l’attaque : chaque coup coûte du souffle. Alterne avec parade, esquive ou coup chargé.'; this.tipT = 4000; }
    // pourquoi suis-je tombé ? (toujours affiché : c'est ce qui permet de progresser)
    if (ev.t === 'ko' && ev.to === session.myIdx && session.mode !== 'tuto') {
      this.cause = ev.exh ? 'ÉPUISÉ : sans souffle, un seul coup t’a envoyé à l’eau. Avance ou pare pour en regagner.'
        : ev.pct >= 100 ? `Éjecté à ${ev.pct} % : plus ton pourcentage monte, plus tu voles loin.` : 'Poussé hors du dojo : garde un œil sur le bord.';
      this.causeT = 3800;
    }
    // flashs de couleur façon animé : doré (paume du dragon), rouge (coup chargé), blanc (gros coup, éjection)
    if (ev.t === 'hit') { if (ev.dragon) this.fl(0xf2c14e, 0.42, 240); else if (ev.red) this.fl(0xe5483a, 0.26, 170); else if (ev.v > 650) this.fl(0xffffff, 0.16, 110); }
    if (ev.t === 'final') this.fl(0xffffff, 0.7, 380);
    if (ev.t === 'ko') this.fl(0xffffff, 0.3, 140);
    if (ev.t === 'big' && ev.text === 'MANCHE 1') this.matchT = 0;
  }

  fl(col: number, a: number, life: number) { if (a >= this.flash.a * (1 - this.flash.t / this.flash.life)) this.flash = { col, a, t: 0, life }; }
  layoutTouch: boolean | null = null;
  safe = { l: 0, r: 0, t: 0, b: 0 };
  // marges de sécurité de l'écran (encoche, coins arrondis, barre d'accueil) lues depuis le CSS
  measureSafe() {
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(d); const c = getComputedStyle(d); this.safe = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 }; d.remove();
  }
  layout() {
    this.measureSafe();
    const W = this.scale.width, H = this.scale.height, m = 16, touch = controls.isTouch, S = this.safe; this.layoutTouch = touch;
    this.hint.setAlign('center').setWordWrapWidth(Math.min(W * 0.86, 640));
    this.big.setPosition(W / 2, H * 0.42).setFontSize(Math.round(Math.min(W, H) / 5.5) + 'px');
    if (touch) {
      // tactile : peu de texte. Score au centre, étage dessous, un pourcentage dans chaque coin, indice en bas au centre
      this.score.setPosition(W / 2, 8 + S.t).setFontSize('20px'); this.sub.setVisible(false);
      this.ping.setOrigin(0.5, 0).setPosition(W / 2, 34 + S.t).setFontSize('11px');
      this.myName.setVisible(false); this.opName.setVisible(false); this.myMoves.setVisible(false);
      this.myPct.setPosition(m + S.l, 48 + S.t).setFontSize('38px');
      this.opPct.setPosition(W - m - S.r, 48 + S.t).setFontSize('30px');
      this.hint.setOrigin(0.5, 1).setPosition(W / 2, H - 8 - S.b).setFontSize('12px');
    } else {
      this.score.setPosition(W / 2, 12).setFontSize('30px'); this.sub.setPosition(W / 2, 46);
      this.ping.setOrigin(1, 0).setPosition(W - m, 14).setFontSize('12px');
      this.myName.setPosition(m + 4, H - 128); this.myPct.setPosition(m, H - 112).setFontSize('58px'); this.myMoves.setVisible(true).setPosition(m + 4, H - 22);
      this.opName.setPosition(W - m - 4, 40); this.opPct.setPosition(W - m, 56).setFontSize('40px');
      this.hint.setOrigin(0.5, 0).setPosition(W / 2, 68).setFontSize('14px');
    }
  }

  update(_time: number, delta: number) {
    const st = session.mode === 'showcase' ? null : session.state, show = !!st; // pas de HUD dans la vitrine de la boutique
    if (this.layoutTouch !== controls.isTouch) this.layout(); // passage souris <-> tactile en cours de partie
    for (const o of [this.score, this.ping, this.myName, this.myPct, this.myMoves, this.opName, this.opPct, this.hint]) o.setVisible(show && !(controls.isTouch && (o === this.myMoves || o === this.myName || o === this.opName)));
    this.g.clear();
    this.bigT += delta; this.warnT = Math.max(0, this.warnT - delta); this.tipT = Math.max(0, this.tipT - delta); this.causeT = Math.max(0, this.causeT - delta);
    this.flash.t += delta; if (this.flash.t < this.flash.life) this.g.fillStyle(this.flash.col, this.flash.a * (1 - this.flash.t / this.flash.life)).fillRect(0, 0, this.scale.width, this.scale.height);
    const bp = this.bigT / this.bigLife;
    this.big.setAlpha(bp >= 1 ? 0 : bp < 0.15 ? bp / 0.15 : bp > 0.7 ? 1 - (bp - 0.7) / 0.3 : 1).setScale(1 + 0.08 * Math.max(0, 1 - bp));
    if (!st) { this.sub.setVisible(false); return; }
    this.matchT += delta;
    const me = st.f[session.myIdx], op = st.f[1 - session.myIdx], D = st.duel;
    const sMe = D.score[session.myIdx], sOp = D.score[1 - session.myIdx];
    const tuto = session.mode === 'tuto', ab = me.abil || { parry: true, charge: true, dragon: true };
    this.score.setVisible(!tuto).setText(session.mode === 'tower' ? `TOI  ${sMe} — ${sOp}` : `TOI  ${sMe} — ${sOp}  ${op.name.toUpperCase()}`);
    this.sub.setVisible(!controls.isTouch && !tuto).setText(`Manche ${D.round} · premier à ${D.firstTo || FIRST_TO}`);
    const fl = session.floor;
    this.ping.setText(tuto ? 'Tutoriel' : session.mode === 'tower' && fl ? (fl.daily ? `Défi du jour · ${fl.name}` : `Étage ${fl.n} · ${fl.name}`) + (session.attempt > 1 ? ` · essai ${session.attempt}` : '') : session.mode === 'practice' ? `Entraînement · ${LEVELS[session.level].name}` : session.ping >= 0 ? `Ping ${session.ping} ms` : 'Connexion…');
    this.myName.setText(me.name);
    this.myPct.setText(Math.round(me.pct) + '%').setColor(heatCss(me.pct));
    this.bump = Math.max(0, this.bump - delta / 300);
    this.myPct.setScale(1 + this.bump * 0.35);
    this.opName.setText(op.name);
    // D3 : l'état de l'adversaire n'est pas montré (sauf ?debug)
    const showOp = RULES.showOpponentPct || new URLSearchParams(location.search).has('debug');
    this.opPct.setVisible(showOp).setText(Math.round(op.pct) + '%').setColor(heatCss(op.pct));
    const nw = me.deck ? nextWhite(me) : ATTACK_BY_ID[me.nextId];
    const hv = me.deck ? ATTACK_BY_ID[me.deck.heavy[me.stance]] : ATTACK_BY_ID[me.heavyId];
    this.myMoves.setText(`Prochain coup : ${nw ? nw.name : '—'}` + (ab.charge ? `   ·   Chargé : ${hv ? hv.name : '—'}` : ''));
    const tip = !ab.parry ? (controls.isTouch ? 'Frappe · Esquive ses coups · Envoie-le à l’eau' : 'Frappe (clic) · Esquive ses coups (Espace) · Envoie-le à l’eau')
      : (controls.isTouch ? 'Blanc : Parer · Rouge : Esquive · Envoie-le à l’eau' : 'Blanc : pare (clic droit) · Rouge : esquive (Espace) · Envoie-le à l’eau');
    const left = Math.ceil((SUDDEN_T - (D.fightT || 0)) / 1000);
    this.hint.setColor('#ecdfc6');
    if (!tuto && D.phase === 'fight' && me.souffle < 1 && this.prevS >= 1 && bumpHint('exhaust') <= 4) { this.tip = 'Souffle épuisé : un seul coup peut t’éjecter. Avance vers lui ou pare pour en regagner.'; this.tipT = 3800; }
    this.prevS = me.souffle;
    if (session.notice) this.hint.setText(session.notice);
    else if (this.causeT > 0) this.hint.setText(this.cause).setColor('#ffb48a');
    else if (this.tipT > 0) this.hint.setText(this.tip).setColor('#ffd9a0');
    else if (this.warnT > 0) this.hint.setText('Spam interdit : alterne parade, esquive et coup chargé').setColor('#ff8a6e');
    else if (D.phase === 'fight' && !D.sudden && left <= 10 && left > 0) this.hint.setText(`Mort subite dans ${left} s`).setColor('#ff8a6e');
    else if (D.phase === 'fight' && D.sudden && st.H > 112) this.hint.setText('Mort subite : le dojo rétrécit !').setColor('#ff8a6e');
    else if (session.teaser && this.matchT < 9000) this.hint.setText(`Il maîtrise ta prochaine technique : ${session.teaser} !`).setColor('#f2c14e');
    else this.hint.setText(!tuto && this.matchT < 9000 ? tip : '');
    // jauges : souffle (3 segments) et qi
    const touch = controls.isTouch, W = this.scale.width, H = this.scale.height;
    const x0 = touch ? 16 + this.safe.l : 20, y0 = touch ? 94 + this.safe.t : H - 46, w = touch ? 104 : 168;
    const seg = (w - 8) / 3;
    for (let i = 0; i < 3; i++) {
      const v = Math.max(0, Math.min(1, me.souffle - i));
      this.g.fillStyle(0x0a1012, 0.9).fillRect(x0 + i * (seg + 4), y0, seg, 9);
      this.g.fillStyle(0xecdfc6, 1).fillRect(x0 + i * (seg + 4), y0, seg * v, 9);
    }
    if (ab.dragon) {
      const ready = me.qi >= 100;
      this.g.fillStyle(0x0a1012, 0.9).fillRect(x0, y0 + 13, w, 6);
      this.g.fillStyle(ready ? 0xf2c14e : 0x62c2a2, 1).fillRect(x0, y0 + 13, w * Math.min(1, me.qi / 100), 6);
    }
    void W;
  }
}
