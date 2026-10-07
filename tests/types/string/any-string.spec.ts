import { describe, expect, it } from 'vitest';

import { stringOnly, stringRule, withoutImpliedString } from '../../../src/core/string-rule.ts';
import {
  AnyString,
  CountryCode,
  CurrencyCode,
  Email,
  HttpUrl,
  LanguageTag,
  matching,
  NominalError,
  satisfying,
  Url,
  Uuid,
} from '../../../src/index.ts';
import type { AnyNominalType } from '../../../src/index.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';

describe('AnyString', () => {
  it.each(['', ' ', 'text', 'юнікод', '\u0000', 'x'.repeat(100_000)])(
    'accepts %j as is',
    (text) => {
      expect(new AnyString(text).value).toBe(text);
    },
  );

  it.each([1, true, null, undefined, {}, [], 1n, Symbol('text'), new Object('text')])(
    'rejects %s',
    (input) => {
      expect(AnyString.parse(input).ok).toBe(false);
    },
  );

  it('names the type in the error', () => {
    expect(thrownBy(() => Reflect.construct(AnyString, [42]))).toStrictEqual(
      new NominalError('nominal.AnyString', [{ message: 'must be a string (was 42)' }]),
    );
  });

  it('describes itself as a string', () => {
    expect(AnyString['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toStrictEqual({
      title: 'nominal.AnyString',
      type: 'string',
      description: 'a string',
    });
  });
});

const isA = (value: unknown): value is string => value === 'a';

describe('types under AnyString', () => {
  const children: ReadonlyArray<readonly [AnyNominalType, AnyNominalType, string]> = [
    [AnyString, Email, 'jane@example.com'],
    [AnyString, Uuid, '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'],
    [AnyString, Url, 'https://example.com'],
    [AnyString, CountryCode, 'US'],
    [AnyString, CurrencyCode, 'EUR'],
    [AnyString, LanguageTag, 'en-US'],
    [Url, HttpUrl, 'https://example.com'],
  ];

  it.each(
    children.map(
      ([parent, child, value]) => [child.typeName, parent.typeName, parent, child, value] as const,
    ),
  )('%s passes where %s is expected, not the other way round', (_, __, parent, child, value) => {
    const instance = valueOf(child.parse(value));

    expect(instance).toBeInstanceOf(parent);
    expect(parent.parse(instance)).toStrictEqual({ ok: true, value: instance });
    expect(valueOf(parent.parse(value))).not.toBeInstanceOf(child);
  });

  it('narrows an AnyString through parse', () => {
    expect(valueOf(Email.parse(new AnyString('jane@example.com')))).toBeInstanceOf(Email);
    expect(issuesOf(Email.parse(new AnyString('jane')))).toHaveLength(1);
  });

  it('keeps siblings apart, even when the value would pass', () => {
    expect(new Email('jane@example.com')).not.toBeInstanceOf(Url);
    expect(issuesOf(Url.parse(new Email('jane@example.com')))).toHaveLength(1);
  });

  it.each([
    [Email, 'must be a string (was a number)'],
    [Uuid, 'must be a string (was 42)'],
    [Url, 'must be a URL (was 42)'],
    [HttpUrl, 'must be a URL (was 42)'],
    [CountryCode, 'must be an ISO 3166-1 alpha-2 country code (was 42)'],
    [CurrencyCode, 'must be an ISO 4217 currency code (was 42)'],
    [LanguageTag, 'must be a BCP 47 language tag (was 42)'],
  ] as const)('reports a non-string to %o once', (type, message) => {
    expect(issuesOf(type.parse(42))).toStrictEqual([{ message }]);
  });

  it('leaves the string check out in front of a rule that checks for a string itself', () => {
    const pattern = matching(/^a/u);
    const guard = satisfying(isA, 'a');
    const marked = stringOnly(satisfying(isA, 'a'));

    expect(withoutImpliedString([stringRule, pattern])).toStrictEqual([pattern]);
    expect(withoutImpliedString([stringRule, marked, guard])).toStrictEqual([marked, guard]);
    expect(withoutImpliedString([stringRule, guard, pattern])).toStrictEqual([
      stringRule,
      guard,
      pattern,
    ]);
    expect(withoutImpliedString([stringRule])).toStrictEqual([stringRule]);
  });

  it('describes a type with one rule left without allOf', () => {
    expect(Email['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toStrictEqual({
      title: 'nominal.Email',
      type: 'string',
      pattern: Email.pattern.source,
      format: 'email',
      minLength: 6,
      maxLength: 254,
      example: 'jane.doe@example.com',
      description: 'an email address',
    });
  });
});
