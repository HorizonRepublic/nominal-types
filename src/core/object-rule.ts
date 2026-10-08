/**
 * The mark an `n.object()` schema carries, shared by every copy of this package.
 *
 * @internal
 */
export const objectMark: symbol = Symbol.for('@horizon-republic/nominal-types/object-schema');

/**
 * Where an `n.object()` schema keeps what a type built on it needs: the members of its
 * instances and the check of a constraint added below it.
 *
 * @remarks
 * The schema carries them rather than the root class, so a bundle that declares no type on
 * `n.object()` leaves them out, and a schema from another copy of the package brings its own.
 *
 * @internal
 */
export const objectMembersSlot: symbol = Symbol.for(
  '@horizon-republic/nominal-types/object-members',
);

/**
 * What an `n.object()` schema keeps under `objectMembersSlot`.
 *
 * @internal
 */
export interface ObjectMembers {
  /**
   * Adds a getter for each field and `copyWith()` to the prototype of a type's instances.
   */
  readonly define: (prototype: object, keys: readonly string[]) => void;
  /**
   * Throws when a constraint given to `subtype()` or `variant()` reads a field the object
   * doesn't declare.
   */
  readonly check: (owner: 'subtype' | 'variant', keys: readonly string[], rule: unknown) => void;
}

/**
 * The field names of an `n.object()` schema, or `undefined` for any other rule.
 *
 * @internal
 */
export const objectKeysOf = (rule: unknown): readonly string[] | undefined => {
  if (typeof rule !== 'object' || rule === null || Reflect.get(rule, objectMark) !== true) {
    return undefined;
  }

  const keys: unknown = Reflect.get(rule, 'keys');

  return Array.isArray(keys) ? keys.map(String) : undefined;
};

const isObjectMembers = (value: unknown): value is ObjectMembers =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'define') === 'function' &&
  typeof Reflect.get(value, 'check') === 'function';

/**
 * The members an `n.object()` schema gives the types built on it.
 *
 * @internal
 */
export const objectMembersOf = (rule: unknown): ObjectMembers | undefined => {
  const members: unknown =
    typeof rule === 'object' && rule !== null ? Reflect.get(rule, objectMembersSlot) : undefined;

  return isObjectMembers(members) ? members : undefined;
};

/**
 * The closest `n.object()` rule a type builds on, from its own level up.
 *
 * @internal
 */
export const objectRuleAbove = (target: object): unknown => {
  for (
    let current: unknown = target;
    typeof current === 'function' && current !== Function.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    const rule: unknown = Object.hasOwn(current, 'rule') ? Reflect.get(current, 'rule') : undefined;

    if (objectKeysOf(rule) !== undefined) {
      return rule;
    }
  }

  return undefined;
};
