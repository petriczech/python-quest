import { Command } from './program';
import { MAX_STEPS, run } from './run';

const square: Command[] = [
  {
    kind: 'repeat',
    times: 4,
    body: [
      { kind: 'forward', value: 100 },
      { kind: 'left', angle: 90 },
    ],
  },
];

describe('run', () => {
  it('nakreslí čtverec a vrátí se na start', () => {
    const trace = run(square);
    expect(trace.segments).toHaveLength(4);
    expect(trace.segments.map((s) => s.to)).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ]);
    const last = trace.steps.at(-1);
    expect(last).toMatchObject({ x: 0, y: 0, heading: 0 });
  });

  it('rovnostranný trojúhelník se uzavře', () => {
    const trace = run([
      {
        kind: 'repeat',
        times: 3,
        body: [
          { kind: 'forward', value: 150 },
          { kind: 'left', angle: 120 },
        ],
      },
    ]);
    expect(trace.segments).toHaveLength(3);
    expect(trace.segments[1]?.to.x).toBeCloseTo(75);
    expect(trace.segments[1]?.to.y).toBeCloseTo(129.903811);
    expect(trace.segments[2]?.to).toEqual({ x: 0, y: 0 });
  });

  it('vnořené repeat zapisuje cestu k bloku', () => {
    const trace = run([
      {
        kind: 'repeat',
        times: 2,
        body: [{ kind: 'repeat', times: 3, body: [{ kind: 'right', angle: 10 }] }],
      },
    ]);
    expect(trace.steps).toHaveLength(6);
    expect(trace.steps.every((s) => s.path.join() === '0,0,0')).toBe(true);
    expect(trace.steps.at(-1)?.heading).toBe(300);
  });

  it('backward jede proti směru', () => {
    const trace = run([{ kind: 'backward', value: 50 }]);
    expect(trace.segments[0]?.to).toEqual({ x: -50, y: 0 });
  });

  it('penUp nekreslí, ale posouvá', () => {
    const trace = run([
      { kind: 'penUp' },
      { kind: 'forward', value: 40 },
      { kind: 'penDown' },
      { kind: 'forward', value: 10 },
    ]);
    expect(trace.segments).toEqual([
      { from: { x: 40, y: 0 }, to: { x: 50, y: 0 }, color: '#12233B' },
    ]);
  });

  it('goto kreslí, když je pero dole', () => {
    const trace = run([{ kind: 'goto', x: 30, y: -40 }]);
    expect(trace.segments[0]?.to).toEqual({ x: 30, y: -40 });
  });

  it('fill zaznamená polygon a barvu', () => {
    const trace = run([
      {
        kind: 'fill',
        color: '#E8632B',
        body: [
          { kind: 'forward', value: 10 },
          { kind: 'left', angle: 90 },
          { kind: 'forward', value: 10 },
        ],
      },
    ]);
    expect(trace.fills).toEqual([
      {
        color: '#E8632B',
        polygon: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      },
    ]);
    expect(trace.steps.at(-1)?.fillCount).toBe(1);
  });

  it('color mění barvu dalších segmentů', () => {
    const trace = run([
      { kind: 'color', value: 'red' },
      { kind: 'forward', value: 5 },
    ]);
    expect(trace.segments[0]?.color).toBe('red');
  });

  it('respektuje počáteční stav', () => {
    const trace = run([{ kind: 'forward', value: 10 }], { x: -50, y: -20, heading: 90 });
    expect(trace.segments[0]?.to).toEqual({ x: -50, y: -10 });
  });

  it('vnořená prázdná opakuj nezamrznou', () => {
    let program: Command[] = [];
    for (let i = 0; i < 5; i++) {
      program = [{ kind: 'repeat', times: 100, body: program }];
    }
    const trace = run(program);
    expect(trace.truncated).toBe(true);
    expect(trace.steps).toHaveLength(0);
  });

  it('omezí počet kroků', () => {
    const trace = run([
      {
        kind: 'repeat',
        times: 100,
        body: [{ kind: 'repeat', times: 100, body: [{ kind: 'left', angle: 1 }] }],
      },
    ]);
    expect(trace.truncated).toBe(true);
    expect(trace.steps).toHaveLength(MAX_STEPS);
  });

  it('cyklus for dosadí proměnnou do délky a horní mez neprovede', () => {
    const trace = run([
      {
        kind: 'for',
        from: 10,
        to: 40,
        step: 10,
        body: [
          { kind: 'forward', value: 5, byVar: true },
          { kind: 'left', angle: 90 },
        ],
      },
    ]);
    const lengths = trace.segments.map((s) => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y));
    expect(lengths).toEqual([10, 20, 30]);
  });

  it('vnořené opakuj bere proměnnou z nejbližšího for', () => {
    const trace = run([
      {
        kind: 'for',
        from: 1,
        to: 3,
        step: 1,
        body: [{ kind: 'repeat', times: 2, body: [{ kind: 'forward', value: 99, byVar: true }] }],
      },
    ]);
    expect(trace.steps.map((s) => s.x)).toEqual([1, 2, 4, 6]);
  });

  it('délka z proměnné mimo for použije zadanou hodnotu', () => {
    const trace = run([{ kind: 'forward', value: 7, byVar: true }]);
    expect(trace.steps[0]?.x).toBe(7);
  });

  it('for s prázdným rozsahem nic neprovede', () => {
    expect(
      run([{ kind: 'for', from: 50, to: 10, step: 10, body: [{ kind: 'forward', value: 1 }] }])
        .steps,
    ).toHaveLength(0);
  });
});
