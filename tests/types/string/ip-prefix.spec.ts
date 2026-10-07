import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import {
  IpAddress,
  IpPrefix,
  Ipv4Address,
  Ipv4Prefix,
  Ipv6Address,
  Ipv6Prefix,
  NominalError,
} from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';
import { valueOf } from '../../support/results.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

describe('Ipv4Prefix', () => {
  it.each([
    '0.0.0.0/0',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.0.2.0/24',
    '192.0.2.1/32',
    '192.0.2.128/25',
    '255.255.255.254/31',
  ])('accepts %s', (text) => {
    expect(new Ipv4Prefix(text).value).toBe(text);
  });

  it.each([
    ['host bits set', '10.0.0.1/8'],
    ['the last host bit set', '192.0.2.1/31'],
    ['a length of 33', '10.0.0.0/33'],
    ['a leading zero in the length', '10.0.0.0/08'],
    ['a length of 00', '0.0.0.0/00'],
    ['a sign in the length', '10.0.0.0/+8'],
    ['no length', '10.0.0.0/'],
    ['no slash', '10.0.0.0'],
    ['two slashes', '10.0.0.0/8/8'],
    ['a leading zero in the address', '010.0.0.0/8'],
    ['a short address', '10/8'],
    ['an IPv6 prefix', '::/0'],
    ['a netmask', '10.0.0.0/255.0.0.0'],
  ])('rejects %s', (_, text) => {
    expect(() => new Ipv4Prefix(text)).toThrow(NominalError);
  });

  it('refuses host bits set, which validator.js isIPRange accepts', () => {
    expect(IpPrefix.parse('10.0.0.1/8')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be an IP prefix whose host bits are zero (was "10.0.0.1/8")' }],
    });
  });

  it('keeps its type and text through canonical()', () => {
    expect(new Ipv4Prefix('10.0.0.0/8').canonical()).toStrictEqual(new Ipv4Prefix('10.0.0.0/8'));
  });

  it('gives its address as an Ipv4Address', () => {
    expect(new Ipv4Prefix('192.0.2.0/24').address).toStrictEqual(new Ipv4Address('192.0.2.0'));
  });
});

describe('Ipv6Prefix', () => {
  it.each([
    '::/0',
    '2001:db8::/32',
    '2001:DB8::/32',
    '2001:db8::1/128',
    'fe80::/10',
    'fc00::/7',
    '::ffff:0.0.0.0/96',
    '::ffff:192.0.2.0/120',
    '2001:db8:0:0:0:0:0:0/64',
  ])('accepts %s', (text) => {
    expect(new Ipv6Prefix(text).value).toBe(text);
  });

  it.each([
    ['host bits set', '2001:db8::1/64'],
    ['a host bit inside a group', 'fe80::/8'],
    ['a length of 129', '::/129'],
    ['a leading zero in the length', '::/064'],
    ['a zone', 'fe80::%eth0/64'],
    ['no length', '2001:db8::/'],
    ['an IPv4 prefix', '10.0.0.0/8'],
  ])('rejects %s', (_, text) => {
    expect(() => new Ipv6Prefix(text)).toThrow(NominalError);
  });

  it('writes its address as RFC 5952 recommends', () => {
    expect(new Ipv6Prefix('2001:0DB8:0000::/48').canonical()).toStrictEqual(
      new Ipv6Prefix('2001:db8::/48'),
    );
  });

  it('gives its address as an Ipv6Address', () => {
    expect(new Ipv6Prefix('2001:db8::/32').address).toStrictEqual(new Ipv6Address('2001:db8::'));
  });
});

describe('IpPrefix', () => {
  it.each([
    ['10.0.0.0/8', 4, 8],
    ['2001:db8::/32', 6, 32],
    ['::/0', 6, 0],
  ])('reads %s as version %i, length %i', (text, version, length) => {
    const prefix = new IpPrefix(text);

    expect(prefix.version).toBe(version);
    expect(prefix.length).toBe(length);
  });

  it.each([
    ['10.0.0.0/8', '10.0.0.0/8'],
    ['2001:DB8:0::/32', '2001:db8::/32'],
  ])('writes %s as %s', (text, canonical) => {
    expect(new IpPrefix(text).canonical()).toStrictEqual(new IpPrefix(canonical));
  });

  it('gives its address as an IpAddress', () => {
    expect(new IpPrefix('2001:db8::/32').address).toStrictEqual(new IpAddress('2001:db8::'));
  });

  it.each([42, null, {}, '', new Object('10.0.0.0/8')])('rejects %o', (input) => {
    expect(IpPrefix.parse(input).ok).toBe(false);
  });

  it('narrows to the prefix of its family', () => {
    expect(valueOf(Ipv4Prefix.parse(new IpPrefix('10.0.0.0/8')))).toBeInstanceOf(Ipv4Prefix);
    expect(Ipv4Prefix.parse(new IpPrefix('::/0')).ok).toBe(false);
    expect(new Ipv6Prefix('::/0')).toBeInstanceOf(IpPrefix);
  });

  it('refuses long crafted input quickly', () => {
    const inputs = [
      `1.2.3.4/${'1'.repeat(100_000)}`,
      `${'1:'.repeat(50_000)}/8`,
      '/'.repeat(100_000),
    ];
    const started = performance.now();

    for (const input of inputs) {
      expect(IpPrefix.parse(input).ok).toBe(false);
    }

    expect(performance.now() - started).toBeLessThan(50);
  });

  describe('contains', () => {
    it.each([
      ['10.0.0.0/8', '10.0.0.0', true],
      ['10.0.0.0/8', '10.255.255.255', true],
      ['10.0.0.0/8', '11.0.0.0', false],
      ['0.0.0.0/0', '255.255.255.255', true],
      ['192.0.2.1/32', '192.0.2.1', true],
      ['192.0.2.1/32', '192.0.2.2', false],
      ['2001:db8::/32', '2001:db8:ffff::1', true],
      ['2001:db8::/32', '2001:db9::1', false],
      ['fe80::/10', 'febf::1', true],
      ['fe80::/10', 'fec0::1', false],
      ['::/0', '::1', true],
      ['::ffff:0.0.0.0/96', '::ffff:192.0.2.1', true],
      ['::ffff:0.0.0.0/96', '192.0.2.1', false],
      ['0.0.0.0/0', '::1', false],
    ])('%s holds %s: %s', (prefix, address, expected) => {
      expect(new IpPrefix(prefix).contains(new IpAddress(address))).toBe(expected);
    });

    it.each([
      ['10.0.0.0/8', '10.1.0.0/16', true],
      ['10.0.0.0/8', '10.0.0.0/8', true],
      ['10.0.0.0/16', '10.0.0.0/8', false],
      ['10.0.0.0/8', '11.0.0.0/16', false],
      ['2001:db8::/32', '2001:db8:1::/48', true],
      ['2001:db8::/32', '::/0', false],
      ['::/0', '0.0.0.0/0', false],
    ])('%s holds the prefix %s: %s', (outer, inner, expected) => {
      expect(new IpPrefix(outer).contains(new IpPrefix(inner))).toBe(expected);
    });
  });

  describe('equals', () => {
    it('compares the network, however its address is written', () => {
      expect(new IpPrefix('2001:DB8::/32').equals(new IpPrefix('2001:db8:0::/32'))).toBe(true);
      expect(new IpPrefix('10.0.0.0/8').equals(new IpPrefix('10.0.0.0/16'))).toBe(false);
      expect(new Ipv4Prefix('10.0.0.0/8').equals(new IpPrefix('10.0.0.0/8'))).toBe(true);
      expect(new Ipv4Prefix('10.0.0.0/8').equals('10.0.0.0/8')).toBe(false);
    });

    it('holds for a prefix from another copy of the package', async () => {
      const copy = await anotherCopy();

      expect(new IpPrefix('2001:DB8::/32').equals(new copy.Ipv6Prefix('2001:db8::/32'))).toBe(true);
      expect(new IpPrefix('10.0.0.0/8').contains(new copy.Ipv4Address('10.0.0.1'))).toBe(true);
    });
  });
});

// The address of a prefix with its full length, which has no host bits to be set.
const withFullLength = (text: string): string => {
  const address = text.slice(0, text.indexOf('/'));

  return `${address}/${address.includes(':') ? '128' : '32'}`;
};

describe('IP prefixes as JSON Schema', () => {
  const texts = randomTexts(
    [
      '0',
      '1',
      '2',
      '8',
      '9',
      'a',
      ':',
      '::',
      '.',
      '/',
      '/0',
      '/8',
      '/32',
      '/128',
      '/129',
      '0.0.0.0',
    ],
    8000,
    10,
  );

  it.each([IpPrefix, Ipv4Prefix, Ipv6Prefix])(
    'agrees with %o on generated text, apart from host bits',
    (type) => {
      const disagreements = disagreementsOf(type, texts);

      expect(disagreements.filter((text) => type.parse(text).ok)).toStrictEqual([]);
      expect(disagreements.filter((text) => !type.parse(withFullLength(text)).ok)).toStrictEqual(
        [],
      );
    },
  );

  // A pattern cannot see host bits, so the schemas accept those prefixes too.
  it.each(['10.0.0.1/8', '192.0.2.1/31', '2001:db8::1/64', 'fe80::/8'])(
    'accepts %s, which the types refuse',
    (text) => {
      expect(disagreementsOf(IpPrefix, [text])).toStrictEqual([text]);
      expect(IpPrefix.parse(text).ok).toBe(false);
    },
  );

  it('finds both answers among the generated text', () => {
    const accepted = texts.filter((text) => IpPrefix.parse(text).ok);

    expect(accepted.length).toBeGreaterThan(20);
    expect(disagreementsOf(IpPrefix, texts).length).toBeGreaterThan(0);
  });
});
