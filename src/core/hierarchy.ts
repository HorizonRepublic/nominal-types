import type { NominalSchema } from './contracts.ts';

/**
 * Where a class keeps the `Symbol.for` key its instances are branded with.
 *
 * @internal
 */
export const brandKeySlot: unique symbol = Symbol('brandKey');

/**
 * On a class made by `Nominal`, `subtype` or `variant`, the class whose rules come before
 * its own, or `undefined` for a root.
 *
 * @internal
 */
export const levelSlot: unique symbol = Symbol('levelBase');

/**
 * On a class declared with the `sensitive` option, whether its rejected values are left
 * out of messages; a class without its own inherits it from the class it extends.
 *
 * @internal
 */
export const sensitiveSlot: unique symbol = Symbol('sensitive');

/**
 * On a class declared with the `normalize` option, whether it follows the `normalize`
 * setting of `n.configure()`; a class without its own inherits it from the class it extends.
 *
 * @internal
 */
export const normalizeSlot: unique symbol = Symbol('normalize');

/**
 * On a variant, the brand keys of the level it was made from.
 *
 * @internal
 */
export const variantSourceSlot: unique symbol = Symbol('variantSource');

/**
 * On a class declared with the `implies` option, the brand keys its level adds besides
 * its own, which a variant of the level drops with it.
 *
 * @internal
 */
export const impliedSlot: unique symbol = Symbol('implied');

const impliedOf = (type: object): readonly symbol[] => {
  const implied: unknown = Object.hasOwn(type, impliedSlot) ? Reflect.get(type, impliedSlot) : [];

  return Array.isArray(implied) ? implied.filter((key) => typeof key === 'symbol') : [];
};

const isSchema = (value: unknown): value is NominalSchema =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  '~standard' in value;

/**
 * Whether a value is the root class or a class extending it.
 *
 * @internal
 */
export const isLevel = (root: object, value: unknown): value is object =>
  value === root ||
  (typeof value === 'function' && Object.prototype.isPrototypeOf.call(root, value));

/**
 * The rules a class validates with, from the root down: every level's own `rule`, starting over
 * where a variant replaced its source's level.
 *
 * @internal
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
 * The level a class belongs to: the class its level builds on, the brand keys the level adds, and
 * the brand keys it adds through `implies`.
 *
 * @internal
 */
export const levelOf = (
  root: object,
  target: object,
): {
  readonly base: object | undefined;
  readonly keys: readonly symbol[];
  readonly implied: readonly symbol[];
} => {
  const keys: symbol[] = [];
  const implied: symbol[] = [];
  let current: unknown = target;

  while (isLevel(root, current) && current !== root) {
    const key: unknown = Object.hasOwn(current, brandKeySlot)
      ? Reflect.get(current, brandKeySlot)
      : undefined;

    if (typeof key === 'symbol') {
      keys.push(key);
    }

    implied.push(...impliedOf(current));

    if (Object.hasOwn(current, levelSlot)) {
      const base: unknown = Reflect.get(current, levelSlot);

      return { base: isLevel(root, base) ? base : undefined, keys, implied };
    }

    current = Object.getPrototypeOf(current);
  }

  return { base: undefined, keys, implied };
};

/**
 * The brand keys the instances of a type carry: its own, those of the types above it and those it
 * implies, read from the prototype so a type from another copy of the package answers too.
 *
 * @internal
 */
export const brandsCarried = (prototype: object, prefix: string): readonly symbol[] => {
  const found = new Set<symbol>();
  let current: unknown = prototype;

  while (typeof current === 'object' && current !== null) {
    for (const key of Object.getOwnPropertySymbols(current)) {
      if (Symbol.keyFor(key)?.startsWith(prefix) === true) {
        found.add(key);
      }
    }

    current = Object.getPrototypeOf(current);
  }

  return [...found].filter((key) => Reflect.get(prototype, key) === true);
};

/**
 * Whether an instance belongs to a type up the chain of `target`, which makes it narrowable.
 *
 * @internal
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
 *
 * @internal
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
