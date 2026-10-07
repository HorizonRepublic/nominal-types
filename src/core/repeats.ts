import { describeValue } from './messages.ts';
import { equalityKeySlot, noKey, sameItem } from './same-value.ts';
import type { EqualityKey, Keyed } from './same-value.ts';

// Stands for `undefined` in the map, where `undefined` means a key not seen yet.
const missing = Symbol('missing');

const isEqualityKey = (value: unknown): value is EqualityKey =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'equals') === 'function' &&
  typeof Reflect.get(value, 'key') === 'function';

const keyFunctionOf = (item: object): ((item: Keyed) => unknown) | undefined => {
  const rule: unknown = Reflect.get(item, equalityKeySlot);

  return isEqualityKey(rule) && rule.equals === Reflect.get(item, 'equals') ? rule.key : undefined;
};

class Bucket {
  public readonly items: unknown[];

  public constructor(items: unknown[]) {
    this.items = items;
  }
}

const sameAsAny = (earlier: readonly unknown[], item: unknown): boolean => {
  for (const other of earlier) {
    if (sameItem(other, item)) {
      return true;
    }
  }

  return false;
};

const sameAsBefore = (items: readonly unknown[], index: number): boolean => {
  const item = items[index];

  for (let before = 0; before < index; before += 1) {
    if (sameItem(items[before], item)) {
      return true;
    }
  }

  return false;
};

// Items of one array mostly share a prototype, so its key function is looked up once.
const keyReader = (): ((item: unknown) => unknown) => {
  let prototype: unknown = missing;
  let keyFunction: ((item: Keyed) => unknown) | undefined;

  return (item) => {
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    const own: unknown = Object.getPrototypeOf(item);

    if (own !== prototype) {
      prototype = own;
      keyFunction = keyFunctionOf(item);
    }

    // A key function is found only on a nominal instance, which has a value.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return keyFunction === undefined ? noKey : keyFunction(item as Keyed);
  };
};

/**
 * Whether an item with a key repeats an earlier one; if not, it is remembered under its key.
 */
const repeatsKeyed = (
  byKey: Map<unknown, unknown>,
  unkeyed: readonly unknown[],
  key: unknown,
  item: unknown,
): boolean => {
  const stored = item === undefined ? missing : item;
  const earlier = byKey.get(key);
  const repeated =
    (earlier !== undefined &&
      (earlier instanceof Bucket ? sameAsAny(earlier.items, stored) : sameItem(earlier, stored))) ||
    (unkeyed.length > 0 && sameAsAny(unkeyed, item));

  if (repeated) {
    return true;
  }

  if (earlier === undefined) {
    byKey.set(key, stored);
  } else if (earlier instanceof Bucket) {
    earlier.items.push(stored);
  } else {
    byKey.set(key, new Bucket([earlier, stored]));
  }

  return false;
};

/**
 * Internal: the indexes of the items that repeat an earlier one, compared as `equals()` compares
 * them, or `undefined` when every item is new.
 *
 * @remarks
 * Items with a key are looked up by it, so a list of them takes linear time; the rest, such as
 * plain objects, are compared with every item before them.
 */
export const repeatsIn = (items: readonly unknown[]): number[] | undefined => {
  const byKey = new Map<unknown, unknown>();
  const unkeyed: unknown[] = [];
  const keyOf = keyReader();
  let repeats: number[] | undefined;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const key = keyOf(item);
    let repeated: boolean;

    if (key === noKey) {
      repeated = sameAsBefore(items, index);
      unkeyed.push(item);
    } else {
      repeated = repeatsKeyed(byKey, unkeyed, key, item);
    }

    if (repeated) {
      repeats ??= [];
      repeats.push(index);
    }
  }

  return repeats;
};

/**
 * Internal: the message for an item that repeats an earlier one, naming a nominal instance by its
 * value.
 */
export const repeatMessage = (item: unknown): string => {
  const shown: unknown =
    typeof item === 'object' && item !== null && Reflect.get(item, equalityKeySlot) !== undefined
      ? Reflect.get(item, 'value')
      : item;

  return `must not repeat an item (was ${describeValue(shown)})`;
};
