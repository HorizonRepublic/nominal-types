const hasEquals = (value: unknown): value is { equals: (other: unknown) => boolean } =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'equals') === 'function';

/**
 * Internal: whether two values are the same: `Object.is` for a single value, item by item for an
 * array, with nominal items compared by their own `equals`.
 */
export const sameValue = (left: unknown, right: unknown): boolean =>
  Object.is(left, right) ||
  (Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((item: unknown, index) =>
      hasEquals(item) ? item.equals(right[index]) : sameValue(item, right[index]),
    ));

/**
 * Internal: whether two instances belong to one line of types, where one is an instance of the
 * other's type: a type and its subtype, or a class and one that extends it. Siblings and
 * variants are not.
 */
export const inOneLine = (left: object, right: unknown): right is object =>
  typeof right === 'object' &&
  right !== null &&
  (right instanceof left.constructor ||
    (typeof right.constructor === 'function' && left instanceof right.constructor));
