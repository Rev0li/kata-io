// Contrôleur de partie.
// - practice : combat local contre un bot, sans réseau
// - tower    : un étage de la Tour du temple (local)
// - tuto     : tutoriel ou exercice contre le mannequin (local)
// - host     : ce navigateur fait tourner la simulation et envoie des instantanés à l'invité (30 par seconde)
// - guest    : ce navigateur envoie ses entrées et affiche les instantanés reçus
import { createSim, stepSim, drainEvents, snapshot, createMirror, applySnapshot, advanceMirror, emptyInput, Input, Spec, Ev, respawn, setDummy, alive } from '../sim/sim';
import { Conn } from './transport';
import { LEVELS, randLook, randDeck, BOT_NAMES, sanitizeLook } from '../sim/data';
import { Abil, FULL_ABIL, Floor, abilFor, RANKS } from '../sim/progression';
import { TutoStep } from '../game/tutorial';

export type Mode = 'idle' | 'practice' | 'tower' | 'tuto' | 'host' | 'guest';
const STEP = 1 / 60, SNAP_MS = 33;

export interface Hooks {
  onStart?(): void;
  onEnd?(winner: number, score: number[]): void;
  onDisconnect?(): void;
  onRematch?(me: boolean, them: boolean): void;
  onPing?(ms: number): void;
  onStatus?(msg: string): void;
  onTuto?(step: TutoStep | null, i: number, n: number, count: number): void;
  onTutoDone?(): void;
}
export interface MeSpec extends Spec { abil: Abil; belt: string }

const packInput = (i: Input) => [Math.round(i.mx * 100) / 100, Math.round(i.my * 100) / 100, Math.round(i.aim * 100) / 100, i.atk ? 1 : 0, i.parryN, i.dodgeN, i.emoteN, i.emote || ''];
const unpackInput = (a: any[]): Input => ({ mx: +a[0] || 0, my: +a[1] || 0, aim: +a[2] || 0, atk: !!a[3], parryN: a[4] | 0, dodgeN: a[5] | 0, emoteN: a[6] | 0, emote: a[7] || null });

class Session {
  mode: Mode = 'idle';
  sim: any = null; mirror: any = null; myIdx = 0;
  conn: Conn | null = null;
  input: Input = emptyInput(); remote: Input = emptyInput();
  specs: Spec[] = []; opts: any = {};
  fx: Ev[] = []; outEv: Ev[] = [];
  acc = 0; snapT = 0; sendT = 0; lastSent = ''; pingT = 0; ping = -1;
  ended = false; rematchMe = false; rematchThem = false; level = 1; notice = '';
  floor: Floor | null = null; roundsLost = 0; seconds = 0;
  tuto: { steps: TutoStep[]; i: number; count: number; done: boolean; endT: number; avoid: { active: boolean; dodged: boolean; hit: boolean }; hintT: number } | null = null;
  hooks: Hooks = {};

  get state() { return this.mode === 'guest' ? this.mirror : this.sim; }
  get active() { return this.mode !== 'idle' && !!this.state; }
  get local() { return this.mode === 'practice' || this.mode === 'tower' || this.mode === 'tuto'; }
  get marker() { const t = this.tuto; return t && !t.done ? t.steps[t.i].marker || null : null; }

  resetInput() { const i = this.input; this.input = { ...emptyInput(), parryN: i.parryN, dodgeN: i.dodgeN, emoteN: i.emoteN }; }

  /* ---------- démarrages ---------- */
  startPractice(me: MeSpec, level: number) {
    this.leave(true);
    this.mode = 'practice'; this.myIdx = 0; this.level = level; this.floor = null; this.opts = {};
    const lv = LEVELS[level] || LEVELS[1];
    this.specs = [me, { name: BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0], look: randLook(), deck: randDeck(), bot: lv.skill, abil: me.abil, belt: RANKS[Math.min(RANKS.length - 1, level * 3)].belt }];
    this.begin();
  }
  startTower(me: MeSpec, floor: Floor) {
    this.leave(true);
    this.mode = 'tower'; this.myIdx = 0; this.floor = floor;
    this.specs = [me, { name: floor.name, look: floor.look, deck: floor.deck, bot: floor.skill, abil: abilFor(floor.tier), belt: RANKS[floor.tier].belt }];
    this.opts = { firstTo: floor.firstTo, H: floor.H, damp: floor.damp };
    this.begin();
  }
  startTuto(me: MeSpec, steps: TutoStep[]) {
    this.leave(true);
    this.mode = 'tuto'; this.myIdx = 0; this.floor = null;
    const first = steps[0];
    this.specs = [me, { name: 'Mannequin', look: { perso: 'moine', arme: 'mains', trainee: 'aucune', ejection: 'plouf' }, dummy: true, atkSlow: 1.9, abil: FULL_ABIL,
      deck: { chain: [['direct', 'direct', 'direct'], ['direct', 'direct', 'direct'], ['direct', 'direct', 'direct'], ['direct', 'direct', 'direct']], heavy: ['belier', 'belier', 'belier', 'belier'] } }];
    this.opts = { free: true, pos: [first.me || [-110, 0], first.foe || [80, 0]] };
    this.tuto = { steps, i: 0, count: 0, done: false, endT: 0, avoid: { active: false, dodged: false, hit: false }, hintT: 0 };
    this.begin();
    this.setupStep();
  }
  startHost(conn: Conn, me: MeSpec) {
    this.mode = 'host'; this.myIdx = 0; this.conn = conn; this.specs = [{ ...me, abil: FULL_ABIL }]; this.opts = {}; this.floor = null;
    conn.onMessage(m => this.onHostMsg(m));
    conn.onClose(() => this.lost());
    this.hooks.onStatus?.('Ton adversaire arrive…');
  }
  startGuest(conn: Conn, me: MeSpec) {
    this.mode = 'guest'; this.myIdx = 1; this.conn = conn; this.floor = null;
    conn.onMessage(m => this.onGuestMsg(m));
    conn.onClose(() => this.lost());
    conn.send({ t: 'hello', spec: { name: me.name, look: me.look, belt: me.belt } });
    this.hooks.onStatus?.('Connecté. Le combat se prépare…');
  }
  private begin() {
    this.ended = false; this.rematchMe = this.rematchThem = false; this.acc = 0; this.fx = []; this.outEv = []; this.roundsLost = 0; this.seconds = 0;
    this.resetInput(); this.remote = emptyInput();
    if (this.mode === 'guest') this.mirror = createMirror(this.specs);
    else this.sim = createSim(this.specs, this.opts);
    this.hooks.onStart?.();
  }

  /* ---------- tutoriel ---------- */
  private setupStep() {
    const T = this.tuto!, st = T.steps[T.i], sim = this.sim, me = sim.f[0], foe = sim.f[1];
    if (st.me) respawn(sim, me, st.me[0], st.me[1]);
    if (st.foe) respawn(sim, foe, st.foe[0], st.foe[1]);
    me.dropT = 0; foe.dropT = 0;
    setDummy(sim, 1, st.dummy, foe.x, foe.y);
    foe.pct = st.dummyPct || 0; me.pct = 0;
    if (st.qi != null) me.qi = st.qi;
    T.count = 0; T.avoid = { active: false, dodged: false, hit: false };
    this.hooks.onTuto?.(st, T.i, T.steps.length, 0);
  }
  private tutoCount() {
    const T = this.tuto!; T.count++;
    this.fx.push({ t: 'sfx', n: 'ui', x: 0, y: 0, v: 1 });
    const st = T.steps[T.i];
    this.hooks.onTuto?.(st, T.i, T.steps.length, T.count);
    if (T.count < st.goal) return;
    if (T.i + 1 < T.steps.length) { T.i++; this.fx.push({ t: 'big', text: 'BIEN !', col: '#62c2a2', life: 900 }); this.setupStep(); }
    else { T.done = true; T.endT = 1500; this.fx.push({ t: 'big', text: 'BRAVO !', col: '#f2c14e', life: 1500 }); this.fx.push({ t: 'sfx', n: 'gong', x: 0, y: 0, v: 0.8 }); this.hooks.onTuto?.(null, T.i, T.steps.length, T.count); }
  }
  private tutoEvent(e: Ev) {
    const T = this.tuto; if (!T || T.done) return;
    const k = T.steps[T.i].kind;
    if (e.t === 'hit' && e.by === 0 && e.to === 1) {
      if (k === 'hit' || (k === 'chain2' && e.idx >= 1) || (k === 'chain3' && e.idx >= 2) || (k === 'red' && e.red) || (k === 'dragon' && e.dragon)) this.tutoCount();
    }
    if (e.t === 'hit' && e.to === 0) T.avoid.hit = true;
    if (e.t === 'parry' && e.by === 0 && k === 'parry') this.tutoCount();
    if (e.t === 'dodge' && e.by === 0 && k === 'elan') this.tutoCount();
    if (e.t === 'ko' && e.to === 1 && k === 'ko') this.tutoCount();
  }
  private tutoTick(dt: number) {
    const T = this.tuto!, sim = this.sim, me = sim.f[0], foe = sim.f[1];
    if (T.done) { T.endT -= dt * 1000; if (T.endT <= 0) { this.tuto = null; this.hooks.onTutoDone?.(); } return; }
    const st = T.steps[T.i];
    // personne ne sort pour de vrai pendant le tutoriel
    if (me.state === 'dead') { respawn(sim, me, st.me ? st.me[0] : -110, st.me ? st.me[1] : 0); me.dropT = 0; me.spawnInv = 600; }
    if (foe.state === 'dead') { const p = st.foe || [80, 0]; respawn(sim, foe, p[0], p[1]); foe.dropT = 0; setDummy(sim, 1, st.dummy, p[0], p[1]); foe.pct = st.dummyPct || 0; }
    if (st.kind !== 'ko' && alive(foe)) foe.pct = Math.min(foe.pct, st.dummyPct || 30);
    if (alive(me)) me.pct = Math.min(me.pct, 40);
    if (st.kind === 'move' && st.marker && Math.hypot(me.x - st.marker.x, me.y - st.marker.y) < st.marker.r) this.tutoCount();
    if (st.kind === 'avoid') {
      const A = T.avoid, attacking = foe.state === 'attack';
      if (attacking && !A.active) { A.active = true; A.dodged = false; A.hit = false; }
      if (A.active && me.state === 'dodge') A.dodged = true;
      if (A.active && !attacking) {
        A.active = false;
        if (A.dodged && !A.hit) this.tutoCount();
        else if (T.hintT <= 0) { T.hintT = 2500; this.fx.push({ t: 'float', x: me.x, y: me.y - 70, text: A.dodged ? 'Trop tôt : attends qu’il frappe' : 'Esquive quand il frappe !', col: '#ecdfc6', size: 15 }); }
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
        this.specs = [this.specs[0], { name: String(sp.name || 'Invité').slice(0, 16), look: sanitizeLook(sp.look), abil: FULL_ABIL, belt: typeof sp.belt === 'string' ? sp.belt : undefined }];
        this.conn!.send({ t: 'welcome', specs: this.specs.map(s => ({ name: s.name, look: s.look, belt: s.belt })) });
        this.begin();
        break;
      }
      case 'in': if (Array.isArray(m.i)) this.remote = unpackInput(m.i); break;
      case 'rematch': this.rematchThem = true; this.hooks.onRematch?.(this.rematchMe, true); this.tryRematch(); break;
      case 'ping': this.conn!.send({ t: 'pong', ts: m.ts }); break;
      case 'pong': this.gotPong(m.ts); break;
    }
  }
  private onGuestMsg(m: any) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'welcome': this.specs = (m.specs || []).map((s: any) => ({ name: String(s.name || '').slice(0, 16), look: sanitizeLook(s.look), belt: typeof s.belt === 'string' ? s.belt : undefined, abil: FULL_ABIL })); this.begin(); break;
      case 's': if (this.mirror) { applySnapshot(this.mirror, m.s); if (Array.isArray(m.e)) for (const e of m.e) this.handleEv(e, false); } break;
      case 'restart': this.begin(); break;
      case 'rematch': this.rematchThem = true; this.hooks.onRematch?.(this.rematchMe, true); break;
      case 'away': this.notice = m.v ? 'Ton adversaire a quitté l’onglet du jeu : le combat est en pause.' : ''; break;
      case 'full': this.hooks.onStatus?.('Cette salle est déjà complète.'); this.lost(); break;
      case 'ping': this.conn!.send({ t: 'pong', ts: m.ts }); break;
      case 'pong': this.gotPong(m.ts); break;
    }
  }
  private gotPong(ts: number) { const ms = Math.max(0, Math.round(performance.now() - ts)); this.ping = this.ping < 0 ? ms : Math.round(this.ping * 0.6 + ms * 0.4); this.hooks.onPing?.(this.ping); }
  private handleEv(e: Ev, forward: boolean) {
    this.fx.push(e);
    if (forward) this.outEv.push(e);
    if (e.t === 'point' && e.to !== this.myIdx) this.roundsLost++;
    if (this.tuto) this.tutoEvent(e);
    if (e.t === 'end') {
      this.ended = true;
      const st = this.state; this.seconds = st && st.duel && st.duel.start != null ? Math.round((st.time - st.duel.start) / 1000) : 0;
      this.hooks.onEnd?.(e.winner, e.score);
    }
  }

  tick(dt: number) {
    if (!this.active) return;
    if (this.conn) {
      this.pingT -= dt * 1000;
      if (this.pingT <= 0) { this.pingT = 2000; this.conn.send({ t: 'ping', ts: performance.now() }); }
    }
    if (this.mode === 'guest') {
      advanceMirror(this.mirror, dt);
      this.sendT -= dt * 1000;
      const packed = JSON.stringify(packInput(this.input));
      if (packed !== this.lastSent || this.sendT <= 0) { this.conn!.send({ t: 'in', i: JSON.parse(packed) }); this.lastSent = packed; this.sendT = 100; }
      return;
    }
    // hôte ou mode local : pas fixe de 1/60 s
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 6) {
      const inputs = this.myIdx === 0 ? [this.input, this.remote] : [this.remote, this.input];
      stepSim(this.sim, STEP, inputs);
      for (const e of drainEvents(this.sim)) this.handleEv(e, this.mode === 'host');
      if (this.tuto) this.tutoTick(STEP);
      this.acc -= STEP; n++;
      if (!this.sim) break;
    }
    if (this.mode === 'host' && this.conn) {
      this.snapT -= dt * 1000;
      if (this.snapT <= 0) { this.snapT = SNAP_MS; this.conn.send({ t: 's', s: snapshot(this.sim), e: this.outEv }); this.outEv = []; }
    }
  }
  // Envoie tout de suite l'état des entrées (utile quand l'onglet passe en arrière-plan).
  flushInput() { if (this.mode === 'guest' && this.conn) { const packed = packInput(this.input); this.conn.send({ t: 'in', i: packed }); this.lastSent = JSON.stringify(packed); } }
  setAway(away: boolean) { if (this.mode === 'host' && this.conn) this.conn.send({ t: 'away', v: away }); }
  takeFx(): Ev[] { const f = this.fx; this.fx = []; return f; }

  requestRematch() {
    if (!this.ended) return;
    if (this.local) { if (this.mode === 'practice') this.specs[1] = { ...this.specs[1], look: randLook() }; this.begin(); return; }
    this.rematchMe = true; this.conn?.send({ t: 'rematch' });
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
    const was = this.mode; this.conn = null;
    if (was === 'host' || was === 'guest') this.hooks.onDisconnect?.();
  }
  leave(silent = false) {
    const c = this.conn; this.conn = null;
    if (c) c.close();
    this.mode = 'idle'; this.sim = null; this.mirror = null; this.ended = false; this.fx = []; this.outEv = []; this.ping = -1; this.notice = ''; this.tuto = null;
    if (!silent) this.hooks.onStatus?.('');
  }
}
export const session = new Session();
