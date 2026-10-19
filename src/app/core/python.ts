import { Command, TurtleState, VAR_NAMES, VAR_OF, VarName, hasBody } from './program';

export interface PythonLine {
  text: string;
  /** Cesta k bloku, ze kterého řádek vznikl */
  path?: string;
}

export interface PythonCode {
  lines: PythonLine[];
  /** Cesta bloku (`0,1`) → index řádku */
  lineOf: Map<string, number>;
}

const LOOP_VARS = ['i', 'j', 'k', 'm', 'n'];

/** Jméno proměnné cyklu podle hloubky odsazení */
export function loopVar(depth: number): string {
  return LOOP_VARS[depth] ?? `i${depth}`;
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function str(value: string): string {
  return JSON.stringify(value);
}

/** Převede program na Python turtle kód s mapou blok → řádek. */
export function toPython(program: readonly Command[], start?: Partial<TurtleState>): PythonCode {
  const lines: PythonLine[] = [{ text: 'from turtle import *' }, { text: '' }];
  const lineOf = new Map<string, number>();

  if (start && (start.x || start.y)) {
    lines.push({ text: 'penup()' });
    lines.push({ text: `goto(${num(start.x ?? 0)}, ${num(start.y ?? 0)})` });
    lines.push({ text: 'pendown()' });
  }
  if (start?.heading) {
    lines.push({ text: `setheading(${num(start.heading)})` });
  }
  if (lines.length > 2) {
    lines.push({ text: '' });
  }
  // Proměnná použitá dřív, než ji program nastaví, začíná na 0 jako v interpretu
  const uninitialized = uninitializedVars(program);
  for (const name of uninitialized) {
    lines.push({ text: `${name} = 0` });
  }
  if (uninitialized.length) {
    lines.push({ text: '' });
  }

  const emit = (
    commands: readonly Command[],
    prefix: number[],
    depth: number,
    forVar?: string,
  ): void => {
    const indent = '    '.repeat(depth);
    for (const [index, command] of commands.entries()) {
      const pathKey = [...prefix, index].join(',');
      const push = (text: string): void => {
        if (!lineOf.has(pathKey)) {
          lineOf.set(pathKey, lines.length);
        }
        lines.push({ text: indent + text, path: pathKey });
      };
      switch (command.kind) {
        case 'forward':
        case 'backward':
          push(
            `${command.kind}(${command.byVar && forVar ? forVar : command.useVar ? 'delka' : num(command.value)})`,
          );
          break;
        case 'left':
        case 'right':
          push(`${command.kind}(${command.useVar ? 'uhel' : num(command.angle)})`);
          break;
        case 'setVar':
          push(`${command.name} = ${num(command.value)}`);
          break;
        case 'changeVar':
          push(`${command.name} = ${command.name} ${command.by < 0 ? '-' : '+'} ${num(Math.abs(command.by))}`);
          break;
        case 'penUp':
          push('penup()');
          break;
        case 'penDown':
          push('pendown()');
          break;
        case 'goto':
          push(`goto(${num(command.x)}, ${num(command.y)})`);
          break;
        case 'color':
          push(`pencolor(${str(command.value)})`);
          break;
        case 'fill':
          push(`fillcolor(${str(command.color)})`);
          push('begin_fill()');
          emit(command.body, [...prefix, index], depth, forVar);
          push('end_fill()');
          break;
        case 'repeat':
        case 'for': {
          const name = loopVar(depth);
          const range =
            command.kind === 'repeat'
              ? command.useVar
                ? 'pocet'
                : `${command.times}`
              : `${num(command.from)}, ${num(command.to)}, ${num(command.step)}`;
          push(`for ${name} in range(${range}):`);
          if (command.body.length === 0) {
            lines.push({ text: `${indent}    pass`, path: pathKey });
          }
          emit(command.body, [...prefix, index], depth + 1, command.kind === 'for' ? name : forVar);
          break;
        }
      }
    }
  };

  emit(program, [], 0);
  return { lines, lineOf };
}

/**
 * Proměnné, které se v programu použijí a jejichž první výskyt není nastavení na nejvyšší úrovni
 * (nastavení uvnitř opakuj se nemusí provést).
 */
function uninitializedVars(program: readonly Command[]): VarName[] {
  const first = new Map<VarName, boolean>();
  const note = (name: VarName, setsAtTop: boolean): void => {
    if (!first.has(name)) {
      first.set(name, setsAtTop);
    }
  };
  const walk = (commands: readonly Command[], top: boolean): void => {
    for (const command of commands) {
      if (command.kind === 'setVar') {
        note(command.name, top);
      } else if (command.kind === 'changeVar') {
        note(command.name, false);
      } else if ('useVar' in command && command.useVar) {
        const name = VAR_OF[command.kind];
        if (name) {
          note(name, false);
        }
      }
      if (hasBody(command)) {
        // Výplň se provede vždy, cykly nemusí
        walk(command.body, top && command.kind === 'fill');
      }
    }
  };
  walk(program, true);
  return VAR_NAMES.filter((name) => first.get(name) === false);
}

export function pythonText(code: PythonCode): string {
  return code.lines.map((line) => line.text).join('\n') + '\n';
}
