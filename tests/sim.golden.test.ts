// Filet de sécurité de la simulation : des matchs à graine fixe, résumés et comparés à un instantané.
// Si un résumé change, c'est que le comportement du combat a changé. Volontaire (réglage de RULES, nouvelle règle) :
// relancer avec `npm test -- -u` pour accepter le nouvel instantané. Involontaire (refacto) : c'est une régression.
import { describe, test, expect } from 'vitest';
import {
  createSim,
  stepSim,
  drainEvents,
  emptyInput,
  seededRng,
  snapshot,
  createMirror,
  applySnapshot,
  advanceMirror,
  setDummy,
  Input,
  Spec,
  SimOpts,
} from '../src/sim/sim';
import { LEVELS, DEFAULT_LOOK, randLook, randDeck } from '../src/sim/data';
import { towerFloor, abilFor, FULL_ABIL } from '../src/sim/progression';

const STEP = 1 / 60,
  MAX_STEPS = 60 * 600;

// Empreinte courte d'un texte (FNV-1a 32 bits) : détecte le moindre changement dans le flux d'événements.
function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
const r2 = (v: number) => Math.round(v * 100) / 100;

type Script = (st: any, step: number, idx: number) => Input;
// Joueur humain scripté : s'approche, frappe par rafales, charge, pare, esquive et fait une emote.
// Tout dépend de l'état et du numéro de pas, donc le script est déterministe.
function player(offset = 0): Script {
  let parryN = 0,
    dodgeN = 0,
    emoteN = 0;
  return (st, k, idx) => {
    const me = st.f[idx],
      foe = st.f[1 - idx],
      i = emptyInput();
    const dx = foe.x - me.x,
      dy = foe.y - me.y,
      d = Math.hypot(dx, dy) || 1;
    if (d > 55) {
      i.mx = dx / d;
      i.my = dy / d;
    }
    i.aim = Math.atan2(dy, dx);
    const t = (k + offset) % 360;
    i.atk = t % 40 < 3 || (t >= 300 && t < 345); // coups blancs, puis un coup chargé
    if ((k + offset) % 97 === 0) parryN++;
    if ((k + offset) % 151 === 0) dodgeN++;
    if (k === 500 + offset) {
      emoteN++;
      i.emote = 'salut';
    }
    Object.assign(i, { parryN, dodgeN, emoteN });
    return i;
  };
}
// Joueur qui martèle l'attaque : déclenche l'anti-spam (D9).
const masher: Script = (st, k, idx) => {
  const i = player()(st, k, idx);
  i.atk = k % 6 < 3;
  return i;
};

interface Run {
  st: any;
  summary: any;
}
function run(
  specs: Spec[],
  opts: SimOpts,
  scripts: (Script | null)[] = [],
  maxSteps = MAX_STEPS,
  onStep?: (st: any, k: number, ev: any[]) => void,
): Run {
  const st = createSim(specs, opts);
  const evs: any[] = [],
    counts: Record<string, number> = {},
    kos: number[] = [];
  let end: any = null,
    k = 0;
  while (!end && k < maxSteps) {
    const inputs = [0, 1].map(i => (scripts[i] ? scripts[i]!(st, k, i) : emptyInput()));
    stepSim(st, STEP, inputs);
    const ev = drainEvents(st);
    for (const e of ev) {
      evs.push(e);
      counts[e.t] = (counts[e.t] || 0) + 1;
      if (e.t === 'ko') kos.push(e.pct);
      if (e.t === 'end') end = e;
    }
    onStep?.(st, k, ev);
    k++;
  }
  const counted = Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map(n => [n, counts[n]]),
  );
  return {
    st,
    summary: {
      end: end ? { winner: end.winner, score: end.score } : null,
      steps: k,
      kos,
      events: counted,
      eventHash: fnv(JSON.stringify(evs)),
      fighters: st.f.map((e: any) => ({
        state: e.state,
        x: r2(e.x),
        y: r2(e.y),
        pct: r2(e.pct),
        souffle: r2(e.souffle),
        qi: Math.round(e.qi),
      })),
    },
  };
}
const bot = (name: string, skill: number, seed: number, extra: Partial<Spec> = {}): Spec => ({
  name,
  look: randLook(seededRng(seed)),
  deck: randDeck(seededRng(seed + 100)),
  bot: skill,
  ...extra,
});
const human = (name: string, extra: Partial<Spec> = {}): Spec => ({ name, look: DEFAULT_LOOK, ...extra });

describe('déterminisme', () => {
  test('même graine, même match', () => {
    const specs = () => [bot('A', LEVELS[1].skill, 1), bot('B', LEVELS[2].skill, 2)];
    expect(run(specs(), { seed: 42 }).summary).toEqual(run(specs(), { seed: 42 }).summary);
  });
  test('graine différente, match différent', () => {
    const specs = () => [bot('A', LEVELS[1].skill, 1), bot('B', LEVELS[2].skill, 2)];
    expect(run(specs(), { seed: 1 }).summary.eventHash).not.toBe(run(specs(), { seed: 2 }).summary.eventHash);
  });
});

describe('bot contre bot', () => {
  const pairs: [number, number][] = [
    [0, 0],
    [1, 1],
    [2, 2],
    [0, 2],
    [2, 0],
  ];
  for (const [a, b] of pairs)
    test(`${LEVELS[a].name} contre ${LEVELS[b].name}`, () => {
      const { summary } = run([bot('A', LEVELS[a].skill, 10 + a), bot('B', LEVELS[b].skill, 20 + b)], {
        seed: 1000 + a * 10 + b,
      });
      expect(summary.end).not.toBeNull();
      expect(summary).toMatchSnapshot();
    });
});

describe('Tour du temple', () => {
  for (const n of [1, 2, 5, 9, 12])
    test(`étage ${n}`, () => {
      const f = towerFloor(n);
      const { summary } = run(
        [
          bot('Joueur', 0.45, 7, { abil: abilFor(Math.min(6, Math.floor(n / 2))) }),
          { name: f.name, look: f.look, deck: f.deck, bot: f.skill, abil: abilFor(f.tier) },
        ],
        { seed: 2000 + n, firstTo: f.firstTo, H: f.H, damp: f.damp },
      );
      expect(summary).toMatchSnapshot();
    });
});

describe('entrées humaines', () => {
  test('joueur scripté contre bot Adepte', () => {
    const { summary } = run([human('Joueur', { abil: FULL_ABIL }), bot('Bot', LEVELS[1].skill, 3)], { seed: 3000 }, [
      player(),
      null,
    ]);
    expect(summary).toMatchSnapshot();
  });
  test('joueur sans techniques (ceinture blanche) contre bot', () => {
    const { summary } = run(
      [human('Joueur', { abil: abilFor(0) }), bot('Bot', LEVELS[0].skill, 4, { abil: abilFor(0) })],
      { seed: 3001 },
      [player(), null],
    );
    expect(summary).toMatchSnapshot();
  });
  test('martèlement contre bot : le bot s’adapte (D9)', () => {
    const { st, summary } = run(
      [human('Joueur', { abil: FULL_ABIL }), bot('Bot', LEVELS[0].skill, 5)],
      { seed: 3002 },
      [masher, null],
      60 * 30,
    );
    expect(summary.events.spam).toBeGreaterThan(0);
    expect(st.f[1].bot.adapt).toBeGreaterThan(0);
    expect(summary).toMatchSnapshot();
  });
  test('deux humains scriptés (duel entre amis)', () => {
    const { summary } = run(
      [human('Hôte', { abil: FULL_ABIL }), human('Invité', { abil: FULL_ABIL })],
      { seed: 3003 },
      [player(), masher],
    );
    expect(summary).toMatchSnapshot();
  });
});

describe('réseau : instantanés appliqués chez l’invité', () => {
  test('le miroir suit la simulation de l’hôte', () => {
    const specs = [human('Hôte', { abil: FULL_ABIL }), human('Invité', { abil: FULL_ABIL })];
    const mirror = createMirror(specs),
      sizes: number[] = [];
    const { st } = run(specs, { seed: 4000 }, [player(), player(37)], 60 * 40, (s, k) => {
      advanceMirror(mirror, STEP);
      if (k % 2 === 0) {
        const snap = JSON.parse(JSON.stringify(snapshot(s)));
        sizes.push(JSON.stringify(snap).length);
        applySnapshot(mirror, snap);
      }
    });
    expect(mirror.duel.score).toEqual(st.duel.score);
    for (let i = 0; i < 2; i++) {
      expect(mirror.f[i].state).toBe(st.f[i].state);
      expect(mirror.f[i].pct).toBeCloseTo(st.f[i].pct, 0);
    }
    expect({ mirror: fnv(JSON.stringify(mirror)), maxSnapBytes: Math.max(...sizes) }).toMatchSnapshot();
  });
});

describe('mannequin (tutoriel)', () => {
  test('mannequin qui attaque en blanc, mode libre', () => {
    const specs: Spec[] = [
      human('Élève', { abil: FULL_ABIL }),
      { name: 'Mannequin', look: DEFAULT_LOOK, dummy: true, atkSlow: 1.9, abil: FULL_ABIL },
    ];
    const { summary } = run(
      specs,
      {
        free: true,
        seed: 5000,
        pos: [
          [-110, 0],
          [80, 0],
        ],
      },
      [player(), null],
      60 * 20,
      (s, k) => {
        if (k === 0) setDummy(s, 1, 'white', 80, 0);
      },
    );
    expect(summary).toMatchSnapshot();
  });
});
