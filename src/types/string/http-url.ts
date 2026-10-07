import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { Url } from './url.ts';

const HttpUrlBase: SubtypeOf<typeof Url, 'HttpUrl'> = Url.subtype(
  'HttpUrl',
  matching(/^[Hh][Tt][Tt][Pp][Ss]?:\/\//u, 'an http or https URL'),
);

/**
 * An absolute URL whose scheme is `http` or `https`.
 */
export class HttpUrl extends HttpUrlBase {}
