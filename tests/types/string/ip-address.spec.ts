import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { IpAddress, Ipv4Address, Ipv6Address, NominalError } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';
import { valueOf } from '../../support/results.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

describe('Ipv4Address', () => {
  it.each(['0.0.0.0', '255.255.255.255', '192.0.2.1', '10.0.0.1', '1.2.3.4', '100.200.250.199'])(
    'accepts %s',
    (text) => {
      expect(new Ipv4Address(text).value).toBe(text);
    },
  );

  it.each([
    ['a part past 255', '256.0.0.0'],
    ['a part of 1000', '1000.0.0.0'],
    ['three parts', '1.2.3'],
    ['five parts', '1.2.3.4.5'],
    ['a trailing dot', '1.2.3.4.'],
    ['a leading dot', '.1.2.3.4'],
    ['an empty part', '1..2.3'],
    ['a short form', '127.1'],
    ['a hex part', '0x7f.0.0.1'],
    ['a sign', '+1.2.3.4'],
    ['full-width digits', '１.２.３.４'],
    ['Arabic-Indic digits', '١.٢.٣.٤'],
    ['a prefix length', '10.0.0.0/8'],
    ['a port', '1.2.3.4:80'],
    ['surrounding space', ' 1.2.3.4'],
    ['empty', ''],
    ['an IPv6 address', '::1'],
  ])('rejects %s', (_, text) => {
    expect(() => new Ipv4Address(text)).toThrow(NominalError);
  });

  it.each(['010.0.0.1', '01.2.3.4', '1.2.3.04', '00.0.0.0', '0177.0.0.1'])(
    'rejects %s, a leading zero inet_aton reads as octal (CVE-2021-28918, CVE-2021-29921)',
    (text) => {
      expect(Ipv4Address.parse(text).ok).toBe(false);
      expect(IpAddress.parse(text).ok).toBe(false);
    },
  );

  it('is an IpAddress, while an IpAddress is not necessarily an Ipv4Address', () => {
    expect(new Ipv4Address('192.0.2.1')).toBeInstanceOf(IpAddress);
    expect(valueOf(Ipv4Address.parse(new IpAddress('192.0.2.1')))).toBeInstanceOf(Ipv4Address);
    expect(Ipv4Address.parse(new IpAddress('::1')).ok).toBe(false);
  });

  it('keeps its own type and text through canonical()', () => {
    expect(new Ipv4Address('192.0.2.1').canonical()).toStrictEqual(new Ipv4Address('192.0.2.1'));
  });
});

describe('Ipv6Address', () => {
  it.each([
    '::',
    '::1',
    '1::',
    '2001:db8::1',
    '2001:DB8::1',
    '2001:0db8:0000:0000:0000:0000:0000:0001',
    '1:2:3:4:5:6:7:8',
    '1:2:3:4:5:6:7::',
    '::2:3:4:5:6:7:8',
    '1::8',
    'fe80::1',
    '::ffff:192.0.2.1',
    '::192.0.2.1',
    '1:2:3:4:5:6:192.0.2.1',
    '1::5:6:192.0.2.1',
    'ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255',
    'FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF',
  ])('accepts %s', (text) => {
    expect(new Ipv6Address(text).value).toBe(text);
  });

  it.each([
    ['a zone (VJS #972)', 'fe80::1%eth0'],
    ['a numeric zone', 'fe80::1%1'],
    ['brackets', '[::1]'],
    ['two ::', '1::2::3'],
    ['nine groups', '1:2:3:4:5:6:7:8:9'],
    [':: with eight groups', '1:2:3:4:5:6:7:8::'],
    ['seven groups', '1:2:3:4:5:6:7'],
    ['a group of five digits', '12345::'],
    ['a group of five digits with leading zeros', '00001::'],
    [':::', ':::'],
    ['a lone colon at the start', ':1::'],
    ['a lone colon at the end', '::1:'],
    ['a lone colon', ':'],
    ['a dotted quad that runs too long', '1:2:3:4:5:6:7:1.2.3.4'],
    ['a dotted quad before the end', '::1.2.3.4:1'],
    ['a dotted quad with a leading zero', '::ffff:01.2.3.4'],
    ['a dotted quad past 255', '::ffff:256.0.0.1'],
    ['a dotted quad alone', '1.2.3.4'],
    ['a letter past f', '::g'],
    ['a prefix length', '2001:db8::/32'],
    ['surrounding space', ' ::1'],
    ['empty', ''],
    ['46 characters', `${'0000:'.repeat(6)}255.255.255.255:`],
  ])('rejects %s', (_, text) => {
    expect(() => new Ipv6Address(text)).toThrow(NominalError);
  });

  it.each([
    ['2001:0DB8:0000:0000:0000:0000:0000:0001', '2001:db8::1'],
    ['2001:db8:0:0:1:0:0:1', '2001:db8::1:0:0:1'],
    ['2001:db8:0:1:1:1:1:1', '2001:db8:0:1:1:1:1:1'],
    ['2001:0:0:1:0:0:0:1', '2001:0:0:1::1'],
    ['1:2:3:4:5:6:7::', '1:2:3:4:5:6:7:0'],
    ['::2:3:4:5:6:7:8', '0:2:3:4:5:6:7:8'],
    ['0:0:0:0:0:0:0:0', '::'],
    ['0:0:0:0:0:0:0:1', '::1'],
    ['::FFFF:C000:0201', '::ffff:192.0.2.1'],
    ['::ffff:192.0.2.1', '::ffff:192.0.2.1'],
    ['1:2:3:4:5:6:192.0.2.1', '1:2:3:4:5:6:c000:201'],
  ])('writes %s as %s (RFC 5952)', (text, canonical) => {
    expect(new Ipv6Address(text).canonical()).toStrictEqual(new Ipv6Address(canonical));
  });

  it('reads the IPv4 address of an IPv4-mapped address', () => {
    expect(new Ipv6Address('::ffff:c000:201').toIpv4()).toStrictEqual(new Ipv4Address('192.0.2.1'));
    expect(new Ipv6Address('::192.0.2.1').toIpv4()).toBeUndefined();
  });
});

describe('IpAddress', () => {
  it.each([
    ['192.0.2.1', 4],
    ['2001:db8::1', 6],
    ['::ffff:192.0.2.1', 6],
  ])('accepts %s as version %i', (text, version) => {
    expect(new IpAddress(text).version).toBe(version);
  });

  it.each([42, null, undefined, {}, [], 3_232_235_777, new Object('1.2.3.4')])(
    'rejects %o',
    (input) => {
      expect(IpAddress.parse(input).ok).toBe(false);
    },
  );

  it('leaves the rejected value out of its message', () => {
    expect(IpAddress.parse('192.0.2.300')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be an IP address (was a string of 11 characters)' }],
    });
    expect(Ipv4Address.parse('::1')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be an IPv4 address (was a string of 3 characters)' }],
    });
  });

  it('refuses long crafted input quickly', () => {
    const inputs = [
      '1'.repeat(100_000),
      '1:'.repeat(50_000),
      `${'::'.repeat(50_000)}1`,
      `${'1.'.repeat(50_000)}1`,
    ];
    const started = performance.now();

    for (const input of inputs) {
      expect(IpAddress.parse(input).ok).toBe(false);
    }

    expect(performance.now() - started).toBeLessThan(50);
  });

  it.each([
    ['192.0.2.1', '192.0.2.1'],
    ['2001:DB8::0:1', '2001:db8::1'],
    ['::FFFF:192.0.2.1', '::ffff:192.0.2.1'],
  ])('writes %s as %s and stays an IpAddress', (text, canonical) => {
    expect(new IpAddress(text).canonical()).toStrictEqual(new IpAddress(canonical));
  });

  it.each([
    ['192.0.2.1', [192, 0, 2, 1]],
    ['2001:db8::1', [0x20, 0x01, 0x0d, 0xb8, ...Array.from({ length: 11 }, () => 0), 1]],
    ['::ffff:192.0.2.1', [...Array.from({ length: 10 }, () => 0), 0xff, 0xff, 192, 0, 2, 1]],
  ])('gives the bytes of %s', (text, bytes) => {
    expect(new IpAddress(text).toBytes()).toStrictEqual(Uint8Array.from(bytes));
  });

  describe('equals', () => {
    it('compares the address, however it is written', () => {
      expect(new IpAddress('2001:DB8::1').equals(new IpAddress('2001:db8:0:0:0:0:0:1'))).toBe(true);
      expect(new IpAddress('::ffff:192.0.2.1').equals(new IpAddress('::FFFF:C000:201'))).toBe(true);
      expect(new IpAddress('2001:db8::1').equals(new IpAddress('2001:db8::2'))).toBe(false);
    });

    it('keeps IPv4 apart from the IPv4-mapped address that carries it', () => {
      expect(new IpAddress('192.0.2.1').equals(new IpAddress('::ffff:192.0.2.1'))).toBe(false);
    });

    it('holds across the line of types, not between siblings', () => {
      expect(new IpAddress('::1').equals(new Ipv6Address('0::1'))).toBe(true);
      expect(new Ipv6Address('0::1').equals(new IpAddress('::1'))).toBe(true);
      expect(new Ipv4Address('192.0.2.1').equals('192.0.2.1')).toBe(false);
    });

    it('holds for an address from another copy of the package', async () => {
      const copy = await anotherCopy();

      expect(new IpAddress('2001:DB8::1').equals(new copy.Ipv6Address('2001:db8::1'))).toBe(true);
      expect(valueOf(Ipv6Address.parse(new copy.IpAddress('::1')))).toBeInstanceOf(Ipv6Address);
    });
  });
});

describe('IP addresses as JSON Schema', () => {
  it('describes each family with its format, without the choice of IpAddress', () => {
    const ipv4 = Ipv4Address['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    const ipv6 = Ipv6Address['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    expect(ipv4).toMatchObject({
      type: 'string',
      format: 'ipv4',
      minLength: 7,
      maxLength: 15,
      description: 'an IPv4 address',
      examples: ['192.0.2.1'],
    });
    expect(ipv6).toMatchObject({ format: 'ipv6', minLength: 2, maxLength: 45 });
    expect(ipv4).not.toHaveProperty('anyOf');
    expect(ipv4).not.toHaveProperty('allOf');
    expect(ipv6).not.toHaveProperty('anyOf');
  });

  const texts = [
    ...randomTexts(['0', '1', '2', '5', '9', 'a', 'F', 'g', ':', '::', '.', '25', '%'], 6000, 14),
    ...randomTexts(['1:', '::', 'ffff:', '0:', '1.2.3.4', '255.', '01'], 3000, 9, 2),
    '1:2:3:4:5:6:7:8',
    '1:2:3:4:5:6:7::',
    '1:2:3:4:5:6:7:8::',
    'ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255',
  ];

  it.each([IpAddress, Ipv4Address, Ipv6Address])('agrees with %o on generated text', (type) => {
    expect(disagreementsOf(type, texts)).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    const accepted = texts.filter((text) => IpAddress.parse(text).ok);

    expect(accepted.length).toBeGreaterThan(100);
    expect(accepted.length).toBeLessThan(texts.length);
  });
});
