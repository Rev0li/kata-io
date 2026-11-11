// Duels entre amis arbitrés par le serveur (étape 3 du backend, D19).
// Une salle = deux joueurs et une simulation qui tourne ICI : chaque joueur n'envoie que ses entrées et reçoit des
// instantanés (30 par seconde), exactement comme l'invité d'un ancien duel pair à pair. Personne ne peut donc
// tricher sur le résultat, et aucun des deux n'a l'avantage d'héberger la partie.
//
// Ce fichier ne connaît pas le réseau : il reçoit des messages déjà décodés et parle à un « Lien ». Le WebSocket
// est branché dans index.ts ; les tests (tests/duel.test.ts) utilisent de faux liens.
//
//   joueur → serveur   hello { spec }      son combattant (une fois)
//                      theme { v }         dojo choisi par le créateur, avant le début (null : au hasard)
//                      in { i }            ses entrées (packInput de src/net/session.ts)
//                      rematch             demande de revanche, après la fin
//                      ping { ts }
//   serveur → joueur   salle { code }      au créateur ;  ok  à celui qui rejoint ;  refus { msg }  sinon
//                      welcome { moi, theme, specs }   le combat commence ; moi : sa place (0 ou 1)
//                      s { s, e }          instantané et événements
//                      rematch             l'autre veut une revanche ;  restart  c'est reparti
//                      pong { ts }
// Quand un joueur part, le lien de l'autre est fermé : son jeu affiche « adversaire déconnecté ».
import { randomInt } from 'node:crypto';
import { createSim, stepSim, drainEvents, snapshot, emptyInput } from '../src/sim/sim';
import type { Ev, Input, Sim, Spec } from '../src/sim/sim';
import { DOJOS, EMOTES, isDojo, sanitizeLook } from '../src/sim/data';
import { FULL_ABIL } from '../src/sim/progression';

export interface Lien {
  envoyer(texte: string): void;
  fermer(): void;
}
export interface Poignee {
  message(m: unknown): void;
  ferme(): void;
}

const PAS = 1 / 60,
  PAS_MS = 1000 / 60,
  PAS_PAR_INSTANTANE = 2, // 30 instantanés par seconde
  RATTRAPAGE_MAX = 6; // pas joués d'un coup au plus, si le serveur a pris du retard
export const SALLES_MAX = 100,
  ATTENTE_MAX_MS = 15 * 60_000, // salle ouverte sans adversaire
  SILENCE_MAX_MS = 3 * 60_000, // combat où plus personne n'envoie rien
  SALLE_MAX_MS = 60 * 60_000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // le même que le jeu (src/net/transport.ts) : ni O/0 ni I/1

interface Joueur {
  lien: Lien;
  spec: Spec | null;
  entree: Input;
  revanche: boolean;
}
interface Salle {
  code: string;
  j: (Joueur | null)[]; // 0 : le créateur, 1 : celui qui rejoint
  theme: string | null;
  etat: 'attente' | 'combat' | 'fini';
  sim: Sim | null;
  acc: number;
  pas: number;
  ev: Ev[];
  creee: number;
  vue: number; // dernier message reçu d'un joueur
}

const nombre = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return n < min ? min : n > max ? max : n;
};
const compteur = (v: unknown) => Math.floor(nombre(v, 0, 2 ** 31));
// Entrées reçues d'un joueur : rien n'est cru sur parole, tout est borné avant d'entrer dans la simulation.
export function lireEntree(a: unknown): Input | null {
  if (!Array.isArray(a) || a.length > 8) return null;
  const emote = typeof a[7] === 'string' && Object.hasOwn(EMOTES, a[7]) ? a[7] : null;
  return {
    mx: nombre(a[0], -1, 1),
    my: nombre(a[1], -1, 1),
    aim: nombre(a[2], -7, 7),
    atk: !!a[3],
    parryN: compteur(a[4]),
    dodgeN: compteur(a[5]),
    emoteN: compteur(a[6]),
    emote,
  };
}
function lireSpec(x: unknown): Spec {
  const s = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const nom = String(typeof s.name === 'string' ? s.name : '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 16);
  return {
    name: nom || 'Disciple',
    look: sanitizeLook(s.look),
    abil: { ...FULL_ABIL },
    belt: typeof s.belt === 'string' ? s.belt.slice(0, 24) : undefined,
  };
}

export class Duels {
  private salles = new Map<string, Salle>();
  constructor(
    private maintenant: () => number = Date.now,
    private journal: (msg: string, d?: Record<string, unknown>) => void = () => {},
  ) {}

  get nombre() {
    return this.salles.size;
  }

  private dire(j: Joueur | null, m: unknown) {
    if (j) j.lien.envoyer(JSON.stringify(m));
  }
  private nouveauJoueur(lien: Lien): Joueur {
    return { lien, spec: null, entree: emptyInput(), revanche: false };
  }
  private refuser(lien: Lien, msg: string): null {
    lien.envoyer(JSON.stringify({ t: 'refus', msg }));
    lien.fermer();
    return null;
  }

  creer(lien: Lien): Poignee | null {
    if (this.salles.size >= SALLES_MAX)
      return this.refuser(lien, 'Trop de duels en cours : réessaie dans quelques minutes.');
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    } while (this.salles.has(code));
    const t = this.maintenant(),
      j = this.nouveauJoueur(lien);
    const s: Salle = {
      code,
      j: [j, null],
      theme: null,
      etat: 'attente',
      sim: null,
      acc: 0,
      pas: 0,
      ev: [],
      creee: t,
      vue: t,
    };
    this.salles.set(code, s);
    this.dire(j, { t: 'salle', code });
    return this.poignee(s, j);
  }

  rejoindre(codeBrut: unknown, lien: Lien): Poignee | null {
    const code = String(codeBrut || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    const s = this.salles.get(code);
    if (!s) return this.refuser(lien, 'Salle introuvable. Le lien a peut-être expiré.');
    if (s.j[1]) return this.refuser(lien, 'Cette salle est déjà complète.');
    const j = this.nouveauJoueur(lien);
    s.j[1] = j;
    s.vue = this.maintenant();
    this.dire(j, { t: 'ok' });
    return this.poignee(s, j);
  }

  private poignee(s: Salle, j: Joueur): Poignee {
    return {
      message: m => this.recu(s, j, m),
      ferme: () => this.parti(s, j),
    };
  }

  private recu(s: Salle, j: Joueur, brut: unknown) {
    if (!brut || typeof brut !== 'object' || this.salles.get(s.code) !== s) return;
    const m = brut as Record<string, unknown>;
    s.vue = this.maintenant();
    switch (m.t) {
      case 'hello':
        if (j.spec) return;
        j.spec = lireSpec(m.spec);
        if (s.etat === 'attente' && s.j[0]?.spec && s.j[1]?.spec) this.commencer(s, true);
        break;
      case 'theme':
        if (j === s.j[0] && s.etat === 'attente') s.theme = isDojo(m.v) ? m.v : null;
        break;
      case 'in': {
        const e = lireEntree(m.i);
        if (e) j.entree = e;
        break;
      }
      case 'rematch':
        if (s.etat !== 'fini' || j.revanche) return;
        j.revanche = true;
        this.dire(s.j[j === s.j[0] ? 1 : 0], { t: 'rematch' });
        if (s.j[0]?.revanche && s.j[1]?.revanche) this.commencer(s, false);
        break;
      case 'ping':
        this.dire(j, { t: 'pong', ts: typeof m.ts === 'number' ? m.ts : 0 });
        break;
    }
  }

  private commencer(s: Salle, premier: boolean) {
    const specs = s.j.map(j => j!.spec!);
    if (premier) {
      const theme = s.theme || DOJOS[randomInt(DOJOS.length)][0];
      s.theme = theme;
      const pub = specs.map(sp => ({ name: sp.name, look: sp.look, belt: sp.belt }));
      s.j.forEach((j, moi) => this.dire(j, { t: 'welcome', moi, theme, specs: pub }));
      this.journal('duel commencé', { salles: this.salles.size });
    } else for (const j of s.j) this.dire(j, { t: 'restart' });
    s.sim = createSim(specs, {});
    // les compteurs d'actions du joueur continuent d'une manche à l'autre : le combattant neuf part de leur valeur
    // actuelle, sinon il prendrait l'écart pour un appui et esquiverait dès son apparition
    s.sim.f.forEach((f, i) => {
      const e = s.j[i]!.entree;
      f.inPrev = { atk: false, parryN: e.parryN, dodgeN: e.dodgeN, emoteN: e.emoteN };
    });
    for (const j of s.j) j!.revanche = false;
    s.etat = 'combat';
    s.acc = 0;
    s.pas = 0;
    s.ev = [];
  }

  private parti(s: Salle, j: Joueur) {
    if (this.salles.get(s.code) !== s) return;
    // avant le début, celui qui rejoint peut repartir : la salle attend toujours quelqu'un
    if (s.etat === 'attente' && j === s.j[1]) {
      s.j[1] = null;
      return;
    }
    this.fermer(s, j);
  }
  private fermer(s: Salle, saufLui: Joueur | null = null) {
    this.salles.delete(s.code);
    for (const j of s.j) if (j && j !== saufLui) j.lien.fermer();
  }

  // Fait avancer tous les combats de dtMs millisecondes (appelé par l'horloge du serveur, index.ts).
  avancer(dtMs: number) {
    const t = this.maintenant();
    for (const s of [...this.salles.values()]) {
      const age = t - s.creee,
        silence = t - s.vue;
      if (age > SALLE_MAX_MS || (s.etat === 'attente' ? age > ATTENTE_MAX_MS : silence > SILENCE_MAX_MS)) {
        this.fermer(s);
        continue;
      }
      const sim = s.sim;
      if (!sim) continue;
      s.acc += Math.min(dtMs, 250);
      const entrees = [s.j[0]!.entree, s.j[1]!.entree];
      for (let n = 0; s.acc >= PAS_MS && n < RATTRAPAGE_MAX; n++) {
        s.acc -= PAS_MS;
        stepSim(sim, PAS, entrees);
        for (const e of drainEvents(sim)) {
          s.ev.push(e);
          if (e.t === 'end') s.etat = 'fini';
        }
        if (++s.pas % PAS_PAR_INSTANTANE === 0) {
          const texte = JSON.stringify({ t: 's', s: snapshot(sim), e: s.ev });
          s.ev = [];
          for (const j of s.j) j!.lien.envoyer(texte);
        }
      }
      if (s.acc > PAS_MS * RATTRAPAGE_MAX) s.acc = 0; // trop de retard : on ne le rattrape pas, le combat ralentit
    }
  }

  toutFermer() {
    for (const s of [...this.salles.values()]) this.fermer(s);
  }
}
