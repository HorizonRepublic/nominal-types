import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, Base64, Base64Url, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';

const bytesOf = (...values: number[]): Uint8Array => Uint8Array.from(values);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

describe('Base64', () => {
  it.each([
    ['', ''],
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYg==', 'foob'],
    ['Zm9vYmE=', 'fooba'],
    ['Zm9vYmFy', 'foobar'],
  ])('accepts %j, the RFC 4648 test vector of %j', (encoded, decoded) => {
    const value = new Base64(encoded);

    expect(text(value.toBytes())).toBe(decoded);
    expect(value.byteLength).toBe(decoded.length);
  });

  it('reads both characters of its own alphabet', () => {
    expect(new Base64('+/+/').toBytes()).toStrictEqual(bytesOf(0xfb, 0xff, 0xbf));
  });

  it.each([
    '=',
    '==',
    '====',
    'Q',
    'QQ',
    'QQ=',
    'QUI',
    'QQ===',
    'Q===',
    'QQ==QQ==',
    'Q=Q=',
    'QQ==\n',
    'QUJD\nQUJD',
    'QU JD',
    ' QUJD',
    'QUJD ',
    '-_-_',
    'QUJ!',
    'ＱＵＪＤ',
  ])('rejects %j', (encoded) => {
    expect(() => new Base64(encoded)).toThrow(NominalError);
  });

  it.each([42, null, undefined, true, ['QQ=='], bytesOf(1, 2, 3)])(
    'rejects %o, which is not a string',
    (value) => {
      expect(Base64.parse(value).ok).toBe(false);
    },
  );

  it.each([
    ['QR==', 'QQ=='],
    ['Qf==', 'QQ=='],
    ['QUJ=', 'QUI='],
    ['QUL=', 'QUI='],
  ])('rejects %s, whose pad bits are not zero, unlike %s (RFC 4648 §3.5)', (loose, strict) => {
    expect(Base64.parse(loose).ok).toBe(false);
    expect(Base64.parse(strict).ok).toBe(true);
  });

  it.each(['QQ==', 'Qg==', 'QQA=', 'QQQ=', 'QQg=', 'QQw='])(
    'accepts %s, whose last character pads with zero bits',
    (encoded) => {
      expect(Base64.parse(encoded).ok).toBe(true);
    },
  );

  it('accepts the empty string as zero bytes (validator.js #1418)', () => {
    const empty = new Base64('');

    expect(empty.byteLength).toBe(0);
    expect(empty.toBytes()).toStrictEqual(new Uint8Array(0));
  });

  it('reports the rejection in words', () => {
    expect(Base64.parse('QQ')).toMatchObject({
      ok: false,
      issues: [{ message: 'must be base64 text (was "QQ")' }],
    });
  });

  it('is a string type, and not a Base64Url', () => {
    const value = new Base64('QUJD');

    expect(value).toBeInstanceOf(AnyString);
    expect(value).not.toBeInstanceOf(Base64Url);
    expect(value.equals(new Base64Url('QUJD'))).toBe(false);
  });

  it('hands out a new array each time', () => {
    const value = new Base64('QUJD');
    const bytes = value.toBytes();

    bytes[0] = 0;

    expect(value.toBytes()).toStrictEqual(bytesOf(65, 66, 67));
  });

  it('checks ten megabytes of text without a RangeError (validator.js #2573)', () => {
    const long = 'QUJD'.repeat(2_500_000);

    expect(Base64.parse(long).ok).toBe(true);
    expect(Base64.parse(`${long}QR==`).ok).toBe(false);
  });

  it.each([
    ['padding', '='.repeat(100_000)],
    ['letters before a lone =', `${'A'.repeat(100_001)}=`],
    ['a bad last group', `${'QUJD'.repeat(25_000)}QR==`],
    ['a bad character in the middle', `${'QUJD'.repeat(12_500)}!${'QUJD'.repeat(12_500)}`],
  ])('refuses a long crafted input of %s quickly', (_, encoded) => {
    const start = performance.now();

    expect(Base64.parse(encoded).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('compares with a value built by another copy of the package', async () => {
    const copy = await anotherCopy();

    expect(new copy.Base64('QUJD').equals(new Base64('QUJD'))).toBe(true);
    expect(Base64.parse(new copy.Base64('QUJD')).ok).toBe(true);
  });
});

describe('Base64Url', () => {
  it.each([
    ['', ''],
    ['Zg', 'f'],
    ['Zm8', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYg', 'foob'],
    ['Zm9vYmE', 'fooba'],
    ['Zm9vYmFy', 'foobar'],
  ])('accepts %j, the RFC 4648 test vector of %j without padding', (encoded, decoded) => {
    const value = new Base64Url(encoded);

    expect(text(value.toBytes())).toBe(decoded);
    expect(value.byteLength).toBe(decoded.length);
  });

  it('reads both characters of its own alphabet', () => {
    expect(new Base64Url('-_-_').toBytes()).toStrictEqual(bytesOf(0xfb, 0xff, 0xbf));
  });

  it.each(['Q', 'QUJDQ', 'Zg==', 'Zm8=', '=', '+/+/', 'QUJD QUJD', 'QUJD\n', 'QUJ.', 'ＱＵＪＤ'])(
    'rejects %j',
    (encoded) => {
      expect(() => new Base64Url(encoded)).toThrow(NominalError);
    },
  );

  it.each([42, null, undefined, ['QQ']])('rejects %o, which is not a string', (value) => {
    expect(Base64Url.parse(value).ok).toBe(false);
  });

  it.each([
    ['QR', 'QQ'],
    ['QUJ', 'QUI'],
  ])('rejects %s, whose pad bits are not zero, unlike %s', (loose, strict) => {
    expect(Base64Url.parse(loose).ok).toBe(false);
    expect(Base64Url.parse(strict).ok).toBe(true);
  });

  it('reports the rejection in words', () => {
    expect(Base64Url.parse('Zg==')).toMatchObject({
      ok: false,
      issues: [{ message: 'must be base64url text (was "Zg==")' }],
    });
  });

  it('is a string type, and not a Base64', () => {
    expect(new Base64Url('QUJD')).toBeInstanceOf(AnyString);
    expect(new Base64Url('QUJD')).not.toBeInstanceOf(Base64);
  });

  it('checks ten megabytes of text without a RangeError', () => {
    const long = 'QUJD'.repeat(2_500_000);

    expect(Base64Url.parse(`${long}QQ`).ok).toBe(true);
    expect(Base64Url.parse(`${long}QQ=`).ok).toBe(false);
  });

  it('refuses a long crafted input quickly', () => {
    const start = performance.now();

    expect(Base64Url.parse(`${'A'.repeat(100_001)}=`).ok).toBe(false);
    expect(Base64Url.parse(`${'QUJD'.repeat(25_000)}QR`).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('compares with a value built by another copy of the package', async () => {
    const copy = await anotherCopy();

    expect(new copy.Base64Url('QUJD').equals(new Base64Url('QUJD'))).toBe(true);
  });
});

describe('Base64 and Base64Url decode every byte', () => {
  const all = Uint8Array.from({ length: 256 }, (_, index) => index);

  it.each([0, 1, 2, 3, 254, 255, 256])('round-trips the first %i byte values', (length) => {
    const bytes = all.slice(0, length);
    const encoded = Buffer.from(bytes).toString('base64');
    const url = Buffer.from(bytes).toString('base64url');

    expect(new Base64(encoded).toBytes()).toStrictEqual(bytes);
    expect(new Base64Url(url).toBytes()).toStrictEqual(bytes);
    expect(new Base64(encoded).byteLength).toBe(length);
    expect(new Base64Url(url).byteLength).toBe(length);
  });
});

describe('Uint8Array.fromBase64, where the runtime has it', () => {
  afterEach(() => {
    Reflect.deleteProperty(Uint8Array, 'fromBase64');
    vi.resetModules();
  });

  it('decodes with it, naming the alphabet', async () => {
    const native = vi.fn<(text: string, options: object) => Uint8Array>(() => bytesOf(1));

    Reflect.set(Uint8Array, 'fromBase64', native);
    const copy = await anotherCopy();

    expect(new copy.Base64('QUJD').toBytes()).toStrictEqual(bytesOf(1));
    expect(new copy.Base64Url('QUJD').toBytes()).toStrictEqual(bytesOf(1));
    expect(native.mock.calls).toStrictEqual([
      ['QUJD', { alphabet: 'base64' }],
      ['QUJD', { alphabet: 'base64url' }],
    ]);
  });
});

describe('JSON Schema', () => {
  const base64 = Base64['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  const base64Url = Base64Url['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  it('names the encoding', () => {
    expect(base64).toMatchObject({ type: 'string', contentEncoding: 'base64' });
    expect(base64Url).toMatchObject({ type: 'string', contentEncoding: 'base64url' });
  });

  it('writes base64 as format byte for OpenAPI 3.0, which has no contentEncoding', () => {
    const schema = Base64['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

    expect(schema).toMatchObject({ type: 'string', format: 'byte', example: 'aGVsbG8=' });
    expect(schema).not.toHaveProperty('contentEncoding');
  });

  it('leaves base64url without a format for OpenAPI 3.0', () => {
    const schema = Base64Url['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

    expect(schema).not.toHaveProperty('contentEncoding');
    expect(schema).not.toHaveProperty('format');
  });

  it.each(['', 'QQ==', 'QR==', 'QQ', 'QQ=', '====', 'Zm9vYmFy', '-_-_', '+/+/', 'QUJD\n'])(
    'agrees with both types on %j',
    (encoded) => {
      expect(satisfiesSchema(base64, encoded)).toBe(Base64.parse(encoded).ok);
      expect(satisfiesSchema(base64Url, encoded)).toBe(Base64Url.parse(encoded).ok);
    },
  );
});
