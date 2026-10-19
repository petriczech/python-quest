export type MoveKind = 'forward' | 'backward';
export type TurnKind = 'left' | 'right';

export type Command =
  /** `byVar`: délka je proměnná nejbližšího cyklu `for` */
  | { kind: MoveKind; value: number; byVar?: boolean }
  | { kind: TurnKind; angle: number }
  | { kind: 'penUp' | 'penDown' }
  | { kind: 'goto'; x: number; y: number }
  | { kind: 'color'; value: string }
  | { kind: 'fill'; color: string; body: Command[] }
  | { kind: 'repeat'; times: number; body: Command[] }
  /** Cyklus s proměnnou jako Python `range(from, to, step)`, `to` se už neprovede */
  | { kind: 'for'; from: number; to: number; step: number; body: Command[] };

export type CommandKind = Command['kind'];

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
