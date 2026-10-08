import { checkConstraintFields, isConstraint } from './constraint-fields.ts';
import { issueOf } from './messages.ts';
import { NominalError } from './nominal-error.ts';
import type { ObjectMembers } from './object-rule.ts';

/**
 * Internal: the name of the method that returns a changed copy of an object instance.
 */
export const copyMethod = 'copyWith';

const reserved = new Set(['value', 'equals', 'toJSON', 'toString', 'constructor', copyMethod]);

const copyOf = (declared: ReadonlySet<string>) =>
  function copyWith(this: { readonly value: object }, changes: object): unknown {
    const Target: unknown = this.constructor;
    const unknown = Object.keys(changes).filter((key) => !declared.has(key));

    if (unknown.length > 0) {
      throw new NominalError(
        String(Reflect.get(Target ?? {}, 'typeName')),
        unknown.map((key) => issueOf('not_allowed', 'is not allowed', { path: [key] })),
      );
    }

    return typeof Target === 'function'
      ? Reflect.construct(Target, [{ ...this.value, ...changes }])
      : undefined;
  };

// A getter for each field and the copy method; a field named like a member every instance has
// throws a TypeError.
const defineObjectMembers = (prototype: object, keys: readonly string[]): void => {
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
    value: copyOf(new Set(keys)),
    writable: true,
    configurable: true,
  });
};

/**
 * Internal: what a type built on `n.object()` gets from the schema: a getter for each field and
 * the copy method on its instances, and a `TypeError` for a constraint given to `subtype()` or
 * `variant()` that reads a field the object doesn't declare.
 */
export const objectMembers: ObjectMembers = {
  define: defineObjectMembers,
  check: (owner, keys, rule) => {
    if (isConstraint(rule)) {
      checkConstraintFields(owner, keys, [rule]);
    }
  },
};
