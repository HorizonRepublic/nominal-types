import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { DomainName, Email, Hostname, NominalError } from '../../../src/index.ts';
import { disagreementsOf, satisfiesSchema } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';
import { valueOf } from '../../support/results.ts';

const label = (length: number, letter = 'a'): string => letter.repeat(length);

// Three labels of 63, one of 58 and one of 2: 249 characters and 4 dots.
const longest = [label(63), label(63, 'b'), label(63, 'c'), label(58, 'd'), 'ee'].join('.');

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

describe('Hostname', () => {
  it('builds the longest name from five labels', () => {
    expect(longest).toHaveLength(253);
  });

  it.each([
    'localhost',
    'a',
    'api.example.com',
    'API.Example.COM',
    '123.com',
    '1a',
    'a1.b2',
    'a-b.c--d',
    'a--b.com',
    `${label(63)}.com`,
    longest,
    'xn--bcher-kva.de',
    'XN--BCHER-KVA.DE',
    'xn--p1ai',
    'xn--e1afmkfd.xn--p1ai',
    'xn--r8jz45g.jp',
    'xn--zca.de',
    'xn--a-b---ova.com',
  ])('accepts %s as given', (text) => {
    expect(new Hostname(text).value).toBe(text);
  });

  it.each([
    ['empty', ''],
    ['a lone dot', '.'],
    ['a trailing dot', 'example.com.'],
    ['a leading dot', '.example.com'],
    ['an empty label', 'a..b'],
    ['a leading hyphen', '-a.com'],
    ['a trailing hyphen', 'a-.com'],
    ['a label of 64', `${label(64)}.com`],
    ['254 characters', `a${longest}`],
    ['an all-digit name', '123'],
    ['an all-digit last label', 'example.123'],
    ['an IPv4 address', '192.0.2.1'],
    ['an underscore', '_dmarc.example.com'],
    ['a space', 'a b.com'],
    ['surrounding space', ' example.com'],
    ['a port', 'example.com:80'],
    ['a reserved label with -- in places 3 and 4', 'ab--c.com'],
    ['an xn-- label that is not Punycode', 'xn--zz.com'],
    ['an xn-- label with nothing after it', 'xn--.com'],
    ['an xn-- label of control characters', 'xn--abc.com'],
    ['an xn-- label of a symbol', 'xn--ls8h.la'],
    ['an xn-- label of an uppercase letter', 'xn--ber-ska.de'],
    ['an xn-- label not in NFC', 'xn--uber-vwc.de'],
    ['an xn-- label starting with a combining mark', 'xn--a-wbb.com'],
    ['an xn-- label of a ligature NFKC changes', 'xn--x-sy8h.com'],
    ['an xn-- label of a joiner', 'xn--ab-m1t.com'],
    ['an xn-- label with -- in places 3 and 4 of its Unicode', 'xn--ab---3ra.com'],
    ['an xn-- label whose Unicode ends with a hyphen', 'xn----dha.com'],
    ['Unicode text', 'bücher.de'],
    ['Cyrillic text (VJS #528)', 'пример.рф'],
    ['full-width letters', 'ｅｘａｍｐｌｅ.com'],
  ])('rejects %s', (_, text) => {
    expect(() => new Hostname(text)).toThrow(NominalError);
  });

  it.each([42, null, undefined, {}, ['a.com'], new Object('a.com')])('rejects %o', (input) => {
    expect(Hostname.parse(input).ok).toBe(false);
  });

  it('reports the rejection in words', () => {
    expect(Hostname.parse('a_b')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be a host name (was "a_b")' }],
    });
  });

  it('refuses long crafted input quickly (VJS #2898)', () => {
    const inputs = [
      `${'a.'.repeat(50_000)}com`,
      'a'.repeat(100_000),
      `${'xn--a.'.repeat(20_000)}com`,
    ];
    const started = performance.now();

    for (const input of inputs) {
      expect(Hostname.parse(input).ok).toBe(false);
    }

    expect(performance.now() - started).toBeLessThan(50);
  });

  describe('members', () => {
    const host = new Hostname('API.Example.com');

    it('splits the labels', () => {
      expect(host.labels).toStrictEqual(['API', 'Example', 'com']);
    });

    it('lowers the name', () => {
      expect(host.canonical()).toStrictEqual(new Hostname('api.example.com'));
    });

    it('decodes xn-- labels for display', () => {
      expect(new Hostname('xn--bcher-kva.XN--P1AI').toUnicode()).toBe('bücher.рф');
      expect(new Hostname('xn--a-b---ova.example').toUnicode()).toBe('a-b--ü.example');
      expect(host.toUnicode()).toBe('API.Example.com');
    });

    it('leaves labels with hyphens elsewhere alone when decoding', () => {
      expect(new Hostname('test-kva.com').toUnicode()).toBe('test-kva.com');
    });
  });

  describe('isSubdomainOf', () => {
    it.each([
      ['api.example.com', 'example.com', true],
      ['a.b.example.com', 'example.com', true],
      ['API.EXAMPLE.com', 'example.COM', true],
      ['example.com', 'example.com', true],
      ['example.com', 'api.example.com', false],
      ['badexample.com', 'example.com', false],
      ['example.com', 'com', true],
      ['example.org', 'example.com', false],
    ])('%s under %s: %s', (name, parent, expected) => {
      expect(new Hostname(name).isSubdomainOf(new Hostname(parent))).toBe(expected);
    });
  });

  describe('equals', () => {
    it('ignores case', () => {
      expect(new Hostname('Example.COM').equals(new Hostname('example.com'))).toBe(true);
      expect(new Hostname('example.com').equals(new Hostname('example.org'))).toBe(false);
    });

    it('holds across the line of types', () => {
      expect(new Hostname('example.com').equals(new DomainName('EXAMPLE.com'))).toBe(true);
      expect(new DomainName('EXAMPLE.com').equals(new Hostname('example.com'))).toBe(true);
    });

    it('is false for plain strings', () => {
      expect(new Hostname('example.com').equals('example.com')).toBe(false);
    });

    it('holds for a name from another copy of the package', async () => {
      const copy = await anotherCopy();

      expect(new Hostname('Example.com').equals(new copy.Hostname('example.com'))).toBe(true);
      expect(valueOf(Hostname.parse(new copy.DomainName('example.com')))).toBeInstanceOf(Hostname);
    });
  });
});

describe('DomainName', () => {
  it.each([
    'example.com',
    'a.co',
    'API.EXAMPLE.COM',
    '123.com',
    'xn--80ak6aa92e.com',
    'a.xn--p1ai',
    'example.XN--P1AI',
    `a.${label(63)}`,
    longest,
  ])('accepts %s', (text) => {
    expect(new DomainName(text).value).toBe(text);
  });

  it.each([
    ['a single label', 'localhost'],
    ['a one-letter top level', 'example.c'],
    ['a top level with a digit', 'example.c0m'],
    ['a top level with a hyphen', 'example.co-m'],
    ['an all-digit top level', 'example.123'],
    ['a top level of 64', `a.${label(64)}`],
    ['a trailing dot', 'example.com.'],
    ['an IPv4 address', '192.0.2.1'],
  ])('rejects %s', (_, text) => {
    expect(() => new DomainName(text)).toThrow(NominalError);
  });

  it('reports a name with no top level in words', () => {
    expect(DomainName.parse('localhost')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be a domain name with a top-level domain (was "localhost")' }],
    });
  });

  it('is a Hostname, while a Hostname is not necessarily a DomainName', () => {
    expect(new DomainName('example.com')).toBeInstanceOf(Hostname);
    expect(DomainName.parse(new Hostname('localhost')).ok).toBe(false);
    expect(valueOf(DomainName.parse(new Hostname('example.com')))).toBeInstanceOf(DomainName);
  });

  it('refuses a value that is not a string in its own rule too', () => {
    expect(DomainName.rule['~standard'].validate(42)).toMatchObject({ issues: [{}] });
  });

  it('keeps its type through canonical()', () => {
    expect(new DomainName('Example.COM').canonical()).toStrictEqual(new DomainName('example.com'));
  });

  it('takes the domain of an email address', () => {
    const email = new Email('jane.doe@Mail.Example.com');

    expect(new DomainName(email.domain).isSubdomainOf(new DomainName('example.com'))).toBe(true);
  });
});

describe('Hostname and DomainName as JSON Schema', () => {
  const hostSchema = Hostname['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  it('describe a host name with its format and limits', () => {
    expect(hostSchema).toMatchObject({
      title: 'nominal.Hostname',
      type: 'string',
      format: 'hostname',
      minLength: 1,
      maxLength: 253,
      examples: ['api.example.com'],
    });
  });

  // Labels of LDH characters with no xn-- in them: the pattern decides these exactly.
  const texts = [
    ...randomTexts(['a', 'B', '1', '-', '.', '--', 'ab', 'com', '_'], 4000, 10),
    longest,
    `a${longest}`,
    `${label(63)}.com`,
    `${label(64)}.com`,
  ];

  it('agree with the types on every name without an xn-- label', () => {
    expect(disagreementsOf(Hostname, texts)).toStrictEqual([]);
    expect(disagreementsOf(DomainName, texts)).toStrictEqual([]);
  });

  it('accept xn-- labels the types decode and refuse', () => {
    expect(satisfiesSchema(hostSchema, 'xn--zz.com')).toBe(true);
    expect(Hostname.parse('xn--zz.com').ok).toBe(false);
    expect(satisfiesSchema(hostSchema, 'xn--bcher-kva.de')).toBe(true);
  });

  it('refuse long crafted input quickly', () => {
    const pattern = new RegExp(String(Reflect.get(hostSchema, 'pattern')), 'u');
    const started = performance.now();

    expect(pattern.test(`${'a.'.repeat(50_000)}com`)).toBe(false);
    expect(pattern.test('a-'.repeat(50_000))).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
