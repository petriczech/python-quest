import { findLevel } from '../levels/levels';
import { Level } from './level';
import {
  bumpStreak,
  currentStreak,
  evaluateStars,
  levelXp,
  mergeRecord,
  playerLevel,
  totalXp,
} from './xp';

const triangle = findLevel('2-2') as Level;

describe('evaluateStars', () => {
  it('reference dá 3 hvězdy', () => {
    expect(evaluateStars(triangle, triangle.reference, 100)).toEqual([true, true, true]);
  });

  it('bez opakuj jen 1. hvězda', () => {
    const flat = [
      { kind: 'forward', value: 150 },
      { kind: 'left', angle: 120 },
      { kind: 'forward', value: 150 },
      { kind: 'left', angle: 120 },
      { kind: 'forward', value: 150 },
    ] as const;
    expect(evaluateStars(triangle, [...flat], 100)).toEqual([true, false, false]);
  });

  it('pod prahem žádná hvězda', () => {
    expect(evaluateStars(triangle, triangle.reference, 97.9)).toEqual([false, false, false]);
  });
});

describe('XP', () => {
  it('hvězdy, bonus za 100 % a srážka za nápovědu', () => {
    expect(levelXp({ stars: [true, true, true], bestMatch: 100, perfect: true, hintsUsed: 1, firstTry: true })).toBe(60);
  });

  it('XP za úlohu nejde pod 0', () => {
    expect(levelXp({ stars: [false, false, false], bestMatch: 0, perfect: false, hintsUsed: 2, firstTry: false })).toBe(0);
  });

  it('součet přes úlohy', () => {
    expect(
      totalXp({
        a: { stars: [true, false, false], bestMatch: 98, perfect: false, hintsUsed: 0, firstTry: true },
        b: { stars: [true, true, false], bestMatch: 99, perfect: false, hintsUsed: 0, firstTry: false },
      }),
    ).toBe(60);
  });

  it('opakování úlohy hvězdy nezhorší', () => {
    const merged = mergeRecord(
      { stars: [true, true, false], bestMatch: 100, perfect: true, hintsUsed: 0, firstTry: false },
      { stars: [true, false, true], percent: 99, hintsUsed: 1 },
    );
    expect(merged).toEqual({
      stars: [true, true, true],
      bestMatch: 100,
      perfect: true,
      hintsUsed: 1,
      firstTry: false,
    });
  });
});

describe('playerLevel', () => {
  it.each([
    [0, 1, 0, 200],
    [199, 1, 0, 200],
    [200, 2, 200, 450],
    [450, 3, 450, 750],
    [760, 4, 750, 1100],
  ])('%i XP → úroveň %i', (xp, level, from, to) => {
    expect(playerLevel(xp)).toEqual({ level, from, to });
  });
});

describe('série', () => {
  it('navazující den prodlouží sérii', () => {
    expect(bumpStreak({ days: 3, lastDay: '2026-10-17', best: 3 }, '2026-10-18')).toEqual({
      days: 4,
      lastDay: '2026-10-18',
      best: 4,
    });
  });

  it('nejdelší série zůstane i po přerušení', () => {
    expect(bumpStreak({ days: 9, lastDay: '2026-10-01', best: 9 }, '2026-10-18')).toEqual({
      days: 1,
      lastDay: '2026-10-18',
      best: 9,
    });
  });

  it('přes přelom měsíce', () => {
    expect(bumpStreak({ days: 1, lastDay: '2026-09-30', best: 4 }, '2026-10-01').days).toBe(2);
  });

  it('vynechaný den začne znovu', () => {
    expect(bumpStreak({ days: 5, lastDay: '2026-10-15', best: 5 }, '2026-10-18').days).toBe(1);
    expect(currentStreak({ days: 5, lastDay: '2026-10-15', best: 5 }, '2026-10-18')).toBe(0);
  });

  it('stejný den se nezapočítá dvakrát', () => {
    expect(bumpStreak({ days: 2, lastDay: '2026-10-18', best: 2 }, '2026-10-18').days).toBe(2);
  });
});
