import { Level } from './level';
import { Command, CommandKind, countBlocks, usedKinds } from './program';
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
  /** Splněno i v psaném kódu (×2 XP); starší záznamy pole nemají */
  code?: boolean;
}

export const XP_PER_STAR = 20;
export const XP_PERFECT = 10;
export const XP_PER_HINT = 10;
/** Násobek XP za úlohu splněnou v psaném kódu */
export const CODE_XP_FACTOR = 2;

/** Konstrukce v Pythonu, které odpovídají povinným blokům úlohy */
const CODE_PATTERNS: Partial<Record<CommandKind, RegExp>> = {
  repeat: /\b(for|while)\b/,
  for: /\bfor\b[^:]*\brange\(/,
  fill: /\bbegin_fill\(/,
  penUp: /\b(penup|pu|up|teleport)\(/,
  penDown: /\b(pendown|pd|down)\(/,
  color: /\b(color|pencolor)\(/,
  goto: /\b(goto|setpos|setposition|teleport)\(/,
};

export function evaluateStars(level: Level, program: readonly Command[], percent: number): Stars {
  const solved = percent >= PASS_PERCENT;
  const kinds = usedKinds(program);
  const structure = (level.stars.requires ?? []).every((kind) => kinds.has(kind));
  const economy = level.stars.maxBlocks === undefined || countBlocks(program) <= level.stars.maxBlocks;
  return [solved, solved && structure, solved && economy];
}

/**
 * Hvězdy za psaný kód: tvar, struktura (konstrukce a případně rekurze) a úspornost podle
 * počtu řádků. Úloha bez `maxLines` hodnotí úspornost jen v blocích.
 */
export function evaluateCodeStars(level: Level, code: string, percent: number): Stars {
  const solved = percent >= PASS_PERCENT;
  const source = withoutCommentsAndStrings(code);
  const structure =
    (level.stars.requires ?? []).every((kind) => CODE_PATTERNS[kind]?.test(source) ?? true) &&
    (!level.stars.recursion || hasRecursion(source));
  const economy = level.stars.maxLines !== undefined && codeLines(source) <= level.stars.maxLines;
  return [solved, solved && structure, solved && economy];
}

/** Import: nepočítá se do úspornosti */
const IMPORT_LINE = /^\s*(import\s|from\s+\S+\s+import\s)/;
/** Řádek s jediným voláním, které nekreslí (rychlost, tvar, okno), může být i `turtle.speed(0)` */
const NO_DRAW_CALL =
  /^\s*(?:[\p{L}_][\p{L}\p{N}_]*\.)?(speed|hideturtle|ht|showturtle|st|shape|shapesize|turtlesize|title|setup|screensize|bgcolor|colormode|tracer|update|delay|pensize|width|exitonclick|done|mainloop)\s*\(.*\)\s*$/u;
/** Nastavení startu na nejvyšší úrovni (kostra úlohy ho vygeneruje) */
const START_CALL =
  /^(?:[\p{L}_][\p{L}\p{N}_]*\.)?(penup|pu|up|pendown|pd|down|goto|setpos|setposition|teleport|setheading|seth)\s*\(.*\)\s*$/u;

/** Počet řádků s kódem: bez prázdných, komentářů, importů, nastavení startu a příkazů, které nekreslí */
export function codeLines(code: string): number {
  return withoutCommentsAndStrings(code)
    .split('\n')
    .filter(
      (line) =>
        line.trim() && !IMPORT_LINE.test(line) && !NO_DRAW_CALL.test(line) && !START_CALL.test(line.trimEnd()),
    ).length;
}

/** Jméno v Pythonu včetně písmen s diakritikou */
const NAME = '[\\p{L}_][\\p{L}\\p{N}_]*';

/** Některá funkce volá ve svém těle sama sebe (i jednořádková `def f(n): … f(n - 1)`) */
export function hasRecursion(code: string): boolean {
  const lines = code.split('\n');
  return lines.some((line, index) => {
    const def = new RegExp(`^(\\s*)def\\s+(${NAME})\\s*\\(`, 'u').exec(line);
    if (!def) {
      return false;
    }
    const indent = def[1]?.length ?? 0;
    // Volání jména, před kterým nestojí další písmeno (`\b` v JS diakritiku nezná)
    const call = new RegExp(`(?<![\\p{L}\\p{N}_.])${def[2]}\\s*\\(`, 'u');
    if (call.test(line.slice(def[0].length))) {
      return true;
    }
    for (const next of lines.slice(index + 1)) {
      if (!next.trim()) {
        continue;
      }
      if ((/^\s*/.exec(next)?.[0].length ?? 0) <= indent) {
        return false;
      }
      if (call.test(next)) {
        return true;
      }
    }
    return false;
  });
}

/** Kód bez komentářů a textových řetězců, aby `# for` nebo `"for"` nesplnily strukturu */
function withoutCommentsAndStrings(code: string): string {
  return code.replace(/("""|''')[\s\S]*?\1|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*/g, '');
}

export function starCount(stars: Stars): number {
  return stars.filter(Boolean).length;
}

export function levelXp(record: LevelRecord): number {
  const earned = starCount(record.stars) * XP_PER_STAR + (record.perfect ? XP_PERFECT : 0);
  const factor = record.code ? CODE_XP_FACTOR : 1;
  return Math.max(0, earned * factor - record.hintsUsed * XP_PER_HINT);
}

export function totalXp(records: Record<string, LevelRecord>): number {
  return Object.values(records).reduce((sum, record) => sum + levelXp(record), 0);
}

/** Sloučí nový pokus do záznamu; hvězdy ani shoda se nikdy nezhorší. */
export function mergeRecord(
  previous: LevelRecord | undefined,
  attempt: { stars: Stars; percent: number; hintsUsed: number; code?: boolean },
): LevelRecord {
  const stars = attempt.stars.map((star, i) => star || (previous?.stars[i] ?? false)) as Stars;
  return {
    stars,
    bestMatch: Math.max(previous?.bestMatch ?? 0, attempt.percent),
    perfect: (previous?.perfect ?? false) || attempt.percent >= 100,
    hintsUsed: Math.max(previous?.hintsUsed ?? 0, attempt.hintsUsed),
    firstTry: previous ? previous.firstTry : attempt.stars[0],
    code: (previous?.code ?? false) || ((attempt.code ?? false) && attempt.stars[0]),
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
