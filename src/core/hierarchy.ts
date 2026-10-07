import type { NominalSchema } from './contracts.ts';

/**
 * Internal: where a class keeps the `Symbol.for` key its instances are branded with.
 */
export const brandKeySlot: unique symbol = Symbol('brandKey');

/**
 * Internal: on a class made by `Nominal`, `subtype` or `variant`, the class whose rules come before
 * its own, or `undefined` for a root.
 */
export const levelSlot: unique symbol = Symbol('levelBase');

/**
 * Internal: on a class declared with the `sensitive` option, whether its rejected values are left
 * out of messages; a class without its own inherits it from the class it extends.
 */
export const sensitiveSlot: unique symbol = Symbol('sensitive');

/**
 * Internal: on a variant, the brand keys of the level it was made from.
 */
export const variantSourceSlot: unique symbol = Symbol('variantSource');

const isSchema = (value: unknown): value is NominalSchema =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  '~standard' in value;

/**
 * Whether a value is the root class or a class extending it.
 */
export const isLevel = (root: object, value: unknown): value is object =>
  value === root ||
  (typeof value === 'function' && Object.prototype.isPrototypeOf.call(root, value));

/**
 * The rules a class validates with, from the root down: every level's own `rule`, starting over
 * where a variant replaced its source's level.
 */
export const rulesOf = (root: object, target: object): readonly NominalSchema[] => {
  if (target === root) {
    return [];
  }

  const base: unknown = Object.hasOwn(target, levelSlot)
    ? Reflect.get(target, levelSlot)
    : Object.getPrototypeOf(target);
  const inherited = isLevel(root, base) ? rulesOf(root, base) : [];
  const own: unknown = Object.hasOwn(target, 'rule') ? Reflect.get(target, 'rule') : undefined;

  return isSchema(own) ? [...inherited, own] : inherited;
};

/**
 * The level a class belongs to: the class its level builds on, and the brand keys the level adds.
 */
export const levelOf = (
  root: object,
  target: object,
): { readonly base: object | undefined; readonly keys: readonly symbol[] } => {
  const keys: symbol[] = [];
  let current: unknown = target;

  while (isLevel(root, current) && current !== root) {
    const key: unknown = Object.hasOwn(current, brandKeySlot)
      ? Reflect.get(current, brandKeySlot)
      : undefined;

    if (typeof key === 'symbol') {
      keys.push(key);
    }

    if (Object.hasOwn(current, levelSlot)) {
      const base: unknown = Reflect.get(current, levelSlot);

      return { base: isLevel(root, base) ? base : undefined, keys };
    }

    current = Object.getPrototypeOf(current);
  }

  return { base: undefined, keys };
};

/**
 * Whether an instance belongs to a type up the chain of `target`, which makes it narrowable.
 */
export const descendsFrom = (root: object, target: object, instance: object): boolean => {
  let ancestor: unknown = Object.getPrototypeOf(target);

  while (typeof ancestor === 'function' && ancestor !== root) {
    if (instance instanceof ancestor) {
      return true;
    }

    ancestor = Object.getPrototypeOf(ancestor);
  }

  return false;
};

const ownKeyOf = (root: object, target: unknown): symbol | undefined => {
  const key: unknown = isLevel(root, target) ? Reflect.get(target, brandKeySlot) : undefined;

  return typeof key === 'symbol' ? key : undefined;
};

const variantSourcesOf = (root: object, target: unknown): readonly unknown[] => {
  const keys: unknown = isLevel(root, target) ? Reflect.get(target, variantSourceSlot) : undefined;

  return Array.isArray(keys) ? keys : [];
};

/**
 * Whether `target` and the instance's type are a variant and the type it was made from, in either
 * direction, which makes the instance convertible by its value.
 */
export const isVariantPair = (root: object, target: object, instance: object): boolean => {
  const own = ownKeyOf(root, target);
  const other: unknown = instance.constructor;

  return (
    variantSourcesOf(root, target).some(
      (key) => typeof key === 'symbol' && Reflect.get(instance, key) === true,
    ) ||
    (own !== undefined && variantSourcesOf(root, other).includes(own))
  );
};
