import { describe, expect, it, vi } from 'vitest';

import { Email, n, Nominal, PositiveInteger, Uuid } from '../../src/index.ts';
import { resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, valueOf } from '../support/results.ts';
import { atWork, fewInStock, forwards, twoIds, uuid } from '../support/rule-fixtures.ts';

resetConfigurationAfterEach();

describe('check() on each kind of schema', () => {
  const total = n.rule(
    (lines: { readonly quantity: PositiveInteger; readonly price: PositiveInteger }) =>
      lines.quantity.value * lines.price.value <= 100,
    { path: ['quantity'], code: 'over_budget' },
  );
  const Line = n.object({ quantity: PositiveInteger, price: PositiveInteger });

  it('n.object() runs its rules after its constraints, and keeps its methods', () => {
    const positive = n.constraint({ quantity: PositiveInteger }, () => 'constraint first');
    const Checked = n
      .object({ quantity: PositiveInteger, price: PositiveInteger }, positive)
      .check(total);

    expect(issuesOf(Checked.parse({ quantity: 11, price: 10 }))).toStrictEqual([
      { message: 'constraint first' },
      { code: 'over_budget', message: 'is invalid', path: ['quantity'] },
    ]);
    expect(Checked.keys).toStrictEqual(['quantity', 'price']);
  });

  it('n.object() keeps rules through strict(), required() and extend()', () => {
    const Checked = Line.check(total);
    const issue = { code: 'over_budget', message: 'is invalid', path: ['quantity'] };
    const input = { quantity: 11, price: 10 };

    expect(issuesOf(Checked.strict().parse(input))).toStrictEqual([issue]);
    expect(issuesOf(Checked.required().parse(input))).toStrictEqual([issue]);
    expect(
      issuesOf(Checked.extend({ note: Email }).parse({ ...input, note: 'a@b.co' })),
    ).toStrictEqual([issue]);
  });

  it('n.object() drops rules in partial(), pick() and omit()', () => {
    const Checked = Line.check(total);

    expect(Checked.partial().parse({ quantity: 11, price: 10 }).ok).toBe(true);
    expect(Checked.pick('quantity', 'price').parse({ quantity: 11, price: 10 }).ok).toBe(true);
    expect(Checked.omit('price').parse({ quantity: 11 }).ok).toBe(true);
    expect(Checked.required().parse({ quantity: 11, price: 10 }).ok).toBe(false);
  });

  it('a type built on n.object() with a rule refuses through it', () => {
    class Budget extends Nominal('test.Budget', Line.check(total)) {}

    expect(() => new Budget({ quantity: 11, price: 10 })).toThrow(
      'test.Budget: quantity: is invalid',
    );
    expect(new Budget({ quantity: 2, price: 10 }).quantity.value).toBe(2);
  });

  it('n.union() runs the rules of its variants', () => {
    const Shapes = n.union('kind', { line: Line.check(total) });

    expect(issuesOf(Shapes.parse({ kind: 'line', quantity: 11, price: 10 }))).toStrictEqual([
      { code: 'over_budget', message: 'is invalid', path: ['quantity'] },
    ]);
  });

  it('n.record() runs its rules, keeps them in min() and max(), and drops them in partial()', () => {
    const Stock = n.record(Uuid, PositiveInteger).check(fewInStock);
    const input = { [uuid]: 11 };
    const issue = { code: 'too_many', message: 'is invalid', path: [uuid] };

    expect(issuesOf(Stock.parse(input))).toStrictEqual([issue]);
    expect(issuesOf(Stock.min(1).parse(input))).toStrictEqual([issue]);
    expect(issuesOf(Stock.max(2).parse(input))).toStrictEqual([issue]);
    expect(Stock.partial().parse(input).ok).toBe(true);
    expect(Stock.accepts(input)).toBe(false);
    expect(Stock.keys).toBeUndefined();
  });

  it('n.tuple() runs its rules on the checked items', () => {
    const Range = n.tuple([PositiveInteger, PositiveInteger]).check(forwards);

    expect(issuesOf(Range.parse([3, 2]))).toStrictEqual([{ message: 'must not run backwards' }]);
    expect(valueOf(Range.parse([2, 3]))).toHaveLength(2);
  });

  it('n.of() of one type runs the rule on the instance', () => {
    const Work = n.of(Email).check(atWork);

    expect(issuesOf(Work.parse('jane@other.org'))).toStrictEqual([{ message: 'must be work' }]);
    expect(valueOf(Work.parse('jane@example.com'))).toBeInstanceOf(Email);
  });

  it('optional() before check() hands the rule undefined too', () => {
    const seen = vi.fn<() => boolean>(() => true);

    n.of(Uuid).optional().check(seen).parse(undefined);

    expect(seen).toHaveBeenCalledWith(undefined, expect.any(Function));
  });

  it('an array of checked items checks each item through its rules', () => {
    const Pairs = n.of(Uuid).array().check(twoIds).array();

    expect(issuesOf(Pairs.parse([[uuid, uuid], [uuid]]))).toStrictEqual([
      { message: 'must hold two', path: [1] },
    ]);
    expect(Pairs.accepts([[uuid, uuid]])).toBe(true);
  });
});
