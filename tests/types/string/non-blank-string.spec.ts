import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, NonBlankString, NonEmptyString } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const char = (codePoint: number): string => String.fromCodePoint(codePoint);

const whiteSpace = [
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x16_80, 0x20_00, 0x20_01, 0x20_02, 0x20_03,
  0x20_04, 0x20_05, 0x20_06, 0x20_07, 0x20_08, 0x20_09, 0x20_0a, 0x20_28, 0x20_29, 0x20_2f, 0x20_5f,
  0x30_00,
].map((codePoint) => char(codePoint));

const loneSurrogate = char(0xd8_00);
const zeroWidthSpace = char(0x20_0b);
const byteOrderMark = char(0xfe_ff);
const nonStrings: unknown[] = [0, 1, true, null, undefined, {}, [], 1n, new Object('a')];

const schemaOf = (type: typeof NonEmptyString | typeof NonBlankString): unknown =>
  type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

describe('NonEmptyString', () => {
  it.each(['a', ' ', '\t', zeroWidthSpace, loneSurrogate, char(0x1_f6_00), 'x'.repeat(100_000)])(
    'accepts %j as given',
    (text) => {
      expect(new NonEmptyString(text).value).toBe(text);
    },
  );

  it('rejects the empty string with its own message', () => {
    expect(issuesOf(NonEmptyString.parse(''))).toStrictEqual([
      { message: 'must be a non-empty string (was "")' },
    ]);
  });

  it.each(nonStrings)('rejects %s without converting it', (input) => {
    expect(issuesOf(NonEmptyString.parse(input))).toHaveLength(1);
  });

  it('says what it wanted when the value is not a string', () => {
    expect(issuesOf(NonEmptyString.parse(42))).toStrictEqual([
      { message: 'must be a non-empty string (was 42)' },
    ]);
  });

  it('passes where AnyString is expected', () => {
    const text = new NonEmptyString('a');

    expect(text).toBeInstanceOf(AnyString);
    expect(valueOf(AnyString.parse(text))).toBe(text);
  });

  it('narrows an AnyString that is not empty', () => {
    expect(valueOf(NonEmptyString.parse(new AnyString('a')))).toBeInstanceOf(NonEmptyString);
    expect(NonEmptyString.parse(new AnyString('')).ok).toBe(false);
  });

  it.each(['', 'a', ' ', char(0x1_f6_00), loneSurrogate, 1, null])(
    'agrees with its JSON Schema on %j',
    (value) => {
      expect(satisfiesSchema(schemaOf(NonEmptyString), value)).toBe(NonEmptyString.parse(value).ok);
    },
  );
});

describe('NonBlankString', () => {
  it.each(['a', ' a ', `${' '.repeat(1000)}a`, zeroWidthSpace, byteOrderMark, loneSurrogate])(
    'accepts %j as given, without trimming',
    (text) => {
      expect(new NonBlankString(text).value).toBe(text);
    },
  );

  it.each(whiteSpace)('rejects %j alone', (space) => {
    expect(NonBlankString.parse(space).ok).toBe(false);
    expect(NonBlankString.parse(space.repeat(3)).ok).toBe(false);
  });

  it('rejects every Unicode white space together', () => {
    expect(NonBlankString.parse(whiteSpace.join('')).ok).toBe(false);
  });

  it('rejects what class-validator @IsNotEmpty lets through (typestack/class-validator#1292)', () => {
    expect(issuesOf(NonBlankString.parse('   '))).toStrictEqual([
      { message: 'must be a non-blank string (was "   ")' },
    ]);
  });

  it('reports an empty string by the rule of NonEmptyString', () => {
    expect(issuesOf(NonBlankString.parse(''))).toStrictEqual([
      { message: 'must be a non-empty string (was "")' },
    ]);
  });

  it.each(nonStrings)('rejects %s', (input) => {
    expect(NonBlankString.parse(input).ok).toBe(false);
  });

  it('counts as blank exactly the code points with the White_Space property', () => {
    const codePoints = Array.from({ length: 0x11_00_00 }, (_, codePoint) => codePoint);
    const disagreements = codePoints.filter(
      (codePoint) =>
        NonBlankString.parse(char(codePoint)).ok === /^\p{White_Space}$/u.test(char(codePoint)),
    );

    expect(disagreements).toStrictEqual([]);
  });

  it('differs from trim(): next line is blank, a byte order mark is not', () => {
    expect(char(0x85).trim()).not.toBe('');
    expect(NonBlankString.parse(char(0x85)).ok).toBe(false);
    expect(byteOrderMark.trim()).toBe('');
    expect(NonBlankString.parse(byteOrderMark).ok).toBe(true);
  });

  it.each([...whiteSpace, 'a', ' a', '', zeroWidthSpace, byteOrderMark, loneSurrogate, 1])(
    'agrees with its JSON Schema on %j',
    (value) => {
      expect(satisfiesSchema(schemaOf(NonBlankString), value)).toBe(NonBlankString.parse(value).ok);
    },
  );

  it('passes where NonEmptyString and AnyString are expected', () => {
    const text = new NonBlankString('a');

    expect(text).toBeInstanceOf(NonEmptyString);
    expect(text).toBeInstanceOf(AnyString);
    expect(valueOf(NonEmptyString.parse(text))).toBe(text);
    expect(new NonEmptyString('a')).not.toBeInstanceOf(NonBlankString);
  });

  it('stays fast on a long blank string', () => {
    const started = performance.now();

    expect(NonBlankString.parse(' '.repeat(100_000)).ok).toBe(false);
    expect(NonBlankString.parse(`${' '.repeat(100_000)}a`).ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('narrows a value built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const text = new copy.NonBlankString('a');

    expect(valueOf(NonBlankString.parse(text))).toStrictEqual(new NonBlankString('a'));
    expect(text.equals(new NonBlankString('a'))).toBe(true);
    expect(NonBlankString.parse(new copy.NonEmptyString(' ')).ok).toBe(false);
  });
});
