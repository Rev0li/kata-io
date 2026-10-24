import Phaser from 'phaser';
import { Renderer, WATER_HEX } from '../game/render';
import { session } from '../net/session';
import { controls, updateControls } from '../ui/controls';
import { updateActionBar, actionEvent } from '../ui/actionbar';
import { initAudio, setListener, musicTick } from '../game/audio';
import { clamp } from '../sim/sim';

// Scène de combat : avance la partie, applique les effets et suit le joueur avec la caméra.
export class GameScene extends Phaser.Scene {
  r!: Renderer;
  cine: { idx: number; t: number } | null = null;
  view = new Phaser.Geom.Rectangle();

  constructor() { super('game'); }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor(WATER_HEX);
    cam.centerOn(0, 0);
    this.r = new Renderer(this);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!session.active || controls.blocked() || p.wasTouch) return;
      initAudio();
      if (p.rightButtonDown()) controls.parry();
      else if (p.leftButtonDown()) controls.setAtk(true);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (!p.wasTouch && p.leftButtonReleased()) controls.setAtk(false); });
    this.input.on('pointermove', () => { controls.mouseSeen = true; });
    this.scene.launch('hud');
  }

  update(time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    const cam = this.cameras.main;
    const st = session.state;
    const me = st ? st.f[session.myIdx] : null;
    const foe = st ? st.f[1 - session.myIdx] : null;

    // entrées : déplacement et visée
    let aim = session.input.aim;
    if (me) {
      if (controls.isTouch || !controls.mouseSeen) { if (foe && foe.state !== 'dead') aim = Math.atan2(foe.y - me.y, foe.x - me.x); }
      else { const p = this.input.activePointer; const w = cam.getWorldPoint(p.x, p.y); if (Math.hypot(w.x - me.x, w.y - me.y) > 6) aim = Math.atan2(w.y - me.y, w.x - me.x); }
    }
    updateControls(aim);

    session.tick(dt);
    for (const ev of session.takeFx()) {
      this.r.handle(ev);
      if (ev.t === 'shake') cam.shake(140, Math.min(0.012, ev.n * 0.0011));
      if (ev.t === 'cine') this.cine = { idx: ev.id, t: ev.ms };
      if (ev.t === 'ko') cam.flash(160, 255, 255, 255, false);
      actionEvent(ev, session.myIdx);
      this.game.events.emit('fx', ev);
    }

    // caméra
    let tx = 0, ty = 0;
    if (this.cine) { this.cine.t -= delta; if (this.cine.t <= 0 || !st) this.cine = null; }
    const focus = st ? (this.cine ? st.f[this.cine.idx] : me) : null;
    if (focus && focus.state !== 'dead') { tx = focus.x * 0.75; ty = focus.y * 0.75; }
    const k = 1 - Math.exp(-5 * dt);
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * k, cy = cam.midPoint.y + (ty - cam.midPoint.y) * k;
    const W = this.scale.width, H = this.scale.height;
    let z = clamp(Math.max(Math.min(W, H) / 380, Math.sqrt(W * H) / 600), 0.9, 1.6);
    if (!st) z *= 0.85;
    if (this.cine) z *= 1.25;
    cam.setZoom(cam.zoom + (z - cam.zoom) * (1 - Math.exp(-3.5 * dt)));
    cam.centerOn(cx, cy);
    setListener(cx, cy);
    this.view.setTo(cam.worldView.x, cam.worldView.y, cam.worldView.width, cam.worldView.height);

    this.r.update(dt, time, st, session.myIdx, this.view);
    if (st) updateActionBar(st.f[session.myIdx]);
    musicTick();
  }
}
