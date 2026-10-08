import type { SubtypeOf } from '../../core/contracts.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { uuidVersion } from './uuid-version.ts';
import { Uuid } from './uuid.ts';

const pattern =
  /^[\dA-Fa-f]{8}-[\dA-Fa-f]{4}-7[\dA-Fa-f]{3}-[89ABab][\dA-Fa-f]{3}-[\dA-Fa-f]{12}$/u;

const UuidV7Base: SubtypeOf<typeof Uuid, 'nominal.UuidV7'> = Uuid.subtype(
  'nominal.UuidV7',
  uuidVersion('7', ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']),
);

/**
 * A time-ordered UUID, version 7 of RFC 9562 (section 5.7), for an id that sorts by the moment it
 * was made.
 *
 * @remarks
 * The nil and max UUIDs are refused. Like `Uuid`, either case passes and is kept as written.
 *
 * @example
 * ```ts
 * import { UuidV7 } from '@horizon-republic/nominal-types';
 *
 * new UuidV7('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f').timestamp; // 2024-07-27T01:15:56.618Z
 * ```
 */
export class UuidV7 extends UuidV7Base {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof UuidV7>;

  /**
   * A version 7 UUID with the RFC 9562 variant, in either case, for building patterns of your own.
   *
   * @remarks
   * The rule doesn't run it: it reads the version digit once the rule of `Uuid` has passed.
   */
  public static override readonly pattern: RegExp = pattern;

  /**
   * The moment the UUID was made, read from its leading 48 bits.
   */
  public override get timestamp(): Date {
    return new Date(Number.parseInt(this.value.slice(0, 8) + this.value.slice(9, 13), 16));
  }

  /**
   * The same UUID in lowercase.
   *
   * @returns A UUID of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public override canonical(): this {
    return sameType(this, this.value.toLowerCase());
  }
}
