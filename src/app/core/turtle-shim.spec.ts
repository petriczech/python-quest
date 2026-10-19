import { loadPyodide, type PyodideAPI } from 'pyodide';
import { levelStart } from './level';
import { pythonText, toPython } from './python';
import { rasterize } from './raster';
import { run } from './run';
import { match } from './score';
import { TURTLE_SHIM } from './turtle-shim';
import { evaluateCodeStars } from './xp';
import { PythonRunResult, opsToProgram } from './turtle-ops';
import { LEVELS } from '../levels/levels';

// Pyodide se načítá jednou pro celý soubor, start trvá pár sekund
let pyodide: PyodideAPI;

async function runPython(code: string): Promise<PythonRunResult> {
  const runStudent = pyodide.runPython('run_student') as (code: string) => string;
  return JSON.parse(runStudent(code)) as PythonRunResult;
}

// `+ 0` srovná -0 a 0 (start z levelStart může být -0)
const round = (n: number) => Math.round(n * 1000) / 1000 + 0;
const segments = (program: Parameters<typeof run>[0], start = {}) =>
  run(program, start).segments.map((s) => [round(s.from.x), round(s.from.y), round(s.to.x), round(s.to.y), s.color]);

describe('turtle shim v Pyodide', () => {
  beforeAll(async () => {
    pyodide = await loadPyodide();
    pyodide.runPython(TURTLE_SHIM);
  }, 60_000);

  it.each(LEVELS.map((level) => [level.id, level] as const))(
    '%s: Python z bloků nakreslí totéž co bloky',
    async (_id, level) => {
      const start = levelStart(level);
      const result = await runPython(pythonText(toPython(level.reference, start)));
      expect(result.error).toBeNull();
      const program = opsToProgram(result.ops);
      expect(segments(program)).toEqual(segments(level.reference, start));
      expect(run(program).fills.map((f) => f.color)).toEqual(run(level.reference, start).fills.map((f) => f.color));
    },
  );

  it('umí import turtle, funkce s parametry, setheading a circle', async () => {
    const result = await runPython(
      [
        'import turtle',
        'def ctverec(x):',
        '    for _ in range(4):',
        '        turtle.fd(x)',
        '        turtle.lt(90)',
        'turtle.speed(10)',
        'ctverec(50)',
        'turtle.setheading(90)',
        'turtle.circle(20)',
        'print(turtle.heading())',
      ].join('\n'),
    );
    expect(result.error).toBeNull();
    expect(result.output).toBe('90.0\n');
    const trace = run(opsToProgram(result.ops));
    expect(trace.segments.length).toBeGreaterThan(10);
    expect(trace.steps.at(-1)?.heading).toBe(90);
  });

  it('chyba vrátí typ, zprávu a řádek', async () => {
    const result = await runPython('from turtle import *\nforward(10)\nleft("x")\n');
    expect(result.error).toEqual({ type: 'TypeError', message: "čekalo se číslo, přišlo: 'x'", line: 3 });
    expect(result.ops).toEqual([['fd', 10]]);
  });

  it('syntaktická chyba vrátí řádek', async () => {
    const result = await runPython('for i in range(3)\n    forward(1)\n');
    expect(result.error?.type).toBe('SyntaxError');
    expect(result.error?.line).toBe(1);
  });

  it('nekonečné kreslení se utne limitem', async () => {
    const result = await runPython('from turtle import *\nwhile True:\n    forward(1)\n');
    expect(result.truncated).toBe(true);
    expect(result.ops).toHaveLength(5000);
  });

  it('další běh začíná od nuly', async () => {
    await runPython('from turtle import *\nleft(45)\nforward(10)\n');
    const result = await runPython('from turtle import *\nforward(10)\n');
    expect(result.ops).toEqual([['fd', 10]]);
  });

  const KOCH = [
    'def koch(d, n):',
    '    if n == 0:',
    '        forward(d)',
    '        return',
    '    koch(d / 3, n - 1)',
    '    left(60)',
    '    koch(d / 3, n - 1)',
    '    right(120)',
    '    koch(d / 3, n - 1)',
    '    left(60)',
    '    koch(d / 3, n - 1)',
  ];
  const SOLUTIONS: Record<string, string[]> = {
    '5-1': [...KOCH, 'koch(270, 3)'],
    '5-2': [...KOCH, 'for i in range(3):', '    koch(162, 3)', '    right(120)'],
    '5-3': [
      'def strom(d):',
      '    if d < 12:',
      '        return',
      '    forward(d)',
      '    left(30)',
      '    strom(d - 12)',
      '    right(60)',
      '    strom(d - 12)',
      '    left(30)',
      '    backward(d)',
      'left(90)',
      'strom(72)',
    ],
    '5-4': [
      'def sierpinski(d, n):',
      '    if n == 0:',
      '        for i in range(3):',
      '            forward(d)',
      '            left(120)',
      '        return',
      '    sierpinski(d / 2, n - 1)',
      '    forward(d / 2)',
      '    sierpinski(d / 2, n - 1)',
      '    backward(d / 2)',
      '    left(60)',
      '    forward(d / 2)',
      '    right(60)',
      '    sierpinski(d / 2, n - 1)',
      '    left(60)',
      '    backward(d / 2)',
      '    right(60)',
      'sierpinski(240, 3)',
    ],
  };

  SOLUTIONS['5-3 s diakritikou a speed'] = [
    'speed(0)',
    'hideturtle()',
    'def větev(d):',
    '    if d < 12:',
    '        return',
    '    forward(d)',
    '    left(30)',
    '    větev(d - 12)',
    '    right(60)',
    '    větev(d - 12)',
    '    left(30)',
    '    backward(d)',
    'left(90)',
    'větev(72)',
  ];

  it.each(Object.entries(SOLUTIONS))('%s: rekurzivní řešení dá 100 % a tři hvězdy', async (name, solution) => {
    const id = name.split(' ')[0];
    const level = LEVELS.find((l) => l.id === id);
    if (!level) {
      throw new Error(`Chybí úloha ${id}`);
    }
    const start = levelStart(level);
    // Stejný začátek jako kostra v editoru: nastavení startu a pak řešení
    const code = pythonText(toPython([], start)) + solution.join('\n') + '\n';
    const result = await runPython(code);
    expect(result.error).toBeNull();
    const percent = match(rasterize(run(level.reference, start)), rasterize(run(opsToProgram(result.ops)))).percent;
    expect(percent).toBe(100);
    expect(evaluateCodeStars(level, code, percent)).toEqual([true, true, true]);
  });
});
