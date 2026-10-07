import { type } from 'arktype';
import type { Type } from 'arktype';

import type { NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';

const urlSchema: Type<string> = type('string.url');

const UrlBase: NominalType<'Url', Type<string>> = Nominal('Url', urlSchema);

/**
 * An absolute URL as the WHATWG URL standard parses it, with any scheme.
 *
 * @remarks
 * Any scheme passes, `mailto:` and `javascript:` among them; reach for `HttpUrl` where only web
 * addresses belong. The value keeps the text as given, while the accessors read the parsed form.
 */
export class Url extends UrlBase {
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
  public canonical(): Url {
    return new Url(this.toURL().href);
  }
}
