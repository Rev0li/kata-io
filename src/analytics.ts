// Mesures de jeu anonymes : où les joueurs quittent, combien relancent une revanche, l'anti-spam se déclenche-t-il trop ?
// Rien de personnel : un identifiant aléatoire stocké dans le navigateur et des compteurs de partie.
// Envoi groupé vers /api/e (ou VITE_ANALYTICS_URL). Désactivé en local et si le navigateur demande « ne pas suivre ».
type Props = Record<string, string | number | boolean | null>;
interface Ev { n: string; t: number; p: Props }

const AID_KEY = 'kata.aid';
const endpoint: string = (import.meta.env.VITE_ANALYTICS_URL as string) || '/api/e';
const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
const dnt = navigator.doNotTrack === '1';
const enabled = !dnt && (!local || new URLSearchParams(location.search).has('analytics'));
const sid = Math.random().toString(36).slice(2, 10);
const t0 = performance.now();
let queue: Ev[] = [];
const counts: Record<string, number> = {}; // compteurs de la session, visibles avec ?debug : window.__kata.stats

function aid(): string {
  try { let a = localStorage.getItem(AID_KEY); if (!a) { a = Math.random().toString(36).slice(2, 14); localStorage.setItem(AID_KEY, a); } return a; } catch { return 'anon'; }
}
const ctx = { c: matchMedia('(pointer: coarse)').matches ? 'touch' : 'desk', v: `${innerWidth}x${innerHeight}` };

export function track(n: string, p: Props = {}) {
  counts[n] = (counts[n] || 0) + 1;
  if (!enabled) return;
  queue.push({ n, t: Math.round(performance.now() - t0), p });
  if (queue.length >= 20) flush();
}
export function flush() {
  if (!enabled || !queue.length) return;
  const body = JSON.stringify({ m: { a: aid(), s: sid, ...ctx }, e: queue.splice(0, 40) });
  try { if (!(navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })))) fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {}); } catch { /* perdu : sans importance */ }
}
export const stats = () => ({ ...counts });

export function initAnalytics() {
  track('page_view', { ref: document.referrer ? new URL(document.referrer).hostname : '', salle: new URLSearchParams(location.search).has('salle') });
  setInterval(flush, 8000);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('error', e => track('error', { msg: String(e.message).slice(0, 120) }));
  addEventListener('unhandledrejection', e => track('error', { msg: String((e.reason && e.reason.message) || e.reason).slice(0, 120) }));
}
