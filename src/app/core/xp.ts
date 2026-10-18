import { Level } from './level';
import { Command, countBlocks, usedKinds } from './program';
import { PASS_PERCENT } from './score';

export type Stars = [boolean, boolean, boolean];

/** Záznam postupu jedné úlohy; XP se z něj odvozuje. */
export interface LevelRecord {
  stars: Stars;
  bestMatch: number;
  perfect: boolean;
  /** Nejvyšší použitý stupeň nápovědy */
  hintsUsed: number;
  /** Splněno hned prvním spuštěním */
  firstTry: boolean;
}

export const XP_PER_STAR = 20;
export const XP_PERFECT = 10;
export const XP_PER_HINT = 10;

export function evaluateStars(level: Level, program: readonly Command[], percent: number): Stars {
  const solved = percent >= PASS_PERCENT;
  const kinds = usedKinds(program);
  const structure = (level.stars.requires ?? []).every((kind) => kinds.has(kind));
  const economy = level.stars.maxBlocks === undefined || countBlocks(program) <= level.stars.maxBlocks;
  return [solved, solved && structure, solved && economy];
}

export function starCount(stars: Stars): number {
  return stars.filter(Boolean).length;
}

export function levelXp(record: LevelRecord): number {
  const earned = starCount(record.stars) * XP_PER_STAR + (record.perfect ? XP_PERFECT : 0);
  return Math.max(0, earned - record.hintsUsed * XP_PER_HINT);
}

export function totalXp(records: Record<string, LevelRecord>): number {
  return Object.values(records).reduce((sum, record) => sum + levelXp(record), 0);
}

/** Sloučí nový pokus do záznamu; hvězdy ani shoda se nikdy nezhorší. */
export function mergeRecord(
  previous: LevelRecord | undefined,
  attempt: { stars: Stars; percent: number; hintsUsed: number },
): LevelRecord {
  const stars = attempt.stars.map((star, i) => star || (previous?.stars[i] ?? false)) as Stars;
  return {
    stars,
    bestMatch: Math.max(previous?.bestMatch ?? 0, attempt.percent),
    perfect: (previous?.perfect ?? false) || attempt.percent >= 100,
    hintsUsed: Math.max(previous?.hintsUsed ?? 0, attempt.hintsUsed),
    firstTry: previous ? previous.firstTry : attempt.stars[0],
  };
}

export interface PlayerLevel {
  level: number;
  /** XP na začátku této úrovně */
  from: number;
  /** XP potřebné na další úroveň */
  to: number;
}

/** Úrovně 0, 200, 450, 750, …: každý další krok o 50 větší. */
export function playerLevel(xp: number): PlayerLevel {
  let level = 1;
  let from = 0;
  let step = 200;
  while (xp >= from + step) {
    from += step;
    step += 50;
    level++;
  }
  return { level, from, to: from + step };
}

export interface Streak {
  days: number;
  /** Poslední den se splněnou úlohou, `YYYY-MM-DD` */
  lastDay: string | null;
  /** Nejdelší dosažená série */
  best: number;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** Série po splnění úlohy v den `today`. */
export function bumpStreak(streak: Streak, today: string): Streak {
  if (streak.lastDay === today) {
    return streak;
  }
  const continues = streak.lastDay !== null && dayNumber(today) - dayNumber(streak.lastDay) === 1;
  const days = continues ? streak.days + 1 : 1;
  return { days, lastDay: today, best: Math.max(streak.best, days) };
}

/** Série platná k danému dni (vynechaný den ji nuluje). */
export function currentStreak(streak: Streak, today: string): number {
  if (streak.lastDay === null) {
    return 0;
  }
  return dayNumber(today) - dayNumber(streak.lastDay) <= 1 ? streak.days : 0;
}
