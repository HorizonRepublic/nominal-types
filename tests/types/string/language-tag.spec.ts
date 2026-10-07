import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { LanguageTag, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';

const accepted = [
  'en',
  'EN',
  'en-US',
  'EN-us',
  'es-419',
  'zh-Hant-TW',
  'sr-Latn-RS',
  'de-CH-1996',
  'sl-rozaj-biske',
  'hy-Latn-IT-arevela',
  'ja-Latn-hepburn-heploc',
  'en-US-x-twain',
  'en-a-bbb-x-a-ccc',
  'en-u-ca-gregory',
  'de-DE-u-co-phonebk',
  'th-TH-u-nu-thai',
  'en-u-attr-ca-gregory',
  'en-u-ca',
  'en-t-zh',
  'ja-t-it',
  'und-Latn-t-und-cyrl',
  'en-t-h0-hybrid',
  'en-a-bb-u-ca-gregory-z-zz',
  'en-x-a-a',
  'und',
  'qaa',
  'art-lojban',
  'zh-guoyu',
  'xx-YY',
  'abc-abcd-123-1abc-abcdefgh',
  'en-a-abcdefgh',
  'en-x-abcdefgh',
] as const;

const refused = [
  ['', 'empty'],
  ['e', 'a language of one letter'],
  ['abcd', 'a language of four letters'],
  ['french', 'a language of five to eight letters, none of which is registered'],
  ['abcdefghi', 'a subtag of nine characters'],
  ['en_US', 'an underscore'],
  ['en US', 'a space'],
  [' en', 'a leading space'],
  ['en\n', 'a trailing line break'],
  ['en-', 'an empty subtag at the end'],
  ['-en', 'an empty subtag at the start'],
  ['en--US', 'an empty subtag inside'],
  ['ｅｎ', 'full-width letters'],
  ['en-ÄT', 'a letter outside ASCII'],
  ['i-klingon', 'an irregular grandfathered tag'],
  ['en-GB-oed', 'an irregular grandfathered tag'],
  ['sgn-BE-FR', 'an irregular grandfathered tag'],
  ['zh-min-nan', 'extension languages'],
  ['zh-yue', 'an extension language'],
  ['x-private', 'private use alone'],
  ['en-x', 'private use without a subtag'],
  ['en-x-abcdefghi', 'a private use subtag of nine characters'],
  ['en-a', 'an extension without a subtag'],
  ['en-a-b', 'an extension subtag of one character'],
  ['en-a-abcdefghi', 'an extension subtag of nine characters'],
  ['en-u-a1', 'a Unicode key with a digit last'],
  ['en-t-a1', 'a transform key without a value'],
  ['en-t-abcd', 'a transform language of four letters'],
  ['de-1996-1996', 'a variant twice'],
  ['de-1996-DE', 'a region after a variant'],
  ['en-a-bb-a-cc', 'an extension twice'],
  ['en-u-ca-gregory-U-nu-thai', 'an extension twice in other case'],
  ['en-t-de-1996-1996', 'a variant twice in the transform language'],
] as const;

const repeating = [
  'de-1996-1996',
  'en-a-bb-a-cc',
  'en-u-ca-gregory-U-nu-thai',
  'en-t-de-1996-1996',
];

const intlAccepts = (tag: string): boolean => {
  try {
    Intl.getCanonicalLocales(tag);

    return true;
  } catch {
    return false;
  }
};

describe('LanguageTag', () => {
  it.each(accepted)('accepts %s as given', (tag) => {
    expect(new LanguageTag(tag).value).toBe(tag);
  });

  it.each(refused)('refuses %j: %s', (tag) => {
    expect(LanguageTag.parse(tag).ok).toBe(false);
  });

  it.each([42, null, undefined, {}, ['en'], new Object('en'), Symbol('en'), true])(
    'refuses the non-string %s',
    (input) => {
      expect(LanguageTag.parse(input).ok).toBe(false);
    },
  );

  it('VJS #2342, #2100: refuses en_US and french, which validator.js isLocale accepts', () => {
    expect(LanguageTag.parse('en_US').ok).toBe(false);
    expect(LanguageTag.parse('french').ok).toBe(false);
  });

  it('takes only tags Intl takes, so canonical() never throws', () => {
    expect(accepted.filter((tag) => !intlAccepts(tag))).toStrictEqual([]);
  });

  it('reports the rejection in words', () => {
    expect(thrownBy(() => new LanguageTag('en_US'))).toStrictEqual(
      new NominalError('nominal.LanguageTag', [
        { message: 'must be a BCP 47 language tag (was "en_US")' },
      ]),
    );
    expect(issuesOf(LanguageTag.parse(42))).toStrictEqual([
      { message: 'must be a BCP 47 language tag (was 42)' },
    ]);
  });

  it.each([
    ['zh-Hant-TW', 'zh', 'Hant', 'TW'],
    ['ZH-hant-tw', 'zh', 'Hant', 'TW'],
    ['es-419', 'es', undefined, '419'],
    ['sr-latn', 'sr', 'Latn', undefined],
    ['en', 'en', undefined, undefined],
    ['de-1996', 'de', undefined, undefined],
    ['de-CH-1996', 'de', undefined, 'CH'],
    ['en-u-ca-gregory', 'en', undefined, undefined],
    ['en-t-zh-Hant-TW', 'en', undefined, undefined],
    ['en-x-us', 'en', undefined, undefined],
  ])('reads %s as language %s, script %s, region %s', (tag, language, script, region) => {
    const parsed = new LanguageTag(tag);

    expect(parsed.language).toBe(language);
    expect(parsed.script).toBe(script);
    expect(parsed.region).toBe(region);
  });

  it.each([
    ['EN-us', 'en-US'],
    ['zh-hant-tw', 'zh-Hant-TW'],
    ['en-us-x-TWAIN', 'en-US-x-twain'],
  ])('writes %s in its canonical form %s', (tag, canonical) => {
    expect(new LanguageTag(tag).canonical().value).toBe(canonical);
  });

  it('compares regardless of case', () => {
    expect(new LanguageTag('EN-us').equals(new LanguageTag('en-US'))).toBe(true);
    expect(new LanguageTag('en-US').equals(new LanguageTag('en-GB'))).toBe(false);
    expect(new LanguageTag('en-US').equals('en-US')).toBe(false);
  });

  it('refuses a long crafted tag quickly', () => {
    const started = performance.now();

    expect(LanguageTag.parse(`en${'-abcdefgh'.repeat(50_000)}!`).ok).toBe(false);
    expect(LanguageTag.parse(`en-u${'-ab-abc'.repeat(50_000)}-a`).ok).toBe(false);
    expect(LanguageTag.parse(`en-a${'-ab'.repeat(50_000)}-b${'-ab'.repeat(50_000)}-a-ab`).ok).toBe(
      false,
    );
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('describes itself with its pattern', () => {
    expect(LanguageTag['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'nominal.LanguageTag',
      type: 'string',
      pattern: LanguageTag.pattern.source,
      examples: ['en-US'],
      description: 'a BCP 47 language tag',
    });
  });

  describe('agrees with its JSON Schema', () => {
    const schema = LanguageTag['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    it.each(accepted)('on %s', (tag) => {
      expect(satisfiesSchema(schema, tag)).toBe(true);
    });

    it.each(refused.filter(([tag]) => !repeating.includes(tag)))('on %j', (tag) => {
      expect(satisfiesSchema(schema, tag)).toBe(false);
    });

    it.each(repeating)('but for %s, a repeated subtag the pattern cannot see', (tag) => {
      expect(satisfiesSchema(schema, tag)).toBe(true);
      expect(LanguageTag.parse(tag).ok).toBe(false);
    });
  });

  it('takes a tag built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const foreign = new copy.LanguageTag('en-GB');

    expect(valueOf(LanguageTag.parse(foreign)).region).toBe('GB');
    expect(foreign.equals(new LanguageTag('EN-gb'))).toBe(true);
  });
});
