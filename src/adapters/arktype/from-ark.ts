import { type } from 'arktype';
import type { Out, Type } from 'arktype';

import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { Parsed } from '../../core/contracts.ts';
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
 * @throws TypeError when `ark` is not an object type.
 *
 * @example
 * ```ts
 * const Stay = constrainArk(
 *   type({ guests: toArk(PositiveInteger), capacity: toArk(PositiveInteger) }),
 *   withinCapacity,
 * );
 * const CreateBooking = fromArk(type({ hotel: 'string', stays: Stay.array() }));
 * ```
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
 */
export type Built<Definition> = Definition extends (input: never) => Out<infer Output>
  ? Output
  : Definition extends object
    ? { [Key in keyof Definition]: Built<Definition[Key]> }
    : Definition;

/**
 * An ArkType schema whose `toArk()` fields come out as instances, with its constraints checked:
 * what `fromArk()` returns.
 */
export class ArkSchema<Input, Output> {
  public readonly '~standard': StandardProps<Input, Output>;
  public readonly ark: Type;
  readonly #run: (input: unknown) => Output | Rejection;

  /**
   * Internal: built by `fromArk()`.
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
   */
  public parse(input: unknown): Parsed<Output> {
    const result = this.#run(input);

    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
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
 * @throws TypeError when an `toArk()` node sits in a union whose branches can't be told apart at
 * runtime.
 *
 * @example
 * ```ts
 * const CreateBooking = fromArk(
 *   type({ email: toArk(Email), guests: toArk(PositiveInteger), capacity: toArk(PositiveInteger) }),
 *   withinCapacity,
 * );
 *
 * const result = CreateBooking.parse(body);
 * // { ok: true, value: { email: Email, guests: PositiveInteger, capacity: PositiveInteger } }
 * ```
 */
export const fromArk = <Ark extends Type>(
  ark: Ark,
  ...constraints: AnyConstraint[]
): ArkSchema<Ark['inferIn'], Built<Ark['t']>> =>
  new ArkSchema(constraints.length === 0 ? ark : constrainArk(ark, ...constraints));
