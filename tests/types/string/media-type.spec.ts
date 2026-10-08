import { describe, expect, it, vi } from 'vitest';

import { AnyString, MediaType, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';

const schema = MediaType['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const longestName = `a${'b'.repeat(126)}`;

describe('MediaType', () => {
  it.each([
    'text/plain',
    'application/json',
    'Application/JSON',
    'image/svg+xml',
    'application/vnd.api+json',
    'application/x-www-form-urlencoded',
    'audio/3gpp2',
    'a/b!#$&-^_.+',
    'text/plain;charset=utf-8',
    'text/plain; charset=utf-8',
    'text/plain ;\tcharset=utf-8',
    'text/plain;charset="utf-8"',
    'text/plain;charset=""',
    'multipart/form-data; boundary="a b;c=d\\"e\\\\f"',
    'text/plain;a=1;b=2',
    "text/plain;x=!#$%&'*+-.^_`|~0",
    'text/plain;a="é"',
    `${longestName}/${longestName}`,
  ])('accepts %j', (text) => {
    expect(new MediaType(text).value).toBe(text);
  });

  it.each([
    '',
    'text',
    'text/',
    '/plain',
    'text/plain/x',
    '*/*',
    'text/*',
    '-text/plain',
    'text/.plain',
    'text /plain',
    'text/ plain',
    ' text/plain',
    'text/plain ',
    'text/plain;',
    'text/plain; ',
    'text/plain;;charset=utf-8',
    'text/plain;charset',
    'text/plain;charset=',
    'text/plain;charset =utf-8',
    'text/plain;charset= utf-8',
    'text/plain;charset=utf 8',
    'text/plain;charset="utf-8',
    'text/plain;charset="a"b',
    'text/plain;charset="a\\"',
    'text/plain;a="\u0001"',
    'text/plain;a="ā"',
    'text/plain;a=é',
    'text/plain;a=1,b=2',
    'текст/plain',
    `a${longestName}/b`,
    `a/b${longestName}`,
  ])('rejects %j', (text) => {
    expect(() => new MediaType(text)).toThrow(NominalError);
  });

  it.each([42, null, undefined, true, ['text/plain'], { type: 'text' }])(
    'rejects %o, which is not a string',
    (value) => {
      expect(MediaType.parse(value).ok).toBe(false);
    },
  );

  it.each(['text/plain;charset=a;charset=b', 'text/plain; a=1; A="2"', 'a/b;x=1;y=2;x=3'])(
    'rejects %j, which names a parameter twice (RFC 6838 §4.3)',
    (text) => {
      expect(MediaType.parse(text).ok).toBe(false);
    },
  );

  it('keeps a ; inside a quoted value apart from the parameters', () => {
    expect(MediaType.parse('a/b;x="1;x=2"').ok).toBe(true);
  });

  it('reports the rejection in words', () => {
    expect(MediaType.parse('*/*')).toMatchObject({
      ok: false,
      issues: [{ message: 'must be a media type (was "*/*")' }],
    });
  });

  it('is a string type', () => {
    expect(new MediaType('text/plain')).toBeInstanceOf(AnyString);
  });

  describe('parts', () => {
    const type = new MediaType('Application/LD+JSON ; Charset="utf-8";profile=x');

    it('splits the type and subtype as written', () => {
      expect(type.type).toBe('Application');
      expect(type.subtype).toBe('LD+JSON');
      expect(type.essence).toBe('application/ld+json');
    });

    it('reads the suffix after the last +', () => {
      expect(type.suffix).toBe('JSON');
      expect(new MediaType('application/a+b+zip').suffix).toBe('zip');
      expect(new MediaType('text/plain').suffix).toBeUndefined();
      expect(new MediaType('application/a+').suffix).toBeUndefined();
    });

    it('reads parameters by lowercase name with values unquoted', () => {
      expect([...type.parameters]).toStrictEqual([
        ['charset', 'utf-8'],
        ['profile', 'x'],
      ]);
      expect(type.charset).toBe('utf-8');
      expect(new MediaType('text/plain').charset).toBeUndefined();
    });

    it('unescapes quoted pairs', () => {
      const quoted = new MediaType('a/b;x="a\\"b\\\\c\\d";y=1');

      expect(quoted.parameters.get('x')).toBe('a"b\\cd');
      expect(quoted.parameters.get('y')).toBe('1');
    });

    it('hands out a fresh map each time', () => {
      expect(type.parameters).not.toBe(type.parameters);
    });

    it.each([
      ['application/json', true],
      ['APPLICATION/JSON;charset=utf-8', true],
      ['application/problem+json', true],
      ['application/vnd.api+JSON', true],
      ['text/json', false],
      ['application/jsonp', false],
      ['text/plain', false],
    ])('tells whether %s is JSON', (text, json) => {
      expect(new MediaType(text).isJson).toBe(json);
    });
  });

  describe('canonical form', () => {
    it.each([
      ['Text/HTML; Charset="utf-8"', 'text/html;charset=utf-8'],
      ['text/plain', 'text/plain'],
      ['a/b ; x="" ;\ty="a b"', 'a/b;x="";y="a b"'],
      ['a/b;x="a\\"b\\\\c\\d"', 'a/b;x="a\\"b\\\\cd"'],
      ['a/b;x=UTF-8', 'a/b;x=UTF-8'],
    ])('writes %j as %j', (text, canonical) => {
      expect(new MediaType(text).canonical().value).toBe(canonical);
    });

    it('compares regardless of case, spaces and quoting, but not of values', () => {
      expect(
        new MediaType('Text/HTML; Charset="utf-8"').equals(
          new MediaType('text/html;charset=utf-8'),
        ),
      ).toBe(true);
      expect(
        new MediaType('text/html;charset=UTF-8').equals(new MediaType('text/html;charset=utf-8')),
      ).toBe(false);
      expect(new MediaType('text/html').equals('text/html')).toBe(false);
    });
  });

  describe('JSON Schema', () => {
    it('describes the grammar', () => {
      expect(schema).toMatchObject({
        type: 'string',
        pattern: MediaType.pattern.source,
        minLength: 3,
      });
    });

    it.each([
      'text/plain',
      'text/plain; charset="utf-8"',
      `${longestName}/${longestName}`,
      `a${longestName}/b`,
      '*/*',
      'text/plain;',
      'a/',
      '',
    ])('agrees with the type on %j', (text) => {
      expect(satisfiesSchema(schema, text)).toBe(MediaType.parse(text).ok);
    });

    it('lets a repeated parameter through, which only the type refuses', () => {
      expect(satisfiesSchema(schema, 'a/b;x=1;x=2')).toBe(true);
      expect(MediaType.parse('a/b;x=1;x=2').ok).toBe(false);
    });
  });

  it.each([
    ['spaces and semicolons', `a/b${' ;a=b'.repeat(20_000)} x`],
    ['empty parameters', `a/b${'; '.repeat(50_000)}`],
    ['an open quoted string', `a/b;a="${'\\"'.repeat(50_000)}`],
    ['a long name', `${'a'.repeat(100_000)}/b`],
    ['a parameter without a value', `a/b;${'a'.repeat(100_000)}`],
  ])('refuses a long crafted input of %s quickly', (_, text) => {
    const start = performance.now();

    expect(MediaType.parse(text).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('checks many parameters for repeats quickly', () => {
    const text = `a/b${Array.from({ length: 10_000 }, (_, index) => `;p${index}=v`).join('')}`;
    const start = performance.now();

    expect(MediaType.parse(text).ok).toBe(true);
    expect(MediaType.parse(`${text};p0=v`).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('compares with a media type built by another copy of the package', async () => {
    vi.resetModules();
    const copy = await import('../../../src/index.ts');

    expect(new copy.MediaType('Text/Plain').equals(new MediaType('text/plain'))).toBe(true);
    expect(MediaType.parse(new copy.MediaType('text/plain')).ok).toBe(true);
  });
});

describe('MediaType equals() on a type that refuses the canonical form', () => {
  const UpperType = MediaType.subtype('tests.UpperType', /^[A-Z]/u);

  it('compares the canonical text without throwing', () => {
    expect(new UpperType('TEXT/Plain').equals(new UpperType('Text/PLAIN'))).toBe(true);
    expect(new UpperType('TEXT/Plain').equals(new UpperType('TEXT/html'))).toBe(false);
    expect(() => new UpperType('TEXT/Plain').canonical()).toThrow(NominalError);
  });
});
