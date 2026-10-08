import { describe, expect, it } from 'vitest';

import { toArk } from '../../src/adapters/arktype/index.ts';
import {
  AnyNumber,
  AnyString,
  Email,
  n,
  Nominal,
  NominalError,
  PositiveInteger,
} from '../../src/index.ts';
import { issuesOf, thrownBy } from '../support/results.ts';

const hidden = (message: string): string => n.hideValues([{ message }])[0]?.message ?? '';

describe('n.hideValues', () => {
  it.each([
    [
      'must be a UUID (was "secret-password-123")',
      'must be a UUID (was a string of 19 characters)',
    ],
    ['must be a UUID (was "x")', 'must be a UUID (was a string of 1 character)'],
    ['must be a UUID (was "")', 'must be a UUID (was an empty string)'],
    ['must be a UUID (was "a\\"b")', 'must be a UUID (was a string of 3 characters)'],
    ['must be a UUID (was "a (was b)")', 'must be a UUID (was a string of 9 characters)'],
    ['must be a UUID (was "broken)', 'must be a UUID (was a value)'],
    ['must be one (was 1.5)', 'must be one (was a number)'],
    ['must be one (was -0)', 'must be one (was a number)'],
    ['must be one (was 1e+21)', 'must be one (was a number)'],
    ['must be one (was NaN)', 'must be one (was a number)'],
    ['must be one (was -Infinity)', 'must be one (was a number)'],
    ['must be one (was -12n)', 'must be one (was a bigint)'],
    ['must be one (was false)', 'must be one (was a boolean)'],
    ['Invalid email: Received "jane@example"', 'Invalid email: Received a string of 12 characters'],
    [
      'Invalid type: Expected string but received 5',
      'Invalid type: Expected string but received a number',
    ],
  ])('hides the value in %j', (message, expected) => {
    expect(hidden(message)).toBe(expected);
  });

  it.each([
    'must be a string (was object)',
    'must be a number (was undefined)',
    'Invalid input: expected string, received number',
    'must not exceed the capacity',
    'is not allowed',
    'must be one (was it)',
  ])('leaves %j as it is', (message) => {
    expect(hidden(message)).toBe(message);
  });

  it('keeps the path, and the issue itself when nothing changes', () => {
    const untouched = { message: 'is not allowed', path: ['admin'] };

    expect(
      n.hideValues([{ message: 'must be one (was 2)', path: ['a', 0] }, untouched]),
    ).toStrictEqual([{ message: 'must be one (was a number)', path: ['a', 0] }, untouched]);
    expect(n.hideValues([untouched])[0]).toBe(untouched);
  });
});

describe('a sensitive type', () => {
  class Password extends Nominal('hidden.Password', /^.{12,}$/u, { sensitive: true }) {}

  it('leaves the value out of parse, new and validate', () => {
    expect(issuesOf(Password.parse('hunter2'))).toStrictEqual([
      { message: 'must be matched by ^.{12,}$ (was a string of 7 characters)' },
    ]);
    expect(thrownBy(() => new Password('hunter2'))).toStrictEqual(
      new NominalError('hidden.Password', [
        { message: 'must be matched by ^.{12,}$ (was a string of 7 characters)' },
      ]),
    );
    expect(Password['~standard'].validate(42)).toStrictEqual({
      issues: [{ message: 'must be a string (was a number)' }],
    });
  });

  it('leaves the value out where it is a field or an item', () => {
    const Login = n.object({ email: AnyString, password: Password });

    expect(issuesOf(Login.parse({ email: 1, password: 'short' }))).toStrictEqual([
      { message: 'must be a string (was 1)', path: ['email'] },
      { message: 'must be matched by ^.{12,}$ (was a string of 5 characters)', path: ['password'] },
    ]);
    expect(issuesOf(n.of(Password).array().parse(['short']))).toStrictEqual([
      { message: 'must be matched by ^.{12,}$ (was a string of 5 characters)', path: [0] },
    ]);
    expect(toArk(Password)('short').toString()).toBe(
      'must be matched by ^.{12,}$ (was a string of 5 characters)',
    );
  });

  it('leaves every field value out when the type holds an object', () => {
    const Card = Nominal('hidden.Card', n.object({ holder: AnyString, number: AnyNumber }), {
      sensitive: true,
    });

    expect(issuesOf(Card.parse({ holder: 'Jane', number: 'x' }))).toStrictEqual([
      { message: 'must be a number (was a string of 1 character)', path: ['number'] },
    ]);
  });

  it('passes the option to its subtypes and variants, which can turn it off', () => {
    const LongPassword = Password.subtype('hidden.LongPassword', /^.{20,}$/u);
    const Shown = Password.subtype('hidden.Shown', undefined, { sensitive: false });
    const Pin = Password.variant('hidden.Pin', /^\d{4}$/u);

    expect(issuesOf(LongPassword.parse('a'.repeat(12)))).toStrictEqual([
      { message: 'must be matched by ^.{20,}$ (was a string of 12 characters)' },
    ]);
    expect(issuesOf(Shown.parse('short'))).toStrictEqual([
      { message: 'must be matched by ^.{12,}$ (was "short")' },
    ]);
    expect(issuesOf(Pin.parse('12a4'))).toStrictEqual([
      { message: 'must be matched by ^\\d{4}$ (was a string of 4 characters)' },
    ]);
  });

  it('makes a subtype of a plain type sensitive', () => {
    const Salary = PositiveInteger.subtype('hidden.Salary', undefined, { sensitive: true });

    expect(issuesOf(Salary.parse(-5000))).toStrictEqual([
      { message: 'must be a positive integer (was a number)' },
    ]);
    expect(issuesOf(PositiveInteger.parse(-5000))).toStrictEqual([
      { message: 'must be a positive integer (was -5000)' },
    ]);
  });

  it('includes Email, since an address is personal data', () => {
    expect(issuesOf(Email.parse('jane@example'))).toStrictEqual([
      { message: 'must be an email address (was a string of 12 characters)' },
    ]);
  });
});
