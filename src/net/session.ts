// Contrôleur de partie.
// - practice : combat local contre un bot, sans réseau
// - tower    : un étage de la Tour du temple (local)
// - tuto     : tutoriel ou exercice contre le mannequin (local)
// - host     : ce navigateur fait tourner la simulation et envoie des instantanés à l'invité (30 par seconde) ;
//              ancien duel pair à pair seulement
// - guest    : ce navigateur envoie ses entrées et affiche les instantanés reçus. Duel arbitré par le serveur
//              (server/duel.ts) : les DEUX joueurs sont invités, le serveur leur dit leur place (welcome.moi)
import {
  createSim,
  stepSim,
  drainEvents,
  snapshot,
  createMirror,
  applySnapshot,
  advanceMirror,
  emptyInput,
  Input,
  Spec,
  Ev,
  respawn,
  setDummy,
  alive,
  clamp,
} from '../sim/sim';
import { Conn, voieDuel } from './transport';
import { Tampon } from './tampon';
import { LEVELS, randLook, BOT_NAMES, sanitizeLook, Look, isDojo, cloneDeck } from '../sim/data';
import { lookStyle, styleDeck } from '../sim/styles';
import { Abil, FULL_ABIL, Floor, abilFor, RANKS } from '../sim/progression';
import { TutoStep } from '../game/tutorial';
import { Enregistreur, combatEtage } from '../sim/rejeu';
import type { Combat } from '../sim/rejeu';
import { track } from '../analytics';

// Tutoriel, après la paume du dragon : attente maximale avant l'étape suivante, pause après le plouf,
// et délai au bout duquel un mannequin resté debout sur le dojo fait passer à la suite (ms).
const SUITE_MAX = 5000,
  SUITE_PLOUF = 900,
  SUITE_DEBOUT = 1600;
export type Mode = 'idle' | 'practice' | 'tower' | 'tuto' | 'host' | 'guest' | 'showcase';
// Vitrine du vestiaire : le long de la diagonale (x, -y), les deux combattants sont côte à côte à l'écran.
const VITRINE_MANNEQUIN: [number, number] = [46, -46];
const VITRINE_DEPART: [number, number] = [-14, 14]; // assez près pour que les coups portent
const VITRINE_ECART: [number, number] = [-92, 92]; // position finale, par rapport au mannequin
const VITRINE_COMBO_MAX = 3200; // ms : au-delà, le combo s'arrête même incomplet
const STEP = 1 / 60,
  SNAP_MS = 33;

export interface Hooks {
  onStart?(): void;
  onEnd?(winner: number, score: number[]): void;
  onDisconnect?(): void;
  onLeave?(): void; // la partie est quittée : l'interface annule ce qu'elle préparait (écran de résultat)
  onRematch?(me: boolean, them: boolean): void;
  onPing?(ms: number): void;
  onStatus?(msg: string): void;
  onTuto?(step: TutoStep | null, i: number, n: number, count: number): void;
  onTutoDone?(): void;
}
export interface MeSpec extends Spec {
  abil: Abil;
  belt: string;
}

const packInput = (i: Input) => [
  Math.round(i.mx * 100) / 100,
  Math.round(i.my * 100) / 100,
  Math.round(i.aim * 100) / 100,
  i.atk ? 1 : 0,
  i.parryN,
  i.dodgeN,
  i.emoteN,
  i.emote || '',
];
const unpackInput = (a: any[]): Input => ({
  mx: +a[0] || 0,
  my: +a[1] || 0,
  aim: +a[2] || 0,
  atk: !!a[3],
  parryN: a[4] | 0,
  dodgeN: a[5] | 0,
  emoteN: a[6] | 0,
  emote: a[7] || null,
});

class Session {
  mode: Mode = 'idle';
  sim: any = null;
  mirror: any = null;
  // invité : instantanés reçus, joués avec un léger retard pour absorber les à-coups du réseau (tampon.ts)
  tampon = new Tampon<{ s: any; e: Ev[] }>();
  private dernierS: any = null;
  myIdx = 0;
  conn: Conn | null = null;
  input: Input = emptyInput();
  remote: Input = emptyInput();
  specs: Spec[] = [];
  opts: any = {};
  fx: Ev[] = [];
  outEv: Ev[] = [];
  acc = 0;
  snapT = 0;
  sendT = 0;
  lastSent = '';
  pingT = 0;
  ping = -1;
  ended = false;
  rematchMe = false;
  rematchThem = false;
  level = 1;
  notice = '';
  floor: Floor | null = null;
  roundsLost = 0;
  seconds = 0;
  theme: string | null = null; // dojo d'un duel entre amis (choisi par l'hôte)
  attempt = 1;
  // Montée classée : le combat est enregistré pour que le serveur le rejoue (src/sim/rejeu.ts).
  //   aEnregistrer  étage, personnage et graine du combat en cours ; rec : l'enregistreur, jusqu'au coup final ;
  //   combat        l'enregistrement terminé, lu par l'écran de résultat.
  private aEnregistrer: { c: Omit<Combat, 'e'>; graine: number } | null = null;
  private rec: Enregistreur | null = null;
  combat: Combat | null = null;
  teaser = '';
  bonus = { saves: 0, perfects: 0 };
  matches = 0; // parties jouées depuis le dernier retour à l'accueil (mesures)
  tally = {
    dealt: 0,
    taken: 0,
    parries: 0,
    dodges: 0,
    spam: 0,
    spamBlock: 0,
    exhTaken: 0,
    exhDealt: 0,
    ejected: 0,
    ejectedExh: 0,
  };
  tuto: {
    steps: TutoStep[];
    i: number;
    count: number;
    done: boolean;
    endT: number;
    avoid: { active: boolean; dodged: boolean; hit: boolean };
    hintT: number;
    vide: boolean; // étape « souffle » : la barre a été vidée, on attend qu'elle remonte
    suite: number; // étape réussie, la suivante attend (ms restantes) : on laisse le mannequin tomber à l'eau
    sorti: boolean; // pendant cette attente : le mannequin est tombé
  } | null = null;
  hooks: Hooks = {};

  get state() {
    return this.mode === 'guest' ? this.mirror : this.sim;
  }
  get active() {
    return this.mode !== 'idle' && !!this.state;
  }
  get local() {
    return this.mode === 'practice' || this.mode === 'tower' || this.mode === 'tuto';
  }
  // Vitrine de la boutique : vraie simulation, le joueur frappe un mannequin pour montrer une traînée ou un plouf.
  show: {
    kind: 'trainee' | 'ejection';
    t: number;
    presses: number[];
    dir: [number, number];
    focus: { x: number; y: number };
    combo?: { coups: number; uid: number; appui: number };
  } | null = null;
  get marker() {
    const t = this.tuto;
    return t && !t.done ? t.steps[t.i].marker || null : null;
  }

  resetInput() {
    const i = this.input;
    this.input = { ...emptyInput(), parryN: i.parryN, dodgeN: i.dodgeN, emoteN: i.emoteN };
  }

  /* ---------- démarrages ---------- */
  startPractice(me: MeSpec, level: number) {
    this.leave(true);
    this.mode = 'practice';
    this.myIdx = 0;
    this.level = level;
    this.floor = null;
    this.opts = {};
    const lv = LEVELS[level] || LEVELS[1];
    this.specs = [
      me,
      {
        name: BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0],
        look: randLook(), // jeu de coups : celui du style de son personnage (D16)
        bot: lv.skill,
        abil: me.abil,
        belt: RANKS[Math.min(RANKS.length - 1, level * 3)].belt,
      },
    ];
    this.begin();
  }
  // extra : techniques du gardien (avant-goût de la prochaine technique), numéro d'essai, réplique de défi
  startTower(
    me: MeSpec,
    floor: Floor,
    extra: {
      abil?: Abil;
      attempt?: number;
      taunt?: string;
      teaser?: string;
      quick?: boolean;
      combat?: { c: Omit<Combat, 'e'>; graine: number }; // montée classée : combat à graine, enregistré
    } = {},
  ) {
    this.leave(true);
    this.mode = 'tower';
    this.myIdx = 0;
    this.floor = floor;
    this.attempt = extra.attempt || 1;
    this.teaser = extra.teaser || '';
    this.specs = [
      me,
      {
        name: floor.name,
        look: floor.look,
        deck: floor.deck,
        bot: floor.skill,
        abil: extra.abil || abilFor(floor.tier),
        belt: RANKS[floor.tier].belt,
      },
    ];
    this.opts = { firstTo: floor.firstTo, H: floor.H, damp: floor.damp, quick: !!extra.quick };
    if (extra.combat) {
      // mêmes combattants et mêmes options que le serveur au rejeu
      const k = combatEtage(extra.combat.c, extra.combat.graine, me);
      this.specs = k.specs;
      this.opts = k.opts;
      this.aEnregistrer = extra.combat;
    }
    this.begin();
    if (extra.taunt && this.sim) this.sim.f[1].emote = { id: extra.taunt, t: -700 };
  }
  startShowcase(me: MeSpec) {
    this.leave(true);
    this.mode = 'showcase';
    this.myIdx = 0;
    this.floor = null;
    this.teaser = '';
    this.attempt = 1;
    this.specs = [
      me,
      {
        name: 'Mannequin',
        look: { perso: 'moine', arme: 'mains', trainee: 'aucune', ejection: 'plouf' },
        dummy: true,
        atkSlow: 1.9,
        abil: FULL_ABIL,
      },
    ];
    this.opts = {
      free: true,
      pos: [VITRINE_DEPART, VITRINE_MANNEQUIN],
    };
    this.begin(true);
    setDummy(this.sim, 1, 'idle', VITRINE_MANNEQUIN[0], VITRINE_MANNEQUIN[1]);
  }
  // Joue une démonstration : le combo de trois coups du combattant, puis il se place à côté du mannequin ;
  // pour un plouf, une éjection dans la direction dir.
  showcase(kind: 'trainee' | 'ejection', look: Look, dir: [number, number]) {
    const S = this.sim;
    if (this.mode !== 'showcase' || !S) return;
    const me = S.f[0],
      foe = S.f[1],
      H = S.H;
    // aperçu d'un autre combattant : son arme et son jeu de coups suivent son style (D16)
    me.look = lookStyle(sanitizeLook(look));
    me.deck = cloneDeck(styleDeck(me.look.perso));
    const place = (e: any, x: number, y: number) => {
      respawn(S, e, x, y);
      e.dropT = 0;
      e.spawnInv = 0;
      e.vx = e.vy = 0;
    };
    if (kind === 'trainee') {
      place(me, VITRINE_DEPART[0], VITRINE_DEPART[1]);
      place(foe, VITRINE_MANNEQUIN[0], VITRINE_MANNEQUIN[1]);
      foe.pct = 0;
      this.show = {
        kind,
        t: 0,
        presses: [],
        dir,
        focus: { x: 0, y: 0 },
        combo: { coups: 0, uid: -1, appui: 0 },
      };
    } else {
      const ex = dir[0] * (H - 60),
        ey = dir[1] * (H - 60) + (dir[1] ? 0 : 20);
      place(foe, ex, ey);
      place(me, ex - dir[0] * 70, ey - dir[1] * 70);
      foe.pct = 175;
      this.show = { kind, t: 0, presses: [250], dir, focus: { x: dir[0] * (H + 40), y: dir[1] * (H + 40) + 10 } };
    }
    setDummy(S, 1, 'idle', foe.x, foe.y);
  }
  private showcaseTick(dt: number) {
    const sh = this.show,
      S = this.sim;
    if (!sh || !S) return;
    sh.t += dt * 1000;
    const me = S.f[0],
      foe = S.f[1],
      inp = this.input;
    inp.mx = inp.my = 0;
    inp.aim = Math.atan2(foe.y - me.y, foe.x - me.x);
    if (sh.combo) this.vitrineCombo(sh.combo, sh.t, dt, me, foe, S.H);
    else inp.atk = sh.presses.some(p => sh.t >= p && sh.t < p + 70);
    if (foe.state === 'dead' && sh.t > 2600) {
      respawn(S, foe, VITRINE_MANNEQUIN[0], VITRINE_MANNEQUIN[1]);
      foe.dropT = 0;
      setDummy(S, 1, 'idle', VITRINE_MANNEQUIN[0], VITRINE_MANNEQUIN[1]);
    }
  }
  // Un appui dès que le coup en cours le permet : chaque style enchaîne ses trois coups à son propre rythme.
  // Ensuite, le combattant recule jusqu'à être bien visible à côté du mannequin.
  private vitrineCombo(
    c: { coups: number; uid: number; appui: number },
    t: number,
    dt: number,
    me: any,
    foe: any,
    H: number,
  ) {
    const inp = this.input;
    if (me.atk && me.atk.uid !== c.uid) {
      c.uid = me.atk.uid;
      c.coups++;
    }
    if (c.appui > 0) {
      c.appui -= dt * 1000;
      inp.atk = true;
      return;
    }
    inp.atk = false;
    const a = me.atk;
    if (c.coups < 3 && t < VITRINE_COMBO_MAX) {
      if (t >= 150 && !me.buffer && (me.state === 'idle' || (a && a.t >= a.su + a.ac))) c.appui = 50;
      return;
    }
    if (me.state !== 'idle') return;
    const borne = (v: number) => clamp(v, -(H - 40), H - 40),
      dx = borne(foe.x + VITRINE_ECART[0]) - me.x,
      dy = borne(foe.y + VITRINE_ECART[1]) - me.y,
      d = Math.hypot(dx, dy);
    if (d > 5) {
      inp.mx = (dx / d) * 0.75;
      inp.my = (dy / d) * 0.75;
    }
  }
  startTuto(me: MeSpec, steps: TutoStep[]) {
    this.leave(true);
    this.mode = 'tuto';
    this.myIdx = 0;
    this.floor = null;
    const first = steps[0];
    this.specs = [
      me,
      {
        name: 'Mannequin',
        look: { perso: 'moine', arme: 'mains', trainee: 'aucune', ejection: 'plouf' },
        dummy: true,
        atkSlow: 1.9,
        abil: FULL_ABIL,
        deck: {
          chain: [
            ['direct', 'direct', 'direct'],
            ['direct', 'direct', 'direct'],
            ['direct', 'direct', 'direct'],
            ['direct', 'direct', 'direct'],
          ],
          heavy: ['belier', 'belier', 'belier', 'belier'],
        },
      },
    ];
    this.opts = { free: true, pos: [first.me || [-110, 0], first.foe || [80, 0]] };
    this.tuto = {
      steps,
      i: 0,
      count: 0,
      done: false,
      endT: 0,
      avoid: { active: false, dodged: false, hit: false },
      hintT: 0,
      vide: false,
      suite: 0,
      sorti: false,
    };
    this.begin();
    this.setupStep();
  }
  startHost(conn: Conn, me: MeSpec, theme: string | null = null) {
    this.mode = 'host';
    this.myIdx = 0;
    this.conn = conn;
    this.theme = isDojo(theme) ? theme : null;
    this.specs = [{ ...me, abil: FULL_ABIL }];
    this.opts = {};
    this.floor = null;
    conn.onMessage(m => this.onHostMsg(m));
    conn.onClose(() => this.lost());
    this.hooks.onStatus?.('Ton adversaire arrive…');
  }
  startGuest(conn: Conn, me: MeSpec) {
    this.mode = 'guest';
    this.myIdx = 1;
    this.conn = conn;
    this.floor = null;
    conn.onMessage(m => this.onGuestMsg(m));
    conn.onClose(() => this.lost());
    conn.send({ t: 'hello', spec: { name: me.name, look: me.look, belt: me.belt } });
    this.hooks.onStatus?.('Connecté. Le combat se prépare…');
  }
  private begin(silent = false) {
    this.ended = false;
    this.rematchMe = this.rematchThem = false;
    this.acc = 0;
    this.fx = [];
    this.outEv = [];
    this.roundsLost = 0;
    this.seconds = 0;
    this.bonus = { saves: 0, perfects: 0 };
    this.resetInput();
    this.remote = emptyInput();
    this.tally = {
      dealt: 0,
      taken: 0,
      parries: 0,
      dodges: 0,
      spam: 0,
      spamBlock: 0,
      exhTaken: 0,
      exhDealt: 0,
      ejected: 0,
      ejectedExh: 0,
    };
    if (!silent && this.mode !== 'tuto') {
      this.matches++;
      track('match_started', {
        mode: this.mode,
        floor: this.floor ? (this.floor.daily ? 'daily' : this.floor.n) : null,
        level: this.mode === 'practice' ? this.level : null,
        theme: this.theme,
        rematch: this.matches > 1,
      });
    }
    if (this.mode === 'guest') {
      this.mirror = createMirror(this.specs);
      this.tampon.vider();
      this.dernierS = null;
    }
    else {
      this.sim = createSim(this.specs, this.opts);
      // Les compteurs d'actions (parade, esquive, emote) continuent d'une partie à l'autre : le nouveau combattant
      // part des valeurs actuelles, sinon il prend l'écart pour un appui et esquive dès son apparition.
      const me = this.sim.f[this.myIdx],
        i = this.input;
      this.combat = null;
      this.rec = this.aEnregistrer && this.mode === 'tower' ? new Enregistreur(i) : null;
      // combat enregistré : parade et esquive repartent de zéro (l'enregistreur compte les appuis lui-même)
      if (me && !me.bot)
        me.inPrev = this.rec
          ? { atk: false, parryN: 0, dodgeN: 0, emoteN: i.emoteN }
          : { atk: false, parryN: i.parryN, dodgeN: i.dodgeN, emoteN: i.emoteN };
    }
    if (!silent) this.hooks.onStart?.();
  }

  /* ---------- tutoriel ---------- */
  private setupStep() {
    const T = this.tuto!,
      st = T.steps[T.i],
      sim = this.sim,
      me = sim.f[0],
      foe = sim.f[1];
    if (st.me) respawn(sim, me, st.me[0], st.me[1]);
    if (st.foe) respawn(sim, foe, st.foe[0], st.foe[1]);
    me.dropT = 0;
    foe.dropT = 0;
    setDummy(sim, 1, st.dummy, foe.x, foe.y);
    foe.pct = st.dummyPct || 0;
    me.pct = 0;
    if (st.qi != null) me.qi = st.qi;
    T.count = 0;
    T.vide = false;
    T.suite = 0;
    if (st.kind === 'souffle') me.souffle = 3;
    T.avoid = { active: false, dodged: false, hit: false };
    this.hooks.onTuto?.(st, T.i, T.steps.length, 0);
  }
  private tutoCount() {
    const T = this.tuto!;
    T.count++;
    this.fx.push({ t: 'sfx', n: 'ui', x: 0, y: 0, v: 1 });
    const st = T.steps[T.i];
    this.hooks.onTuto?.(st, T.i, T.steps.length, T.count);
    if (T.count < st.goal) return;
    if (T.i + 1 < T.steps.length) {
      this.fx.push({ t: 'big', text: 'BIEN !', col: '#62c2a2', life: 900 });
      // paume du dragon : on ne coupe pas l'éjection, l'étape suivante commence quand le mannequin réapparaît
      if (st.kind === 'dragon') {
        T.suite = SUITE_MAX;
        T.sorti = false;
        return;
      }
      T.i++;
      this.setupStep();
    } else {
      T.done = true;
      T.endT = 1500;
      this.fx.push({ t: 'big', text: 'BRAVO !', col: '#f2c14e', life: 1500 });
      this.fx.push({ t: 'sfx', n: 'gong', x: 0, y: 0, v: 0.8 });
      this.hooks.onTuto?.(null, T.i, T.steps.length, T.count);
    }
  }
  // « Étape suivante » : l'étape en cours est comptée comme réussie (personne ne reste bloqué sur un geste difficile).
  tutoSkipStep() {
    const T = this.tuto;
    if (!T || T.done) return;
    if (T.suite > 0) {
      T.suite = 0;
      T.i++;
      this.setupStep();
      return;
    }
    T.count = T.steps[T.i].goal - 1;
    this.tutoCount();
  }
  private tutoEvent(e: Ev) {
    const T = this.tuto;
    if (!T || T.done || T.suite > 0) return;
    const k = T.steps[T.i].kind;
    if (e.t === 'hit' && e.by === 0 && e.to === 1) {
      if (
        k === 'hit' ||
        (k === 'chain2' && e.idx >= 1) ||
        (k === 'chain3' && e.idx >= 2) ||
        (k === 'red' && e.red) ||
        (k === 'dragon' && e.dragon)
      )
        this.tutoCount();
    }
    if (e.t === 'hit' && e.to === 0) T.avoid.hit = true;
    if (e.t === 'parry' && e.by === 0 && k === 'parry') this.tutoCount();
    if (e.t === 'dodge' && e.by === 0 && k === 'elan') this.tutoCount();
    if (e.t === 'ko' && e.to === 1 && k === 'ko') this.tutoCount();
  }
  private tutoTick(dt: number) {
    const T = this.tuto!,
      sim = this.sim,
      me = sim.f[0],
      foe = sim.f[1];
    if (T.done) {
      T.endT -= dt * 1000;
      if (T.endT <= 0) {
        this.tuto = null;
        this.hooks.onTutoDone?.();
      }
      return;
    }
    const st = T.steps[T.i];
    // personne ne sort pour de vrai pendant le tutoriel
    if (me.state === 'dead') {
      respawn(sim, me, st.me ? st.me[0] : -110, st.me ? st.me[1] : 0);
      me.dropT = 0;
      me.spawnInv = 600;
    }
    if (T.suite > 0) {
      // étape déjà réussie : le mannequin vole, tombe à l'eau, puis l'étape suivante le fait réapparaître.
      // S'il est resté sur le dojo, on n'attend pas plus que le temps de le voir se relever.
      T.suite -= dt * 1000;
      if (foe.state === 'dead' && !T.sorti) {
        T.sorti = true;
        T.suite = Math.min(T.suite, SUITE_PLOUF);
      }
      const reste = !T.sorti && foe.state === 'idle' && T.suite < SUITE_MAX - SUITE_DEBOUT;
      if (T.suite <= 0 || reste) {
        T.suite = 0;
        T.i++;
        this.setupStep();
      }
      return;
    }
    if (foe.state === 'dead') {
      const p = st.foe || [80, 0];
      respawn(sim, foe, p[0], p[1]);
      foe.dropT = 0;
      setDummy(sim, 1, st.dummy, p[0], p[1]);
      foe.pct = st.dummyPct || 0;
    }
    if (st.kind !== 'ko' && alive(foe)) foe.pct = Math.min(foe.pct, st.dummyPct || 30);
    if (alive(me)) me.pct = Math.min(me.pct, 40);
    if (st.kind === 'move' && st.marker && Math.hypot(me.x - st.marker.x, me.y - st.marker.y) < st.marker.r)
      this.tutoCount();
    // souffle : vidé (épuisé, sous un segment), puis remonté à la moitié
    if (st.kind === 'souffle') {
      if (me.souffle < 1) T.vide = true;
      else if (T.vide && me.souffle >= 1.5) this.tutoCount();
    }
    if (st.kind === 'avoid') {
      const A = T.avoid,
        attacking = foe.state === 'attack';
      if (attacking && !A.active) {
        A.active = true;
        A.dodged = false;
        A.hit = false;
      }
      if (A.active && me.state === 'dodge') A.dodged = true;
      if (A.active && !attacking) {
        A.active = false;
        if (A.dodged && !A.hit) this.tutoCount();
        else if (T.hintT <= 0) {
          T.hintT = 2500;
          this.fx.push({
            t: 'float',
            x: me.x,
            y: me.y - 70,
            text: A.dodged ? 'Trop tôt : attends qu’il frappe' : 'Esquive quand il frappe !',
            col: '#ecdfc6',
            size: 15,
          });
        }
      }
    }
    T.hintT -= dt * 1000;
  }

  /* ---------- réseau ---------- */
  private onHostMsg(m: any) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello': {
        if (this.sim) return;
        const sp = m.spec || {};
        this.specs = [
          this.specs[0],
          {
            name: String(sp.name || 'Invité').slice(0, 16),
            look: sanitizeLook(sp.look),
            abil: FULL_ABIL,
            belt: typeof sp.belt === 'string' ? sp.belt : undefined,
          },
        ];
        this.conn!.send({
          t: 'welcome',
          theme: this.theme,
          specs: this.specs.map(s => ({ name: s.name, look: s.look, belt: s.belt })),
        });
        this.begin();
        break;
      }
      case 'in':
        if (Array.isArray(m.i)) this.remote = unpackInput(m.i);
        break;
      case 'rematch':
        this.rematchThem = true;
        this.hooks.onRematch?.(this.rematchMe, true);
        this.tryRematch();
        break;
      case 'ping':
        this.conn!.send({ t: 'pong', ts: m.ts });
        break;
      case 'pong':
        this.gotPong(m.ts);
        break;
    }
  }
  private onGuestMsg(m: any) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'welcome':
        if (m.moi === 0 || m.moi === 1) this.myIdx = m.moi; // duel arbitré par le serveur : il attribue les places
        this.theme = isDojo(m.theme) ? m.theme : null;
        this.specs = (m.specs || []).map((s: any) => ({
          name: String(s.name || '').slice(0, 16),
          look: sanitizeLook(s.look),
          belt: typeof s.belt === 'string' ? s.belt : undefined,
          abil: FULL_ABIL,
        }));
        this.begin();
        break;
      case 's':
        if (this.mirror && m.s && typeof m.s.tm === 'number')
          this.tampon.recevoir(m.s.tm, { s: m.s, e: Array.isArray(m.e) ? m.e : [] }, performance.now());
        break;
      case 'restart':
        this.begin();
        break;
      case 'rematch':
        this.rematchThem = true;
        this.hooks.onRematch?.(this.rematchMe, true);
        break;
      case 'away':
        this.notice = m.v ? 'Ton adversaire a quitté l’onglet du jeu : le combat est en pause.' : '';
        break;
      case 'full':
        this.hooks.onStatus?.('Cette salle est déjà complète.');
        this.lost();
        break;
      case 'ping':
        this.conn!.send({ t: 'pong', ts: m.ts });
        break;
      case 'pong':
        this.gotPong(m.ts);
        break;
    }
  }
  private gotPong(ts: number) {
    const ms = Math.max(0, Math.round(performance.now() - ts));
    this.ping = this.ping < 0 ? ms : Math.round(this.ping * 0.6 + ms * 0.4);
    this.hooks.onPing?.(this.ping);
  }
  private handleEv(e: Ev, forward: boolean) {
    this.fx.push(e);
    if (forward) this.outEv.push(e);
    if (e.t === 'point' && e.to !== this.myIdx) this.roundsLost++;
    if (e.t === 'saved' && e.idx === this.myIdx) this.bonus.saves++;
    if (e.t === 'perfect' && e.idx === this.myIdx) this.bonus.perfects++;
    {
      // compteurs de la partie pour les mesures
      const T = this.tally,
        me = this.myIdx;
      if (e.t === 'hit') {
        if (e.by === me) {
          T.dealt++;
          if (e.exh) T.exhDealt++;
        }
        if (e.to === me) {
          T.taken++;
          if (e.exh) T.exhTaken++;
        }
      } else if (e.t === 'parry' && e.by === me) T.parries++;
      else if (e.t === 'dodge' && e.by === me) T.dodges++;
      else if (e.t === 'spam' && e.idx === me) T.spam++;
      else if (e.t === 'spamblock' && e.idx === me) T.spamBlock++;
      else if (e.t === 'ko' && e.to === me) {
        T.ejected++;
        if (e.exh) T.ejectedExh++;
      }
    }
    if (this.tuto) this.tutoEvent(e);
    if (e.t === 'end') {
      this.ended = true;
      const st = this.state;
      this.seconds = st && st.duel && st.duel.start != null ? Math.round((st.time - st.duel.start) / 1000) : 0;
      if (this.mode !== 'tuto' && this.mode !== 'showcase')
        track('match_ended', {
          mode: this.mode,
          won: e.winner === this.myIdx,
          me: e.score[this.myIdx],
          foe: e.score[1 - this.myIdx],
          seconds: this.seconds,
          floor: this.floor ? (this.floor.daily ? 'daily' : this.floor.n) : null,
          attempt: this.attempt,
          ...this.tally,
          // invité d'un duel : régularité du réseau, pour comprendre un gel après coup
          ...(this.mode === 'guest'
            ? {
                net: voieDuel(),
                ping: this.ping,
                retard: Math.round(this.tampon.retard),
                trous: this.tampon.trous,
                trou_max: Math.round(this.tampon.trouMax),
              }
            : {}),
        });
      this.hooks.onEnd?.(e.winner, e.score);
    }
  }

  tick(dt: number) {
    if (!this.active) return;
    if (this.conn) {
      this.pingT -= dt * 1000;
      if (this.pingT <= 0) {
        this.pingT = 2000;
        this.conn.send({ t: 'ping', ts: performance.now() });
      }
    }
    if (this.mode === 'guest') {
      this.jouerTampon(dt);
      this.sendT -= dt * 1000;
      const packed = JSON.stringify(packInput(this.input));
      if (packed !== this.lastSent || this.sendT <= 0) {
        this.conn!.send({ t: 'in', i: JSON.parse(packed) });
        this.lastSent = packed;
        this.sendT = 100;
      }
      return;
    }
    // hôte ou mode local : pas fixe de 1/60 s
    if (this.mode === 'showcase') this.showcaseTick(dt);
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 6) {
      const mine = this.rec ? this.rec.pas(this.sim, this.input) : this.input;
      const inputs = this.myIdx === 0 ? [mine, this.remote] : [this.remote, mine];
      stepSim(this.sim, STEP, inputs);
      for (const e of drainEvents(this.sim)) {
        // coup final : l'enregistrement s'arrête au même pas que le rejeu du serveur
        if (e.t === 'end' && this.rec && this.aEnregistrer) {
          this.combat = { ...this.aEnregistrer.c, e: this.rec.fin() };
          this.rec = null;
        }
        this.handleEv(e, this.mode === 'host');
      }
      if (this.tuto) this.tutoTick(STEP);
      this.acc -= STEP;
      n++;
      if (!this.sim) break;
    }
    if (this.mode === 'host' && this.conn) {
      this.snapT -= dt * 1000;
      if (this.snapT <= 0) {
        this.snapT = SNAP_MS;
        this.conn.send({ t: 's', s: snapshot(this.sim), e: this.outEv });
        this.outEv = [];
      }
    }
  }
  // Invité : applique les instantanés dont l'heure est venue, puis place les combattants entre celui-ci et le suivant.
  private jouerTampon(dt: number) {
    for (const { s, e } of this.tampon.avancer(dt * 1000, performance.now())) {
      if (!this.mirror) return;
      applySnapshot(this.mirror, s);
      this.dernierS = s;
      for (const ev of e) this.handleEv(ev, false);
    }
    if (!this.mirror) return;
    advanceMirror(this.mirror, dt);
    const n = this.tampon.suivant(),
      a = this.dernierS;
    if (!n || !a) return; // rien d'avance : les combattants glissent vers la dernière position connue
    this.mirror.f.forEach((f: any, i: number) => {
      const p = a.f[i],
        q = n.v.s.f[i];
      if (!p || !q || Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 160) return;
      f.x = f.tx = p[0] + (q[0] - p[0]) * n.k;
      f.y = f.ty = p[1] + (q[1] - p[1]) * n.k;
    });
  }
  // Envoie tout de suite l'état des entrées (utile quand l'onglet passe en arrière-plan).
  flushInput() {
    if (this.mode === 'guest' && this.conn) {
      const packed = packInput(this.input);
      this.conn.send({ t: 'in', i: packed });
      this.lastSent = JSON.stringify(packed);
    }
  }
  setAway(away: boolean) {
    if (this.mode === 'host' && this.conn) this.conn.send({ t: 'away', v: away });
  }
  takeFx(): Ev[] {
    const f = this.fx;
    this.fx = [];
    return f;
  }

  requestRematch() {
    if (!this.ended) return;
    if (this.local) {
      if (this.mode === 'practice') this.specs[1] = { ...this.specs[1], look: randLook() };
      this.begin();
      return;
    }
    track('rematch_clicked', { mode: this.mode });
    this.rematchMe = true;
    this.conn?.send({ t: 'rematch' });
    this.hooks.onRematch?.(true, this.rematchThem);
    this.tryRematch();
  }
  private tryRematch() {
    if (this.mode !== 'host' || !this.rematchMe || !this.rematchThem) return;
    this.conn!.send({ t: 'restart' });
    this.begin();
  }
  private lost() {
    if (this.mode === 'idle') return;
    const was = this.mode;
    this.conn = null;
    // l'adversaire parti ne tient plus aucune touche (les compteurs restent, sinon l'hôte croirait à une nouvelle action)
    const r = this.remote;
    this.remote = { ...emptyInput(), parryN: r.parryN, dodgeN: r.dodgeN, emoteN: r.emoteN };
    if (was === 'host' || was === 'guest') {
      track('disconnect', { mode: was, ended: this.ended });
      this.hooks.onDisconnect?.();
    }
  }
  leave(silent = false) {
    if (this.active && !this.ended && this.mode !== 'showcase' && this.matches > 0) {
      const D = this.state?.duel;
      track('match_abandoned', {
        mode: this.mode,
        floor: this.floor ? (this.floor.daily ? 'daily' : this.floor.n) : null,
        round: D ? D.round : null,
        score_me: D ? D.score[this.myIdx] : null,
        score_foe: D ? D.score[1 - this.myIdx] : null,
      });
    }
    if (silent === false || this.mode === 'idle') this.matches = 0;
    this.hooks.onLeave?.();
    const c = this.conn;
    this.conn = null;
    if (c) c.close();
    this.mode = 'idle';
    this.sim = null;
    this.mirror = null;
    this.show = null;
    this.ended = false;
    this.fx = [];
    this.outEv = [];
    this.ping = -1;
    this.notice = '';
    this.tuto = null;
    this.aEnregistrer = null;
    this.rec = null;
    this.combat = null;
    this.theme = null;
    if (!silent) this.hooks.onStatus?.('');
  }
}
export const session = new Session();
