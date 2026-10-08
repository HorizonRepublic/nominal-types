import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { alphabets, characters } from './characters.ts';

/**
 * Strings that match a pattern from its source.
 *
 * @throws {@link SyntaxError} when the source is not a valid pattern.
 *
 * @internal
 */
const matching = (source: string): Arbitrary<string> =>
  fc.stringMatching(new RegExp(`^${source}$`, 'u'));

const alphanumeric = '[A-Za-z0-9]';

/**
 * One to `maxLength` subtags that match a pattern, each after a hyphen.
 *
 * @throws {@link SyntaxError} when the source is not a valid pattern.
 *
 * @internal
 */
const subtags = (source: string, maxLength: number): Arbitrary<string> =>
  fc
    .array(matching(source), { minLength: 1, maxLength })
    .map((parts) => parts.map((part) => `-${part}`).join(''));

// Distinct ignoring case, as RFC 5646 compares variants and singletons.
const distinct = (source: Arbitrary<string>, maxLength: number): Arbitrary<string[]> =>
  fc.uniqueArray(source, { maxLength, selector: (text) => text.toLowerCase() });

const keyword = fc
  .tuple(
    matching(`${alphanumeric}[A-Za-z]`),
    fc.option(subtags(`${alphanumeric}{3,8}`, 2), { nil: '' }),
  )
  .map(([key, value]) => key + value);

const keywords = fc
  .array(keyword, { minLength: 1, maxLength: 2 })
  .map((parts) => parts.map((part) => `-${part}`).join(''));

const unicodeExtension = fc
  .tuple(
    fc.constantFrom('u', 'U'),
    fc.oneof(
      fc
        .tuple(subtags(`${alphanumeric}{3,8}`, 2), fc.option(keywords, { nil: '' }))
        .map(([attributes, rest]) => attributes + rest),
      keywords,
    ),
  )
  .map(([singleton, body]) => singleton + body);

const field = fc
  .tuple(matching('[A-Za-z][0-9]'), subtags(`${alphanumeric}{3,8}`, 2))
  .map(([key, value]) => key + value);

const fields = fc
  .array(field, { minLength: 1, maxLength: 2 })
  .map((parts) => parts.map((part) => `-${part}`).join(''));

const transformedExtension = fc
  .tuple(fc.constantFrom('t', 'T'), fc.oneof(matching('-[A-Za-z]{2,3}(?:-[A-Za-z]{4})?'), fields))
  .map(([singleton, body]) => singleton + body);

const otherExtension = fc
  .tuple(matching('[0-9A-SVWYZa-svwyz]'), subtags(`${alphanumeric}{2,8}`, 3))
  .map(([singleton, body]) => singleton + body);

const extension = fc.oneof(unicodeExtension, transformedExtension, otherExtension);

const variant = matching(`(?:${alphanumeric}{5,8}|[0-9]${alphanumeric}{3})`);

const privateUse = fc
  .tuple(fc.constantFrom('x', 'X'), subtags(`${alphanumeric}{1,8}`, 3))
  .map(([singleton, body]) => singleton + body);

const optional = (part: Arbitrary<string>): Arbitrary<string> =>
  fc.option(
    part.map((text) => `-${text}`),
    { nil: '' },
  );

// A BCP 47 tag: language, script, region, variants, extensions with distinct singletons, and
// private use, each optional after the language.
const languageTag: Arbitrary<string> = fc
  .tuple(
    matching('[A-Za-z]{2,3}'),
    optional(matching('[A-Za-z]{4}')),
    optional(matching('(?:[A-Za-z]{2}|[0-9]{3})')),
    distinct(variant, 2),
    distinct(extension, 3).map((all) =>
      all.filter(
        (one, index) =>
          all.findIndex((other) => other[0]?.toLowerCase() === one[0]?.toLowerCase()) === index,
      ),
    ),
    optional(privateUse),
  )
  .map(
    ([language, script, region, variants, extensions, last]) =>
      language +
      script +
      region +
      [...variants, ...extensions].map((part) => `-${part}`).join('') +
      last,
  );

const versionNumber = fc
  .oneof({ arbitrary: fc.nat({ max: 20 }), weight: 4 }, { arbitrary: fc.maxSafeNat(), weight: 1 })
  .map(String);

const prereleasePart = fc.oneof(versionNumber, matching('\\d{0,2}[A-Za-z-][\\dA-Za-z-]{0,8}'));

const dotted = (part: Arbitrary<string>, sign: string): Arbitrary<string> =>
  fc.option(
    fc.array(part, { minLength: 1, maxLength: 3 }).map((parts) => sign + parts.join('.')),
    { nil: '' },
  );

const semVer: Arbitrary<string> = fc.oneof(
  {
    arbitrary: fc
      .tuple(
        versionNumber,
        versionNumber,
        versionNumber,
        dotted(prereleasePart, '-'),
        dotted(matching('[\\dA-Za-z-]{1,10}'), '+'),
      )
      .map(
        ([major, minor, patch, prerelease, build]) =>
          `${major}.${minor}.${patch}${prerelease}${build}`,
      ),
    weight: 20,
  },
  // The longest version, 256 characters.
  { arbitrary: matching('[\\dA-Za-z-]{250}').map((build) => `0.0.0+${build}`), weight: 1 },
);

const lettersAndDigits = alphabets.alphanumeric;

const nameRest = `${lettersAndDigits}!#$&^_.+-`;

// Names up to 127 characters, mostly short ones.
const mediaName = fc
  .tuple(
    characters(lettersAndDigits, 1),
    fc.oneof({ arbitrary: characters(nameRest, 0, 15), weight: 9 }, characters(nameRest, 0, 126)),
  )
  .map((parts) => parts.join(''));

const token = characters(`${lettersAndDigits}!#$%&'*+.^_\`|~-`, 1, 12);

// Text in quotes: printable ASCII but `"` and `\`, and now and then an escaped character.
const quotedText = `\t !#$%&'()*+,-./:;<=>?@[]^_\`{|}~${lettersAndDigits}`;

const quoted = fc
  .tuple(
    characters(quotedText, 0, 6),
    fc.constantFrom('', '\\"', '\\\\', '\\a'),
    characters(quotedText, 0, 6),
  )
  .map((parts) => `"${parts.join('')}"`);

const space = characters('\t ', 0, 2);

const parameter = fc
  .tuple(space, space, token, fc.oneof(token, quoted))
  .map(([before, after, name, value]) => `${before};${after}${name}=${value}`);

// A type and a subtype, then parameters whose names differ ignoring case.
const mediaType: Arbitrary<string> = fc
  .tuple(
    mediaName,
    mediaName,
    fc.uniqueArray(parameter, {
      maxLength: 3,
      selector: (text) =>
        text
          .slice(text.indexOf(';') + 1, text.indexOf('='))
          .trim()
          .toLowerCase(),
    }),
  )
  .map(([type, subtype, parameters]) => `${type}/${subtype}${parameters.join('')}`);

/**
 * Generators for the built-in types whose grammar is too loose for fast-check to make
 * text of a usual length from its pattern.
 *
 * @internal
 */
export const grammarArbitraries: Readonly<Record<string, () => Arbitrary<unknown>>> = {
  'nominal.LanguageTag': () => languageTag,
  'nominal.MediaType': () => mediaType,
  'nominal.SemVer': () => semVer,
};
