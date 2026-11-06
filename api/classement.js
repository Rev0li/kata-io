// Classement de la montée de la Tour (Vercel Function). Données gardées dans Redis (Upstash, via la place de marché
// Vercel) : variables KV_REST_API_URL et KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN).
//   GET  /api/classement?id=…  le top 20 et la ligne du joueur
//   POST /api/classement       { id, pseudo, etages, secondes } : garde la meilleure montée de cet identifiant
// Pas de compte : l'identifiant est le jeton anonyme du navigateur. Le combat tourne chez le joueur, donc un tricheur
// peut envoyer un faux score : on refuse seulement l'impossible (trop vite, trop haut) et on nettoie à la main.
const TOP = 20;
const K_TOP = 'kata:top'; // ensemble trié : identifiant -> note (étages, puis temps le plus court)
const K_RUNS = 'kata:runs'; // table : identifiant -> { pseudo, etages, secondes, le }
const MIN_S_PAR_ETAGE = 8; // un étage ne se gagne pas en moins de 8 s (deux manches à gagner, au moins)
const MAX_S_PAR_ETAGE = 1800;
const MAX_ETAGES = 500;

const note = (etages, secondes) => etages * 1e6 - Math.min(secondes, 999999);

// Vercel peut préfixer les variables de la base (ex. STORAGE_KV_REST_API_URL) : on accepte n'importe quel préfixe.
const finir = (env, fins) => {
  const k = Object.keys(env)
    .filter(n => fins.some(f => n.endsWith(f)) && !n.includes('READ_ONLY') && env[n])
    .sort((a, b) => a.length - b.length)[0];
  return k ? env[k] : '';
};
// Noms (jamais les valeurs) des variables qui ressemblent à une base, pour comprendre un classement fermé.
export const variablesBase = (env = process.env) =>
  Object.keys(env)
    .filter(n => /KV|REDIS|UPSTASH/.test(n))
    .sort();

export function redisDepuisEnv(env = process.env) {
  const url = finir(env, ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
  const token = finir(env, ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
  if (!url || !token) return null;
  // Plusieurs commandes en un aller-retour (API REST d'Upstash, /pipeline).
  return async cmds => {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) throw new Error('redis ' + r.status);
    const out = await r.json();
    return out.map(o => {
      if (o.error) throw new Error(o.error);
      return o.result;
    });
  };
}

export function nettoyerPseudo(v) {
  if (typeof v !== 'string') return '';
  return v
    .normalize('NFC')
    .replace(/[\p{C}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}
const idValide = id => typeof id === 'string' && /^[a-z0-9]{4,24}$/.test(id);

async function lire(redis, id) {
  const [ids, rang] = await redis([
    ['ZREVRANGE', K_TOP, '0', String(TOP - 1)],
    idValide(id) ? ['ZREVRANK', K_TOP, id] : ['PING'],
  ]);
  const tous = idValide(id) && typeof rang === 'number' && rang >= TOP ? [...ids, id] : ids;
  const runs = tous.length ? (await redis([['HMGET', K_RUNS, ...tous]]))[0] : [];
  const lignes = tous.map((k, i) => {
    let r = {};
    try {
      r = JSON.parse(runs[i] || '{}');
    } catch {
      /* ligne abîmée */
    }
    return {
      rang: i < ids.length ? i + 1 : rang + 1,
      pseudo: r.pseudo || '?',
      etages: r.etages || 0,
      secondes: r.secondes || 0,
      ...(k === id ? { moi: true } : {}),
    };
  });
  return { top: lignes.slice(0, ids.length), moi: lignes.find(l => l.moi) || null };
}

export async function traiter(req, redis) {
  if (!redis) return [503, { erreur: 'Le classement n’est pas encore ouvert.', variables: variablesBase() }];
  if (req.method === 'GET') return [200, await lire(redis, req.query && req.query.id)];
  if (req.method !== 'POST') return [405, { erreur: 'Méthode non prise en charge.' }];
  let b = req.body;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b);
    } catch {
      b = null;
    }
  }
  if (!b || typeof b !== 'object') return [400, { erreur: 'Requête invalide.' }];
  const id = b.id,
    pseudo = nettoyerPseudo(b.pseudo),
    etages = b.etages,
    secondes = b.secondes;
  if (!idValide(id)) return [400, { erreur: 'Identifiant invalide.' }];
  if (pseudo.length < 2) return [400, { erreur: 'Choisis un pseudo d’au moins 2 caractères.' }];
  if (!Number.isInteger(etages) || etages < 1 || etages > MAX_ETAGES) return [400, { erreur: 'Montée invalide.' }];
  if (!Number.isInteger(secondes) || secondes < etages * MIN_S_PAR_ETAGE || secondes > etages * MAX_S_PAR_ETAGE)
    return [400, { erreur: 'Montée invalide.' }];
  // un envoi toutes les 5 secondes au plus par identifiant
  const [libre, avant] = await redis([
    ['SET', 'kata:envoi:' + id, '1', 'NX', 'EX', '5'],
    ['HGET', K_RUNS, id],
  ]);
  if (libre !== 'OK') return [429, { erreur: 'Doucement : réessaie dans quelques secondes.' }];
  let ancien = null;
  try {
    ancien = avant ? JSON.parse(avant) : null;
  } catch {
    ancien = null;
  }
  const mieux = !ancien || note(etages, secondes) > note(ancien.etages || 0, ancien.secondes || 0);
  const run = mieux ? { pseudo, etages, secondes, le: new Date().toISOString() } : { ...ancien, pseudo }; // le pseudo suit toujours le dernier choisi
  await redis([
    ['HSET', K_RUNS, id, JSON.stringify(run)],
    ['ZADD', K_TOP, String(note(run.etages, run.secondes)), id],
  ]);
  return [200, { ...(await lire(redis, id)), record: mieux }];
}

export default async function handler(req, res) {
  try {
    const [status, body] = await traiter(req, redisDepuisEnv());
    res.setHeader('cache-control', 'no-store');
    res.status(status).json(body);
  } catch (e) {
    console.error('classement', e);
    res.status(500).json({ erreur: 'Classement indisponible pour l’instant.' });
  }
}
