import { LEVELS } from '../levels/levels';
import { levelStart } from './level';
import { Command } from './program';
import { rasterize } from './raster';
import { run } from './run';
import { feedback, match } from './score';
import { evaluateStars } from './xp';

const triangle = (sides: number): Command[] => {
  const program: Command[] = [];
  for (let i = 0; i < sides; i++) {
    program.push({ kind: 'forward', value: 150 }, { kind: 'left', angle: 120 });
  }
  return program;
};

const score = (reference: Command[], output: Command[]) =>
  match(rasterize(run(reference)), rasterize(run(output)));

describe('match', () => {
  it('shodný program dá 100 %', () => {
    expect(score(triangle(3), triangle(3)).percent).toBe(100);
  });

  it('trojúhelník s chybějící stranou dá méně než 75 %', () => {
    expect(score(triangle(3), triangle(2)).percent).toBeLessThan(75);
  });

  it('prázdný program dá 0 %', () => {
    expect(score(triangle(3), []).percent).toBe(0);
  });

  it('posun o 1 px se toleruje', () => {
    const shifted = run(triangle(3), { x: 1 });
    expect(match(rasterize(run(triangle(3))), rasterize(shifted)).percent).toBe(100);
  });

  it('chybějící výplň sníží skóre', () => {
    const filled: Command[] = [{ kind: 'fill', color: 'orange', body: triangle(3) }];
    const result = score(filled, triangle(3));
    expect(result.lines).toBe(1);
    expect(result.percent).toBeLessThan(65);
  });
});

describe('feedback', () => {
  it('pozná chybějící stranu', () => {
    const reference = run(triangle(3));
    const output = run(triangle(2));
    const result = match(rasterize(reference), rasterize(output));
    expect(feedback(reference, output, result)).toBe('Chybí 1 čára.');
  });

  it('prázdný výstup', () => {
    const reference = run(triangle(3));
    const output = run([]);
    expect(feedback(reference, output, match(rasterize(reference), rasterize(output)))).toContain(
      'nic nenakreslila',
    );
  });
});

describe('úlohy', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))(
    '%s: reference dá 100 %, prázdný program méně než 5 %',
    (_id, level) => {
      const start = levelStart(level);
      const reference = rasterize(run(level.reference, start));
      expect(match(reference, reference).percent).toBe(100);
      expect(match(reference, rasterize(run([], start))).percent).toBeLessThan(5);
    },
  );

  it.each(LEVELS.filter((level) => !level.codeStarter).map((level) => [level.id, level] as const))(
    '%s: vzorové řešení v blocích dá tři hvězdy',
    (_id, level) => {
      expect(evaluateStars(level, level.reference, 100)).toEqual([true, true, true]);
    },
  );

  it.each(LEVELS.map((level) => [level.id, level] as const))('%s: vejde se na plátno', (_id, level) => {
    const trace = run(level.reference, levelStart(level));
    for (const segment of trace.segments) {
      for (const point of [segment.from, segment.to]) {
        expect(Math.abs(point.x)).toBeLessThanOrEqual(190);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(140);
      }
    }
  });
});
