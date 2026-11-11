// Stockage du serveur de jeu : montées ouvertes, records du classement, mesures de jeu.
//   baseMemoire()    tout en mémoire : tests et développement sans base (perdu à l'arrêt)
//   basePostgres()   PostgreSQL (production) ; les tables sont créées au démarrage
import type { Pool } from 'pg';

export interface Montee {
  id: string;
  joueur: string;
  graine: number;
  debut: Date;
  fin: Date | null;
}
export interface Record_ {
  joueur: string;
  pseudo: string;
  etages: number;
  secondes: number;
  le: Date;
}
export interface Evenement {
  aid: string;
  sid: string;
  nom: string;
  t: number;
  props: unknown;
  ctx: string;
}
export interface Base {
  creerMontee(m: Montee): Promise<void>;
  lireMontee(id: string): Promise<Montee | null>;
  // Clôt la montée. false si elle l'était déjà : une montée ne s'envoie qu'une fois.
  cloreMontee(id: string, r: { etages: number; secondes: number; fin: Date }): Promise<boolean>;
  lireRecord(joueur: string): Promise<Record_ | null>;
  ecrireRecord(r: Record_): Promise<void>;
  top(n: number): Promise<Record_[]>; // les meilleurs : étages, puis temps le plus court, puis le plus ancien
  rang(joueur: string): Promise<number | null>; // à partir de 1
  ajouterEvenements(evs: Evenement[]): Promise<void>;
  // Ménage : montées jamais envoyées et mesures trop anciennes.
  purger(monteesAvant: Date, evenementsAvant: Date): Promise<void>;
  fermer(): Promise<void>;
}

const mieux = (a: Record_, b: Record_) =>
  b.etages - a.etages || a.secondes - b.secondes || a.le.getTime() - b.le.getTime();

export function baseMemoire(): Base & { evenements: Evenement[] } {
  const montees = new Map<string, Montee>(),
    records = new Map<string, Record_>(),
    evenements: Evenement[] = [];
  const tries = () => [...records.values()].sort(mieux);
  return {
    evenements,
    async creerMontee(m) {
      montees.set(m.id, { ...m });
    },
    async lireMontee(id) {
      const m = montees.get(id);
      return m ? { ...m } : null;
    },
    async cloreMontee(id, r) {
      const m = montees.get(id);
      if (!m || m.fin) return false;
      m.fin = r.fin;
      return true;
    },
    async lireRecord(joueur) {
      return records.get(joueur) || null;
    },
    async ecrireRecord(r) {
      records.set(r.joueur, { ...r });
    },
    async top(n) {
      return tries().slice(0, n);
    },
    async rang(joueur) {
      const i = tries().findIndex(r => r.joueur === joueur);
      return i < 0 ? null : i + 1;
    },
    async ajouterEvenements(evs) {
      evenements.push(...evs);
    },
    async purger(monteesAvant) {
      for (const [id, m] of montees) if (!m.fin && m.debut < monteesAvant) montees.delete(id);
    },
    async fermer() {},
  };
}

const SCHEMA = `
create table if not exists montees (
  id uuid primary key,
  joueur text not null,
  graine bigint not null,
  debut timestamptz not null,
  fin timestamptz,
  etages int,
  secondes int
);
create index if not exists montees_ouvertes on montees (debut) where fin is null;
create table if not exists records (
  joueur text primary key,
  pseudo text not null,
  etages int not null,
  secondes int not null,
  le timestamptz not null
);
create index if not exists records_classement on records (etages desc, secondes asc, le asc);
create table if not exists evenements (
  id bigserial primary key,
  le timestamptz not null default now(),
  aid text not null,
  sid text not null,
  nom text not null,
  t int not null,
  props jsonb not null,
  ctx text not null
);
create index if not exists evenements_nom_le on evenements (nom, le);
`;

export async function basePostgres(pool: Pool): Promise<Base> {
  await pool.query(SCHEMA);
  const rec = (r: any): Record_ => ({
    joueur: r.joueur,
    pseudo: r.pseudo,
    etages: r.etages,
    secondes: r.secondes,
    le: r.le,
  });
  return {
    async creerMontee(m) {
      await pool.query('insert into montees (id, joueur, graine, debut) values ($1, $2, $3, $4)', [
        m.id,
        m.joueur,
        m.graine,
        m.debut,
      ]);
    },
    async lireMontee(id) {
      const { rows } = await pool.query('select id, joueur, graine, debut, fin from montees where id = $1', [id]);
      const r = rows[0];
      return r ? { id: r.id, joueur: r.joueur, graine: Number(r.graine), debut: r.debut, fin: r.fin } : null;
    },
    async cloreMontee(id, r) {
      const q = await pool.query(
        'update montees set fin = $2, etages = $3, secondes = $4 where id = $1 and fin is null',
        [id, r.fin, r.etages, r.secondes],
      );
      return q.rowCount === 1;
    },
    async lireRecord(joueur) {
      const { rows } = await pool.query('select * from records where joueur = $1', [joueur]);
      return rows[0] ? rec(rows[0]) : null;
    },
    async ecrireRecord(r) {
      await pool.query(
        `insert into records (joueur, pseudo, etages, secondes, le) values ($1, $2, $3, $4, $5)
         on conflict (joueur) do update set pseudo = $2, etages = $3, secondes = $4, le = $5`,
        [r.joueur, r.pseudo, r.etages, r.secondes, r.le],
      );
    },
    async top(n) {
      const { rows } = await pool.query('select * from records order by etages desc, secondes asc, le asc limit $1', [
        n,
      ]);
      return rows.map(rec);
    },
    async rang(joueur) {
      const { rows } = await pool.query(
        `select 1 + count(r.joueur)::int as rang
           from records moi
           left join records r
             on r.etages > moi.etages
             or (r.etages = moi.etages and r.secondes < moi.secondes)
             or (r.etages = moi.etages and r.secondes = moi.secondes and r.le < moi.le)
          where moi.joueur = $1
          group by moi.joueur`,
        [joueur],
      );
      return rows[0] ? rows[0].rang : null;
    },
    async ajouterEvenements(evs) {
      if (!evs.length) return;
      const vals: unknown[] = [],
        lignes = evs.map((e, i) => {
          vals.push(e.aid, e.sid, e.nom, e.t, JSON.stringify(e.props), e.ctx);
          const k = i * 6;
          return `($${k + 1}, $${k + 2}, $${k + 3}, $${k + 4}, $${k + 5}::jsonb, $${k + 6})`;
        });
      await pool.query(`insert into evenements (aid, sid, nom, t, props, ctx) values ${lignes.join(', ')}`, vals);
    },
    async purger(monteesAvant, evenementsAvant) {
      await pool.query('delete from montees where fin is null and debut < $1', [monteesAvant]);
      await pool.query('delete from evenements where le < $1', [evenementsAvant]);
    },
    async fermer() {
      await pool.end();
    },
  };
}
