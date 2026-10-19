import { Service, computed, isDevMode, signal } from '@angular/core';
import { BADGES, Badge, earnedBadges } from '../core/badges';
import { Level } from '../core/level';
import { ProgressSnapshot } from '../core/sync';
import { Command } from '../core/program';
import {
  LevelRecord,
  Stars,
  Streak,
  bumpStreak,
  currentStreak,
  evaluateCodeStars,
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
  /** Rozpracovaný psaný kód úloh */
  codes: Record<string, string>;
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

/** Příznak v `localStorage`, který v dev buildu na localhostu odemkne všechny úlohy */
export const DEBUG_FLAG = 'python-quest.debug';

function readDebugFlag(): boolean {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  try {
    return isDevMode() && local && localStorage.getItem(DEBUG_FLAG) === '1';
  } catch {
    return false;
  }
}

function load(): SavedProgress {
  const empty: SavedProgress = {
    records: {},
    streak: { days: 0, lastDay: null, best: 0 },
    drafts: {},
    codes: {},
  };
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
  /** Debug mód: vše odemčené */
  private readonly debug = readDebugFlag();

  readonly records = computed(() => this.state().records);
  readonly xp = computed(() => totalXp(this.records()));
  readonly playerLevel = computed(() => playerLevel(this.xp()));
  readonly streak = computed(() => currentStreak(this.state().streak, today()));
  readonly badges = computed(() => earnedBadges(this.records(), this.state().streak, LEVELS));
  readonly totalStars = computed(() =>
    Object.values(this.records()).reduce((sum, record) => sum + starCount(record.stars), 0),
  );
  readonly maxStars = LEVELS.length * 3;

  /** Synchronizovaná část postupu; změna rozpracovaného programu ji nemění */
  readonly snapshot = computed<ProgressSnapshot>(
    () => ({ records: this.state().records, streak: this.state().streak }),
    { equal: (a, b) => a.records === b.records && a.streak === b.streak },
  );

  applySnapshot(snapshot: ProgressSnapshot): void {
    this.update((state) => ({ ...state, records: snapshot.records, streak: snapshot.streak }));
  }

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
    if (this.debug) {
      return true;
    }
    const index = WORLDS.findIndex((w) => w.id === world);
    if (index <= 0) {
      return index === 0;
    }
    const previous = WORLDS[index - 1]?.id ?? 0;
    return this.worldStars(previous) >= this.worldMaxStars(previous) * UNLOCK_SHARE;
  }

  /** Úloha je otevřená, když je svět odemčený a předchozí úloha ve světě splněná. */
  isLevelUnlocked(level: Level): boolean {
    if (this.debug) {
      return true;
    }
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

  codeDraft(levelId: string): string | undefined {
    return this.state().codes[levelId];
  }

  saveCodeDraft(levelId: string, code: string): void {
    this.update((state) => ({ ...state, codes: { ...state.codes, [levelId]: code } }));
  }

  /** Zapíše pokus a vrátí nově získané hvězdy a XP. Pokus v psaném kódu nese `code`. */
  submit(level: Level, program: readonly Command[], percent: number, hintsUsed: number, code?: string): Attempt {
    const stars = code === undefined ? evaluateStars(level, program, percent) : evaluateCodeStars(level, code, percent);
    const previous = this.records()[level.id];
    const xpBefore = this.xp();
    const badgesBefore = this.badges();
    const before = previous ? starCount(previous.stars) : 0;
    const record = mergeRecord(previous, { stars, percent, hintsUsed, code: code !== undefined });
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
    this.update(() => ({ records: {}, streak: { days: 0, lastDay: null, best: 0 }, drafts: {}, codes: {} }));
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
