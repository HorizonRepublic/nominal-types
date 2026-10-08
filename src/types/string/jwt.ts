import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { decodeBase64 } from './base64-decode.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const digit = '[\\dA-Za-z_-]';

const quad = `${digit}${digit}${digit}${digit}`;

// The last characters of a base64url part without padding whose pad bits are zero, as
// `Base64Url` takes it.
const tail = `${digit}[AQgw]|${digit}${digit}[048AEIMQUYcgkosw]`;

const part = `(?:${quad})*(?:${tail})?`;

const filledPart = `(?:${quad})*(?:${quad}|${tail})`;

// Header, payload and signature; the signature is empty only for an unsecured JWT.
const pattern = new RegExp(`^${filledPart}\\.${filledPart}\\.${part}$`, 'u');

const longest = 8192;

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// The claims RFC 7519 §4.1.4 to §4.1.6 require to be a NumericDate, a number of seconds.
const timeClaims = ['exp', 'nbf', 'iat'];

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The JSON object a checked base64url part holds, or undefined for bytes that are not UTF-8 or
// text that is not a JSON object.
const objectIn = (text: string): JsonObject | undefined => {
  try {
    const value: unknown = JSON.parse(utf8.decode(decodeBase64(text, 'base64url')));

    return isJsonObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const hasNumericTimes = (claims: JsonObject): boolean =>
  timeClaims.every(
    (name) =>
      !Object.hasOwn(claims, name) ||
      (typeof claims[name] === 'number' && Number.isFinite(claims[name])),
  );

const isJwtText = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > longest || !pattern.test(value)) {
    return false;
  }

  const [header = '', payload = '', signature = ''] = value.split('.');
  const fields = objectIn(header);
  const claims = objectIn(payload);
  const algorithm = fields?.['alg'];

  return (
    typeof algorithm === 'string' &&
    algorithm !== '' &&
    (algorithm === 'none') === (signature === '') &&
    claims !== undefined &&
    hasNumericTimes(claims)
  );
};

const JwtBase: SubtypeOf<typeof AnyString, 'nominal.Jwt', string, typeof NonBlankString> =
  AnyString.subtype(
    'nominal.Jwt',
    stringOnly(
      satisfying(isJwtText, 'a JWT in compact form', {
        type: 'string',
        pattern: pattern.source,
        maxLength: longest,
        examples: [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTQyIiwiZXhwIjoxNzY3MjI1NjAwfQ.ov8aVnMn4lXxVLhUxcOz6r8OM1VJKnuKptMFIyhE0wU',
        ],
      }),
    ),
    { implies: [nonBlankString], sensitive: true },
  );

const partAt = (text: string, index: number): JsonObject =>
  objectIn(text.split('.')[index] ?? '') ?? {};

/**
 * A JSON Web Token of RFC 7519 in the compact form of a JWS (RFC 7515 §7.1), such as an access
 * token from a `Bearer` header: a header, a payload and a signature in base64url, joined by dots.
 *
 * @remarks
 * Only the form is checked, never the signature: anyone can make a token this type accepts, so
 * nothing in `header` or `payload` can be trusted until a JWT library such as jose has verified it
 * with the key. The header and the payload must be JSON objects, the header must name its `alg`,
 * and `exp`, `nbf` and `iat`, where present, must be numbers. The signature is empty when, and only
 * when, `alg` is `none`. Encrypted tokens (JWE, five parts) and tokens longer than 8,192 characters
 * are refused. A token is a credential, so messages leave it out.
 *
 * @example
 * ```ts
 * import { Jwt } from '@horizon-republic/nominal-types';
 *
 * declare const authorization: string;
 *
 * const token = new Jwt(authorization.slice('Bearer '.length));
 * token.algorithm; // 'RS256'
 * token.expiresAt; // a Date, from `exp`, not verified
 * ```
 */
export class Jwt extends JwtBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Jwt>;

  /**
   * The shape of a JWT, which the JSON Schema carries; the JSON inside it and the length limit are
   * checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The longest token the type accepts, in characters.
   */
  public static readonly maxLength: number = longest;

  /**
   * The header, decoded into a new object: `alg`, `typ`, `kid` and so on. Not verified.
   */
  public get header(): Record<string, unknown> {
    return partAt(this.value, 0);
  }

  /**
   * The claims, decoded into a new object: `sub`, `exp` and so on. Not verified: read them only
   * after a JWT library has checked the signature.
   */
  public get payload(): Record<string, unknown> {
    return partAt(this.value, 1);
  }

  /**
   * The `alg` of the header, such as `'RS256'`, or `'none'` for an unsecured token. Not verified.
   */
  public get algorithm(): string {
    return String(this.header['alg']);
  }

  /**
   * When the token expires, from the `exp` claim; `undefined` without one. Not verified.
   */
  public get expiresAt(): Date | undefined {
    const expires = this.payload['exp'];

    return typeof expires === 'number' ? new Date(expires * 1000) : undefined;
  }
}
