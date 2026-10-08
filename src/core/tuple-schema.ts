import { emitTuple } from './collection-emitters.ts';
import type { ConstraintField, ConstraintInput, ConstraintValue } from './constraint-types.ts';
import { planOf } from './fast-paths.ts';
import { describeField } from './field-json.ts';
import { describeValue } from './messages.ts';
import { isNominalType } from './nominal.ts';
import { fieldRunner } from './object-helpers.ts';
import { writerOf } from './plain-writers.ts';
import { plainValue } from './plain.ts';
import { addEmitter } from './plan-emitters.ts';
import { Rejection } from './rejection.ts';
import { fieldAcceptor } from './shape-acceptors.ts';
import type { StandardJSONSchemaV1 } from './standard-spec.ts';
import { tupleAcceptor, tupleRun, tupleWriter } from './tuple-shape.ts';
import type { TupleRules } from './tuple-shape.ts';
import { TypeSchema } from './type-schema.ts';

type Side = 'input' | 'output';

type Of<Field extends ConstraintField, At extends Side> = At extends 'input'
  ? ConstraintInput<Field>
  : ConstraintValue<Field>;

type Required<Items extends readonly ConstraintField[], At extends Side> = {
  [Index in keyof Items]: Of<Items[Index], At>;
};

// From the end, each item whose schema accepts `undefined` may be left out, up to the last item
// that may not.
type Positions<Items extends readonly ConstraintField[], At extends Side> = Items extends readonly [
  ...infer Init extends readonly ConstraintField[],
  infer Last extends ConstraintField,
]
  ? undefined extends ConstraintInput<Last>
    ? [...Positions<Init, At>, Of<Last, At>?]
    : [...Required<Init, At>, Of<Last, At>]
  : [];

/**
 * What `n.tuple()` gives or accepts: the value of each position in order, then those of the rest.
 * Trailing positions whose schema accepts `undefined` may be left out.
 *
 * @typeParam Items - The type or schema of each position.
 * @typeParam Rest - The type or schema of the items past them, or `undefined` when there are none.
 * @typeParam At - `'output'` for what the schema gives, `'input'` for what it accepts.
 */
export type TupleValue<
  Items extends readonly ConstraintField[],
  Rest extends ConstraintField | undefined,
  At extends Side = 'output',
> = Rest extends ConstraintField
  ? readonly [...Positions<Items, At>, ...Array<Of<Rest, At>>]
  : Readonly<Positions<Items, At>>;

const isField = (value: unknown): value is ConstraintField =>
  isNominalType(value) ||
  (typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, '~standard') === 'object');

/**
 * An item or the rest of a tuple, checked to be a nominal type or a schema.
 *
 * @throws {@link TypeError} when it is neither.
 *
 * @internal
 */
const checkedField = (role: string, field: unknown): ConstraintField => {
  if (!isField(field)) {
    throw new TypeError(
      `n.tuple(): ${role} must be a nominal type or a schema (was ${describeValue(field)})`,
    );
  }

  return field;
};

/**
 * The items of a tuple, checked.
 *
 * @throws {@link TypeError} when they are not an array, or one is not a nominal type or a schema.
 *
 * @internal
 */
const checkedItems = (items: unknown): readonly ConstraintField[] => {
  if (!Array.isArray(items)) {
    throw new TypeError(`n.tuple(): list the items in an array (was ${describeValue(items)})`);
  }

  const list: readonly unknown[] = items;

  return list.map((item, index) => checkedField(`the item ${index}`, item));
};

/**
 * The JSON Schema of a tuple for the target: `prefixItems` in draft 2020-12, an `items` list in
 * draft-07, and, since OpenAPI 3.0 has no tuples, any of the item schemas at each position.
 *
 * @throws {@link TypeError} when an item can't describe itself.
 *
 * @internal
 */
const describeTuple = (
  items: readonly ConstraintField[],
  rest: ConstraintField | undefined,
  min: number,
  side: Side,
  target: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const positions = items.map((item) => describeField(item, side, target, 'tuple'));
  const tail = rest === undefined ? undefined : describeField(rest, side, target, 'tuple');
  const counts = {
    ...(min > 0 ? { minItems: min } : {}),
    ...(rest === undefined ? { maxItems: items.length } : {}),
  };

  if (target.target === 'openapi-3.0') {
    const every = tail === undefined ? positions : [...positions, tail];
    const distinct = [...new Map(every.map((schema) => [JSON.stringify(schema), schema])).values()];

    return {
      type: 'array',
      items: distinct.length === 1 ? distinct[0] : distinct.length === 0 ? {} : { anyOf: distinct },
      ...counts,
    };
  }

  if (positions.length === 0) {
    return { type: 'array', ...(tail === undefined ? {} : { items: tail }), ...counts };
  }

  return target.target === 'draft-07'
    ? { type: 'array', items: positions, additionalItems: tail ?? false, ...counts }
    : { type: 'array', prefixItems: positions, items: tail ?? false, ...counts };
};

/**
 * An array with a fixed number of items, each position checked by its own schema: what
 * `n.tuple()` returns.
 *
 * @remarks
 * It is a `TypeSchema`, so `array()`, `optional()` and `nullable()` build on it, and a nominal type
 * takes it as its rule.
 *
 * @typeParam Input - What the schema accepts.
 * @typeParam Output - What the schema gives back.
 *
 * @example
 * ```ts
 * import { Latitude, Longitude, n } from '@horizon-republic/nominal-types';
 *
 * const Point = n.tuple([Latitude, Longitude]);
 *
 * Point.parse([50.45, 30.52]).ok; // true
 * ```
 */
export class TupleSchema<Input, Output> extends TypeSchema<Input, Output> {
  /**
   * Built by `n.tuple()`.
   *
   * @throws {@link TypeError} when the items are not an array, or an item or the rest is not a
   * nominal type or a schema.
   *
   * @internal
   */
  public constructor(items: unknown, rest: unknown) {
    const fields = checkedItems(items);
    const restField = rest === undefined ? undefined : checkedField('the rest', rest);
    const runs = fields.map((field) => fieldRunner(field, 'n.tuple()'));
    const left = runs.findLastIndex((run) => run() instanceof Rejection);
    const min = left + 1;
    const runRules: TupleRules<(input: unknown) => unknown> = {
      items: runs,
      rest: restField === undefined ? undefined : fieldRunner(restField, 'n.tuple()'),
      min,
    };
    const writeRules = {
      items: fields.map((field) => writerOf(field)),
      rest: restField === undefined ? undefined : writerOf(restField),
      min,
    };
    const write = tupleWriter(writeRules);

    addEmitter('tuple', emitTuple);
    const run = tupleRun(runRules);

    super(
      {
        shape: {
          // The function returns a new array of the checked items, or a Rejection.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          run: run as (input: unknown) => Output | Rejection,
          describe: (side, target) => describeTuple(fields, restField, min, side, target),
        },
        paths: {
          write,
          accepts: tupleAcceptor({
            items: fields.map((field) => fieldAcceptor(field, 'n.tuple()')),
            rest: restField === undefined ? undefined : fieldAcceptor(restField, 'n.tuple()'),
            min,
          }),
          plan: {
            kind: 'tuple',
            items: fields.map((field) => planOf(field)),
            rest: restField === undefined ? { kind: 'json', write: plainValue } : planOf(restField),
            write,
          },
          parts: { kind: 'tuple', items: fields, rest: restField, min },
        },
      },
      { array: true, name: 'n.tuple()' },
    );
  }
}

/**
 * Builds a schema for an array whose positions mean different things, such as a point as
 * `[latitude, longitude]` or a range as `[from, to]`.
 *
 * @remarks
 * The item count is checked first: `too_few_items` or `too_many_items`. Then every item is checked
 * by the schema of its position, and every issue collected with the index in its path. With
 * `rest`, any number of further items follow, each checked by it. Trailing positions whose schema
 * accepts `undefined`, such as `n.of(Type).optional()`, may be left out. The result is a new array,
 * read-only by type; given to `Nominal()`, it is frozen.
 *
 * @typeParam Items - The type or schema of each position.
 * @typeParam Rest - The type or schema of the items past them.
 * @param items - A nominal type or a schema for each position, in order.
 * @param rest - A nominal type or a schema for every further item; none means no further items.
 * @returns The schema of the tuple.
 * @throws {@link TypeError} when `items` is not an array, or an item or `rest` is not a nominal type
 * or a schema.
 *
 * @example
 * ```ts
 * import { AnyString, Latitude, Longitude, n } from '@horizon-republic/nominal-types';
 *
 * const Point = n.tuple([Latitude, Longitude]);
 * const Command = n.tuple([AnyString], AnyString);
 *
 * Point.parse([50.45, 30.52]).ok; // true
 * Command.parse(['git', 'commit', '-m']).ok; // true
 * ```
 */
export const tuple = <
  const Items extends readonly ConstraintField[],
  const Rest extends ConstraintField | undefined = undefined,
>(
  items: Items,
  rest?: Rest,
): TupleSchema<TupleValue<Items, Rest, 'input'>, TupleValue<Items, Rest>> =>
  new TupleSchema(items, rest);
