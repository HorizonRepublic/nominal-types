import 'temporal-polyfill/global';
import * as fc from 'fast-check';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import * as library from '../../src/index.ts';
import {
  AnyString,
  Base64,
  Base64Url,
  Bic,
  CountryCode,
  CurrencyCode,
  DecimalString,
  DomainName,
  E164PhoneNumber,
  Email,
  Gtin,
  HexColor,
  Hostname,
  HttpUrl,
  Iban,
  IpAddress,
  IpPrefix,
  Ipv4Address,
  Ipv4Prefix,
  Ipv6Address,
  Ipv6Prefix,
  Isbn,
  Isin,
  Issn,
  Jwt,
  LanguageTag,
  MacAddress,
  MediaType,
  n,
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
import type { AnyNominalType } from '../../src/index.ts';
import * as temporal from '../../src/temporal/index.ts';
import { TimeZoneId } from '../../src/temporal/index.ts';
import { arbitraryOf } from '../../src/testing/index.ts';
import { nonBlankString } from '../../src/types/string/non-blank-brands.ts';
import { valueOf } from '../support/results.ts';

const blankFree = [NonEmptyString, NonBlankString];

// Every string type with the types it implies besides the types above it, written out in full.
const implications = new Map<AnyNominalType, readonly AnyNominalType[]>([
  [AnyString, []],
  [NonEmptyString, []],
  [NonBlankString, []],
  [Base64, []],
  [Base64Url, []],
  ...[
    Bic,
    CountryCode,
    CurrencyCode,
    DecimalString,
    DomainName,
    E164PhoneNumber,
    Email,
    Gtin,
    HexColor,
    Hostname,
    HttpUrl,
    Iban,
    IpAddress,
    IpPrefix,
    Ipv4Address,
    Ipv4Prefix,
    Ipv6Address,
    Ipv6Prefix,
    Isbn,
    Isin,
    Issn,
    Jwt,
    LanguageTag,
    MacAddress,
    MediaType,
    ObjectId,
    SemVer,
    TimeZoneId,
    TypeId,
    Ulid,
    Url,
    Uuid,
    UuidV4,
    UuidV7,
  ].map((type): [AnyNominalType, readonly AnyNominalType[]] => [type, blankFree]),
]);

const isStringType = (value: unknown): value is AnyNominalType =>
  value === AnyString || (n.isType(value) && Object.prototype.isPrototypeOf.call(AnyString, value));

const stringTypes = [...Object.values(library), ...Object.values(temporal)].filter((value) =>
  isStringType(value),
);

const types = [...implications.keys()];

const typeNames = (list: Iterable<AnyNominalType>): readonly string[] =>
  [...list].map((type) => type.typeName).toSorted();

const ancestorsOf = (type: AnyNominalType): readonly AnyNominalType[] =>
  stringTypes.filter((other) => Object.prototype.isPrototypeOf.call(other, type));

const instancesOf = (type: AnyNominalType): ReadonlyArray<AnyNominalType['prototype']> =>
  fc.sample(arbitraryOf(type, { as: 'instances' }), { numRuns: 20, seed: 7 });

const symbolsOn = (prototype: object): readonly symbol[] => {
  const keys = new Set<symbol>();

  for (let level: unknown = prototype; typeof level === 'object' && level !== null;) {
    for (const key of Object.getOwnPropertySymbols(level)) {
      keys.add(key);
    }

    level = Object.getPrototypeOf(level);
  }

  return [...keys];
};

// The brands a prototype carries besides those of `AnyString`.
const brandsAbove = (prototype: object): readonly string[] =>
  symbolsOn(prototype)
    .filter(
      (key) =>
        Reflect.get(prototype, key) === true && Reflect.get(AnyString.prototype, key) !== true,
    )
    .map((key) => String(Symbol.keyFor(key)))
    .toSorted();

const lengthOf = (text: NonBlankString): number => text.value.length;

describe('implications of the string types', () => {
  it('lists every string type', () => {
    expect(typeNames(types)).toStrictEqual(typeNames(stringTypes));
  });

  describe.each(types.map((type) => [type.typeName, type] as const))('%s', (_, type) => {
    const implied = implications.get(type) ?? [];

    it('is an instance of exactly the types above it and the types it implies', () => {
      for (const instance of instancesOf(type)) {
        expect(typeNames(stringTypes.filter((other) => instance instanceof other))).toStrictEqual(
          typeNames(new Set([type, ...ancestorsOf(type), ...implied])),
        );
      }
    });

    it.each(implied.map((other) => [other.typeName, other] as const))(
      'gives %s every value it accepts',
      (__, other) => {
        fc.assert(
          fc.property(arbitraryOf(type), (value) => {
            expect(other.accepts(value)).toBe(true);
          }),
        );
      },
    );

    it.each(implied.map((other) => [other.typeName, other] as const))(
      'parses an instance into %s, as an instance of that type',
      (__, other) => {
        for (const instance of instancesOf(type)) {
          const parsed = valueOf(other.parse(instance));

          expect(parsed.constructor).toBe(other);
          expect(parsed.value).toBe(instance.value);
          expect(parsed.equals(instance)).toBe(true);
          expect(instance.equals(parsed)).toBe(true);
          expect(other.accepts(instance)).toBe(true);
          expect(valueOf(n.of(other).parse(instance)).constructor).toBe(other);
        }
      },
    );
  });

  it.each([Base64, Base64Url])('leaves %o apart from NonEmptyString, since it takes ""', (type) => {
    const empty = valueOf(type.parse(''));

    expect(empty).not.toBeInstanceOf(NonEmptyString);
    expect(NonEmptyString.accepts(empty)).toBe(false);
  });

  it('never makes NonEmptyString or NonBlankString pass for a type that implies them', () => {
    const text = new NonBlankString('a@example.com');

    expect(text).not.toBeInstanceOf(Email);
    expect(valueOf(Email.parse(text)).constructor).toBe(Email);
    expect(Email.parse(new NonEmptyString(' ')).ok).toBe(false);
  });

  it('stands for NonBlankString with exactly its brands', () => {
    expect(brandsAbove(nonBlankString.prototype)).toStrictEqual(
      brandsAbove(NonBlankString.prototype),
    );
    expect(brandsAbove(nonBlankString.prototype)).toHaveLength(2);
  });

  it('holds for instances built by another copy of the package', async () => {
    vi.resetModules();
    const copy = await import('../../src/index.ts');
    const email = new copy.Email('jane@example.com');

    expect(email).toBeInstanceOf(NonBlankString);
    expect(email).toBeInstanceOf(NonEmptyString);
    expect(new copy.Base64('')).not.toBeInstanceOf(NonEmptyString);

    const parsed = valueOf(NonBlankString.parse(email));

    expect(parsed.constructor).toBe(NonBlankString);
    expect(parsed.equals(email)).toBe(true);
  });

  it('compares by value both ways with the types it implies', () => {
    const id = '0190A6D4-7B6C-7CC4-8F3A-2C1E5B6D7E8F';

    expect(new Uuid(id).equals(new NonBlankString(id))).toBe(true);
    expect(new NonBlankString(id).equals(new Uuid(id))).toBe(true);
    expect(new Uuid(id).equals(new NonBlankString(id.toLowerCase()))).toBe(false);
    expect(new NonBlankString(id.toLowerCase()).equals(new Uuid(id))).toBe(false);
    expect(new Uuid(id).equals(new Uuid(id.toLowerCase()))).toBe(true);
    expect(new Uuid(id).equals(new AnyString(id))).toBe(true);
    expect(new Bic('DEUTDEFF').equals(new NonBlankString('DEUTDEFF'))).toBe(true);
    expect(new Bic('DEUTDEFF').equals(new NonBlankString('DEUTDEFFXXX'))).toBe(false);
  });

  it('writes the same JSON as before', () => {
    expect(JSON.stringify({ email: new Email('jane@example.com') })).toBe(
      '{"email":"jane@example.com"}',
    );
  });
});

describe('string implications at compile time', () => {
  it('lets a type pass where NonEmptyString and NonBlankString are expected', () => {
    expect(lengthOf(new Email('jane@example.com'))).toBe(16);

    expectTypeOf<Email>().toExtend<NonEmptyString>();
    expectTypeOf<Email>().toExtend<NonBlankString>();
    expectTypeOf<E164PhoneNumber>().toExtend<NonBlankString>();
    expectTypeOf<Uuid>().toExtend<NonBlankString>();
    expectTypeOf<UuidV4>().toExtend<NonBlankString>();
    expectTypeOf<UuidV7>().toExtend<NonBlankString>();
    expectTypeOf<Ulid>().toExtend<NonBlankString>();
    expectTypeOf<TypeId>().toExtend<NonBlankString>();
    expectTypeOf<ObjectId>().toExtend<NonBlankString>();
    expectTypeOf<SemVer>().toExtend<NonBlankString>();
    expectTypeOf<Url>().toExtend<NonBlankString>();
    expectTypeOf<HttpUrl>().toExtend<NonBlankString>();
    expectTypeOf<CountryCode>().toExtend<NonBlankString>();
    expectTypeOf<CurrencyCode>().toExtend<NonBlankString>();
    expectTypeOf<DecimalString>().toExtend<NonBlankString>();
    expectTypeOf<LanguageTag>().toExtend<NonBlankString>();
    expectTypeOf<MediaType>().toExtend<NonBlankString>();
    expectTypeOf<HexColor>().toExtend<NonBlankString>();
    expectTypeOf<Jwt>().toExtend<NonBlankString>();
    expectTypeOf<Hostname>().toExtend<NonBlankString>();
    expectTypeOf<DomainName>().toExtend<NonBlankString>();
    expectTypeOf<IpAddress>().toExtend<NonBlankString>();
    expectTypeOf<Ipv4Address>().toExtend<NonBlankString>();
    expectTypeOf<Ipv6Address>().toExtend<NonBlankString>();
    expectTypeOf<IpPrefix>().toExtend<NonBlankString>();
    expectTypeOf<Ipv4Prefix>().toExtend<NonBlankString>();
    expectTypeOf<Ipv6Prefix>().toExtend<NonBlankString>();
    expectTypeOf<MacAddress>().toExtend<NonBlankString>();
    expectTypeOf<Isbn>().toExtend<NonBlankString>();
    expectTypeOf<Issn>().toExtend<NonBlankString>();
    expectTypeOf<Gtin>().toExtend<NonBlankString>();
    expectTypeOf<Isin>().toExtend<NonBlankString>();
    expectTypeOf<Iban>().toExtend<NonBlankString>();
    expectTypeOf<Bic>().toExtend<NonBlankString>();
    expectTypeOf<TimeZoneId>().toExtend<NonBlankString>();
  });

  it('keeps the other direction and the types that imply nothing apart', () => {
    expectTypeOf<NonBlankString>().not.toExtend<Email>();
    expectTypeOf<NonEmptyString>().not.toExtend<Uuid>();
    expectTypeOf<Base64>().not.toExtend<NonEmptyString>();
    expectTypeOf<Base64Url>().not.toExtend<NonEmptyString>();
    expectTypeOf<DomainName>().not.toExtend<Email>();
    expectTypeOf<CountryCode>().not.toExtend<LanguageTag>();
  });
});
