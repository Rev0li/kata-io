import Phaser from 'phaser';
import { session } from '../net/session';
import { heatCss } from '../game/render';
import { controls } from '../ui/controls';
import { FIRST_TO, LEVELS, ATTACK_BY_ID } from '../sim/data';
import { nextWhite } from '../sim/sim';
import { Ev } from '../sim/sim';

const DISP = '"Big Shoulders Display", Impact, sans-serif';
const BODY = 'Barlow, system-ui, sans-serif';

// Interface en jeu, dessinée par-dessus le combat sans être affectée par le zoom de la caméra.
export class HudScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  score!: Phaser.GameObjects.Text; sub!: Phaser.GameObjects.Text; ping!: Phaser.GameObjects.Text;
  myName!: Phaser.GameObjects.Text; myPct!: Phaser.GameObjects.Text; myMoves!: Phaser.GameObjects.Text;
  opName!: Phaser.GameObjects.Text; opPct!: Phaser.GameObjects.Text;
  big!: Phaser.GameObjects.Text; hint!: Phaser.GameObjects.Text;
  bigT = 0; bigLife = 1; bump = 0; matchT = 0;

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
    if (ev.t === 'big' && ev.text === 'MANCHE 1') this.matchT = 0;
  }

  layout() {
    const W = this.scale.width, H = this.scale.height, m = 16, touch = controls.isTouch;
    this.score.setPosition(W / 2, 12).setFontSize(touch ? '22px' : '30px'); this.sub.setPosition(W / 2, 46).setVisible(!touch);
    this.ping.setPosition(W - m, touch ? 44 : 14);
    this.big.setPosition(W / 2, H * 0.42).setFontSize(Math.round(Math.min(W, H) / 5.5) + 'px');
    if (touch) {
      this.myName.setPosition(m, 64); this.myPct.setPosition(m, 80).setFontSize('46px'); this.myMoves.setVisible(false);
      this.opName.setPosition(W - m, 64); this.opPct.setPosition(W - m, 80).setFontSize('34px');
      this.hint.setPosition(W / 2, 196);
    } else {
      this.myName.setPosition(m + 4, H - 128); this.myPct.setPosition(m, H - 112).setFontSize('58px'); this.myMoves.setVisible(true).setPosition(m + 4, H - 22);
      this.opName.setPosition(W - m - 4, 40); this.opPct.setPosition(W - m, 56).setFontSize('40px');
      this.hint.setPosition(W / 2, 92);
    }
  }

  update(_time: number, delta: number) {
    const st = session.state, show = !!st;
    for (const o of [this.score, this.ping, this.myName, this.myPct, this.myMoves, this.opName, this.opPct, this.hint]) o.setVisible(show && (o !== this.myMoves || !controls.isTouch));
    this.g.clear();
    this.bigT += delta;
    const bp = this.bigT / this.bigLife;
    this.big.setAlpha(bp >= 1 ? 0 : bp < 0.15 ? bp / 0.15 : bp > 0.7 ? 1 - (bp - 0.7) / 0.3 : 1).setScale(1 + 0.08 * Math.max(0, 1 - bp));
    if (!st) { this.sub.setVisible(false); return; }
    this.matchT += delta;
    const me = st.f[session.myIdx], op = st.f[1 - session.myIdx], D = st.duel;
    const sMe = D.score[session.myIdx], sOp = D.score[1 - session.myIdx];
    const tuto = session.mode === 'tuto', ab = me.abil || { parry: true, charge: true, dragon: true };
    this.score.setVisible(!tuto).setText(session.mode === 'tower' ? `TOI  ${sMe} — ${sOp}` : `TOI  ${sMe} — ${sOp}  ${op.name.toUpperCase()}`);
    this.sub.setVisible(!controls.isTouch && !tuto).setText(`Manche ${D.round} · premier à ${D.firstTo || FIRST_TO}`);
    this.ping.setText(tuto ? 'Tutoriel' : session.mode === 'tower' && session.floor ? `Étage ${session.floor.n} · ${session.floor.name}` : session.mode === 'practice' ? `Entraînement · ${LEVELS[session.level].name}` : session.ping >= 0 ? `Ping ${session.ping} ms` : 'Connexion…');
    this.myName.setText(me.name);
    this.myPct.setText(Math.round(me.pct) + '%').setColor(heatCss(me.pct));
    this.bump = Math.max(0, this.bump - delta / 300);
    this.myPct.setScale(1 + this.bump * 0.35);
    this.opName.setText(op.name);
    this.opPct.setText(Math.round(op.pct) + '%').setColor(heatCss(op.pct));
    const nw = me.deck ? nextWhite(me) : ATTACK_BY_ID[me.nextId];
    const hv = me.deck ? ATTACK_BY_ID[me.deck.heavy[me.stance]] : ATTACK_BY_ID[me.heavyId];
    this.myMoves.setText(`Prochain coup : ${nw ? nw.name : '—'}` + (ab.charge ? `   ·   Chargé : ${hv ? hv.name : '—'}` : ''));
    const tip = !ab.parry ? (controls.isTouch ? 'Frappe · Esquive ses coups · Envoie-le à l’eau' : 'Frappe (clic) · Esquive ses coups (Espace) · Envoie-le à l’eau')
      : (controls.isTouch ? 'Blanc : Parer · Rouge : Esquive · Envoie-le à l’eau' : 'Blanc : pare (clic droit) · Rouge : esquive (Espace) · Envoie-le à l’eau');
    if (session.notice) this.hint.setText(session.notice); else this.hint.setText(!tuto && this.matchT < 9000 ? tip : '');
    // jauges : souffle (3 segments) et qi
    const touch = controls.isTouch, W = this.scale.width, H = this.scale.height;
    const x0 = touch ? 16 : 20, y0 = touch ? 138 : H - 46, w = touch ? 120 : 168;
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
