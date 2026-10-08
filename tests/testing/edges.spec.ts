import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  AnyBigInt,
  CurrencyCode,
  DecimalString,
  Money,
  TypeId,
  DomainName,
  Email,
  Hostname,
  HttpUrl,
  Int8,
  Int64,
  IpAddress,
  Ipv4Prefix,
  Ipv6Prefix,
  Isbn,
  LanguageTag,
  NegativeNumber,
  NonNegativeInteger,
  NonNegativeNumber,
  NonPositiveNumber,
  PositiveNumber,
  SemVer,
  Uint64,
  Url,
  Uuid,
} from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import { arbitraryOf } from '../../src/testing/index.ts';

const samples = new Map<AnyNominalType, unknown[]>();

// One sample per type, shared by the tests that read it.
const many = (type: AnyNominalType): unknown[] => {
  const known = samples.get(type) ?? fc.sample(arbitraryOf(type), { numRuns: 3000, seed: 11 });

  samples.set(type, known);

  return known;
};

const texts = (type: AnyNominalType): string[] => many(type).map(String);

const fieldOf = (value: unknown, key: string): string =>
  String(typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined);

const fractionOf = (value: unknown): number => fieldOf(value, 'amount').split('.')[1]?.length ?? 0;

// Eight digits after the point for a currency without minor units, such as gold.
const unitsOf = (value: unknown): number =>
  new CurrencyCode(fieldOf(value, 'currency')).minorUnits ?? 8;

const lengths = (type: AnyNominalType): number[] => texts(type).map((text) => text.length);

describe('the edges arbitraryOf() reaches', () => {
  it('makes the lowest and highest Int8 and -0', () => {
    const values = many(Int8);

    expect(values).toContain(-128);
    expect(values).toContain(127);
    expect(values.some((value) => Object.is(value, -0))).toBe(true);
  });

  it('keeps -0 where the rule takes it and leaves it out where it does not', () => {
    expect(many(NonNegativeNumber).some((value) => Object.is(value, -0))).toBe(true);
    expect(many(NonPositiveNumber).some((value) => Object.is(value, -0))).toBe(true);
    expect(many(NonNegativeInteger).some((value) => Object.is(value, -0))).toBe(true);
    expect(many(NegativeNumber).some((value) => Object.is(value, -0))).toBe(false);
    expect(many(PositiveNumber).filter((value) => Number(value) <= 0)).toStrictEqual([]);
  });

  it('makes the smallest numbers next to an excluded bound', () => {
    expect(many(PositiveNumber)).toContain(Number.MIN_VALUE);
    expect(many(NegativeNumber)).toContain(-Number.MIN_VALUE);
  });

  it('makes big integers as bigints, as text and as numbers, out to the bounds', () => {
    const values = many(Int64);

    expect(values.some((value) => typeof value === 'bigint')).toBe(true);
    expect(values.some((value) => typeof value === 'string')).toBe(true);
    expect(values.some((value) => typeof value === 'number')).toBe(true);
    expect(values.map(String)).toContain(String(-(2n ** 63n)));
    expect(texts(Uint64)).toContain(String(2n ** 64n - 1n));
  });

  it('makes the longest text AnyBigInt reads, 1000 characters', () => {
    expect(Math.max(...lengths(AnyBigInt))).toBe(1000);
  });

  it('makes the shortest and the longest email address', () => {
    const all = lengths(Email);

    expect(Math.min(...all)).toBe(6);
    expect(Math.max(...all)).toBe(254);
    expect(texts(Email).some((text) => text.indexOf('@') === 64)).toBe(true);
  });

  it('makes email addresses with dots and plus tags', () => {
    const all = texts(Email);

    expect(all.some((text) => /^[^@]+\.[^@]+@/u.test(text))).toBe(true);
    expect(all.some((text) => /\+[^@]*@/u.test(text))).toBe(true);
    expect(all.some((text) => /@.*\.xn--/u.test(text))).toBe(true);
  });

  it('makes the longest host name and labels of 63 characters', () => {
    expect(Math.max(...lengths(Hostname))).toBe(253);
    expect(
      texts(Hostname).some((text) => text.split('.').some((label) => label.length === 63)),
    ).toBe(true);
  });

  it('makes host and domain names with internationalised labels in either case', () => {
    expect(texts(Hostname).some((text) => /(?:^|\.)xn--/u.test(text))).toBe(true);
    expect(texts(DomainName).some((text) => /(?:^|\.)XN--/u.test(text))).toBe(true);
  });

  it('makes UUIDs of every version, either case, nil and max', () => {
    const all = texts(Uuid);

    expect(new Set(all.map((text) => text.charAt(14)))).toStrictEqual(
      new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', 'f', 'F']),
    );
    expect(all.some((text) => /[A-F]/u.test(text))).toBe(true);
    expect(all.some((text) => /[a-f]/u.test(text))).toBe(true);
  });

  it('makes IPv4 and IPv6 addresses, with the IPv4 form inside IPv6 too', () => {
    const all = texts(IpAddress);

    expect(all.some((text) => /^\d+\.\d+\.\d+\.\d+$/u.test(text))).toBe(true);
    expect(all.some((text) => text.includes('::'))).toBe(true);
    expect(all.some((text) => /:.*\./u.test(text))).toBe(true);
  });

  it('makes prefixes of every length, the shortest and the longest', () => {
    const v4 = new Set(texts(Ipv4Prefix).map((text) => text.split('/')[1]));
    const v6 = new Set(texts(Ipv6Prefix).map((text) => text.split('/')[1]));

    expect(v4.size).toBe(33);
    expect(v6).toContain('0');
    expect(v6).toContain('128');
  });

  it('makes both ISBN forms, X check digits included', () => {
    const all = texts(Isbn);

    expect(all.some((text) => text.length === 10)).toBe(true);
    expect(all.some((text) => text.length === 13)).toBe(true);
    expect(all.some((text) => text.endsWith('X'))).toBe(true);
  });

  it('makes the longest semantic version, with prereleases and builds', () => {
    const all = texts(SemVer);

    expect(Math.max(...all.map((text) => text.length))).toBe(256);
    expect(all.some((text) => /^\d+\.\d+\.\d+-/u.test(text))).toBe(true);
    expect(all.some((text) => text.includes('+'))).toBe(true);
  });

  it('makes language tags with extensions and private use', () => {
    const all = texts(LanguageTag);

    expect(all.some((text) => /-[uU]-/u.test(text))).toBe(true);
    expect(all.some((text) => /-[tT]-/u.test(text))).toBe(true);
    expect(all.some((text) => /-[xX]-/u.test(text))).toBe(true);
  });

  it('makes URLs of many schemes and http URLs in any case', () => {
    expect(
      new Set(texts(Url).map((text) => text.slice(0, text.indexOf(':')))).size,
    ).toBeGreaterThan(20);
    expect(texts(HttpUrl).some((text) => text.startsWith('HTTP'))).toBe(true);
  });

  it('makes amounts of money with no more digits after the point than the currency allows', () => {
    const values = many(Money);

    expect(values.filter((value) => fractionOf(value) > unitsOf(value))).toStrictEqual([]);
    expect(values.some((value) => fractionOf(value) === 3)).toBe(true);
    expect(new Set(values.map((value) => fieldOf(value, 'currency'))).size).toBe(
      CurrencyCode.codes.length,
    );
  });

  it('makes decimals of every sign and the longest, 100 characters', () => {
    const all = texts(DecimalString);

    expect(all.some((text) => text.startsWith('-'))).toBe(true);
    expect(all).toContain('0');
    expect(Math.max(...all.map((text) => text.length))).toBe(100);
  });

  it('makes TypeIDs with and without a prefix, prefixes of 63 characters included', () => {
    const all = texts(TypeId);

    expect(all.some((text) => text.length === 26)).toBe(true);
    expect(all.some((text) => text.includes('_'))).toBe(true);
    expect(all.some((text) => text.length === 90)).toBe(true);
  });
});
