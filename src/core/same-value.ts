import { isPlainRecord } from './frozen.ts';

const hasEquals = (value: unknown): value is { equals: (other: unknown) => boolean } =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'equals') === 'function';

/**
 * Whether two items are the same: by the left one's `equals` when it has one, by
 * `sameValue` otherwise.
 *
 * @internal
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
 * Whether two values are the same: `Object.is` for a single value, item by item for an
 * array and key by key for a plain object, with nominal items compared by their own `equals`.
 *
 * @internal
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
 * Whether two instances belong to one line of types, where one is an instance of the
 * other's type: a type and its subtype, or a class and one that extends it. Siblings and
 * variants are not.
 *
 * @internal
 */
export const inOneLine = (left: object, right: unknown): right is object =>
  typeof right === 'object' &&
  right !== null &&
  (right instanceof left.constructor ||
    (typeof right.constructor === 'function' && left instanceof right.constructor));

/**
 * A nominal instance as a key function reads it.
 *
 * @internal
 */
export interface Keyed {
  /**
   * The value the instance holds.
   */
  readonly value: unknown;
}

/**
 * How the instances of a type are told apart quickly: their `equals`, and a key that is
 * the same for any two instances `equals` finds the same; `noKey` where the value has none.
 *
 * @remarks
 * It sits on a prototype under a `Symbol.for` key, beside the `equals` it was written for, so a
 * class that overrides `equals` without a key of its own is compared item by item instead.
 *
 * @internal
 */
export interface EqualityKey {
  /**
   * The `equals` method the key was written for.
   */
  readonly equals: unknown;
  /**
   * The key of an instance, or `noKey` when its value has none.
   */
  readonly key: (item: Keyed) => unknown;
}

/**
 * Where a prototype keeps its `EqualityKey`.
 *
 * @internal
 */
export const equalityKeySlot: unique symbol = Symbol.for(
  '@horizon-republic/nominal-types/equality-key',
);

/**
 * What `EqualityKey.key` returns for a value it can't key, such as an object.
 *
 * @internal
 */
export const noKey: unique symbol = Symbol.for('@horizon-republic/nominal-types/no-key');
