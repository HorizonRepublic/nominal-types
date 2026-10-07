import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyNominalType, InputOf } from './contracts.ts';
import { foreignRunner } from './foreign-runner.ts';
import { forTarget } from './json-target.ts';
import { mustBe } from './messages.ts';
import { Rejection } from './rejection.ts';
import { standardProps } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import type { NominalTarget, TargetValue } from './target.ts';
import type { TypeSchema } from './type-schema.ts';

/**
 * What a field of a constraint is checked against: a nominal type, a `schemaOf()` schema or any
 * synchronous Standard Schema, for fields that are no nominal type.
 */
export type ConstraintField = NominalTarget | StandardSchemaV1;

/**
 * The value a constraint's check receives for a field: an instance, what a `schemaOf()` schema
 * gives, or the output of another schema.
 */
export type ConstraintValue<Field extends ConstraintField> = Field extends NominalTarget
  ? TargetValue<Field>
  : Field extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Field>
    : never;

/**
 * The values a constraint's check receives, one for each field it lists.
 */
export type ConstraintValues<Fields extends Readonly<Record<string, ConstraintField>>> = {
  readonly [Key in keyof Fields]: ConstraintValue<Fields[Key]>;
};

/**
 * What a constraint accepts for a field: what its type or schema takes as input.
 */
export type ConstraintInput<Field extends ConstraintField> =
  Field extends TypeSchema<infer Input, unknown>
    ? Input
    : Field extends AnyNominalType
      ? InputOf<Field['rule']> | Field['prototype']
      : Field extends StandardSchemaV1
        ? StandardSchemaV1.InferInput<Field>
        : never;

/**
 * What a constraint accepts: an object with an input for each field it lists.
 */
export type ConstraintInputs<Fields extends Readonly<Record<string, ConstraintField>>> = {
  readonly [Key in keyof Fields]: ConstraintInput<Fields[Key]>;
};

/**
 * What a constraint's check answers: `true` when the fields agree, `false` for the default message,
 * or the message itself.
 */
export type ConstraintVerdict = boolean | string;

/**
 * Options of `constraint()`.
 */
export interface ConstraintOptions<Key extends string> {
  /**
   * The field the issue belongs to, or a path to it; without one, the issue belongs to the object.
   */
  readonly path?: Key | readonly PropertyKey[];
  /**
   * The message when the check answers `false`.
   */
  readonly message?: string;
}

const constraintMark = Symbol.for('@horizon-republic/nominal-types/constraint');

interface FieldRunner {
  readonly key: string;
  readonly field: ConstraintField;
  readonly run: (value?: unknown) => unknown;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const prefixed = (
  key: string,
  issues: readonly StandardSchemaV1.Issue[],
): StandardSchemaV1.Issue[] =>
  issues.map((issue) => ({ message: issue.message, path: [key, ...(issue.path ?? [])] }));

const defaultMessage = (keys: readonly string[], path: readonly PropertyKey[]): string => {
  const others = keys.filter((key) => key !== path[0]);

  return path.length === 0
    ? `${keys.join(', ')} must agree`
    : `must agree with ${others.join(', ')}`;
};

const cannotDescribe = (): TypeError =>
  new TypeError('a field of the constraint cannot describe itself as JSON Schema');

const describeField = (
  field: ConstraintField,
  side: 'input' | 'output',
  target: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const converter: unknown = Reflect.get(field['~standard'], 'jsonSchema');
  const describe: unknown =
    typeof converter === 'object' && converter !== null ? Reflect.get(converter, side) : undefined;
  const schema: unknown =
    typeof describe === 'function' ? Reflect.apply(describe, converter, [target]) : undefined;

  if (!isRecord(schema)) {
    throw cannotDescribe();
  }

  return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema'));
};

/**
 * A rule across the fields of an object, such as an end that must come after a start: what
 * `constraint()` returns.
 *
 * @remarks
 * It is a Standard Schema over the object: it checks every field it lists against that field's
 * type, then runs the check on the values, and gives back a copy of the object with those values
 * in place. Keys it doesn't list pass through unchecked. Adapters run the check alone, on fields
 * their validator has checked already.
 */
export class Constraint<Fields extends Readonly<Record<string, ConstraintField>>> {
  public readonly '~standard': StandardProps<ConstraintInputs<Fields>, ConstraintValues<Fields>>;
  public readonly fields: Fields;
  readonly #check: (values: ConstraintValues<Fields>) => ConstraintVerdict;
  readonly #path: readonly PropertyKey[];
  readonly #message: string;
  readonly #runners: readonly FieldRunner[];

  /**
   * Internal: built by `constraint()`.
   */
  public constructor(
    fields: Fields,
    check: (values: ConstraintValues<Fields>) => ConstraintVerdict,
    options: ConstraintOptions<string>,
  ) {
    const listed: Readonly<Record<string, ConstraintField>> = fields;
    const keys = Object.keys(listed);

    this.fields = fields;
    this.#check = check;
    this.#path = typeof options.path === 'string' ? [options.path] : (options.path ?? []);
    this.#message = options.message ?? defaultMessage(keys, this.#path);
    this.#runners = Object.entries(listed).map(([key, field]) => ({
      key,
      field,
      run: foreignRunner(field, 'constraint'),
    }));
    this['~standard'] = standardProps<ConstraintInputs<Fields>, ConstraintValues<Fields>>(
      (input) => this.#run(input),
      (side, target) => forTarget(target, this.#describe(side, target)),
    );
    Object.defineProperty(this, constraintMark, { value: true });
  }

  /**
   * Internal: the issue for values already checked against their fields, or `undefined` when they
   * agree.
   */
  public issueFor(values: ConstraintValues<Fields>): StandardSchemaV1.Issue | undefined {
    const verdict = this.#check(values);

    if (verdict === true) {
      return undefined;
    }

    const message = verdict === false ? this.#message : verdict;

    return this.#path.length === 0 ? { message } : { message, path: this.#path };
  }

  /**
   * Internal: an object with each listed field checked against its type, or a `Rejection` with
   * the issues of the fields that failed, each under its key.
   */
  public valuesOf(input: Readonly<Record<string, unknown>>): ConstraintValues<Fields> | Rejection {
    const values: Record<string, unknown> = { ...input };
    let issues: StandardSchemaV1.Issue[] | undefined;

    for (const { key, run } of this.#runners) {
      const value = run(input[key]);

      if (value instanceof Rejection) {
        issues ??= [];
        issues.push(...prefixed(key, value.issues));
      } else {
        values[key] = value;
      }
    }

    // Every listed key now holds a value its field accepted, which is what the type describes.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return issues === undefined ? (values as ConstraintValues<Fields>) : new Rejection(issues);
  }

  #run(input: unknown): ConstraintValues<Fields> | Rejection {
    if (!isRecord(input)) {
      return new Rejection([{ message: mustBe('an object', input) }]);
    }

    const values = this.valuesOf(input);

    if (values instanceof Rejection) {
      return values;
    }

    const issue = this.issueFor(values);

    return issue === undefined ? values : new Rejection([issue]);
  }

  #describe(
    side: 'input' | 'output',
    target: StandardJSONSchemaV1.Options,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const { key, field, run } of this.#runners) {
      properties[key] = describeField(field, side, target);

      if (run() instanceof Rejection) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
}

/**
 * Whether a value is a constraint, also one built by another copy of this package.
 */
export const isConstraint = (
  value: unknown,
): value is Constraint<Readonly<Record<string, ConstraintField>>> =>
  typeof value === 'object' && value !== null && Reflect.get(value, constraintMark) === true;

/**
 * Builds a rule across fields of an object, like a `CHECK` constraint over several columns in SQL:
 * a stay whose check-out must come after its check-in, a guest count within a room's capacity.
 *
 * @remarks
 * List the fields the rule reads, each with its type. The check receives their values already
 * checked, instances for nominal types, and runs only when every listed field is valid, so a field
 * that failed on its own reports its own issue and nothing more. Return `true` when the fields
 * agree, `false` for the message in the options, or a message.
 *
 * The result is a Standard Schema over the object, so a nominal type takes it as its rule.
 *
 * @example
 * ```ts
 * const withinCapacity = constraint(
 *   { guests: PositiveInteger, capacity: PositiveInteger },
 *   ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
 *   { path: 'guests' },
 * );
 *
 * class Occupancy extends Nominal('Occupancy', withinCapacity) {}
 *
 * new Occupancy({ guests: 3, capacity: 2 });
 * // NominalError: Occupancy: guests: must not exceed the capacity
 * ```
 */
export const constraint = <const Fields extends Readonly<Record<string, ConstraintField>>>(
  fields: Fields,
  check: (values: ConstraintValues<Fields>) => ConstraintVerdict,
  options: ConstraintOptions<Extract<keyof Fields, string>> = {},
): Constraint<Fields> => new Constraint(fields, check, options);
