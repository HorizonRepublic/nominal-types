import type { NominalSchema } from './contracts.ts';
import { shared } from './shared.ts';
import { standardProps } from './standard-props.ts';
import type { Describe, Run } from './standard-props.ts';

/**
 * Internal: the functions that run schemas built by `schemaOf()`, returning the value or a
 * `Rejection`, so a chain can call them without going through `validate`.
 */
export const runners: WeakMap<object, (input: unknown) => unknown> = shared.runners;

/**
 * Internal: a schema made of a run function and a description, which chains run directly.
 */
export const runnableSchema = <Input, Output>(
  run: Run<Output>,
  describe: Describe,
): NominalSchema<Input, Output> => {
  const schema = { '~standard': standardProps<Input, Output>(run, describe) };
  runners.set(schema, run);
  return schema;
};
