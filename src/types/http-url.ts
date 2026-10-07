import type { RefinedType } from '../core/contracts.ts';
import { Url } from './url.ts';

const HttpUrlBase: RefinedType<typeof Url, 'HttpUrl'> = Url.refine('HttpUrl', (schema) =>
  schema.and(/^https?:\/\//iu).describe('an http or https URL'),
);

/**
 * An absolute URL whose scheme is `http` or `https`.
 */
export class HttpUrl extends HttpUrlBase {}
