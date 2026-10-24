// Explications affichées seulement les premières fois (mémorisées dans le navigateur), pour ne pas harceler un joueur qui a compris.
const KEY = 'kata.hints';
function read(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}
// Compte une nouvelle occurrence et renvoie le total (1 à la première fois).
export function bumpHint(name: string): number {
  const h = read();
  h[name] = (h[name] || 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* stockage indisponible */
  }
  return h[name];
}
