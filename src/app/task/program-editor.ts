import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, signal } from '@angular/core';
import {
  BLOCK_LABELS,
  PEN_COLORS,
  createBlock,
  getBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  replaceBlock,
  shiftBlock,
} from '../core/edit';
import { Command, CommandKind, VAR_NAMES, VAR_OF, VarName, countBlocks, hasBody } from '../core/program';
import { loopVar } from '../core/python';

type BlockGroup = 'move' | 'turn' | 'repeat' | 'pen' | 'var';

const GROUPS: Record<CommandKind, BlockGroup> = {
  forward: 'move',
  backward: 'move',
  goto: 'move',
  left: 'turn',
  right: 'turn',
  repeat: 'repeat',
  for: 'repeat',
  fill: 'pen',
  penUp: 'pen',
  penDown: 'pen',
  color: 'pen',
  setVar: 'var',
  changeVar: 'var',
};

const PALETTE = 'palette';

const LIMITS = {
  distance: { min: 0, max: 400, step: 10 },
  angle: { min: 0, max: 360, step: 15 },
  times: { min: 1, max: 100, step: 1 },
  rangeStep: { min: 1, max: 100, step: 1 },
  change: { min: -100, max: 100, step: 5 },
  changeCount: { min: -20, max: 20, step: 1 },
} as const;

const INTEGER_LIMITS = new Set<Limit>(['times', 'rangeStep', 'changeCount']);

/** Rozsah hodnoty proměnné podle toho, k čemu slouží */
const VAR_LIMIT: Record<VarName, Limit> = { delka: 'distance', uhel: 'angle', pocet: 'times' };

type Limit = keyof typeof LIMITS;

function clamp(value: number, limit: Limit): number {
  const { min, max } = LIMITS[limit];
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

/** Klikací editor bloků s paletou. */
@Component({
  selector: 'app-program-editor',
  imports: [NgTemplateOutlet, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './program-editor.html',
  styleUrl: './program-editor.css',
})
export class ProgramEditor {
  readonly program = model.required<Command[]>();
  readonly palette = input.required<CommandKind[]>();
  /** Cesta bloku, který se právě provádí (`0,1`) */
  readonly activePath = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly labels = BLOCK_LABELS;
  protected readonly colors = PEN_COLORS;
  protected readonly limits = LIMITS;
  protected readonly varNames = VAR_NAMES;
  /** Úloha má proměnné v paletě: bloky ukážou přepínač na proměnnou */
  protected readonly varsEnabled = computed(() => this.palette().includes('setVar'));
  protected readonly selected = signal<number[] | null>(null);
  /** Blok tažený z palety mimo ni: jeho místo drží zástupce, aby se rozložení pod paletou neposunulo */
  protected readonly outOfPalette = signal<CommandKind | null>(null);
  protected readonly blockCountLabel = computed(() => {
    const n = countBlocks(this.program());
    if (n === 1) {
      return '1 blok';
    }
    return `${n} ${n >= 2 && n <= 4 ? 'bloky' : 'bloků'}`;
  });

  protected label(command: Command): string {
    return BLOCK_LABELS[command.kind];
  }

  protected group(kind: CommandKind): BlockGroup {
    return GROUPS[kind];
  }

  protected key(path: number[]): string {
    return path.join(',');
  }

  protected isSelected(path: number[]): boolean {
    return this.selected()?.join(',') === path.join(',');
  }

  protected hasBody = hasBody;

  protected childPath(path: number[], index: number): number[] {
    return [...path, index];
  }

  protected readonly paletteId = PALETTE;

  /** Id všech seznamů, nejhlubší napřed, aby vnořený seznam dostal přednost */
  protected readonly listIds = computed(() => {
    const paths: number[][] = [];
    const walk = (commands: readonly Command[], prefix: number[]): void => {
      commands.forEach((command, index) => {
        if (hasBody(command)) {
          const path = [...prefix, index];
          paths.push(path);
          walk(command.body, path);
        }
      });
    };
    walk(this.program(), []);
    return [...paths.sort((a, b) => b.length - a.length), []].map((path) => this.listId(path));
  });

  protected listId(path: number[]): string {
    return path.length ? `blocks-${path.join('-')}` : 'blocks-root';
  }

  /** Do palety se nic nepouští */
  protected readonly noEnter = () => false;

  /** Puštění bloku z palety nebo přesun v programu. */
  protected drop(event: CdkDragDrop<number[] | typeof PALETTE>): void {
    const target = event.container.data;
    if (target === PALETTE) {
      return;
    }
    const source = event.previousContainer.data;
    if (source === PALETTE) {
      this.set(insertBlock(this.program(), target, createBlock(event.item.data as CommandKind), event.currentIndex));
      this.selected.set(null);
      return;
    }
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    this.set(moveBlock(this.program(), [...source, event.previousIndex], target, event.currentIndex));
    this.selected.set(null);
  }

  protected leavePalette(kind: unknown): void {
    this.outOfPalette.set(kind as CommandKind);
  }

  protected select(path: number[]): void {
    this.selected.set(this.isSelected(path) ? null : path);
  }

  /** Přidá blok: do vybraného opakuj/výplně, za vybraný blok, jinak na konec. */
  protected add(kind: CommandKind): void {
    const block = createBlock(kind);
    const selected = this.selected();
    const target = selected ? getBlock(this.program(), selected) : undefined;
    let parent: number[] = [];
    let index = this.program().length;
    if (selected && target) {
      if (hasBody(target)) {
        parent = selected;
        index = target.body.length;
      } else {
        parent = selected.slice(0, -1);
        index = (selected.at(-1) ?? 0) + 1;
      }
    }
    this.set(insertBlock(this.program(), parent, block, index));
    this.selected.set([...parent, index]);
  }

  protected remove(path: number[]): void {
    this.set(removeBlock(this.program(), path));
    this.selected.set(null);
  }

  protected shift(path: number[], delta: number): void {
    const index = path.at(-1) ?? 0;
    this.set(shiftBlock(this.program(), path, delta));
    if (this.isSelected(path)) {
      this.selected.set([...path.slice(0, -1), Math.max(0, index + delta)]);
    }
  }

  protected setNumber(path: number[], command: Command, value: number, limit: Limit): void {
    // Počty jsou pro Python range celá čísla
    const v = clamp(INTEGER_LIMITS.has(limit) ? Math.round(value) : value, limit);
    switch (command.kind) {
      case 'forward':
      case 'backward':
        this.set(replaceBlock(this.program(), path, { ...command, value: v }));
        break;
      case 'left':
      case 'right':
        this.set(replaceBlock(this.program(), path, { ...command, angle: v }));
        break;
      case 'repeat':
        this.set(replaceBlock(this.program(), path, { ...command, times: v }));
        break;
      case 'setVar':
        this.set(replaceBlock(this.program(), path, { ...command, value: v }));
        break;
      case 'changeVar':
        this.set(replaceBlock(this.program(), path, { ...command, by: v }));
        break;
    }
  }

  protected setVarName(path: number[], command: Command, value: string): void {
    const name = VAR_NAMES.find((n) => n === value);
    if (!name) {
      return;
    }
    if (command.kind === 'setVar') {
      const limit = VAR_LIMIT[name];
      const value = clamp(INTEGER_LIMITS.has(limit) ? Math.round(command.value) : command.value, limit);
      this.set(replaceBlock(this.program(), path, { ...command, name, value }));
    } else if (command.kind === 'changeVar') {
      const limit = name === 'pocet' ? 'changeCount' : 'change';
      this.set(replaceBlock(this.program(), path, { ...command, name, by: clamp(Math.round(command.by), limit) }));
    }
  }

  /** Proměnná, kterou blok může použít; jen v úlohách s proměnnými v paletě */
  protected namedVarOf(command: Command): VarName | null {
    return this.varsEnabled() ? (VAR_OF[command.kind] ?? null) : null;
  }

  protected usesNamedVar(command: Command): boolean {
    return 'useVar' in command && !!command.useVar;
  }

  protected toggleNamedVar(path: number[], command: Command): void {
    switch (command.kind) {
      case 'forward':
      case 'backward':
        // Délka je buď z cyklu for, nebo z proměnné delka
        this.set(replaceBlock(this.program(), path, { ...command, useVar: !command.useVar, byVar: false }));
        break;
      case 'left':
      case 'right':
      case 'repeat':
        this.set(replaceBlock(this.program(), path, { ...command, useVar: !command.useVar }));
        break;
    }
  }

  protected setColor(path: number[], command: Command, value: string): void {
    if (command.kind === 'color') {
      this.set(replaceBlock(this.program(), path, { ...command, value }));
    } else if (command.kind === 'fill') {
      this.set(replaceBlock(this.program(), path, { ...command, color: value }));
    }
  }

  protected setGoto(path: number[], command: Command, axis: 'x' | 'y', value: number): void {
    if (command.kind === 'goto') {
      const v = Math.min(200, Math.max(-200, Number.isFinite(value) ? value : 0));
      this.set(replaceBlock(this.program(), path, { ...command, [axis]: v }));
    }
  }

  /** Proměnná nejbližšího nadřazeného cyklu `for`, jinak null */
  protected loopVarOf(path: number[]): string | null {
    let name: string | null = null;
    let depth = 0;
    for (let i = 1; i < path.length; i++) {
      const parent = getBlock(this.program(), path.slice(0, i));
      if (parent?.kind === 'for') {
        name = loopVar(depth);
      }
      if (parent?.kind === 'for' || parent?.kind === 'repeat') {
        depth++;
      }
    }
    return name;
  }

  protected setRange(path: number[], command: Command, field: 'from' | 'to' | 'step', value: number): void {
    if (command.kind === 'for') {
      // Python range bere jen celá čísla
      const v = clamp(Math.round(value), field === 'step' ? 'rangeStep' : 'distance');
      this.set(replaceBlock(this.program(), path, { ...command, [field]: v }));
    }
  }

  protected toggleVar(path: number[], command: Command): void {
    if (command.kind === 'forward' || command.kind === 'backward') {
      this.set(replaceBlock(this.program(), path, { ...command, byVar: !command.byVar, useVar: false }));
    }
  }

  /** Číselná hodnota bloku; délka z proměnné cyklu žádnou nemá */
  protected numberOf(
    command: Command,
    variable: string | null,
  ): { value: number; limit: Limit; unit: string } | null {
    switch (command.kind) {
      case 'forward':
      case 'backward':
        return (command.byVar && variable) || command.useVar
          ? null
          : { value: command.value, limit: 'distance', unit: '' };
      case 'left':
      case 'right':
        return command.useVar ? null : { value: command.angle, limit: 'angle', unit: '°' };
      case 'repeat':
        return command.useVar ? null : { value: command.times, limit: 'times', unit: '×' };
      case 'setVar':
        return { value: command.value, limit: VAR_LIMIT[command.name], unit: '' };
      case 'changeVar':
        return { value: command.by, limit: command.name === 'pocet' ? 'changeCount' : 'change', unit: '' };
      default:
        return null;
    }
  }

  protected colorOf(command: Command): string | null {
    if (command.kind === 'color') {
      return command.value;
    }
    return command.kind === 'fill' ? command.color : null;
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  private set(program: Command[]): void {
    this.program.set(program);
    this.changed.emit();
  }
}
