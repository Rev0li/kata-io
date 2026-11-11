import { describe, it, expect } from 'vitest';
import { montee, nouvelleMontee, finEtage, coeurs, VIES } from '../src/ui/montee';

describe('montée de la Tour : trois vies', () => {
  it('part de zéro avec toutes ses vies', () => {
    nouvelleMontee();
    expect(montee).toEqual({ etages: 0, secondes: 0, vies: VIES });
    expect(coeurs()).toBe('♥♥♥');
  });
  it('un étage gagné fait monter sans coûter de vie', () => {
    nouvelleMontee();
    expect(finEtage(true, 1, 15)).toBe('monte');
    expect(montee).toEqual({ etages: 1, secondes: 15, vies: VIES });
  });
  it('une défaite coûte une vie et du temps, et on retente le même étage', () => {
    nouvelleMontee();
    finEtage(true, 1, 15);
    expect(finEtage(false, 2, 20)).toBe('rejoue');
    expect(montee).toEqual({ etages: 1, secondes: 35, vies: VIES - 1 });
    expect(coeurs()).toBe('♥♥♡');
    expect(finEtage(true, 2, 10)).toBe('monte');
    expect(montee.etages).toBe(2);
  });
  it('la dernière vie perdue termine la montée', () => {
    nouvelleMontee();
    expect(finEtage(false, 1, 5)).toBe('rejoue');
    expect(finEtage(false, 1, 5)).toBe('rejoue');
    expect(finEtage(false, 1, 5)).toBe('fin');
    expect(montee).toEqual({ etages: 0, secondes: 15, vies: 0 });
    expect(coeurs()).toBe('♡♡♡');
  });
  it('une nouvelle montée rend les vies', () => {
    nouvelleMontee();
    finEtage(false, 1, 5);
    nouvelleMontee();
    expect(montee.vies).toBe(VIES);
  });
});
