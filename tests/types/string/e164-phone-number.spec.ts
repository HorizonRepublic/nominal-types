import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { E164PhoneNumber, NominalError } from '../../../src/index.ts';
import { disagreementsOf, satisfiesSchema } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

const codes = E164PhoneNumber.countryCallingCodes;

describe('E164PhoneNumber', () => {
  it.each(['+14155552671', '+380441234567', '+442071838750', '+861012345678', '+80012345678'])(
    'accepts %s as given',
    (text) => {
      expect(new E164PhoneNumber(text).value).toBe(text);
    },
  );

  it('accepts the shortest and the longest number', () => {
    expect(E164PhoneNumber.parse('+12').ok).toBe(true);
    expect(E164PhoneNumber.parse(`+1${'2'.repeat(14)}`).ok).toBe(true);
    expect(E164PhoneNumber.parse('+1').ok).toBe(false);
    expect(E164PhoneNumber.parse(`+1${'2'.repeat(15)}`).ok).toBe(false);
  });

  it('carries country calling codes none of which starts another', () => {
    const starting = codes.filter(
      (code) => codes.filter((other) => other.startsWith(code)).length > 1,
    );

    expect(starting).toStrictEqual([]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toHaveLength(214);
  });

  it.each(codes)('accepts the country calling code %s with a digit after it', (code) => {
    const phone = new E164PhoneNumber(`+${code}5`);

    expect(phone.countryCallingCode).toBe(code);
    expect(E164PhoneNumber.parse(`+${code}`).ok).toBe(false);
  });

  it.each(['800', '808', '870', '881', '882', '883', '979', '379', '383'])(
    'knows the assigned code %s',
    (code) => {
      expect(codes).toContain(code);
    },
  );

  it.each([
    ['a spare code', '+2812345678'],
    ['another spare code', '+21012345678'],
    ['a code reserved for maritime services', '+87512345678'],
    ['a code reserved for a future global service', '+99912345678'],
    ['the withdrawn ETNS code', '+38812345678'],
    ['the withdrawn UPT code', '+87812345678'],
    ['the withdrawn code of Kazakhstan', '+99712345678'],
  ])('refuses %s', (_, text) => {
    expect(E164PhoneNumber.parse(text).ok).toBe(false);
  });

  it.each([
    ['no +', '14155552671'],
    ['the 00 international prefix', '0014155552671'],
    ['a 0 after +', '+04155552671'],
    ['two +', '++14155552671'],
    ['spaces', '+1 415 555 2671'],
    ['dashes', '+1-415-555-2671'],
    ['brackets', '+1(415)5552671'],
    ['dots', '+1.415.555.2671'],
    ['a trailing new line', '+14155552671\n'],
    ['an extension', '+14155552671;ext=1'],
    ['letters', '+1415555CALL'],
    ['full-width digits', '+１４１５５５５２６７１'],
    ['Arabic-Indic digits', '+٣٨٠٤٤١٢٣٤٥٦٧'],
    ['zeros alone, which validator.js isMobilePhone accepts', '0000000000'],
    ['a + alone', '+'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new E164PhoneNumber(text)).toThrow(NominalError);
  });

  it.each([42, 14_155_552_671, null, undefined, {}, [], new Object('+14155552671')])(
    'rejects %o',
    (input) => {
      expect(E164PhoneNumber.parse(input).ok).toBe(false);
    },
  );

  const separated = 'must be a phone number in E.164 format, without spaces, dashes or brackets';

  it.each([
    ['+1 415 555 2671', `${separated} (was a string of 15 characters)`],
    ['+1-415-555-2671', `${separated} (was a string of 15 characters)`],
    ['(415) 555-2671', `${separated} (was a string of 14 characters)`],
    ['+2812345678', 'must be a phone number in E.164 format (was a string of 11 characters)'],
    [42, 'must be a phone number in E.164 format (was a number)'],
  ])('says why it refuses %j, and leaves the number out', (text, message) => {
    expect(E164PhoneNumber.parse(text)).toStrictEqual({ ok: false, issues: [{ message }] });
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(E164PhoneNumber.parse(`+${'1'.repeat(100_000)}`).ok).toBe(false);
    expect(E164PhoneNumber.parse(' '.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it.each([
    ['+14155552671', '1', '4155552671'],
    ['+380441234567', '380', '441234567'],
    ['+442071838750', '44', '2071838750'],
    ['+80012345678', '800', '12345678'],
  ])('reads the parts of %s', (text, code, national) => {
    const phone = new E164PhoneNumber(text);

    expect(phone.countryCallingCode).toBe(code);
    expect(phone.nationalNumber).toBe(national);
    expect(phone.digits).toBe(text.slice(1));
  });

  it('compares the text, also with another copy', async () => {
    const copy = await anotherCopy();

    expect(
      new E164PhoneNumber('+14155552671').equals(new copy.E164PhoneNumber('+14155552671')),
    ).toBe(true);
    expect(new E164PhoneNumber('+14155552671').equals(new E164PhoneNumber('+14155552672'))).toBe(
      false,
    );
    expect(new E164PhoneNumber('+14155552671').equals('+14155552671')).toBe(false);
  });
});

// Whether the text has the E.164 shape the schema describes, and only its country calling code is
// wrong: unassigned, or with no digit after it.
const refusedForItsCode = (text: string): boolean =>
  E164PhoneNumber.pattern.test(text) &&
  !codes.some((code) => text.startsWith(`+${code}`) && text.length > code.length + 1);

describe('E164PhoneNumber as JSON Schema', () => {
  it.each(['+12', '+14155552671', `+1${'2'.repeat(14)}`])(
    'accepts %s like the type does',
    (text) => {
      expect(E164PhoneNumber.parse(text).ok).toBe(true);
      expect(
        satisfiesSchema(
          E164PhoneNumber['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
          text,
        ),
      ).toBe(true);
    },
  );

  it.each(['+1', '14155552671', '+04155552671', '+1 415 555 2671', `+1${'2'.repeat(15)}`])(
    'rejects %s like the type does',
    (text) => {
      expect(E164PhoneNumber.parse(text).ok).toBe(false);
      expect(
        satisfiesSchema(
          E164PhoneNumber['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
          text,
        ),
      ).toBe(false);
    },
  );

  const texts = randomTexts(
    ['+', '+1', '+28', '+380', '+999', '0', '1', '5', '9', ' ', '-'],
    20_000,
    8,
  );

  it('describes its shape', () => {
    expect(
      E164PhoneNumber['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
    ).toMatchObject({
      type: 'string',
      pattern: E164PhoneNumber.pattern.source,
      minLength: 3,
      maxLength: 16,
    });
  });

  it('agrees with the type on generated text, apart from the country calling code', () => {
    const disagreements = disagreementsOf(E164PhoneNumber, texts);

    expect(disagreements.filter((text) => !refusedForItsCode(text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => E164PhoneNumber.parse(text).ok).length).toBeGreaterThan(100);
    expect(disagreementsOf(E164PhoneNumber, texts).length).toBeGreaterThan(20);
  });
});
