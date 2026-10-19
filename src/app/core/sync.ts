import { LevelRecord, Stars, Streak } from './xp';

/** Část postupu, která se synchronizuje (rozpracované programy zůstávají jen v zařízení). */
export interface ProgressSnapshot {
  records: Record<string, LevelRecord>;
  streak: Streak;
}

/** Sloučení dvou záznamů téže úlohy; nic se nezhorší, nápověda a „ne napoprvé“ se nezapomenou. */
export function mergeLevelRecords(a: LevelRecord, b: LevelRecord): LevelRecord {
  return {
    stars: a.stars.map((star, i) => star || (b.stars[i] ?? false)) as Stars,
    bestMatch: Math.max(a.bestMatch, b.bestMatch),
    perfect: a.perfect || b.perfect,
    hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
    firstTry: a.firstTry && b.firstTry,
  };
}

/** Platí série s pozdějším dnem; nejlepší série je maximum. */
export function mergeStreaks(a: Streak, b: Streak): Streak {
  const best = Math.max(a.best, b.best);
  if (a.lastDay === b.lastDay) {
    return { days: Math.max(a.days, b.days), lastDay: a.lastDay, best };
  }
  if (a.lastDay === null) {
    return { ...b, best };
  }
  if (b.lastDay === null) {
    return { ...a, best };
  }
  return { ...(a.lastDay > b.lastDay ? a : b), best };
}

export function mergeSnapshots(local: ProgressSnapshot, remote: ProgressSnapshot): ProgressSnapshot {
  const records: Record<string, LevelRecord> = { ...remote.records };
  for (const [id, record] of Object.entries(local.records)) {
    const other = records[id];
    records[id] = other ? mergeLevelRecords(record, other) : record;
  }
  return { records, streak: mergeStreaks(local.streak, remote.streak) };
}

export interface SnapshotDiff {
  levels: string[];
  streak: boolean;
}

function sameRecord(a: LevelRecord, b: LevelRecord): boolean {
  return (
    a.bestMatch === b.bestMatch &&
    a.perfect === b.perfect &&
    a.hintsUsed === b.hintsUsed &&
    a.firstTry === b.firstTry &&
    a.stars.every((star, i) => star === b.stars[i])
  );
}

/** Co se má zapsat, aby cloud odpovídal `next`. */
export function diffSnapshots(previous: ProgressSnapshot, next: ProgressSnapshot): SnapshotDiff {
  const levels = Object.entries(next.records)
    .filter(([id, record]) => {
      const before = previous.records[id];
      return !before || !sameRecord(before, record);
    })
    .map(([id]) => id);
  const streak =
    previous.streak.days !== next.streak.days ||
    previous.streak.lastDay !== next.streak.lastDay ||
    previous.streak.best !== next.streak.best;
  return { levels, streak };
}
