import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { Jwt, NominalError } from '../../../src/index.ts';
import { disagreementsOf, satisfiesSchema } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

const encoded = (bytes: string | Uint8Array): string => Buffer.from(bytes).toString('base64url');

const json = (value: unknown): string => encoded(JSON.stringify(value));

// A signature that is the right shape; the type never checks it.
const signature = encoded(new Uint8Array(32).fill(7));

const tokenOf = (header: unknown, payload: unknown, signed = signature): string =>
  `${json(header)}.${json(payload)}.${signed}`;

const token = tokenOf({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-42', exp: 1_767_225_600 });

describe('Jwt', () => {
  it.each([
    ['HS256', token],
    ['RS256 with a key id', tokenOf({ alg: 'RS256', kid: 'k1' }, { sub: 'a', iat: 1, nbf: 1.5 })],
    ['an empty claims set', tokenOf({ alg: 'ES256' }, {})],
    ['an unsecured JWT, alg none', tokenOf({ alg: 'none' }, { sub: 'a' }, '')],
    ['JSON with spaces', `${encoded('{ "alg" : "HS256" }')}.${encoded(' {} ')}.${signature}`],
    ['Unicode in the claims', tokenOf({ alg: 'HS256' }, { name: 'Ярина 🌻' })],
  ])('accepts %s', (_, text) => {
    expect(new Jwt(text).value).toBe(text);
  });

  it.each([
    ['two dots alone (VJS #2511)', '..'],
    ['parts that are not JSON (VJS #964)', 'foo.bar.'],
    ['a file name (VJS #2216)', '.babelrc.cjs'],
    ['an empty header', `.${json({})}.${signature}`],
    ['an empty payload', `${json({ alg: 'HS256' })}..${signature}`],
    ['two parts', `${json({ alg: 'HS256' })}.${json({})}`],
    ['four parts', `${token}.${signature}`],
    [
      'an encrypted token, five parts',
      `${json({ alg: 'RSA-OAEP', enc: 'A256GCM' })}.${signature}.${signature}.${signature}.${signature}`,
    ],
    ['the Bearer prefix', `Bearer ${token}`],
    ['a space around it', ` ${token}`],
    ['a trailing new line', `${token}\n`],
    ['padding', `${json({ alg: 'HS256' })}=.${json({})}.${signature}`],
    ['base64 with + and /', `${json({ alg: 'HS256' })}.${json({})}.ab+/`],
    ['non-zero pad bits', `${json({ alg: 'none' }).slice(0, -1)}1.${json({})}.`],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Jwt(text)).toThrow(NominalError);
  });

  it.each([
    ['a header that is an array', tokenOf([{ alg: 'HS256' }], {})],
    ['a header that is null', tokenOf(null, {})],
    ['a header without alg', tokenOf({ typ: 'JWT' }, {})],
    ['an alg that is a number', tokenOf({ alg: 256 }, {})],
    ['an empty alg', tokenOf({ alg: '' }, {})],
    ['a payload that is an array', tokenOf({ alg: 'HS256' }, [1])],
    ['a payload that is a string', tokenOf({ alg: 'HS256' }, 'claims')],
    [
      'a payload that is a nested JWT',
      `${json({ alg: 'HS256', cty: 'JWT' })}.${encoded(token)}.${signature}`,
    ],
    ['an exp that is text', tokenOf({ alg: 'HS256' }, { exp: '1767225600' })],
    ['an nbf that is null', tokenOf({ alg: 'HS256' }, { nbf: null })],
    ['an iat that is an object', tokenOf({ alg: 'HS256' }, { iat: {} })],
    [
      'bytes that are not UTF-8',
      `${json({ alg: 'HS256' })}.${encoded(new Uint8Array([0x7b, 0xff, 0x7d]))}.${signature}`,
    ],
    ['JSON after a byte order mark', `${encoded('﻿{"alg":"HS256"}')}.${json({})}.${signature}`],
    ['JSON with a trailing comma', `${encoded('{"alg":"HS256",}')}.${json({})}.${signature}`],
  ])('rejects %s', (_, text) => {
    expect(Jwt.parse(text).ok).toBe(false);
  });

  it('takes an empty signature for alg none only', () => {
    expect(Jwt.parse(tokenOf({ alg: 'none' }, {}, '')).ok).toBe(true);
    expect(Jwt.parse(tokenOf({ alg: 'none' }, {})).ok).toBe(false);
    expect(Jwt.parse(tokenOf({ alg: 'HS256' }, {}, '')).ok).toBe(false);
    expect(Jwt.parse(tokenOf({ alg: 'None' }, {}, '')).ok).toBe(false);
  });

  it('accepts a token of 8,192 characters and refuses one longer', () => {
    const sized = Array.from({ length: 64 }, (_, index) =>
      tokenOf({ alg: 'HS256' }, { pad: 'x'.repeat(6050 + index) }),
    );
    const longest = sized.find((text) => text.length === Jwt.maxLength);
    const longer = sized.find((text) => text.length > Jwt.maxLength);

    expect(longest).toHaveLength(Jwt.maxLength);
    expect(Jwt.parse(longest).ok).toBe(true);
    expect(Jwt.parse(longer).ok).toBe(false);
  });

  it.each([42, null, undefined, {}, [], new Object(token)])('rejects %o', (input) => {
    expect(Jwt.parse(input).ok).toBe(false);
  });

  it('says why it refuses, and leaves the token out', () => {
    expect(Jwt.parse('foo.bar.')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be a JWT in compact form (was a string of 8 characters)' }],
    });
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Jwt.parse('a'.repeat(1_000_000)).ok).toBe(false);
    expect(Jwt.parse(`${token}${'a'.repeat(1_000_000)}`).ok).toBe(false);
    expect(Jwt.parse(`${'a'.repeat(8000)}.`).ok).toBe(false);
    expect(Jwt.parse(`${'a'.repeat(4000)}.${'a'.repeat(4000)}=`).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('reads the header and the claims into new objects', () => {
    const jwt = new Jwt(token);
    const header = jwt.header;

    header['alg'] = 'none';

    expect(jwt.header).toStrictEqual({ alg: 'HS256', typ: 'JWT' });
    expect(jwt.payload).toStrictEqual({ sub: 'user-42', exp: 1_767_225_600 });
    expect(jwt.payload).not.toBe(jwt.payload);
    expect(jwt.algorithm).toBe('HS256');
  });

  it('reads when it expires', () => {
    expect(new Jwt(token).expiresAt).toStrictEqual(new Date('2026-01-01T00:00:00Z'));
    expect(new Jwt(tokenOf({ alg: 'HS256' }, { exp: 1.5 })).expiresAt).toStrictEqual(
      new Date(1500),
    );
    expect(new Jwt(tokenOf({ alg: 'HS256' }, {})).expiresAt).toBeUndefined();
  });

  it('compares the text, also with another copy', async () => {
    const copy = await anotherCopy();

    expect(new Jwt(token).equals(new copy.Jwt(token))).toBe(true);
    expect(new Jwt(token).equals(new Jwt(tokenOf({ alg: 'HS256' }, {})))).toBe(false);
    expect(new Jwt(token).equals(token)).toBe(false);
  });
});

describe('Jwt as JSON Schema', () => {
  it.each(['eyJhbGciOiJub25lIn0.e30.', 'eyJhbGciOiJIUzI1NiJ9.e30.c2ln'])(
    'accepts %s like the type does',
    (text) => {
      expect(Jwt.parse(text).ok).toBe(true);
      expect(
        satisfiesSchema(Jwt['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
      ).toBe(true);
    },
  );

  it.each([
    '..',
    '.babelrc.cjs',
    'eyJhbGciOiJIUzI1NiJ9.e30',
    'eyJhbGciOiJIUzI1NiJ9=.e30.c2ln',
    `${'a'.repeat(8190)}.e30.`,
  ])('rejects %s like the type does', (text) => {
    expect(Jwt.parse(text).ok).toBe(false);
    expect(
      satisfiesSchema(Jwt['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
    ).toBe(false);
  });

  const schema = Jwt['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  const texts = [
    token,
    tokenOf({ alg: 'none' }, {}, ''),
    ...randomTexts(
      ['eyJ', 'hbGciOiJub25lIn0', 'e30', '.', 'A', 'Q', 'x', '_', '=', '+', ' '],
      20_000,
      9,
    ),
  ];

  it('describes its shape', () => {
    expect(schema).toMatchObject({
      type: 'string',
      pattern: Jwt.pattern.source,
      maxLength: Jwt.maxLength,
    });
  });

  // A pattern cannot decode JSON, so the schema accepts parts that are not JSON objects.
  it('agrees with the type on generated text, apart from the JSON inside', () => {
    const disagreements = disagreementsOf(Jwt, texts);

    expect(disagreements.filter((text) => Jwt.parse(text).ok)).toStrictEqual([]);
    expect(disagreements.filter((text) => !satisfiesSchema(schema, text))).toStrictEqual([]);
  });

  it('refuses what the type refuses for its shape', () => {
    const shapes = [
      '..',
      '.babelrc.cjs',
      `${token}=`,
      `${token}.x`,
      `Bearer ${token}`,
      'a'.repeat(8193),
    ];

    expect(shapes.filter((text) => satisfiesSchema(schema, text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => satisfiesSchema(schema, text)).length).toBeGreaterThan(10);
    expect(texts.filter((text) => !satisfiesSchema(schema, text)).length).toBeGreaterThan(100);
  });
});
