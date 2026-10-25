// Rendu Phaser du dojo et des combattants. Le décor et les signaux de combat (cônes, anneaux)
// sont dessinés en code ; les combattants, les armes et les impacts viennent du pack
// Ninja Adventure (Pixel-boy, CC0). Les effets arrivent sous forme d'événements de la simulation.
//
//   iso.ts       projection isométrique et formes posées au sol
//   palette.ts   couleurs, polices, outils
//   themes.ts    ambiances des dojos et vie de chaque dojo
//   arena.ts     plateforme du dojo et lanternes
//   lake.ts      poissons, objets flottants, ronds dans l'eau, reflets, particules d'ambiance
//   effects.ts   étincelles, anneaux, lignes de vitesse, sprites d'impact, ploufs, textes flottants
//   fighters.ts  combattants, armes, annonce du coup chargé, éclat du coup entrant, traînées, emotes
//   worlds.ts    les quatre mondes : disposition du décor, premier plan
//   world.ts     sol, étang (eau, glace, lave), décor posé et premier plan en parallaxe
import Phaser from 'phaser';
import { lerp, Ev } from '../../sim/sim';
import { FIGHTER_K } from '../assets';
import { sfxAt } from '../audio';
import { ISO, iso, worldAngleToScreen, fillC, strokeC } from './iso';
import { C, hex } from './palette';
import { THEMES } from './themes';
import { Arena } from './arena';
import { Lake } from './lake';
import { Effects } from './effects';
import { Fighters } from './fighters';
import { World } from './world';
import { WORLDS } from './worlds';

export { THEMES } from './themes';
export type { Theme } from './themes';
export { ISO, isoX, isoY, iso2, unIso, screenDirToWorld, worldAngleToScreen } from './iso';
export { hex, heatCss } from './palette';
export { WORLDS, WORLD_IDS } from './worlds';

export class Renderer {
  scene: Phaser.Scene;
  // état partagé par les modules du rendu
  theme = '';
  H = 260; // demi-côté du dojo dessiné
  wet = false;
  sudden = false;
  camView: Phaser.Geom.Rectangle | null = null;
  lastSt: any = null;
  shrinkAcc = 0;
  // calques
  bg: Phaser.GameObjects.Image;
  sky: Phaser.GameObjects.Image;
  waterG: Phaser.GameObjects.Graphics;
  arenaG: Phaser.GameObjects.Graphics;
  dynG: Phaser.GameObjects.Graphics;
  topG: Phaser.GameObjects.Graphics;
  trailG: Phaser.GameObjects.Graphics;
  // modules
  arena = new Arena(this);
  lake = new Lake(this);
  fx = new Effects(this);
  fighters = new Fighters(this);
  world!: World;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.waterG = scene.add.graphics().setDepth(0);
    this.arenaG = scene.add.graphics().setDepth(1);
    this.bg = scene.add.image(0, 0, 'bg-brume').setOrigin(0.5, 1).setDepth(-1).setScrollFactor(0.95);
    this.sky = scene.add
      .image(0, 0, '__WHITE')
      .setDisplaySize(2400, 3000)
      .setOrigin(0.5, 1)
      .setDepth(-2)
      .setScrollFactor(0.95); // le ciel prolonge le haut de l'horizon
    this.dynG = scene.add.graphics().setDepth(2);
    this.topG = scene.add.graphics().setDepth(4);
    this.trailG = scene.add.graphics().setDepth(3.6); // traînées : au-dessus des combattants, en transparence
    this.world = new World(this);
    this.setTheme('brume');
  }

  setTheme(name: string) {
    if (!THEMES[name]) name = 'brume';
    if (name === this.theme && (WORLDS[name] || this.bg.texture.key === 'bg-' + name)) return;
    this.theme = name;
    const T = THEMES[name];
    const W = WORLDS[name];
    if (W) {
      // monde : décor tout autour de la plateforme, pas d'horizon (le lac le prend pour un horizon très haut)
      this.world.build(name);
      this.scene.cameras.main.setBackgroundColor(W.ground);
      this.bg.setVisible(false).setPosition(0, -1e6);
      this.sky.setVisible(false);
    } else {
      this.world.clear();
      this.scene.cameras.main.setBackgroundColor(T.water);
      this.bg.setVisible(true).setTexture('bg-' + name);
      this.bg.setDisplaySize(2400, 420).setPosition(0, -ISO * 260 * 0.3);
      this.sky
        .setVisible(true)
        .setTint(hex(T.sky))
        .setPosition(0, this.bg.y - this.bg.displayHeight + 3); // le haut de l'horizon a la couleur du ciel : il se prolonge derrière
    }
    this.lake.build(name);
    this.arena.draw(this.H, this.wet, this.sudden);
  }

  /* ---------- événements de la simulation ---------- */
  handle(ev: Ev) {
    const fx = this.fx;
    switch (ev.t) {
      case 'float': {
        const S = iso(ev.x, ev.y + 52);
        fx.addFloat(S.x, S.y - 46 * FIGHTER_K, ev.text, ev.col, ev.size); // au-dessus de la tête
        break;
      }
      case 'sparks':
        fx.sparks(ev.x, ev.y, ev.col, ev.n);
        break;
      case 'ring':
        fx.rings.push({ x: ev.x, y: ev.y, r: ev.r, max: ev.max, life: ev.life, t: 0, col: hex(ev.col), w: ev.w });
        break;
      case 'sfx':
        sfxAt(ev.n, ev.x, ev.y, ev.v);
        break;
      case 'final': {
        // éjection décisive : trois éclats de lignes de vitesse autour de la victime
        const V = this.lastSt?.f[ev.to];
        if (!V) break;
        const S = iso(V.x, V.y, 14);
        for (const [d, n, len, col] of [
          [0, 24, 320, 0xffffff],
          [110, 20, 280, C.gold],
          [230, 28, 360, 0xff5a46],
        ] as [number, number, number, number][])
          fx.after(d, () => fx.burst(S.x, S.y, n, 60, len, col, 6, 420));
        break;
      }
      case 'splash': {
        this.lake.scare(ev.x, ev.y, 460, 230);
        fx.splash(ev.x, ev.y, ev.fx, 1);
        const S = iso(ev.x, ev.y);
        fx.addFloat(S.x, S.y - 42, ev.word, '#cfeef4', ev.word.length > 8 ? 24 : 28);
        break;
      }
      case 'hit': {
        const A = this.lastSt?.f[ev.by],
          T = this.lastSt?.f[ev.to];
        if (!A || !T) break;
        this.fighters.flash(ev.to);
        if (ev.v > 500) this.lake.scare(T.x, T.y, 260, Math.min(140, ev.v / 6));
        const x = lerp(A.x, T.x, 0.7),
          y = lerp(A.y, T.y, 0.7),
          ang = worldAngleToScreen(Math.atan2(T.y - A.y, T.x - A.x));
        {
          // sensation animé : éclat radial et traînées dans le sens du recul
          const S = iso(x, y, 14);
          if (ev.dragon) {
            fx.burst(S.x, S.y, 22, 40, 240, C.gold, 6, 360);
            fx.streaks(S.x, S.y, ang, 10, 300, 0xffffff, 4, 340);
          } else if (ev.red) {
            fx.burst(S.x, S.y, 14, 30, 170, 0xff5a46, 5, 280);
            fx.streaks(S.x, S.y, ang, 8, 240, 0xffffff, 3.5, 300);
          } else if (ev.v > 420) {
            fx.burst(S.x, S.y, 9, 22, 100, 0xffffff, 3, 200);
            fx.streaks(S.x, S.y, ang, 5, 150, 0xffffff, 2.5, 220);
          }
        }
        if (ev.dragon) {
          fx.fxw('fire', T.x, T.y, 10, 0, 4);
          fx.fxw('hit', x, y, 16, 0, 3, C.gold);
        } else if (ev.red) {
          fx.fxw('cross', x, y, 16, ang, 3, 0xff5a46);
          fx.fxw('hit', x, y, 16, 0, 2.6);
        } else fx.fxw('hit', x, y, 16, 0, 2);
        break;
      }
      case 'parry': {
        const D = this.lastSt?.f[ev.by];
        if (!D) break;
        const x = D.x + Math.cos(D.facing) * 16,
          y = D.y + Math.sin(D.facing) * 16;
        if (ev.perfect) fx.fxw('star', x, y, 16, 0, 2.6);
        else fx.fxw('guard', x, y, 16, 0, 1.8);
        break;
      }
      case 'dodge': {
        const D = this.lastSt?.f[ev.by];
        if (D) fx.fxw('sparkle', D.x, D.y, 14, 0, 2.4, 0x8ff5d0);
        break;
      }
    }
  }

  /* ---------- image par image ---------- */
  update(
    dt: number,
    time: number,
    st: any,
    myIdx: number,
    view: Phaser.Geom.Rectangle,
    marker: { x: number; y: number; r: number } | null = null,
  ) {
    if (st && st.H < this.H - 0.01) {
      // le dojo rétrécit : des planches tombent à l'eau
      this.shrinkAcc += this.H - st.H;
      if (this.shrinkAcc >= 6) {
        this.shrinkAcc = 0;
        for (let i = 0; i < 3; i++) this.fx.plank(st.H);
      }
    }
    const sudden = !!(st && st.duel && st.duel.sudden);
    if (st && (st.H !== this.H || st.damp < 3 !== this.wet || sudden !== this.sudden))
      this.arena.draw(st.H, st.damp < 3, sudden);
    if (!st && (this.H !== 260 || this.sudden || this.wet)) this.arena.draw(260);
    this.camView = view;
    this.lake.update(dt, time, view);
    this.fx.update(dt);

    // eau : ronds, reflets, lanternes du fond
    const w = this.waterG;
    w.clear();
    this.world.drawLive(w, time);
    this.lake.drawWater(w, time);
    this.world.update(this.scene.cameras.main);
    this.arena.drawLamp(w, 0, time);

    const g = this.dynG;
    g.clear();
    const tg = this.trailG;
    tg.clear();
    this.lastSt = st;
    // premier plan : anneaux, lanterne de devant, lignes de vitesse, particules, ambiance
    const t = this.topG;
    t.clear();
    this.fx.drawRings(t);
    this.arena.drawLamp(t, 1, time);
    this.fx.drawLines(t);
    this.fx.drawParts(t);
    this.lake.drawAmbient(t, view, time, dt);
    if (!st) {
      this.fighters.hideEmotes(0);
      this.fighters.hideViews(0);
      return;
    }
    if (marker) this.drawMarker(g, marker, time);
    const fs = st.f.slice().sort((a: any, b: any) => a.x + a.y - (b.x + b.y));
    const twin = st.f.length === 2 && st.f[0].look.perso === st.f[1].look.perso;
    for (const e of fs) this.fighters.draw(g, e, e.idx, time, dt, myIdx, twin && e.idx === 1);
    this.fighters.hideViews(st.f.length);
    for (const e of fs) this.fighters.drawTelegraph(g, e);
    // coups qui menacent le joueur : éclat d'avertissement au premier plan
    const me = st.f[myIdx];
    for (const e of fs) this.fighters.drawWarning(t, e, me, time);
    for (const e of fs) {
      e.trail = (e.trail || []).filter((p: any) => time - p.t < 160);
      this.fighters.drawTrail(tg, e.trail, e.look.trainee, time);
    }
    this.fighters.drawEmotes(st);
  }

  // Cible du tutoriel (« va ici ») : cercle vert qui pulse.
  drawMarker(g: Phaser.GameObjects.Graphics, marker: { x: number; y: number; r: number }, time: number) {
    const p = 0.5 + 0.5 * Math.sin(time * 0.006);
    g.fillStyle(C.jade, 0.14 + 0.1 * p);
    fillC(g, marker.x, marker.y, marker.r);
    g.lineStyle(3, C.jade, 0.7 + 0.3 * p);
    strokeC(g, marker.x, marker.y, marker.r + p * 4);
    g.lineStyle(2, C.jade, 0.35 * (1 - p));
    strokeC(g, marker.x, marker.y, marker.r + 10 + p * 14);
  }
}
