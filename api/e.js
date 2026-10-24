// Réception des mesures de jeu (Vercel Function). Aucune donnée personnelle : un identifiant anonyme et des compteurs.
// Chaque événement est écrit en une ligne JSON dans les journaux Vercel (Runtime Logs), filtrable avec k:"kata_e".
// Pour garder les données plus longtemps, brancher un puits de journaux Vercel (Log Drain) ou remplacer le console.log
// par un envoi vers une base (Vercel KV, PostHog, Supabase…).
export default function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const list = body && Array.isArray(body.e) ? body.e.slice(0, 40) : [];
  const meta = body && typeof body.m === 'object' && body.m ? body.m : {};
  for (const ev of list) {
    if (!ev || typeof ev.n !== 'string' || ev.n.length > 40) continue;
    console.log(JSON.stringify({ k: 'kata_e', n: ev.n, t: ev.t, p: ev.p || {}, a: String(meta.a || '').slice(0, 24), s: String(meta.s || '').slice(0, 24), v: meta.v, c: meta.c }));
  }
  res.status(204).end();
}
