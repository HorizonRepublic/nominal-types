import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { MacAddress, NominalError } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

describe('MacAddress', () => {
  it.each([
    '00:00:5e:00:53:01',
    '00-00-5E-00-53-01',
    'AA:bb:Cc:dD:ee:FF',
    'ff:ff:ff:ff:ff:ff',
    '00:00:00:00:00:00',
  ])('accepts %s as given', (text) => {
    expect(new MacAddress(text).value).toBe(text);
  });

  it.each([
    ['mixed separators', '00:00-5e:00:53:01'],
    ['no separators (VJS #1061)', '00005e005301'],
    ['the dotted form', '0000.5e00.5301'],
    ['dots', '00.00.5e.00.53.01'],
    ['spaces', '00 00 5e 00 53 01'],
    ['five octets', '00:00:5e:00:53'],
    ['seven octets', '00:00:5e:00:53:01:02'],
    ['an EUI-64', '00:00:5e:ff:fe:00:53:01'],
    ['a single digit', '0:0:5e:0:53:1'],
    ['three digits', '000:00:5e:00:53:01'],
    ['a letter past f', '00:00:5g:00:53:01'],
    ['a trailing separator', '00:00:5e:00:53:01:'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new MacAddress(text)).toThrow(NominalError);
  });

  it.each([42, null, undefined, {}, [], new Object('00:00:5e:00:53:01')])('rejects %o', (input) => {
    expect(MacAddress.parse(input).ok).toBe(false);
  });

  it('leaves the rejected value out of its message', () => {
    expect(MacAddress.parse('00:00-5e:00:53:01')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be a MAC address (was a string of 17 characters)' }],
    });
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(MacAddress.parse('00:'.repeat(50_000)).ok).toBe(false);
    expect(MacAddress.parse('0'.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('gives its bytes', () => {
    expect(new MacAddress('00-00-5E-00-53-01').toBytes()).toStrictEqual(
      Uint8Array.from([0x00, 0x00, 0x5e, 0x00, 0x53, 0x01]),
    );
  });

  it.each([
    ['00:00:5e:00:53:01', false, false],
    ['01:00:5e:00:00:01', true, false],
    ['02:00:5e:00:53:01', false, true],
    ['ff:ff:ff:ff:ff:ff', true, true],
  ])('reads the flag bits of %s', (text, multicast, local) => {
    const address = new MacAddress(text);

    expect(address.isMulticast).toBe(multicast);
    expect(address.isLocallyAdministered).toBe(local);
  });

  it('writes the lowercase form with colons', () => {
    expect(new MacAddress('00-00-5E-00-53-01').canonical()).toStrictEqual(
      new MacAddress('00:00:5e:00:53:01'),
    );
  });

  it('compares the bytes, whatever the case and separator', async () => {
    const copy = await anotherCopy();

    expect(new MacAddress('00-00-5E-00-53-01').equals(new MacAddress('00:00:5e:00:53:01'))).toBe(
      true,
    );
    expect(new MacAddress('00:00:5e:00:53:01').equals(new MacAddress('00:00:5e:00:53:02'))).toBe(
      false,
    );
    expect(new MacAddress('00:00:5e:00:53:01').equals('00:00:5e:00:53:01')).toBe(false);
    expect(
      new MacAddress('00-00-5E-00-53-01').equals(new copy.MacAddress('00:00:5e:00:53:01')),
    ).toBe(true);
  });

  it('agrees with its JSON Schema on generated text', () => {
    const texts = randomTexts(['0', 'a', 'F', 'g', ':', '-', '.', '5e', '00:', '0-'], 6000, 18);

    expect(disagreementsOf(MacAddress, texts)).toStrictEqual([]);
    expect(MacAddress['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      minLength: 17,
      maxLength: 17,
      pattern: MacAddress.pattern.source,
    });
  });
});
