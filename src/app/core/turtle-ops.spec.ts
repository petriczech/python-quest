import { opsToProgram } from './turtle-ops';

describe('opsToProgram', () => {
  it('převede pohyb, pero, goto a barvu', () => {
    expect(
      opsToProgram([['fd', 10], ['lt', -90], ['pu'], ['goto', 5, -5], ['pd'], ['color', 'red']]),
    ).toEqual([
      { kind: 'forward', value: 10 },
      { kind: 'left', angle: -90 },
      { kind: 'penUp' },
      { kind: 'goto', x: 5, y: -5 },
      { kind: 'penDown' },
      { kind: 'color', value: 'red' },
    ]);
  });

  it('begin_fill … end_fill obalí výplní s barvou z end_fill', () => {
    expect(opsToProgram([['fd', 1], ['begin_fill'], ['fd', 2], ['end_fill', 'blue'], ['fd', 3]])).toEqual([
      { kind: 'forward', value: 1 },
      { kind: 'fill', color: 'blue', body: [{ kind: 'forward', value: 2 }] },
      { kind: 'forward', value: 3 },
    ]);
  });

  it('neuzavřená výplň se nevybarví a end_fill navíc se ignoruje', () => {
    expect(opsToProgram([['end_fill', 'red'], ['begin_fill'], ['fd', 2]])).toEqual([
      { kind: 'forward', value: 2 },
    ]);
  });

  it('nová výplň uprostřed otevřené tu první zahodí', () => {
    expect(
      opsToProgram([['begin_fill'], ['fd', 1], ['begin_fill'], ['fd', 2], ['end_fill', 'red']]),
    ).toEqual([
      { kind: 'forward', value: 1 },
      { kind: 'fill', color: 'red', body: [{ kind: 'forward', value: 2 }] },
    ]);
  });
});
