import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Url } from './url.ts';

const HttpUrlBase: SubtypeOf<typeof Url, 'nominal.HttpUrl'> = Url.subtype(
  'nominal.HttpUrl',
  matching(/^[Hh][Tt][Tt][Pp][Ss]?:\/\//u, 'an http or https URL', {
    examples: ['https://example.com/docs'],
  }),
);

/**
 * An absolute URL whose scheme is `http` or `https`.
 *
 * @remarks
 * It is a subtype of {@link Url}, so it has the same members.
 *
 * @example
 * ```ts
 * import { HttpUrl } from '@horizon-republic/nominal-types';
 *
 * const docs = new HttpUrl('https://example.com/docs');
 * HttpUrl.accepts('ftp://example.com/file'); // false
 * ```
 */
export class HttpUrl extends HttpUrlBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof HttpUrl>;
}
