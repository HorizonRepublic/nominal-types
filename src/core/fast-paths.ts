import { acceptors, acceptsByRunning } from './acceptor.ts';
import type { Accepts } from './acceptor.ts';
import { boundsOf } from './array-bounds.ts';
import type { ArrayOptions } from './array-bounds.ts';
import type { AnyConstraint } from './constraint-types.ts';
import type { AnyNominalType } from './contracts.ts';
import {
  arrayWriter,
  emptyOrWriter,
  instanceWriter,
  objectWriter,
  writerOf,
  writers,
} from './plain-writers.ts';
import type { Write } from './plain-writers.ts';
import {
  arrayAcceptor,
  emptyOrAcceptor,
  fieldAcceptor,
  objectAcceptor,
  typeAcceptor,
} from './shape-acceptors.ts';
import type { TextForm } from './text-form.ts';

export type { Plain } from './plain.ts';

/**
 * Internal: what a schema built by `n.of()` or `n.object()` does besides running, generated for
 * its shape: write a value it gave as plain values, and check an input without building a value.
 */
export interface FastPaths {
  readonly write: Write;
  readonly accepts: Accepts;
}

/**
 * Internal: records a schema's paths, so an object that holds the schema as a field calls them
 * directly.
 */
export const registerPaths = (schema: object, paths: FastPaths): void => {
  writers.set(schema, paths.write);
  acceptors.set(schema, paths.accepts);
};

/**
 * Internal: the paths of `n.of(type)`.
 */
export const typePaths = (type: AnyNominalType): FastPaths => ({
  write: instanceWriter(),
  accepts: typeAcceptor(type),
});

/**
 * Internal: the paths of an array of `item`; with `unique`, the check builds the values, since
 * repeats are found among them.
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
  };
};

const emptyOrPaths = (item: FastPaths, empty?: null): FastPaths => ({
  write: emptyOrWriter(item.write, empty),
  accepts: emptyOrAcceptor(item.accepts, empty),
});

/**
 * Internal: the paths of `item` or `undefined`.
 */
export const optionalPaths = (item: FastPaths): FastPaths => emptyOrPaths(item);

/**
 * Internal: the paths of `item` or `null`.
 */
export const nullablePaths = (item: FastPaths): FastPaths => emptyOrPaths(item, null);

/**
 * Internal: the paths of `item` reading a string through a text form first.
 */
export const textPaths = (item: FastPaths, form: TextForm): FastPaths => ({
  write: item.write,
  accepts: (input) => item.accepts(typeof input === 'string' ? (form(input) ?? input) : input),
});

/**
 * Internal: the paths of an `n.object()` schema; with constraints, the check builds the values,
 * since the constraints read them.
 */
export const objectPaths = (
  fields: ReadonlyArray<{ readonly key: string; readonly optional: boolean }>,
  source: Readonly<Record<string, unknown>>,
  options: {
    readonly strict: boolean;
    readonly constraints: readonly AnyConstraint[];
    readonly run: (input: unknown) => unknown;
  },
): FastPaths => ({
  write: objectWriter(
    fields.map(({ key, optional }) => ({ key, optional, write: writerOf(source[key]) })),
  ),
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
});
