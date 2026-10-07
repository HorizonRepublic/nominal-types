import {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  CountryCode,
  CurrencyCode,
  Email,
  Int8,
  Integer,
  LanguageTag,
  NonNegativeInteger,
  PositiveInteger,
  Uint8,
  Url,
  Uuid,
} from '../../src/index.ts';

/**
 * Values at the edges of the built-in types, for tests that hold an adapter against the type.
 */
export const edgeSamples: readonly unknown[] = [
  '',
  'jane@example.com',
  'nope',
  '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  'https://example.com/a',
  'US',
  'us',
  'EUR',
  'en-US',
  'en_US',
  'a'.repeat(300),
  0,
  -0,
  1,
  -1,
  127,
  128,
  255,
  256,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  42n,
  '42',
  true,
  null,
  undefined,
  {},
  [],
];

/**
 * The built-in types the adapter tests run over.
 */
export const sampleTypes = [
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  CountryCode,
  CurrencyCode,
  Email,
  Int8,
  Integer,
  LanguageTag,
  NonNegativeInteger,
  PositiveInteger,
  Uint8,
  Url,
  Uuid,
] as const;
