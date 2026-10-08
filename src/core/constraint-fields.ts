import type { AnyConstraint } from './constraint-types.ts';

/**
 * The mark every constraint carries, shared by copies of this package.
 *
 * @internal
 */
export const constraintMark: symbol = Symbol.for('@horizon-republic/nominal-types/constraint');

/**
 * Whether a value is a constraint, also one built by another copy of this package.
 *
 * @param value - The value to test.
 * @returns `true` for a constraint built by `n.constraint()`, `false` for anything else.
 *
 * @example
 * ```ts
 * import { n, PositiveInteger } from '@horizon-republic/nominal-types';
 *
 * const positive = n.constraint({ count: PositiveInteger }, () => true);
 *
 * n.isConstraint(positive); // true
 * n.isConstraint({}); // false
 * ```
 */
export const isConstraint = (value: unknown): value is AnyConstraint =>
  typeof value === 'object' && value !== null && Reflect.get(value, constraintMark) === true;

/**
 * Throws when a constraint reads a key the object it is attached to doesn't declare.
 *
 * @remarks
 * Objects that drop undeclared keys before their constraints run, such as `n.object()` and Zod's
 * and Valibot's objects, would fail such a constraint on every value; the mistake is in the
 * declaration, so it is reported where it is made.
 *
 * @param owner - The name the message starts with, such as `n.object`.
 * @param keys - The keys the object declares.
 * @param constraints - The constraints attached to the object.
 * @throws {@link TypeError} when a constraint reads a key the object doesn't declare.
 *
 * @internal
 */
export const checkConstraintFields = (
  owner: string,
  keys: readonly string[],
  constraints: readonly AnyConstraint[],
): void => {
  for (const rule of constraints) {
    const listed: unknown = Reflect.get(rule, 'fields');
    const missing =
      typeof listed === 'object' && listed !== null
        ? Object.keys(listed).filter((key) => !keys.includes(key))
        : [];

    if (missing.length > 0) {
      throw new TypeError(
        `${owner}: a constraint reads ${missing.join(', ')}, which the object does not declare`,
      );
    }
  }
};
