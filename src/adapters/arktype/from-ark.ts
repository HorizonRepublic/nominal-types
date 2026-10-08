import { type } from 'arktype';
import type { Out, Type } from 'arktype';

import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { Parsed } from '../../core/contracts.ts';
import { settled } from '../../core/nominal-error.ts';
import { Rejection } from '../../core/rejection.ts';
import { standardProps } from '../../core/standard-props.ts';
import type { StandardProps } from '../../core/standard-schema.ts';
import type { StandardSchemaV1 } from '../../core/standard-spec.ts';
import { isObjectNode } from './json-node.ts';
import { describeArk } from './json.ts';
import { planOf } from './plan.ts';
import { constraintId, constraintsKey } from './registry.ts';

/**
 * Attaches constraints to an ArkType object, so `fromArk()` checks them on that object wherever
 * it sits: at the top, inside another object or in an array.
 *
 * @remarks
 * Each constraint runs after ArkType accepted the whole input and the instances are built, with
 * the issue's path starting at this object.
 *
 * @typeParam Ark - The ArkType object type the constraints check.
 * @param ark - The ArkType object type to check.
 * @param constraints - The constraints to run on the object, made with `n.constraint()`.
 * @returns The same ArkType type with the constraints attached.
 * @throws {@link TypeError} when `ark` is not an object type.
 *
 * @example
 * ```ts
 * import { n, PositiveInteger } from '@horizon-republic/nominal-types';
 * import { constrainArk, fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
 * import { type } from 'arktype';
 *
 * const withinCapacity = n.constraint(
 *   { guests: PositiveInteger, capacity: PositiveInteger },
 *   ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
 *   { path: 'guests' },
 * );
 *
 * const Stay = constrainArk(
 *   type({ guests: toArk(PositiveInteger), capacity: toArk(PositiveInteger) }),
 *   withinCapacity,
 * );
 * const CreateBooking = fromArk(type({ hotel: 'string', stays: Stay.array() }));
 * ```
 *
 * @see {@link fromArk}
 */
export const constrainArk = <Ark extends Type>(ark: Ark, ...constraints: AnyConstraint[]): Ark => {
  if (!isObjectNode(ark.json)) {
    throw new TypeError('constrainArk: constraints attach to an ArkType object type');
  }

  const known: unknown = Reflect.get(ark.meta, constraintsKey);
  const ids = [
    ...(typeof known === 'string' ? known.split(',') : []),
    ...constraints.map((constraint) => constraintId(constraint)),
  ];
  const meta = { ...ark.meta, [constraintsKey]: ids.join(',') };

  return ark.configure(meta);
};

const problemOf = (error: type.errors[number]): string => {
  const prefix = `${error.propString} `;

  return error.path.length > 0 && error.problem.startsWith(prefix)
    ? error.problem.slice(prefix.length)
    : error.problem;
};

// Array.from rather than map(): in ArkType 2.2.0, map() on the errors builds another ArkErrors.
const issuesOf = (errors: type.errors): StandardSchemaV1.Issue[] =>
  Array.from(errors, (error) =>
    error.path.length === 0
      ? { message: problemOf(error) }
      : { message: problemOf(error), path: [...error.path] },
  );

/**
 * What `fromArk()` gives for an ArkType definition: the output of each morph, with nominal
 * instances kept as their classes rather than spelled out property by property.
 *
 * @typeParam Definition - The output type ArkType infers for the schema.
 */
export type Built<Definition> = Definition extends (input: never) => Out<infer Output>
  ? Output
  : Definition extends object
    ? { [Key in keyof Definition]: Built<Definition[Key]> }
    : Definition;

/**
 * An ArkType schema whose `toArk()` fields come out as instances, with its constraints checked:
 * what `fromArk()` returns.
 *
 * @remarks
 * It is a Standard Schema, so libraries that take one, such as tRPC, accept it as it is.
 *
 * @typeParam Input - The input the ArkType schema accepts.
 * @typeParam Output - The value it gives, with instances in place of the `toArk()` fields.
 *
 * @see {@link fromArk}
 */
export class ArkSchema<Input, Output> {
  /**
   * The Standard Schema and Standard JSON Schema properties, read by libraries that take a
   * Standard Schema.
   */
  public readonly '~standard': StandardProps<Input, Output>;

  /**
   * The ArkType schema this one was built from, with its constraints attached.
   */
  public readonly ark: Type;
  readonly #run: (input: unknown) => Output | Rejection;

  /**
   * Built by `fromArk()`.
   *
   * @internal
   */
  public constructor(ark: Type) {
    const plan = planOf(ark.json);
    const build = plan?.build ?? ((value: unknown): unknown => value);
    const verify = plan?.verify;

    this.ark = ark;

    this.#run = (input) => {
      const accepted: unknown = ark(input);

      if (accepted instanceof type.errors) {
        return new Rejection(issuesOf(accepted));
      }

      const built = build(accepted);

      if (verify !== undefined) {
        const issues: StandardSchemaV1.Issue[] = [];

        verify(built, [], issues);

        if (issues.length > 0) {
          return new Rejection(issues);
        }
      }

      // The plan put an instance in place of every toArk() node, which is what Output describes.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return built as Output;
    };

    this['~standard'] = standardProps<Input, Output>(this.#run, (side, options) =>
      describeArk(ark, side, options),
    );
  }

  /**
   * Checks a value without throwing: the result with instances in place, or the issues.
   *
   * @param input - The value to check.
   * @returns `{ ok: true, value }` with instances in place, or `{ ok: false, issues }`.
   *
   * @example
   * ```ts
   * import { Email } from '@horizon-republic/nominal-types';
   * import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
   * import { type } from 'arktype';
   *
   * const Subscribe = fromArk(type({ email: toArk(Email) }));
   *
   * declare const body: unknown;
   *
   * const result = Subscribe.parse(body);
   *
   * if (result.ok) {
   *   result.value.email; // an Email instance
   * }
   * ```
   */
  public parse(input: unknown): Parsed<Output> {
    const result = this.#run(input);

    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
  }

  /**
   * The value, or a Promise rejected with a `NominalError`, for libraries that await a parser and
   * expect it to throw, such as tRPC; your own code reads the result of `parse()`.
   *
   * @param input - The value to check.
   * @returns A Promise of the value with instances in place, rejected with a
   * {@link NominalError} when the value is invalid.
   */
  public parseAsync(input: unknown): Promise<Output> {
    return settled(this.#run(input), 'fromArk()');
  }
}

/**
 * Turns an ArkType schema into one whose `toArk()` fields come out as instances, for a request
 * body, a message or a config checked by ArkType.
 *
 * @remarks
 * ArkType checks the input on its own fast path, then one pass builds the instances and runs the
 * constraints given here and those `constrainArk()` attached inside. The result is a Standard
 * Schema and a Standard JSON Schema, where each `toArk()` field is described by its type.
 *
 * @typeParam Ark - The ArkType schema to wrap.
 * @param ark - The ArkType schema, with `toArk()` nodes for its nominal fields.
 * @param constraints - Constraints to run on the top object, made with `n.constraint()`.
 * @returns A schema whose `parse()` gives instances for the `toArk()` fields.
 * @throws {@link TypeError} when a `toArk()` node sits in a union whose branches can't be told
 * apart at runtime.
 * @throws {@link TypeError} when constraints are given and `ark` is not an object type.
 *
 * @example
 * ```ts
 * import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
 * import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
 * import { type } from 'arktype';
 *
 * const withinCapacity = n.constraint(
 *   { guests: PositiveInteger, capacity: PositiveInteger },
 *   ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
 *   { path: 'guests' },
 * );
 *
 * declare const body: unknown;
 *
 * const CreateBooking = fromArk(
 *   type({ email: toArk(Email), guests: toArk(PositiveInteger), capacity: toArk(PositiveInteger) }),
 *   withinCapacity,
 * );
 *
 * const result = CreateBooking.parse(body);
 * // { ok: true, value: { email: Email, guests: PositiveInteger, capacity: PositiveInteger } }
 * ```
 *
 * @see {@link toArk}
 * @see {@link constrainArk}
 */
export const fromArk = <Ark extends Type>(
  ark: Ark,
  ...constraints: AnyConstraint[]
): ArkSchema<Ark['inferIn'], Built<Ark['t']>> =>
  new ArkSchema(constraints.length === 0 ? ark : constrainArk(ark, ...constraints));
