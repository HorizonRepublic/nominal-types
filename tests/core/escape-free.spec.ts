import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { holdsEscapeFreeText, provesEscapeFree } from '../../src/core/escape-free.ts';
import { ownTypes } from '../../src/core/nominal.ts';
import type { AnyNominalType } from '../../src/index.ts';
import {
  AnyString,
  Base64,
  Base64Url,
  CountryCode,
  CurrencyCode,
  DecimalString,
  DomainName,
  Email,
  Gtin,
  HexColor,
  Hostname,
  HttpUrl,
  IpAddress,
  IpPrefix,
  Ipv4Address,
  Ipv4Prefix,
  Ipv6Address,
  Ipv6Prefix,
  Isbn,
  Isin,
  Issn,
  LanguageTag,
  MacAddress,
  MediaType,
  Nominal,
  NonBlankString,
  NonEmptyString,
  ObjectId,
  SemVer,
  TypeId,
  Ulid,
  Url,
  Uuid,
  UuidV4,
  UuidV7,
} from '../../src/index.ts';
import { sampleTypes } from '../support/samples.ts';

const escapeFree = (type: object): boolean => holdsEscapeFreeText(ownTypes.root, type);

// Valid texts of every type `stringify()` writes between quotes without escaping.
const examples = new Map<AnyNominalType, readonly string[]>([
  [Base64, ['aGVsbG8=', 'YWJjZA==', '+/+/']],
  [Base64Url, ['aGVsbG8', 'a-_b']],
  [CountryCode, ['US', 'UA']],
  [CurrencyCode, ['EUR', 'UAH']],
  [DecimalString, ['12.34', '-0.5', '0']],
  [DomainName, ['example.com', 'xn--80ak6aa92e.com']],
  [Email, ['jane.doe@example.com', "o'hara+x{y}|z~!#$%&*/=?^_`@sub.example.co"]],
  [Gtin, ['036000291452', '96385074']],
  [HexColor, ['#1e90ff', '#fff', '#ffffff80']],
  [Hostname, ['api.example.com', 'localhost', 'a-b']],
  [IpAddress, ['192.0.2.1', '2001:db8::1', '::ffff:192.0.2.1']],
  [IpPrefix, ['10.0.0.0/8', '2001:db8::/32']],
  [Ipv4Address, ['192.0.2.1']],
  [Ipv4Prefix, ['10.0.0.0/8']],
  [Ipv6Address, ['2001:db8::1', 'fe80::1']],
  [Ipv6Prefix, ['2001:db8::/32']],
  [Isbn, ['9780306406157', '080442957X']],
  [Isin, ['US0378331005']],
  [Issn, ['0378-5955']],
  [LanguageTag, ['en-US', 'zh-Hant-TW', 'en-x-priv', 'de-CH-1996']],
  [MacAddress, ['00:00:5e:00:53:01', '00-00-5E-00-53-01']],
  [ObjectId, ['507f1f77bcf86cd799439011']],
  [SemVer, ['1.0.0-rc.1+build.5', '0.0.1']],
  [TypeId, ['user_01h455vb4pex5vsknk084sn02q', '00000000000000000000000000']],
  [Ulid, ['01ARZ3NDEKTSV4RRFFQ69G5FAV']],
  [Uuid, ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF']],
  [UuidV4, ['6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718']],
  [UuidV7, ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']],
]);

// Every character JSON escapes, and the halves of a surrogate pair.
const unsafe = [
  '"',
  '\\',
  ...Array.from({ length: 32 }, (_, code) => String.fromCodePoint(code)),
  '\uD800',
  '\uDFFF',
];

// The text with `char` put at every place in it, and in place of every character.
const tampered = (text: string, char: string): string[] =>
  Array.from({ length: text.length + 1 }, (_, at) => [
    text.slice(0, at) + char + text.slice(at),
    text.slice(0, at) + char + text.slice(at + 1),
  ]).flat();

describe('the escape-free built-in types', () => {
  it('are exactly these', () => {
    expect(
      sampleTypes.filter((type) => escapeFree(type)).map(({ typeName }) => typeName),
    ).toStrictEqual([...examples.keys()].map(({ typeName }) => typeName).toSorted());
  });

  it.each([...examples].map(([type, texts]) => [type.typeName, type, texts] as const))(
    '%s accepts its examples and refuses them with any character JSON escapes',
    (_, type, texts) => {
      const changed = texts.flatMap((text) => unsafe.flatMap((char) => tampered(text, char)));

      expect(texts.filter((text) => !type.accepts(text))).toStrictEqual([]);
      expect(changed.filter((text) => type.accepts(text))).toStrictEqual([]);
    },
  );

  it('leave out types whose text may need escaping', () => {
    const others = [AnyString, NonEmptyString, NonBlankString, Url, HttpUrl, MediaType];

    expect(others.map((type) => escapeFree(type))).toStrictEqual(others.map(() => false));
    expect(MediaType.accepts('text/plain; title="a \\" quote"')).toBe(true);
  });
});

describe('a type of your own', () => {
  it('is escape-free when a pattern proves it', () => {
    class Sku extends AnyString.subtype('escapeFree.Sku', /^[A-Z]{3}-\d{4}$/u) {}
    class Code extends Nominal('escapeFree.Code', /^(?:new|paid)$/u) {}

    expect(escapeFree(Sku)).toBe(true);
    expect(escapeFree(Code)).toBe(true);
  });

  it('is escape-free under an escape-free parent, also as a plain subclass', () => {
    class OrderId extends Uuid.subtype('escapeFree.OrderId') {}
    class Lower extends Uuid.subtype('escapeFree.LowerUuid', /^[^A-F]*$/u) {}
    class Mine extends Uuid {}

    expect(escapeFree(OrderId)).toBe(true);
    expect(escapeFree(Lower)).toBe(true);
    expect(escapeFree(Mine)).toBe(true);
  });

  it('is not escape-free as a variant with a rule of its own', () => {
    const Loose = Uuid.variant('escapeFree.LooseUuid', /^.{36}$/u);

    expect(escapeFree(Loose)).toBe(false);
  });

  it('is not escape-free when a rule from another library may change the value', () => {
    const Quoted = Uuid.subtype(
      'escapeFree.Quoted',
      z.string().transform((text) => `"${text}`),
    );

    expect(escapeFree(Quoted)).toBe(false);
  });

  it('is not escape-free from a pattern the proof refuses', () => {
    expect(escapeFree(AnyString.subtype('escapeFree.Anything', /^.+$/u))).toBe(false);
  });
});

describe('provesEscapeFree()', () => {
  it.each([
    /^[a-z]+$/u,
    /^\d{3}-\w+$/u,
    /^(?:new|paid|shipped)$/u,
    /^[#-[\]-~]$/u,
    new RegExp('^[\\x20\\x21]$', 'u'),
    /^A\.$/u,
    /^(?=.{1,10}$)(?!.*--)[a-z-]+$/u,
    /^(?<word>[a-z]+)$/u,
    /^\bword\b$/u,
    // The proof holds without the u flag too.
    // oxlint-disable-next-line require-unicode-regexp
    /^[a-z]+$/,
  ])('proves %s', (pattern) => {
    expect(provesEscapeFree(pattern)).toBe(true);
  });

  it.each([
    [/^.+$/u, 'any character'],
    [/^[^a]$/u, 'a negated class'],
    [/^[ -~]$/u, 'a range over " and \\'],
    [/^[!-#]$/u, 'a range over "'],
    [/^[Z-a]$/u, 'a range over \\'],
    [/^[\0-a]$/u, 'a control character'],
    [new RegExp('^\\x22$', 'u'), 'an escaped "'],
    [/^\$/u, 'an escaped \\'],
    [/^\\$/u, 'a backslash'],
    [/^\s$/u, 'white space'],
    [/^\S$/u, 'anything but white space'],
    [/^[\b]$/u, 'a backspace'],
    [/^\t$/u, 'a tab'],
    [/^\p{L}$/u, 'a Unicode property'],
    [/^é$/u, 'a character beyond ASCII'],
    [/^(a)\1$/u, 'a backreference'],
    [/^a|"$/u, 'an alternative outside a group'],
    [/[a-z]+$/u, 'no start anchor'],
    [/^[a-z]+/u, 'no end anchor'],
    [/^a\$/u, 'an escaped $ at the end'],
    [/^[a-z]$/gu, 'a flag other than u'],
    [/^[a-z]$/iu, 'the i flag'],
  ])('refuses %s: %s', (pattern) => {
    expect(provesEscapeFree(pattern)).toBe(false);
  });
});
