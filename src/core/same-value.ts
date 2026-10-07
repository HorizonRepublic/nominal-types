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
