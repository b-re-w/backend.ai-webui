import { sortResourceGroupsByOrder } from './useProjectResourceGroups';
import { describe, expect, it } from 'vitest';

const groups = (...names: string[]) => names.map((name) => ({ name }));
const names = (items: { name: string }[]) => items.map((item) => item.name);

describe('sortResourceGroupsByOrder', () => {
  it('puts listed groups first in list order', () => {
    expect(
      names(
        sortResourceGroupsByOrder(groups('console', 'primary', 'secondary'), [
          'primary',
          'secondary',
          'console',
        ]),
      ),
    ).toEqual(['primary', 'secondary', 'console']);
  });

  it('sorts unlisted groups by name after the listed ones', () => {
    expect(
      names(
        sortResourceGroupsByOrder(groups('zeta', 'console', 'alpha'), [
          'console',
        ]),
      ),
    ).toEqual(['console', 'alpha', 'zeta']);
  });

  it('ignores listed names that are not available', () => {
    expect(
      names(sortResourceGroupsByOrder(groups('b', 'a'), ['missing', 'b'])),
    ).toEqual(['b', 'a']);
  });

  it('sorts by name when no order is configured', () => {
    expect(
      names(
        sortResourceGroupsByOrder(groups('secondary', 'primary'), undefined),
      ),
    ).toEqual(['primary', 'secondary']);
  });
});
