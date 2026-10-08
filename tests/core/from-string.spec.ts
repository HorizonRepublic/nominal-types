import { describe, expect, it } from 'vitest';

import {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  Email,
  FiniteNumber,
  Integer,
  n,
  Nominal,
  PositiveInteger,
  Uint16,
} from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

describe('fromString() for numbers', () => {
  const number = n.of(AnyNumber).fromString();

  it.each([
    ['0', 0],
    ['-0', -0],
    ['2', 2],
    ['-1.5', -1.5],
    ['1e3', 1000],
    ['1E-3', 0.001],
    ['2.5e+2', 250],
    ['9007199254740993', 9_007_199_254_740_992],
  ])('reads %j as %d', (text, expected) => {
    expect(valueOf(number.parse(text)).value).toBe(expected);
  });

  it.each([
    '',
    ' 2',
    '2 ',
    '+2',
    '02',
    '2.',
    '.5',
    '1_000',
    '0x10',
    '0b1',
    'NaN',
    'Infinity',
    '-',
    '1e',
    '١',
  ])('leaves %j to the rule, which rejects it', (text) => {
    expect(issuesOf(number.parse(text))).toStrictEqual([
      { message: `must be a number (was ${JSON.stringify(text)})` },
    ]);
  });

  it('passes values that are not strings to the rule as they are', () => {
    expect(valueOf(number.parse(7)).value).toBe(7);
    expect(issuesOf(number.parse(true))).toStrictEqual([
      { message: 'must be a number (was true)' },
    ]);
  });

  it('applies the rules of narrower types after reading', () => {
    expect(valueOf(n.of(Uint16).fromString().parse('8080')).value).toBe(8080);
    expect(issuesOf(n.of(Uint16).fromString().parse('70000'))).toStrictEqual([
      { message: 'must be an unsigned 16-bit integer (was 70000)' },
    ]);
    expect(issuesOf(n.of(Integer).fromString().parse('1.5'))).toStrictEqual([
      { message: 'must be a safe integer (was 1.5)' },
    ]);
    expect(issuesOf(n.of(FiniteNumber).fromString().parse('1e400'))).toStrictEqual([
      { message: 'must be a finite number (was Infinity)' },
    ]);
  });

  it('reads every item of an array', () => {
    expect(
      valueOf(n.of(PositiveInteger).fromString().array().parse(['1', 2])).map((page) => page.value),
    ).toStrictEqual([1, 2]);
  });

  it('reads a user subtype through its base type', () => {
    class Port extends Uint16.subtype('Port') {}

    expect(valueOf(n.of(Port).fromString().parse('443'))).toBeInstanceOf(Port);
  });
});

describe('fromString() for other kinds', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('reads %j as a boolean', (text, expected) => {
    expect(valueOf(n.of(AnyBoolean).fromString().parse(text)).value).toBe(expected);
  });

  it.each(['TRUE', 'True', '1', '0', 'yes', '', ' true'])(
    'leaves %j to the boolean rule',
    (text) => {
      expect(n.of(AnyBoolean).fromString().parse(text).ok).toBe(false);
    },
  );

  it('keeps text as it is for string and bigint types', () => {
    expect(valueOf(n.of(Email).fromString().parse('jane@example.com')).value).toBe(
      'jane@example.com',
    );
    expect(valueOf(n.of(AnyBigInt).fromString().parse('42')).value).toBe(42n);
  });

  it('refuses a type with no text form', () => {
    const Sku = Nominal('Sku', /^SKU-\d{4}$/u);

    expect(() => n.of(Sku).fromString()).toThrow(TypeError);
  });

  it('refuses to be called after another method', () => {
    expect(() => n.of(Integer).array().fromString()).toThrow(TypeError);
    expect(() => n.of(Integer).optional().fromString()).toThrow(TypeError);
    expect(() => n.of(Integer).fromString().fromString()).toThrow(TypeError);
  });

  it('describes the value, not the text', () => {
    expect(
      n.of(Integer).fromString()['~standard'].jsonSchema.input({ target: 'openapi-3.0' }),
    ).toStrictEqual(Integer['~standard'].jsonSchema.input({ target: 'openapi-3.0' }));
  });
});
