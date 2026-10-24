// Transport réseau entre les deux joueurs d'un duel.
// - "peer"  : WebRTC pair à pair via PeerJS (production, aucun serveur à héberger)
// - "local" : BroadcastChannel entre deux onglets du même navigateur (tests et dev hors ligne)
import Peer, { DataConnection } from 'peerjs';

export interface Conn {
  send(msg: any): void;
  onMessage(cb: (msg: any) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
export interface HostHandle {
  code: string;
  close(): void;
}
export type NetKind = 'peer' | 'local';

const PREFIX = 'kata-io-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(len = 6) {
  let s = '';
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  for (const v of a) s += ALPHABET[v % ALPHABET.length];
  return s;
}
export function cleanCode(s: string) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

/* ---------- PeerJS ---------- */
function wrapPeer(c: DataConnection, peer?: Peer): Conn {
  let closeCb: (() => void) | null = null,
    closed = false;
  const fire = () => {
    if (closed) return;
    closed = true;
    closeCb && closeCb();
  };
  c.on('close', fire);
  c.on('error', fire);
  return {
    send: m => {
      if (c.open) c.send(m);
    },
    onMessage: cb => c.on('data', d => cb(d)),
    onClose: cb => {
      closeCb = cb;
    },
    close: () => {
      closed = true;
      try {
        c.close();
      } catch (e) {
        /* déjà fermée */
      }
      if (peer) setTimeout(() => peer.destroy(), 300);
    },
  };
}
function peerHost(onGuest: (c: Conn) => void, onError: (msg: string) => void, attempt = 0): Promise<HostHandle> {
  return new Promise((resolve, reject) => {
    const code = newCode();
    const peer = new Peer(PREFIX + code, { debug: 1 });
    let taken = false,
      opened = false;
    peer.on('open', () => {
      opened = true;
      resolve({ code, close: () => peer.destroy() });
    });
    peer.on('connection', c => {
      if (taken) {
        c.on('open', () => {
          c.send({ t: 'full' });
          setTimeout(() => c.close(), 300);
        });
        return;
      }
      taken = true;
      c.on('open', () => onGuest(wrapPeer(c)));
    });
    peer.on('disconnected', () => {
      if (opened && !taken) peer.reconnect();
    });
    peer.on('error', (err: any) => {
      if (err && err.type === 'unavailable-id' && attempt < 3) {
        peer.destroy();
        peerHost(onGuest, onError, attempt + 1).then(resolve, reject);
        return;
      }
      const msg =
        err && err.type === 'network'
          ? 'Connexion au service de mise en relation impossible.'
          : 'Erreur réseau : ' + ((err && err.type) || 'inconnue');
      if (!opened) reject(new Error(msg));
      else onError(msg);
    });
  });
}
function peerJoin(code: string): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 1 });
    let done = false;
    const fail = (m: string) => {
      if (done) return;
      done = true;
      peer.destroy();
      reject(new Error(m));
    };
    const timer = setTimeout(() => fail('La salle ne répond pas. Vérifie le code ou demande un nouveau lien.'), 15000);
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      c.on('open', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(wrapPeer(c, peer));
      });
    });
    peer.on('error', (err: any) => {
      clearTimeout(timer);
      if (err && err.type === 'peer-unavailable') fail('Salle introuvable. Le lien a peut-être expiré.');
      else fail('Connexion impossible : ' + ((err && err.type) || 'erreur inconnue'));
    });
  });
}

/* ---------- BroadcastChannel (deux onglets, même navigateur) ---------- */
function bcConn(ch: BroadcastChannel, me: string, other: string): Conn {
  let msgCb: ((m: any) => void) | null = null,
    closeCb: (() => void) | null = null,
    closed = false;
  ch.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || d.to !== me || d.from !== other) return;
    if (d.bye) {
      if (!closed) {
        closed = true;
        closeCb && closeCb();
      }
      return;
    }
    msgCb && msgCb(d.m);
  });
  window.addEventListener('beforeunload', () => ch.postMessage({ from: me, to: other, bye: 1 }));
  return {
    send: m => {
      if (!closed) ch.postMessage({ from: me, to: other, m });
    },
    onMessage: cb => {
      msgCb = cb;
    },
    onClose: cb => {
      closeCb = cb;
    },
    close: () => {
      if (closed) return;
      closed = true;
      ch.postMessage({ from: me, to: other, bye: 1 });
      setTimeout(() => ch.close(), 50);
    },
  };
}
function localHost(onGuest: (c: Conn) => void): Promise<HostHandle> {
  const code = newCode();
  const ch = new BroadcastChannel(PREFIX + code);
  let taken = false;
  ch.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || !d.join || taken) return;
    taken = true;
    ch.postMessage({ accept: d.join });
    onGuest(bcConn(ch, 'host', d.join));
  });
  return Promise.resolve({
    code,
    close: () => {
      if (!taken) ch.close();
    },
  });
}
function localJoin(code: string): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const ch = new BroadcastChannel(PREFIX + code);
    const me = 'g' + newCode(4);
    const timer = setTimeout(() => {
      ch.close();
      reject(new Error('Salle introuvable en mode local.'));
    }, 4000);
    const onAcc = (ev: MessageEvent) => {
      if (ev.data && ev.data.accept === me) {
        clearTimeout(timer);
        ch.removeEventListener('message', onAcc);
        resolve(bcConn(ch, me, 'host'));
      }
    };
    ch.addEventListener('message', onAcc);
    ch.postMessage({ join: me });
  });
}

export function hostRoom(kind: NetKind, onGuest: (c: Conn) => void, onError: (m: string) => void) {
  return kind === 'local' ? localHost(onGuest) : peerHost(onGuest, onError);
}
export function joinRoom(kind: NetKind, code: string) {
  return kind === 'local' ? localJoin(code) : peerJoin(code);
}
