import type { AnyConstraint, ConstraintField } from './constraint-types.ts';
import { describeField } from './field-json.ts';
import { foreignRunner } from './foreign-runner.ts';
import { hideValues } from './hidden-values.ts';
import { isNominalType } from './nominal.ts';
import type { ObjectField, objectShape } from './object-shape.ts';
import type { ObjectFields } from './object-types.ts';
import { Rejection } from './rejection.ts';
import { schemaOf } from './schema-of.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';
import { textFormOf } from './text-form.ts';
import { instanceParserFor } from './type-functions.ts';

/**
 * Internal: the fields `partial()` made optional (`true`) and `required()` made required
 * (`false`).
 */
export type Presence = ReadonlyMap<string, boolean>;

/**
 * Internal: what an `n.object()` schema is built from.
 */
export interface ObjectParts {
  readonly source: ObjectFields;
  readonly constraints: readonly AnyConstraint[];
  readonly strict: boolean;
  readonly hidden: boolean;
  readonly presence: Presence;
}

/**
 * Internal: what each `n.object()` schema of this copy of the package was built from, so
 * `n.union()` can build its variants with the tag as a field.
 */
export const objectParts: WeakMap<object, ObjectParts> = new WeakMap();

/**
 * Internal: no field made optional or required.
 */
export const noPresence: Presence = new Map();

const runnerOf = (field: ConstraintField): ((value?: unknown) => unknown) =>
  isNominalType(field) ? instanceParserFor(field) : foreignRunner(field, 'n.object()');

/**
 * Internal: the fields of an `n.object()` schema as its shape runs them.
 *
 * @throws TypeError for a field named `__proto__`.
 */
export const fieldsOf = (fields: ObjectFields, presence: Presence): ObjectField[] =>
  Object.entries(fields).map(([key, field]) => {
    if (key === '__proto__') {
      throw new TypeError('n.object(): a field cannot be named __proto__');
    }

    const run = runnerOf(field);

    return {
      key,
      run,
      optional: presence.get(key) ?? !(run() instanceof Rejection),
      describe: (side, options) => describeField(field, side, options, 'object'),
    };
  });

type ObjectShape = ReturnType<typeof objectShape>;

/**
 * Internal: the shape of an object whose messages leave the values out.
 */
export const hidingValues = (shape: ObjectShape): ObjectShape => ({
  run: (input) => {
    const result = shape.run(input);

    return result instanceof Rejection ? new Rejection(hideValues(result.issues)) : result;
  },
  describe: shape.describe,
  sensitive: true,
});

/**
 * Internal: the fields with each nominal type that has a text form read from a string first.
 */
export const textFields = (fields: ObjectFields): ObjectFields =>
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      isNominalType(field) && textFormOf(field) !== undefined
        ? schemaOf(field).fromString()
        : field,
    ]),
  );

/**
 * Internal: the keys a method of an object schema names, checked against the fields the object
 * declares.
 *
 * @throws TypeError naming the method and the first key the object doesn't declare, or, when
 * `atLeastOne`, for no key at all.
 */
export const checkedKeys = (
  method: string,
  declared: readonly string[],
  keys: readonly unknown[],
  atLeastOne: boolean,
): ReadonlySet<string> => {
  if (atLeastOne && keys.length === 0) {
    throw new TypeError(`${method}(): name at least one field`);
  }

  for (const key of keys) {
    if (typeof key !== 'string' || !declared.includes(key)) {
      throw new TypeError(`${method}(): the object has no field named ${String(key)}`);
    }
  }

  return new Set(keys.map(String));
};

/**
 * Internal: the keys a constraint reads.
 */
export const constraintKeys = (rule: AnyConstraint): readonly string[] => {
  const listed: unknown = Reflect.get(rule, 'fields');

  return typeof listed === 'object' && listed !== null ? Object.keys(listed) : [];
};

const whenPresent = (rule: AnyConstraint, keys: readonly string[]): AnyConstraint => ({
  issuesOf: (value): readonly StandardSchemaV1.Issue[] =>
    keys.every((key) => Object.hasOwn(value, key)) ? rule.issuesOf(value) : [],
});

/**
 * Internal: the constraints as the object runs them: one that reads fields `partial()` made
 * optional runs only when every one of them is present.
 */
export const gatedConstraints = (
  constraints: readonly AnyConstraint[],
  presence: Presence,
): readonly AnyConstraint[] =>
  constraints.map((rule) => {
    const loose = constraintKeys(rule).filter((key) => presence.get(key) === true);

    return loose.length === 0 ? rule : whenPresent(rule, loose);
  });

/**
 * Internal: the presence of the fields `keys` only.
 */
export const keptPresence = (presence: Presence, keys: ReadonlySet<string>): Presence =>
  new Map([...presence].filter(([key]) => keys.has(key)));

/**
 * Internal: the presence with the fields `keys` made optional or required.
 */
export const withPresence = (
  presence: Presence,
  keys: ReadonlySet<string>,
  optional: boolean,
): Presence => new Map([...presence, ...[...keys].map((key) => [key, optional] as const)]);
