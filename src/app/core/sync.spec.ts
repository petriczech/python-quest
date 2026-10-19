import { ProgressSnapshot, diffSnapshots, mergeSnapshots, mergeStreaks } from './sync';
import { LevelRecord } from './xp';

const record = (overrides: Partial<LevelRecord> = {}): LevelRecord => ({
  stars: [true, false, false],
  bestMatch: 98,
  perfect: false,
  hintsUsed: 0,
  firstTry: true,
  ...overrides,
});

const empty: ProgressSnapshot = { records: {}, streak: { days: 0, lastDay: null, best: 0 } };

describe('mergeSnapshots', () => {
  it('sloučí úlohy z obou zařízení bez zhoršení', () => {
    const merged = mergeSnapshots(
      { ...empty, records: { '1-1': record(), '1-2': record() } },
      {
        ...empty,
        records: {
          '1-1': record({ stars: [true, true, false], bestMatch: 100, perfect: true, firstTry: false }),
          '1-3': record({ hintsUsed: 2 }),
        },
      },
    );
    expect(merged.records).toEqual({
      '1-1': record({ stars: [true, true, false], bestMatch: 100, perfect: true, firstTry: false, code: false }),
      '1-2': record(),
      '1-3': record({ hintsUsed: 2 }),
    });
  });

  it('série s pozdějším dnem vyhraje, nejlepší je maximum', () => {
    expect(
      mergeStreaks(
        { days: 9, lastDay: '2026-10-10', best: 9 },
        { days: 2, lastDay: '2026-10-18', best: 4 },
      ),
    ).toEqual({ days: 2, lastDay: '2026-10-18', best: 9 });
  });

  it('stejný den vezme delší sérii', () => {
    expect(
      mergeStreaks({ days: 3, lastDay: '2026-10-18', best: 3 }, { days: 5, lastDay: '2026-10-18', best: 5 }),
    ).toEqual({ days: 5, lastDay: '2026-10-18', best: 5 });
  });

  it('prázdná série se přepíše druhou', () => {
    expect(mergeStreaks(empty.streak, { days: 1, lastDay: '2026-10-18', best: 1 })).toEqual({
      days: 1,
      lastDay: '2026-10-18',
      best: 1,
    });
  });
});

describe('diffSnapshots', () => {
  it('najde nové a změněné úlohy a změnu série', () => {
    const previous = { ...empty, records: { '1-1': record(), '1-2': record() } };
    const next: ProgressSnapshot = {
      records: { '1-1': record(), '1-2': record({ bestMatch: 99 }), '1-3': record() },
      streak: { days: 1, lastDay: '2026-10-18', best: 1 },
    };
    expect(diffSnapshots(previous, next)).toEqual({ levels: ['1-2', '1-3'], streak: true });
  });

  it('beze změny nic nezapisuje', () => {
    expect(diffSnapshots(empty, empty)).toEqual({ levels: [], streak: false });
  });
});
