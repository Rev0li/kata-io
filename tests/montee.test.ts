import { describe, it, expect } from 'vitest';
import { montee, nouvelleMontee, finEtage, coeurs, VIES } from '../src/ui/montee';

describe('montée de la Tour : trois vies', () => {
  it('part de zéro avec toutes ses vies', () => {
    nouvelleMontee();
    expect(montee).toMatchObject({ etages: 0, secondes: 0, vies: VIES });
    expect(coeurs()).toBe('♥♥♥');
  });
  it('un étage gagné fait monter sans coûter de vie', () => {
    nouvelleMontee();
    expect(finEtage(true, 1, 15)).toBe('monte');
    expect(montee).toMatchObject({ etages: 1, secondes: 15, vies: VIES });
  });
  it('une défaite coûte une vie et du temps, et on retente le même étage', () => {
    nouvelleMontee();
    finEtage(true, 1, 15);
    expect(finEtage(false, 2, 20)).toBe('rejoue');
    expect(montee).toMatchObject({ etages: 1, secondes: 35, vies: VIES - 1 });
    expect(coeurs()).toBe('♥♥♡');
    expect(finEtage(true, 2, 10)).toBe('monte');
    expect(montee.etages).toBe(2);
  });
  it('la dernière vie perdue termine la montée', () => {
    nouvelleMontee();
    expect(finEtage(false, 1, 5)).toBe('rejoue');
    expect(finEtage(false, 1, 5)).toBe('rejoue');
    expect(finEtage(false, 1, 5)).toBe('fin');
    expect(montee).toMatchObject({ etages: 0, secondes: 15, vies: 0 });
    expect(coeurs()).toBe('♡♡♡');
  });
  it('une nouvelle montée rend les vies', () => {
    nouvelleMontee();
    finEtage(false, 1, 5);
    nouvelleMontee();
    expect(montee.vies).toBe(VIES);
  });
});

describe('montée classée : combats enregistrés', () => {
  const ticket = { montee: 'm', graine: 1 },
    combat = { n: 1, perso: 'sumo', quick: false, e: '' };
  it('garde les combats dans l’ordre tant que chacun est enregistré', () => {
    nouvelleMontee(ticket);
    finEtage(true, 1, 10, combat);
    finEtage(false, 2, 10, { ...combat, n: 2 });
    expect(montee.ticket).toEqual(ticket);
    expect(montee.combats.map(c => c.n)).toEqual([1, 2]);
  });
  it('un combat sans enregistrement rend la montée non classée', () => {
    nouvelleMontee(ticket);
    finEtage(true, 1, 10, null);
    expect(montee.ticket).toBeNull();
  });
  it('sans ticket, rien n’est gardé', () => {
    nouvelleMontee();
    finEtage(true, 1, 10, combat);
    expect(montee.combats).toEqual([]);
  });
});
