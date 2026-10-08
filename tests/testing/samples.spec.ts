import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { Email, n, PositiveInteger, Uuid } from '../../src/index.ts';
import { arbitraryOf, invalidArbitraryOf, sampleOf } from '../../src/testing/index.ts';

const Order = n.object({ id: Uuid, quantity: PositiveInteger });

describe('sampleOf()', () => {
  it('makes ten values unless told how many', () => {
    expect(sampleOf(Email)).toHaveLength(10);
    expect(sampleOf(Email, 3)).toHaveLength(3);
    expect(sampleOf(Email, 0)).toStrictEqual([]);
  });

  it('makes the same values for the same seed, and others for another seed', () => {
    expect(sampleOf(Order, 5, { seed: 42 })).toStrictEqual(sampleOf(Order, 5, { seed: 42 }));
    expect(sampleOf(Order, 5, { seed: 42 })).not.toStrictEqual(sampleOf(Order, 5, { seed: 43 }));
  });

  it('makes instances when asked', () => {
    const [order] = sampleOf(Order, 1, { as: 'instances', seed: 1 });

    expect(order?.id).toBeInstanceOf(Uuid);
    expect(sampleOf(Email, 5, { as: 'instances' }).every((email) => email instanceof Email)).toBe(
      true,
    );
  });

  it('makes the inputs as they are, which parse() turns into the same instances', () => {
    const inputs = sampleOf(Email, 5, { seed: 9 });
    const instances = sampleOf(Email, 5, { seed: 9, as: 'instances' });

    expect(instances.map((email) => email.value)).toStrictEqual(inputs);
  });
});

describe('arguments the generators refuse', () => {
  it.each([
    ['arbitraryOf', (): unknown => Reflect.apply(arbitraryOf, undefined, [String])],
    ['invalidArbitraryOf', (): unknown => Reflect.apply(invalidArbitraryOf, undefined, [{}])],
    ['sampleOf', (): unknown => Reflect.apply(sampleOf, undefined, [null])],
  ])('%s() takes only a nominal type or a schema', (name, call) => {
    expect(call).toThrow(
      new RegExp(`^${name}\\(\\) takes a nominal type or a schema built by n\\.of\\(\\)`, 'u'),
    );
  });

  it('refuses a schema whose parts no copy of the package recorded', () => {
    expect(() => arbitraryOf(Object.create(n.of(Uuid)))).toThrow(
      'arbitraryOf(): the schema was not built by n.of(), n.object(), n.record(), n.tuple() or n.union() of this package',
    );
  });

  it('shrinks a failing value to a smaller one the type still accepts', () => {
    const result = fc.check(
      fc.property(arbitraryOf(n.of(Email).array()), (emails) => emails.length < 3),
      { seed: 3 },
    );

    expect(result.failed).toBe(true);
    expect(result.counterexample?.[0]).toHaveLength(3);
    expect(n.of(Email).array().accepts(result.counterexample?.[0])).toBe(true);
  });
});
