import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, signal } from '@angular/core';
import {
  BLOCK_LABELS,
  PEN_COLORS,
  createBlock,
  getBlock,
  insertBlock,
  removeBlock,
  replaceBlock,
  shiftBlock,
} from '../core/edit';
import { Command, CommandKind, countBlocks, hasBody } from '../core/program';

type BlockGroup = 'move' | 'turn' | 'repeat' | 'pen';

const GROUPS: Record<CommandKind, BlockGroup> = {
  forward: 'move',
  backward: 'move',
  goto: 'move',
  left: 'turn',
  right: 'turn',
  repeat: 'repeat',
  fill: 'pen',
  penUp: 'pen',
  penDown: 'pen',
  color: 'pen',
};

const LIMITS = {
  distance: { min: 0, max: 400, step: 10 },
  angle: { min: 0, max: 360, step: 15 },
  times: { min: 1, max: 100, step: 1 },
} as const;

type Limit = keyof typeof LIMITS;

function clamp(value: number, limit: Limit): number {
  const { min, max } = LIMITS[limit];
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

/** Klikací editor bloků s paletou. */
@Component({
  selector: 'app-program-editor',
  imports: [NgTemplateOutlet],
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
  protected readonly selected = signal<number[] | null>(null);
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
    const v = clamp(value, limit);
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

  protected numberOf(command: Command): { value: number; limit: Limit; unit: string } | null {
    switch (command.kind) {
      case 'forward':
      case 'backward':
        return { value: command.value, limit: 'distance', unit: '' };
      case 'left':
      case 'right':
        return { value: command.angle, limit: 'angle', unit: '°' };
      case 'repeat':
        return { value: command.times, limit: 'times', unit: '×' };
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
