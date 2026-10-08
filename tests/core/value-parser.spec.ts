import { describe, expect, it } from 'vitest';

import { NominalError } from '../../src/core/nominal-error.ts';
import { nothingPending, takePending } from '../../src/core/pending.ts';
import { Rejection } from '../../src/core/rejection.ts';
import { parserFor } from '../../src/core/value-parser.ts';

class Code {
  public readonly value: unknown;

  public constructor(input: unknown) {
    this.value = takePending(Code, input);
  }
}

const run = (input: unknown): unknown =>
  typeof input === 'string' && /^C\d$/u.test(input)
    ? input
    : typeof input === 'object' && input !== null
      ? { ...input }
      : new Rejection([{ message: 'bad' }]);

describe.each([
  ['generated', true],
  ['closure', false],
])('a %s parser', (_, generate) => {
  const parse = parserFor(Code, run, generate);

  it('makes an instance of the type for an accepted value', () => {
    const code = parse('C1');

    expect(code).toBeInstanceOf(Code);
    expect(code).toHaveProperty('value', 'C1');
  });

  it('returns the rejection for a refused value', () => {
    expect(parse('nope')).toStrictEqual(new Rejection([{ message: 'bad' }]));
  });

  it('freezes an object value', () => {
    const value: unknown = Reflect.get(parse({ a: [1] }), 'value');

    expect(Object.isFrozen(value)).toBe(true);
  });

  it('returns the NominalError of a constructor as a rejection', () => {
    class Refusing {
      public readonly value: unknown;

      public constructor() {
        throw new NominalError('Refusing', [{ message: 'refused' }]);
      }
    }

    expect(parserFor(Refusing, run, generate)('C3')).toStrictEqual(
      new Rejection([{ message: 'refused' }]),
    );
    expect(takePending(Refusing, 'C3')).toBe(nothingPending);
  });

  it('empties the slot when the constructor throws', () => {
    class Broken {
      public readonly value: unknown;

      public constructor() {
        throw new Error('broken');
      }
    }

    expect(() => parserFor(Broken, run, generate)('C2')).toThrow('broken');
    expect(takePending(Broken, 'C2')).toBe(nothingPending);
  });
});
