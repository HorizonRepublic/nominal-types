import type { SubtypeOf } from '../../core/contracts.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { uuidVersion } from './uuid-version.ts';
import { Uuid } from './uuid.ts';

const pattern =
  /^[\dA-Fa-f]{8}-[\dA-Fa-f]{4}-4[\dA-Fa-f]{3}-[89ABab][\dA-Fa-f]{3}-[\dA-Fa-f]{12}$/u;

const UuidV4Base: SubtypeOf<typeof Uuid, 'nominal.UuidV4'> = Uuid.subtype(
  'nominal.UuidV4',
  uuidVersion('4', ['6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718']),
);

/**
 * A random UUID, version 4 of RFC 9562 (section 5.4), for an id that must not reveal when it was
 * made.
 *
 * @remarks
 * The nil and max UUIDs are refused. Like `Uuid`, either case passes and is kept as written.
 *
 * @example
 * ```ts
 * import { UuidV4 } from '@horizon-republic/nominal-types';
 *
 * const id = new UuidV4(crypto.randomUUID());
 * id.version; // 4
 * ```
 */
export class UuidV4 extends UuidV4Base {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof UuidV4>;

  /**
   * A version 4 UUID with the RFC 9562 variant, in either case, for building patterns of your own.
   *
   * @remarks
   * The rule doesn't run it: it reads the version digit once the rule of `Uuid` has passed.
   */
  public static override readonly pattern: RegExp = pattern;

  /**
   * The same UUID in lowercase.
   *
   * @returns A UUID of the same class.
   */
  public override canonical(): this {
    return sameType(this, this.value.toLowerCase());
  }
}
