import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';

// A URL holds no spaces or control characters (RFC 3986). The WHATWG parser would drop some of
// them and encode others, so text holding them would pass while the value differs from the URL.
// oxlint-disable-next-line no-control-regex
const parsedAsWritten = /^[^\u0000-\u0020\u007F]+$/u;

const isAbsoluteUrl = (value: unknown): value is string =>
  typeof value === 'string' && parsedAsWritten.test(value) && URL.canParse(value);

const UrlBase: SubtypeOf<typeof AnyString, 'nominal.Url'> = AnyString.subtype(
  'nominal.Url',
  stringOnly(
    satisfying(isAbsoluteUrl, 'a URL', {
      type: 'string',
      format: 'uri',
      pattern: parsedAsWritten.source,
      examples: ['https://example.com/docs'],
    }),
  ),
);

/**
 * An absolute URL as the WHATWG URL standard parses it, with any scheme.
 *
 * @remarks
 * Any scheme passes, `javascript:`, `data:`, `file:` and `mailto:` among them; reach for `HttpUrl`
 * for a link shown to users or fetched by the server. The value keeps the text as given, while the
 * accessors read the parsed form. Control characters, and a space at either end, are refused,
 * since the parser would drop them and the value would differ from the URL it read.
 */
export class Url extends UrlBase {
  declare public static readonly '~standard': StandardOf<typeof Url>;

  /**
   * A fresh `URL` for this address; each call builds a new one, since `URL` is mutable.
   */
  public toURL(): URL {
    return new URL(this.value);
  }

  /**
   * The scheme with its trailing colon, such as `https:`.
   */
  public get protocol(): string {
    return this.toURL().protocol;
  }

  /**
   * The host name without the port.
   */
  public get hostname(): string {
    return this.toURL().hostname;
  }

  /**
   * The host name with the port when one is given.
   */
  public get host(): string {
    return this.toURL().host;
  }

  /**
   * The scheme, host and port.
   */
  public get origin(): string {
    return this.toURL().origin;
  }

  /**
   * The path, starting with `/` for hierarchical schemes.
   */
  public get pathname(): string {
    return this.toURL().pathname;
  }

  /**
   * A fresh copy of the query parameters.
   */
  public get searchParams(): URLSearchParams {
    return this.toURL().searchParams;
  }

  /**
   * The URL serialised by the WHATWG parser: scheme and host lowered, default port dropped.
   */
  public canonical(): this {
    return sameType(this, this.toURL().href);
  }
}
