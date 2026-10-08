import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { maskOf, textOf } from '../types/string/ip-bits.ts';
import { ipv6Source } from '../types/string/ip-patterns.ts';
import { encodePunycode } from '../types/string/punycode.ts';
import { alphabets, characters } from './characters.ts';

const join = (parts: readonly string[], separator: string): string => parts.join(separator);

const { alphanumeric, letters, lower } = alphabets;

// One LDH label, 1 to 63 characters: letters and digits, with hyphens inside.
const ldhLabel: Arbitrary<string> = fc.oneof(
  characters(alphanumeric, 1),
  fc
    .tuple(
      characters(alphanumeric, 1),
      characters(`${alphanumeric}-`, 0, 61),
      characters(alphanumeric, 1),
    )
    .map((parts) => parts.join('')),
);

// Lowercase and uncased letters that NFKC leaves alone, as an internationalised label holds them.
const unicodeLetters = Array.from(
  'abcdefghijklmnopqrstuvwxyz0123456789äöüßéèçñøåæœłśźżčřšžабвгджзиклмнопрстуфхцчшщыэюяαβγδεζηθικλμνξπρστφχψω日本語中文字한국어',
);

const aLabel: Arbitrary<string> = fc
  .tuple(
    fc.array(fc.constantFrom(...unicodeLetters), { minLength: 1, maxLength: 12 }),
    fc.constantFrom('xn--', 'XN--', 'Xn--'),
  )
  .map(([chosen, prefix]) => {
    const points = chosen.map((letter) => letter.codePointAt(0) ?? 0);

    return points.some((point) => point > 127) ? `${prefix}${encodePunycode(points)}` : '';
  })
  .filter((label) => label !== '' && label.length <= 63);

// A host label: no hyphens in its third and fourth places unless it is an `xn--` label.
const hostLabel: Arbitrary<string> = fc.oneof(
  { arbitrary: ldhLabel.filter((label) => label.slice(2, 4) !== '--'), weight: 6 },
  { arbitrary: aLabel, weight: 1 },
);

const topLevel: Arbitrary<string> = fc.oneof(
  { arbitrary: characters(letters, 2, 63), weight: 6 },
  { arbitrary: aLabel, weight: 1 },
);

const allDigits = /^\d+$/u;

// Four labels of 63, 63, 63 and 61 characters make the longest name, 253 characters.
const longestName: Arbitrary<string> = fc
  .tuple(
    characters(lower, 63),
    characters(alphanumeric, 63),
    characters(letters, 63),
    characters(lower, 61),
  )
  .map((labels) => join(labels, '.'));

const hostname: Arbitrary<string> = fc.oneof(
  {
    arbitrary: fc
      .array(hostLabel, { minLength: 1, maxLength: 4 })
      .filter((labels) => !allDigits.test(labels.at(-1) ?? ''))
      .map((labels) => join(labels, '.')),
    weight: 12,
  },
  { arbitrary: longestName, weight: 1 },
);

const domainName: Arbitrary<string> = fc.oneof(
  {
    arbitrary: fc
      .tuple(fc.array(hostLabel, { minLength: 1, maxLength: 3 }), topLevel)
      .map(([labels, last]) => join([...labels, last], '.')),
    weight: 12,
  },
  { arbitrary: longestName, weight: 1 },
);

const atom = characters(`${alphanumeric}!#$%&'*+/=?^_\`{|}~-`, 1, 12);

const local: Arbitrary<string> = fc
  .tuple(
    fc.array(atom, { minLength: 1, maxLength: 3 }),
    fc.option(atom, { nil: undefined, freq: 3 }),
  )
  .map(([atoms, tag]) => join(atoms, '.') + (tag === undefined ? '' : `+${tag}`));

// The domain of an address: LDH labels and a top-level label of letters or `xn--`.
const mailDomain: Arbitrary<string> = fc
  .tuple(
    fc.array(ldhLabel, { minLength: 1, maxLength: 3 }),
    fc.oneof(
      characters(letters, 2, 63),
      characters(`${alphanumeric}-`, 1, 59).map((rest) => `xn--${rest}`),
    ),
  )
  .map(([labels, last]) => join([...labels, last], '.'));

// The limits of RFC 5321: 64 characters before the @, 254 in all, 6 at the least.
const longestAddress: Arbitrary<string> = fc
  .tuple(
    characters(alphanumeric, 64),
    characters(lower, 63),
    characters(lower, 63),
    characters(lower, 61),
  )
  .map(([name, ...labels]) => `${name}@${join(labels, '.')}`);

const shortestAddress = fc
  .tuple(characters(lower, 1), characters(lower, 1), characters(lower, 2))
  .map(([name, label, last]) => `${name}@${label}.${last}`);

const email: Arbitrary<string> = fc.oneof(
  {
    arbitrary: fc.tuple(local, mailDomain).map(([name, domain]) => `${name}@${domain}`),
    weight: 16,
  },
  { arbitrary: longestAddress, weight: 1 },
  { arbitrary: shortestAddress, weight: 1 },
);

// The characters RFC 3986 allows in a path, a query and a fragment without escaping.
const pathCharacters = `${alphanumeric}-._~!$&'()*+,;=:@`;

const escaped = characters(alphabets.hex, 2).map((hex) => `%${hex}`);

const segment = fc
  .array(
    fc.oneof(
      { arbitrary: characters(pathCharacters, 1, 8), weight: 6 },
      { arbitrary: escaped, weight: 1 },
    ),
    { maxLength: 3 },
  )
  .map((parts) => parts.join(''));

const optional = (part: Arbitrary<string>, prefix: string): Arbitrary<string> =>
  fc.option(
    part.map((text) => prefix + text),
    { nil: '' },
  );

const ipv4Number = fc.nat({ max: 0xff_ff_ff_ff });

const dotted = (address: number): string =>
  [24, 16, 8, 0].map((shift) => String((address >>> shift) & 0xff)).join('.');

const ipv4Address: Arbitrary<string> = ipv4Number.map((address) => dotted(address));

const ipv6Address: Arbitrary<string> = fc.stringMatching(new RegExp(ipv6Source, 'u'));

// A scheme, a host by name or address, a port, a path, a query and a fragment.
const hierarchicalUrl = (schemes: Arbitrary<string>): Arbitrary<string> =>
  fc
    .tuple(
      schemes,
      fc.oneof(
        { arbitrary: domainName, weight: 8 },
        { arbitrary: ipv4Address, weight: 1 },
        { arbitrary: ipv6Address.map((address) => `[${address}]`), weight: 1 },
      ),
      optional(fc.nat({ max: 65_535 }).map(String), ':'),
      fc
        .array(segment, { maxLength: 4 })
        .map((segments) => segments.map((part) => `/${part}`).join('')),
      optional(segment, '?'),
      optional(segment, '#'),
    )
    .map(([scheme, host, ...rest]) => `${scheme}://${host}${rest.join('')}`);

const httpUrl: Arbitrary<string> = hierarchicalUrl(fc.mixedCase(fc.constantFrom('http', 'https')));

// A scheme of any name and a path of the characters a URL holds unescaped.
const opaqueUrl: Arbitrary<string> = fc
  .tuple(
    fc.oneof(
      fc.constantFrom('mailto', 'urn', 'data', 'tel', 'javascript', 'file'),
      fc
        .tuple(characters(letters, 1), characters(`${alphanumeric}+.-`, 0, 9))
        .map((parts) => parts.join('')),
    ),
    characters(`${pathCharacters}/`, 1, 24),
  )
  .map(([scheme, path]) => `${scheme}:${path}`);

const url: Arbitrary<string> = fc.oneof(
  hierarchicalUrl(fc.constantFrom('ftp', 'ws', 'wss', 'ssh', 'git', 'redis', 'postgres')),
  opaqueUrl,
  httpUrl,
);

const ipv4Prefix: Arbitrary<string> = fc
  .tuple(ipv4Number, fc.integer({ min: 0, max: 32 }))
  .map(([address, length]) => {
    const mask = length === 0 ? 0 : (0xff_ff_ff_ff << (32 - length)) >>> 0;

    return `${dotted((address & mask) >>> 0)}/${length}`;
  });

// Eight groups with the host bits cleared, written in the RFC 5952 form or in full, with leading
// zeros and either case.
const ipv6Prefix: Arbitrary<string> = fc
  .tuple(
    fc.array(fc.nat({ max: 0xff_ff }), { minLength: 8, maxLength: 8 }),
    fc.integer({ min: 0, max: 128 }),
    fc.constantFrom('short', 'full', 'upper'),
  )
  .map(([numbers, length, form]) => {
    const groups = Uint16Array.from(numbers, (group, index) => group & maskOf(length, index));
    const text =
      form === 'full'
        ? Array.from(groups, (group) => group.toString(16).padStart(4, '0')).join(':')
        : textOf({ version: 6, groups });

    return `${form === 'upper' ? text.toUpperCase() : text}/${length}`;
  });

/**
 * A generator for each built-in host, address and URL type, by name.
 *
 * @internal
 */
export const networkArbitraries: Readonly<Record<string, () => Arbitrary<unknown>>> = {
  'nominal.Email': () => email,
  'nominal.Hostname': () => hostname,
  'nominal.DomainName': () => domainName,
  'nominal.Url': () => url,
  'nominal.HttpUrl': () => httpUrl,
  'nominal.IpAddress': () => fc.oneof(ipv4Address, ipv6Address),
  'nominal.Ipv4Address': () => ipv4Address,
  'nominal.Ipv6Address': () => ipv6Address,
  'nominal.IpPrefix': () => fc.oneof(ipv4Prefix, ipv6Prefix),
  'nominal.Ipv4Prefix': () => ipv4Prefix,
  'nominal.Ipv6Prefix': () => ipv6Prefix,
};
