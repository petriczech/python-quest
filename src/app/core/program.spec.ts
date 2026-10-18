import { countBlocks, usedKinds } from './program';

describe('countBlocks', () => {
  it('počítá i vnořené bloky, repeat jako 1', () => {
    expect(
      countBlocks([
        {
          kind: 'repeat',
          times: 4,
          body: [
            { kind: 'forward', value: 1 },
            { kind: 'left', angle: 90 },
          ],
        },
      ]),
    ).toBe(3);
  });

  it('vrátí použité druhy bloků', () => {
    expect([...usedKinds([{ kind: 'fill', color: 'red', body: [{ kind: 'penUp' }] }])]).toEqual([
      'fill',
      'penUp',
    ]);
  });
});
