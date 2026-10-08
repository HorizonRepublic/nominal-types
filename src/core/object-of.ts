import type { AnyConstraint } from './constraint-types.ts';
import { objectMark } from './object-rule.ts';
import { ObjectSchema } from './object-schema.ts';
import type { ObjectFields, ObjectInput, ObjectValue } from './object-types.ts';

/**
 * Whether a value is a schema built by `n.object()`, also by another copy of this package.
 */
export const isObjectSchema = (value: unknown): value is ObjectSchema<unknown, unknown> =>
  typeof value === 'object' && value !== null && Reflect.get(value, objectMark) === true;

/**
 * Builds a schema for an object whose fields are nominal types, for a request body, a message or
 * a value object made of several fields.
 *
 * @remarks
 * Every field is checked and every issue collected, with the field's key in its path. Keys the
 * schema doesn't declare are dropped; call `strict()` to refuse them. A field whose schema accepts
 * `undefined`, such as `n.of(Type).optional()`, may be missing; any other missing field is
 * reported as `is required`. Only the input's own keys are read. The constraints run once every
 * field is valid. The result is a new object, read-only by type; given to `Nominal()`, it is
 * frozen.
 *
 * Given to `Nominal()`, it makes a class with a getter for each field and `copyWith()`.
 *
 * @throws TypeError for a field named `__proto__`.
 *
 * @example
 * ```ts
 * export const CreateOrder = n.object({
 *   email: Email,
 *   quantity: PositiveInteger,
 *   note: n.of(AnyString).optional(),
 * });
 *
 * CreateOrder.parse(body); // { ok: true, value: { email: Email, quantity: PositiveInteger } }
 * ```
 */
export const objectOf = <const Fields extends ObjectFields>(
  fields: Fields,
  ...constraints: AnyConstraint[]
): ObjectSchema<ObjectInput<Fields>, ObjectValue<Fields>> =>
  new ObjectSchema(fields, constraints, false);
