// Tampon de lecture des instantanés, chez l'invité d'un duel.
// Le serveur envoie un instantané toutes les 33 ms, mais le réseau ne les livre pas toujours à ce rythme : sur un
// réseau d'entreprise, en Wi-Fi ou en 4G, un paquet en retard bloque ceux qui le suivent (TCP), puis tout arrive
// d'un coup. Appliqués dès leur arrivée, ils figeaient les combattants puis les faisaient sauter.
// Ici, on les joue avec un léger retard, à l'horloge du serveur (champ tm, en ms de simulation), et ce retard
// s'adapte : il grandit dès qu'un trou survient, et redescend lentement quand le réseau redevient régulier.
//
//   recevoir(tm, maintenant)   à l'arrivée d'un instantané ; rend false s'il est périmé (déjà dépassé)
//   avancer(dtMs, maintenant)  à chaque image : rend les instantanés à appliquer, dans l'ordre
//   suivant()                  l'instantané qui vient après (pour interpoler les positions), et la fraction
export const RETARD_MIN = 50,
  RETARD_MAX = 400,
  FENETRE_MS = 4000, // période sur laquelle on juge la régularité du réseau
  SAUT_MS = 600; // écart au-delà duquel on se recale d'un coup au lieu de rattraper

interface Arrivee {
  t: number; // heure locale d'arrivée
  ecart: number; // heure locale moins heure du serveur
}

export class Tampon<T> {
  private file: { tm: number; v: T }[] = [];
  private arrivees: Arrivee[] = [];
  private lecture = -1; // heure du serveur jouée à l'écran
  private dernierJoue = -1;
  retard = RETARD_MIN * 2;
  // mesures, pour comprendre un gel après coup
  trous = 0; // instantanés arrivés plus de 250 ms après le précédent
  trouMax = 0;
  private derniereArrivee = -1;

  vider() {
    this.file = [];
    this.arrivees = [];
    this.lecture = this.dernierJoue = this.derniereArrivee = -1;
    this.retard = RETARD_MIN * 2;
  }

  recevoir(tm: number, v: T, maintenant: number): boolean {
    if (this.derniereArrivee >= 0) {
      const d = maintenant - this.derniereArrivee;
      if (d > 250) this.trous++;
      if (d > this.trouMax) this.trouMax = d;
    }
    this.derniereArrivee = maintenant;
    // nouvelle manche, ou serveur reparti de zéro : l'horloge recule, on repart à vide
    if (this.dernierJoue >= 0 && tm < this.dernierJoue - SAUT_MS) {
      this.file = [];
      this.arrivees = [];
      this.lecture = this.dernierJoue = -1;
    }
    if (tm <= this.dernierJoue) return false;
    this.arrivees.push({ t: maintenant, ecart: maintenant - tm });
    while (this.arrivees.length && this.arrivees[0].t < maintenant - FENETRE_MS) this.arrivees.shift();
    let i = this.file.length;
    while (i > 0 && this.file[i - 1].tm > tm) i--;
    this.file.splice(i, 0, { tm, v });
    this.regler();
    return true;
  }

  // Retard voulu : le plus grand retard d'arrivée récent (par rapport à l'instantané le plus rapide), plus une marge
  // d'un intervalle. Il monte tout de suite, et ne baisse que de 2 % par instantané.
  private regler() {
    let min = Infinity;
    for (const a of this.arrivees) if (a.ecart < min) min = a.ecart;
    const tard = this.arrivees.map(a => a.ecart - min).sort((x, y) => x - y);
    const p = tard[Math.floor(0.98 * (tard.length - 1))] || 0;
    const voulu = Math.min(RETARD_MAX, Math.max(RETARD_MIN, p + 40));
    this.retard = voulu > this.retard ? voulu : this.retard + (voulu - this.retard) * 0.02;
  }

  // Heure du serveur qu'on devrait afficher maintenant.
  private cible(maintenant: number) {
    let min = Infinity;
    for (const a of this.arrivees) if (a.ecart < min) min = a.ecart;
    return maintenant - min - this.retard;
  }

  avancer(dtMs: number, maintenant: number): T[] {
    if (!this.file.length && this.lecture < 0) return [];
    const cible = this.cible(maintenant);
    if (this.lecture < 0 || Math.abs(cible - this.lecture) > SAUT_MS) this.lecture = cible;
    // rattrapage en douceur : au plus 10 % plus vite ou plus lentement que le temps réel
    else this.lecture += dtMs + Math.max(-0.1 * dtMs, Math.min(0.1 * dtMs, (cible - this.lecture) * 0.1));
    // au démarrage, montrer tout de suite le premier instantané plutôt qu'un écran vide
    if (this.dernierJoue < 0 && this.file.length && this.file[0].tm > this.lecture) this.lecture = this.file[0].tm;
    const sortis: T[] = [];
    while (this.file.length && this.file[0].tm <= this.lecture) {
      const s = this.file.shift()!;
      this.dernierJoue = s.tm;
      sortis.push(s.v);
    }
    return sortis;
  }

  // Instantané suivant et fraction du chemin parcouru depuis le dernier joué (0 à 1), pour interpoler.
  suivant(): { v: T; k: number } | null {
    const s = this.file[0];
    if (!s || this.dernierJoue < 0) return null;
    const k = (this.lecture - this.dernierJoue) / (s.tm - this.dernierJoue);
    return { v: s.v, k: Math.max(0, Math.min(1, k)) };
  }
}
