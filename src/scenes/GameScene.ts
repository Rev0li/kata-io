import Phaser from 'phaser';
import { Renderer, THEMES, WORLDS, iso2, unIso } from '../game/render';
import { palier } from '../game/render/fighters';
import { session } from '../net/session';
import { controls, updateControls } from '../ui/controls';
import { updateActionBar, actionEvent } from '../ui/actionbar';
import { initAudio, setListener, musicTick, sfx } from '../game/audio';
import { clamp } from '../sim/sim';
import { isDojo } from '../sim/data';
import { preloadAssets, setupAssets } from '../game/assets';
import { viewState } from '../ui/viewstate';
import { bootProgres, bootScenePrete } from '../ui/boot';
import { SuiviEjection } from '../game/ejection';

// Cadrage de combat : pendant l'échange, la caméra cadre les deux combattants (plus une marge qui laisse voir le
// bord le plus proche) au lieu de toute la plateforme, pour que les coups blancs et rouges se lisent bien. Entre les
// manches, elle reprend la vue large. Gain plafonné : fort sur grand écran, léger sur téléphone (déjà serré).
const CADRE_MARGE = 190, // pixels du monde autour des deux combattants
  CADRE_GAIN_ECRAN = 1.5,
  CADRE_GAIN_TACTILE = 1.12;
const ZOOM_MIN = 0.8,
  ZOOM_MAX = 2.6,
  ZOOM_RECUL = 1.2; // zoom d'un téléphone couché : en dessous, rien ne change

// Scène de combat : avance la partie, applique les effets et suit le joueur avec la caméra.
export class GameScene extends Phaser.Scene {
  r!: Renderer;
  cine: { idx: number; t: number } | null = null;
  heartT = 0;
  mpOn = false;
  punch = 0;
  cadrage = 1; // gain de zoom du cadrage de combat, lissé
  cineZ = 1.25;
  themeOverride: string | null = null;
  view = new Phaser.Geom.Rectangle();
  lastW = 0;
  lastH = 0;
  lastShop = false;
  frames = 0;
  ejection = new SuiviEjection(); // la caméra suit un combattant éjecté jusqu'au plouf (ejection.ts)

  constructor() {
    super('game');
  }

  preload() {
    this.load.on('progress', bootProgres);
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
    this.scene.launch('hud');
  }

  // Ambiance d'arène : l'accueil et l'entraînement montrent le monde choisi. La Tour change de dojo tous les deux étages : coucher, bambous, brume, neige, néon, volcan.
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
    if (m === 'tuto') return 'coucher';
    // salon d'un duel : la salle est ouverte mais le combat n'a pas commencé, on montre le dojo choisi
    if (m === 'idle' || m === 'showcase' || !session.state)
      return viewState.dojo && isDojo(viewState.dojo) ? viewState.dojo : viewState.world;
    if (m === 'practice') return viewState.world;
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
      // visée toujours automatique vers l'adversaire, sur mobile comme sur ordinateur (plus de visée à la souris)
      if (foe && foe.state !== 'dead' && foe.state !== 'falling') aim = Math.atan2(foe.y - me.y, foe.x - me.x);
    }
    updateControls(aim);

    // la simulation suit le temps réel (le delta lissé de Phaser est plafonné quand la page n'a pas le focus)
    session.tick(Math.min(0.1, (this.game.loop.rawDelta || delta) / 1000));
    for (const ev of session.takeFx()) {
      this.r.handle(ev);
      if (this.ejection.evenement(ev)) cam.shake(260, 0.007); // plouf au bout d'un long vol
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
    const enCombat = !!(
      st &&
      !this.cine &&
      !session.show &&
      st.duel &&
      st.duel.phase === 'fight' &&
      me &&
      foe &&
      me.state !== 'falling' &&
      me.state !== 'dead' &&
      foe.state !== 'falling' &&
      foe.state !== 'dead'
    );
    let lx = 0,
      ly = 0;
    if (enCombat) {
      const a = iso2(me.x, me.y),
        b = iso2(foe.x, foe.y);
      // milieu des deux combattants, un peu tiré vers le joueur
      tx = a.x * 0.58 + b.x * 0.42;
      ty = a.y * 0.58 + b.y * 0.42 - 22;
      lx = Math.abs(a.x - b.x);
      ly = Math.abs(a.y - b.y);
    } else if (focus && focus.state !== 'dead') {
      const p = iso2(focus.x, focus.y);
      tx = p.x * 0.75;
      ty = p.y * 0.75 - 10;
    }
    const W = this.scale.width,
      H = this.scale.height;
    // éjection : on suit le vol jusqu'au point de chute, l'auteur du coup reste dans le cadre
    const cadre = session.show ? null : this.ejection.cadre(st, delta, W, H);
    if (cadre) {
      tx = cadre.x;
      ty = cadre.y;
    }
    if (session.show) {
      const p = iso2(session.show.focus.x, session.show.focus.y);
      tx = p.x;
      ty = p.y;
    } // vitrine de la boutique
    // première image et changement de taille (rotation, fenêtre) : la caméra se place d'un coup au lieu de glisser
    const snap = W !== this.lastW || H !== this.lastH || viewState.shop !== this.lastShop;
    this.lastW = W;
    this.lastH = H;
    this.lastShop = viewState.shop;
    // le zoom suit la taille de l'écran : la plateforme occupe la même part de l'image du téléphone au grand écran
    // (jusqu'en 2026-11, plafonné à 1,5 : au-delà d'un écran de portable, les combattants devenaient minuscules)
    let z = clamp(Math.max(Math.min(W, H) / 470, Math.sqrt(W * H) / 700), ZOOM_MIN, ZOOM_MAX);
    // grand écran : on prend du recul pour voir le décor autour de la plateforme (au-delà de ZOOM_RECUL, le zoom
    // ne monte plus qu'à 60 %). Téléphone : inchangé.
    if (z > ZOOM_RECUL) z = ZOOM_RECUL + (z - ZOOM_RECUL) * 0.6;
    if (!st) z *= 0.85;
    if (WORLDS[this.r.theme]) z *= 0.82; // mondes : un peu plus de recul pour voir le décor autour de l'étang
    // vitrine du vestiaire : gros plan sur les deux combattants, dans la place laissée par le panneau
    if (viewState.shop && session.show?.kind === 'trainee')
      z = clamp(Math.min((W > H ? W - Math.min(420, W * 0.5) : W) / 300, H / 230), 1.2, 2.8);
    {
      // cadrage de combat : les deux combattants et leur marge doivent tenir à l'écran
      let gain = 1;
      if (enCombat) {
        const zc = Math.min(W / (lx * 1.16 + CADRE_MARGE * 2), H / (ly * 1.16 + CADRE_MARGE * 1.7));
        const max = matchMedia('(pointer: coarse)').matches ? CADRE_GAIN_TACTILE : CADRE_GAIN_ECRAN;
        gain = clamp(zc / z, 1, max);
      }
      // lent, pour que l'image ne « respire » pas à chaque pas
      this.cadrage += (gain - this.cadrage) * (1 - Math.exp(-(gain < this.cadrage ? 2.4 : 1.2) * dt));
      z *= this.cadrage;
    }
    if (this.cine) z *= this.cineZ;
    this.punch *= Math.exp(-7 * dt);
    z *= 1 + this.punch;
    // tout le vol doit tenir à l'écran : on recule autant qu'il faut (au plus jusqu'à 0,45)
    if (cadre) z = Math.max(Math.min(z, cadre.zoomMax), Math.min(z, 0.45));
    if (snap) cam.setZoom(z); // avant le décalage ci-dessous, qui dépend du zoom
    // boutique ouverte : le centre du dojo (où se jouent les aperçus) reste visible à côté du panneau
    if (viewState.shop) {
      if (W > H) tx += Math.min(420, W * 0.5) / 2 / cam.zoom;
      else ty += (H * 0.3) / cam.zoom;
    }
    const k = snap ? 1 : 1 - Math.exp(-(cadre ? 7 : 5) * dt); // pendant un vol, la caméra suit de plus près
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * k,
      cy = cam.midPoint.y + (ty - cam.midPoint.y) * k;
    cam.setZoom(cam.zoom + (z - cam.zoom) * (1 - Math.exp(-(cadre && z < cam.zoom ? 6 : 3.5) * dt)));
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
    } else if (me && st.duel && st.duel.phase === 'fight' && palier(me.pct) >= 3 && me.state !== 'falling') {
      // pourcentage caché : au dernier palier, ton cœur bat (pour toi seul)
      this.heartT -= delta;
      if (this.heartT <= 0) {
        this.heartT = 760;
        sfx('heart', 0.6);
      }
    }

    this.r.setTheme(this.themeOverride && THEMES[this.themeOverride] ? this.themeOverride : this.themeFor());
    this.r.update(dt, time, st, session.myIdx, this.view, session.marker);
    if (st) updateActionBar(st.f[session.myIdx]);
    musicTick();
    if (++this.frames === 2) bootScenePrete(); // la première image est affichée, caméra en place
  }
}
