import { loadPyodide, type PyodideAPI } from 'pyodide';
import { levelStart } from './level';
import { pythonText, toPython } from './python';
import { run } from './run';
import { TURTLE_SHIM } from './turtle-shim';
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
});
