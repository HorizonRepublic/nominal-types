import { describe, expect, it } from 'vitest';

import { objectShape } from '../../src/core/object-shape.ts';
import { Rejection } from '../../src/core/rejection.ts';
import { AnyString, Email, n, Nominal, NominalError, PositiveInteger } from '../../src/index.ts';
import { issuesOf, thrownBy, valueOf } from '../support/results.ts';

class Pair extends Nominal(
  'input.Pair',
  n.object({ email: Email, count: PositiveInteger, note: n.of(AnyString).optional() }),
) {}

const pairInput = { email: 'jane@example.com', count: 3 };

const inherited = (fields: object, own: object = {}): object => {
  const input = { ...own };

  Reflect.setPrototypeOf(input, fields);

  return input;
};

const copyWithAnyChanges = (target: object, changes: object): unknown =>
  Reflect.apply(Reflect.get(Pair.prototype, 'copyWith'), target, [changes]);

describe('n.object() and the keys of its input', () => {
  it('reads own keys only, so an inherited one counts as missing', () => {
    expect(issuesOf(Pair.parse(inherited(pairInput)))).toStrictEqual([
      { message: 'is required', path: ['email'] },
      { message: 'is required', path: ['count'] },
    ]);

    const pair = valueOf(
      Pair.parse(inherited({ note: 'inherited' }, { email: 'jane@example.com', count: 3 })),
    );

    expect(pair.note).toBeUndefined();
  });

  it('reads an object without a prototype', () => {
    expect(Pair.parse(Object.assign(Object.create(null), pairInput)).ok).toBe(true);
  });

  it.each([true, false])('agrees between the generated function and the loop, %o', (generate) => {
    const fields = [
      { key: 'a', run: (value: unknown) => value, optional: false, describe: () => ({}) },
      { key: 'b', run: (value: unknown) => value, optional: true, describe: () => ({}) },
    ];
    const { run } = objectShape(fields, [], false, generate);

    expect(run(inherited({ a: 1, b: 2 }))).toStrictEqual(
      new Rejection([{ message: 'is required', path: ['a'] }]),
    );
    expect(run(inherited({ b: 2 }, { a: 1 }))).toStrictEqual({ a: 1 });
    expect(run({ a: undefined, b: undefined })).toStrictEqual(
      new Rejection([{ message: 'is required', path: ['a'] }]),
    );
    expect(run({ a: null })).toStrictEqual({ a: null });
  });
});

describe('a missing required field', () => {
  const Order = n.object({
    email: Email,
    backup: n.of(Email).nullable(),
    note: n.of(AnyString).optional(),
  });

  it.each([
    ['absent', {}],
    ['undefined', { email: undefined, backup: undefined }],
  ])('reads "is required" when %s', (_, input) => {
    expect(issuesOf(Order.parse(input))).toStrictEqual([
      { message: 'is required', path: ['email'] },
      { message: 'is required', path: ['backup'] },
    ]);
  });

  it('is not reported for a field whose schema takes undefined', () => {
    expect(valueOf(Order.parse({ email: 'a@b.co', backup: null }))).toStrictEqual({
      email: new Email('a@b.co'),
      backup: null,
    });
  });

  it('comes before unknown keys of a strict schema', () => {
    expect(issuesOf(Order.strict().parse({ backup: null, extra: 1 }))).toStrictEqual([
      { message: 'is required', path: ['email'] },
      { message: 'is not allowed', path: ['extra'] },
    ]);
  });

  it('reads the same in a schema read from environment variables', () => {
    const Config = n.object({ PORT: PositiveInteger, NAME: AnyString }).fromEnv();

    expect(issuesOf(Config.parse({ NAME: 'app' }))).toStrictEqual([
      { message: 'is required', path: ['PORT'] },
    ]);
  });

  it('agrees with the required list of the JSON Schema', () => {
    const schema = Order['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    const missing = issuesOf(Order.parse({})).map(({ path }) => path?.[0]);

    expect(schema['required']).toStrictEqual(missing);
  });
});

describe('copyWith()', () => {
  it('refuses a key the object does not declare', () => {
    const pair = new Pair(pairInput);
    const error = thrownBy(() => copyWithAnyChanges(pair, { extra: 1, other: 2 }));

    expect(error).toBeInstanceOf(NominalError);
    expect(error).toMatchObject({
      typeName: 'input.Pair',
      issues: [
        { message: 'is not allowed', path: ['extra'] },
        { message: 'is not allowed', path: ['other'] },
      ],
    });
  });

  it('refuses it on a subtype too, and still changes a declared field', () => {
    const Small = Pair.subtype(
      'input.SmallPair',
      n.constraint({ count: PositiveInteger }, ({ count }) => count.value < 10, {
        message: 'must be small',
      }),
    );
    const small = new Small(pairInput);

    expect(() => copyWithAnyChanges(small, { value: 1 })).toThrow(NominalError);
    expect(small.copyWith({ count: 4 }).count.value).toBe(4);
    expect(Object.getPrototypeOf(small.copyWith({ count: 4 }))).toBe(Small.prototype);
  });

  it('copies through a constructor of its own that takes the value first', () => {
    class Tagged extends Pair {
      public readonly tag: string;

      public constructor(input: { email: string; count: number }, tag: string = 'copy') {
        super(input);
        this.tag = tag;
      }
    }

    const copy = new Tagged(pairInput, 'first').copyWith({ count: 5 });

    expect(copy).toBeInstanceOf(Tagged);
    expect(copy.count.value).toBe(5);
    expect(copy.tag).toBe('copy');
  });
});
