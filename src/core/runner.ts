import type { NominalSchema } from './contracts.ts';
import { standardProps } from './standard-props.ts';
import type { Describe, Run } from './standard-props.ts';

/**
 * The functions that run schemas built by `n.of()`, returning the value or a
 * `Rejection`, so a chain can call them without going through `validate`.
 *
 * @remarks
 * Each copy of the package keeps its own: a run from another copy rejects with that copy's
 * `Rejection`, which this copy wouldn't recognise, so such a schema goes through `validate`.
 *
 * @internal
 */
export const runners: WeakMap<object, (input: unknown) => unknown> = new WeakMap();

/**
 * A schema made of a run function and a description, which chains run directly.
 *
 * @internal
 */
export const runnableSchema = <Input, Output>(
  run: Run<Output>,
  describe: Describe,
): NominalSchema<Input, Output> => {
  const schema = { '~standard': standardProps<Input, Output>(run, describe) };

  runners.set(schema, run);

  return schema;
};
