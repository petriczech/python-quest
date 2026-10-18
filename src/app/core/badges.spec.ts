import { LEVELS } from '../levels/levels';
import { earnedBadges } from './badges';
import { LevelRecord } from './xp';

const solved = (overrides: Partial<LevelRecord> = {}): LevelRecord => ({
  stars: [true, true, true],
  bestMatch: 100,
  perfect: true,
  hintsUsed: 0,
  firstTry: true,
  ...overrides,
});

describe('earnedBadges', () => {
  it('bez postupu žádný odznak', () => {
    expect(earnedBadges({}, { best: 0 }, LEVELS).size).toBe(0);
  });

  it('první splněná úloha', () => {
    expect(earnedBadges({ '1-1': solved({ perfect: false }) }, { best: 1 }, LEVELS)).toEqual(
      new Set(['first-step']),
    );
  });

  it('celý svět 2 splněný napoprvé a bez nápovědy', () => {
    const records = Object.fromEntries(
      LEVELS.filter((l) => l.world === 2).map((l) => [l.id, solved()]),
    );
    const badges = earnedBadges(records, { best: 7 }, LEVELS);
    expect([...badges].sort()).toEqual(
      ['angle-master', 'first-step', 'hundred', 'looper', 'no-hints', 'streak-7'].sort(),
    );
  });

  it('nápověda v jedné úloze světa odznak nedá', () => {
    const records = Object.fromEntries(
      LEVELS.filter((l) => l.world === 1).map((l) => [l.id, solved()]),
    );
    records['1-5'] = solved({ hintsUsed: 1 });
    expect(earnedBadges(records, { best: 0 }, LEVELS).has('no-hints')).toBe(false);
  });

  it('úhly ne napoprvé se nepočítají', () => {
    const records = Object.fromEntries(
      ['2-2', '2-3', '2-4', '2-5', '2-6'].map((id) => [id, solved({ firstTry: false })]),
    );
    expect(earnedBadges(records, { best: 0 }, LEVELS).has('angle-master')).toBe(false);
  });
});
