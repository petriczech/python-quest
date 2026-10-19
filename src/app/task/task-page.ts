import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CodeEditor } from '../code/code-editor';
import { PythonRunner } from '../code/python-runner';
import { levelStart } from '../core/level';
import { Command, countBlocks, usedKinds } from '../core/program';
import { pythonText, toPython } from '../core/python';
import { PythonRunResult, opsToProgram } from '../core/turtle-ops';
import { rasterize } from '../core/raster';
import { run } from '../core/run';
import { MatchResult, PASS_PERCENT, feedback, match } from '../core/score';
import { BLOCK_LABELS } from '../core/edit';
import {
  CODE_XP_FACTOR,
  XP_PERFECT,
  XP_PER_HINT,
  XP_PER_STAR,
  codeLines,
  evaluateCodeStars,
  starCount,
} from '../core/xp';
import { LEVELS, WORLDS, findLevel, nextLevel } from '../levels/levels';
import { Attempt, ProgressStore } from '../progress/progress.store';
import { PatternFigure } from './pattern-figure';
import { ProgramEditor } from './program-editor';
import { PythonPanel } from './python-panel';
import { CompareMode, TurtleCanvas } from './turtle-canvas';

const HISTORY_LIMIT = 100;

export type EditMode = 'blocks' | 'code';

@Component({
  selector: 'app-task-page',
  imports: [RouterLink, CodeEditor, PatternFigure, ProgramEditor, PythonPanel, TurtleCanvas],
  templateUrl: './task-page.html',
  styleUrl: './task-page.css',
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class TaskPage {
  readonly id = input.required<string>();

  private readonly progress = inject(ProgressStore);
  protected readonly python = inject(PythonRunner);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly level = computed(() => findLevel(this.id()));
  protected readonly unlocked = computed(() => {
    const level = this.level();
    return level ? this.progress.isLevelUnlocked(level) : false;
  });
  protected readonly world = computed(() => WORLDS.find((w) => w.id === this.level()?.world));
  protected readonly worldSize = computed(
    () => LEVELS.filter((level) => level.world === this.level()?.world).length,
  );
  protected readonly next = computed(() => {
    const level = this.level();
    return level ? nextLevel(level) : undefined;
  });

  protected readonly start = computed(() => {
    const level = this.level();
    return level ? levelStart(level) : {};
  });
  protected readonly reference = computed(() => run(this.level()?.reference ?? [], this.start()));

  protected readonly program = linkedSignal<Command[]>(() => {
    const level = this.level();
    return level ? untracked(() => this.progress.draft(level.id) ?? level.starter ?? []) : [];
  });
  /** Program po poslední změně, z něj se plní historie */
  private readonly committed = linkedSignal(() => (this.level(), untracked(() => this.program())));
  private readonly past = linkedSignal<Command[][]>(() => (this.level(), []));
  private readonly future = linkedSignal<Command[][]>(() => (this.level(), []));

  /** Bloky, nebo psaný kód v Pythonu */
  /** Úloha jen pro kód začíná v kódu s kostrou za nastavením startu */
  protected readonly codeOnly = computed(() => this.level()?.codeStarter !== undefined);
  protected readonly editMode = linkedSignal<EditMode>(() => (this.codeOnly() ? 'code' : 'blocks'));
  protected readonly code = linkedSignal<string>(() => {
    const level = this.level();
    if (!level) {
      return '';
    }
    const draft = untracked(() => this.progress.codeDraft(level.id));
    const starter = level.codeStarter;
    return draft ?? (starter === undefined ? '' : `${pythonText(toPython([], levelStart(level)))}${starter}\n`);
  });
  /** Výsledek posledního běhu kódu; po změně kódu se zahodí */
  protected readonly codeResult = linkedSignal<string, PythonRunResult | null>({
    source: this.code,
    computation: () => null,
  });
  protected readonly codeRunning = signal(false);

  /** Kód kreslí od počátku: start úlohy si nastaví sám (vygenerovaný kód ho obsahuje) */
  protected readonly output = computed(() =>
    this.editMode() === 'code'
      ? run(opsToProgram(this.codeResult()?.ops ?? []))
      : run(this.program(), this.start()),
  );
  protected readonly step = linkedSignal(() => this.output().steps.length);
  protected readonly running = signal(false);
  protected readonly speed = signal(5);
  protected readonly mode = signal<CompareMode>('overlay');
  protected readonly showPattern = signal(true);
  protected readonly showGrid = signal(true);

  protected readonly result = linkedSignal<unknown, { match: MatchResult; text: string } | null>({
    source: this.output,
    computation: () => null,
  });
  protected readonly hintLevel = linkedSignal(() => (this.level(), 0));
  protected readonly attempt = signal<Attempt | null>(null);

  protected readonly record = computed(() => {
    const level = this.level();
    return level ? this.progress.records()[level.id] : undefined;
  });

  /** Blok právě prováděného kroku; po doběhnutí programu se nezvýrazňuje */
  protected readonly activePath = computed(() => {
    if (this.editMode() === 'code') {
      return null;
    }
    const total = this.output().steps.length;
    if (!this.running() && this.step() >= total) {
      return null;
    }
    return this.output().steps[this.step() - 1]?.path.join(',') ?? null;
  });

  protected readonly criteria = computed(() => {
    const level = this.level();
    if (!level) {
      return [];
    }
    const stars = this.record()?.stars ?? [false, false, false];
    const requires = level.stars.requires ?? [];
    if (this.editMode() === 'code') {
      return [
        { done: stars[0], text: `Shoda se vzorem aspoň ${PASS_PERCENT} %`, now: true },
        {
          done: stars[1],
          text: level.stars.recursion
            ? 'Použij rekurzi: funkce volá sama sebe'
            : requires.length
              ? `Použij v kódu ${requires.map((k) => BLOCK_LABELS[k]).join(' a ')}`
              : 'Struktura (tady stačí splnit)',
          now: evaluateCodeStars(level, this.code(), 100)[1],
        },
        level.stars.maxLines === undefined
          ? { done: stars[2], text: 'Úspornost se hodnotí jen v blocích', now: false }
          : {
              done: stars[2],
              text: `Nejvýš ${level.stars.maxLines} řádků kódu`,
              now: codeLines(this.code()) <= level.stars.maxLines,
            },
      ];
    }
    const kinds = usedKinds(this.program());
    const blocks = countBlocks(this.program());
    return [
      { done: stars[0], text: `Shoda se vzorem aspoň ${PASS_PERCENT} %`, now: true },
      {
        done: stars[1],
        text: requires.length
          ? `Použij blok ${requires.map((k) => BLOCK_LABELS[k]).join(' a ')}`
          : 'Struktura (tady stačí splnit)',
        now: requires.every((k) => kinds.has(k)),
      },
      {
        done: stars[2],
        text:
          level.stars.maxBlocks === undefined
            ? 'Úspornost (tady stačí splnit)'
            : `Nejvýš ${level.stars.maxBlocks} ${level.stars.maxBlocks === 1 ? 'blok' : level.stars.maxBlocks <= 4 ? 'bloky' : 'bloků'}`,
        now: level.stars.maxBlocks === undefined || blocks <= level.stars.maxBlocks,
      },
    ];
  });

  protected readonly modes: { value: CompareMode; label: string }[] = [
    { value: 'overlay', label: 'Překrytí' },
    { value: 'slider', label: 'Posuvník' },
    { value: 'diff', label: 'Rozdíl' },
  ];

  protected readonly xpPerHint = XP_PER_HINT;
  protected readonly starCount = starCount;

  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
    // V kódu se Python načítá hned, aby první spuštění nečekalo
    effect(() => {
      if (this.editMode() === 'code') {
        untracked(() => this.python.preload());
      }
    });
  }

  // PROGRAM

  protected onProgramChange(): void {
    const level = this.level();
    if (!level) {
      return;
    }
    this.past.update((past) => [...past, this.committed()].slice(-HISTORY_LIMIT));
    this.future.set([]);
    this.committed.set(this.program());
    this.stopAnimation();
    this.progress.saveDraft(level.id, this.program());
  }

  protected undo(): void {
    const previous = this.past().at(-1);
    if (!previous) {
      return;
    }
    this.past.update((past) => past.slice(0, -1));
    this.future.update((future) => [...future, this.program()]);
    this.applyHistory(previous);
  }

  protected redo(): void {
    const next = this.future().at(-1);
    if (!next) {
      return;
    }
    this.future.update((future) => future.slice(0, -1));
    this.past.update((past) => [...past, this.program()]);
    this.applyHistory(next);
  }

  protected canUndo = computed(() => this.past().length > 0);
  protected canRedo = computed(() => this.future().length > 0);

  protected clear(): void {
    this.program.set([]);
    this.onProgramChange();
  }

  private applyHistory(program: Command[]): void {
    const level = this.level();
    this.stopAnimation();
    this.program.set(program);
    this.committed.set(program);
    if (level) {
      this.progress.saveDraft(level.id, program);
    }
  }

  // KÓD

  protected setEditMode(mode: EditMode): void {
    if (mode === 'code') {
      if (!this.code().trim()) {
        this.code.set(pythonText(toPython(this.program(), this.start())));
      }
    }
    this.stopAnimation();
    this.editMode.set(mode);
  }

  protected onCodeChange(code: string): void {
    const level = this.level();
    this.stopAnimation();
    if (level) {
      this.progress.saveCodeDraft(level.id, code);
    }
  }

  /** Kód, za který jsou XP ×2: psaný, ne jen beze změny převzatý z bloků */
  private writtenCode(): string | undefined {
    if (this.editMode() !== 'code') {
      return undefined;
    }
    const code = this.code();
    return code.trim() === pythonText(toPython(this.program(), this.start())).trim() ? undefined : code;
  }

  /** Program dosáhl limitu kroků v TS interpretu nebo limitu příkazů v Pythonu */
  protected readonly truncated = computed(
    () => this.output().truncated || (this.editMode() === 'code' && (this.codeResult()?.truncated ?? false)),
  );

  /** Převezme Python vygenerovaný z bloků (přepíše psaný kód). */
  protected codeFromBlocks(): void {
    const code = pythonText(toPython(this.program(), this.start()));
    this.code.set(code);
    this.onCodeChange(code);
  }

  /** Spustí kód; vrací false, když se mezitím změnila úloha, režim nebo kód (výsledek neplatí). */
  private async executeCode(): Promise<boolean> {
    this.codeRunning.set(true);
    const level = this.level();
    const code = this.code();
    const result = await this.python.run(code);
    this.codeRunning.set(false);
    if (this.level() !== level || this.editMode() !== 'code' || this.code() !== code) {
      return false;
    }
    this.codeResult.set(result);
    return true;
  }

  // BĚH

  protected async runProgram(): Promise<void> {
    this.stopAnimation();
    if (this.editMode() === 'code') {
      if (!(await this.executeCode())) {
        return;
      }
      if (this.codeResult()?.error) {
        this.step.set(this.output().steps.length);
        return;
      }
    }
    const total = this.output().steps.length;
    if (this.speed() >= 10 || total === 0) {
      this.step.set(total);
      this.evaluate();
      return;
    }
    this.step.set(0);
    this.running.set(true);
    const stepsPerSecond = 2 ** (this.speed() - 1) * 1.5;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += ((now - last) / 1000) * stepsPerSecond;
      last = now;
      const advance = Math.floor(carry);
      carry -= advance;
      const next = Math.min(total, this.step() + advance);
      this.step.set(next);
      if (next >= total) {
        this.running.set(false);
        this.evaluate();
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  protected async stepOnce(): Promise<void> {
    this.stopAnimation();
    if (this.editMode() === 'code' && !this.codeResult()) {
      if (!(await this.executeCode())) {
        return;
      }
      this.step.set(0);
    }
    const total = this.output().steps.length;
    const next = this.step() >= total ? 1 : this.step() + 1;
    this.step.set(Math.min(next, total));
    if (next >= total) {
      this.evaluate();
    }
  }

  protected resetRun(): void {
    this.stopAnimation();
    this.step.set(0);
    this.result.set(null);
  }

  protected seek(value: number): void {
    this.stopAnimation();
    this.step.set(value);
  }

  protected setSpeed(value: number): void {
    this.speed.set(value);
  }

  private stopAnimation(): void {
    cancelAnimationFrame(this.frame);
    this.running.set(false);
  }

  private evaluate(): void {
    const level = this.level();
    if (!level) {
      return;
    }
    const result = match(rasterize(this.reference()), rasterize(this.output()));
    this.result.set({ match: result, text: feedback(this.reference(), this.output(), result) });
    // Prázdná kresba se jako pokus nepočítá
    if (this.output().segments.length === 0 && this.output().fills.length === 0) {
      return;
    }
    const solvedBefore = this.record()?.stars[0] ?? false;
    const attempt = this.progress.submit(
      level,
      this.program(),
      result.percent,
      solvedBefore ? 0 : this.hintLevel(),
      this.writtenCode(),
    );
    if (attempt.stars[0]) {
      this.attempt.set(attempt);
      this.dialog()?.nativeElement.showModal();
    }
  }

  // NÁPOVĚDA

  protected showHint(): void {
    this.hintLevel.update((n) => Math.min(n + 1, this.level()?.hints.length ?? 0));
  }

  // DIALOG

  protected closeDialog(): void {
    this.dialog()?.nativeElement.close();
  }

  protected readonly rewards = computed(() => {
    const attempt = this.attempt();
    if (!attempt) {
      return [];
    }
    const [shape, structure, economy] = attempt.stars;
    const percent = this.result()?.match.percent ?? 0;
    const rewards = [
      { ok: shape, text: 'Správný tvar', xp: `+${XP_PER_STAR} XP` },
      { ok: structure, text: 'Struktura programu', xp: `+${XP_PER_STAR} XP` },
      { ok: economy, text: 'Úsporný program', xp: `+${XP_PER_STAR} XP` },
      { ok: percent >= 100, text: 'Přesně 100 %', xp: `+${XP_PERFECT} XP` },
    ];
    if (this.writtenCode() !== undefined) {
      rewards.push({ ok: shape, text: 'Napsáno v Pythonu', xp: `XP ×${CODE_XP_FACTOR}` });
    }
    return rewards;
  });

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    // V editoru kódu má Ctrl+Z vlastní historii
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.closest('.code-editor')) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
    }
  }

  protected valueOf(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected checkedOf(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
