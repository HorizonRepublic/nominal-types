import { isPlainRecord } from './frozen.ts';

const hasEquals = (value: unknown): value is { equals: (other: unknown) => boolean } =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'equals') === 'function';

/**
 * Internal: whether two items are the same: by the left one's `equals` when it has one, by
 * `sameValue` otherwise.
 */
export const sameItem = (left: unknown, right: unknown): boolean =>
  hasEquals(left) ? left.equals(right) : sameValue(left, right);

const sameRecord = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean => {
  const keys = Object.keys(left);

  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameItem(left[key], right[key]))
  );
};

/**
 * Internal: whether two values are the same: `Object.is` for a single value, item by item for an
 * array and key by key for a plain object, with nominal items compared by their own `equals`.
 */
export const sameValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left)) {
    return (
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item: unknown, index) => sameItem(item, right[index]))
    );
  }

  return isPlainRecord(left) && isPlainRecord(right) && sameRecord(left, right);
};

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

/**
 * Internal: a nominal instance as a key function reads it.
 */
export interface Keyed {
  readonly value: unknown;
}

/**
 * Internal: how the instances of a type are told apart quickly: their `equals`, and a key that is
 * the same for any two instances `equals` finds the same; `noKey` where the value has none.
 *
 * @remarks
 * It sits on a prototype under a `Symbol.for` key, beside the `equals` it was written for, so a
 * class that overrides `equals` without a key of its own is compared item by item instead.
 */
export interface EqualityKey {
  readonly equals: unknown;
  readonly key: (item: Keyed) => unknown;
}

/**
 * Internal: where a prototype keeps its `EqualityKey`.
 */
export const equalityKeySlot: unique symbol = Symbol.for(
  '@horizon-republic/nominal-types/equality-key',
);

/**
 * Internal: what `EqualityKey.key` returns for a value it can't key, such as an object.
 */
export const noKey: unique symbol = Symbol.for('@horizon-republic/nominal-types/no-key');
