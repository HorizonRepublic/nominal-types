import type { AnyConstraint } from './constraint-types.ts';

/**
 * Internal: the mark every constraint carries, shared by copies of this package.
 */
export const constraintMark: symbol = Symbol.for('@horizon-republic/nominal-types/constraint');

/**
 * Whether a value is a constraint, also one built by another copy of this package.
 */
export const isConstraint = (value: unknown): value is AnyConstraint =>
  typeof value === 'object' && value !== null && Reflect.get(value, constraintMark) === true;

/**
 * Internal: throws when a constraint reads a key the object it is attached to doesn't declare.
 *
 * @remarks
 * Objects that drop undeclared keys before their constraints run, such as `n.object()` and Zod's
 * and Valibot's objects, would fail such a constraint on every value; the mistake is in the
 * declaration, so it is reported where it is made.
 *
 * @throws TypeError naming the keys the object lacks.
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
