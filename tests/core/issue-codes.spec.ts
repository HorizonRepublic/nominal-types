import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { columnKindOf } from '../../src/adapters/orm/column.ts';
import { readerOf } from '../../src/adapters/orm/values.ts';
import type { NominalIssue, Parsed } from '../../src/index.ts';
import {
  AnyBigInt,
  AnyString,
  DecimalString,
  Email,
  Int64,
  Money,
  n,
  Nominal,
  NominalError,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { PlainDate } from '../../src/temporal/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, thrownBy } from '../support/results.ts';

resetConfigurationAfterEach();

const withCodes = (parse: () => Parsed<unknown>): readonly NominalIssue[] =>
  configured({ codes: true }, () => issuesOf(parse()));

const Pair = Nominal('codes.Pair', n.object({ id: Uuid, count: PositiveInteger }));
const isEven = (value: unknown): value is number => typeof value === 'number' && value % 2 === 0;
const Even = Nominal('codes.Even', n.satisfying(isEven, 'an even number'));
const Status = AnyString.subtype('codes.Status', n.oneOf('draft', 'paid'));
const Sku = Nominal('codes.Sku', /^[A-Z]{3}-\d{4}$/u);
const Payment = n.union('kind', {
  card: n.object({ last4: AnyString }),
  bank: n.object({ iban: AnyString }),
});
const Stay = n.object(
  { guests: PositiveInteger, capacity: PositiveInteger },
  n.constraint(
    { guests: PositiveInteger, capacity: PositiveInteger },
    ({ guests, capacity }) => guests.value <= capacity.value || 'must not exceed the capacity',
    { path: 'guests' },
  ),
);

describe('the code of each kind of issue', () => {
  it.each<[string, () => Parsed<unknown>, NominalIssue]>([
    [
      'a pattern refusing text',
      () => Sku.parse('abc'),
      { code: 'pattern', message: 'must be matched by ^[A-Z]{3}-\\d{4}$ (was "abc")' },
    ],
    [
      'a pattern given no string',
      () => Sku.parse(42),
      { code: 'not_a_string', message: 'must be a string (was 42)' },
    ],
    [
      'AnyString given no string',
      () => AnyString.parse(42),
      { code: 'not_a_string', message: 'must be a string (was 42)' },
    ],
    [
      'a built-in pattern',
      () => Uuid.parse('nope'),
      { code: 'pattern', message: 'must be a UUID (was "nope")' },
    ],
    [
      'a guard',
      () => Even.parse(3),
      { code: 'invalid', message: 'must be an even number (was 3)' },
    ],
    [
      'a built-in guard',
      () => PositiveInteger.parse(0),
      { code: 'invalid', message: 'must be a positive integer (was 0)' },
    ],
    [
      'a big integer',
      () => AnyBigInt.parse(1.5),
      {
        code: 'invalid',
        message: 'must be a bigint, an integer string or a safe integer (was 1.5)',
      },
    ],
    [
      'a Temporal type',
      () => PlainDate.parse('2023-02-30'),
      { code: 'invalid', message: 'must be a calendar date as YYYY-MM-DD (was "2023-02-30")' },
    ],
    [
      'a listed value',
      () => Status.parse('lost'),
      { code: 'not_one_of', message: 'must be one of "draft", "paid" (was "lost")' },
    ],
    [
      'an unknown tag',
      () => Payment.parse({ kind: 'cash' }),
      { code: 'not_one_of', message: 'must be one of "card", "bank" (was "cash")', path: ['kind'] },
    ],
    [
      'a union given no object',
      () => Payment.parse(1),
      { code: 'not_an_object', message: 'must be an object (was 1)' },
    ],
    [
      'an object given no object',
      () => Pair.parse('x'),
      { code: 'not_an_object', message: 'must be an object (was "x")' },
    ],
    [
      'a missing field',
      () => n.object({ id: Uuid }).parse({}),
      { code: 'required', message: 'is required', path: ['id'] },
    ],
    [
      'an undeclared field',
      () => n.object({}).strict().parse({ id: 1 }),
      { code: 'not_allowed', message: 'is not allowed', path: ['id'] },
    ],
    [
      'a constraint',
      () => Stay.parse({ guests: 3, capacity: 2 }),
      { code: 'constraint', message: 'must not exceed the capacity', path: ['guests'] },
    ],
    [
      'an array given no array',
      () => n.of(Uuid).array().parse('x'),
      { code: 'not_an_array', message: 'must be an array (was "x")' },
    ],
    [
      'too few items',
      () => n.of(Uuid).array({ min: 1 }).parse([]),
      { code: 'too_few_items', message: 'must have at least 1 item (was 0)' },
    ],
    [
      'too many items',
      () => n.of(Uuid).array({ max: 0 }).parse(['x']),
      { code: 'too_many_items', message: 'must have at most 0 items (was 1)' },
    ],
    [
      'fewer items than the length',
      () => n.of(Uuid).array({ length: 2 }).parse([]),
      { code: 'too_few_items', message: 'must have 2 items (was 0)' },
    ],
    [
      'more items than the length',
      () => n.of(Uuid).array({ length: 0 }).parse(['x']),
      { code: 'too_many_items', message: 'must have 0 items (was 1)' },
    ],
    [
      'a repeated item',
      () => n.of(PositiveInteger).array({ unique: true }).parse([1, 1]),
      { code: 'not_unique', message: 'must not repeat an item (was 1)', path: [1] },
    ],
  ])('%s', (_, parse, issue) => {
    expect(withCodes(parse)).toStrictEqual([issue]);
    const { code: _code, ...plain } = issue;

    expect(issuesOf(parse())).toStrictEqual([plain]);
  });

  it('keeps the code under the path of a field, an item and a nested object', () => {
    const Order = n.object({
      lines: n.object({ sku: Sku }).array(),
      owner: n.object({ email: Email }),
    });

    expect(withCodes(() => Order.parse({ lines: [{ sku: 'x' }], owner: {} }))).toStrictEqual([
      {
        code: 'pattern',
        message: 'must be matched by ^[A-Z]{3}-\\d{4}$ (was "x")',
        path: ['lines', 0, 'sku'],
      },
      { code: 'required', message: 'is required', path: ['owner', 'email'] },
    ]);
  });

  it('keeps the code where a sensitive type or fromEnv() hides the value', () => {
    const Env = n.object({ PORT: PositiveInteger }).fromEnv();

    expect(withCodes(() => Email.parse('jane'))).toStrictEqual([
      { code: 'pattern', message: 'must be an email address (was a string of 4 characters)' },
    ]);
    expect(withCodes(() => Env.parse({ PORT: 'x' }))).toStrictEqual([
      {
        code: 'invalid',
        message: 'must be a number (was a string of 1 character)',
        path: ['PORT'],
      },
    ]);
  });

  it('gives no code to an issue from another library', () => {
    const Name = Nominal('codes.Name', z.string().min(2));

    expect(withCodes(() => Name.parse('a'))[0]).not.toHaveProperty('code');
  });

  it('gives a code to the issues copyWith() and the database readers throw', () => {
    const pair = new Pair({ id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', count: 1 });
    const copied = configured({ codes: true }, () =>
      thrownBy(() => pair.copyWith(Object.fromEntries([['other', 1]]))),
    );
    const read = configured({ codes: true }, () =>
      thrownBy(() => readerOf(DecimalString, columnKindOf(DecimalString), false)(12.34)),
    );

    expect(copied).toBeInstanceOf(NominalError);
    expect(copied).toHaveProperty('issues', [
      { code: 'not_allowed', message: 'is not allowed', path: ['other'] },
    ]);
    expect(read).toHaveProperty('issues', [
      {
        code: 'invalid',
        message:
          'must come from the database as text, since a number may have lost digits (was 12.34)',
      },
    ]);
  });

  it('gives a code to the issues of a built-in object type', () => {
    expect(withCodes(() => Money.parse({ amount: '1.234', currency: 'EUR' }))).toStrictEqual([
      {
        code: 'constraint',
        message: 'must have at most 2 digits after the point in EUR',
        path: ['amount'],
      },
    ]);
    expect(withCodes(() => Int64.parse(2 ** 64))).toStrictEqual([
      {
        code: 'invalid',
        message:
          'must be a bigint or an integer string, since a number this large may have lost digits (was 18446744073709552000)',
      },
    ]);
  });
});
