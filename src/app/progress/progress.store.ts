import { Service, computed, signal } from '@angular/core';
import { BADGES, Badge, earnedBadges } from '../core/badges';
import { Level } from '../core/level';
import { Command } from '../core/program';
import {
  LevelRecord,
  Stars,
  Streak,
  bumpStreak,
  currentStreak,
  evaluateStars,
  mergeRecord,
  playerLevel,
  starCount,
  totalXp,
} from '../core/xp';
import { LEVELS, WORLDS } from '../levels/levels';

interface SavedProgress {
  records: Record<string, LevelRecord>;
  streak: Streak;
  drafts: Record<string, Command[]>;
}

const STORAGE_KEY = 'python-quest.progress.v1';

/** Podíl hvězd předchozího světa pro odemknutí dalšího */
export const UNLOCK_SHARE = 2 / 3;

export interface Attempt {
  stars: Stars;
  newStars: number;
  xpBefore: number;
  xpAfter: number;
  newBadges: Badge[];
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function load(): SavedProgress {
  const empty: SavedProgress = { records: {}, streak: { days: 0, lastDay: null, best: 0 }, drafts: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<SavedProgress>) } : empty;
  } catch {
    return empty;
  }
}

@Service()
export class ProgressStore {
  private readonly state = signal<SavedProgress>(load());

  readonly records = computed(() => this.state().records);
  readonly xp = computed(() => totalXp(this.records()));
  readonly playerLevel = computed(() => playerLevel(this.xp()));
  readonly streak = computed(() => currentStreak(this.state().streak, today()));
  readonly badges = computed(() => earnedBadges(this.records(), this.state().streak, LEVELS));
  readonly totalStars = computed(() =>
    Object.values(this.records()).reduce((sum, record) => sum + starCount(record.stars), 0),
  );
  readonly maxStars = LEVELS.length * 3;

  worldStars(world: number): number {
    return LEVELS.filter((level) => level.world === world).reduce(
      (sum, level) => sum + starCount(this.records()[level.id]?.stars ?? [false, false, false]),
      0,
    );
  }

  worldMaxStars(world: number): number {
    return LEVELS.filter((level) => level.world === world).length * 3;
  }

  isWorldUnlocked(world: number): boolean {
    const index = WORLDS.findIndex((w) => w.id === world);
    if (index <= 0) {
      return index === 0;
    }
    const previous = WORLDS[index - 1]?.id ?? 0;
    return this.worldStars(previous) >= this.worldMaxStars(previous) * UNLOCK_SHARE;
  }

  /** Úloha je otevřená, když je svět odemčený a předchozí úloha ve světě splněná. */
  isLevelUnlocked(level: Level): boolean {
    if (!this.isWorldUnlocked(level.world)) {
      return false;
    }
    const previous = LEVELS.find((l) => l.world === level.world && l.index === level.index - 1);
    return !previous || (this.records()[previous.id]?.stars[0] ?? false);
  }

  draft(levelId: string): Command[] | undefined {
    return this.state().drafts[levelId];
  }

  saveDraft(levelId: string, program: Command[]): void {
    this.update((state) => ({ ...state, drafts: { ...state.drafts, [levelId]: program } }));
  }

  /** Zapíše pokus a vrátí nově získané hvězdy a XP. */
  submit(level: Level, program: readonly Command[], percent: number, hintsUsed: number): Attempt {
    const stars = evaluateStars(level, program, percent);
    const previous = this.records()[level.id];
    const xpBefore = this.xp();
    const badgesBefore = this.badges();
    const before = previous ? starCount(previous.stars) : 0;
    const record = mergeRecord(previous, { stars, percent, hintsUsed });
    this.update((state) => ({
      ...state,
      records: { ...state.records, [level.id]: record },
      streak: stars[0] ? bumpStreak(state.streak, today()) : state.streak,
    }));
    const badgesAfter = this.badges();
    return {
      stars,
      newStars: starCount(record.stars) - before,
      xpBefore,
      xpAfter: this.xp(),
      newBadges: BADGES.filter((b) => badgesAfter.has(b.id) && !badgesBefore.has(b.id)),
    };
  }

  reset(): void {
    this.update(() => ({ records: {}, streak: { days: 0, lastDay: null, best: 0 }, drafts: {} }));
  }

  private update(fn: (state: SavedProgress) => SavedProgress): void {
    this.state.update(fn);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      // Úložiště nedostupné, postup zůstane jen v paměti
    }
  }
}
