import Phaser from 'phaser';
import { Renderer, THEMES, iso2, unIso } from '../game/render';
import { session } from '../net/session';
import { controls, updateControls } from '../ui/controls';
import { updateActionBar, actionEvent } from '../ui/actionbar';
import { initAudio, setListener, musicTick, sfx } from '../game/audio';
import { clamp } from '../sim/sim';
import { isDojo } from '../sim/data';
import { preloadAssets, setupAssets } from '../game/assets';
import { viewState } from '../ui/viewstate';

// Scène de combat : avance la partie, applique les effets et suit le joueur avec la caméra.
export class GameScene extends Phaser.Scene {
  r!: Renderer;
  cine: { idx: number; t: number } | null = null;
  heartT = 0;
  mpOn = false;
  punch = 0;
  cineZ = 1.25;
  themeOverride: string | null = null;
  view = new Phaser.Geom.Rectangle();

  constructor() {
    super('game');
  }

  preload() {
    preloadAssets(this);
  }

  create() {
    setupAssets(this);
    const cam = this.cameras.main;
    cam.centerOn(0, 0);
    this.r = new Renderer(this);
    this.themeOverride = new URLSearchParams(location.search).get('theme');
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!session.active || controls.blocked() || p.wasTouch) return;
      initAudio();
      if (p.rightButtonDown()) controls.parry();
      else if (p.leftButtonDown()) controls.setAtk(true);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch && p.leftButtonReleased()) controls.setAtk(false);
    });
    this.input.on('pointermove', () => {
      controls.mouseSeen = true;
    });
    this.scene.launch('hud');
  }

  // Ambiance d'arène : l'accueil est de nuit. La Tour change de dojo tous les deux étages : coucher, bambous, brume, neige, néon, volcan.
  themeFor() {
    const m = session.mode,
      fl = session.floor;
    if (m === 'tower' && fl) {
      const ORDER = ['coucher', 'bambou', 'brume', 'neige', 'neon', 'volcan']; // deux étages par ambiance, puis on recommence
      if (fl.daily) {
        let h = 0;
        for (const c of String(fl.daily)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        return ORDER[h % ORDER.length];
      }
      return ORDER[Math.floor(((fl.n - 1) % 12) / 2)];
    }
    if ((m === 'host' || m === 'guest') && isDojo(session.theme)) return session.theme;
    if (m === 'showcase' || m === 'tuto') return 'coucher';
    if (m === 'idle') return viewState.dojo && isDojo(viewState.dojo) ? viewState.dojo : 'neon';
    return 'brume';
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
      // même ciblage pour tous : automatique sur mobile, et sur ordinateur sauf si le joueur choisit la souris
      if (controls.isTouch || controls.autoAim || !controls.mouseSeen) {
        if (foe && foe.state !== 'dead' && foe.state !== 'falling') aim = Math.atan2(foe.y - me.y, foe.x - me.x);
      } else {
        const p = this.input.activePointer;
        const sp = cam.getWorldPoint(p.x, p.y),
          w = unIso(sp.x, sp.y);
        if (Math.hypot(w.x - me.x, w.y - me.y) > 6) aim = Math.atan2(w.y - me.y, w.x - me.x);
      }
    }
    updateControls(aim);

    // la simulation suit le temps réel (le delta lissé de Phaser est plafonné quand la page n'a pas le focus)
    session.tick(Math.min(0.1, (this.game.loop.rawDelta || delta) / 1000));
    for (const ev of session.takeFx()) {
      this.r.handle(ev);
      if (ev.t === 'shake') cam.shake(140, Math.min(0.012, ev.n * 0.0011));
      if (ev.t === 'cine') {
        this.cine = { idx: ev.id, t: ev.ms };
        this.cineZ = 1.25;
      }
      if (ev.t === 'hit') this.punch = Math.max(this.punch, ev.dragon ? 0.2 : ev.red ? 0.11 : ev.v > 650 ? 0.06 : 0); // petit coup de zoom à l'impact
      if (ev.t === 'ko') cam.flash(160, 255, 255, 255, false);
      if (ev.t === 'final') {
        sfx('heart', 1.4);
        cam.shake(320, 0.012);
        this.cineZ = 1.75;
        this.punch = Math.max(this.punch, 0.32);
      }
      if (ev.t === 'sudden') cam.flash(220, 229, 72, 58, false);
      actionEvent(ev, session.myIdx);
      this.game.events.emit('fx', ev);
    }

    // caméra
    let tx = 0,
      ty = 0;
    if (this.cine) {
      this.cine.t -= delta;
      if (this.cine.t <= 0 || !st) this.cine = null;
    }
    const focus = st ? (this.cine ? st.f[this.cine.idx] : me) : null;
    if (focus && focus.state !== 'dead') {
      const p = iso2(focus.x, focus.y);
      tx = p.x * 0.75;
      ty = p.y * 0.75 - 10;
    }
    if (session.show) {
      const p = iso2(session.show.focus.x, session.show.focus.y);
      tx = p.x;
      ty = p.y;
    } // vitrine de la boutique
    // boutique ouverte : le centre du dojo (où se jouent les aperçus) reste visible à côté du panneau
    if (viewState.shop) {
      const W0 = this.scale.width,
        H0 = this.scale.height;
      if (W0 > H0) tx += Math.min(420, W0 * 0.5) / 2 / cam.zoom;
      else ty += (H0 * 0.3) / cam.zoom;
    }
    const k = 1 - Math.exp(-5 * dt);
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * k,
      cy = cam.midPoint.y + (ty - cam.midPoint.y) * k;
    const W = this.scale.width,
      H = this.scale.height;
    let z = clamp(Math.max(Math.min(W, H) / 470, Math.sqrt(W * H) / 700), 0.8, 1.5);
    if (!st) z *= 0.85;
    if (this.cine) z *= this.cineZ;
    this.punch *= Math.exp(-7 * dt);
    z *= 1 + this.punch;
    cam.setZoom(cam.zoom + (z - cam.zoom) * (1 - Math.exp(-3.5 * dt)));
    cam.centerOn(cx, cy);
    {
      const lw = unIso(cx, cy);
      setListener(lw.x, lw.y);
    }
    this.view.setTo(cam.worldView.x, cam.worldView.y, cam.worldView.width, cam.worldView.height);

    // balle de match : battement de cœur, plus rapide quand quelqu'un est déjà haut en pourcentage
    const mp = !!(st && st.duel && st.duel.mp && st.duel.phase === 'fight');
    if (mp !== this.mpOn) {
      this.mpOn = mp;
      document.body.classList.toggle('mp', mp);
      this.heartT = 0;
    }
    if (mp) {
      this.heartT -= delta;
      if (this.heartT <= 0) {
        const hot = st.f.some((e: any) => e.pct >= 100);
        this.heartT = hot ? 620 : 900;
        sfx('heart', hot ? 1 : 0.75);
        document.body.style.setProperty('--beat', hot ? '.62s' : '.9s');
      }
    }

    this.r.setTheme(this.themeOverride && THEMES[this.themeOverride] ? this.themeOverride : this.themeFor());
    this.r.update(dt, time, st, session.myIdx, this.view, session.marker);
    if (st) updateActionBar(st.f[session.myIdx]);
    musicTick();
  }
}
