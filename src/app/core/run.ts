import {
  Command,
  DEFAULT_COLOR,
  Fill,
  Point,
  Segment,
  Trace,
  TraceStep,
  TurtleState,
  VarName,
} from './program';

export const MAX_STEPS = 5000;
/** Limit průchodů smyčkou, i když tělo nic neprovádí */
export const MAX_ITERATIONS = 100_000;

const PRECISION = 1e6;

function round(value: number): number {
  const rounded = Math.round(value * PRECISION) / PRECISION;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeHeading(heading: number): number {
  const h = round(heading % 360);
  return h < 0 ? h + 360 : h;
}

export const DEFAULT_START: TurtleState = {
  x: 0,
  y: 0,
  heading: 0,
  penDown: true,
  color: DEFAULT_COLOR,
};

/**
 * Spustí program a vrátí trace. Souřadnice jako Python turtle:
 * (0, 0) uprostřed, y nahoru, úhel 0 = východ, `left` je kladný směr.
 */
export function run(program: readonly Command[], start: Partial<TurtleState> = {}): Trace {
  const initial: TurtleState = { ...DEFAULT_START, ...start };
  const state: TurtleState = { ...initial };
  const steps: TraceStep[] = [];
  const segments: Segment[] = [];
  const fills: Fill[] = [];
  const openFills: Point[][] = [];
  let truncated = false;
  let iterations = 0;
  /** Hodnoty proměnných otevřených cyklů `for`, poslední je nejbližší */
  const loopValues: number[] = [];
  /** Pojmenované proměnné; nenastavená má hodnotu 0 (generátor Pythonu ji tak i inicializuje) */
  const vars: Record<VarName, number> = { delka: 0, uhel: 0, pocet: 0 };

  const record = (path: number[]): void => {
    steps.push({ ...state, path, segmentCount: segments.length, fillCount: fills.length });
  };

  const moveTo = (x: number, y: number): void => {
    const from = { x: state.x, y: state.y };
    const to = { x: round(x), y: round(y) };
    if (state.penDown && (from.x !== to.x || from.y !== to.y)) {
      segments.push({ from, to, color: state.color });
    }
    state.x = to.x;
    state.y = to.y;
    for (const polygon of openFills) {
      polygon.push({ ...to });
    }
  };

  const exec = (commands: readonly Command[], prefix: number[]): void => {
    for (const [index, command] of commands.entries()) {
      if (steps.length >= MAX_STEPS) {
        truncated = true;
        return;
      }
      const path = [...prefix, index];
      switch (command.kind) {
        case 'forward':
        case 'backward': {
          const loopValue = command.byVar ? loopValues.at(-1) : undefined;
          const length = loopValue !== undefined
            ? loopValue
            : command.useVar
              ? vars.delka
              : command.value;
          const distance = command.kind === 'forward' ? length : -length;
          const radians = (state.heading * Math.PI) / 180;
          moveTo(state.x + distance * Math.cos(radians), state.y + distance * Math.sin(radians));
          record(path);
          break;
        }
        case 'left':
        case 'right': {
          const sign = command.kind === 'left' ? 1 : -1;
          const angle = command.useVar ? vars.uhel : command.angle;
          state.heading = normalizeHeading(state.heading + sign * angle);
          record(path);
          break;
        }
        case 'penUp':
        case 'penDown':
          state.penDown = command.kind === 'penDown';
          record(path);
          break;
        case 'goto':
          moveTo(command.x, command.y);
          record(path);
          break;
        case 'color':
          state.color = command.value;
          record(path);
          break;
        case 'fill': {
          const polygon: Point[] = [{ x: state.x, y: state.y }];
          openFills.push(polygon);
          exec(command.body, path);
          openFills.pop();
          if (polygon.length >= 3) {
            fills.push({ polygon, color: command.color });
          }
          record(path);
          break;
        }
        case 'repeat': {
          // Jako Python range(pocet): počet se vyhodnotí jednou na začátku
          const times = command.useVar ? vars.pocet : command.times;
          for (let i = 0; i < times && !truncated; i++) {
            if (++iterations > MAX_ITERATIONS) {
              truncated = true;
              break;
            }
            exec(command.body, path);
          }
          break;
        }
        case 'setVar':
          vars[command.name] = command.value;
          record(path);
          break;
        case 'changeVar':
          vars[command.name] = vars[command.name] + command.by;
          record(path);
          break;
        case 'for':
          for (
            let i = command.from;
            command.step > 0 && i < command.to && !truncated;
            i += command.step
          ) {
            if (++iterations > MAX_ITERATIONS) {
              truncated = true;
              break;
            }
            loopValues.push(i);
            exec(command.body, path);
            loopValues.pop();
          }
          break;
      }
    }
  };

  exec(program, []);
  return { start: initial, steps, segments, fills, truncated };
}
