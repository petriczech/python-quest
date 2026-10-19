import { Command, TurtleState } from './program';

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
          push(`${command.kind}(${command.byVar && forVar ? forVar : num(command.value)})`);
          break;
        case 'left':
        case 'right':
          push(`${command.kind}(${num(command.angle)})`);
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
              ? `${command.times}`
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

export function pythonText(code: PythonCode): string {
  return code.lines.map((line) => line.text).join('\n') + '\n';
}
