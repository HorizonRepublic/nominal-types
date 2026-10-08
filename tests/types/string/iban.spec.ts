import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, Iban, NominalError } from '../../../src/index.ts';
import { disagreementsOf, satisfiesSchema } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';
import { registryExamples } from './fixtures/iban-registry.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

// ISO 7064 MOD 97-10 written apart from the type, with a bigint.
const remainderOf = (text: string): bigint => {
  const moved = text.slice(4) + text.slice(0, 4);
  const digits = Array.from(moved, (character) => String(Number.parseInt(character, 36))).join('');

  return BigInt(digits) % 97n;
};

// The IBAN with the check digits ISO 13616-1 computes for the country and the BBAN.
const ibanOf = (country: string, bban: string): string => {
  const check = 98n - remainderOf(`${country}00${bban}`);

  return `${country}${String(check).padStart(2, '0')}${bban}`;
};

const digits = '0123456789'.split('');
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// The text with each other character of the same kind in place of the one at the index: MOD 97-10
// finds every such change, while a letter for a digit changes two digits of the number it checks.
const changedAt = (text: string, index: number): string[] =>
  (digits.includes(text.charAt(index)) ? digits : letters)
    .filter((character) => character !== text.charAt(index))
    .map((character) => text.slice(0, index) + character + text.slice(index + 1));

const sample = 'GB82WEST12345698765432';

describe('Iban', () => {
  it.each(registryExamples)('accepts the registry example %s', (text) => {
    expect(new Iban(text).value).toBe(text);
  });

  it('knows every country of the registry and no other', () => {
    expect(registryExamples.map((text) => text.slice(0, 2))).toStrictEqual(Iban.countryCodes);
    expect(Iban.countryCodes).toHaveLength(89);
  });

  it.each(registryExamples)('refuses %s one character longer or shorter', (text) => {
    const country = text.slice(0, 2);
    const bban = text.slice(4);
    const longer = ibanOf(country, `${bban}0`);
    const shorter = ibanOf(country, bban.slice(0, -1));

    expect(remainderOf(longer)).toBe(1n);
    expect(Iban.parse(longer).ok).toBe(false);
    expect(Iban.parse(shorter).ok).toBe(false);
  });

  it('accepts the shortest and the longest IBAN of the registry', () => {
    const lengths = registryExamples.map((text) => text.length);

    expect(Math.min(...lengths)).toBe(15);
    expect(Math.max(...lengths)).toBe(33);
    expect(Iban.parse('NO9386011117947').ok).toBe(true);
    expect(Iban.parse('RU0304452522540817810538091310419').ok).toBe(true);
  });

  it.each([
    ['a territory that writes FR', 'GF', '20041010050500013M02606'],
    ['a territory that writes FI', 'AX', '12345600000785'],
    ['a country without IBANs', 'US', '12345678901234567890'],
    ['a country outside the registry', 'DZ', '12341234123412341234'],
    ['Kosovo with the wrong length', 'XK', '121201234567890'],
  ])('refuses %s, with right check digits', (_, country, bban) => {
    const text = ibanOf(country, bban);

    expect(remainderOf(text)).toBe(1n);
    expect(Iban.parse(text).ok).toBe(false);
  });

  it.each([
    ['a letter where Germany has digits', 'DE', '37040044053201300A'],
    ['a digit where Britain has the bank letters', 'GB', 'WES912345698765432'],
    ['a digit where Mauritius has the currency', 'MU', 'BOMM0101101030300200000MU1'],
  ])('refuses %s, with right check digits', (_, country, bban) => {
    const text = ibanOf(country, bban);

    expect(remainderOf(text)).toBe(1n);
    expect(Iban.parse(text).ok).toBe(false);
  });

  it.each([
    ['lower case (VJS #1547)', 'gb82west12345698765432'],
    ['a lowercase country', 'gb82WEST12345698765432'],
    ['a lowercase bank code', 'GB82west12345698765432'],
    ['the print form', 'GB82 WEST 1234 5698 7654 32'],
    ['hyphens, which validator.js strips (VJS #1392)', 'GB82-WEST-1234-5698-7654-32'],
    ['a space around it', ' GB82WEST12345698765432'],
    ['the IBAN prefix', 'IBAN GB82WEST12345698765432'],
    ['a wrong check digit', 'GB83WEST12345698765432'],
    ['letters as check digits', 'GBXXWEST12345698765432'],
    ['full-width characters', 'ＧＢ82WEST12345698765432'],
    ['only a country and check digits', 'GB82'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Iban(text)).toThrow(NominalError);
  });

  it.each([42, null, undefined, {}, [], new Object(sample)])('rejects %o', (input) => {
    expect(Iban.parse(input).ok).toBe(false);
  });

  it.each([
    [
      'GB82WEST12345698765433',
      'must be an IBAN with valid check digits (was a string of 22 characters)',
    ],
    [
      'GB82 WEST 1234 5698 7654 32',
      'must be an IBAN without spaces (was a string of 27 characters)',
    ],
    [
      'GB82-WEST-1234-5698-7654-32',
      'must be an IBAN without spaces (was a string of 27 characters)',
    ],
    [42, 'must be an IBAN with valid check digits (was a number)'],
  ])('says why it refuses %j, and leaves the account out', (text, message) => {
    expect(Iban.parse(text)).toStrictEqual({ ok: false, issues: [{ message }] });
  });

  it.each(['GB82WEST12345698765432', 'NO9386011117947', 'MT84MALT011000012345MTLCAST001S'])(
    'refuses every changed character of %s',
    (text) => {
      const wrong = Array.from(text, (_, index) => changedAt(text, index)).flat();

      expect(wrong.filter((other) => Iban.parse(other).ok)).toStrictEqual([]);
    },
  );

  it.each(['GB82WEST12345698765432', 'DE89370400440532013000'])(
    'refuses every swap of two neighbouring characters of %s',
    (text) => {
      const swapped = Array.from(
        { length: text.length - 1 },
        (_, index) =>
          text.slice(0, index) +
          text.charAt(index + 1) +
          text.charAt(index) +
          text.slice(index + 2),
      ).filter((other) => other !== text);

      expect(swapped.filter((other) => Iban.parse(other).ok)).toStrictEqual([]);
    },
  );

  it.each([
    ['97', '00'],
    ['98', '01'],
    ['02', '99'],
  ])(
    'refuses check digits %s written as %s, which MOD 97-10 alone lets through',
    (right, wrong) => {
      const found = Array.from({ length: 10_000 }, (_, index) =>
        ibanOf('DE', String(index).padStart(18, '0')),
      ).find((text) => text.slice(2, 4) === right);
      const text = String(found);
      const forged = `DE${wrong}${text.slice(4)}`;

      expect(Iban.parse(text).ok).toBe(true);
      expect(remainderOf(forged)).toBe(1n);
      expect(Iban.parse(forged).ok).toBe(false);
    },
  );

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Iban.parse(`GB82${'A'.repeat(100_000)}`).ok).toBe(false);
    expect(Iban.parse(' '.repeat(100_000)).ok).toBe(false);
    expect(Iban.parse('9'.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('reads its parts', () => {
    const iban = new Iban(sample);

    expect(iban.countryCode).toBe('GB');
    expect(iban.checkDigits).toBe('82');
    expect(iban.bban).toBe('WEST12345698765432');
  });

  it.each([
    [sample, 'GB82 WEST 1234 5698 7654 32'],
    ['NO9386011117947', 'NO93 8601 1117 947'],
    ['BE68539007547034', 'BE68 5390 0754 7034'],
    ['RU0304452522540817810538091310419', 'RU03 0445 2522 5408 1781 0538 0913 1041 9'],
  ])('prints %s in groups of four', (text, printed) => {
    expect(new Iban(text).toPrint()).toBe(printed);
    expect(Iban.parse(printed.replaceAll(' ', '')).ok).toBe(true);
  });

  it('compares the text, also with another copy', async () => {
    const copy = await anotherCopy();

    expect(new Iban(sample).equals(new copy.Iban(sample))).toBe(true);
    expect(new Iban(sample).equals(new Iban('GB29NWBK60161331926819'))).toBe(false);
    expect(new Iban(sample).equals(new AnyString(sample))).toBe(true);
    expect(new Iban(sample).equals(sample)).toBe(false);
  });
});

// Whether other check digits or another BBAN shape make the text a valid IBAN: the schema can't
// check either.
const refusedOnlyByTheRegistry = (text: string): boolean =>
  satisfiesSchema(Iban['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text) &&
  !Iban.parse(text).ok;

describe('Iban as JSON Schema', () => {
  it.each(['GB82WEST12345698765432', 'NO9386011117947', 'MT84MALT011000012345MTLCAST001S'])(
    'accepts %s like the type does',
    (text) => {
      expect(Iban.parse(text).ok).toBe(true);
      expect(
        satisfiesSchema(Iban['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
      ).toBe(true);
    },
  );

  it.each([
    'gb82west12345698765432',
    'GB82 WEST 1234 5698 7654 32',
    'GB82',
    `GB82${'1'.repeat(31)}`,
  ])('rejects %s like the type does', (text) => {
    expect(Iban.parse(text).ok).toBe(false);
    expect(
      satisfiesSchema(Iban['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
    ).toBe(false);
  });

  const texts = [
    ...registryExamples,
    ...randomTexts(
      ['GB', 'DE', 'NO', '82', '89', '0', '1', '7', 'A', 'a', ' ', '-', 'WEST'],
      20_000,
      14,
    ),
  ];

  it('describes its shape', () => {
    expect(Iban['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      pattern: Iban.pattern.source,
      minLength: 15,
      maxLength: 34,
    });
  });

  it('agrees with the type on generated text, apart from the registry and the check digits', () => {
    const disagreements = disagreementsOf(Iban, texts);

    expect(disagreements.filter((text) => !refusedOnlyByTheRegistry(text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => Iban.parse(text).ok).length).toBeGreaterThanOrEqual(
      registryExamples.length,
    );
    expect(
      texts.filter(
        (text) =>
          !satisfiesSchema(Iban['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
      ).length,
    ).toBeGreaterThan(1000);
  });
});
