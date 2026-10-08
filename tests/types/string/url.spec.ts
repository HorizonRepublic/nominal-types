import { describe, expect, it } from 'vitest';

import { HttpUrl, NominalError, Url } from '../../../src/index.ts';
import { valueOf } from '../../support/results.ts';

describe('Url', () => {
  it.each(['https://example.com/a?b=1#c', 'mailto:jane@example.com', 'http://localhost:3000'])(
    'accepts %s',
    (text) => {
      expect(new Url(text).value).toBe(text);
    },
  );

  it.each(['example.com', '/relative/path', 'not a url'])('rejects %s', (text) => {
    expect(() => new Url(text)).toThrow(NominalError);
  });

  it.each([
    ['a space before it', ' https://example.com'],
    ['a space after it', 'https://example.com '],
    ['a line break inside', 'https://exa\nmple.com'],
    ['a carriage return inside', 'https://exa\rmple.com'],
    ['a tab inside', 'https://example.com/a\tb'],
    ['a NUL before it', '\u0000https://example.com'],
    ['a control character in the path', 'https://example.com/a\u001Fb'],
    ['a line break after it', 'https://example.com\n'],
  ])('refuses text the parser would clean up: %s', (_, text) => {
    expect(URL.canParse(text)).toBe(true);
    expect(Url.parse(text).ok).toBe(false);
    expect(HttpUrl.parse(text).ok).toBe(false);
  });

  it('keeps the first character after the controls, and refuses spaces and DEL anywhere', () => {
    expect(new Url('https://example.com/!').value).toBe('https://example.com/!');
    expect(new Url('https://example.com/a%20b').value).toBe('https://example.com/a%20b');
    expect(Url.parse('https://example.com/a b').ok).toBe(false);
    expect(Url.parse('https://example.com/a\u007Fb').ok).toBe(false);
  });

  it('takes javascript:, data: and file: URLs, which HttpUrl refuses', () => {
    for (const text of ['javascript:alert(1)', 'data:text/html,<b>hi</b>', 'file:///etc/passwd']) {
      expect(Url.parse(text).ok).toBe(true);
      expect(HttpUrl.parse(text).ok).toBe(false);
    }
  });

  it('reads the parsed parts', () => {
    const url = new Url('https://Example.com:8443/a/b?x=1&y=2#top');

    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('example.com');
    expect(url.host).toBe('example.com:8443');
    expect(url.origin).toBe('https://example.com:8443');
    expect(url.pathname).toBe('/a/b');
    expect(url.searchParams.get('y')).toBe('2');
  });

  it('hands out a fresh URL each time', () => {
    const url = new Url('https://example.com/');
    const copy = url.toURL();

    copy.pathname = '/changed';

    expect(url.toURL().pathname).toBe('/');
  });

  it('normalises through the WHATWG parser', () => {
    expect(new Url('HTTPS://Example.COM:443/a').canonical().value).toBe('https://example.com/a');
  });
});

describe('HttpUrl', () => {
  it.each(['https://example.com', 'http://localhost:3000/x', 'HTTPS://EXAMPLE.COM'])(
    'accepts %s',
    (text) => {
      expect(new HttpUrl(text).value).toBe(text);
    },
  );

  it.each(['mailto:jane@example.com', 'javascript:alert(1)', 'ftp://example.com'])(
    'rejects %s',
    (text) => {
      expect(() => new HttpUrl(text)).toThrow(NominalError);
    },
  );

  it('is a Url, while a Url is not necessarily an HttpUrl', () => {
    expect(new HttpUrl('https://example.com')).toBeInstanceOf(Url);
    expect(new Url('mailto:jane@example.com')).not.toBeInstanceOf(HttpUrl);
  });
});

describe('narrowing a Url to an HttpUrl', () => {
  it('narrows a web address', () => {
    expect(valueOf(HttpUrl.parse(new Url('https://example.com')))).toBeInstanceOf(HttpUrl);
  });

  it('refuses any other scheme', () => {
    expect(HttpUrl.parse(new Url('mailto:jane@example.com')).ok).toBe(false);
  });
});

describe('Url as JSON Schema', () => {
  it('describes itself as a URI string', () => {
    expect(Url['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toStrictEqual({
      title: 'nominal.Url',
      type: 'string',
      format: 'uri',
      pattern: '^[^\\u0000-\\u0020\\u007F]+$',
      example: 'https://example.com/docs',
      description: 'a URL',
    });
  });
});
