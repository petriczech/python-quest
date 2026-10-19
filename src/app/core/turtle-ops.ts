import { Command } from './program';

/** Příkaz zapsaný modulem `turtle` v Pyodide (viz `TURTLE_SHIM`) */
export type TurtleOp =
  | ['fd', number]
  | ['lt', number]
  | ['pu']
  | ['pd']
  | ['goto', number, number]
  | ['color', string]
  | ['begin_fill']
  | ['end_fill', string];

export interface PythonError {
  type: string;
  message: string;
  /** Řádek v kódu studenta, pokud chyba vznikla v něm */
  line: number | null;
}

export interface PythonRunResult {
  ops: TurtleOp[];
  error: PythonError | null;
  /** Program překročil limit příkazů */
  truncated: boolean;
  /** Výstup `print` */
  output: string;
}

/**
 * Sestaví z příkazů želvy program pro TS interpret. `begin_fill` … `end_fill` se stane blokem
 * výplň s barvou platnou při `end_fill`, jako v Pythonu. Neuzavřená výplň se nevybarví.
 */
export function opsToProgram(ops: readonly TurtleOp[]): Command[] {
  const root: Command[] = [];
  const open: Command[][] = [];
  let current = root;

  for (const op of ops) {
    switch (op[0]) {
      case 'fd':
        current.push({ kind: 'forward', value: op[1] });
        break;
      case 'lt':
        current.push({ kind: 'left', angle: op[1] });
        break;
      case 'pu':
        current.push({ kind: 'penUp' });
        break;
      case 'pd':
        current.push({ kind: 'penDown' });
        break;
      case 'goto':
        current.push({ kind: 'goto', x: op[1], y: op[2] });
        break;
      case 'color':
        current.push({ kind: 'color', value: op[1] });
        break;
      case 'begin_fill':
        // Nová výplň uprostřed otevřené ji v Pythonu ukončí bez vybarvení
        if (open.length) {
          current = closeUnfilled(open, current);
        }
        open.push(current);
        current = [];
        break;
      case 'end_fill': {
        const parent = open.pop();
        if (parent) {
          parent.push({ kind: 'fill', color: op[1], body: current });
          current = parent;
        }
        break;
      }
    }
  }
  while (open.length) {
    current = closeUnfilled(open, current);
  }
  return root;
}

/** Vrátí příkazy neuzavřené výplně do nadřazeného seznamu bez vybarvení. */
function closeUnfilled(open: Command[][], current: Command[]): Command[] {
  const parent = open.pop() ?? [];
  parent.push(...current);
  return parent;
}
