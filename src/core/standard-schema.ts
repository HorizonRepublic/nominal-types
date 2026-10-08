import type { AnyNominalType, InputOf } from './contracts.ts';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from './standard-spec.ts';

/**
 * The `~standard` property every nominal type carries, which makes it a Standard Schema and a
 * Standard JSON Schema at once.
 *
 * @remarks
 * `validate` never returns a Promise, so consumers that require a synchronous result accept every
 * nominal type.
 *
 * @typeParam Input - The type of the values the schema accepts.
 * @typeParam Output - The type of the value the schema gives back.
 */
export interface StandardProps<Input, Output>
  extends
    Omit<StandardSchemaV1.Props<Input, Output>, 'validate'>,
    StandardJSONSchemaV1.Props<Input, Output> {
  /**
   * Checks a value: `{ value }` when it is accepted, or `{ issues }`. Never a Promise.
   *
   * @example
   * ```ts
   * import { Email } from '@horizon-republic/nominal-types';
   *
   * Email['~standard'].validate('jane');
   * // { issues: [{ message: 'must be an email address (was a string of 4 characters)' }] }
   * ```
   */
  readonly validate: (
    value: unknown,
    options?: StandardSchemaV1.Options,
  ) => StandardSchemaV1.Result<Output>;
}

/**
 * A plain object that is a Standard Schema, for libraries that accept schema objects but not
 * classes.
 *
 * @typeParam Input - The type of the values the schema accepts.
 * @typeParam Output - The type of the value the schema gives back.
 */
export interface StandardSchema<Input, Output> {
  /**
   * The Standard Schema and Standard JSON Schema properties.
   */
  readonly '~standard': StandardProps<Input, Output>;
}

/**
 * The `~standard` property of a class that adds members of its own, typed with the class itself,
 * so Standard Schema libraries such as tRPC, Hono and Elysia see those members.
 *
 * @remarks
 * TypeScript types an inherited static property as the parent declared it, so without this line
 * the libraries see the instance of the type the class extends. A class that adds no members needs
 * nothing.
 *
 * @typeParam Type - The class, given as `typeof` the class.
 *
 * @example
 * ```ts
 * import { AnyString } from '@horizon-republic/nominal-types';
 * import type { StandardOf } from '@horizon-republic/nominal-types';
 *
 * class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
 *   declare static readonly '~standard': StandardOf<typeof Username>;
 *
 *   get initial(): string {
 *     return this.value.charAt(0);
 *   }
 * }
 * ```
 */
export type StandardOf<Type extends AnyNominalType & (abstract new (input: never) => unknown)> =
  StandardProps<InputOf<Type['rule']>, InstanceType<Type>>;
