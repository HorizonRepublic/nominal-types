import { type } from 'arktype';
import { z } from 'zod';

import type * as library from '../../src/index.ts';
import { valueOf } from './results.ts';

/**
 * A schema, as `stringify()` sees it, and values for it.
 */
export interface StringifyCase {
  readonly name: string;
  readonly schema: { stringify(value: never): string };
  readonly values: readonly unknown[];
}

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

/**
 * Strings JSON writes with escapes, or that look like they need them and don't.
 */
export const awkwardTexts: readonly string[] = [
  '',
  'plain',
  'quote " inside',
  '"',
  'back\\slash',
  'trailing\\',
  '\\',
  'line\nbreak',
  ...Array.from({ length: 32 }, (_, code) => `control ${String.fromCodePoint(code)} here`),
  '\u007F delete',
  '  and  ',
  'lone high \uD800',
  '\uD800',
  'lone low \uDC00',
  '\uDC00',
  'reversed \uDC00\uD800',
  'emoji 😀 pair',
  '😀',
  'Олена',
  '</script>',
  `${'x'.repeat(100)}\\`,
];

/**
 * Numbers at the edges of what JSON writes.
 */
export const awkwardNumbers: readonly number[] = [
  0,
  -0,
  1.5,
  -1.5,
  1e21,
  1e-7,
  5e-324,
  Number.MAX_SAFE_INTEGER,
  Number.MAX_VALUE,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

const parsedAll = <Value>(
  schema: { parse(input: unknown): library.Parsed<Value> },
  inputs: readonly unknown[],
): Value[] => inputs.map((input) => valueOf(schema.parse(input)));

/**
 * Schemas built with one copy of the package, and values they gave, for tests that hold
 * `stringify()` against `JSON.stringify()`.
 */
export const stringifyCases = (lib: typeof library): StringifyCase[] => {
  const { AnyBigInt, AnyBoolean, AnyNumber, AnyString, Email, Int64, n, Nominal, Uuid } = lib;
  const { PositiveInteger, CountryCode, Ipv6Address } = lib;
  const Line = n.object({ sku: AnyString, quantity: PositiveInteger });
  const Stay = Nominal(
    'stringify.Stay',
    n.object({ guests: PositiveInteger, note: n.of(AnyString).optional() }),
  );
  const Order = n.object({
    id: Uuid,
    contact: Email,
    note: n.of(AnyString).optional(),
    total: Int64,
    paid: AnyBoolean,
    manager: n.of(Uuid).nullable(),
    lines: Line.array(),
    stay: Stay,
    tags: n.of(AnyString).array({ unique: true }),
    country: n.of(CountryCode).optional(),
  });
  const order = {
    id,
    contact: 'jane@example.com',
    total: '9007199254740993',
    paid: true,
    manager: null,
    lines: [{ sku: 'TEA', quantity: 1 }],
    stay: { guests: 2 },
    tags: ['a', 'b'],
  };

  const Base = n.object({
    id: Uuid,
    note: n.of(AnyString).optional(),
    paid: AnyBoolean,
    total: Int64,
  });
  const Payment = n.union('method', {
    card: n.object({ token: AnyString, last4: n.of(AnyString).optional() }),
    invoice: n.object({ email: Email, method: AnyString }),
    empty: n.object({}),
  });
  const helperCases: Array<readonly [string, library.TypeSchema<unknown, unknown>, unknown[]]> = [
    ['partial()', Base.partial(), [{}, { total: '1', id }, { note: '"', paid: false }]],
    [
      'partial(paid)',
      Base.partial('paid'),
      [
        { id, total: '2' },
        { id, total: '2', paid: true },
      ],
    ],
    ['required()', Base.required(), [{ id, note: 'x', paid: true, total: '3' }]],
    ['pick()', Base.pick('total', 'id'), [{ id, total: '4' }]],
    [
      'omit()',
      Base.omit('id'),
      [
        { paid: false, total: '5' },
        { note: 'y', paid: false, total: '5' },
      ],
    ],
    [
      'extend()',
      Base.extend({ tags: n.of(AnyString).array(), paid: n.of(AnyString).optional() }),
      [
        { id, total: '6', tags: ['a'] },
        { id, total: '6', tags: [], paid: 'yes', note: 'z' },
      ],
    ],
    [
      'a union',
      Payment,
      [
        { method: 'card', token: 'tok "1"' },
        { method: 'card', token: 'tok', last4: '4242' },
        { method: 'invoice', email: 'jane@example.com' },
        { method: 'empty' },
      ],
    ],
    [
      'unions in an object and a list',
      n.object({ payments: Payment.array(), main: Payment.nullable() }),
      [
        { payments: [], main: null },
        {
          payments: [{ method: 'empty' }, { method: 'card', token: 'back\\slash' }],
          main: { method: 'empty' },
        },
      ],
    ],
  ];

  return [
    ...helperCases.map(([name, schema, inputs]) => ({
      name,
      schema,
      values: parsedAll(schema, inputs),
    })),
    {
      name: 'AnyString',
      schema: n.of(AnyString),
      values: parsedAll(n.of(AnyString), awkwardTexts),
    },
    {
      name: 'AnyNumber',
      schema: n.of(AnyNumber),
      values: parsedAll(n.of(AnyNumber), awkwardNumbers),
    },
    {
      name: 'AnyBigInt',
      schema: n.of(AnyBigInt),
      values: parsedAll(n.of(AnyBigInt), [0n, -1n, 2n ** 70n, '-9007199254740993']),
    },
    {
      name: 'AnyBoolean',
      schema: n.of(AnyBoolean),
      values: parsedAll(n.of(AnyBoolean), [true, false]),
    },
    {
      name: 'escape-free types',
      schema: n.object({ id: Uuid, email: Email, country: CountryCode, ip: Ipv6Address }),
      values: parsedAll(
        n.object({ id: Uuid, email: Email, country: CountryCode, ip: Ipv6Address }),
        [{ id, email: "o'hara+x@example.com", country: 'UA', ip: '2001:db8::1' }],
      ),
    },
    {
      name: 'an array of optional texts',
      schema: n.of(AnyString).optional().array(),
      values: parsedAll(n.of(AnyString).optional().array(), [
        [],
        ['a', undefined, 'b"'],
        [undefined],
      ]),
    },
    {
      name: 'a nullable array',
      schema: n.of(AnyNumber).array().nullable(),
      values: parsedAll(n.of(AnyNumber).array().nullable(), [null, [], [1, Number.NaN]]),
    },
    {
      name: 'an order',
      schema: Order,
      values: parsedAll(Order, [
        order,
        { ...order, note: 'leave "it" at the door\\' },
        { ...order, country: 'UA', manager: id, lines: [], tags: [] },
        { ...order, stay: { guests: 1, note: '\uD800' } },
      ]),
    },
    {
      name: 'optional fields first and only',
      schema: n.object({ a: n.of(AnyString).optional(), b: n.of(AnyString).optional() }),
      values: parsedAll(
        n.object({ a: n.of(AnyString).optional(), b: n.of(AnyString).optional() }),
        [{}, { a: 'x' }, { b: 'y' }, { a: 'x', b: 'y' }],
      ),
    },
    {
      name: 'an optional field before a required one',
      schema: n.object({ a: n.of(AnyString).optional(), b: AnyString }),
      values: parsedAll(n.object({ a: n.of(AnyString).optional(), b: AnyString }), [
        { b: 'y' },
        { a: 'x', b: 'y' },
      ]),
    },
    { name: 'an empty object', schema: n.object({}), values: [{}] },
    {
      name: 'keys JSON escapes',
      schema: n.object({ 'a"b': AnyString, 'line\nbreak': AnyString, '\\': AnyString }),
      values: parsedAll(n.object({ 'a"b': AnyString, 'line\nbreak': AnyString, '\\': AnyString }), [
        { 'a"b': '1', 'line\nbreak': '2', '\\': '3' },
      ]),
    },
    {
      name: 'an object type',
      schema: n.of(Stay).array(),
      values: parsedAll(n.of(Stay).array(), [[{ guests: 1 }, { guests: 3, note: 'x' }]]),
    },
    {
      name: 'fields from other libraries',
      schema: n.object({
        meta: z.object({ owner: z.instanceof(Uuid), at: z.date() }),
        tags: type('string[]'),
        id: Uuid,
      }),
      values: parsedAll(
        n.object({
          meta: z.object({ owner: z.instanceof(Uuid), at: z.date() }),
          tags: type('string[]'),
          id: Uuid,
        }),
        [{ meta: { owner: new Uuid(id), at: new Date(0) }, tags: ['"'], id }],
      ),
    },
  ];
};
