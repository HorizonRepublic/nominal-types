import { type } from 'arktype';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { arkOf, arkSchema } from '../../../src/adapters/arktype/index.ts';
import type { Built } from '../../../src/adapters/arktype/index.ts';
import type * as library from '../../../src/index.ts';
import {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  Email,
  Int8,
  Integer,
  Nominal,
  NonNegativeInteger,
  PositiveInteger,
  schemaOf,
  Uint8,
  Url,
  Uuid,
} from '../../../src/index.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const samples: readonly unknown[] = [
  '',
  'jane@example.com',
  'JANE@EXAMPLE.COM',
  'nope',
  '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F',
  'https://example.com/a',
  'a'.repeat(300),
  0,
  -0,
  1,
  -1,
  127,
  128,
  -128,
  -129,
  255,
  256,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER,
  Number.MAX_SAFE_INTEGER + 1,
  42n,
  '42',
  'true',
  true,
  false,
  null,
  undefined,
  {},
  [],
];

const types = [
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  Email,
  Int8,
  Integer,
  NonNegativeInteger,
  PositiveInteger,
  Uint8,
  Url,
  Uuid,
] as const;

describe('arkOf', () => {
  describe.each(types)('%o', (target) => {
    const node = arkOf(target);

    it.each(samples.map((sample) => [sample]))('agrees with the type on %o', (sample) => {
      const accepted = target.parse(sample).ok;

      expect(!(node(sample) instanceof type.errors)).toBe(accepted);
    });
  });

  it('reports the type message, with the path ArkType adds', () => {
    const result = type({ email: arkOf(Email) })({ email: 'nope' });

    expect(result).toBeInstanceOf(type.errors);
    expect(Reflect.get(result, 'summary')).toBe('email must be an email address (was "nope")');
  });

  it('reports every issue of a type holding an object, with its path, in one message', () => {
    class Range extends Nominal(
      'ArkRange',
      type({ start: schemaOf(PositiveInteger), end: schemaOf(PositiveInteger) }),
    ) {}

    const schema = arkSchema(type({ range: arkOf(Range) }));

    expect(issuesOf(schema.parse({ range: { start: 0, end: -1 } }))).toStrictEqual([
      {
        message:
          'end: must be a positive integer (was -1); start: must be a positive integer (was 0)',
        path: ['range'],
      },
    ]);
  });

  it('returns the value as it came when ArkType runs it alone', () => {
    expect(type({ id: arkOf(Uuid) })({ id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' })).toStrictEqual(
      {
        id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
      },
    );
  });

  it('accepts an instance of the type, a subtype and a parent holding a valid value', () => {
    const node = arkOf(PositiveInteger);

    expect(node(new PositiveInteger(3))).toBeInstanceOf(PositiveInteger);
    expect(node(new Integer(3))).not.toBeInstanceOf(type.errors);
    expect(node(new Integer(0))).toBeInstanceOf(type.errors);
  });

  it('types its input as the type input and its output as the instance', () => {
    const node = arkOf(Email);

    expectTypeOf(node.inferIn).toEqualTypeOf<string>();
    expectTypeOf<Built<typeof node.t>>().toEqualTypeOf<Email>();
  });

  it('works with a type from another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const schema = arkSchema(type({ id: arkOf(copy.Uuid) }));
    const value = valueOf(schema.parse({ id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' }));

    expect(value.id).toBeInstanceOf(Uuid);
    expect(value.id).toBeInstanceOf(copy.Uuid);
  });

  it('builds the very class it was given when two copies hold a type of one name', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const schema = arkSchema(type({ mine: arkOf(Uuid), theirs: arkOf(copy.Uuid) }));
    const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
    const value = valueOf(schema.parse({ mine: id, theirs: id }));

    expect(Object.getPrototypeOf(value.mine)).toBe(Uuid.prototype);
    expect(Object.getPrototypeOf(value.theirs)).toBe(copy.Uuid.prototype);
  });
});
