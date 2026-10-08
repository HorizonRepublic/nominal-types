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
 * The fields `partial()` made optional (`true`) and `required()` made required
 * (`false`).
 *
 * @internal
 */
export type Presence = ReadonlyMap<string, boolean>;

/**
 * What an `n.object()` schema is built from.
 *
 * @internal
 */
export interface ObjectParts {
  /**
   * The fields as declared, each key to its schema.
   */
  readonly source: ObjectFields;
  /**
   * The constraints across the fields.
   */
  readonly constraints: readonly AnyConstraint[];
  /**
   * Whether undeclared keys are refused rather than dropped.
   */
  readonly strict: boolean;
  /**
   * Whether the messages leave the values out.
   */
  readonly hidden: boolean;
  /**
   * The fields made optional or required by the methods of the schema.
   */
  readonly presence: Presence;
}

/**
 * What each `n.object()` schema of this copy of the package was built from, so
 * `n.union()` can build its variants with the tag as a field.
 *
 * @internal
 */
export const objectParts: WeakMap<object, ObjectParts> = new WeakMap();

/**
 * No field made optional or required.
 *
 * @internal
 */
export const noPresence: Presence = new Map();

const runnerOf = (field: ConstraintField): ((value?: unknown) => unknown) =>
  isNominalType(field) ? instanceParserFor(field) : foreignRunner(field, 'n.object()');

/**
 * The fields of an `n.object()` schema as its shape runs them.
 *
 * @throws {@link TypeError} when a field is named `__proto__`.
 *
 * @internal
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
      /**
       * The JSON Schema of the field.
       *
       * @throws {@link TypeError} when the field can't describe itself; the message names the type.
       *
       * @internal
       */
      describe: (side, options) => describeField(field, side, options, 'object'),
    };
  });

type ObjectShape = ReturnType<typeof objectShape>;

/**
 * The shape of an object whose messages leave the values out.
 *
 * @internal
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
 * The fields with each nominal type that has a text form read from a string first.
 *
 * @internal
 */
export const textFields = (fields: ObjectFields): ObjectFields =>
  // @throws-ignore only nominal types with a text form reach schemaOf() and fromString()
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      isNominalType(field) && textFormOf(field) !== undefined
        ? schemaOf(field).fromString()
        : field,
    ]),
  );

/**
 * The keys a method of an object schema names, checked against the fields the object
 * declares.
 *
 * @throws {@link TypeError} when a key is not a declared field, or no key is given while
 * `atLeastOne` is set.
 *
 * @internal
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
 * The keys a constraint reads.
 *
 * @internal
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
 * The constraints as the object runs them: one that reads fields `partial()` made
 * optional runs only when every one of them is present.
 *
 * @internal
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
 * The presence of the fields `keys` only.
 *
 * @internal
 */
export const keptPresence = (presence: Presence, keys: ReadonlySet<string>): Presence =>
  new Map([...presence].filter(([key]) => keys.has(key)));

/**
 * The presence with the fields `keys` made optional or required.
 *
 * @internal
 */
export const withPresence = (
  presence: Presence,
  keys: ReadonlySet<string>,
  optional: boolean,
): Presence => new Map([...presence, ...[...keys].map((key) => [key, optional] as const)]);
