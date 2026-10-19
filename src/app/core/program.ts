export type MoveKind = 'forward' | 'backward';
export type TurnKind = 'left' | 'right';

/** Pojmenované proměnné programu; nenastavená má hodnotu 0 */
export type VarName = 'delka' | 'uhel' | 'pocet';
export const VAR_NAMES: readonly VarName[] = ['delka', 'uhel', 'pocet'];

export type Command =
  /**
   * `byVar`: délka je proměnná nejbližšího cyklu `for`;
   * `useVar`: délka je proměnná `delka` (přepínače se vylučují)
   */
  | { kind: MoveKind; value: number; byVar?: boolean; useVar?: boolean }
  /** `useVar`: úhel je proměnná `uhel` */
  | { kind: TurnKind; angle: number; useVar?: boolean }
  | { kind: 'penUp' | 'penDown' }
  | { kind: 'goto'; x: number; y: number }
  | { kind: 'color'; value: string }
  | { kind: 'fill'; color: string; body: Command[] }
  /** `useVar`: počet opakování je proměnná `pocet` (vyhodnotí se jednou na začátku) */
  | { kind: 'repeat'; times: number; body: Command[]; useVar?: boolean }
  /** Cyklus s proměnnou jako Python `range(from, to, step)`, `to` se už neprovede */
  | { kind: 'for'; from: number; to: number; step: number; body: Command[] }
  | { kind: 'setVar'; name: VarName; value: number }
  | { kind: 'changeVar'; name: VarName; by: number };

export type CommandKind = Command['kind'];

/** Proměnná, kterou blok použije místo vlastní hodnoty, když má zapnuté `useVar` */
export const VAR_OF: Partial<Record<CommandKind, VarName>> = {
  forward: 'delka',
  backward: 'delka',
  left: 'uhel',
  right: 'uhel',
  repeat: 'pocet',
};

/** Cesta k bloku v AST: indexy přes vnořená těla. */
export type BlockPath = readonly number[];

export interface Point {
  x: number;
  y: number;
}

export interface TurtleState extends Point {
  heading: number;
  penDown: boolean;
  color: string;
}

export interface TraceStep extends TurtleState {
  path: BlockPath;
  /** Počet segmentů nakreslených po tomto kroku */
  segmentCount: number;
  /** Počet uzavřených výplní po tomto kroku */
  fillCount: number;
}

export interface Segment {
  from: Point;
  to: Point;
  color: string;
}

export interface Fill {
  polygon: Point[];
  color: string;
}

export interface Trace {
  start: TurtleState;
  steps: TraceStep[];
  segments: Segment[];
  fills: Fill[];
  /** Program překročil limit kroků */
  truncated: boolean;
}

export const DEFAULT_COLOR = '#12233B';

export function hasBody(command: Command): command is Extract<Command, { body: Command[] }> {
  return command.kind === 'repeat' || command.kind === 'for' || command.kind === 'fill';
}

/** Počet bloků včetně vnořených; `repeat`, `for` i `fill` jsou 1 blok. */
export function countBlocks(program: readonly Command[]): number {
  return program.reduce(
    (sum, command) => sum + 1 + (hasBody(command) ? countBlocks(command.body) : 0),
    0,
  );
}

/** Proměnné, které bloky programu opravdu použijí (zapnuté `useVar`). */
export function usedVars(program: readonly Command[]): Set<VarName> {
  const vars = new Set<VarName>();
  const walk = (commands: readonly Command[]): void => {
    for (const command of commands) {
      const name = VAR_OF[command.kind];
      if (name && 'useVar' in command && command.useVar) {
        vars.add(name);
      }
      if (hasBody(command)) {
        walk(command.body);
      }
    }
  };
  walk(program);
  return vars;
}

/** Druhy bloků použité v programu včetně vnořených. */
export function usedKinds(program: readonly Command[]): Set<CommandKind> {
  const kinds = new Set<CommandKind>();
  const walk = (commands: readonly Command[]): void => {
    for (const command of commands) {
      kinds.add(command.kind);
      if (hasBody(command)) {
        walk(command.body);
      }
    }
  };
  walk(program);
  return kinds;
}
