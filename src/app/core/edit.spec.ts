import { createBlock, getBlock, insertBlock, moveBlock, removeBlock, replaceBlock, shiftBlock } from './edit';
import { Command } from './program';

const fwd = (value: number): Command => ({ kind: 'forward', value });

const program: Command[] = [
  fwd(1),
  { kind: 'repeat', times: 2, body: [fwd(2), fwd(3)] },
  fwd(4),
];

describe('úpravy programu', () => {
  it('vloží blok do těla repeat', () => {
    const result = insertBlock(program, [1], fwd(9), 1);
    expect(getBlock(result, [1, 1])).toEqual(fwd(9));
    expect(program[1]).toEqual({ kind: 'repeat', times: 2, body: [fwd(2), fwd(3)] });
  });

  it('vloží blok na konec programu', () => {
    expect(insertBlock(program, [], fwd(9)).at(-1)).toEqual(fwd(9));
  });

  it('odebere vnořený blok', () => {
    expect(getBlock(removeBlock(program, [1, 0]), [1])).toEqual({
      kind: 'repeat',
      times: 2,
      body: [fwd(3)],
    });
  });

  it('nahradí blok', () => {
    expect(replaceBlock(program, [2], fwd(7))[2]).toEqual(fwd(7));
  });

  it('posune blok nahoru i za hranu', () => {
    expect(shiftBlock(program, [2], -1).map((c) => c.kind)).toEqual(['forward', 'forward', 'repeat']);
    expect(shiftBlock(program, [0], -1)).toEqual(program);
  });

  it('přesune blok do repeat', () => {
    const result = moveBlock(program, [2], [1], 0);
    expect(result).toHaveLength(2);
    expect(getBlock(result, [1, 0])).toEqual(fwd(4));
  });

  it('přesune blok z repeat ven', () => {
    const result = moveBlock(program, [1, 1], [], 0);
    expect(result[0]).toEqual(fwd(3));
    expect(getBlock(result, [2])).toEqual({ kind: 'repeat', times: 2, body: [fwd(2)] });
  });

  it.each([
    [0, 1, [2, 1, 3]],
    [0, 2, [2, 3, 1]],
    [1, 2, [1, 3, 2]],
    [2, 0, [3, 1, 2]],
  ])('přesun ve stejném seznamu %i → %i jako CDK', (from, to, expected) => {
    const list = [fwd(1), fwd(2), fwd(3)];
    const result = moveBlock(list, [from], [], to);
    expect(result.map((c) => (c.kind === 'forward' ? c.value : 0))).toEqual(expected);
  });

  it('přesun do repeat, který je za blokem', () => {
    const result = moveBlock(program, [0], [1], 2);
    expect(getBlock(result, [0, 2])).toEqual(fwd(1));
  });

  it('blok nejde vložit sám do sebe', () => {
    expect(moveBlock(program, [1], [1], 0)).toEqual(program);
  });

  it('nové bloky mají výchozí hodnoty', () => {
    expect(createBlock('repeat')).toEqual({ kind: 'repeat', times: 4, body: [] });
    expect(createBlock('left')).toEqual({ kind: 'left', angle: 90 });
  });
});
