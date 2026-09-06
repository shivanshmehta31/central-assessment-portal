import { seededShuffle } from '../shuffle';

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const first = seededShuffle(items, 'attempt-1:question-1');
    const second = seededShuffle(items, 'attempt-1:question-1');
    expect(first).toEqual(second);
  });

  it('produces a different order for a different seed (with high probability)', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const a = seededShuffle(items, 'seed-a');
    const b = seededShuffle(items, 'seed-b');
    expect(a).not.toEqual(b);
  });

  it('never drops or duplicates items', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = seededShuffle(items, 'any-seed');
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const items = ['a', 'b', 'c'];
    const copy = [...items];
    seededShuffle(items, 'seed');
    expect(items).toEqual(copy);
  });
});
