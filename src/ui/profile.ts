// Profil du joueur, gardé dans le navigateur : nom, apparence, XP, étages, pièces, effets achetés, réglages.
// Aucun accès au DOM ici : les écrans relisent le profil pour s'afficher.
import { PERSOS, ARMES, TRAINEES, EJECTIONS, DEFAULT_LOOK, sanitizeLook, Look } from '../sim/data';
import { rankIndex, abilFor, Abil, dayKey } from '../sim/progression';

const PROFILE_KEY = 'kata-io-dev-profile';

export interface Profile {
  name: string;
  look: Look;
  level: number;
  sfx: boolean;
  music: boolean;
  xp: number;
  towerMax: number;
  stars: Record<string, number>;
  tutoDone: boolean;
  coins: number;
  owned: string[];
  streak: number;
  autoAim: boolean;
  tries: Record<string, number>;
  daily: { day: string; best: number; won: boolean; tries: number };
}
function loadProfile(): Profile {
  let p: any = null;
  try {
    p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch (e) {
    /* stockage indisponible */
  }
  p = p && typeof p === 'object' ? p : {};
  return {
    name: typeof p.name === 'string' ? p.name.slice(0, 16) : '',
    look: sanitizeLook(p.look),
    level: [0, 1, 2].includes(p.level) ? p.level : 1,
    sfx: p.sfx !== false,
    music: p.music !== false,
    xp: Number.isFinite(p.xp) && p.xp >= 0 ? p.xp : 0,
    towerMax: Number.isFinite(p.towerMax) && p.towerMax >= 1 ? Math.floor(p.towerMax) : 1,
    stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
    tutoDone: !!p.tutoDone,
    coins: Number.isFinite(p.coins) && p.coins >= 0 ? Math.floor(p.coins) : 0,
    owned: Array.isArray(p.owned) ? p.owned.filter((x: any) => typeof x === 'string') : [],
    streak: Number.isFinite(p.streak) && p.streak >= 0 ? Math.floor(p.streak) : 0,
    autoAim: p.autoAim !== false,
    tries: p.tries && typeof p.tries === 'object' ? p.tries : {},
    daily:
      p.daily && typeof p.daily === 'object' && typeof p.daily.day === 'string'
        ? { day: p.daily.day, best: +p.daily.best || 0, won: !!p.daily.won, tries: +p.daily.tries || 0 }
        : { day: '', best: 0, won: false, tries: 0 },
  };
}
export const profile = loadProfile();
export function save() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    /* rien */
  }
}

/* ---------- ceinture et XP ---------- */
export const myRank = () => rankIndex(profile.xp);
export const myAbil = (): Abil => abilFor(myRank());
// Ajoute de l'XP et renvoie la ceinture gagnée, s'il y en a une.
export function addXp(n: number) {
  const before = myRank();
  profile.xp += n;
  save();
  const after = myRank();
  return after > before ? after : -1;
}
export function addCoins(n: number) {
  profile.coins += n;
  save();
}

/* ---------- apparence : personnages gagnés dans la Tour, armes gagnées avec les ceintures, effets achetés ---------- */
export const PK = Object.keys(PERSOS),
  AK = Object.keys(ARMES);
export const persoOpen = (id: string) => PERSOS[id].floor === 0 || profile.towerMax > PERSOS[id].floor;
export const armeOpen = (id: string) => myRank() >= ARMES[id].rank;
export type ShopKind = 'trainee' | 'ejection';
export const CATALOG = { trainee: TRAINEES, ejection: EJECTIONS } as Record<
  ShopKind,
  Record<string, { name: string; price: number; icon: [string, number, number] }>
>;
export function owns(kind: ShopKind, id: string) {
  const it = CATALOG[kind][id];
  return !!it && (it.price === 0 || profile.owned.includes(kind + ':' + id));
}
// Le look réellement utilisé : si un choix n'est plus débloqué (remise à zéro), on revient au défaut.
export function myLook(): Look {
  const l = profile.look;
  return {
    ...l,
    perso: persoOpen(l.perso) ? l.perso : DEFAULT_LOOK.perso,
    arme: armeOpen(l.arme) ? l.arme : DEFAULT_LOOK.arme,
    trainee: owns('trainee', l.trainee) ? l.trainee : 'aucune',
    ejection: owns('ejection', l.ejection) ? l.ejection : 'plouf',
  };
}

/* ---------- Tour et défi du jour ---------- */
export function nextFloor() {
  return Math.max(1, profile.towerMax);
}
// Nouveau jour : le défi du jour repart à zéro.
export function rollDaily() {
  const k = dayKey();
  if (profile.daily.day !== k) {
    profile.daily = { day: k, best: 0, won: false, tries: 0 };
    save();
  }
}
