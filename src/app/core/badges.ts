import { Level } from './level';
import { LevelRecord } from './xp';

export type BadgeId =
  | 'first-step'
  | 'looper'
  | 'angle-master'
  | 'hundred'
  | 'no-hints'
  | 'pythonista'
  | 'fractals';

export interface Badge {
  id: BadgeId;
  title: string;
  description: string;
}

export const BADGES: Badge[] = [
  { id: 'first-step', title: 'První krok', description: 'První splněná úloha' },
  { id: 'looper', title: 'Smyčkař', description: '10 úloh s blokem opakuj' },
  { id: 'angle-master', title: 'Úhlomistr', description: '5 úloh s vnějším úhlem napoprvé' },
  { id: 'hundred', title: 'Stovkař', description: '10× shoda 100 %' },
  { id: 'no-hints', title: 'Bez nápovědy', description: 'Celý svět bez nápovědy' },
  { id: 'pythonista', title: 'Pythonista', description: '5 úloh splněných v psaném kódu' },
  { id: 'fractals', title: 'Fraktálník', description: 'Všechny fraktály nakreslené rekurzí' },
];

/** Úlohy, kde se počítá vnější úhel mnohoúhelníku */
const ANGLE_LEVELS = ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7'];

/** Získané odznaky odvozené ze záznamů úloh. */
export function earnedBadges(
  records: Record<string, LevelRecord>,
  levels: readonly Level[],
): Set<BadgeId> {
  const solved = (id: string) => records[id]?.stars[0] ?? false;
  const earned = new Set<BadgeId>();

  if (levels.some((level) => solved(level.id))) {
    earned.add('first-step');
  }
  const loops = levels.filter(
    (level) => level.stars.requires?.includes('repeat') && records[level.id]?.stars[1],
  ).length;
  if (loops >= 10) {
    earned.add('looper');
  }
  if (ANGLE_LEVELS.filter((id) => records[id]?.firstTry).length >= 5) {
    earned.add('angle-master');
  }
  if (Object.values(records).filter((record) => record.perfect).length >= 10) {
    earned.add('hundred');
  }
  const worlds = new Set(levels.map((level) => level.world));
  for (const world of worlds) {
    const inWorld = levels.filter((level) => level.world === world);
    if (inWorld.every((level) => solved(level.id) && records[level.id]?.hintsUsed === 0)) {
      earned.add('no-hints');
    }
  }
  if (Object.values(records).filter((record) => record.code).length >= 5) {
    earned.add('pythonista');
  }
  const fractals = levels.filter((level) => level.stars.recursion);
  if (fractals.length > 0 && fractals.every((level) => records[level.id]?.stars[1])) {
    earned.add('fractals');
  }
  return earned;
}
