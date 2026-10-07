/**
 * Internal: the mark an `objectOf()` schema carries, shared by every copy of this package.
 */
export const objectMark: symbol = Symbol.for('@horizon-republic/nominal-types/object-schema');

/**
 * Internal: the name of the method that returns a changed copy of an object instance.
 */
export const copyMethod = 'copyWith';

const reserved = new Set(['value', 'equals', 'toJSON', 'toString', 'constructor', copyMethod]);

/**
 * Internal: the field names of an `objectOf()` schema, or `undefined` for any other rule.
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
 * Internal: gives the instances of a type built on `objectOf()` a getter for each field and the
 * copy method.
 *
 * @throws TypeError for a field named like a member every instance has.
 */
export const defineObjectMembers = (prototype: object, keys: readonly string[]): void => {
  for (const key of keys) {
    if (reserved.has(key)) {
      throw new TypeError(
        `a type built on objectOf() cannot have a field named ${key}: every instance has a member of that name`,
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
