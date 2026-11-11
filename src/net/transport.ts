// Transport réseau d'un duel.
// - "serveur" : WebSocket vers le serveur de jeu, qui fait tourner le combat (server/duel.ts) ; les deux joueurs
//               sont « invités ». C'est le mode normal dès que le build connaît le serveur (VITE_API_JEU).
// - "peer"    : WebRTC pair à pair via PeerJS (ancien mode, sans serveur de jeu ; chargé à la demande)
// - "local"   : BroadcastChannel entre deux onglets du même navigateur (tests et dev hors ligne)
import type { Peer as PeerT, DataConnection } from 'peerjs';
type Peer = PeerT;
let PeerJS: typeof PeerT;
const chargerPeer = async () => {
  PeerJS ||= (await import('peerjs')).default;
};

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
export type NetKind = 'serveur' | 'peer' | 'local';

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
    const peer = new PeerJS(PREFIX + code, { debug: 1 });
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
    const peer = new PeerJS({ debug: 1 });
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

/* ---------- serveur de jeu (WebSocket) ---------- */
// Adresse du duel : VITE_WS_DUEL (production : le relais Vercel ne transporte pas le temps réel, le jeu parle donc
// directement au VPS), sinon le même hôte que la page, sous VITE_API_JEU (développement : Vite relaie).
const API = ((import.meta.env.VITE_API_JEU as string | undefined) || '').replace(/\/+$/, '');
const WS_DUEL =
  (import.meta.env.VITE_WS_DUEL as string | undefined) ||
  (API.startsWith('/') ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + API + '/duel' : '');
export const duelServeur = !!WS_DUEL;

// Refus du serveur (salle introuvable, complète) : à montrer tel quel, inutile d'essayer l'autre voie.
class Refus extends Error {}

// Ouvre le WebSocket et attend le premier message : « salle » (créateur), « ok » (invité) ou « refus ».
function ouvrirWs(code: string | null): Promise<{ code: string; conn: Conn }> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_DUEL + (code ? '?salle=' + encodeURIComponent(code) : ''));
    } catch {
      reject(new Error('Serveur de duel injoignable.'));
      return;
    }
    let pret = false,
      ferme = false,
      msgCb: ((m: any) => void) | null = null,
      closeCb: (() => void) | null = null;
    const echec = (m: string, refus = false) => {
      if (pret || ferme) return;
      ferme = true;
      clearTimeout(delai);
      try {
        ws.close();
      } catch {
        /* déjà fermé */
      }
      reject(refus ? new Refus(m) : new Error(m));
    };
    const delai = setTimeout(() => echec('Le serveur de duel ne répond pas. Réessaie dans un instant.'), 10000);
    const conn: Conn = {
      send: m => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
      },
      onMessage: cb => {
        msgCb = cb;
      },
      onClose: cb => {
        closeCb = cb;
      },
      close: () => {
        ferme = true;
        ws.close();
      },
    };
    ws.onmessage = ev => {
      let m: any;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (pret) {
        msgCb && msgCb(m);
        return;
      }
      if (m && m.t === 'refus') echec(String(m.msg || 'Salle refusée.'), true);
      else if (m && (m.t === 'salle' || m.t === 'ok')) {
        pret = true;
        clearTimeout(delai);
        resolve({ code: m.t === 'salle' ? String(m.code) : code || '', conn });
      }
    };
    ws.onerror = () => echec('Serveur de duel injoignable. Réessaie dans un instant.');
    ws.onclose = () => {
      echec('Serveur de duel injoignable. Réessaie dans un instant.');
      if (pret && !ferme) {
        ferme = true;
        closeCb && closeCb();
      }
    };
  });
}

/* ---------- serveur de jeu, sans WebSocket ---------- */
// Voie de secours (server/duel-http.ts) : Brave et certains bloqueurs coupent les WebSocket vers un autre domaine
// que celui de la page, alors que les requêtes ordinaires passent. Le serveur envoie par un flux d'événements
// (EventSource), le jeu répond par de petites requêtes POST, une à la fois : ce qui s'accumule pendant un envoi
// part dans le suivant, et seules les dernières entrées du joueur sont gardées.
const HTTP_DUEL = WS_DUEL.replace(/^ws/, 'http');
async function ouvrirHttp(code: string | null): Promise<{ code: string; conn: Conn }> {
  const injoignable = 'Serveur de duel injoignable. Réessaie dans un instant.';
  let d: any;
  try {
    // corps en texte simple : pas de requête préalable du navigateur (CORS)
    const r = await fetch(HTTP_DUEL + '/ouvrir', { method: 'POST', body: JSON.stringify({ salle: code || '' }) });
    d = await r.json();
  } catch {
    throw new Error(injoignable);
  }
  const premiers: any[] = Array.isArray(d && d.m) ? d.m : [],
    refus = premiers.find(m => m && m.t === 'refus'),
    salle = premiers.find(m => m && m.t === 'salle');
  if (refus) throw new Refus(String(refus.msg || 'Salle refusée.'));
  if (!d || typeof d.jeton !== 'string') throw new Error(injoignable);
  const jeton = encodeURIComponent(d.jeton);
  let ferme = false,
    enVol = false,
    file: any[] = [],
    msgCb: ((m: any) => void) | null = null,
    closeCb: (() => void) | null = null;
  const es = new EventSource(HTTP_DUEL + '/flux?j=' + jeton);
  const fin = () => {
    if (ferme) return;
    ferme = true;
    es.close();
    closeCb && closeCb();
  };
  es.onmessage = ev => {
    if (ferme) return;
    try {
      const m = JSON.parse(ev.data);
      msgCb && msgCb(m);
    } catch {
      /* message illisible : ignoré */
    }
  };
  es.addEventListener('fin', fin);
  es.onerror = fin; // le serveur a déjà libéré la salle : inutile de laisser le navigateur se reconnecter
  const vider = async () => {
    if (enVol || ferme || !file.length) return;
    enVol = true;
    const lot = file.splice(0, 20);
    try {
      await fetch(HTTP_DUEL + '/dire?j=' + jeton, { method: 'POST', body: JSON.stringify(lot) });
    } catch {
      /* perdu : les entrées suivantes le remplacent */
    }
    enVol = false;
    vider();
  };
  const conn: Conn = {
    send: m => {
      if (ferme) return;
      const i = m && m.t === 'in' ? file.findIndex(x => x.t === 'in') : -1;
      if (i >= 0) file[i] = m;
      else file.push(m);
      vider();
    },
    onMessage: cb => {
      msgCb = cb;
    },
    onClose: cb => {
      closeCb = cb;
    },
    close: () => {
      ferme = true;
      es.close();
    },
  };
  return { code: salle ? String(salle.code) : code || '', conn };
}

// WebSocket d'abord ; s'il ne s'ouvre pas, la voie HTTP, que l'on garde ensuite pour toute la visite.
let sansWs = false;
// ?net=http : essayer la voie de secours sans attendre un blocage.
export const forcerHttp = () => {
  sansWs = true;
};
async function ouvrir(code: string | null) {
  if (!sansWs)
    try {
      return await ouvrirWs(code);
    } catch (e) {
      if (e instanceof Refus) throw e;
    }
  const r = await ouvrirHttp(code);
  sansWs = true;
  return r;
}
// Salle sur le serveur : le créateur est connecté dès l'ouverture, et sera prévenu (welcome) quand l'autre arrive.
export const serveurOuvrir = () => ouvrir(null);
export const serveurRejoindre = (code: string) => ouvrir(code).then(r => r.conn);

export async function hostRoom(kind: NetKind, onGuest: (c: Conn) => void, onError: (m: string) => void) {
  if (kind === 'local') return localHost(onGuest);
  await chargerPeer();
  return peerHost(onGuest, onError);
}
export async function joinRoom(kind: NetKind, code: string) {
  if (kind === 'serveur') return serveurRejoindre(code);
  if (kind === 'local') return localJoin(code);
  await chargerPeer();
  return peerJoin(code);
}
