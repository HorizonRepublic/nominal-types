import { checkConstraintFields, isConstraint } from './constraint-fields.ts';

/**
 * Internal: the mark an `n.object()` schema carries, shared by every copy of this package.
 */
export const objectMark: symbol = Symbol.for('@horizon-republic/nominal-types/object-schema');

/**
 * Internal: the name of the method that returns a changed copy of an object instance.
 */
export const copyMethod = 'copyWith';

const reserved = new Set(['value', 'equals', 'toJSON', 'toString', 'constructor', copyMethod]);

/**
 * Internal: the field names of an `n.object()` schema, or `undefined` for any other rule.
 */
export const objectKeysOf = (rule: unknown): readonly string[] | undefined => {
  if (typeof rule !== 'object' || rule === null || Reflect.get(rule, objectMark) !== true) {
    return undefined;
  }

  const keys: unknown = Reflect.get(rule, 'keys');

  return Array.isArray(keys) ? keys.map(String) : undefined;
};

const copyWith = function copyWith(this: { readonly value: object }, changes: object): unknown {
  const Target: unknown = this.constructor;

  return typeof Target === 'function'
    ? Reflect.construct(Target, [{ ...this.value, ...changes }])
    : undefined;
};

/**
 * Internal: gives the instances of a type built on `n.object()` a getter for each field and the
 * copy method.
 *
 * @throws TypeError for a field named like a member every instance has.
 */
export const defineObjectMembers = (prototype: object, keys: readonly string[]): void => {
  for (const key of keys) {
    if (reserved.has(key)) {
      throw new TypeError(
        `a type built on n.object() cannot have a field named ${key}: every instance has a member of that name`,
      );
    }
  }

  for (const key of keys) {
    Object.defineProperty(prototype, key, {
      get(this: { readonly value: Readonly<Record<string, unknown>> }): unknown {
        return this.value[key];
      },
      configurable: true,
    });
  }

  Object.defineProperty(prototype, copyMethod, {
    value: copyWith,
    writable: true,
    configurable: true,
  });
};

// The fields of the object a type holds, from the closest level built on `n.object()`.
const objectKeysAbove = (target: object): readonly string[] | undefined => {
  for (
    let current: unknown = target;
    typeof current === 'function' && current !== Function.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    const keys = Object.hasOwn(current, 'rule')
      ? objectKeysOf(Reflect.get(current, 'rule'))
      : undefined;

    if (keys !== undefined) {
      return keys;
    }
  }

  return undefined;
};

/**
 * Internal: throws when a constraint given to `subtype()` or `variant()` of a type built on
 * `n.object()` reads a field the object doesn't declare.
 */
export const checkObjectRule = (
  owner: 'subtype' | 'variant',
  target: object,
  rule: unknown,
): void => {
  const keys = objectKeysAbove(target);

  if (keys !== undefined && isConstraint(rule)) {
    checkConstraintFields(owner, keys, [rule]);
  }
};
