// Fonctions mathématiques reproductibles de la simulation (src/sim/dmath.ts).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import * as DM from '../src/sim/dmath';

const proche = (a: number, b: number, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('dmath', () => {
  it('sin et cos collent à Math sur une large plage', () => {
    for (let x = -50; x <= 50; x += 0.0137) {
      proche(DM.sin(x), Math.sin(x));
      proche(DM.cos(x), Math.cos(x));
    }
    expect(DM.sin(0)).toBe(0);
    proche(DM.cos(0), 1);
  });
  it('atan2 colle à Math dans les quatre quadrants et sur les axes', () => {
    for (let a = -Math.PI; a <= Math.PI; a += 0.0071)
      for (const r of [1e-6, 0.3, 1, 57, 1e5]) proche(DM.atan2(Math.sin(a) * r, Math.cos(a) * r), a, 1e-11);
    for (const [y, x] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [3, 3],
      [-2, 5],
    ])
      proche(DM.atan2(y, x), Math.atan2(y, x));
    expect(DM.atan2(0, 0)).toBe(0);
  });
  it('exp colle à Math (erreur relative)', () => {
    for (let x = -30; x <= 30; x += 0.0173) expect(Math.abs(DM.exp(x) / Math.exp(x) - 1)).toBeLessThan(1e-13);
    expect(DM.exp(0)).toBe(1);
  });
  it('hypot', () => {
    expect(DM.hypot(3, 4)).toBe(5);
    proche(DM.hypot(-1.5, 2.25), Math.hypot(-1.5, 2.25));
  });
  it('la simulation n’appelle jamais directement les fonctions de Math qui varient selon le navigateur', () => {
    const interdit = /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log\w*|pow|hypot|cbrt|sinh|cosh|tanh)\b|\*\*/;
    for (const f of readdirSync('src/sim')) {
      if (f === 'dmath.ts') continue;
      const code = readFileSync('src/sim/' + f, 'utf8')
        .split('\n')
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'));
      const fautes = code.filter(l => interdit.test(l.replace(/\/\/.*$/, '')));
      expect(fautes, f).toEqual([]);
    }
  });
});
