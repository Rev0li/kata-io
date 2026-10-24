// Contrôleur de partie.
// - practice : combat local contre un bot, sans réseau
// - host     : ce navigateur fait tourner la simulation et envoie des instantanés à l'invité (30 par seconde)
// - guest    : ce navigateur envoie ses entrées et affiche les instantanés reçus
import { createSim, stepSim, drainEvents, snapshot, createMirror, applySnapshot, advanceMirror, emptyInput, Input, Spec, Ev } from '../sim/sim';
import { Conn } from './transport';
import { LEVELS, randLook, randDeck, BOT_NAMES, sanitizeLook } from '../sim/data';

export type Mode = 'idle' | 'practice' | 'host' | 'guest';
const STEP = 1 / 60, SNAP_MS = 33;

export interface Hooks {
  onStart?(): void;
  onEnd?(winner: number, score: number[]): void;
  onDisconnect?(): void;
  onRematch?(me: boolean, them: boolean): void;
  onPing?(ms: number): void;
  onStatus?(msg: string): void;
}

const packInput = (i: Input) => [Math.round(i.mx * 100) / 100, Math.round(i.my * 100) / 100, Math.round(i.aim * 100) / 100, i.atk ? 1 : 0, i.parryN, i.dodgeN, i.emoteN, i.emote || ''];
const unpackInput = (a: any[]): Input => ({ mx: +a[0] || 0, my: +a[1] || 0, aim: +a[2] || 0, atk: !!a[3], parryN: a[4] | 0, dodgeN: a[5] | 0, emoteN: a[6] | 0, emote: a[7] || null });

class Session {
  mode: Mode = 'idle';
  sim: any = null; mirror: any = null; myIdx = 0;
  conn: Conn | null = null;
  input: Input = emptyInput(); remote: Input = emptyInput();
  specs: Spec[] = [];
  fx: Ev[] = []; outEv: Ev[] = [];
  acc = 0; snapT = 0; sendT = 0; lastSent = ''; pingT = 0; ping = -1;
  ended = false; rematchMe = false; rematchThem = false; level = 1; notice = '';
  hooks: Hooks = {};

  get state() { return this.mode === 'guest' ? this.mirror : this.sim; }
  get active() { return this.mode !== 'idle' && !!this.state; }

  resetInput() { const i = this.input; this.input = { ...emptyInput(), parryN: i.parryN, dodgeN: i.dodgeN, emoteN: i.emoteN }; }

  startPractice(me: Spec, level: number) {
    this.leave(true);
    this.mode = 'practice'; this.myIdx = 0; this.level = level;
    const lv = LEVELS[level] || LEVELS[1];
    this.specs = [me, { name: BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0], look: randLook(), deck: randDeck(), bot: lv.skill }];
    this.begin();
  }
  startHost(conn: Conn, me: Spec) {
    this.mode = 'host'; this.myIdx = 0; this.conn = conn; this.specs = [me];
    conn.onMessage(m => this.onHostMsg(m));
    conn.onClose(() => this.lost());
    this.hooks.onStatus?.('Ton adversaire arrive…');
  }
  startGuest(conn: Conn, me: Spec) {
    this.mode = 'guest'; this.myIdx = 1; this.conn = conn;
    conn.onMessage(m => this.onGuestMsg(m));
    conn.onClose(() => this.lost());
    conn.send({ t: 'hello', spec: { name: me.name, look: me.look, deck: me.deck } });
    this.hooks.onStatus?.('Connecté. Le combat se prépare…');
  }
  private begin() {
    this.ended = false; this.rematchMe = this.rematchThem = false; this.acc = 0; this.fx = []; this.outEv = [];
    this.resetInput(); this.remote = emptyInput();
    if (this.mode === 'guest') this.mirror = createMirror(this.specs);
    else this.sim = createSim(this.specs);
    this.hooks.onStart?.();
  }
  private onHostMsg(m: any) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello': {
        if (this.sim) return;
        const sp = m.spec || {};
        this.specs = [this.specs[0], { name: String(sp.name || 'Invité').slice(0, 16), look: sanitizeLook(sp.look), deck: undefined }];
        this.conn!.send({ t: 'welcome', specs: this.specs.map(s => ({ name: s.name, look: s.look })) });
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
      case 'welcome': this.specs = (m.specs || []).map((s: any) => ({ name: String(s.name || '').slice(0, 16), look: sanitizeLook(s.look) })); this.begin(); break;
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
    if (e.t === 'end') { this.ended = true; this.hooks.onEnd?.(e.winner, e.score); }
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
    // hôte ou entraînement : pas fixe de 1/60 s
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 6) {
      const inputs = this.myIdx === 0 ? [this.input, this.remote] : [this.remote, this.input];
      stepSim(this.sim, STEP, inputs);
      for (const e of drainEvents(this.sim)) this.handleEv(e, this.mode === 'host');
      this.acc -= STEP; n++;
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
    if (this.mode === 'practice') { this.specs[1] = { ...this.specs[1], look: randLook() }; this.begin(); return; }
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
    this.mode = 'idle'; this.sim = null; this.mirror = null; this.ended = false; this.fx = []; this.outEv = []; this.ping = -1; this.notice = '';
    if (!silent) this.hooks.onStatus?.('');
  }
}
export const session = new Session();
