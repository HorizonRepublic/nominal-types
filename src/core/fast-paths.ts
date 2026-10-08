import { acceptors, acceptsByRunning } from './acceptor.ts';
import type { Accepts } from './acceptor.ts';
import { boundsOf } from './array-bounds.ts';
import type { ArrayOptions } from './array-bounds.ts';
import type { AnyConstraint } from './constraint-types.ts';
import type { AnyNominalType } from './contracts.ts';
import { settleParts } from './deferred-parts.ts';
import { plans } from './json-leaves.ts';
import type { Plan } from './json-leaves.ts';
import { isNominalType, ownTypes } from './nominal.ts';
import {
  arrayWriter,
  emptyOrWriter,
  instanceWriter,
  objectWriter,
  writerOf,
  writers,
} from './plain-writers.ts';
import type { Write } from './plain-writers.ts';
import { recordParts } from './schema-parts.ts';
import type { SchemaParts } from './schema-parts.ts';
import {
  arrayAcceptor,
  emptyOrAcceptor,
  fieldAcceptor,
  objectAcceptor,
  typeAcceptor,
} from './shape-acceptors.ts';
import { stringifierOf, textOf } from './stringify.ts';
import type { TextForm } from './text-form.ts';

export type { Plain } from './plain.ts';

/**
 * What a schema built by `n.of()` or `n.object()` does besides running, generated for
 * its shape: write a value it gave as plain values, and check an input without building a value.
 *
 * @internal
 */
export interface FastPaths {
  /**
   * Turns a value the schema gave into plain values.
   */
  readonly write: Write;
  /**
   * Checks an input without building a value.
   */
  readonly accepts: Accepts;
  /**
   * How a value the schema gave is written as JSON text.
   */
  readonly plan: Plan;
  /**
   * What the schema is made of, a shape naming the paths of the schema it is around.
   */
  readonly parts?: SchemaParts;
}

/**
 * Records a schema's paths, so an object that holds the schema as a field calls them
 * directly.
 *
 * @internal
 */
export const registerPaths = (schema: object, paths: FastPaths): void => {
  writers.set(schema, paths.write);
  acceptors.set(schema, paths.accepts);
  plans.set(schema, paths.plan);
  recordParts(schema, paths, paths.parts);
};

/**
 * The plan of a field or a variant: its schema's own when it has one, writing through
 * its plain copy otherwise.
 *
 * @internal
 */
export const planOf = (field: unknown): Plan => {
  if (isNominalType(field)) {
    return { kind: 'type', type: field };
  }

  settleParts(field);

  const own = typeof field === 'object' && field !== null ? plans.get(field) : undefined;

  return own ?? { kind: 'json', write: writerOf(field) };
};

/**
 * The function `stringify()` of a schema calls, generated for its plan; without code
 * generation, its plain copy goes to `JSON.stringify()`.
 *
 * @internal
 */
export const stringifyFor = ({ plan, write }: FastPaths): ((value: unknown) => string) => {
  const stringify = stringifierOf(plan, ownTypes, (value) => JSON.stringify(write(value)));

  /**
   * The JSON text of a value.
   *
   * @throws {@link TypeError} if JSON has no text for the value, such as `undefined`.
   *
   * @internal
   */
  return (value) => textOf(stringify, value);
};

/**
 * The paths of `n.of(type)`.
 *
 * @internal
 */
export const typePaths = (type: AnyNominalType): FastPaths => ({
  write: instanceWriter(),
  accepts: typeAcceptor(type),
  plan: { kind: 'type', type },
  parts: { kind: 'type', type },
});

/**
 * The paths of an array of `item`; with `unique`, the check builds the values, since
 * repeats are found among them.
 *
 * @throws {@link TypeError} when the options hold bounds that `boundsOf` refuses.
 *
 * @internal
 */
export const arrayPaths = (
  item: FastPaths,
  options: ArrayOptions,
  run: (input: unknown) => unknown,
): FastPaths => {
  const { min, max } = boundsOf(options);

  return {
    write: arrayWriter(item.write),
    accepts:
      options.unique === true ? acceptsByRunning(run) : arrayAcceptor(item.accepts, min, max),
    plan: { kind: 'array', item: item.plan },
    parts: { kind: 'array', item, options },
  };
};

const emptyOrPaths = (item: FastPaths, empty?: null): FastPaths => ({
  write: emptyOrWriter(item.write, empty),
  accepts: emptyOrAcceptor(item.accepts, empty),
  plan: { kind: 'empty', item: item.plan, empty },
  parts: { kind: empty === null ? 'nullable' : 'optional', item },
});

/**
 * The paths of `item` or `undefined`.
 *
 * @internal
 */
export const optionalPaths = (item: FastPaths): FastPaths => emptyOrPaths(item);

/**
 * The paths of `item` or `null`.
 *
 * @internal
 */
export const nullablePaths = (item: FastPaths): FastPaths => emptyOrPaths(item, null);

/**
 * The paths of a schema with rules added by `check()`: those of the schema, the check running
 * the rules, which read the values.
 *
 * @internal
 */
export const checkedPaths = (item: FastPaths, run: (input: unknown) => unknown): FastPaths => ({
  ...item,
  accepts: acceptsByRunning(run),
});

/**
 * The paths of `item` reading a string through a text form first.
 *
 * @internal
 */
export const textPaths = (item: FastPaths, form: TextForm): FastPaths => ({
  write: item.write,
  accepts: (input) => item.accepts(typeof input === 'string' ? (form(input) ?? input) : input),
  plan: item.plan,
  parts: { kind: 'text', item },
});

/**
 * The paths of an `n.object()` schema; with constraints, the check builds the values,
 * since the constraints read them.
 *
 * @internal
 */
export const objectPaths = (
  fields: ReadonlyArray<{ readonly key: string; readonly optional: boolean }>,
  source: Readonly<Record<string, unknown>>,
  options: {
    readonly strict: boolean;
    readonly constraints: readonly AnyConstraint[];
    readonly run: (input: unknown) => unknown;
  },
): FastPaths => {
  const write = objectWriter(
    fields.map(({ key, optional }) => ({ key, optional, write: writerOf(source[key]) })),
  );

  return {
    write,
    accepts:
      options.constraints.length > 0
        ? acceptsByRunning(options.run)
        : objectAcceptor(
            fields.map(({ key, optional }) => ({
              key,
              optional,
              accepts: fieldAcceptor(source[key], 'n.object()'),
            })),
            options.strict,
          ),
    plan: {
      kind: 'object',
      fields: fields.map(({ key, optional }) => ({ key, optional, plan: planOf(source[key]) })),
      write,
    },
    parts: {
      kind: 'object',
      fields: fields.map(({ key, optional }) => ({ key, optional, field: source[key] })),
      strict: options.strict,
    },
  };
};
