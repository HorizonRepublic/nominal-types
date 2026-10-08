import { describe, expectTypeOf, it } from 'vitest';

import { AnyString, Email, n, Nominal, PositiveInteger } from '../../src/index.ts';
import type {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  Base64,
  Base64Url,
  CountryCode,
  CurrencyCode,
  DecimalString,
  DomainName,
  FiniteNumber,
  Float32,
  Gtin,
  HexColor,
  Hostname,
  HttpUrl,
  Int16,
  Int32,
  Int64,
  Int8,
  Integer,
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
  Latitude,
  Longitude,
  MacAddress,
  MediaType,
  Money,
  NegativeBigInt,
  NegativeInteger,
  NegativeNumber,
  NonBlankString,
  NonEmptyString,
  NonNegativeBigInt,
  NonNegativeInteger,
  NonNegativeNumber,
  NonPositiveBigInt,
  NonPositiveInteger,
  NonPositiveNumber,
  ObjectId,
  Port,
  PositiveBigInt,
  PositiveNumber,
  SemVer,
  StandardOf,
  StandardSchemaV1,
  TypeId,
  Uint16,
  Uint32,
  Uint64,
  Uint8,
  Ulid,
  Url,
  Uuid,
  UuidV4,
  UuidV7,
} from '../../src/index.ts';
import type { Instant, PlainDate, PlainDateTime, PlainTime } from '../../src/temporal/index.ts';

type Output<Schema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<Schema>;

describe('the Standard Schema output of each built-in type', () => {
  it('is the class itself', () => {
    expectTypeOf<Output<typeof AnyBigInt>>().toEqualTypeOf<AnyBigInt>();
    expectTypeOf<Output<typeof AnyBoolean>>().toEqualTypeOf<AnyBoolean>();
    expectTypeOf<Output<typeof AnyNumber>>().toEqualTypeOf<AnyNumber>();
    expectTypeOf<Output<typeof AnyString>>().toEqualTypeOf<AnyString>();
    expectTypeOf<Output<typeof Base64>>().toEqualTypeOf<Base64>();
    expectTypeOf<Output<typeof Base64Url>>().toEqualTypeOf<Base64Url>();
    expectTypeOf<Output<typeof CountryCode>>().toEqualTypeOf<CountryCode>();
    expectTypeOf<Output<typeof CurrencyCode>>().toEqualTypeOf<CurrencyCode>();
    expectTypeOf<Output<typeof DecimalString>>().toEqualTypeOf<DecimalString>();
    expectTypeOf<Output<typeof DomainName>>().toEqualTypeOf<DomainName>();
    expectTypeOf<Output<typeof Email>>().toEqualTypeOf<Email>();
    expectTypeOf<Output<typeof FiniteNumber>>().toEqualTypeOf<FiniteNumber>();
    expectTypeOf<Output<typeof Float32>>().toEqualTypeOf<Float32>();
    expectTypeOf<Output<typeof Gtin>>().toEqualTypeOf<Gtin>();
    expectTypeOf<Output<typeof HexColor>>().toEqualTypeOf<HexColor>();
    expectTypeOf<Output<typeof Hostname>>().toEqualTypeOf<Hostname>();
    expectTypeOf<Output<typeof HttpUrl>>().toEqualTypeOf<HttpUrl>();
    expectTypeOf<Output<typeof Int16>>().toEqualTypeOf<Int16>();
    expectTypeOf<Output<typeof Int32>>().toEqualTypeOf<Int32>();
    expectTypeOf<Output<typeof Int64>>().toEqualTypeOf<Int64>();
    expectTypeOf<Output<typeof Int8>>().toEqualTypeOf<Int8>();
    expectTypeOf<Output<typeof Integer>>().toEqualTypeOf<Integer>();
    expectTypeOf<Output<typeof IpAddress>>().toEqualTypeOf<IpAddress>();
    expectTypeOf<Output<typeof IpPrefix>>().toEqualTypeOf<IpPrefix>();
    expectTypeOf<Output<typeof Ipv4Address>>().toEqualTypeOf<Ipv4Address>();
    expectTypeOf<Output<typeof Ipv4Prefix>>().toEqualTypeOf<Ipv4Prefix>();
    expectTypeOf<Output<typeof Ipv6Address>>().toEqualTypeOf<Ipv6Address>();
    expectTypeOf<Output<typeof Ipv6Prefix>>().toEqualTypeOf<Ipv6Prefix>();
    expectTypeOf<Output<typeof Isbn>>().toEqualTypeOf<Isbn>();
    expectTypeOf<Output<typeof Isin>>().toEqualTypeOf<Isin>();
    expectTypeOf<Output<typeof Issn>>().toEqualTypeOf<Issn>();
    expectTypeOf<Output<typeof LanguageTag>>().toEqualTypeOf<LanguageTag>();
    expectTypeOf<Output<typeof Latitude>>().toEqualTypeOf<Latitude>();
    expectTypeOf<Output<typeof Longitude>>().toEqualTypeOf<Longitude>();
    expectTypeOf<Output<typeof MacAddress>>().toEqualTypeOf<MacAddress>();
    expectTypeOf<Output<typeof MediaType>>().toEqualTypeOf<MediaType>();
    expectTypeOf<Output<typeof Money>>().toEqualTypeOf<Money>();
    expectTypeOf<Output<typeof NegativeBigInt>>().toEqualTypeOf<NegativeBigInt>();
    expectTypeOf<Output<typeof NegativeInteger>>().toEqualTypeOf<NegativeInteger>();
    expectTypeOf<Output<typeof NegativeNumber>>().toEqualTypeOf<NegativeNumber>();
    expectTypeOf<Output<typeof NonBlankString>>().toEqualTypeOf<NonBlankString>();
    expectTypeOf<Output<typeof NonEmptyString>>().toEqualTypeOf<NonEmptyString>();
    expectTypeOf<Output<typeof NonNegativeBigInt>>().toEqualTypeOf<NonNegativeBigInt>();
    expectTypeOf<Output<typeof NonNegativeInteger>>().toEqualTypeOf<NonNegativeInteger>();
    expectTypeOf<Output<typeof NonNegativeNumber>>().toEqualTypeOf<NonNegativeNumber>();
    expectTypeOf<Output<typeof NonPositiveBigInt>>().toEqualTypeOf<NonPositiveBigInt>();
    expectTypeOf<Output<typeof NonPositiveInteger>>().toEqualTypeOf<NonPositiveInteger>();
    expectTypeOf<Output<typeof NonPositiveNumber>>().toEqualTypeOf<NonPositiveNumber>();
    expectTypeOf<Output<typeof ObjectId>>().toEqualTypeOf<ObjectId>();
    expectTypeOf<Output<typeof Port>>().toEqualTypeOf<Port>();
    expectTypeOf<Output<typeof PositiveBigInt>>().toEqualTypeOf<PositiveBigInt>();
    expectTypeOf<Output<typeof PositiveInteger>>().toEqualTypeOf<PositiveInteger>();
    expectTypeOf<Output<typeof PositiveNumber>>().toEqualTypeOf<PositiveNumber>();
    expectTypeOf<Output<typeof SemVer>>().toEqualTypeOf<SemVer>();
    expectTypeOf<Output<typeof TypeId>>().toEqualTypeOf<TypeId>();
    expectTypeOf<Output<typeof Uint16>>().toEqualTypeOf<Uint16>();
    expectTypeOf<Output<typeof Uint32>>().toEqualTypeOf<Uint32>();
    expectTypeOf<Output<typeof Uint64>>().toEqualTypeOf<Uint64>();
    expectTypeOf<Output<typeof Uint8>>().toEqualTypeOf<Uint8>();
    expectTypeOf<Output<typeof Ulid>>().toEqualTypeOf<Ulid>();
    expectTypeOf<Output<typeof Url>>().toEqualTypeOf<Url>();
    expectTypeOf<Output<typeof Uuid>>().toEqualTypeOf<Uuid>();
    expectTypeOf<Output<typeof UuidV4>>().toEqualTypeOf<UuidV4>();
    expectTypeOf<Output<typeof UuidV7>>().toEqualTypeOf<UuidV7>();
    expectTypeOf<Output<typeof Instant>>().toEqualTypeOf<Instant>();
    expectTypeOf<Output<typeof PlainDate>>().toEqualTypeOf<PlainDate>();
    expectTypeOf<Output<typeof PlainDateTime>>().toEqualTypeOf<PlainDateTime>();
    expectTypeOf<Output<typeof PlainTime>>().toEqualTypeOf<PlainTime>();
  });
});

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {}

class Handle extends AnyString.subtype('shop.Handle', /^@[a-z]{3,20}$/u) {
  declare public static readonly '~standard': StandardOf<typeof Handle>;

  public get bare(): string {
    return this.value.slice(1);
  }
}

class Nickname extends AnyString.subtype('shop.Nickname', /^[a-z]{3,20}$/u) {
  public get initial(): string {
    return this.value.charAt(0);
  }
}

class Stay extends Nominal('booking.Stay', n.object({ guests: PositiveInteger })) {
  declare public static readonly '~standard': StandardOf<typeof Stay>;

  public get alone(): boolean {
    return this.guests.value === 1;
  }
}

const WorkEmail = Email.variant('shop.WorkEmail', /@example\.com$/u);

describe('the Standard Schema output of your own types', () => {
  it('is the subtype or variant, with its brand', () => {
    expectTypeOf<Output<typeof Username>>().toExtend<Username>();
    expectTypeOf<Username>().toExtend<Output<typeof Username>>();
    expectTypeOf<Output<typeof WorkEmail>>().toEqualTypeOf<(typeof WorkEmail)['prototype']>();
    expectTypeOf<AnyString>().not.toExtend<Output<typeof Username>>();
  });

  it('is the class itself when the class declares StandardOf', () => {
    expectTypeOf<Output<typeof Handle>>().toEqualTypeOf<Handle>();
    expectTypeOf<Output<typeof Stay>>().toEqualTypeOf<Stay>();
    expectTypeOf<StandardSchemaV1.InferInput<typeof Stay>>().toEqualTypeOf<
      StandardSchemaV1.InferInput<(typeof Stay)['rule']>
    >();
  });

  it('lacks the members of a class without StandardOf, which n.of() keeps', () => {
    expectTypeOf<Output<typeof Nickname>>().not.toHaveProperty('initial');
    expectTypeOf<Output<ReturnType<typeof n.of<typeof Nickname>>>>().toEqualTypeOf<Nickname>();
  });
});
