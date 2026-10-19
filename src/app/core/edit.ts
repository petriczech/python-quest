import { BlockPath, Command, CommandKind, hasBody } from './program';

export const PEN_COLORS = [
  { value: '#12233B', label: 'černá' },
  { value: '#E8632B', label: 'oranžová' },
  { value: '#1F5FBF', label: 'modrá' },
  { value: '#0F7B6C', label: 'zelená' },
  { value: '#6B4FBB', label: 'fialová' },
] as const;

export const BLOCK_LABELS: Record<CommandKind, string> = {
  forward: 'dopředu',
  backward: 'dozadu',
  left: 'vlevo',
  right: 'vpravo',
  penUp: 'pero nahoru',
  penDown: 'pero dolů',
  goto: 'jdi na',
  color: 'barva',
  fill: 'výplň',
  repeat: 'opakuj',
};

export function createBlock(kind: CommandKind): Command {
  switch (kind) {
    case 'forward':
      return { kind, value: 100 };
    case 'backward':
      return { kind, value: 50 };
    case 'left':
    case 'right':
      return { kind, angle: 90 };
    case 'penUp':
    case 'penDown':
      return { kind };
    case 'goto':
      return { kind, x: 0, y: 0 };
    case 'color':
      return { kind, value: '#12233B' };
    case 'fill':
      return { kind, color: '#E8632B', body: [] };
    case 'repeat':
      return { kind, times: 4, body: [] };
  }
}

/** Seznam, ve kterém blok na cestě leží, upravený funkcí `fn`. */
function updateList(
  program: readonly Command[],
  parent: BlockPath,
  fn: (list: Command[]) => Command[],
): Command[] {
  if (parent.length === 0) {
    return fn([...program]);
  }
  const [head, ...rest] = parent;
  return program.map((command, index) => {
    if (index !== head || !hasBody(command)) {
      return command;
    }
    return { ...command, body: updateList(command.body, rest, fn) };
  });
}

export function getBlock(program: readonly Command[], path: BlockPath): Command | undefined {
  let list = program;
  let block: Command | undefined;
  for (const index of path) {
    block = list[index];
    if (!block) {
      return undefined;
    }
    list = hasBody(block) ? block.body : [];
  }
  return block;
}

/** Vloží blok do seznamu `parent` na pozici `index` (bez indexu na konec). */
export function insertBlock(
  program: readonly Command[],
  parent: BlockPath,
  command: Command,
  index?: number,
): Command[] {
  return updateList(program, parent, (list) => {
    list.splice(index ?? list.length, 0, command);
    return list;
  });
}

export function removeBlock(program: readonly Command[], path: BlockPath): Command[] {
  const index = path.at(-1);
  if (index === undefined) {
    return [...program];
  }
  return updateList(program, path.slice(0, -1), (list) => {
    list.splice(index, 1);
    return list;
  });
}

export function replaceBlock(program: readonly Command[], path: BlockPath, command: Command): Command[] {
  const index = path.at(-1);
  if (index === undefined) {
    return [...program];
  }
  return updateList(program, path.slice(0, -1), (list) => {
    list[index] = command;
    return list;
  });
}

/** Posune blok v rámci svého seznamu o `delta` míst. */
export function shiftBlock(program: readonly Command[], path: BlockPath, delta: number): Command[] {
  const index = path.at(-1);
  if (index === undefined) {
    return [...program];
  }
  return updateList(program, path.slice(0, -1), (list) => {
    const target = Math.max(0, Math.min(list.length - 1, index + delta));
    const [block] = list.splice(index, 1);
    if (block) {
      list.splice(target, 0, block);
    }
    return list;
  });
}

/** Přesune blok z `from` do seznamu `toParent`; `toIndex` je výsledná pozice (jako CDK `currentIndex`). */
export function moveBlock(
  program: readonly Command[],
  from: BlockPath,
  toParent: BlockPath,
  toIndex: number,
): Command[] {
  const block = getBlock(program, from);
  if (!block) {
    return [...program];
  }
  // Blok nejde vložit sám do sebe
  if (toParent.length >= from.length && from.every((v, i) => toParent[i] === v)) {
    return [...program];
  }
  const fromParent = from.slice(0, -1);
  const fromIndex = from.at(-1) ?? 0;
  const removed = removeBlock(program, from);
  // Odebrání posune indexy v nadřazených seznamech cíle
  const adjustedParent = [...toParent];
  const depth = fromParent.length;
  if (
    adjustedParent.length > depth &&
    fromParent.every((v, i) => adjustedParent[i] === v) &&
    (adjustedParent[depth] ?? 0) > fromIndex
  ) {
    adjustedParent[depth] = (adjustedParent[depth] ?? 0) - 1;
  }
  return insertBlock(removed, adjustedParent, block, toIndex);
}
