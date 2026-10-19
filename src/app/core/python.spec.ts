import { pythonText, toPython } from './python';

describe('toPython', () => {
  it('vygeneruje smyčku a mapu řádků', () => {
    const code = toPython([
      {
        kind: 'repeat',
        times: 3,
        body: [
          { kind: 'forward', value: 150 },
          { kind: 'left', angle: 120 },
        ],
      },
    ]);
    expect(pythonText(code)).toBe(
      ['from turtle import *', '', 'for i in range(3):', '    forward(150)', '    left(120)', ''].join(
        '\n',
      ),
    );
    expect(code.lineOf.get('0')).toBe(2);
    expect(code.lineOf.get('0,1')).toBe(4);
  });

  it('vnořené smyčky používají další proměnnou', () => {
    const text = pythonText(
      toPython([
        { kind: 'repeat', times: 2, body: [{ kind: 'repeat', times: 4, body: [{ kind: 'penUp' }] }] },
      ]),
    );
    expect(text).toContain('    for j in range(4):\n        penup()');
  });

  it('výplň, barva, goto a prázdné repeat', () => {
    const text = pythonText(
      toPython([
        { kind: 'color', value: 'red' },
        { kind: 'goto', x: 10.5, y: -3 },
        { kind: 'fill', color: '#E8632B', body: [{ kind: 'backward', value: 5 }] },
        { kind: 'repeat', times: 2, body: [] },
      ]),
    );
    expect(text).toMatchInlineSnapshot(`
      "from turtle import *

      pencolor("red")
      goto(10.5, -3)
      fillcolor("#E8632B")
      begin_fill()
      backward(5)
      end_fill()
      for i in range(2):
          pass
      "
    `);
  });

  it('cyklus for vypíše range a proměnnou v délce', () => {
    const text = pythonText(
      toPython([
        {
          kind: 'for',
          from: 5,
          to: 200,
          step: 5,
          body: [
            { kind: 'repeat', times: 1, body: [{ kind: 'forward', value: 9, byVar: true }] },
            { kind: 'backward', value: 9, byVar: true },
            { kind: 'left', angle: 90 },
          ],
        },
        { kind: 'forward', value: 9, byVar: true },
      ]),
    );
    expect(text).toContain(
      [
        'for i in range(5, 200, 5):',
        '    for j in range(1):',
        '        forward(i)',
        '    backward(i)',
        '    left(90)',
        'forward(9)',
      ].join('\n'),
    );
  });

  it('nastaví start, když není v počátku', () => {
    const text = pythonText(toPython([], { x: -75, y: -60, heading: 90 }));
    expect(text).toBe(
      'from turtle import *\n\npenup()\ngoto(-75, -60)\npendown()\nsetheading(90)\n\n',
    );
  });
});
