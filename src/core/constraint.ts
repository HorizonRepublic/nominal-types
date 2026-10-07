import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import { constraintMark } from './constraint-fields.ts';
import type {
  ConstraintField,
  ConstraintValues,
  ConstraintInputs,
  ConstraintVerdict,
  ConstraintOptions,
} from './constraint-types.ts';
import { describeField } from './field-json.ts';
import { foreignRunner } from './foreign-runner.ts';
import { forTarget } from './json-target.ts';
import { mustBe } from './messages.ts';
import { isNominalType } from './nominal.ts';
import { Rejection } from './rejection.ts';
import { standardProps } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import { constructorFor } from './type-functions.ts';

interface FieldRunner {
  readonly key: string;
  readonly field: ConstraintField;
  readonly run: (value?: unknown) => unknown;
}

const runnerOf = (field: ConstraintField): ((value?: unknown) => unknown) =>
  isNominalType(field) ? constructorFor(field) : foreignRunner(field, 'constraint');

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
      run: runnerOf(field),
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
   * the issues of the fields that failed, each under its key; the input itself when every field
   * already holds its value, such as an instance.
   */
  public valuesOf(input: Readonly<Record<string, unknown>>): ConstraintValues<Fields> | Rejection {
    let values: Record<string, unknown> | undefined;
    let issues: StandardSchemaV1.Issue[] | undefined;

    for (const { key, run } of this.#runners) {
      const item = input[key];
      const value = run(item);

      if (value instanceof Rejection) {
        issues ??= [];
        issues.push(...prefixed(key, value.issues));
      } else if (value !== item) {
        values ??= { ...input };
        values[key] = value;
      }
    }

    if (issues !== undefined) {
      return new Rejection(issues);
    }

    // Every listed key now holds a value its field accepted, which is what the type describes.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return (values ?? input) as ConstraintValues<Fields>;
  }

  /**
   * Internal: the issues of an object whose fields an adapter's validator has accepted: those of
   * listed fields that still fail their types, or the constraint's own, or none.
   */
  public issuesOf(input: Readonly<Record<string, unknown>>): readonly StandardSchemaV1.Issue[] {
    const values = this.valuesOf(input);

    if (values instanceof Rejection) {
      return values.issues;
    }

    const issue = this.issueFor(values);

    return issue === undefined ? [] : [issue];
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
      properties[key] = describeField(field, side, target, 'constraint');

      if (run() instanceof Rejection) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
}

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
 * The result is a Standard Schema over the object. Give it to `objectOf()`, or to an adapter's
 * `constrain…()`.
 *
 * @example
 * ```ts
 * const withinCapacity = constraint(
 *   { guests: PositiveInteger, capacity: PositiveInteger },
 *   ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
 *   { path: 'guests' },
 * );
 *
 * class Occupancy extends Nominal(
 *   'booking.Occupancy',
 *   objectOf({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity),
 * ) {}
 *
 * new Occupancy({ guests: 3, capacity: 2 });
 * // NominalError: booking.Occupancy: guests: must not exceed the capacity
 * ```
 */
export const constraint = <const Fields extends Readonly<Record<string, ConstraintField>>>(
  fields: Fields,
  check: (values: ConstraintValues<Fields>) => ConstraintVerdict,
  options: ConstraintOptions<Extract<keyof Fields, string>> = {},
): Constraint<Fields> => new Constraint(fields, check, options);

export { isConstraint } from './constraint-fields.ts';
