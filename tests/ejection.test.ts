// Caméra d'éjection (src/game/ejection.ts) : suit la victime, garde l'auteur du coup, recule si c'est loin, s'arrête.
import { describe, it, expect } from 'vitest';
import { SuiviEjection, PAUSE_MS } from '../src/game/ejection';

const etat = (vx: number, vy: number, state = 'falling') => ({
  f: [
    { x: 0, y: 0, state: 'idle' },
    { x: vx, y: vy, state, z: 0 },
  ],
});

describe('caméra d’éjection', () => {
  it('suit la victime, garde l’auteur du coup et recule quand le vol part loin', () => {
    const c = new SuiviEjection();
    c.evenement({ t: 'ko', to: 1, by: 0, pct: 40 });
    const pres = c.cadre(etat(300, 0), 16, 1000, 640)!;
    const loin = c.cadre(etat(900, 0), 16, 1000, 640)!;
    expect(pres.x).toBeGreaterThan(0); // tiré vers la victime
    expect(loin.zoomMax).toBeLessThan(pres.zoomMax);
    expect(loin.loin).toBe(true);
  });
  it('marque un temps sur le point de chute puis rend la main', () => {
    const c = new SuiviEjection();
    c.evenement({ t: 'ko', to: 1, by: 0, pct: 40 });
    c.cadre(etat(300, 0), 16, 1000, 640);
    expect(c.evenement({ t: 'splash', x: 320, y: 0 })).toBe(false); // vol court : pas de secousse
    expect(c.cadre(etat(320, 0, 'dead'), PAUSE_MS / 2, 1000, 640)).not.toBeNull();
    expect(c.cadre(etat(320, 0, 'dead'), PAUSE_MS, 1000, 640)).toBeNull();
  });
  it('s’arrête dès que le combattant revient (nouvelle manche)', () => {
    const c = new SuiviEjection();
    c.evenement({ t: 'ko', to: 1, by: 0, pct: 200 });
    expect(c.cadre(etat(0, 0, 'idle'), 16, 1000, 640)).toBeNull();
  });
});
